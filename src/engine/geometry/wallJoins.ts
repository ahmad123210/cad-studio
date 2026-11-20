/**
 * @file wallJoins.ts
 * @description وصل الجدران عند الزوايا (Wall Joins / Miter).
 * عندما يلتقي جداران بالضبط عند نقطة نهاية مشتركة، تُحسب زوايا القطع المائل (Miter)
 * فيظهر الركن نظيفاً بدلاً من تراكب نهايتين مربعتين (يظهر الفرق في الزوايا غير القائمة).
 * التقاطعات على شكل T أو التقاء 3 جدران فأكثر تبقى بالنهايات المربعة كما كانت.
 */

import type { Point, WallObject } from '../../model/types.ts';

const KEY_PRECISION = 100; // تطابق النهايات حتى 0.01 وحدة عالم

function keyOf(p: Point): string {
  return `${Math.round(p.x * KEY_PRECISION)}:${Math.round(p.y * KEY_PRECISION)}`;
}

/** فهرس: نقطة نهاية ← الجدران التي تنتهي عندها */
export function buildEndpointIndex(walls: WallObject[]): Map<string, WallObject[]> {
  const idx = new Map<string, WallObject[]>();
  for (const w of walls) {
    for (const p of [w.start, w.end]) {
      const k = keyOf(p);
      const list = idx.get(k);
      if (list) list.push(w);
      else idx.set(k, [w]);
    }
  }
  return idx;
}

function intersectLines(p: Point, d: Point, q: Point, e: Point): Point | null {
  const den = d.x * e.y - d.y * e.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((q.x - p.x) * e.y - (q.y - p.y) * e.x) / den;
  return { x: p.x + t * d.x, y: p.y + t * d.y };
}

function unit(a: Point, b: Point): Point | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l = Math.hypot(dx, dy);
  return l > 1e-9 ? { x: dx / l, y: dy / l } : null;
}

/**
 * زاويتا القطع عند نقطة التقاء P لجدار اتجاهه d1 (مبتعداً عن P) ونصف سماكته h1
 * مع جدار آخر اتجاهه d2 ونصف سماكته h2.
 * left: ركن جهة يسار d1، right: ركن جهة يمين d1.
 */
function miterAt(P: Point, d1: Point, h1: number, d2: Point, h2: number): { left: Point; right: Point } | null {
  const cross = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(cross) < 1e-3) return null; // متوازيان أو متعاكسان: لا حاجة لقطع
  const n1 = { x: -d1.y, y: d1.x };
  const n2 = { x: -d2.y, y: d2.x };
  const left = intersectLines({ x: P.x + n1.x * h1, y: P.y + n1.y * h1 }, d1, { x: P.x - n2.x * h2, y: P.y - n2.y * h2 }, d2);
  const right = intersectLines({ x: P.x - n1.x * h1, y: P.y - n1.y * h1 }, d1, { x: P.x + n2.x * h2, y: P.y + n2.y * h2 }, d2);
  if (!left || !right) return null;
  // حد القطع المائل في الزوايا الحادة جداً (كما في miterLimit) لتجنب رؤوس طويلة
  const limit = 4 * Math.max(h1, h2);
  if (Math.hypot(left.x - P.x, left.y - P.y) > limit || Math.hypot(right.x - P.x, right.y - P.y) > limit) return null;
  return { left, right };
}

/**
 * مضلع الجدار بإحداثيات العالم إذا كان أحد طرفيه موصولاً بجدار آخر، وإلا null
 * (فيُرسم الجدار بالطريقة الأصلية: خط سميك بنهايات مربعة).
 */
export function computeWallPolygon(wall: WallObject, index: Map<string, WallObject[]>): Point[] | null {
  const u = unit(wall.start, wall.end);
  if (!u) return null;
  const h = (wall.thickness || 20) / 2;
  const n = { x: -u.y, y: u.x };

  const otherAt = (P: Point): WallObject | null => {
    const list = index.get(keyOf(P));
    if (!list || list.length !== 2) return null;
    return list[0].id === wall.id ? list[1] : list[0];
  };
  const awayDir = (w: WallObject, P: Point): Point | null => {
    const sameStart = keyOf(w.start) === keyOf(P);
    return sameStart ? unit(w.start, w.end) : unit(w.end, w.start);
  };

  // الأركان الافتراضية مع امتداد بنصف السماكة (مكافئ النهاية المربعة lineCap: square)
  let sLeft = { x: wall.start.x - u.x * h + n.x * h, y: wall.start.y - u.y * h + n.y * h };
  let sRight = { x: wall.start.x - u.x * h - n.x * h, y: wall.start.y - u.y * h - n.y * h };
  let eLeft = { x: wall.end.x + u.x * h + n.x * h, y: wall.end.y + u.y * h + n.y * h };
  let eRight = { x: wall.end.x + u.x * h - n.x * h, y: wall.end.y + u.y * h - n.y * h };
  let joined = false;

  const oS = otherAt(wall.start);
  if (oS) {
    const d2 = awayDir(oS, wall.start);
    const m = d2 ? miterAt(wall.start, u, h, d2, (oS.thickness || 20) / 2) : null;
    if (m) {
      sLeft = m.left; // يسار u = جهة +n
      sRight = m.right;
      joined = true;
    }
  }
  const oE = otherAt(wall.end);
  if (oE) {
    const back = { x: -u.x, y: -u.y }; // الاتجاه مبتعداً عن النهاية؛ يساره = جهة -n
    const d2 = awayDir(oE, wall.end);
    const m = d2 ? miterAt(wall.end, back, h, d2, (oE.thickness || 20) / 2) : null;
    if (m) {
      eRight = m.left;
      eLeft = m.right;
      joined = true;
    }
  }
  if (!joined) return null;
  return [sLeft, eLeft, eRight, sRight];
}

/**
 * مخطط الجدار دائماً (مضلع): بقطع مائل عند الوصلات، وبامتداد نصف السماكة عند النهايات الحرة
 * (مطابق بصرياً لـ lineCap: square). يُستخدم في الرسم المجمّع للمخططات الضخمة.
 */
export function wallOutline(wall: WallObject, index: Map<string, WallObject[]>): Point[] | null {
  const joined = computeWallPolygon(wall, index);
  if (joined) return joined;
  const u = unit(wall.start, wall.end);
  if (!u) return null;
  const h = (wall.thickness || 20) / 2;
  const n = { x: -u.y, y: u.x };
  return [
    { x: wall.start.x - u.x * h + n.x * h, y: wall.start.y - u.y * h + n.y * h },
    { x: wall.end.x + u.x * h + n.x * h, y: wall.end.y + u.y * h + n.y * h },
    { x: wall.end.x + u.x * h - n.x * h, y: wall.end.y + u.y * h - n.y * h },
    { x: wall.start.x - u.x * h - n.x * h, y: wall.start.y - u.y * h - n.y * h },
  ];
}
