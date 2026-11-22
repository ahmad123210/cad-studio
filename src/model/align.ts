/**
 * @file align.ts
 * @description محاذاة وتوزيع العناصر المحددة (بنمط برامج التصميم):
 * - محاذاة: يسار/يمين/أعلى/أسفل/وسط أفقي/وسط رأسي — بالنسبة لصندوق إحاطة التحديد كاملاً
 * - توزيع: مسافات متساوية بين مراكز العناصر أفقياً أو رأسياً (يبقى الطرفان في مكانهما)
 * الأبواب والنوافذ تتبع جدرانها تلقائياً، والرموز الملتصقة بجدار متحرك تتحرك معه.
 * دالة صرفة تُرجع خطة تعديل يطبقها ProjectModel.applyEdits كخطوة تراجع واحدة.
 */

import type { Point, ProjectObject, WallObject, DimensionObject, SymbolObject, RouteObject, LineObject } from './types.ts';
import type { EditPlan } from './trimExtend.ts';
import { transformUpdates, translateSpec } from './transforms.ts';

export type AlignMode = 'left' | 'right' | 'top' | 'bottom' | 'centerX' | 'centerY' | 'distributeH' | 'distributeV';

export const ALIGN_LABELS: Record<AlignMode, string> = {
  left: 'محاذاة لليسار',
  right: 'محاذاة لليمين',
  top: 'محاذاة للأعلى',
  bottom: 'محاذاة للأسفل',
  centerX: 'توسيط أفقي',
  centerY: 'توسيط رأسي',
  distributeH: 'توزيع أفقي متساوٍ',
  distributeV: 'توزيع رأسي متساوٍ',
};

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const r6 = (v: number) => Math.round(v * 1e6) / 1e6;

/** صندوق إحاطة عنصر واحد (الجدار يشمل نصف سماكته) */
export function objectBounds(o: ProjectObject): Box | null {
  const b: Box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  const inc = (p: Point, pad = 0) => {
    b.minX = Math.min(b.minX, p.x - pad);
    b.minY = Math.min(b.minY, p.y - pad);
    b.maxX = Math.max(b.maxX, p.x + pad);
    b.maxY = Math.max(b.maxY, p.y + pad);
  };
  if (o.type === 'wall') {
    const w = o as WallObject;
    const pad = (w.thickness || 0) / 2;
    inc(w.start, pad);
    inc(w.end, pad);
  } else if (o.type === 'stairs') {
    const st = o as unknown as { start: Point; end: Point; width: number };
    inc(st.start, st.width / 2);
    inc(st.end, st.width / 2);
  } else if (o.type === 'column') {
    const c = o as unknown as { x: number; y: number; width: number; depth: number };
    inc({ x: c.x, y: c.y }, Math.max(c.width, c.depth) / 2);
  } else if (o.type === 'dimension') {
    inc((o as DimensionObject).start);
    inc((o as DimensionObject).end);
  } else if (o.type === 'symbol' || o.type === 'text' || o.type === 'room') {
    inc({ x: (o as SymbolObject).x, y: (o as SymbolObject).y });
  } else if (o.type === 'route' || o.type === 'line') {
    (o as RouteObject | LineObject).points.forEach((p) => inc(p));
  } else {
    return null;
  }
  return isFinite(b.minX) ? b : null;
}

/**
 * خطة المحاذاة/التوزيع. ids = العناصر المحددة. يعيد الخطة أو رسالة خطأ.
 */
export function planAlign(all: ProjectObject[], ids: string[], mode: AlignMode): EditPlan | string {
  const set = new Set(ids);
  // الأبواب والنوافذ ليست وحدات مستقلة: موضعها نسبي على جدارها
  const units = all
    .filter((o) => set.has(o.id) && o.type !== 'door' && o.type !== 'window')
    .map((o) => ({ obj: o, box: objectBounds(o) }))
    .filter((u): u is { obj: ProjectObject; box: Box } => u.box !== null);

  const distribute = mode === 'distributeH' || mode === 'distributeV';
  if (units.length < (distribute ? 3 : 2)) {
    return distribute ? 'التوزيع يتطلب تحديد 3 عناصر على الأقل' : 'المحاذاة تتطلب تحديد عنصرين على الأقل';
  }

  const all4: Box = {
    minX: Math.min(...units.map((u) => u.box.minX)),
    minY: Math.min(...units.map((u) => u.box.minY)),
    maxX: Math.max(...units.map((u) => u.box.maxX)),
    maxY: Math.max(...units.map((u) => u.box.maxY)),
  };
  const cx = (b: Box) => (b.minX + b.maxX) / 2;
  const cy = (b: Box) => (b.minY + b.maxY) / 2;

  const moves = new Map<string, { dx: number; dy: number }>();
  if (distribute) {
    const horiz = mode === 'distributeH';
    const key = horiz ? cx : cy;
    const sorted = [...units].sort((a, b) => key(a.box) - key(b.box));
    const first = key(sorted[0].box);
    const step = (key(sorted[sorted.length - 1].box) - first) / (sorted.length - 1);
    sorted.forEach((u, i) => {
      const d = first + step * i - key(u.box);
      moves.set(u.obj.id, horiz ? { dx: d, dy: 0 } : { dx: 0, dy: d });
    });
  } else {
    for (const u of units) {
      let dx = 0;
      let dy = 0;
      if (mode === 'left') dx = all4.minX - u.box.minX;
      else if (mode === 'right') dx = all4.maxX - u.box.maxX;
      else if (mode === 'centerX') dx = cx(all4) - cx(u.box);
      else if (mode === 'top') dy = all4.minY - u.box.minY;
      else if (mode === 'bottom') dy = all4.maxY - u.box.maxY;
      else if (mode === 'centerY') dy = cy(all4) - cy(u.box);
      moves.set(u.obj.id, { dx, dy });
    }
  }

  // الرموز الملتصقة بجدار متحرك (وغير محددة بنفسها) تتحرك بنفس مقدار جدارها
  for (const o of all) {
    if (o.type !== 'symbol' || moves.has(o.id)) continue;
    const host = (o as SymbolObject).wallId;
    const m = host ? moves.get(host) : undefined;
    if (m) moves.set(o.id, m);
  }

  const plan: EditPlan = { updates: [], adds: [], deletes: [] };
  const byId = new Map(all.map((o) => [o.id, o]));
  for (const [id, m] of moves) {
    if (Math.abs(m.dx) < 1e-9 && Math.abs(m.dy) < 1e-9) continue;
    const obj = byId.get(id)!;
    const spec = translateSpec(r6(m.dx), r6(m.dy));
    const upd = transformUpdates(obj, spec, new Set());
    if (upd) plan.updates.push({ id, after: upd });
  }
  if (plan.updates.length === 0) return 'العناصر محاذاة بالفعل';
  return plan;
}
