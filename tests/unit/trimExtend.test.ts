import { describe, it, expect } from 'vitest';
import { planTrim, planExtend } from '../../src/model/trimExtend.ts';
import { ProjectModel } from '../../src/model/project.ts';
import type { ProjectObject } from '../../src/model/types.ts';

const W = (id: string, sx: number, sy: number, ex: number, ey: number) =>
  ({ id, type: 'wall', layerId: 'arch', start: { x: sx, y: sy }, end: { x: ex, y: ey }, thickness: 20 }) as ProjectObject;
const D = (id: string, wallId: string, position: number, width = 30) =>
  ({ id, type: 'door', layerId: 'arch', wallId, position, width, openDirection: 'inward_right' }) as ProjectObject;

describe('trim', () => {
  it('removes the middle part between two boundaries and keeps doors at their real positions', () => {
    const all = [W('a', 0, 0, 300, 0), W('b1', 100, -50, 100, 50), W('b2', 200, -50, 200, 50), D('keep', 'a', 0.85), D('gone', 'a', 0.5)];
    const plan = planTrim(all, { x: 150, y: 2 }, 12);
    if (typeof plan === 'string') throw new Error(plan);
    expect(plan.updates.find((u) => u.id === 'a')!.after).toEqual({ end: { x: 100, y: 0 } });
    expect(plan.adds).toHaveLength(1);
    const second = plan.adds[0] as any;
    expect(second.start).toEqual({ x: 200, y: 0 });
    expect(second.end).toEqual({ x: 300, y: 0 });
    expect(plan.deletes).toEqual(['gone']);
    const moved = plan.updates.find((u) => u.id === 'keep')!.after as any;
    expect(moved.wallId).toBe(second.id);
    expect(moved.position).toBeCloseTo(0.55); // x=255 على الجدار الجديد 200→300
  });

  it('trims an end segment back to the boundary', () => {
    const plan = planTrim([W('a', 0, 0, 300, 0), W('b', 200, -50, 200, 50)], { x: 260, y: 0 }, 12);
    if (typeof plan === 'string') throw new Error(plan);
    expect(plan.updates[0].after).toEqual({ end: { x: 200, y: 0 } });
  });

  it('splits a free line', () => {
    const line = { id: 'l', type: 'line', layerId: 'arch', points: [{ x: 0, y: 0 }, { x: 300, y: 0 }] } as ProjectObject;
    const plan = planTrim([line, W('b1', 100, -50, 100, 50), W('b2', 200, -50, 200, 50)], { x: 150, y: 1 }, 12);
    if (typeof plan === 'string') throw new Error(plan);
    expect((plan.updates[0].after as any).points).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    expect((plan.adds[0] as any).points).toEqual([{ x: 200, y: 0 }, { x: 300, y: 0 }]);
  });

  it('reports when nothing crosses', () => {
    expect(typeof planTrim([W('a', 0, 0, 300, 0)], { x: 150, y: 0 }, 12)).toBe('string');
  });
});

describe('extend', () => {
  it('extends the nearer end to the first boundary and preserves door position', () => {
    const plan = planExtend([W('a', 0, 0, 80, 0), W('b', 200, -50, 200, 50), D('d', 'a', 0.5)], { x: 75, y: 3 }, 12);
    if (typeof plan === 'string') throw new Error(plan);
    expect(plan.updates.find((u) => u.id === 'a')!.after).toEqual({ start: { x: 0, y: 0 }, end: { x: 200, y: 0 } });
    expect((plan.updates.find((u) => u.id === 'd')!.after as any).position).toBeCloseTo(0.2);
  });

  it('extends the start backwards', () => {
    const plan = planExtend([W('a', 0, 0, 80, 0), W('b', -50, -50, -50, 50), D('d', 'a', 0.5)], { x: 4, y: 0 }, 12);
    if (typeof plan === 'string') throw new Error(plan);
    expect((plan.updates.find((u) => u.id === 'a')!.after as any).start).toEqual({ x: -50, y: 0 });
    expect((plan.updates.find((u) => u.id === 'd')!.after as any).position).toBeCloseTo(90 / 130);
  });
});

describe('applyEdits', () => {
  it('applies a trim as one undo step', () => {
    const m = new ProjectModel('t', 't');
    [W('a', 0, 0, 300, 0), W('b1', 100, -50, 100, 50), W('b2', 200, -50, 200, 50), D('gone', 'a', 0.5)].forEach((o) => m.addObject(o, false));
    const plan = planTrim(m.getObjects(), { x: 150, y: 0 }, 12);
    if (typeof plan === 'string') throw new Error(plan);
    m.applyEdits(plan, 'trim');
    expect(m.getObjects().filter((o) => o.type === 'wall')).toHaveLength(4);
    expect(m.getObjectById('gone')).toBeUndefined();
    m.undo();
    expect(m.getObjects().map((o) => o.id)).toEqual(['a', 'b1', 'b2', 'gone']);
    expect((m.getObjectById('a') as any).end).toEqual({ x: 300, y: 0 });
  });
});

describe('trim closed lines', () => {
  // مربع مغلق 0..200 يقطعه جدار رأسي عند x=100 (يقطع الضلع العلوي والسفلي)
  const square = () =>
    ({ id: 'sq', type: 'line', layerId: 'arch', closed: true, points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }] }) as ProjectObject;
  const cutter = () => W('c', 100, -50, 100, 250);

  it('removes the clicked side of the loop and opens the polyline', () => {
    const plan = planTrim([square(), cutter()], { x: 200, y: 100 }, 12); // النقر على الضلع الأيمن
    if (typeof plan === 'string') throw new Error(plan);
    const after = plan.updates[0].after as any;
    expect(after.closed).toBe(false);
    // يبقى النصف الأيسر: من (100,200) مروراً بـ(0,200) و(0,0) حتى (100,0)
    expect(after.points).toEqual([{ x: 100, y: 200 }, { x: 0, y: 200 }, { x: 0, y: 0 }, { x: 100, y: 0 }]);
  });

  it('works when the click is on the closing segment', () => {
    const plan = planTrim([square(), cutter()], { x: 0, y: 100 }, 12); // الضلع الأيسر = قطعة الإغلاق
    if (typeof plan === 'string') throw new Error(plan);
    const after = plan.updates[0].after as any;
    expect(after.points).toEqual([{ x: 100, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 100, y: 200 }]);
  });

  it('needs at least two cuts', () => {
    const r = planTrim([square(), W('c', 100, -50, 100, 50)], { x: 200, y: 100 }, 12);
    expect(typeof r).toBe('string');
  });
});
