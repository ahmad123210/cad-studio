import { describe, it, expect } from 'vitest';
import { planAlign } from '../../src/model/align.ts';
import { ProjectModel } from '../../src/model/project.ts';
import type { ProjectObject } from '../../src/model/types.ts';

const S = (id: string, x: number, y: number, extra: Record<string, unknown> = {}) =>
  ({ id, type: 'symbol', layerId: 'elec', symbolType: 'socket', x, y, rotation: 0, scale: 1, ...extra }) as unknown as ProjectObject;
const W = (id: string, sx: number, sy: number, ex: number, ey: number) =>
  ({ id, type: 'wall', layerId: 'arch', start: { x: sx, y: sy }, end: { x: ex, y: ey }, thickness: 20 }) as ProjectObject;
const D = (id: string, wallId: string) => ({ id, type: 'door', layerId: 'arch', wallId, position: 0.5, width: 30, openDirection: 'inward_right' }) as ProjectObject;

const apply = (all: ProjectObject[], plan: ReturnType<typeof planAlign>) => {
  if (typeof plan === 'string') throw new Error(plan);
  const m = new Map(all.map((o) => [o.id, JSON.parse(JSON.stringify(o))]));
  for (const u of plan.updates) Object.assign(m.get(u.id), u.after);
  return m;
};

describe('align', () => {
  it('aligns left edges to the selection minimum', () => {
    const all = [S('a', 10, 0), S('b', 50, 30), S('c', 90, 60)];
    const m = apply(all, planAlign(all, ['a', 'b', 'c'], 'left'));
    expect(['a', 'b', 'c'].map((id) => m.get(id).x)).toEqual([10, 10, 10]);
    expect(m.get('c').y).toBe(60); // المحور الآخر لا يتغير
  });

  it('aligns a wall by its outer face (half thickness) and moves hosted symbols with it', () => {
    const all = [W('w', 100, 0, 100, 100), S('s', 0, 50), S('h', 105, 50, { wallId: 'w', wallPosition: 0.5 }), D('d', 'w')];
    const plan = planAlign(all, ['w', 's', 'd'], 'right');
    if (typeof plan === 'string') throw new Error(plan);
    expect(plan.updates.find((u) => u.id === 'd')).toBeUndefined(); // الباب يتبع جداره
    const m = apply(all, plan);
    expect(m.get('w').start.x).toBe(100); // الجدار أصلاً هو الحد الأيمن (110)
    expect(m.get('s').x).toBe(110);
  });

  it('centers vertically and moves the hosted symbol by the same delta as its wall', () => {
    const all = [W('w', 0, 0, 100, 0), S('s', 50, 100), S('h', 50, 5, { wallId: 'w', wallPosition: 0.5 })];
    const m = apply(all, planAlign(all, ['w', 's'], 'centerY'));
    // صندوق الإحاطة الكلي y من -10 إلى 100 → المركز 45
    expect(m.get('w').start.y).toBe(45);
    expect(m.get('s').y).toBe(45);
    expect(m.get('h').y).toBe(50);
  });

  it('distributes centers evenly keeping the extremes fixed', () => {
    const all = [S('a', 0, 0), S('b', 10, 0), S('c', 25, 0), S('d', 90, 0)];
    const m = apply(all, planAlign(all, ['d', 'b', 'a', 'c'], 'distributeH'));
    expect(['a', 'b', 'c', 'd'].map((id) => m.get(id).x)).toEqual([0, 30, 60, 90]);
  });

  it('validates the selection size', () => {
    const all = [S('a', 0, 0), S('b', 10, 0)];
    expect(planAlign(all, ['a'], 'left')).toMatch(/عنصرين/);
    expect(planAlign(all, ['a', 'b'], 'distributeV')).toMatch(/3 عناصر/);
  });

  it('is a single undo step through ProjectModel.applyEdits', () => {
    const model = new ProjectModel();
    model.addObjects([S('a', 0, 0), S('b', 40, 20)]);
    const plan = planAlign(model.getObjects(), ['a', 'b'], 'top');
    if (typeof plan === 'string') throw new Error(plan);
    model.applyEdits(plan, 'align');
    expect((model.getObjects().find((o) => o.id === 'b') as any).y).toBe(0);
    model.undo();
    expect((model.getObjects().find((o) => o.id === 'b') as any).y).toBe(20);
  });
});
