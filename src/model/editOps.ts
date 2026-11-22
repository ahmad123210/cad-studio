/**
 * @file editOps.ts
 * @description عمليات تحرير إضافية (دوال صرفة تُرجع خطة تعديل تُطبَّق كخطوة تراجع واحدة):
 *  - وصل ركن (Fillet بنصف قطر 0): تمديد/قص جدارين ليلتقيا في ركن
 *  - شطف ركن (Chamfer): قطع الركن بمسافتين وإضافة جدار مائل يصل بينهما
 *  - كسر (Break): تقسيم جدار/خط عند نقطة، أو إزالة الجزء بين نقطتين
 *  - دمج (Join): دمج جدران على استقامة واحدة متلامسة، أو خطوط متصلة الأطراف
 *  - تمطيط (Stretch): تحريك الرؤوس الواقعة داخل نافذة فقط
 *  - أبعاد متسلسلة: أبعاد لجدار كامل مع فتحاته بنقرة واحدة
 * الأبواب والنوافذ تحافظ على مواضعها الفعلية (remapHosted).
 */
import type { Point, ProjectObject, WallObject, LineObject, RouteObject, DimensionObject, DoorObject, WindowObject } from './types.ts';
import { remapHosted, type EditPlan } from './trimExtend.ts';

const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
const rp = (p: Point): Point => ({ x: r6(p.x), y: r6(p.y) });
const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x;
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const lerp = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
const newId = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const emptyPlan = (): EditPlan => ({ updates: [], adds: [], deletes: [] });

/** معامل موضع نقطة على امتداد الجدار (0 عند البداية، 1 عند النهاية) */
export function paramOn(w: { start: Point; end: Point }, p: Point): number {
  const d = sub(w.end, w.start);
  const L2 = d.x * d.x + d.y * d.y || 1;
  return ((p.x - w.start.x) * d.x + (p.y - w.start.y) * d.y) / L2;
}

/** تقاطع امتدادي محوري جدارين (null إن كانا متوازيين) */
export function lineIntersection(a: { start: Point; end: Point }, b: { start: Point; end: Point }): Point | null {
  const r = sub(a.end, a.start);
  const s = sub(b.end, b.start);
  const den = cross(r, s);
  if (Math.abs(den) < 1e-9 * (Math.hypot(r.x, r.y) * Math.hypot(s.x, s.y) + 1)) return null;
  const t = cross(sub(b.start, a.start), s) / den;
  return { x: a.start.x + r.x * t, y: a.start.y + r.y * t };
}

/** المدى الجديد للجدار [t0,t1] بمعاملات الجدار القديم بعد نقل أحد طرفيه إلى I */
function cornerRange(w: WallObject, I: Point, clickT: number): { t0: number; t1: number } {
  const tI = paramOn(w, I);
  if (tI > 1 - 1e-9) return { t0: 0, t1: tI }; // تمديد النهاية
  if (tI < 1e-9) return { t0: tI, t1: 1 }; // تمديد البداية
  // التقاطع داخل الجدار: نحتفظ بالجهة التي نُقر عليها
  return clickT < tI ? { t0: 0, t1: tI } : { t0: tI, t1: 1 };
}

function applyRange(all: ProjectObject[], w: WallObject, range: { t0: number; t1: number }, plan: EditPlan): void {
  plan.updates.push({ id: w.id, after: { start: rp(lerp(w.start, w.end, range.t0)), end: rp(lerp(w.start, w.end, range.t1)) } as Partial<WallObject> });
  remapHosted(all, w, [{ id: w.id, t0: range.t0, t1: range.t1 }], plan);
}

/** وصل ركن: الجداران يلتقيان عند تقاطع محوريهما */
export function planFillet(all: ProjectObject[], a: WallObject, clickA: Point, b: WallObject, clickB: Point): EditPlan | string {
  if (a.id === b.id) return 'اختر جدارين مختلفين';
  const I = lineIntersection(a, b);
  if (!I) return 'الجداران متوازيان ولا يلتقيان';
  const plan = emptyPlan();
  applyRange(all, a, cornerRange(a, I, paramOn(a, clickA)), plan);
  applyRange(all, b, cornerRange(b, I, paramOn(b, clickB)), plan);
  return plan;
}

