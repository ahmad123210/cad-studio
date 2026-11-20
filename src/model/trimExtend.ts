/**
 * @file trimExtend.ts
 * @description حسابات القص (Trim) والتمديد (Extend) بنمط AutoCAD للجدران والخطوط الحرة.
 * - التمديد: أقرب طرف للنقرة يمتد على استقامته حتى أول تقاطع مع جدار/خط/مسار آخر.
 * - القص: الجزء المنقور بين أقرب تقاطعين (أو بين تقاطع وطرف) يُزال؛ قد ينقسم العنصر إلى عنصرين.
 * الأبواب والنوافذ والرموز الملتصقة تحتفظ بمواضعها الفعلية (تُعاد نسبتها للجدار الجديد) أو تُحذف إن وقعت في الجزء المقصوص.
 * دوال صرفة تُرجع "خطة تعديل" يطبقها ProjectModel.applyEdits كخطوة تراجع واحدة.
 */

import type { Point, ProjectObject, WallObject, LineObject, DoorObject, WindowObject, SymbolObject, RouteObject } from './types.ts';
import { newObjectId } from './transforms.ts';

export interface EditPlan {
  updates: { id: string; after: Partial<ProjectObject> }[];
  adds: ProjectObject[];
  deletes: string[];
}

type Seg = { a: Point; b: Point; id: string };

const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
const rp = (p: Point): Point => ({ x: r6(p.x), y: r6(p.y) });
const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

/** مقاطع الحدود: محاور الجدران، الخطوط الحرة، والمسارات (عدا العنصر نفسه) */
function boundarySegments(all: ProjectObject[], excludeId: string): Seg[] {
  const segs: Seg[] = [];
  for (const o of all) {
    if (o.id === excludeId) continue;
    if (o.type === 'wall') segs.push({ a: (o as WallObject).start, b: (o as WallObject).end, id: o.id });
    else if (o.type === 'line' || o.type === 'route') {
      const pts = (o as LineObject | RouteObject).points;
      const n = pts.length;
      const closed = o.type === 'line' && (o as LineObject).closed && n > 2;
      for (let i = 0; i < (closed ? n : n - 1); i++) segs.push({ a: pts[i], b: pts[(i + 1) % n], id: o.id });
    }
  }
  return segs;
}

/** معاملات التقاطع t على القطعة a→b مع حد (u ضمن [0,1] على الحد). extendRay يسمح بـ t خارج [0,1] */
function intersectParams(a: Point, b: Point, segs: Seg[]): number[] {
  const out: number[] = [];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  for (const s of segs) {
    const ex = s.b.x - s.a.x;
    const ey = s.b.y - s.a.y;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((s.a.x - a.x) * ey - (s.a.y - a.y) * ex) / den;
    const u = ((s.a.x - a.x) * dy - (s.a.y - a.y) * dx) / den;
    if (u >= -1e-6 && u <= 1 + 1e-6) out.push(t);
  }
  return out;
}

function projectT(p: Point, a: Point, b: Point): { t: number; dist: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  const q = lerp(a, b, t);
  return { t, dist: Math.hypot(p.x - q.x, p.y - q.y) };
}

/** العنصر القابل للقص/التمديد الأقرب للنقرة (جدار أو خط حر) ضمن السماحية */
export function pickTrimTarget(all: ProjectObject[], p: Point, tolerance: number): { obj: WallObject | LineObject; segIndex: number; t: number } | null {
  let best: { obj: WallObject | LineObject; segIndex: number; t: number; dist: number } | null = null;
  for (const o of all) {
    if (o.type === 'wall') {
      const w = o as WallObject;
      const r = projectT(p, w.start, w.end);
      const tol = Math.max(tolerance, w.thickness / 2);
      if (r.dist <= tol && (!best || r.dist < best.dist)) best = { obj: w, segIndex: 0, t: r.t, dist: r.dist };
    } else if (o.type === 'line') {
      const l = o as LineObject;
      const segCount = l.closed && l.points.length > 2 ? l.points.length : l.points.length - 1;
      for (let i = 0; i < segCount; i++) {
        const r = projectT(p, l.points[i], l.points[(i + 1) % l.points.length]);
        if (r.dist <= tolerance && (!best || r.dist < best.dist)) best = { obj: l, segIndex: i, t: r.t, dist: r.dist };
      }
    }
  }
  return best ? { obj: best.obj, segIndex: best.segIndex, t: best.t } : null;
}

