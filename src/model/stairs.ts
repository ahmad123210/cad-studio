/**
 * @file stairs.ts
 * @description حسابات الدرج (دالة صرفة): عدد النائمات من الطول وعمقها، والقوائم والارتفاع الكلي،
 * ومضلع الدرج وخطوط الدرجات للرسم.
 */
import type { Point, StairObject } from './types.ts';

export const DEFAULT_TREAD = 0.28;
export const DEFAULT_RISER = 0.17;

export interface StairsGeometry {
  lengthM: number;
  /** عدد النائمات (الدرجات المرسومة) */
  treads: number;
  /** عدد القوائم = النائمات + 1 */
  risers: number;
  /** الارتفاع الكلي التقريبي (م) */
  riseM: number;
  /** عمق النائمة الفعلي بعد التوزيع المتساوي على الطول (م) */
  actualTreadM: number;
  outline: Point[];
  /** خطوط الدرجات العرضية (بدون الحافتين الأولى والأخيرة) */
  steps: [Point, Point][];
  /** اتجاه الصعود (وحدة) والعمودي عليه */
  dir: Point;
  normal: Point;
}

export function stairsGeometry(st: StairObject, ppm: number): StairsGeometry {
  const dx = st.end.x - st.start.x;
  const dy = st.end.y - st.start.y;
  const L = Math.hypot(dx, dy);
  const dir = L > 0 ? { x: dx / L, y: dy / L } : { x: 1, y: 0 };
  const normal = { x: -dir.y, y: dir.x };
  const hw = st.width / 2;
  const lengthM = L / (ppm || 50);
  const tread = st.tread && st.tread > 0 ? st.tread : DEFAULT_TREAD;
  const riser = st.riser && st.riser > 0 ? st.riser : DEFAULT_RISER;
  const treads = Math.max(1, Math.round(lengthM / tread));
  const at = (t: number, side: number): Point => ({
    x: st.start.x + dir.x * t + normal.x * hw * side,
    y: st.start.y + dir.y * t + normal.y * hw * side,
  });
  const outline = [at(0, -1), at(L, -1), at(L, 1), at(0, 1)];
  const steps: [Point, Point][] = [];
  for (let i = 1; i < treads; i++) {
    const t = (L * i) / treads;
    steps.push([at(t, -1), at(t, 1)]);
  }
  return {
    lengthM,
    treads,
    risers: treads + 1,
    riseM: Math.round((treads + 1) * riser * 100) / 100,
    actualTreadM: lengthM / treads,
    outline,
    steps,
    dir,
    normal,
  };
}