/** شطف ركن: يُقطع كل جدار على بعد d من الركن ويضاف جدار مائل بينهما */
export function planChamfer(all: ProjectObject[], a: WallObject, clickA: Point, b: WallObject, clickB: Point, dA: number, dB: number): EditPlan | string {
  if (a.id === b.id) return 'اختر جدارين مختلفين';
  const I = lineIntersection(a, b);
  if (!I) return 'الجداران متوازيان ولا يلتقيان';
  const plan = emptyPlan();
  const cut = (w: WallObject, click: Point, d: number): Point | string => {
    const range = cornerRange(w, I, paramOn(w, click));
    const tI = paramOn(w, I);
    // الطرف البعيد المحتفظ به
    const keepT = Math.abs(range.t0 - tI) < 1e-9 ? range.t1 : range.t0;
    const far = lerp(w.start, w.end, keepT);
    const L = dist(I, far);
    if (d >= L - 1e-6) return 'مسافة الشطف أطول من الجدار';
    const p = lerp(I, far, d / L);
    const tp = paramOn(w, p);
    const newRange = keepT > tI ? { t0: tp, t1: keepT } : { t0: keepT, t1: tp };
    applyRange(all, w, newRange, plan);
    return p;
  };
  const pa = cut(a, clickA, dA);
  if (typeof pa === 'string') return pa;
  const pb = cut(b, clickB, dB);
  if (typeof pb === 'string') return pb;
  plan.adds.push({ id: newId('wall'), type: 'wall', layerId: a.layerId, start: rp(pa), end: rp(pb), thickness: Math.min(a.thickness, b.thickness) } as WallObject);
  return plan;
}

/** طول متعدد الخطوط حتى المعامل s (رقم القطعة + t) والعكس */
function polyPointAt(pts: Point[], s: number): Point {
  const k = Math.max(0, Math.min(pts.length - 2, Math.floor(s)));
  return lerp(pts[k], pts[k + 1], s - k);
}
function polyParam(pts: Point[], p: Point): number {
  let best = 0;
  let bestD = Infinity;
  for (let k = 0; k < pts.length - 1; k++) {
    const t = Math.max(0, Math.min(1, paramOn({ start: pts[k], end: pts[k + 1] }, p)));
    const d = dist(lerp(pts[k], pts[k + 1], t), p);
    if (d < bestD) {
      bestD = d;
      best = k + t;
    }
  }
  return best;
}
function polySlice(pts: Point[], s0: number, s1: number): Point[] {
  const out = [rp(polyPointAt(pts, s0))];
  for (let k = Math.floor(s0) + 1; k <= Math.ceil(s1) - 1 && k < pts.length; k++) if (k > s0 && k < s1) out.push({ ...pts[k] });
  out.push(rp(polyPointAt(pts, s1)));
  return out;
}

/**
 * كسر: نقطتان على العنصر نفسه. إن تقاربتا (أقل من tol) يُقسم العنصر عند النقطة دون فجوة،
 * وإلا يُزال الجزء بينهما.
 */
