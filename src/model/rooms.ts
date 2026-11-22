/**
 * @file rooms.ts
 * @description كشف الغرف المغلقة من الجدران (دالة صرفة بلا واجهة).
 *
 * الخطوات:
 *  1. محاور الجدران (عدا الأسوار) تُقسَّم عند التقاطعات ونقاط الالتقاء على شكل T،
 *     وتُدمج الأطراف المتقاربة (ضمن نصف سماكة الجدار تقريباً) في عقدة واحدة.
 *  2. تُحذف الأطراف السائبة (جدار لا يغلق شيئاً) ثم تُتتبع وجوه الرسم المستوي (planar faces).
 *  3. الوجه ذو المساحة الموجبة = غرفة مغلقة، والسالب = الحد الخارجي لمجموعة جدران.
 *  4. المضلع الصافي للغرفة = إزاحة كل ضلع للداخل بنصف سماكة جداره (المساحة الداخلية الفعلية).
 *     وللحد الخارجي تُزاح الأضلاع للخارج فنحصل على محيط الواجهات الخارجية.
 *
 * كل الأطوال هنا بوحدة العالم (بكسل)؛ التحويل للمتر في محرك الكميات.
 */

import type { Point, WallObject } from './types.ts';

export interface FaceEdge {
  wallId: string;
  /** المدى على طول الجدار (0..1) الذي يغطيه هذا الضلع */
  t0: number;
  t1: number;
  /** طول الضلع الصافي (بعد الإزاحة بنصف السماكة) */
  netLength: number;
}

export interface RoomFace {
  /** مضلع محاور الجدران */
  polygon: Point[];
  /** المضلع الصافي (الوجه الداخلي للجدران، أو الوجه الخارجي للحدود الخارجية) */
  net: Point[];
  edges: FaceEdge[];
  /** المساحة الصافية (موجبة دائماً) بوحدة العالم² بعد طرح الجزر الداخلية */
  netArea: number;
  netPerimeter: number;
  /** true = غرفة مغلقة، false = حد خارجي لمجموعة جدران */
  bounded: boolean;
}

export interface RoomGraph {
  rooms: RoomFace[];
  /** الحدود الخارجية (واجهات المبنى) */
  exteriors: RoomFace[];
}

const EPS = 1e-9;

