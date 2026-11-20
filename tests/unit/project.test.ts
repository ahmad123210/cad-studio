import { describe, it, expect } from 'vitest';
import { ProjectModel } from '../../src/model/project.ts';
import { rotateSpec } from '../../src/model/transforms.ts';

const txt = (id: string) => ({ id, type: 'text', layerId: 'arch', text: id, x: 0, y: 0, fontSize: 10, color: '#fff', rotation: 0 }) as any;
const wall = { id: 'w', type: 'wall', layerId: 'arch', start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, thickness: 20 } as any;
const door = { id: 'd', type: 'door', layerId: 'arch', wallId: 'w', position: 0.5, width: 40, openDirection: 'inward_right' } as any;

describe('ProjectModel', () => {
  it('bulk delete removes hosted openings and undo restores draw order', () => {
    const m = new ProjectModel('t', 't');
    ['a', 'b', 'c'].forEach((id) => m.addObject(txt(id)));
    m.addObject(wall);
    m.addObject(door);
    m.addObject(txt('z'));
    m.deleteObjects(['b', 'w']);
    expect(m.getObjects().map((o) => o.id)).toEqual(['a', 'c', 'z']);
    m.undo();
    expect(m.getObjects().map((o) => o.id)).toEqual(['a', 'b', 'c', 'w', 'd', 'z']);
  });

  it('addObjects and applyTransform are single undo steps', () => {
    const m = new ProjectModel('t', 't');
    m.addObjects([txt('a'), txt('b')]);
    expect(m.getObjects()).toHaveLength(2);
    m.addObject(wall, false);
    m.applyTransform(['w'], rotateSpec({ x: 0, y: 0 }, 90), 'rot');
    expect((m.getObjectById('w') as any).end).toEqual({ x: 0, y: 100 });
    m.undo();
    expect((m.getObjectById('w') as any).end).toEqual({ x: 100, y: 0 });
    m.undo();
    expect(m.getObjects().filter((o) => o.type === 'text')).toHaveLength(0);
  });

  it('keeps a scale per sheet', () => {
    const m = new ProjectModel('t', 't');
    m.setMeta({ scale: 37.5 });
    const b = m.addSheet('B');
    m.setMeta({ scale: 80 });
    m.setActiveSheet('sheet_1');
    expect(m.getMeta().scale).toBe(37.5);
    m.setActiveSheet(b);
    expect(m.getMeta().scale).toBe(80);
  });

  it('rounds coordinates after moves', () => {
    const m = new ProjectModel('t', 't');
    m.addObject(wall, false);
    m.moveObjects(['w'], { x: 0, y: 39.99999999999 });
    expect((m.getObjectById('w') as any).start.y).toBe(40);
  });
});