export function planBreak(all: ProjectObject[], obj: ProjectObject, p1: Point, p2: Point, tol: number): EditPlan | string {
  const plan = emptyPlan();
  if (obj.type === 'wall') {
    const w = obj as WallObject;
    const L = dist(w.start, w.end);
    let t1 = Math.max(0, Math.min(1, paramOn(w, p1)));
    let t2 = Math.max(0, Math.min(1, paramOn(w, p2)));
    if (t1 > t2) [t1, t2] = [t2, t1];
    if ((t2 - t1) * L < tol) t2 = t1;
    if (t1 * L < tol && (1 - t2) * L < tol) return 'لا يمكن إزالة الجدار كاملاً بالكسر';
    const pieces: { id: string; t0: number; t1: number }[] = [];
    const firstOk = t1 * L >= tol;
    const secondOk = (1 - t2) * L >= tol;
    if (firstOk) {
      pieces.push({ id: w.id, t0: 0, t1 });
      plan.updates.push({ id: w.id, after: { end: rp(lerp(w.start, w.end, t1)) } as Partial<WallObject> });
    }
    if (secondOk) {
      const id = firstOk ? newId('wall') : w.id;
      pieces.push({ id, t0: t2, t1: 1 });
      if (firstOk) plan.adds.push({ ...w, id, start: rp(lerp(w.start, w.end, t2)), end: { ...w.end } } as WallObject);
      else plan.updates.push({ id: w.id, after: { start: rp(lerp(w.start, w.end, t2)) } as Partial<WallObject> });
    }
    remapHosted(all, w, pieces, plan);
    return plan;
  }
  if (obj.type === 'line' || obj.type === 'route') {
    const l = obj as LineObject | RouteObject;
    if ((l as LineObject).closed) return 'كسر الخطوط المغلقة غير مدعوم؛ استخدم القص';
    const pts = l.points;
    let s1 = polyParam(pts, p1);
    let s2 = polyParam(pts, p2);
    if (s1 > s2) [s1, s2] = [s2, s1];
    const end = pts.length - 1;
    const len = (a: number, b: number) => dist(polyPointAt(pts, a), polyPointAt(pts, b));
    if (len(s1, s2) < tol) s2 = s1;
    const first = s1 > 1e-6 ? polySlice(pts, 0, s1) : null;
    const second = s2 < end - 1e-6 ? polySlice(pts, s2, end) : null;
    if (!first && !second) return 'لا يمكن إزالة الخط كاملاً بالكسر';
    if (first) plan.updates.push({ id: l.id, after: { points: first } as Partial<LineObject> });
    if (second) {
      if (first) plan.adds.push({ ...(l as LineObject), id: newId(l.type), points: second } as ProjectObject);
      else plan.updates.push({ id: l.id, after: { points: second } as Partial<LineObject> });
    }
    return plan;
  }
  return 'الكسر يعمل على الجدران والخطوط والمسارات';
}

