import { describe, it, expect } from 'vitest';
import { groupMembers, expandGroups } from '../../src/engine/interaction/selection.ts';
import { migrateProjectData } from '../../src/model/schema.ts';
import { DEFAULT_LAYERS } from '../../src/model/project.ts';
import { cloneTransformed } from '../../src/model/transforms.ts';
import type { ProjectObject } from '../../src/model/types.ts';

const o = (id: string, groupId?: string) => ({ id, type: 'text', layerId: 'arch', x: 0, y: 0, text: id, groupId }) as unknown as ProjectObject;

describe('groups (phase 20)', () => {
  it('a member expands to its whole group; ungrouped items stay single', () => {
    const objs = [o('a', 'g1'), o('b', 'g1'), o('c'), o('d', 'g2'), o('e', null as unknown as string)];
    expect(groupMembers(objs, 'a').sort()).toEqual(['a', 'b']);
    expect(groupMembers(objs, 'c')).toEqual(['c']);
    expect(groupMembers(objs, 'e')).toEqual(['e']);
    expect(expandGroups(objs, ['b', 'c', 'd']).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('copies of a group become a new, separate group', () => {
    const objs = [o('a', 'g1'), o('b', 'g1')];
    const copies = cloneTransformed(objs, { map: (p) => ({ x: p.x + 10, y: p.y }), rotateDeg: 0, mirrorAxisDeg: null, scale: 1 });
    expect(copies[0].groupId).toBeTruthy();
    expect(copies[0].groupId).toBe(copies[1].groupId);
    expect(copies[0].groupId).not.toBe('g1');
  });
});

describe('furniture layer migration (phase 20)', () => {
  it('adds the furniture layer after the architectural one and moves furniture symbols to it', () => {
    const raw = {
      project: { name: 'p', unit: 'meter', scale: 50, createdAt: '2026-01-01' },
      layers: [
        { id: 'arch', name: 'arch', visible: true, locked: false, color: '#fff' },
        { id: 'elec', name: 'elec', visible: true, locked: false, color: '#ff0' },
      ],
      objects: [
        { id: 'bed', type: 'symbol', layerId: 'arch', symbolKind: 'furn_bed_double', x: 0, y: 0, rotation: 0 },
        { id: 'sofa', type: 'symbol', layerId: 'elec', symbolKind: 'furn_sofa_3seat', x: 0, y: 0, rotation: 0 },
        { id: 'sk', type: 'symbol', layerId: 'arch', symbolKind: 'socket_single', x: 0, y: 0, rotation: 0 },
      ],
    };
    const { data } = migrateProjectData(raw, DEFAULT_LAYERS);
    expect(data.layers.map((l) => l.id)).toEqual(['arch', 'furn', 'elec']);
    const byId = Object.fromEntries(data.objects.map((x) => [x.id, x.layerId]));
    expect(byId).toEqual({ bed: 'furn', sofa: 'elec', sk: 'arch' }); // ما وضعه المستخدم على طبقة أخرى يبقى
    // ملف جديد فيه الطبقة أصلاً: لا تغيير
    const again = migrateProjectData(JSON.parse(JSON.stringify(data)), DEFAULT_LAYERS).data;
    expect(again.layers.map((l) => l.id)).toEqual(['arch', 'furn', 'elec']);
  });
});
