/**
 * @file shapes.ts
 * @description هندسة أشكال الرسم (دوال صرفة): مستطيل، دائرة، قوس من ثلاث نقاط، مضلع منتظم.
 * الأشكال تُحفظ كخطوط حرة (LineObject) متعددة الرؤوس، والدوائر والأقواس تُقرَّب بقطع قصيرة
 * (كل 5° تقريباً) فتعمل معها كل أوامر التحرير والتصدير الحالية.
 */
import type { Point } from './types.ts';

const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
const rp = (p: Point): Point => ({ x: r6(p.x), y: r6(p.y) });

export function rectPoints(a: Point, b: Point): Point[] {
  return [rp(a), rp({ x: b.x, y: a.y }), rp(b), rp({ x: a.x, y: b.y })];
}

/** عدد القطع لقوس بزاوية معينة: قطعة كل ~5° وبحد أدنى 8 */
const segmentsFor = (sweepRad: number) => Math.max(8, Math.ceil(Math.abs(sweepRad) / ((5 * Math.PI) / 180)));

export function circlePoints(c: Point, r: number): Point[] {
  const n = segmentsFor(Math.PI * 2);
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    out.push(rp({ x: c.x + r * Math.cos(t), y: c.y + r * Math.sin(t) }));
  }
  return out;
}

/** مركز الدائرة المارة بثلاث نقاط (null إن كانت على استقامة واحدة) */
export function circumcenter(a: Point, b: Point, c: Point): Point | null {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-9) return null;
  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;
  return {
    x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d,
    y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d,
  };
}

/** قوس يبدأ عند start ويمر بـ through وينتهي عند end. null إن كانت النقاط على خط واحد */
export function arcThrough(start: Point, through: Point, end: Point): Point[] | null {
  const c = circumcenter(start, through, end);
  if (!c) return null;
  const r = Math.hypot(start.x - c.x, start.y - c.y);
  const a0 = Math.atan2(start.y - c.y, start.x - c.x);
  const norm = (a: number) => {
    let v = a - a0;
    while (v < 0) v += Math.PI * 2;
    while (v >= Math.PI * 2) v -= Math.PI * 2;
    return v;
  };
  const tm = norm(Math.atan2(through.y - c.y, through.x - c.x));
  const te = norm(Math.atan2(end.y - c.y, end.x - c.x));
  // الاتجاه الذي يمر بالنقطة الوسطى
  const sweep = tm < te ? te : te - Math.PI * 2;
  const n = segmentsFor(sweep);
  const out: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const t = a0 + (sweep * i) / n;
    out.push(rp({ x: c.x + r * Math.cos(t), y: c.y + r * Math.sin(t) }));
  }
  out[0] = rp(start);
  out[out.length - 1] = rp(end);
  return out;
}

/** مضلع منتظم: المركز ورأس أول (يحدد نصف القطر والدوران) */
export function polygonPoints(c: Point, vertex: Point, sides: number): Point[] {
  const n = Math.max(3, Math.min(64, Math.round(sides)));
  const r = Math.hypot(vertex.x - c.x, vertex.y - c.y);
  const a0 = Math.atan2(vertex.y - c.y, vertex.x - c.x);
  const out: Point[] = [];
  for (let i = 0; i < n; i++) {
    const t = a0 + (i / n) * Math.PI * 2;
    out.push(rp({ x: c.x + r * Math.cos(t), y: c.y + r * Math.sin(t) }));
  }
  return out;
}
