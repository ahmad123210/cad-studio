import { describe, it, expect } from 'vitest';
import { migrateProjectData, CURRENT_SCHEMA_VERSION } from '../../src/model/schema.ts';

const layers = [{ id: 'arch', name: 'A', visible: true, locked: false, color: '#fff' }];

describe('schema migration & validation', () => {
  it('migrates a v1 file and repairs/removes broken objects', () => {
    const { data, report } = migrateProjectData(
      {
        project: { name: 'قديم', unit: 'meter', scale: 50, createdAt: '2025-01-01' },
        layers,
        objects: [
          { id: 'w1', type: 'wall', layerId: 'arch', start: { x: 0, y: 0 }, end: { x: 100, y: 0 }, thickness: 20, rotation: 0 },
          { id: 'w1', type: 'wall', layerId: 'arch', start: { x: 0, y: 0 }, end: { x: 0, y: 100 }, thickness: 20 },
          { id: 'd1', type: 'door', layerId: 'arch', wallId: 'w1', position: 1.7, width: 45 },
          { id: 'd2', type: 'door', layerId: 'arch', wallId: 'ghost', position: 0.5, width: 45 },
          { id: 'bad', type: 'wall', layerId: 'arch', start: { x: 'NaN' }, end: null },
          { id: 's1', type: 'symbol', layerId: 'nope', symbolKind: 'socket_single', x: 1, y: 1 },
          { type: 'spaceship' },
          null,
        ],
      } as any,
      layers as any
    );
    expect(report.fromVersion).toBe(1);
    expect(data.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    const ids = data.objects.map((o) => o.id);
    expect(ids).toContain('w1');
    expect(ids).not.toContain('d2');
    expect(ids).not.toContain('bad');
    expect(new Set(ids).size).toBe(ids.length);
    expect('rotation' in (data.objects[0] as any)).toBe(false);
    expect((data.objects.find((o) => o.id === 'd1') as any).position).toBe(1);
    expect((data.objects.find((o) => o.id === 's1') as any).layerId).toBe('arch');
    expect(data.sheets).toHaveLength(1);
    expect(report.warnings.length).toBeGreaterThanOrEqual(5);
  });

  it('rejects non-project input', () => {
    expect(() => migrateProjectData({ foo: 1 } as any, layers as any)).toThrow();
  });
});
