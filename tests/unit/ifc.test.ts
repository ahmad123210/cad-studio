import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { writeFileSync } from 'node:fs';
import { exportIfc, ifcGuid, ifcStr } from '../../src/engine/export/ifcExport.ts';
import { DEFAULT_QUANTITY_SETTINGS } from '../../src/model/quantitySettings.ts';
import type { ProjectObject } from '../../src/model/types.ts';

const W = (id: string, sx: number, sy: number, ex: number, ey: number, extra: Record<string, unknown> = {}) =>
  ({ id, type: 'wall', layerId: 'arch', start: { x: sx, y: sy }, end: { x: ex, y: ey }, thickness: 20, ...extra }) as unknown as ProjectObject;

export const sampleObjects = [
  W('a', 0, 0, 500, 0), W('b', 500, 0, 500, 400), W('c', 500, 400, 0, 400), W('d', 0, 400, 0, 0),
  W('p', 250, 0, 250, 400, { thickness: 10, height: 2.8 }),
  { id: 'dr', type: 'door', layerId: 'arch', wallId: 'p', position: 0.5, width: 45, openDirection: 'inward_right' },
  { id: 'wn', type: 'window', layerId: 'arch', wallId: 'a', position: 0.25, width: 60, height: 1.2, sillHeight: 1 },
  { id: 'cl', type: 'column', layerId: 'arch', x: 0, y: 0, width: 20, depth: 20, rotation: 0 },
  { id: 'r1', type: 'room', layerId: 'arch', x: 120, y: 200, name: 'صالة', floorType: 'رخام' },
] as unknown as ProjectObject[];

describe('IFC export', () => {
  it('guid and string encoding', () => {
    const g = ifcGuid();
    expect(g).toMatch(/^[0-3][0-9A-Za-z_$]{21}$/);
    expect(ifcStr("صالة's")).toBe("'\\X2\\0635\\X0\\\\X2\\0627\\X0\\\\X2\\0644\\X0\\\\X2\\0629\\X0\\''s'");
  });
  it('writes a STEP file with walls, openings, doors, windows, columns and spaces', () => {
    let seed = 1;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const ifc = exportIfc(sampleObjects, { projectName: 'Test', pixelsPerMeter: 100, quantities: DEFAULT_QUANTITY_SETTINGS, rand, timestamp: '2026-01-01T00:00:00' });
    writeFileSync(join(tmpdir(), 'cad_test.ifc'), ifc);
    const count = (t: string) => (ifc.match(new RegExp(`=${t}\\(`, 'g')) || []).length;
    expect(ifc.startsWith('ISO-10303-21;')).toBe(true);
    expect(count('IFCWALLSTANDARDCASE')).toBe(5);
    expect(count('IFCOPENINGELEMENT')).toBe(2);
    expect(count('IFCRELVOIDSELEMENT')).toBe(2);
    expect(count('IFCDOOR')).toBe(1);
    expect(count('IFCWINDOW')).toBe(1);
    expect(count('IFCCOLUMN')).toBe(1);
    expect(count('IFCSPACE')).toBe(1);
    expect(count('IFCRELASSOCIATESMATERIAL')).toBe(2); // سماكتان
    // الجدار الفاصل بارتفاعه المخصص 2.8م
    expect(ifc).toMatch(/IFCEXTRUDEDAREASOLID\(#\d+,#\d+,#\d+,2\.8\)/);
  });
});
