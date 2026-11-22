/**
 * @file plumbing.ts
 * @description حسابات المياه والصرف الاسترشادية (دالة صرفة):
 *  - وحدات التجهيزات للتغذية (WSFU) والصرف (DFU) لكل أداة صحية
 * *  - التدفق التصميمي من منحنى هنتر التقريبي، وقطر ماسورة التغذية الرئيسية (PPR) بسرعة ≤ 2.5 م/ث
 *  - قطر مجمع الصرف حسب مجموع DFU (ميل 2%)، وأدنى 110 مم عند وجود مرحاض
 *  - ميول خطوط الصرف المرسومة: 2% للأقطار حتى 75 مم و1% لما فوقها، وفرق المنسوب المطلوب
 */
import type { ProjectObject, SymbolObject, RouteObject } from './types.ts';

interface FixtureSpec {
  wsfu: number;
  dfu: number;
  branch: string;
  trap: string;
  wc?: boolean;
}
const FIXTURES: Record<string, FixtureSpec> = {
  furn_toilet_wc: { wsfu: 2.5, dfu: 4, branch: '20 مم', trap: '110 مم', wc: true },
  plumb_wc: { wsfu: 2.5, dfu: 4, branch: '20 مم', trap: '110 مم', wc: true },
  furn_washbasin: { wsfu: 1, dfu: 1, branch: '20 مم', trap: '40 مم' },
  plumb_sink: { wsfu: 1.5, dfu: 2, branch: '20 مم', trap: '50 مم' },
  furn_shower: { wsfu: 2, dfu: 2, branch: '20 مم', trap: '50 مم' },
  plumb_shower: { wsfu: 2, dfu: 2, branch: '20 مم', trap: '50 مم' },
  furn_bathtub: { wsfu: 4, dfu: 2, branch: '25 مم', trap: '50 مم' },
  furn_washing_machine: { wsfu: 4, dfu: 3, branch: '20 مم', trap: '50 مم' },
  furn_dishwasher: { wsfu: 1.4, dfu: 2, branch: '20 مم', trap: '50 مم' },
  plumb_floor_drain: { wsfu: 0, dfu: 2, branch: '—', trap: '75 مم' },
};

/** منحنى هنتر التقريبي (أنظمة الخزانات): وحدات ← جالون/دقيقة */
const HUNTER: [number, number][] = [
  [0, 0], [1, 3], [3, 6.5], [5, 8], [10, 14], [20, 21], [30, 27], [40, 32], [50, 35], [60, 38], [80, 43.5], [100, 48], [140, 55], [200, 65], [300, 85], [500, 125],
];
export function hunterLps(wsfu: number): number {
  if (wsfu <= 0) return 0;
  for (let i = 1; i < HUNTER.length; i++) {
    const [u1, g1] = HUNTER[i];
    const [u0, g0] = HUNTER[i - 1];
    if (wsfu <= u1) return (g0 + ((g1 - g0) * (wsfu - u0)) / (u1 - u0)) * 0.0631;
  }
  return HUNTER[HUNTER.length - 1][1] * 0.0631;
}

/** مواسير PPR (PN20): القطر الخارجي ← الداخلي (مم) */
const PPR: [number, number][] = [[20, 13.2], [25, 16.6], [32, 21.2], [40, 26.6], [50, 33.4], [63, 42], [75, 50]];
export function supplyPipeFor(lps: number, vMax = 2.5): string {
  if (lps <= 0) return '—';
  for (const [od, id] of PPR) {
    const area = Math.PI * (id / 2000) ** 2;
    if (lps / 1000 / area <= vMax) return `${od} مم`;
  }
  return `أكبر من ${PPR[PPR.length - 1][0]} مم`;
}

/** مجمع الصرف الأفقي بميل 2% (وحدات DFU القصوى لكل قطر) */
const DRAIN: [number, number][] = [[50, 21], [75, 42], [110, 216], [125, 480], [160, 840], [200, 1920]];
export function drainMainFor(dfu: number, hasWc: boolean): string {
  if (dfu <= 0) return '—';
  const min = hasWc ? 110 : 0;
  const d = DRAIN.find(([mm, cap]) => mm >= min && cap >= dfu);
  return d ? `${d[0]} مم` : 'أكبر من 200 مم';
}

export interface FixtureRow {
  kind: string;
  count: number;
  wsfu: number;
  dfu: number;
  branchSupply: string;
  trapDrain: string;
}
export interface DrainRow {
  id: string;
  label?: string;
  diameter: number;
  lengthM: number;
  slopePct: number;
  dropCm: number;
  undersized: boolean;
}
export interface PlumbingReport {
  fixtures: FixtureRow[];
  drains: DrainRow[];
  totals: { wsfu: number; dfu: number; flowLps: number; supplyMain: string; drainMain: string };
}

export function computePlumbing(objects: ProjectObject[], ppm: number): PlumbingReport {
  const counts = new Map<string, number>();
  const symById = new Map<string, SymbolObject>();
  for (const o of objects) {
    if (o.type !== 'symbol') continue;
    const s = o as SymbolObject;
    symById.set(s.id, s);
    if (FIXTURES[s.symbolKind]) counts.set(s.symbolKind, (counts.get(s.symbolKind) || 0) + 1);
  }
  const fixtures: FixtureRow[] = [...counts.entries()].map(([kind, count]) => ({
    kind,
    count,
    wsfu: FIXTURES[kind].wsfu,
    dfu: FIXTURES[kind].dfu,
    branchSupply: FIXTURES[kind].branch,
    trapDrain: FIXTURES[kind].trap,
  }));
  const wsfu = fixtures.reduce((a, f) => a + f.wsfu * f.count, 0);
  const dfu = fixtures.reduce((a, f) => a + f.dfu * f.count, 0);
  const hasWc = fixtures.some((f) => FIXTURES[f.kind].wc);
  const flow = hunterLps(wsfu);

  const drains: DrainRow[] = [];
  for (const o of objects) {
    if (o.type !== 'route' || (o as RouteObject).routeKind !== 'drainage') continue;
    const r = o as RouteObject;
    let px = 0;
    for (let i = 0; i < r.points.length - 1; i++) px += Math.hypot(r.points[i + 1].x - r.points[i].x, r.points[i + 1].y - r.points[i].y);
    const diameter = r.diameter || 110;
    const slope = diameter <= 75 ? 2 : 1;
    const lengthM = px / ppm;
    const servesWc = [r.startSymbolId, r.endSymbolId].some((id) => id && FIXTURES[symById.get(id)?.symbolKind || '']?.wc);
    drains.push({ id: r.id, label: r.label, diameter, lengthM: Math.round(lengthM * 100) / 100, slopePct: slope, dropCm: Math.round(lengthM * slope * 10) / 10, undersized: servesWc && diameter < 100 });
  }
  return {
    fixtures,
    drains,
    totals: { wsfu: Math.round(wsfu * 10) / 10, dfu, flowLps: Math.round(flow * 100) / 100, supplyMain: supplyPipeFor(flow), drainMain: drainMainFor(dfu, hasWc) },
  };
}
