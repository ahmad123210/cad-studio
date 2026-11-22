import { describe, it, expect } from 'vitest';
import { computeElectrical, autoCircuits, DEFAULT_ELECTRICAL_SETTINGS, type MepData } from '../../src/model/electrical.ts';
import type { ProjectObject } from '../../src/model/types.ts';

const sym = (id: string, kind: string, x: number, y: number, extra: Record<string, unknown> = {}) =>
  ({ id, type: 'symbol', layerId: 'elec', symbolKind: kind, x, y, rotation: 0, ...extra }) as unknown as ProjectObject;
const PPM = 50;

describe('electrical calculations', () => {
  it('circuit load, design current, breaker, cable and voltage drop', () => {
    const objs = [
      sym('db', 'panel_db', 0, 0),
      ...Array.from({ length: 8 }, (_, i) => sym(`s${i}`, 'socket_single', 200 + i * 50, 0, { circuitId: 'c1' })),
    ];
    const mep: MepData = { circuits: [{ id: 'c1', name: 'S1', kind: 'sockets', phase: 'L1', panelId: 'db' }], settings: DEFAULT_ELECTRICAL_SETTINGS };
    const r = computeElectrical(objs, mep, PPM);
    const row = r.rows[0];
    expect(row.points).toBe(8);
    expect(row.loadW).toBe(1600);
    expect(row.ib).toBeCloseTo(1600 / (230 * 0.9), 1); // 7.7A
    expect(row.breaker).toBe(16); // الحد الأدنى لدوائر المقابس
    expect(row.cable).toBe(2.5);
    // أبعد نقطة 550 بكسل = 11م ← 11×1.1 + 3 = 15.1م
    expect(row.lengthM).toBeCloseTo(15.1, 1);
    expect(row.vdPct).toBeCloseTo(((2 * 15.1 * 7.73 * 0.0225) / 2.5 / 230) * 100, 1);
    expect(row.ok).toBe(true);
    expect(r.unassigned).toBe(0);
  });

  it('upsizes the cable when the voltage drop exceeds the limit', () => {
    const objs = [sym('db', 'panel_db', 0, 0), sym('h', 'plumb_water_heater', 3000, 0, { circuitId: 'c1' })]; // 60م
    const mep: MepData = { circuits: [{ id: 'c1', name: 'P1', kind: 'power', phase: 'L1', panelId: 'db' }], settings: DEFAULT_ELECTRICAL_SETTINGS };
    const row = computeElectrical(objs, mep, PPM).rows[0];
    expect(row.cable).toBeGreaterThan(2.5);
    expect(row.vdPct!).toBeLessThanOrEqual(5);
    expect(row.note).toMatch(/هبوط/);
  });

  it('auto circuits group by type, respect max points and balance phases; custom load overrides', () => {
    const objs = [
      sym('db', 'panel_db', 0, 0),
      ...Array.from({ length: 12 }, (_, i) => sym(`l${i}`, 'light_ceiling', i * 40, 100)),
      ...Array.from({ length: 9 }, (_, i) => sym(`s${i}`, 'socket_double', i * 40, 300)),
      sym('ac1', 'hvac_split_ac', 0, 500),
      sym('ac2', 'hvac_split_ac', 100, 500, { loadW: 2400 }),
      sym('sw', 'switch_single', 0, 50),
    ];
    const mep: MepData = { circuits: [], settings: DEFAULT_ELECTRICAL_SETTINGS };
    const { circuits, assign } = autoCircuits(objs, mep, PPM);
    expect(circuits.map((c) => c.name)).toEqual(['L1', 'L2', 'S1', 'S2', 'P1', 'P2']);
    expect(assign).toHaveLength(12 + 9 + 2); // المفتاح ليس حملاً
    const after = objs.map((o) => {
      const a = assign.find((x) => x.id === o.id);
      return a ? ({ ...o, circuitId: a.circuitId } as ProjectObject) : o;
    });
    const r = computeElectrical(after, { circuits, settings: DEFAULT_ELECTRICAL_SETTINGS }, PPM);
    expect(r.summary.connectedW).toBe(12 * 40 + 9 * 300 + 1800 + 2400);
    expect(r.summary.imbalancePct).toBeLessThan(60);
    expect(new Set(circuits.map((c) => c.phase)).size).toBe(3);
  });
});