const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x;
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export function polygonArea(pts: Point[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

export function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function polygonCentroid(pts: Point[]): Point {
  const a = polygonArea(pts);
  if (Math.abs(a) < EPS) {
    const n = pts.length || 1;
    return { x: pts.reduce((s, p) => s + p.x, 0) / n, y: pts.reduce((s, p) => s + p.y, 0) / n };
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    const f = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * f;
    cy += (p.y + q.y) * f;
  }
  return { x: cx / (6 * a), y: cy / (6 * a) };
}

interface GEdge {
  a: number;
  b: number;
  wallId: string;
  t0: number;
  t1: number;
  half: number;
}

/** الجدران الداخلة في كشف الغرف: كل الجدران عدا الأسوار */
export const isRoomWall = (w: WallObject) => w.wallKind !== 'fence';

export function buildRoomGraph(allWalls: WallObject[]): RoomGraph {
  const walls = allWalls.filter((w) => isRoomWall(w) && dist(w.start, w.end) > EPS);
  if (walls.length < 3) return { rooms: [], exteriors: [] };

  const tolOf = (w: WallObject) => Math.max(1, (w.thickness || 20) * 0.6);
  const params: number[][] = walls.map(() => [0, 1]);

  // 1) نقاط التقسيم: تقاطعات حقيقية + أطراف تلامس منتصف جدار آخر (T)
  const boxes = walls.map((w) => {
    const t = tolOf(w);
    return {
      minX: Math.min(w.start.x, w.end.x) - t,
      maxX: Math.max(w.start.x, w.end.x) + t,
      minY: Math.min(w.start.y, w.end.y) - t,
      maxY: Math.max(w.start.y, w.end.y) + t,
    };
  });
  const order = walls.map((_, i) => i).sort((i, j) => boxes[i].minX - boxes[j].minX);
  const projectOn = (p: Point, w: WallObject) => {
    const d = sub(w.end, w.start);
    const L2 = d.x * d.x + d.y * d.y;
    const t = ((p.x - w.start.x) * d.x + (p.y - w.start.y) * d.y) / L2;
    const q = { x: w.start.x + d.x * t, y: w.start.y + d.y * t };
    return { t, d: dist(p, q) };
  };
  for (let oi = 0; oi < order.length; oi++) {
    const i = order[oi];
    const A = walls[i];
    const bi = boxes[i];
    for (let oj = oi + 1; oj < order.length; oj++) {
      const j = order[oj];
      const bj = boxes[j];
      if (bj.minX > bi.maxX) break;
      if (bj.maxY < bi.minY || bj.minY > bi.maxY) continue;
      const B = walls[j];
      const r = sub(A.end, A.start);
      const s = sub(B.end, B.start);
      const den = cross(r, s);
      if (Math.abs(den) > EPS) {
        const qp = sub(B.start, A.start);
        const t = cross(qp, s) / den;
        const u = cross(qp, r) / den;
        if (t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6) {
          params[i].push(t);
          params[j].push(u);
          continue;
        }
      }
      const tol = Math.max(tolOf(A), tolOf(B));
      for (const p of [B.start, B.end]) {
        const pr = projectOn(p, A);
        if (pr.d < tol && pr.t > 1e-6 && pr.t < 1 - 1e-6) params[i].push(pr.t);
      }
      for (const p of [A.start, A.end]) {
        const pr = projectOn(p, B);
        if (pr.d < tol && pr.t > 1e-6 && pr.t < 1 - 1e-6) params[j].push(pr.t);
      }
    }
  }

  // 2) العقد: دمج النقاط المتقاربة (شبكة تجزئة)
  const nodes: Point[] = [];
  const cell = Math.max(...walls.map(tolOf)) * 2;
  const grid = new Map<string, number[]>();
  const key = (cx: number, cy: number) => `${cx},${cy}`;
  const nodeAt = (p: Point, tol: number): number => {
    const cx = Math.floor(p.x / cell);
    const cy = Math.floor(p.y / cell);
    let best = -1;
    let bestD = tol;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const n of grid.get(key(cx + dx, cy + dy)) || []) {
          const d = dist(nodes[n], p);
          if (d <= bestD) {
            bestD = d;
            best = n;
          }
        }
      }
    }
    if (best >= 0) return best;
    nodes.push({ ...p });
    const k = key(cx, cy);
    if (!grid.has(k)) grid.set(k, []);
    grid.get(k)!.push(nodes.length - 1);
    return nodes.length - 1;
  };

  const edges: GEdge[] = [];
  const seenPair = new Set<string>();
  walls.forEach((w, i) => {
    const ts = [...new Set(params[i].map((t) => Math.round(t * 1e9) / 1e9))].sort((a, b) => a - b);
    const d = sub(w.end, w.start);
    const ids = ts.map((t) => nodeAt({ x: w.start.x + d.x * t, y: w.start.y + d.y * t }, tolOf(w)));
    for (let k = 0; k < ts.length - 1; k++) {
      const a = ids[k];
      const b = ids[k + 1];
      if (a === b) continue;
      const pk = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (seenPair.has(pk)) continue; // جداران متطابقان: نكتفي بالأول
      seenPair.add(pk);
      edges.push({ a, b, wallId: w.id, t0: ts[k], t1: ts[k + 1], half: (w.thickness || 20) / 2 });
    }
  });

  // 3) حذف الأطراف السائبة تكرارياً
  const alive = edges.map(() => true);
  const deg = new Array(nodes.length).fill(0);
  edges.forEach((e) => {
    deg[e.a]++;
    deg[e.b]++;
  });
  let changed = true;
  while (changed) {
    changed = false;
    edges.forEach((e, i) => {
      if (alive[i] && (deg[e.a] < 2 || deg[e.b] < 2)) {
        alive[i] = false;
        deg[e.a]--;
        deg[e.b]--;
        changed = true;
      }
    });
  }

  // 4) أنصاف الأضلاع وترتيبها زاوياً حول كل عقدة
  interface Half {
    from: number;
    to: number;
    edge: number;
    angle: number;
    used: boolean;
  }
  const halves: Half[] = [];
  const out: number[][] = nodes.map(() => []);
  edges.forEach((e, i) => {
    if (!alive[i]) return;
    for (const [f, t] of [
      [e.a, e.b],
      [e.b, e.a],
    ]) {
      const h: Half = { from: f, to: t, edge: i, angle: Math.atan2(nodes[t].y - nodes[f].y, nodes[t].x - nodes[f].x), used: false };
      out[f].push(halves.length);
      halves.push(h);
    }
  });
  out.forEach((list) => list.sort((x, y) => halves[x].angle - halves[y].angle));
  const twinIndex = (h: Half) => out[h.to].findIndex((k) => halves[k].to === h.from && halves[k].edge === h.edge);

  const faces: { hs: number[]; area: number; poly: Point[] }[] = [];
  for (let start = 0; start < halves.length; start++) {
    if (halves[start].used) continue;
    const hs: number[] = [];
    let cur = start;
    let guard = 0;
    while (!halves[cur].used && guard++ < halves.length + 2) {
      halves[cur].used = true;
      hs.push(cur);
      const h = halves[cur];
      const list = out[h.to];
      const ti = twinIndex(h);
      cur = list[(ti - 1 + list.length) % list.length];
    }
    const poly = hs.map((k) => nodes[halves[k].from]);
    faces.push({ hs, area: polygonArea(poly), poly });
  }

  // 5) المضلع الصافي: إزاحة كل ضلع لليسار (جهة الوجه) بنصف السماكة
  const build = (f: { hs: number[]; area: number; poly: Point[] }, bounded: boolean): RoomFace => {
    const n = f.hs.length;
    const lines = f.hs.map((k) => {
      const h = halves[k];
      const e = edges[h.edge];
      const p = nodes[h.from];
      const q = nodes[h.to];
      const L = dist(p, q) || 1;
      const nx = -(q.y - p.y) / L;
      const ny = (q.x - p.x) / L;
      return { p: { x: p.x + nx * e.half, y: p.y + ny * e.half }, q: { x: q.x + nx * e.half, y: q.y + ny * e.half } };
    });
    const net: Point[] = [];
    for (let i = 0; i < n; i++) {
      const L1 = lines[(i - 1 + n) % n];
      const L2 = lines[i];
      const r = sub(L1.q, L1.p);
      const s = sub(L2.q, L2.p);
      const den = cross(r, s);
      if (Math.abs(den) < 1e-9 * (Math.hypot(r.x, r.y) * Math.hypot(s.x, s.y) + 1)) {
        net.push({ ...L2.p });
      } else {
        const t = cross(sub(L2.p, L1.p), s) / den;
        net.push({ x: L1.p.x + r.x * t, y: L1.p.y + r.y * t });
      }
    }
    const fe: FaceEdge[] = f.hs.map((k, i) => {
      const e = edges[halves[k].edge];
      return { wallId: e.wallId, t0: e.t0, t1: e.t1, netLength: dist(net[i], net[(i + 1) % n]) };
    });
    return {
      polygon: f.poly,
      net,
      edges: fe,
      netArea: Math.abs(polygonArea(net)),
      netPerimeter: fe.reduce((s, e) => s + e.netLength, 0),
      bounded,
    };
  };

  const minArea = 1; // وحدة عالم²: يستبعد الوجوه المنحلّة
  const rooms = faces.filter((f) => f.area > minArea).map((f) => build(f, true));
  const exteriors = faces.filter((f) => f.area < -minArea).map((f) => build(f, false));

  // 6) الجزر: حد خارجي لمجموعة جدران تقع داخل غرفة أخرى = ثقب يُطرح من مساحتها
  for (const ex of exteriors) {
    const probe = ex.polygon[0];
    let host: RoomFace | null = null;
    for (const r of rooms) {
      if (r.polygon.some((p) => dist(p, probe) < EPS)) continue;
      if (pointInPolygon(probe, r.polygon) && (!host || Math.abs(polygonArea(r.polygon)) < Math.abs(polygonArea(host.polygon)))) host = r;
    }
    if (host) host.netArea = Math.max(0, host.netArea - ex.netArea);
  }

  return { rooms, exteriors };
}

