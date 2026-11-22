import { describe, it, expect } from 'vitest';
import { computeQuantities, countElbows, lineTotal } from '../../src/model/quantities.ts';
import { DEFAULT_QUANTITY_SETTINGS } from '../../src/model/quantitySettings.ts';
import type { ProjectObject } from '../../src/model/types.ts';

// المقياس 100 بكسل = 1 م لتسهيل الحساب
const PPM = 100;
const W = (id: string, sx: number, sy: number, ex: number, ey: number, extra: Record<string, unknown> = {}) =>
  ({ id, type: 'wall', layerId: 'arch', start: { x: sx, y: sy }, end: { x: ex, y: ey }, thickness: 20, ...extra }) as unknown as ProjectObject;
// غرفة 5م × 4م محاورياً (صافي 4.8 × 3.8)
const room = () => [W('a', 0, 0, 500, 0), W('b', 500, 0, 500, 400), W('c', 500, 400, 0, 400), W('d', 0, 400, 0, 0)];
const settings = { ...DEFAULT_QUANTITY_SETTINGS, wallHeight: 3, doorHeight: 2, routeAllowancePct: 10 };
const q = (objs: ProjectObject[], s = settings) => computeQuantities(objs, { pixelsPerMeter: PPM, settings: s });
const line = (r: ReturnType<typeof q>, key: string) => r.lines.find((l) => l.key === key);

