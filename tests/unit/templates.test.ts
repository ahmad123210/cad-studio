import { describe, it, expect } from 'vitest';
import { buildTemplateProject, PROJECT_TEMPLATES } from '../../src/model/templates.ts';
import { buildRoomGraph, findRoomAt, isRoomWall } from '../../src/model/rooms.ts';
import { computeQuantities } from '../../src/model/quantities.ts';
import { DEFAULT_QUANTITY_SETTINGS } from '../../src/model/quantitySettings.ts';
import { migrateProjectData } from '../../src/model/schema.ts';
import type { ProjectObject, WallObject, DoorObject, WindowObject, RoomObject } from '../../src/model/types.ts';

const layers = [{ id: 'arch', name: 'arch', visible: true, locked: false, color: '#fff', isDefault: true }];

describe('project templates', () => {
  for (const tpl of PROJECT_TEMPLATES.filter((t) => t.id !== 'empty')) {
    it(`${tpl.id}: every room card sits in its own closed room, openings fit their walls`, () => {
      const data = buildTemplateProject(tpl.id, layers, 50);
      const objs = data.objects as ProjectObject[];
      const walls = objs.filter((o) => o.type === 'wall') as WallObject[];
      const graph = buildRoomGraph(walls.filter(isRoomWall));
      const cards = objs.filter((o) => o.type === 'room') as RoomObject[];
      expect(graph.rooms.length).toBe(cards.length);
      const hit = new Set<number>();
      for (const c of cards) {
        const room = findRoomAt(graph, { x: c.x, y: c.y });
        expect(room, c.name).not.toBeNull();
        hit.add(graph.rooms.indexOf(room!));
      }
      expect(hit.size).toBe(cards.length);

      const byId = new Map(walls.map((w) => [w.id, w]));
      for (const o of objs.filter((x) => x.type === 'door' || x.type === 'window') as Array<DoorObject | WindowObject>) {
        const w = byId.get(o.wallId)!;
        expect(w, o.id).toBeTruthy();
        const len = Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y);
        const centre = o.position * len;
        expect(centre - o.width / 2, o.id).toBeGreaterThan(w.thickness / 2);
        expect(centre + o.width / 2, o.id).toBeLessThan(len - w.thickness / 2);
      }

      const q = computeQuantities(objs, { pixelsPerMeter: 50, settings: DEFAULT_QUANTITY_SETTINGS });
      expect(q.warnings.filter((w) => w.includes('بلا بطاقة'))).toHaveLength(0);
      expect(q.totals.roomCount).toBe(cards.length);

      // يمر بالتحقق كما لو فُتح من ملف
      const { data: clean } = migrateProjectData(JSON.parse(JSON.stringify(data)), layers);
      expect(clean.objects.length).toBe(objs.length);
    });
  }

  it('villa fence is detailed and its gates are deducted', () => {
    const objs = buildTemplateProject('villa', layers, 50).objects as ProjectObject[];
    const q = computeQuantities(objs, { pixelsPerMeter: 50, settings: DEFAULT_QUANTITY_SETTINGS });
    expect(q.fence.length).toBe(4);
    expect(q.lines.find((l) => l.key.startsWith('fence'))).toBeTruthy();
  });
});