/** أصغر غرفة تحتوي النقطة (الغرف المتداخلة: الأصغر هي المقصودة) */
export function findRoomAt(graph: RoomGraph, p: Point): RoomFace | null {
  let best: RoomFace | null = null;
  for (const r of graph.rooms) {
    if (!pointInPolygon(p, r.polygon)) continue;
    if (!best || Math.abs(polygonArea(r.polygon)) < Math.abs(polygonArea(best.polygon))) best = r;
  }
  return best;
}

/** نقطة داخل الغرفة لوضع البطاقة: المركز إن كان داخلها، وإلا نقطة داخلية قريبة */
export function roomLabelPoint(face: RoomFace): Point {
  const c = polygonCentroid(face.net.length >= 3 ? face.net : face.polygon);
  if (pointInPolygon(c, face.polygon)) return c;
  // مضلع مقعّر: نأخذ منتصف أطول قطعة أفقية داخلية عند ارتفاع المركز
  const poly = face.polygon;
  const xs: number[] = [];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > c.y !== b.y > c.y) xs.push(((b.x - a.x) * (c.y - a.y)) / (b.y - a.y) + a.x);
  }
  xs.sort((a, b) => a - b);
  let best = { x: poly[0].x, y: poly[0].y };
  let bestW = -1;
  for (let i = 0; i + 1 < xs.length; i += 2) {
    if (xs[i + 1] - xs[i] > bestW) {
      bestW = xs[i + 1] - xs[i];
      best = { x: (xs[i] + xs[i + 1]) / 2, y: c.y };
    }
  }
  return best;
}
