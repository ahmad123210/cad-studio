import { describe, it, expect } from 'vitest';
import { computePlumbing, hunterLps, supplyPipeFor, drainMainFor } from '../../src/model/plumbing.ts';
import { detectClashes } from '../../src/model/clashes.ts';
import type { ProjectObject } from '../../src/model/types.ts';

const sym = (id: string, kind: string, x = 0, y = 0) => ({ id, type: 'symbol', layerId: 'plumb', symbolKind: kind, x, y, rotation: 0 }) as unknown as ProjectObject;
const route = (id: string, kind: string, pts: number[][], extra: Record<string, unknown> = {}) =>
  ({ id, type: 'route', layerId: 'plumb', routeKind: kind, points: pts.map(([x, y]) => ({ x, y })), lengthCalculated: 0, ...extra }) as unknown as ProjectObject;

describe('plumbing', () => {
  it('fixture units, design flow, supply and drain mains', () => {
    const objs = [sym('wc1', 'furn_toilet_wc'), sym('wc2', 'furn_toilet_wc'), sym('b1', 'furn_washbasin'), sym('sh', 'furn_shower'), sym('k', 'plumb_sink')];
    const r = computePlumbing(objs, 50);
    expect(r.totals.wsfu).toBe(9.5);
    expect(r.totals.dfu).toBe(13);
    expect(r.totals.flowLps).toBeCloseTo(hunterLps(9.5), 2);
    expect(r.totals.supplyMain).toBe('32 مم'); // ≈0.85 ل/ث: 25مم تتجاوز 2.5 م/ث
    expect(r.totals.drainMain).toBe('110 مم'); // مرحاض ← 110 كحد أدنى
    expect(drainMainFor(10, false)).toBe('50 مم');
    expect(supplyPipeFor(0.2)).toBe('20 مم');
  });
  it('drain slopes and undersized WC drain', () => {
    const objs = [sym('wc', 'furn_toilet_wc'), route('d1', 'drainage', [[0, 0], [200, 0]], { diameter: 75, startSymbolId: 'wc' }), route('d2', 'drainage', [[0, 0], [0, 300]], { diameter: 110 })];
    const r = computePlumbing(objs, 50);
    expect(r.drains[0]).toMatchObject({ diameter: 75, lengthM: 4, slopePct: 2, dropCm: 8, undersized: true });
    expect(r.drains[1]).toMatchObject({ slopePct: 1, dropCm: 6, undersized: false });
  });
});

describe('clashes', () => {
  it('route through a door opening, through a column, and crossing another system', () => {
    const objs = [
      { id: 'w', type: 'wall', layerId: 'arch', start: { x: 0, y: 0 }, end: { x: 400, y: 0 }, thickness: 20 },
      { id: 'd', type: 'door', layerId: 'arch', wallId: 'w', position: 0.5, width: 50, openDirection: 'inward_right' },
      { id: 'c', type: 'column', layerId: 'arch', x: 100, y: 100, width: 20, depth: 20, rotation: 0 },
      route('e', 'electrical', [[200, -50], [200, 150]]),
      route('wa', 'water', [[50, 100], [300, 100]]),
      route('ok', 'electrical', [[350, -50], [350, -10]]),
    ] as unknown as ProjectObject[];
    const c = detectClashes(objs, 50);
    expect(c.some((x) => x.severity === 'error' && x.ids.includes('d') && x.ids.includes('e'))).toBe(true);
    expect(c.some((x) => x.ids.includes('c') && x.ids.includes('wa'))).toBe(true);
    expect(c.some((x) => x.severity === 'warning' && x.ids.includes('e') && x.ids.includes('wa'))).toBe(true);
    expect(c.some((x) => x.ids.includes('ok'))).toBe(false);
  });
});
