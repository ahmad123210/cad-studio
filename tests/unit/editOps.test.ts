import { describe, it, expect } from 'vitest';
import { planFillet, planChamfer, planBreak, planJoin, planStretch, chainDimensions } from '../../src/model/editOps.ts';
import type { ProjectObject, WallObject } from '../../src/model/types.ts';

const W = (id: string, sx: number, sy: number, ex: number, ey: number, t = 20) =>
  ({ id, type: 'wall', layerId: 'arch', start: { x: sx, y: sy }, end: { x: ex, y: ey }, thickness: t }) as WallObject;
const D = (id: string, wallId: string, position: number, width = 50) => ({ id, type: 'door', layerId: 'arch', wallId, position, width, openDirection: 'inward_right' }) as unknown as ProjectObject;
const after = (plan: any, id: string) => plan.updates.find((u: any) => u.id === id)?.after;

describe('fillet / chamfer', () => {
  it('extends two walls to meet at the corner and keeps the door in place', () => {
    const a = W('a', 0, 0, 80, 0);
    const b = W('b', 100, 20, 100, 200);
    const all = [a, b, D('d', 'a', 0.5, 20)];
    const p = planFillet(all, a, { x: 10, y: 0 }, b, { x: 100, y: 150 }) as any;
    expect(after(p, 'a')).toEqual({ start: { x: 0, y: 0 }, end: { x: 100, y: 0 } });
    expect(after(p, 'b')).toEqual({ start: { x: 100, y: 0 }, end: { x: 100, y: 200 } });
    expect(after(p, 'd').position).toBeCloseTo(0.4); // 40 من 100
  });
  it('trims crossing walls keeping the clicked side', () => {
    const a = W('a', 0, 0, 200, 0);
    const b = W('b', 100, -100, 100, 100);
    const p = planFillet([a, b], a, { x: 20, y: 0 }, b, { x: 100, y: 80 }) as any;
    expect(after(p, 'a').end).toEqual({ x: 100, y: 0 });
    expect(after(p, 'b').start).toEqual({ x: 100, y: 0 });
  });
  it('chamfer cuts both walls and adds a diagonal wall', () => {
    const a = W('a', 0, 0, 100, 0);
    const b = W('b', 100, 0, 100, 100);
    const p = planChamfer([a, b], a, { x: 10, y: 0 }, b, { x: 100, y: 90 }, 30, 40) as any;
    expect(after(p, 'a').end).toEqual({ x: 70, y: 0 });
    expect(after(p, 'b').start).toEqual({ x: 100, y: 40 });
    expect(p.adds[0]).toMatchObject({ type: 'wall', start: { x: 70, y: 0 }, end: { x: 100, y: 40 } });
    expect(planFillet([a, W('c', 0, 50, 100, 50)], a, { x: 0, y: 0 }, W('c', 0, 50, 100, 50), { x: 0, y: 50 })).toMatch(/متوازيان/);
  });
});

