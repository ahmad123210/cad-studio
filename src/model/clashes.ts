/**
 * @file clashes.ts
 * @description كشف التعارضات (استرشادي): مسار يعبر فتحة باب/شباك، مسار يخترق عموداً،
 * وتقاطع مسارين من نوعين مختلفين (مثل كهرباء مع مياه) للمراجعة.
 */
import type { ProjectObject, RouteObject, WallObject, DoorObject, WindowObject, ColumnObject, Point } from './types.ts';

export interface Clash {
  severity: 'error' | 'warning';
  message: string;
  ids: string[];
}

const KIND_NAMES: Record<string, string> = { electrical: 'كهرباء', water: 'مياه', drainage: 'صرف', hvac: 'تكييف', fire: 'حريق' };

function segIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const o = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = o(c, d, a);
  const d2 = o(c, d, b);
  const d3 = o(a, b, c);
  const d4 = o(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function segHitsRect(a: Point, b: Point, corners: Point[]): boolean {
  for (let i = 0; i < 4; i++) if (segIntersect(a, b, corners[i], corners[(i + 1) % 4])) return true;
  // داخل المستطيل بالكامل
  const inside = (p: Point) => {
    let s = 0;
    for (let i = 0; i < 4; i++) {
      const c = corners[i];
      const d = corners[(i + 1) % 4];
      const v = (d.x - c.x) * (p.y - c.y) - (d.y - c.y) * (p.x - c.x);
      s += v > 0 ? 1 : v < 0 ? -1 : 0;
    }
    return Math.abs(s) === 4;
  };
  return inside(a) || inside(b);
}

export function detectClashes(objects: ProjectObject[], ppm: number): Clash[] {
  void ppm;
  const out: Clash[] = [];
  const routes = objects.filter((o): o is RouteObject => o.type === 'route' && (o as RouteObject).points.length >= 2);
  const walls = new Map(objects.filter((o) => o.type === 'wall').map((w) => [w.id, w as WallObject]));
  const openings = objects
    .filter((o): o is DoorObject | WindowObject => (o.type === 'door' || o.type === 'window') && walls.has((o as DoorObject).wallId))
    .map((op) => {
      const w = walls.get(op.wallId)!;
      const L = Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y) || 1;
      const ux = (w.end.x - w.start.x) / L;
      const uy = (w.end.y - w.start.y) / L;
      const cx = w.start.x + ux * L * op.position;
      const cy = w.start.y + uy * L * op.position;
      const h = op.width / 2;
      return { op, a: { x: cx - ux * h, y: cy - uy * h }, b: { x: cx + ux * h, y: cy + uy * h } };
    });
  const columns = objects
    .filter((o): o is ColumnObject => o.type === 'column')
    .map((c) => {
      const rad = ((c.rotation || 0) * Math.PI) / 180;
      const corner = (sx: number, sy: number) => ({
        x: c.x + ((sx * c.width) / 2) * Math.cos(rad) - ((sy * c.depth) / 2) * Math.sin(rad),
        y: c.y + ((sx * c.width) / 2) * Math.sin(rad) + ((sy * c.depth) / 2) * Math.cos(rad),
      });
      return { c, corners: [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)] };
    });
  const segs = (r: RouteObject) => r.points.slice(0, -1).map((p, i) => [p, r.points[i + 1]] as [Point, Point]);

  for (const r of routes) {
    const name = KIND_NAMES[r.routeKind] || r.routeKind;
    for (const { op, a, b } of openings) {
      if (segs(r).some(([p, q]) => segIntersect(p, q, a, b))) {
        out.push({ severity: 'error', message: `مسار ${name}${r.label ? ` «${r.label}»` : ''} يعبر فتحة ${op.type === 'door' ? 'باب' : 'شباك'}`, ids: [r.id, op.id] });
      }
    }
    for (const { c, corners } of columns) {
      if (segs(r).some(([p, q]) => segHitsRect(p, q, corners))) out.push({ severity: 'error', message: `مسار ${name} يخترق عموداً`, ids: [r.id, c.id] });
    }
  }
  for (let i = 0; i < routes.length; i++) {
    for (let j = i + 1; j < routes.length; j++) {
      const a = routes[i];
      const b = routes[j];
      if (a.routeKind === b.routeKind) continue;
      if (segs(a).some(([p, q]) => segs(b).some(([s, t]) => segIntersect(p, q, s, t)))) {
        const pair = [a.routeKind, b.routeKind].sort().join('+');
        const msg = pair === 'electrical+water' || pair === 'drainage+electrical' ? 'تأكد من مسافة الفصل والعزل' : 'تأكد من اختلاف المناسيب';
        out.push({ severity: 'warning', message: `تقاطع مسار ${KIND_NAMES[a.routeKind]} مع ${KIND_NAMES[b.routeKind]} — ${msg}`, ids: [a.id, b.id] });
      }
    }
  }
  return out;
}
