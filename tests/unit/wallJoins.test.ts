import { describe, it, expect } from 'vitest';
import { buildEndpointIndex, computeWallPolygon, wallOutline } from '../../src/engine/geometry/wallJoins.ts';
import type { WallObject } from '../../src/model/types.ts';

const W = (id: string, sx: number, sy: number, ex: number, ey: number): WallObject => ({ id, type: 'wall', layerId: 'arch', start: { x: sx, y: sy }, end: { x: ex, y: ey }, thickness: 20 });

describe('wall joins', () => {
  it('mitres an L corner exactly at the outer/inner corners', () => {
    const a = W('a', 0, 0, 100, 0);
    const b = W('b', 100, 0, 100, 100);
    const poly = computeWallPolygon(a, buildEndpointIndex([a, b]))!;
    const r = poly.map((p) => [Math.round(p.x), Math.round(p.y)]);
    expect(r).toContainEqual([110, -10]);
    expect(r).toContainEqual([90, 10]);
  });
  it('leaves free walls as square-capped outlines', () => {
    const a = W('a', 0, 0, 100, 0);
    expect(computeWallPolygon(a, buildEndpointIndex([a]))).toBeNull();
    expect(wallOutline(a, buildEndpointIndex([a]))!.map((p) => p.x)).toEqual([-10, 110, 110, -10]);
  });
});
