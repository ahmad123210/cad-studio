import { describe, it, expect } from 'vitest';
import { rotateSpec, mirrorSpec, scaleSpec, translateSpec, transformUpdates, cloneTransformed, withHostedObjects, offsetWall, selectionCenter } from '../../src/model/transforms.ts';
import type { WallObject, DoorObject, SymbolObject, ProjectObject } from '../../src/model/types.ts';

const wall: WallObject = { id: 'w', type: 'wall', layerId: 'arch', start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, thickness: 20 };
const door: DoorObject = { id: 'd', type: 'door', layerId: 'arch', wallId: 'w', position: 0.5, width: 40, openDirection: 'inward_right' };
const sym: SymbolObject = { id: 's', type: 'symbol', layerId: 'elec', symbolKind: 'socket_single', x: 10, y: 0, rotation: 30, scale: 1 };

describe('transforms', () => {
  it('rotates a wall 90° about its start (screen y-down)', () => {
    const u = transformUpdates(wall, rotateSpec({ x: 0, y: 0 }, 90), new Set(['w'])) as WallObject;
    expect(u.end).toEqual({ x: 0, y: 100 });
  });

  it('mirrors and flips door swing side only when its wall is transformed', () => {
    const spec = mirrorSpec({ x: 0, y: 50 }, { x: 100, y: 50 });
    expect(transformUpdates(door, spec, new Set(['w']))).toEqual({ openDirection: 'outward_right' });
    expect(transformUpdates(door, spec, new Set())).toBeNull();
  });

  it('mirrors symbol rotation about the axis angle', () => {
    const u = transformUpdates(sym, mirrorSpec({ x: 0, y: 0 }, { x: 0, y: 100 }), new Set()) as SymbolObject;
    expect(u.x).toBe(-10);
    expect(u.rotation).toBe(150); // 2*90 - 30
  });

  it('scales symbol size and positions', () => {
    const u = transformUpdates(sym, scaleSpec({ x: 0, y: 0 }, 2), new Set()) as SymbolObject;
    expect(u.x).toBe(20);
    expect(u.scale).toBe(2);
  });

  it('clones re-link openings to cloned walls and drop wall-less openings', () => {
    const withWall = cloneTransformed([wall, door], translateSpec(0, 50));
    const cw = withWall.find((o) => o.type === 'wall')!;
    const cd = withWall.find((o) => o.type === 'door') as DoorObject;
    expect(cd.wallId).toBe(cw.id);
    expect(cw.id).not.toBe('w');
    expect(cloneTransformed([door], translateSpec(0, 50))).toHaveLength(0);
  });

  it('includes hosted openings and computes offsets/centres', () => {
    const all: ProjectObject[] = [wall, door, sym];
    expect(withHostedObjects(['w'], all)).toEqual(['w', 'd']);
    const ow = offsetWall(wall, 30);
    expect(ow.start.y).toBe(30);
    expect(selectionCenter([wall])).toEqual({ x: 50, y: 0 });
  });
});
