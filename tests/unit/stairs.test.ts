import { describe, it, expect } from 'vitest';
import { stairsGeometry } from '../../src/model/stairs.ts';
import type { StairObject } from '../../src/model/types.ts';

const st = (len: number, extra: Partial<StairObject> = {}): StairObject => ({ id: 's', type: 'stairs', layerId: 'arch', start: { x: 0, y: 0 }, end: { x: len, y: 0 }, width: 60, ...extra });

describe('stairs geometry', () => {
  it('counts treads from length and tread depth (50 px/m)', () => {
    const g = stairsGeometry(st(140), 50); // 2.8م ÷ 0.28 = 10 نائمات
    expect(g.treads).toBe(10);
    expect(g.risers).toBe(11);
    expect(g.riseM).toBeCloseTo(1.87, 2);
    expect(g.steps).toHaveLength(9);
    expect(g.outline[2]).toEqual({ x: 140, y: 30 });
  });
  it('stretching the stairs updates the step count', () => {
    expect(stairsGeometry(st(280), 50).treads).toBe(20);
    expect(stairsGeometry(st(280, { tread: 0.3 }), 50).treads).toBe(19);
  });
});
