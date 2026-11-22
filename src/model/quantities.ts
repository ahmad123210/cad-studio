/**
 * @file quantities.ts
 * @description محرك حصر الكميات (دالة صرفة، كل النتائج بالمتر/المتر المربع/العدد):
 *  - الأرضيات حسب نوعها من مساحات الغرف الصافية
 *  - اللياسة والدهان بالمتر المربع: (الطول الصافي لوجه الجدار × ارتفاعه) − مساحات الفتحات على ذلك الوجه
 *  - السور الخارجي مفصلاً لكل ضلع (طول، ارتفاع، سماكة، بوابات، صافي الوجه، لياسة ودهان الوجهين، حجم البناء)
 *  - جدول الأبواب والشبابيك برموز D1/W1 حسب المقاس
 *  - الرموز (عدد) والتمديدات (أطوال + نسبة احتياط النزول العمودي، وعدد الأكواع للمواسير)
 * لا يعتمد على الواجهة أو المحرك، ويُستخدم في نافذة الكميات وتصدير Excel وCSV.
 */

import type {
  ProjectObject,
  WallObject,
  DoorObject,
  WindowObject,
  RoomObject,
  RouteObject,
  SymbolObject,
  RouteKind,
  QuantitySettings,
} from './types.ts';
import { buildRoomGraph, findRoomAt, type RoomFace, type RoomGraph } from './rooms.ts';

export type BoqSection = 'floors' | 'finishes' | 'fence' | 'openings' | 'symbols' | 'routes';

export const BOQ_SECTION_TITLES: Record<BoqSection, string> = {
  floors: 'الأرضيات',
  finishes: 'اللياسة والدهان',
  fence: 'السور الخارجي',
  openings: 'الأبواب والشبابيك',
  symbols: 'الأدوات والتجهيزات',
  routes: 'التمديدات',
};

export type BoqUnit = 'م²' | 'م.ط' | 'م³' | 'عدد';

export interface BoqLine {
  /** معرف ثابت للبند (مفتاح سعر الوحدة المحفوظ) */
  key: string;
  section: BoqSection;
  name: string;
  unit: BoqUnit;
  qty: number;
  note?: string;
}

export interface RoomRow {
  id: string | null;
  name: string;
  floorType: string;
  area: number;
  perimeter: number;
  /** لياسة جدران الغرفة الصافية (م²) */
  wallFinish: number;
}

export interface OpeningType {
  code: string;
  kind: 'door' | 'window';
  /** بالسنتيمتر */
  widthCm: number;
  heightCm: number;
  sillCm?: number;
  count: number;
  ids: string[];
}

export interface FenceRow {
  id: string;
  label: string;
  length: number;
  height: number;
  thickness: number;
  /** مساحة البوابات/الفتحات على هذا الضلع (م²) */
  openings: number;
  /** صافي الوجه الواحد = طول × ارتفاع − فتحات */
  netFace: number;
  volume: number;
}

export interface QuantityReport {
  lines: BoqLine[];
  rooms: RoomRow[];
  openings: OpeningType[];
  /** رمز النوع لكل باب/نافذة (للعرض على المخطط) */
  openingCodeById: Record<string, string>;
  fence: FenceRow[];
  totals: {
    floorArea: number;
    roomCount: number;
    unlabeledRooms: number;
    wallLength: number;
    routeLength: number;
  };
  warnings: string[];
}

export interface QuantityOptions {
  pixelsPerMeter: number;
  settings: QuantitySettings;
  /** اسم الرمز للعرض (من سجل الرموز) */
  symbolName?: (kind: string) => string;
  /** اسم نوع المسار ومادته وقطره الافتراضيان */
  routeMeta?: (kind: RouteKind) => { name: string; defaultMaterial: string; defaultDiameter: number };
  /** مخطط غرف محسوب مسبقاً (اختياري لتوفير الوقت) */
  roomGraph?: RoomGraph;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const len = (w: WallObject) => Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y);