describe('quantities', () => {
  it('floor, ceiling, interior and exterior plaster for one room', () => {
    const r = q(room());
    expect(r.totals.roomCount).toBe(1);
    expect(line(r, 'floor:غير محدد')!.qty).toBeCloseTo(18.24, 2); // 4.8×3.8
    expect(line(r, 'plaster:ceiling')!.qty).toBeCloseTo(18.24, 2);
    expect(line(r, 'plaster:interior')!.qty).toBeCloseTo(2 * (4.8 + 3.8) * 3, 2); // 51.6
    expect(line(r, 'plaster:exterior')!.qty).toBeCloseTo(2 * (5.2 + 4.2) * 3, 2); // 56.4
    expect(line(r, 'paint:interior')!.qty).toBeCloseTo(51.6 + 18.24, 2);
    expect(r.warnings[0]).toMatch(/بلا بطاقة/);
  });

  it('deducts a window from both interior and exterior faces; uses wall height override', () => {
    const objs = [...room(), { id: 'win', type: 'window', layerId: 'arch', wallId: 'a', position: 0.5, width: 150, height: 1.2 } as unknown as ProjectObject];
    const r = q(objs);
    expect(line(r, 'plaster:interior')!.qty).toBeCloseTo(51.6 - 1.8, 2);
    expect(line(r, 'plaster:exterior')!.qty).toBeCloseTo(56.4 - 1.8, 2);
    const tall = q(room().map((w) => ({ ...w, height: 4 }) as ProjectObject));
    expect(line(tall, 'plaster:interior')!.qty).toBeCloseTo(2 * (4.8 + 3.8) * 4, 2);
  });

  it('a door in a partition is deducted from both rooms; floors grouped by labelled type', () => {
    const objs = [
      W('a', 0, 0, 600, 0), W('b', 600, 0, 600, 400), W('c', 600, 400, 0, 400), W('d', 0, 400, 0, 0),
      W('p', 300, 0, 300, 400, { thickness: 10 }),
      { id: 'dr', type: 'door', layerId: 'arch', wallId: 'p', position: 0.5, width: 90, openDirection: 'inward_right' },
      { id: 'r1', type: 'room', layerId: 'arch', x: 150, y: 200, name: 'صالة', floorType: 'رخام' },
      { id: 'r2', type: 'room', layerId: 'arch', x: 450, y: 200, name: 'نوم', floorType: 'باركيه' },
    ] as unknown as ProjectObject[];
    const r = q(objs);
    const each = 2.85 * 3.8; // (3 - 0.1 - 0.05) × 3.8
    expect(line(r, 'floor:رخام')!.qty).toBeCloseTo(each, 2);
    expect(line(r, 'floor:باركيه')!.qty).toBeCloseTo(each, 2);
    const walls = 2 * (2 * (2.85 + 3.8) * 3) - 2 * (0.9 * 2);
    expect(line(r, 'plaster:interior')!.qty).toBeCloseTo(walls, 2);
    expect(r.rooms.map((x) => x.name).sort()).toEqual(['صالة', 'نوم']);
    expect(r.warnings).toEqual([]);
  });

  it('a free-standing wall counts both faces', () => {
    const r = q([...room(), W('free', 1000, 0, 1300, 0)]);
    expect(line(r, 'plaster:interior')!.qty).toBeCloseTo(51.6 + 2 * 3 * 3, 2);
  });

  it('fence detail: per segment, gate deducted, both faces, masonry volume', () => {
    const f = (id: string, sx: number, sy: number, ex: number, ey: number) => W(id, sx, sy, ex, ey, { wallKind: 'fence', thickness: 25 });
    const objs = [
      ...room(),
      f('f1', -500, -500, 1000, -500), f('f2', 1000, -500, 1000, 900),
      { id: 'gate', type: 'door', layerId: 'arch', wallId: 'f1', position: 0.5, width: 300, openDirection: 'inward_right', height: 2 },
    ] as unknown as ProjectObject[];
    const r = q(objs, { ...settings, fenceHeight: 2.5 });
    expect(r.fence).toHaveLength(2);
    expect(r.fence[0]).toMatchObject({ length: 15, height: 2.5, thickness: 0.25, openings: 6, netFace: 31.5 });
    expect(line(r, 'fence:length')!.qty).toBe(29);
    expect(line(r, 'fence:plaster')!.qty).toBeCloseTo(2 * (31.5 + 35), 2);
    expect(line(r, 'fence:masonry')!.qty).toBeCloseTo((31.5 + 35) * 0.25, 3);
    // السور لا يغيّر الغرف ولا اللياسة الخارجية للمبنى
    expect(line(r, 'plaster:exterior')!.qty).toBeCloseTo(56.4 - 0, 2);
  });

  it('opening schedule codes by size and counts', () => {
    const d = (id: string, w: number, h?: number) => ({ id, type: 'door', layerId: 'arch', wallId: 'a', position: 0.3, width: w, height: h, openDirection: 'inward_right' });
    const objs = [...room(), d('d1', 90), d('d2', 90), d('d3', 80), d('d4', 90, 2.4), { id: 'w1', type: 'window', layerId: 'arch', wallId: 'b', position: 0.5, width: 120 }] as unknown as ProjectObject[];
    const r = q(objs);
    expect(r.openings.map((t) => [t.code, t.widthCm, t.heightCm, t.count])).toEqual([
      ['D1', 80, 200, 1], ['D2', 90, 200, 2], ['D3', 90, 240, 1], ['W1', 120, 120, 1],
    ]);
    expect(r.openingCodeById.d2).toBe('D2');
  });

  it('routes: allowance and elbows; electrical has no elbows', () => {
    const route = (id: string, kind: string, pts: number[][], extra = {}) => ({ id, type: 'route', layerId: 'plumb', routeKind: kind, points: pts.map(([x, y]) => ({ x, y })), lengthCalculated: 0, ...extra });
    const objs = [
      route('r1', 'water', [[0, 0], [500, 0], [500, 300], [800, 300]], { material: 'PPR', diameter: 25 }),
      route('r2', 'electrical', [[0, 0], [0, 500], [200, 500]], { material: 'Cu', diameter: 2.5 }),
    ] as unknown as ProjectObject[];
    const r = q(objs);
    expect(line(r, 'route:water|PPR|25')!.qty).toBeCloseTo(11 * 1.1, 2);
    expect(line(r, 'elbow:water|PPR|25')!.qty).toBe(2);
    expect(line(r, 'route:electrical|Cu|2.5')!.qty).toBeCloseTo(7 * 1.1, 2);
    expect(line(r, 'elbow:electrical|Cu|2.5')).toBeUndefined();
    expect(countElbows([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 1 }])).toBe(0);
  });

  it('line totals stay empty until a unit price is entered', () => {
    const r = q(room());
    const l = line(r, 'plaster:ceiling')!;
    expect(lineTotal(l, {})).toBeNull();
    expect(lineTotal(l, { 'plaster:ceiling': 2.5 })).toBeCloseTo(45.6, 2);
  });
});
