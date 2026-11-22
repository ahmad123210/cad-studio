/**
 * @file electrical.ts
 * @description حسابات الكهرباء الاسترشادية (دوال صرفة):
 *  - أحمال افتراضية لكل رمز (قابلة للتعديل لكل نقطة)
 *  - الدوائر: الحمل، تيار التصميم، القاطع، مقطع الكابل (نحاس PVC داخل مواسير — طريقة B1 تقريباً)،
 *    الطول التقديري من اللوحة لأبعد نقطة، وهبوط الجهد مقارنة بالحد (3% إنارة، 5% غيرها)
 *  - ملخص اللوحة: الحمل الموصول، حمل الطلب بمعامل الطلب، توزيع الأطوار وعدم التوازن، القاطع الرئيسي
 *  - توليد الدوائر تلقائياً بتجميع النقاط حسب النوع وتوزيعها على الأطوار
 * النتائج استرشادية ويجب أن يراجعها مهندس كهرباء حسب الكود المعتمد.
 */
import type { ProjectObject, SymbolObject, Point } from './types.ts';

export type CircuitKind = 'lighting' | 'sockets' | 'power';
export type Phase = 'L1' | 'L2' | 'L3' | '3P';

export interface Circuit {
  id: string;
  name: string;
  kind: CircuitKind;
  phase: Phase;
  /** معرف رمز لوحة التوزيع (اختياري) */
  panelId?: string;
}

export interface ElectricalSettings {
  supply: '1P' | '3P';
  voltage: number;
  voltage3P: number;
  pf: number;
  demandFactor: number;
  vdLimitLighting: number;
  vdLimitOther: number;
  /** نزول/صعود رأسي يضاف لطول الدائرة (م) */
  verticalM: number;
}

export interface MepData {
  circuits: Circuit[];
  settings: ElectricalSettings;
}

export const DEFAULT_ELECTRICAL_SETTINGS: ElectricalSettings = {
  supply: '3P',
  voltage: 230,
  voltage3P: 400,
  pf: 0.9,
  demandFactor: 0.7,
  vdLimitLighting: 3,
  vdLimitOther: 5,
  verticalM: 3,
};

export const CIRCUIT_KIND_NAMES: Record<CircuitKind, string> = { lighting: 'إنارة', sockets: 'مقابس', power: 'قوى (مخصصة)' };

/** الحمل الافتراضي (واط) ونوع الدائرة المناسب لكل رمز؛ null = ليس حملاً كهربائياً */
const LOADS: Record<string, [number, CircuitKind]> = {
  light_ceiling: [40, 'lighting'],
  spotlight: [12, 'lighting'],
  light_emergency: [10, 'lighting'],
  fan_ceiling: [75, 'lighting'],
  exhaust_fan: [40, 'lighting'],
  sensor_motion: [5, 'lighting'],
  doorbell: [10, 'lighting'],
  camera_cctv: [10, 'sockets'],
  dvr_unit: [30, 'sockets'],
  cctv_monitor: [60, 'sockets'],
  socket_single: [200, 'sockets'],
  socket_double: [300, 'sockets'],
  socket_floor: [200, 'sockets'],
  socket_13a_ceiling: [200, 'sockets'],
  furn_refrigerator: [300, 'sockets'],
  hvac_split_ac: [1800, 'power'],
  hvac_fcu: [150, 'power'],
  hvac_ahu: [3000, 'power'],
  plumb_water_heater: [2500, 'power'],
  plumb_pump: [750, 'power'],
  furn_washing_machine: [2000, 'power'],
  furn_dishwasher: [1800, 'power'],
  furn_oven: [3000, 'power'],
};

export function defaultLoad(kind: string): { w: number; kind: CircuitKind } | null {
  const v = LOADS[kind];
  return v ? { w: v[0], kind: v[1] } : null;
}

export const isPanel = (s: SymbolObject) => s.symbolKind === 'panel_db';

/** نقاط الحمل الكهربائي (رموز لها حمل افتراضي أو حمل مخصص) */
export function loadPoints(objects: ProjectObject[]): SymbolObject[] {
  return objects.filter((o): o is SymbolObject => o.type === 'symbol' && ((o as SymbolObject).loadW !== undefined || defaultLoad((o as SymbolObject).symbolKind) !== null));
}
export const pointLoad = (s: SymbolObject) => s.loadW ?? defaultLoad(s.symbolKind)?.w ?? 0;

export const BREAKERS = [6, 10, 16, 20, 25, 32, 40, 50, 63, 80, 100, 125, 160];
/** مقاطع الكابلات (مم²) وسعتها التقريبية (أمبير) لنحاس PVC، موصلين محمّلين داخل ماسورة */
export const CABLES: [number, number][] = [
  [1.5, 17.5],
  [2.5, 24],
  [4, 32],
  [6, 41],
  [10, 57],
  [16, 76],
  [25, 101],
  [35, 125],
  [50, 151],
];
const RHO = 0.0225; // مقاومة النحاس النوعية عند حرارة التشغيل (أوم·مم²/م)
const MIN_BREAKER: Record<CircuitKind, number> = { lighting: 10, sockets: 16, power: 16 };
const MIN_CABLE: Record<CircuitKind, number> = { lighting: 1.5, sockets: 2.5, power: 2.5 };