/** رموز الأبواب والشبابيك حسب المقاس: مرتبة بالعرض ثم الارتفاع */
export function computeOpeningTypes(objects: ProjectObject[], ppm: number, settings: QuantitySettings): OpeningType[] {
  const groups = new Map<string, OpeningType>();
  for (const o of objects) {
    if (o.type !== 'door' && o.type !== 'window') continue;
    const widthCm = Math.round(((o as DoorObject).width / ppm) * 100);
    if (o.type === 'door') {
      const d = o as DoorObject;
      const heightCm = Math.round((d.height ?? settings.doorHeight) * 100);
      const k = `door:${widthCm}x${heightCm}`;
      if (!groups.has(k)) groups.set(k, { code: '', kind: 'door', widthCm, heightCm, count: 0, ids: [] });
      const g = groups.get(k)!;
      g.count++;
      g.ids.push(d.id);
    } else {
      const w = o as WindowObject;
      const heightCm = Math.round((w.height ?? 1.2) * 100);
      const sillCm = Math.round((w.sillHeight ?? 0.9) * 100);
      const k = `window:${widthCm}x${heightCm}@${sillCm}`;
      if (!groups.has(k)) groups.set(k, { code: '', kind: 'window', widthCm, heightCm, sillCm, count: 0, ids: [] });
      const g = groups.get(k)!;
      g.count++;
      g.ids.push(w.id);
    }
  }
  const out: OpeningType[] = [];
  for (const kind of ['door', 'window'] as const) {
    const list = [...groups.values()]
      .filter((g) => g.kind === kind)
      .sort((a, b) => a.widthCm - b.widthCm || a.heightCm - b.heightCm || (a.sillCm ?? 0) - (b.sillCm ?? 0));
    list.forEach((g, i) => {
      g.code = `${kind === 'door' ? 'D' : 'W'}${i + 1}`;
      out.push(g);
    });
  }
  return out;
}

export function openingTypeKey(t: OpeningType): string {
  return t.kind === 'door' ? `door:${t.widthCm}x${t.heightCm}` : `window:${t.widthCm}x${t.heightCm}@${t.sillCm}`;
}

/** عدد الأكواع: رؤوس يتغير عندها اتجاه المسار بأكثر من 15° */
export function countElbows(points: { x: number; y: number }[]): number {
  let n = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1];
    const b = points[i];
    const c = points[i + 1];
    const v1x = b.x - a.x;
    const v1y = b.y - a.y;
    const v2x = c.x - b.x;
    const v2y = c.y - b.y;
    const l1 = Math.hypot(v1x, v1y);
    const l2 = Math.hypot(v2x, v2y);
    if (l1 < 1e-6 || l2 < 1e-6) continue;
    const cos = (v1x * v2x + v1y * v2y) / (l1 * l2);
    if (cos < Math.cos((15 * Math.PI) / 180)) n++;
  }
  return n;
}

