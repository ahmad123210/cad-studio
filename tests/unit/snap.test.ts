import { describe, it, expect, afterEach } from 'vitest';
import { SnapEngine, SnapOptions } from '../../src/engine/snap.ts';
import type { WallObject } from '../../src/model/types.ts';

const W = (id: string, sx: number, sy: number, ex: number, ey: number): WallObject => ({ id, type: 'wall', layerId: 'arch', start: { x: sx, y: sy }, end: { x: ex, y: ey }, thickness: 10 });
const opts: SnapOptions = { enableGridSnap: false, enableObjectSnap: true, gridSize: 10, snapRadius: 15 };

afterEach(() => {
  SnapEngine.orthoMode = false;
});

describe('snap engine', () => {
  it('snaps to the intersection of two crossing walls', () => {
    const r = SnapEngine.findSnapPoint({ x: 52, y: 47 }, [W('a', 0, 50, 100, 50), W('b', 50, 0, 50, 100)], opts);
    expect(r.type).toBe('intersection');
    expect(r.point).toEqual({ x: 50, y: 50 });
  });

  it('snaps perpendicular from the command start point', () => {
    const r = SnapEngine.findSnapPoint({ x: 33, y: 4 }, [W('a', 0, 0, 100, 0)], { ...opts, fromPoint: { x: 30, y: 80 } });
    expect(r.type).toBe('perpendicular');
    expect(r.point).toEqual({ x: 30, y: 0 });
  });

  it('tracks horizontal alignment with acquired points', () => {
    const r = SnapEngine.findSnapPoint({ x: 300, y: 203 }, [], { ...opts, trackPoints: [{ x: 0, y: 200 }] });
    expect(r.type).toBe('tracking');
    expect(r.point.y).toBe(200);
  });

  it('ortho mode always locks to the nearest axis', () => {
    SnapEngine.orthoMode = true;
    const r = SnapEngine.getPolarAngleSnap({ x: 0, y: 0 }, { x: 100, y: 30 }, [0, 45, 90], 5);
    expect(r.isSnapped).toBe(true);
    expect(r.point.y).toBeCloseTo(0);
  });
});
