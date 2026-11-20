import { describe, it, expect } from 'vitest';
import { parseDxfString, convertDxfToProjectData } from '../../src/engine/dxfEngine.ts';
import { SAMPLE_DXF } from '../fixtures/sampleDxf.ts';

describe('DXF import', () => {
  const parsed = parseDxfString(SAMPLE_DXF);

  it('reads layer table with colours and off state', () => {
    expect(parsed.layers.map((l) => l.name)).toEqual(['A-WALL', 'FURN', 'HIDDEN']);
    expect(parsed.layers.find((l) => l.name === 'HIDDEN')!.off).toBe(true);
  });

  it('expands block inserts with rotation and scale (and does not draw block definitions at origin)', () => {
    expect(parsed.blockCount).toBe(1);
    const squares = parsed.polylines
      .filter((p) => p.closed && p.points.length === 4)
      .map((p) => p.points.map((q) => [Math.round(q.x), Math.round(q.y)]));
    expect(squares).toEqual([
      [[1000, 2000], [1000, 2500], [500, 2500], [500, 2000]],
      [[3000, 2000], [4000, 2000], [4000, 3000], [3000, 3000]],
    ]);
  });

  it('expands bulges and keeps arcs/circles/mtext', () => {
    expect(parsed.polylines.some((p) => !p.closed && p.points.length > 10)).toBe(true);
    expect(parsed.arcs).toHaveLength(1);
    expect(parsed.circles).toHaveLength(1);
    expect(parsed.texts[0].text).toBe('غرفة\nالمعيشة');
  });

  it('converts by wall mode with header units (mm)', () => {
    const count = (mode: 'auto' | 'all' | 'none') => {
      const c: Record<string, number> = {};
      convertDxfToProjectData(parsed, 50, { wallMode: mode }).objects.forEach((o) => (c[o.type] = (c[o.type] || 0) + 1));
      return c;
    };
    expect(count('auto')).toEqual({ wall: 2, line: 8, text: 1 });
    expect(count('none').wall).toBeUndefined();
    const r = convertDxfToProjectData(parsed, 50);
    const w = r.objects.find((o) => o.type === 'wall') as any;
    expect(Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y)).toBeCloseTo(300); // 6 m × 50 px/m
    expect(r.layers.find((l) => l.name === 'HIDDEN')!.visible).toBe(false);
  });
});