describe('break / join', () => {
  it('break with a gap removes the middle and moves openings to the right piece', () => {
    const w = W('w', 0, 0, 400, 0);
    const all = [w, D('d1', 'w', 0.125), D('d2', 'w', 0.875), D('mid', 'w', 0.5, 20)];
    const p = planBreak(all, w, { x: 150, y: 0 }, { x: 250, y: 0 }, 2) as any;
    expect(after(p, 'w').end).toEqual({ x: 150, y: 0 });
    expect(p.adds[0].start).toEqual({ x: 250, y: 0 });
    expect(p.deletes).toContain('mid');
    expect(after(p, 'd2').wallId).toBe(p.adds[0].id);
    expect(after(p, 'd2').position).toBeCloseTo(0.666667, 4);
  });
  it('break at a point splits without a gap; polylines too', () => {
    const w = W('w', 0, 0, 400, 0);
    const p = planBreak([w], w, { x: 100, y: 0 }, { x: 100.5, y: 0 }, 2) as any;
    expect(after(p, 'w').end).toEqual({ x: 100, y: 0 });
    expect(p.adds[0].start).toEqual({ x: 100, y: 0 });
    const l = { id: 'l', type: 'line', layerId: 'arch', points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }] } as ProjectObject;
    const q = planBreak([l], l, { x: 100, y: 50 }, { x: 100, y: 50 }, 2) as any;
    expect(after(q, 'l').points).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }]);
    expect(q.adds[0].points).toEqual([{ x: 100, y: 50 }, { x: 100, y: 100 }]);
  });
  it('join merges collinear touching walls (doors keep their place) and connected lines', () => {
    const a = W('a', 0, 0, 100, 0);
    const b = W('b', 100, 0, 300, 0);
    const all = [a, b, D('d', 'b', 0.5, 20), W('c', 0, 50, 100, 60)];
    const p = planJoin(all, ['a', 'b', 'c'], 1) as any;
    expect(after(p, 'a')).toEqual({ start: { x: 0, y: 0 }, end: { x: 300, y: 0 } });
    expect(p.deletes).toEqual(['b']);
    expect(after(p, 'd')).toEqual({ wallId: 'a', position: 0.666667 });
    const l1 = { id: 'l1', type: 'line', layerId: 'arch', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] } as ProjectObject;
    const l2 = { id: 'l2', type: 'line', layerId: 'arch', points: [{ x: 20, y: 5 }, { x: 10, y: 0 }] } as ProjectObject;
    const q = planJoin([l1, l2], ['l1', 'l2'], 1) as any;
    expect(after(q, 'l1').points).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 5 }]);
    expect(planJoin([a, W('z', 0, 100, 50, 100)], ['a', 'z'], 1)).toMatch(/لا توجد/);
  });
});

describe('stretch / chain dimensions', () => {
  it('moves only vertices inside the window', () => {
    const a = W('a', 0, 0, 100, 0);
    const b = W('b', 100, 0, 100, 100);
    const all = [a, b, D('d', 'a', 0.5, 20), { id: 's', type: 'symbol', layerId: 'arch', symbolKind: 'x', x: 90, y: 50, rotation: 0 } as ProjectObject];
    const p = planStretch(all, { minX: 80, minY: -10, maxX: 120, maxY: 110 }, { x: 50, y: 0 }) as any;
    expect(after(p, 'a')).toEqual({ start: { x: 0, y: 0 }, end: { x: 150, y: 0 } });
    expect(after(p, 'b')).toEqual({ start: { x: 150, y: 0 }, end: { x: 150, y: 100 } });
    expect(after(p, 'd').position).toBeCloseTo(50 / 150, 5);
    expect(after(p, 's')).toEqual({ x: 140, y: 50 });
  });
  it('chain dimensions: segments between wall ends and opening edges plus the overall', () => {
    const w = W('w', 0, 0, 500, 0);
    const all = [w, D('d', 'w', 0.3, 50), D('w2', 'w', 0.7, 100)];
    const dims = chainDimensions(all, w, -1, 30, 'arch');
    const lens = dims.map((d) => Math.round(d.measuredLength));
    expect(lens).toEqual([125, 50, 125, 100, 100, 500]);
    expect(dims[0].start.y).toBe(-10); // وجه الجدار العلوي (نصف السماكة)
    expect(dims[dims.length - 1].offset).toBe(-60);
  });
});

import { copyProps, planPasteProps } from '../../src/model/matchProps.ts';
describe('match properties', () => {
  it('same type copies size/appearance; other types copy layer and colour only', () => {
    const a = { ...W('a', 0, 0, 100, 0, 30), height: 3.5, color: '#ff0000' } as ProjectObject;
    const b = W('b', 0, 50, 100, 50, 20);
    const t = { id: 't', type: 'text', layerId: 'elec', text: 'x', x: 0, y: 0, fontSize: 16, color: '#fff', rotation: 0 } as ProjectObject;
    const snap = copyProps(a);
    const plan = planPasteProps([b, t, a], snap);
    expect(plan.updates.find((u) => u.id === 'b')!.after).toEqual({ thickness: 30, height: 3.5, color: '#ff0000' });
    expect(plan.updates.find((u) => u.id === 't')!.after).toEqual({ layerId: 'arch', color: '#ff0000' });
    expect(plan.updates.find((u) => u.id === 'a')).toBeUndefined();
  });
});
