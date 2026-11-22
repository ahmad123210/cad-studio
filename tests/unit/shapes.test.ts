import { describe, it, expect } from 'vitest';
import { rectPoints, circlePoints, arcThrough, polygonPoints, circumcenter } from '../../src/model/shapes.ts';

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe('shapes geometry', () => {
  it('rectangle from two corners', () => {
    expect(rectPoints({ x: 0, y: 0 }, { x: 4, y: 3 })).toEqual([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }]);
  });
  it('circle points all at radius', () => {
    const pts = circlePoints({ x: 10, y: 10 }, 5);
    expect(pts.length).toBe(72);
    pts.forEach((p) => expect(dist(p, { x: 10, y: 10 })).toBeCloseTo(5, 5));
  });
  it('arc through three points keeps the endpoints and passes near the middle point', () => {
    const pts = arcThrough({ x: 10, y: 0 }, { x: 0, y: 10 }, { x: -10, y: 0 })!;
    expect(pts[0]).toEqual({ x: 10, y: 0 });
    expect(pts[pts.length - 1]).toEqual({ x: -10, y: 0 });
    expect(Math.min(...pts.map((p) => dist(p, { x: 0, y: 10 })))).toBeLessThan(0.5);
    // يمر بالجهة الموجبة (y>0) لا بالسالبة
    expect(pts.every((p) => p.y >= -1e-6)).toBe(true);
    expect(arcThrough({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 })).toBeNull();
  });
  it('arc through the other side', () => {
    const pts = arcThrough({ x: 10, y: 0 }, { x: 0, y: -10 }, { x: -10, y: 0 })!;
    expect(pts.every((p) => p.y <= 1e-6)).toBe(true);
  });
  it('regular polygon with given vertex', () => {
    const pts = polygonPoints({ x: 0, y: 0 }, { x: 10, y: 0 }, 6);
    expect(pts).toHaveLength(6);
    expect(pts[0]).toEqual({ x: 10, y: 0 });
    for (let i = 0; i < 6; i++) expect(dist(pts[i], pts[(i + 1) % 6])).toBeCloseTo(10, 5);
    expect(circumcenter({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 })).toEqual({ x: 1, y: 1 });
  });
});