/** إعادة توزيع الفتحات والرموز الملتصقة على الجدار بعد تغيير طرفيه/قسمته */
function remapHosted(all: ProjectObject[], wall: WallObject, pieces: { id: string; t0: number; t1: number }[], plan: EditPlan): void {
  const len = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
  for (const o of all) {
    const isOpening = (o.type === 'door' || o.type === 'window') && (o as DoorObject).wallId === wall.id;
    const isSym = o.type === 'symbol' && (o as SymbolObject).wallId === wall.id && typeof (o as SymbolObject).wallPosition === 'number';
    if (!isOpening && !isSym) continue;
    const t = isOpening ? (o as DoorObject | WindowObject).position : (o as SymbolObject).wallPosition!;
    const halfW = isOpening && len > 0 ? (o as DoorObject).width / 2 / len : 0;
    const piece = pieces.find((pc) => t - halfW >= pc.t0 - 1e-9 && t + halfW <= pc.t1 + 1e-9);
    if (!piece) {
      if (isOpening) plan.deletes.push(o.id); // الفتحة وقعت في الجزء المقصوص
      else plan.updates.push({ id: o.id, after: { wallId: undefined, wallPosition: undefined } as Partial<SymbolObject> });
      continue;
    }
    const newT = r6((t - piece.t0) / (piece.t1 - piece.t0));
    if (isOpening) plan.updates.push({ id: o.id, after: { wallId: piece.id, position: newT } as Partial<DoorObject> });
    else plan.updates.push({ id: o.id, after: { wallId: piece.id, wallPosition: newT } as Partial<SymbolObject> });
  }
}

/** تمديد أقرب طرف للنقرة حتى أول حد. يعيد الخطة أو رسالة خطأ */
export function planExtend(all: ProjectObject[], click: Point, tolerance: number): EditPlan | string {
  const target = pickTrimTarget(all, click, tolerance);
  if (!target) return 'انقر قرب طرف جدار أو خط لتمديده';
  const segs = boundarySegments(all, target.obj.id);
  const plan: EditPlan = { updates: [], adds: [], deletes: [] };
  if (target.obj.type === 'wall') {
    const w = target.obj as WallObject;
    const fromEnd = target.t >= 0.5; // نمد الطرف الأقرب للنقرة
    const ts = intersectParams(w.start, w.end, segs);
    const cand = fromEnd ? ts.filter((t) => t > 1 + 1e-6).sort((a, b) => a - b)[0] : ts.filter((t) => t < -1e-6).sort((a, b) => b - a)[0];
    if (cand === undefined) return 'لا يوجد حد على امتداد هذا الطرف';
    const newStart = fromEnd ? w.start : rp(lerp(w.start, w.end, cand));
    const newEnd = fromEnd ? rp(lerp(w.start, w.end, cand)) : w.end;
    plan.updates.push({ id: w.id, after: { start: newStart, end: newEnd } as Partial<WallObject> });
    // الفتحات تحافظ على موضعها الفعلي: t_new = (t*L - shift) / L_new
    const oldLen = Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y);
    const newLen = Math.hypot(newEnd.x - newStart.x, newEnd.y - newStart.y);
    const shift = fromEnd ? 0 : -cand * oldLen; // كم تقدّمت البداية للخلف
    for (const o of all) {
      if ((o.type === 'door' || o.type === 'window') && (o as DoorObject).wallId === w.id) {
        const pos = ((o as DoorObject).position * oldLen + shift) / newLen;
        plan.updates.push({ id: o.id, after: { position: r6(pos) } as Partial<DoorObject> });
      } else if (o.type === 'symbol' && (o as SymbolObject).wallId === w.id && typeof (o as SymbolObject).wallPosition === 'number') {
        const pos = ((o as SymbolObject).wallPosition! * oldLen + shift) / newLen;
        plan.updates.push({ id: o.id, after: { wallPosition: r6(pos) } as Partial<SymbolObject> });
      }
    }
    return plan;
  }
  const l = target.obj as LineObject;
  if (l.closed) return 'لا يمكن تمديد خط مغلق';
  const n = l.points.length;
  const atEnd = target.segIndex === n - 2 && (n === 2 ? target.t >= 0.5 : true) && target.segIndex >= (n - 1) / 2;
  const a = atEnd ? l.points[n - 2] : l.points[1];
  const b = atEnd ? l.points[n - 1] : l.points[0];
  const ts = intersectParams(a, b, segs).filter((t) => t > 1 + 1e-6).sort((x, y) => x - y);
  if (ts.length === 0) return 'لا يوجد حد على امتداد هذا الطرف';
  const np = rp(lerp(a, b, ts[0]));
  const pts = l.points.map((p) => ({ ...p }));
  if (atEnd) pts[n - 1] = np;
  else pts[0] = np;
  plan.updates.push({ id: l.id, after: { points: pts } as Partial<LineObject> });
  return plan;
}