export interface CircuitRow {
  circuit: Circuit;
  points: number;
  loadW: number;
  ib: number;
  breaker: number;
  cable: number;
  lengthM: number | null;
  vdPct: number | null;
  vdLimit: number;
  ok: boolean;
  note?: string;
}

export interface PanelSummary {
  connectedW: number;
  demandW: number;
  phaseW: Record<'L1' | 'L2' | 'L3', number>;
  imbalancePct: number;
  mainIb: number;
  mainBreaker: number;
}

export interface ElectricalReport {
  rows: CircuitRow[];
  summary: PanelSummary;
  unassigned: number;
  hasPanel: boolean;
}

const round = (v: number, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

function vdPercent(lengthM: number, ib: number, cable: number, phase: Phase, s: ElectricalSettings): number {
  return phase === '3P' ? ((Math.sqrt(3) * lengthM * ib * RHO) / cable / s.voltage3P) * 100 : ((2 * lengthM * ib * RHO) / cable / s.voltage) * 100;
}

export function computeElectrical(objects: ProjectObject[], mep: MepData, ppm: number): ElectricalReport {
  const s = mep.settings;
  const pts = loadPoints(objects);
  const panels = objects.filter((o): o is SymbolObject => o.type === 'symbol' && isPanel(o as SymbolObject));
  const rows: CircuitRow[] = [];
  const phaseW = { L1: 0, L2: 0, L3: 0 };
  for (const c of mep.circuits) {
    const members = pts.filter((p) => p.circuitId === c.id);
    const loadW = members.reduce((a, p) => a + pointLoad(p), 0);
    const ib = c.phase === '3P' ? loadW / (Math.sqrt(3) * s.voltage3P * s.pf) : loadW / (s.voltage * s.pf);
    const breaker = BREAKERS.find((b) => b >= Math.max(ib, MIN_BREAKER[c.kind])) ?? BREAKERS[BREAKERS.length - 1];
    let cable = (CABLES.find(([mm, iz]) => mm >= MIN_CABLE[c.kind] && iz >= breaker) ?? CABLES[CABLES.length - 1])[0];
    const panel = panels.find((p) => p.id === c.panelId) ?? panels[0];
    let lengthM: number | null = null;
    let vd: number | null = null;
    const vdLimit = c.kind === 'lighting' ? s.vdLimitLighting : s.vdLimitOther;
    let note: string | undefined;
    if (panel && members.length) {
      const far = Math.max(...members.map((m) => Math.abs(m.x - panel.x) + Math.abs(m.y - panel.y)));
      lengthM = round((far / ppm) * 1.1 + s.verticalM, 1);
      vd = vdPercent(lengthM, ib, cable, c.phase, s);
      // كابل أكبر إن تجاوز الهبوط الحد
      while (vd > vdLimit) {
        const next = CABLES.find(([mm]) => mm > cable);
        if (!next) break;
        cable = next[0];
        vd = vdPercent(lengthM, ib, cable, c.phase, s);
        note = 'كُبّر المقطع بسبب هبوط الجهد';
      }
      vd = round(vd, 2);
    } else if (!panel) note = 'أضف لوحة توزيع لحساب الطول والهبوط';
    if (c.phase === '3P') {
      phaseW.L1 += loadW / 3;
      phaseW.L2 += loadW / 3;
      phaseW.L3 += loadW / 3;
    } else phaseW[c.phase] += loadW;
    rows.push({
      circuit: c,
      points: members.length,
      loadW: round(loadW, 0),
      ib: round(ib, 1),
      breaker,
      cable,
      lengthM,
      vdPct: vd,
      vdLimit,
      ok: vd === null || vd <= vdLimit,
      note,
    });
  }
  const connectedW = rows.reduce((a, r) => a + r.loadW, 0);
  const demandW = connectedW * s.demandFactor;
  const pw = [phaseW.L1, phaseW.L2, phaseW.L3];
  const avg = (pw[0] + pw[1] + pw[2]) / 3;
  const imbalancePct = s.supply === '3P' && avg > 0 ? round(((Math.max(...pw) - avg) / avg) * 100, 1) : 0;
  const mainIb =
    s.supply === '3P'
      ? (Math.max(...pw) * s.demandFactor) / (s.voltage * s.pf)
      : demandW / (s.voltage * s.pf);
  return {
    rows,
    summary: {
      connectedW: round(connectedW, 0),
      demandW: round(demandW, 0),
      phaseW: { L1: round(phaseW.L1, 0), L2: round(phaseW.L2, 0), L3: round(phaseW.L3, 0) },
      imbalancePct,
      mainIb: round(mainIb, 1),
      mainBreaker: BREAKERS.find((b) => b >= Math.max(32, mainIb)) ?? 160,
    },
    unassigned: pts.filter((p) => !p.circuitId || !mep.circuits.some((c) => c.id === p.circuitId)).length,
    hasPanel: panels.length > 0,
  };
}

const MAX_POINTS: Record<CircuitKind, number> = { lighting: 10, sockets: 8, power: 1 };

/**
 * توليد الدوائر للنقاط غير المسندة: تجميع حسب النوع، ثم ترتيب مكاني (شرائح أفقية) وتقسيم حسب الحد الأقصى للنقاط،
 * وتوزيع الأطوار بالأقل حملاً. يعيد الدوائر الجديدة وإسناد النقاط.
 */
export function autoCircuits(objects: ProjectObject[], mep: MepData, ppm: number): { circuits: Circuit[]; assign: { id: string; circuitId: string }[] } {
  const known = new Set(mep.circuits.map((c) => c.id));
  const free = loadPoints(objects).filter((p) => !p.circuitId || !known.has(p.circuitId));
  const panel = objects.find((o): o is SymbolObject => o.type === 'symbol' && isPanel(o as SymbolObject));
  const phaseW: Record<'L1' | 'L2' | 'L3', number> = { L1: 0, L2: 0, L3: 0 };
  for (const c of mep.circuits) {
    if (c.phase === '3P') continue;
    phaseW[c.phase] += loadPoints(objects).filter((p) => p.circuitId === c.id).reduce((a, p) => a + pointLoad(p), 0);
  }
  const next = { lighting: 0, sockets: 0, power: 0 };
  for (const c of mep.circuits) next[c.kind]++;
  const prefix: Record<CircuitKind, string> = { lighting: 'L', sockets: 'S', power: 'P' };
  const band = 4 * ppm; // شرائح بعرض 4م لترتيب متقارب مكانياً
  const circuits: Circuit[] = [];
  const assign: { id: string; circuitId: string }[] = [];
  const chunks: { circuit: Circuit; load: number }[] = [];
  for (const kind of ['lighting', 'sockets', 'power'] as CircuitKind[]) {
    const list = free
      .filter((p) => (defaultLoad(p.symbolKind)?.kind ?? 'sockets') === kind)
      .sort((a, b) => Math.floor(a.y / band) - Math.floor(b.y / band) || (Math.floor(a.y / band) % 2 ? b.x - a.x : a.x - b.x));
    for (let i = 0; i < list.length; i += MAX_POINTS[kind]) {
      const chunk = list.slice(i, i + MAX_POINTS[kind]);
      const id = `cct_${Date.now().toString(36)}_${kind}_${i}`;
      const circuit: Circuit = { id, name: `${prefix[kind]}${++next[kind]}`, kind, phase: 'L1', panelId: panel?.id };
      circuits.push(circuit);
      chunks.push({ circuit, load: chunk.reduce((a, p) => a + pointLoad(p), 0) });
      chunk.forEach((p) => assign.push({ id: p.id, circuitId: id }));
    }
  }
  // توزيع الأطوار: الأثقل أولاً على الطور الأقل حملاً (يقلل عدم التوازن)
  if (mep.settings.supply === '3P') {
    for (const ch of [...chunks].sort((a, b) => b.load - a.load)) {
      const ph = (Object.entries(phaseW).sort((a, b) => a[1] - b[1])[0][0]) as 'L1' | 'L2' | 'L3';
      ch.circuit.phase = ph;
      phaseW[ph] += ch.load;
    }
  }
  return { circuits, assign };
}

export function sanitizeMep(raw: unknown): MepData {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<MepData>;
  const circuits = Array.isArray(r.circuits)
    ? r.circuits.filter((c): c is Circuit => !!c && typeof c.id === 'string' && typeof c.name === 'string').map((c) => ({
        id: c.id,
        name: c.name,
        kind: (['lighting', 'sockets', 'power'] as CircuitKind[]).includes(c.kind) ? c.kind : 'sockets',
        phase: (['L1', 'L2', 'L3', '3P'] as Phase[]).includes(c.phase) ? c.phase : 'L1',
        panelId: typeof c.panelId === 'string' ? c.panelId : undefined,
      }))
    : [];
  const s = { ...DEFAULT_ELECTRICAL_SETTINGS, ...(r.settings || {}) } as ElectricalSettings;
  const num = (v: unknown, d: number, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : d);
  return {
    circuits,
    settings: {
      supply: s.supply === '1P' ? '1P' : '3P',
      voltage: num(s.voltage, 230, 100, 480),
      voltage3P: num(s.voltage3P, 400, 200, 690),
      pf: num(s.pf, 0.9, 0.5, 1),
      demandFactor: num(s.demandFactor, 0.7, 0.1, 1),
      vdLimitLighting: num(s.vdLimitLighting, 3, 0.5, 10),
      vdLimitOther: num(s.vdLimitOther, 5, 0.5, 10),
      verticalM: num(s.verticalM, 3, 0, 50),
    },
  };
}

export type { Point };
