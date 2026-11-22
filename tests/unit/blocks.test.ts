import { describe, it, expect } from 'vitest';
import { makeBlock, placeBlock, builtinBlocks } from '../../src/model/blocks.ts';
import type { ProjectObject } from '../../src/model/types.ts';

describe('blocks', () => {
  it('normalizes to the top-left base point and keeps doors with their wall on placement', () => {
    const objs = [
      { id: 'w', type: 'wall', layerId: 'arch', start: { x: 100, y: 200 }, end: { x: 300, y: 200 }, thickness: 20 },
      { id: 'd', type: 'door', layerId: 'arch', wallId: 'w', position: 0.5, width: 45, openDirection: 'inward_right' },
    ] as unknown as ProjectObject[];
    const b = makeBlock(objs, 'جدار بباب');
    const w0 = b.objects.find((o) => o.type === 'wall') as any;
    expect(w0.start).toEqual({ x: 0, y: 0 });
    const placed = placeBlock(b, { x: 50, y: 50 }, 90);
    const w1 = placed.find((o) => o.type === 'wall') as any;
    const d1 = placed.find((o) => o.type === 'door') as any;
    expect(w1.start).toEqual({ x: 50, y: 50 });
    expect(w1.end.x).toBeCloseTo(50);
    expect(w1.end.y).toBeCloseTo(250);
    expect(d1.wallId).toBe(w1.id);
    expect(w1.id).not.toBe('w');
  });
  it('built-in blocks scale with the project scale', () => {
    const k50 = builtinBlocks(50).find((b) => b.id === 'builtin_kitchen_l')!;
    const k100 = builtinBlocks(100).find((b) => b.id === 'builtin_kitchen_l')!;
    const w = (b: typeof k50) => Math.max(...(b.objects[0] as any).points.map((p: any) => p.x));
    expect(w(k50)).toBe(150);
    expect(w(k100)).toBe(300);
    expect((k100.objects[1] as any).scale).toBe(2);
  });
});
