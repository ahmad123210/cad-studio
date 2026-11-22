import { describe, it, expect } from 'vitest';
import { buildRoomGraph, findRoomAt, roomLabelPoint, pointInPolygon } from '../../src/model/rooms.ts';
import type { WallObject } from '../../src/model/types.ts';

let n = 0;
const W = (sx: number, sy: number, ex: number, ey: number, thickness = 20, extra: Partial<WallObject> = {}): WallObject =>
  ({ id: `w${n++}`, type: 'wall', layerId: 'arch', start: { x: sx, y: sy }, end: { x: ex, y: ey }, thickness, ...extra }) as WallObject;
const box = (x0: number, y0: number, x1: number, y1: number, t = 20) => [
  W(x0, y0, x1, y0, t), W(x1, y0, x1, y1, t), W(x1, y1, x0, y1, t), W(x0, y1, x0, y0, t),
];

describe('room detection', () => {
  it('one closed room: net area excludes half the wall thickness on each side', () => {
    const g = buildRoomGraph(box(0, 0, 500, 400));
    expect(g.rooms).toHaveLength(1);
    expect(g.exteriors).toHaveLength(1);
    expect(g.rooms[0].netArea).toBeCloseTo(480 * 380, 3);
    expect(g.rooms[0].netPerimeter).toBeCloseTo(2 * (480 + 380), 3);
    // الحد الخارجي مُزاح للخارج: 520×420
    expect(g.exteriors[0].netArea).toBeCloseTo(520 * 420, 3);
    expect(g.exteriors[0].netPerimeter).toBeCloseTo(2 * (520 + 420), 3);
  });

  it('T-junction partition wall splits into two rooms; walls drawn in any direction', () => {
    const walls = [...box(0, 0, 600, 400), W(300, 400, 300, 0, 10)];
    const g = buildRoomGraph(walls);
    expect(g.rooms).toHaveLength(2);
    const areas = g.rooms.map((r) => r.netArea).sort((a, b) => a - b);
    // عرض الغرفة = 300 - 10 (نصف الخارجي) - 5 (نصف الفاصل)
    expect(areas[0]).toBeCloseTo(285 * 380, 3);
    expect(areas[1]).toBeCloseTo(285 * 380, 3);
  });

  it('tolerates small gaps/overshoots at corners and ignores dangling walls', () => {
    const walls = [
      W(0, 0, 505, 0), W(500, -4, 500, 400), W(503, 400, 0, 400), W(0, 405, 0, 2),
      W(500, 200, 800, 200), // جدار سائب لا يغلق شيئاً
    ];
    const g = buildRoomGraph(walls);
    expect(g.rooms).toHaveLength(1);
    expect(g.rooms[0].netArea).toBeGreaterThan(470 * 370);
    expect(g.rooms[0].netArea).toBeLessThan(490 * 390);
  });

  it('crossing walls (X) create four rooms', () => {
    const walls = [...box(0, 0, 400, 400), W(-0, 200, 400, 200), W(200, 0, 200, 400)];
    expect(buildRoomGraph(walls).rooms).toHaveLength(4);
  });

  it('fences are excluded from rooms', () => {
    const fence = box(-200, -200, 900, 900).map((w) => ({ ...w, wallKind: 'fence' as const }));
    const g = buildRoomGraph([...box(0, 0, 500, 400), ...fence]);
    expect(g.rooms).toHaveLength(1);
  });

  it('an island room is subtracted from the room that surrounds it', () => {
    const g = buildRoomGraph([...box(0, 0, 1000, 1000), ...box(400, 400, 600, 600)]);
    const big = findRoomAt(g, { x: 100, y: 100 })!;
    const small = findRoomAt(g, { x: 500, y: 500 })!;
    expect(small.netArea).toBeCloseTo(180 * 180, 3);
    expect(big.netArea).toBeCloseTo(980 * 980 - 220 * 220, 3);
  });

  it('edges report the wall and the covered range for opening deductions', () => {
    const walls = [...box(0, 0, 600, 400), W(300, 0, 300, 400, 10)];
    const g = buildRoomGraph(walls);
    const left = findRoomAt(g, { x: 100, y: 200 })!;
    const top = left.edges.find((e) => e.wallId === walls[0].id)!;
    expect(top.t0).toBeCloseTo(0);
    expect(top.t1).toBeCloseTo(0.5);
  });

  it('label point lies inside L-shaped rooms', () => {
    const L = [W(0, 0, 600, 0), W(600, 0, 600, 200), W(600, 200, 200, 200), W(200, 200, 200, 600), W(200, 600, 0, 600), W(0, 600, 0, 0)];
    const g = buildRoomGraph(L);
    expect(g.rooms).toHaveLength(1);
    expect(pointInPolygon(roomLabelPoint(g.rooms[0]), g.rooms[0].polygon)).toBe(true);
  });
});