/** دمج: جداران على استقامة واحدة متلامسان/متداخلان، أو خطان يلتقي طرفاهما */
export function planJoin(all: ProjectObject[], ids: string[], tol: number): EditPlan | string {
  const byId = new Map(all.map((o) => [o.id, o]));
  const walls = ids.map((id) => byId.get(id)).filter((o): o is WallObject => o?.type === 'wall').map((w) => ({ ...w }));
  const lines = ids.map((id) => byId.get(id)).filter((o): o is LineObject => o?.type === 'line' && !(o as LineObject).closed).map((l) => ({ ...l, points: [...l.points] }));
  const plan = emptyPlan();
  const removed = new Set<string>();
  let merges = 0;

  // جدران: نكرر حتى لا يبقى ما يُدمج
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < walls.length; i++) {
      for (let j = i + 1; j < walls.length; j++) {
        const a = walls[i];
        const b = walls[j];
        const da = sub(a.end, a.start);
        const La = Math.hypot(da.x, da.y);
        const db = sub(b.end, b.start);
        const Lb = Math.hypot(db.x, db.y);
        if (La < 1e-6 || Lb < 1e-6) continue;
        const sinAng = Math.abs(cross(da, db)) / (La * Lb);
        if (sinAng > Math.sin((1 * Math.PI) / 180)) continue; // ليسا على استقامة واحدة
        const off = Math.abs(cross(da, sub(b.start, a.start))) / La;
        if (off > Math.max(tol, Math.min(a.thickness, b.thickness) * 0.25)) continue;
        if (Math.abs(a.thickness - b.thickness) > 0.5) continue; // سماكتان مختلفتان
        const tb0 = paramOn(a, b.start);
        const tb1 = paramOn(a, b.end);
        const lo = Math.min(tb0, tb1);
        const hi = Math.max(tb0, tb1);
        if (lo > 1 + tol / La || hi < -tol / La) continue; // فجوة بينهما
        const t0 = Math.min(0, lo);
        const t1 = Math.max(1, hi);
        const merged = { ...a, start: rp(lerp(a.start, a.end, t0)), end: rp(lerp(a.start, a.end, t1)) };
        // فتحات الجدارين تنتقل إلى الجدار المدموج بمواضعها الفعلية
        for (const o of all) {
          if ((o.type === 'door' || o.type === 'window') && ((o as DoorObject).wallId === b.id || (o as DoorObject).wallId === a.id)) {
            const host = (o as DoorObject).wallId === b.id ? b : a;
            const c = lerp(host.start, host.end, (o as DoorObject | WindowObject).position);
            const pos = r6(paramOn(merged, c));
            const existing = plan.updates.find((u) => u.id === o.id);
            const after = { wallId: a.id, position: pos } as Partial<DoorObject>;
            if (existing) existing.after = after;
            else plan.updates.push({ id: o.id, after });
          }
        }
        walls[i] = merged;
        walls.splice(j, 1);
        removed.add(b.id);
        merges++;
        changed = true;
        break outer;
      }
    }
  }
  for (const w of walls) {
    if (removed.has(w.id)) continue;
    const orig = byId.get(w.id) as WallObject;
    if (orig.start.x !== w.start.x || orig.start.y !== w.start.y || orig.end.x !== w.end.x || orig.end.y !== w.end.y) {
      plan.updates.push({ id: w.id, after: { start: w.start, end: w.end } as Partial<WallObject> });
    }
  }

  // خطوط: وصل الأطراف المتطابقة
  changed = true;
  while (changed) {
    changed = false;
    outer2: for (let i = 0; i < lines.length; i++) {
      for (let j = i + 1; j < lines.length; j++) {
        const a = lines[i].points;
        const b = lines[j].points;
        const A0 = a[0], A1 = a[a.length - 1], B0 = b[0], B1 = b[b.length - 1];
        let joined: Point[] | null = null;
        if (dist(A1, B0) <= tol) joined = [...a, ...b.slice(1)];
        else if (dist(A1, B1) <= tol) joined = [...a, ...[...b].reverse().slice(1)];
        else if (dist(A0, B1) <= tol) joined = [...b, ...a.slice(1)];
        else if (dist(A0, B0) <= tol) joined = [...[...b].reverse(), ...a.slice(1)];
        if (!joined) continue;
        lines[i] = { ...lines[i], points: joined };
        removed.add(lines[j].id);
        lines.splice(j, 1);
        merges++;
        changed = true;
        break outer2;
      }
    }
  }
  for (const l of lines) {
    const orig = byId.get(l.id) as LineObject;
    if (l.points.length !== orig.points.length) plan.updates.push({ id: l.id, after: { points: l.points } as Partial<LineObject> });
  }
  if (merges === 0) return 'لا توجد عناصر قابلة للدمج: الجدران يجب أن تكون على استقامة واحدة ومتلامسة، والخطوط متصلة الأطراف';
  plan.deletes.push(...removed);
  return plan;
}

export interface BoxRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
const inBox = (p: Point, b: BoxRect) => p.x >= b.minX && p.x <= b.maxX && p.y >= b.minY && p.y <= b.maxY;