/** قص الجزء المنقور بين أقرب حدّين. يعيد الخطة أو رسالة خطأ */
export function planTrim(all: ProjectObject[], click: Point, tolerance: number): EditPlan | string {
  const target = pickTrimTarget(all, click, tolerance);
  if (!target) return 'انقر على الجزء المراد قصه من جدار أو خط';
  const segs = boundarySegments(all, target.obj.id);
  const plan: EditPlan = { updates: [], adds: [], deletes: [] };

  if (target.obj.type === 'wall') {
    const w = target.obj as WallObject;
    const ts = intersectParams(w.start, w.end, segs).filter((t) => t > 1e-6 && t < 1 - 1e-6);
    const before = ts.filter((t) => t < target.t).sort((a, b) => b - a)[0];
    const after = ts.filter((t) => t > target.t).sort((a, b) => a - b)[0];
    if (before === undefined && after === undefined) return 'لا توجد حدود تقطع هذا الجدار';
    const pieces: { id: string; t0: number; t1: number }[] = [];
    if (before !== undefined && after !== undefined) {
      const second: WallObject = { ...JSON.parse(JSON.stringify(w)), id: newObjectId('wall'), start: rp(lerp(w.start, w.end, after)), end: { ...w.end } };
      plan.updates.push({ id: w.id, after: { end: rp(lerp(w.start, w.end, before)) } as Partial<WallObject> });
      plan.adds.push(second);
      pieces.push({ id: w.id, t0: 0, t1: before }, { id: second.id, t0: after, t1: 1 });
    } else if (before !== undefined) {
      plan.updates.push({ id: w.id, after: { end: rp(lerp(w.start, w.end, before)) } as Partial<WallObject> });
      pieces.push({ id: w.id, t0: 0, t1: before });
    } else {
      plan.updates.push({ id: w.id, after: { start: rp(lerp(w.start, w.end, after!)) } as Partial<WallObject> });
      pieces.push({ id: w.id, t0: after!, t1: 1 });
    }
    remapHosted(all, w, pieces, plan);
    return plan;
  }

  const l = target.obj as LineObject;
  if (l.closed && l.points.length > 2) return planTrimClosed(l, target.segIndex + target.t, segs, plan);
  const i = target.segIndex;
  const a = l.points[i];
  const b = l.points[i + 1];
  const ts = intersectParams(a, b, segs).filter((t) => t > 1e-6 && t < 1 - 1e-6);
  const before = ts.filter((t) => t < target.t).sort((x, y) => y - x)[0];
  const after = ts.filter((t) => t > target.t).sort((x, y) => x - y)[0];
  if (before === undefined && after === undefined) return 'لا توجد حدود تقطع هذا الجزء';
  const head = before !== undefined ? [...l.points.slice(0, i + 1), rp(lerp(a, b, before))] : null;
  const tail = after !== undefined ? [rp(lerp(a, b, after)), ...l.points.slice(i + 1)] : null;
  if (head && tail) {
    plan.updates.push({ id: l.id, after: { points: head } as Partial<LineObject> });
    plan.adds.push({ ...JSON.parse(JSON.stringify(l)), id: newObjectId('line'), points: tail });
  } else if (head) {
    plan.updates.push({ id: l.id, after: { points: head } as Partial<LineObject> });
  } else {
    plan.updates.push({ id: l.id, after: { points: tail! } as Partial<LineObject> });
  }
  return plan;
}

/**
 * قص خط مغلق: يُزال الجزء المنقور بين أقرب تقاطعين حول الحلقة، ويصبح الباقي خطاً مفتوحاً
 * يبدأ من التقاطع التالي للنقرة ويلتف حول الحلقة حتى التقاطع السابق لها.
 * c = موضع النقرة على المحيط بوحدة "رقم القطعة + t".
 */
function planTrimClosed(l: LineObject, c: number, segs: Seg[], plan: EditPlan): EditPlan | string {
  const pts = l.points;
  const n = pts.length;
  const at = (s: number): Point => {
    const m = ((s % n) + n) % n;
    const k = Math.floor(m);
    return lerp(pts[k], pts[(k + 1) % n], m - k);
  };
  const cuts: number[] = [];
  for (let k = 0; k < n; k++) {
    for (const t of intersectParams(pts[k], pts[(k + 1) % n], segs)) {
      if (t > 1e-6 && t < 1 - 1e-6) cuts.push(k + t);
    }
  }
  const uniq = [...new Set(cuts.map(r6))].sort((x, y) => x - y);
  if (uniq.length < 2) return 'قص خط مغلق يتطلب حدّين يقطعانه على الأقل';
  const after = uniq.find((s) => s > c) ?? uniq[0] + n;
  const before = [...uniq].reverse().find((s) => s < c) ?? uniq[uniq.length - 1] - n;
  // الجزء المحتفظ به: من after إلى before + n (حول الحلقة)
  const start = after;
  const end = before + n;
  if (end - start < 1e-6) return 'لا يمكن قص هذا الجزء';
  const out: Point[] = [rp(at(start))];
  for (let j = Math.floor(start) + 1; j < end - 1e-9; j++) out.push({ ...pts[j % n] });
  out.push(rp(at(end)));
  plan.updates.push({ id: l.id, after: { points: out, closed: false } as Partial<LineObject> });
  return plan;
}