export function computeQuantities(objects: ProjectObject[], opts: QuantityOptions): QuantityReport {
  const ppm = opts.pixelsPerMeter > 0 ? opts.pixelsPerMeter : 50;
  const s = opts.settings;
  const lines: BoqLine[] = [];
  const warnings: string[] = [];

  const walls = objects.filter((o) => o.type === 'wall') as WallObject[];
  const wallById = new Map(walls.map((w) => [w.id, w]));
  const buildingWalls = walls.filter((w) => w.wallKind !== 'fence');
  const fenceWalls = walls.filter((w) => w.wallKind === 'fence');
  const heightOf = (w: WallObject) => w.height ?? (w.wallKind === 'fence' ? s.fenceHeight : s.wallHeight);

  // الفتحات على كل جدار: الموضع النسبي والمساحة (م²)
  const openingsByWall = new Map<string, { pos: number; area: number }[]>();
  for (const o of objects) {
    if (o.type !== 'door' && o.type !== 'window') continue;
    const op = o as DoorObject | WindowObject;
    if (!wallById.has(op.wallId)) continue;
    const h = o.type === 'door' ? ((o as DoorObject).height ?? s.doorHeight) : ((o as WindowObject).height ?? 1.2);
    const area = (op.width / ppm) * h;
    if (!openingsByWall.has(op.wallId)) openingsByWall.set(op.wallId, []);
    openingsByWall.get(op.wallId)!.push({ pos: op.position, area });
  }
  const openingsOnRange = (wallId: string, t0: number, t1: number) =>
    (openingsByWall.get(wallId) || []).filter((o) => o.pos > t0 - 1e-9 && o.pos < t1 + 1e-9).reduce((a, o) => a + o.area, 0);

  /** صافي لياسة وجه (غرفة أو واجهة خارجية) */
  const faceFinish = (f: RoomFace) => {
    let a = 0;
    for (const e of f.edges) {
      const w = wallById.get(e.wallId);
      if (!w) continue;
      a += (e.netLength / ppm) * heightOf(w) - openingsOnRange(e.wallId, e.t0, e.t1);
    }
    return Math.max(0, a);
  };

  // ─── الغرف ───
  const graph = opts.roomGraph ?? buildRoomGraph(walls);
  const roomObjs = objects.filter((o) => o.type === 'room') as RoomObject[];
  const labelOf = new Map<RoomFace, RoomObject>();
  for (const r of roomObjs) {
    const f = findRoomAt(graph, { x: r.x, y: r.y });
    if (f && !labelOf.has(f)) labelOf.set(f, r);
  }
  const rooms: RoomRow[] = graph.rooms.map((f, i) => {
    const lbl = labelOf.get(f);
    return {
      id: lbl?.id ?? null,
      name: lbl?.name || `غرفة بلا بطاقة ${i + 1}`,
      floorType: lbl?.floorType?.trim() || '',
      area: r2(f.netArea / (ppm * ppm)),
      perimeter: r2(f.netPerimeter / ppm),
      wallFinish: r2(faceFinish(f)),
    };
  });
  rooms.sort((a, b) => (a.id ? 0 : 1) - (b.id ? 0 : 1));
  const unlabeled = rooms.filter((r) => !r.id).length;
  if (buildingWalls.length > 0 && graph.rooms.length === 0) {
    warnings.push('لا توجد غرف مغلقة: الأرضيات واللياسة الداخلية تحتاج جدراناً متصلة تحيط بكل غرفة.');
  } else if (unlabeled > 0) {
    warnings.push(`${unlabeled} غرفة بلا بطاقة: استخدم «كشف الغرف» لتسميتها وتحديد نوع أرضيتها.`);
  }

  // ─── الأرضيات حسب النوع ───
  const floors = new Map<string, number>();
  for (const r of rooms) floors.set(r.floorType || 'غير محدد', (floors.get(r.floorType || 'غير محدد') || 0) + r.area);
  for (const [type, area] of [...floors.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push({ key: `floor:${type}`, section: 'floors', name: type === 'غير محدد' ? 'أرضيات (نوع غير محدد)' : `أرضيات ${type}`, unit: 'م²', qty: r2(area) });
  }

  // ─── اللياسة والدهان ───
  let interiorWalls = rooms.reduce((a, r) => a + r.wallFinish, 0);
  const ceilings = rooms.reduce((a, r) => a + r.area, 0);
  const exterior = graph.exteriors.reduce((a, f) => a + faceFinish(f), 0);

  // أجزاء جدران المبنى غير الداخلة في أي غرفة (جدار قائم وحده): وجهان كاملان
  const covered = new Map<string, [number, number][]>();
  for (const f of [...graph.rooms, ...graph.exteriors]) {
    for (const e of f.edges) {
      if (!covered.has(e.wallId)) covered.set(e.wallId, []);
      covered.get(e.wallId)!.push([e.t0, e.t1]);
    }
  }
  let looseFaces = 0;
  for (const w of buildingWalls) {
    const iv = (covered.get(w.id) || []).sort((a, b) => a[0] - b[0]);
    const gaps: [number, number][] = [];
    let cur = 0;
    for (const [a, b] of iv) {
      if (a > cur + 1e-6) gaps.push([cur, a]);
      cur = Math.max(cur, b);
    }
    if (cur < 1 - 1e-6) gaps.push([cur, 1]);
    for (const [a, b] of gaps) {
      const L = ((b - a) * len(w)) / ppm;
      if (L < 0.01) continue;
      looseFaces += Math.max(0, 2 * (L * heightOf(w) - openingsOnRange(w.id, a, b)));
    }
  }
  interiorWalls += looseFaces;

  if (buildingWalls.length > 0) {
    lines.push({ key: 'plaster:interior', section: 'finishes', name: 'لياسة داخلية — جدران', unit: 'م²', qty: r2(interiorWalls), note: 'بعد خصم الأبواب والشبابيك' });
    lines.push({ key: 'plaster:ceiling', section: 'finishes', name: 'لياسة أسقف', unit: 'م²', qty: r2(ceilings) });
    lines.push({ key: 'plaster:exterior', section: 'finishes', name: 'لياسة خارجية — واجهات', unit: 'م²', qty: r2(exterior), note: 'بعد خصم الأبواب والشبابيك' });
    lines.push({ key: 'paint:interior', section: 'finishes', name: 'دهان داخلي — جدران وأسقف', unit: 'م²', qty: r2(interiorWalls + ceilings) });
    lines.push({ key: 'paint:exterior', section: 'finishes', name: 'دهان خارجي — واجهات', unit: 'م²', qty: r2(exterior) });
  }

  // ─── السور الخارجي مفصلاً ───
  const fence: FenceRow[] = fenceWalls.map((w, i) => {
    const L = len(w) / ppm;
    const H = heightOf(w);
    const T = (w.thickness || 20) / ppm;
    const op = openingsOnRange(w.id, 0, 1);
    const netFace = Math.max(0, L * H - op);
    return { id: w.id, label: w.label || `ضلع ${i + 1}`, length: r2(L), height: r2(H), thickness: r2(T), openings: r2(op), netFace: r2(netFace), volume: r3(netFace * T) };
  });
  if (fence.length) {
    const sum = (k: keyof FenceRow) => fence.reduce((a, f) => a + (f[k] as number), 0);
    lines.push({ key: 'fence:length', section: 'fence', name: 'طول السور', unit: 'م.ط', qty: r2(sum('length')) });
    lines.push({ key: 'fence:masonry', section: 'fence', name: 'بناء السور', unit: 'م³', qty: r3(sum('volume')), note: 'صافي بعد خصم البوابات' });
    lines.push({ key: 'fence:plaster', section: 'fence', name: 'لياسة السور — وجهان', unit: 'م²', qty: r2(2 * sum('netFace')) });
    lines.push({ key: 'fence:paint', section: 'fence', name: 'دهان السور — وجهان', unit: 'م²', qty: r2(2 * sum('netFace')) });
  }

  // ─── الأبواب والشبابيك ───
  const openings = computeOpeningTypes(objects, ppm, s);
  const openingCodeById: Record<string, string> = {};
  for (const t of openings) {
    t.ids.forEach((id) => (openingCodeById[id] = t.code));
    const size = `${t.widthCm}×${t.heightCm} سم`;
    lines.push({
      key: openingTypeKey(t),
      section: 'openings',
      name: `${t.kind === 'door' ? 'باب' : 'شباك'} ${t.code} (${size}${t.sillCm !== undefined ? `، جلسة ${t.sillCm} سم` : ''})`,
      unit: 'عدد',
      qty: t.count,
    });
  }

  // ─── الرموز ───
  const symCount = new Map<string, number>();
  for (const o of objects) if (o.type === 'symbol') symCount.set((o as SymbolObject).symbolKind, (symCount.get((o as SymbolObject).symbolKind) || 0) + 1);
  for (const [kind, n] of [...symCount.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push({ key: `sym:${kind}`, section: 'symbols', name: opts.symbolName?.(kind) || kind, unit: 'عدد', qty: n });
  }

  // ─── التمديدات ───
  const factor = 1 + (s.routeAllowancePct || 0) / 100;
  const groups = new Map<string, { kind: RouteKind; material: string; diameter: number; length: number; elbows: number }>();
  let routeLength = 0;
  for (const o of objects) {
    if (o.type !== 'route') continue;
    const r = o as RouteObject;
    const meta = opts.routeMeta?.(r.routeKind);
    const material = r.material || meta?.defaultMaterial || 'معياري';
    const diameter = r.diameter || meta?.defaultDiameter || 20;
    let px = 0;
    for (let i = 0; i < r.points.length - 1; i++) px += Math.hypot(r.points[i + 1].x - r.points[i].x, r.points[i + 1].y - r.points[i].y);
    const k = `${r.routeKind}|${material}|${diameter}`;
    if (!groups.has(k)) groups.set(k, { kind: r.routeKind, material, diameter, length: 0, elbows: 0 });
    const g = groups.get(k)!;
    g.length += px / ppm;
    if (r.routeKind !== 'electrical') g.elbows += countElbows(r.points);
    routeLength += px / ppm;
  }
  for (const [k, g] of groups) {
    const kindName = opts.routeMeta?.(g.kind)?.name || g.kind;
    lines.push({
      key: `route:${k}`,
      section: 'routes',
      name: `${kindName} — ${g.material} ${g.diameter} مم`,
      unit: 'م.ط',
      qty: r2(g.length * factor),
      note: s.routeAllowancePct ? `تشمل احتياط النزول العمودي ${s.routeAllowancePct}%` : undefined,
    });
    if (g.elbows > 0) {
      lines.push({ key: `elbow:${k}`, section: 'routes', name: `أكواع — ${g.material} ${g.diameter} مم`, unit: 'عدد', qty: g.elbows });
    }
  }

  return {
    lines,
    rooms,
    openings,
    openingCodeById,
    fence,
    totals: {
      floorArea: r2(rooms.reduce((a, r) => a + r.area, 0)),
      roomCount: rooms.length,
      unlabeledRooms: unlabeled,
      wallLength: r2(buildingWalls.reduce((a, w) => a + len(w), 0) / ppm),
      routeLength: r2(routeLength),
    },
    warnings,
  };
}

/** إجمالي البند = الكمية × سعر الوحدة، أو null إن لم يُدخل سعر */
export function lineTotal(line: BoqLine, prices: Record<string, number>): number | null {
  const p = prices[line.key];
  return typeof p === 'number' && Number.isFinite(p) ? Math.round(line.qty * p * 100) / 100 : null;
}