/** تمطيط: الرؤوس داخل النافذة تتحرك بالإزاحة، والعناصر النقطية داخلها تنتقل كاملة */
export function planStretch(all: ProjectObject[], box: BoxRect, delta: Point): EditPlan | string {
  const plan = emptyPlan();
  const mv = (p: Point) => (inBox(p, box) ? rp({ x: p.x + delta.x, y: p.y + delta.y }) : p);
  for (const o of all) {
    if (o.type === 'wall' || o.type === 'dimension' || o.type === 'stairs') {
      const w = o as WallObject;
      const s = mv(w.start);
      const e = mv(w.end);
      if (s === w.start && e === w.end) continue;
      plan.updates.push({ id: o.id, after: { start: s, end: e } as Partial<WallObject> });
      if (o.type === 'dimension') {
        (plan.updates[plan.updates.length - 1].after as Partial<DimensionObject>).measuredLength = dist(s, e);
      }
      if (o.type === 'wall' && !(s !== w.start && e !== w.end)) {
        // طرف واحد تحرك: الفتحات تحتفظ بموضعها الفعلي على الجدار الجديد
        const nw = { start: s, end: e };
        for (const h of all) {
          if ((h.type === 'door' || h.type === 'window') && (h as DoorObject).wallId === w.id) {
            const c = lerp(w.start, w.end, (h as DoorObject).position);
            const pos = paramOn(nw, c);
            if (pos <= 0 || pos >= 1) plan.deletes.push(h.id);
            else plan.updates.push({ id: h.id, after: { position: r6(pos) } as Partial<DoorObject> });
          }
        }
      }
    } else if (o.type === 'line' || o.type === 'route') {
      const pts = (o as LineObject).points;
      const np = pts.map(mv);
      if (np.some((p, i) => p !== pts[i])) plan.updates.push({ id: o.id, after: { points: np } as Partial<LineObject> });
    } else if ('x' in o && 'y' in o) {
      const q = o as unknown as Point;
      if (inBox(q, box)) plan.updates.push({ id: o.id, after: { x: r6(q.x + delta.x), y: r6(q.y + delta.y) } as Partial<ProjectObject> });
    }
  }
  if (plan.updates.length === 0) return 'لا توجد رؤوس داخل النافذة';
  return plan;
}

/**
 * أبعاد متسلسلة لجدار: أطراف الجدار وحواف كل فتحة، على وجه الجدار في جهة side (1 أو -1)،
 * مع بُعد كلي أبعد قليلاً. gap = المسافة بين الوجه وخط الأبعاد (وحدة عالم).
 */
export function chainDimensions(all: ProjectObject[], wall: WallObject, side: 1 | -1, gap: number, layerId: string): DimensionObject[] {
  const L = dist(wall.start, wall.end);
  if (L < 1e-6) return [];
  const ts = [0, 1];
  for (const o of all) {
    if ((o.type === 'door' || o.type === 'window') && (o as DoorObject).wallId === wall.id) {
      const op = o as DoorObject | WindowObject;
      const half = op.width / 2 / L;
      ts.push(Math.max(0, op.position - half), Math.min(1, op.position + half));
    }
  }
  const uniq = [...new Set(ts.map((t) => Math.round(t * 1e6) / 1e6))].sort((a, b) => a - b);
  const d = sub(wall.end, wall.start);
  const n = { x: (-d.y / L) * side, y: (d.x / L) * side };
  const face = (t: number): Point => {
    const p = lerp(wall.start, wall.end, t);
    return rp({ x: p.x + n.x * (wall.thickness / 2), y: p.y + n.y * (wall.thickness / 2) });
  };
  // إزاحة البعد في الرسم تكون على الناظم (-dy, dx) لاتجاه start→end؛ نعكس الإشارة للجهة الأخرى
  const sign = side;
  const out: DimensionObject[] = [];
  const mk = (t0: number, t1: number, off: number): DimensionObject => {
    const s = face(t0);
    const e = face(t1);
    return { id: newId('dim'), type: 'dimension', layerId, start: s, end: e, measuredLength: dist(s, e), offset: r6(off * sign) };
  };
  if (uniq.length > 2) for (let i = 0; i < uniq.length - 1; i++) if (uniq[i + 1] - uniq[i] > 1e-6) out.push(mk(uniq[i], uniq[i + 1], gap));
  out.push(mk(0, 1, uniq.length > 2 ? gap * 2 : gap));
  return out;
}
