/**
 * @file MepModal.tsx
 * @description نافذة حسابات التمديدات (استرشادية): الكهرباء (الدوائر وجدول اللوحة والأحمال والكابلات وهبوط الجهد)،
 * والمياه والصرف، والتعارضات. الحسابات في model/electrical.ts و model/plumbing.ts و model/clashes.ts.
 */
import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { X, Zap, Droplet, AlertTriangle, Wand2, Plus, Trash2, Crosshair, Calculator, FileSpreadsheet } from 'lucide-react';
import type { ProjectModel } from '../model/project.ts';
import type { CadEngine } from '../engine/renderer.ts';
import {
  computeElectrical,
  autoCircuits,
  loadPoints,
  CIRCUIT_KIND_NAMES,
  type Circuit,
  type CircuitKind,
  type Phase,
  type MepData,
  type ElectricalSettings,
} from '../model/electrical.ts';
import { computePlumbing } from '../model/plumbing.ts';
import { detectClashes } from '../model/clashes.ts';
import { getSymbolById } from '../symbols/registry.ts';

interface MepModalProps {
  model: ProjectModel;
  engine: CadEngine | null;
  isOpen: boolean;
  onClose: () => void;
  onExportExcel?: () => void;
}

type Tab = 'electrical' | 'plumbing' | 'clashes';

const fmt = (v: number | null | undefined, d = 2) => (v === null || v === undefined ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }));
const kw = (w: number) => fmt(w / 1000, 2);

const Setting: React.FC<{ label: string; value: number; step?: number; unit?: string; onCommit: (v: number) => void }> = ({ label, value, step = 0.05, unit, onCommit }) => (
  <label className="flex items-center gap-1.5 text-xs text-neutral-300">
    <span>{label}</span>
    <input
      type="number"
      step={step}
      key={value}
      defaultValue={value}
      onBlur={(e) => {
        const v = parseFloat(e.target.value);
        if (Number.isFinite(v) && v !== value) onCommit(v);
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className="w-16 bg-neutral-800 border border-neutral-700 rounded px-1.5 py-0.5 font-mono-cad text-center outline-none focus:border-amber-500"
    />
    {unit && <span className="text-neutral-500">{unit}</span>}
  </label>
);

export const MepModal: React.FC<MepModalProps> = ({ model, engine, isOpen, onClose, onExportExcel }) => {
  const [tab, setTab] = useState<Tab>('electrical');
  const version = useSyncExternalStore((cb) => model.subscribe(() => cb()), () => model.getVersion());
  const ppm = model.getMeta().scale || 50;
  const data = useMemo(() => {
    if (!isOpen) return null;
    const objects = model.getObjects();
    const mep = model.getMep();
    return {
      objects,
      mep,
      elec: computeElectrical(objects, mep, ppm),
      plumb: computePlumbing(objects, ppm),
      clashes: detectClashes(objects, ppm),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, version, ppm]);

  if (!isOpen || !data) return null;
  const { mep, elec, plumb, clashes } = data;
  const setMep = (patch: Partial<MepData>) => model.setMep({ ...mep, ...patch });
  const setSettings = (patch: Partial<ElectricalSettings>) => setMep({ settings: { ...mep.settings, ...patch } });
  const updateCircuit = (id: string, patch: Partial<Circuit>) => setMep({ circuits: mep.circuits.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

  const runAuto = () => {
    const { circuits, assign } = autoCircuits(data.objects, mep, ppm);
    if (!circuits.length) {
      alert('كل نقاط الأحمال مسندة إلى دوائر بالفعل.');
      return;
    }
    setMep({ circuits: [...mep.circuits, ...circuits] });
    model.applyEdits({ updates: assign.map((a) => ({ id: a.id, after: { circuitId: a.circuitId } })), adds: [], deletes: [] }, `توليد ${circuits.length} دائرة كهربائية`);
  };
  const removeCircuit = (id: string) => {
    const pts = loadPoints(model.getObjects()).filter((p) => p.circuitId === id);
    setMep({ circuits: mep.circuits.filter((c) => c.id !== id) });
    if (pts.length) model.applyEdits({ updates: pts.map((p) => ({ id: p.id, after: { circuitId: undefined } })), adds: [], deletes: [] }, 'حذف دائرة');
  };
  const clearAll = () => {
    if (!confirm('حذف كل الدوائر وإلغاء إسناد النقاط؟')) return;
    const pts = loadPoints(model.getObjects()).filter((p) => p.circuitId);
    setMep({ circuits: [] });
    if (pts.length) model.applyEdits({ updates: pts.map((p) => ({ id: p.id, after: { circuitId: undefined } })), adds: [], deletes: [] }, 'حذف كل الدوائر');
  };
  const addCircuit = () => {
    const n = mep.circuits.length + 1;
    setMep({ circuits: [...mep.circuits, { id: `cct_${Date.now().toString(36)}`, name: `C${n}`, kind: 'sockets', phase: 'L1' }] });
  };
  const selectIds = (ids: string[]) => {
    if (!engine || !ids.length) return;
    engine.selectObjects(ids);
    onClose();
  };

  const th = 'py-2 px-2 font-semibold whitespace-nowrap';
  const td = 'py-1.5 px-2 whitespace-nowrap';
  const sel = 'bg-neutral-800 border border-neutral-700 rounded px-1 py-0.5 text-xs outline-none';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" data-testid="mep-modal">
      <div className="w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col bg-neutral-900 border border-neutral-800 rounded-2xl text-neutral-200">
        <div className="px-5 py-3.5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/80">
          <h3 className="font-bold text-white flex items-center gap-2">
            <Calculator size={18} className="text-amber-400" /> حسابات التمديدات
          </h3>
          <div className="flex items-center gap-2">
            {onExportExcel && tab === 'electrical' && mep.circuits.length > 0 && (
              <button onClick={onExportExcel} className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs flex items-center gap-1.5">
                <FileSpreadsheet size={14} /> جدول اللوحة Excel
              </button>
            )}
            <button onClick={onClose} aria-label="إغلاق" className="w-8 h-8 rounded-lg hover:bg-neutral-800 flex items-center justify-center text-neutral-400">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="px-5 py-2 text-[11px] text-amber-200 bg-amber-950/30 border-b border-amber-900/50 flex items-center gap-2" data-testid="mep-disclaimer">
          <AlertTriangle size={14} className="shrink-0" />
          نتائج هذه النافذة استرشادية ولا يُعتمد عليها إلا بعد مراجعة المهندس المختص وحسب الكود المعتمد. القيم الافتراضية قابلة للتعديل.
        </div>
        <div className="px-5 pt-2 border-b border-neutral-800 flex gap-1">
          {([
            ['electrical', 'الكهرباء', Zap, mep.circuits.length],
            ['plumbing', 'المياه والصرف', Droplet, plumb.fixtures.length],
            ['clashes', 'التعارضات', AlertTriangle, clashes.length],
          ] as const).map(([id, label, Icon, n]) => (
            <button key={id} onClick={() => setTab(id)} className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg border-b-2 flex items-center gap-1.5 ${tab === id ? 'border-amber-400 text-white bg-neutral-800/60' : 'border-transparent text-neutral-400 hover:text-white'}`}>
              <Icon size={13} /> {label} <span className="text-neutral-500 font-mono-cad">({n})</span>
            </button>
          ))}
        </div>

        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-4">
          {tab === 'electrical' && (
            <>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <label className="flex items-center gap-1.5 text-xs text-neutral-300">
                  <span>التغذية</span>
                  <select value={mep.settings.supply} onChange={(e) => setSettings({ supply: e.target.value as '1P' | '3P' })} className={sel} data-testid="mep-supply">
                    <option value="3P">ثلاثي الطور 400 فولت</option>
                    <option value="1P">أحادي الطور 230 فولت</option>
                  </select>
                </label>
                <Setting label="معامل الطلب" value={mep.settings.demandFactor} onCommit={(v) => setSettings({ demandFactor: v })} />
                <Setting label="حد الهبوط للإنارة" unit="%" step={0.5} value={mep.settings.vdLimitLighting} onCommit={(v) => setSettings({ vdLimitLighting: v })} />
                <Setting label="لغيرها" unit="%" step={0.5} value={mep.settings.vdLimitOther} onCommit={(v) => setSettings({ vdLimitOther: v })} />
                <Setting label="الرأسي لكل دائرة" unit="م" step={0.5} value={mep.settings.verticalM} onCommit={(v) => setSettings({ verticalM: v })} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-2" data-testid="mep-summary">
                {[
                  ['الحمل الموصول', `${kw(elec.summary.connectedW)} ك.و`],
                  ['حمل الطلب', `${kw(elec.summary.demandW)} ك.و`],
                  ['الأطوار L1 / L2 / L3', `${kw(elec.summary.phaseW.L1)} / ${kw(elec.summary.phaseW.L2)} / ${kw(elec.summary.phaseW.L3)}`],
                  ['عدم التوازن', `${fmt(elec.summary.imbalancePct, 1)} %`],
                  ['القاطع الرئيسي المقترح', `${elec.summary.mainBreaker} أمبير`],
                ].map(([l, v]) => (
                  <div key={l} className="bg-neutral-950/50 border border-neutral-800 rounded-xl p-2.5">
                    <div className="text-[10px] text-neutral-400">{l}</div>
                    <div className="font-mono-cad text-sm text-amber-300 mt-0.5">{v}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button onClick={runAuto} data-testid="mep-auto" className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5">
                  <Wand2 size={14} /> توليد الدوائر تلقائياً
                </button>
                <button onClick={addCircuit} className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-xs flex items-center gap-1.5">
                  <Plus size={14} /> دائرة يدوية
                </button>
                {mep.circuits.length > 0 && (
                  <button onClick={clearAll} className="px-3 py-1.5 rounded-lg text-rose-300 hover:bg-rose-950/40 text-xs">
                    حذف كل الدوائر
                  </button>
                )}
                {elec.unassigned > 0 && <span className="text-xs text-amber-300">{elec.unassigned} نقطة حمل غير مسندة لدائرة</span>}
                {!elec.hasPanel && <span className="text-xs text-neutral-400">أضف رمز «لوحة توزيع» لحساب أطوال الدوائر وهبوط الجهد.</span>}
              </div>

              {mep.circuits.length === 0 ? (
                <div className="py-8 text-center text-neutral-500 text-sm">لا توجد دوائر. اضغط «توليد الدوائر تلقائياً» أو أسند النقاط من لوحة خصائص الرمز.</div>
              ) : (
                <div className="overflow-x-auto border border-neutral-800 rounded-xl">
                  <table className="w-full text-right text-xs" data-testid="panel-schedule">
                    <thead className="bg-neutral-900 text-neutral-400 border-b border-neutral-800">
                      <tr>
                        <th className={th}>الدائرة</th>
                        <th className={th}>النوع</th>
                        <th className={th}>الطور</th>
                        <th className={`${th} text-center`}>النقاط</th>
                        <th className={`${th} text-center`}>الحمل (واط)</th>
                        <th className={`${th} text-center`}>التيار (أ)</th>
                        <th className={`${th} text-center`}>القاطع (أ)</th>
                        <th className={`${th} text-center`}>الكابل (مم²)</th>
                        <th className={`${th} text-center`}>الطول التقديري (م)</th>
                        <th className={`${th} text-center`}>هبوط الجهد</th>
                        <th className={th}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {elec.rows.map((r) => (
                        <tr key={r.circuit.id} className="border-t border-neutral-800/60" data-circuit={r.circuit.name}>
                          <td className={td}>
                            <input
                              key={r.circuit.name}
                              defaultValue={r.circuit.name}
                              onBlur={(e) => e.target.value.trim() && e.target.value !== r.circuit.name && updateCircuit(r.circuit.id, { name: e.target.value.trim() })}
                              className="w-16 bg-transparent border border-neutral-700/60 rounded px-1 py-0.5 font-mono-cad"
                            />
                          </td>
                          <td className={td}>
                            <select value={r.circuit.kind} onChange={(e) => updateCircuit(r.circuit.id, { kind: e.target.value as CircuitKind })} className={sel}>
                              {(Object.keys(CIRCUIT_KIND_NAMES) as CircuitKind[]).map((k) => (
                                <option key={k} value={k}>{CIRCUIT_KIND_NAMES[k]}</option>
                              ))}
                            </select>
                          </td>
                          <td className={td}>
                            <select value={r.circuit.phase} onChange={(e) => updateCircuit(r.circuit.id, { phase: e.target.value as Phase })} className={sel}>
                              {(mep.settings.supply === '1P' ? ['L1'] : ['L1', 'L2', 'L3', '3P']).map((p) => (
                                <option key={p} value={p}>{p === '3P' ? 'ثلاثي' : p}</option>
                              ))}
                            </select>
                          </td>
                          <td className={`${td} text-center font-mono-cad`}>{r.points}</td>
                          <td className={`${td} text-center font-mono-cad`}>{r.loadW}</td>
                          <td className={`${td} text-center font-mono-cad`}>{fmt(r.ib, 1)}</td>
                          <td className={`${td} text-center font-mono-cad text-amber-300`}>{r.breaker}</td>
                          <td className={`${td} text-center font-mono-cad text-sky-300`}>{r.cable}</td>
                          <td className={`${td} text-center font-mono-cad`}>{fmt(r.lengthM, 1)}</td>
                          <td className={`${td} text-center font-mono-cad ${r.ok ? 'text-emerald-300' : 'text-rose-300'}`} title={r.note}>
                            {r.vdPct === null ? '—' : `${fmt(r.vdPct, 2)}%`}
                            {r.vdPct !== null && <span className="text-[9px] text-neutral-500 font-sans mr-1">(الحد {r.vdLimit}%)</span>}
                            {r.note && <div className="text-[9px] text-neutral-500 font-sans">{r.note}</div>}
                          </td>
                          <td className={`${td} flex items-center gap-1`}>
                            <button title="تحديد نقاط الدائرة على المخطط" onClick={() => selectIds(loadPoints(model.getObjects()).filter((p) => p.circuitId === r.circuit.id).map((p) => p.id))} className="p-1 rounded hover:bg-neutral-800 text-neutral-400">
                              <Crosshair size={13} />
                            </button>
                            <button title="حذف الدائرة" onClick={() => removeCircuit(r.circuit.id)} className="p-1 rounded hover:bg-neutral-800 text-rose-300">
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-[11px] text-neutral-500">
                الكابلات: نحاس PVC داخل مواسير، والسعات تقريبية. الطول التقديري = أبعد نقطة عن اللوحة (مسار متعامد) × 1.1 + الرأسي. الأحمال الافتراضية: إنارة 40 واط، مقبس 200–300 واط، مكيف 1800 واط... ويمكن تعديل حمل أي نقطة من خصائصها.
              </p>
            </>
          )}

          {tab === 'plumbing' && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2" data-testid="plumb-summary">
                {[
                  ['وحدات التغذية (WSFU)', fmt(plumb.totals.wsfu, 1)],
                  ['التدفق التصميمي', `${fmt(plumb.totals.flowLps, 2)} ل/ث`],
                  ['ماسورة التغذية الرئيسية المقترحة', plumb.totals.supplyMain],
                  ['وحدات الصرف (DFU) / المجمع', `${fmt(plumb.totals.dfu, 0)} / ${plumb.totals.drainMain}`],
                ].map(([l, v]) => (
                  <div key={l} className="bg-neutral-950/50 border border-neutral-800 rounded-xl p-2.5">
                    <div className="text-[10px] text-neutral-400">{l}</div>
                    <div className="font-mono-cad text-sm text-sky-300 mt-0.5">{v}</div>
                  </div>
                ))}
              </div>
              {plumb.fixtures.length === 0 ? (
                <div className="py-6 text-center text-neutral-500 text-sm">لا توجد أدوات صحية (مرحاض، مغسلة، دش، مطبخ...) في المخطط.</div>
              ) : (
                <table className="w-full text-right text-xs border border-neutral-800 rounded-xl overflow-hidden">
                  <thead className="bg-neutral-900 text-neutral-400">
                    <tr>
                      <th className={th}>الأداة</th>
                      <th className={`${th} text-center`}>العدد</th>
                      <th className={`${th} text-center`}>WSFU للواحدة</th>
                      <th className={`${th} text-center`}>DFU للواحدة</th>
                      <th className={`${th} text-center`}>تغذية الفرع</th>
                      <th className={`${th} text-center`}>صرف الأداة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plumb.fixtures.map((f) => (
                      <tr key={f.kind} className="border-t border-neutral-800/60">
                        <td className={td}>{getSymbolById(f.kind)?.name || f.kind}</td>
                        <td className={`${td} text-center font-mono-cad`}>{f.count}</td>
                        <td className={`${td} text-center font-mono-cad`}>{f.wsfu}</td>
                        <td className={`${td} text-center font-mono-cad`}>{f.dfu}</td>
                        <td className={`${td} text-center font-mono-cad`}>{f.branchSupply}</td>
                        <td className={`${td} text-center font-mono-cad`}>{f.trapDrain}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <h4 className="text-xs font-bold text-neutral-300 mt-2">ميول خطوط الصرف</h4>
              {plumb.drains.length === 0 ? (
                <div className="text-xs text-neutral-500">لا توجد مسارات صرف مرسومة.</div>
              ) : (
                <table className="w-full text-right text-xs border border-neutral-800 rounded-xl overflow-hidden" data-testid="drain-slopes">
                  <thead className="bg-neutral-900 text-neutral-400">
                    <tr>
                      <th className={th}>المسار</th>
                      <th className={`${th} text-center`}>القطر (مم)</th>
                      <th className={`${th} text-center`}>الطول (م)</th>
                      <th className={`${th} text-center`}>الميل الأدنى</th>
                      <th className={`${th} text-center`}>فرق المنسوب (سم)</th>
                      <th className={th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {plumb.drains.map((d, i) => (
                      <tr key={d.id} className="border-t border-neutral-800/60">
                        <td className={td}>{d.label || `خط صرف ${i + 1}`}</td>
                        <td className={`${td} text-center font-mono-cad ${d.undersized ? 'text-rose-300' : ''}`} title={d.undersized ? 'أصغر من القطر الأدنى لخط يخدم مرحاضاً (110 مم)' : undefined}>
                          {d.diameter}
                        </td>
                        <td className={`${td} text-center font-mono-cad`}>{fmt(d.lengthM, 2)}</td>
                        <td className={`${td} text-center font-mono-cad`}>{d.slopePct}%</td>
                        <td className={`${td} text-center font-mono-cad text-sky-300`}>{fmt(d.dropCm, 1)}</td>
                        <td className={td}>
                          <button title="تحديد المسار" onClick={() => selectIds([d.id])} className="p-1 rounded hover:bg-neutral-800 text-neutral-400">
                            <Crosshair size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="text-[11px] text-neutral-500">
                الوحدات وفق القيم الشائعة (مرحاض بخزان 2.5 تغذية / 4 صرف، مغسلة 1/1، دش 2/2...). التدفق من منحنى هنتر التقريبي، وقطر التغذية بسرعة لا تتجاوز 2.5 م/ث لمواسير PPR. الميل الأدنى 2% للأقطار حتى 75 مم و1% لما فوقها.
              </p>
            </>
          )}

          {tab === 'clashes' &&
            (clashes.length === 0 ? (
              <div className="py-10 text-center text-emerald-300 text-sm" data-testid="no-clashes">لا توجد تعارضات بين المسارات والفتحات والأعمدة والمسارات الأخرى.</div>
            ) : (
              <table className="w-full text-right text-xs border border-neutral-800 rounded-xl overflow-hidden" data-testid="clashes-table">
                <thead className="bg-neutral-900 text-neutral-400">
                  <tr>
                    <th className={th}>النوع</th>
                    <th className={th}>الوصف</th>
                    <th className={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {clashes.map((c, i) => (
                    <tr key={i} className="border-t border-neutral-800/60">
                      <td className={`${td} ${c.severity === 'error' ? 'text-rose-300' : 'text-amber-300'}`}>{c.severity === 'error' ? 'تعارض' : 'للمراجعة'}</td>
                      <td className={td} style={{ whiteSpace: 'normal' }}>{c.message}</td>
                      <td className={td}>
                        <button onClick={() => selectIds(c.ids)} className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 flex items-center gap-1">
                          <Crosshair size={12} /> تحديد
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
        </div>
      </div>
    </div>
  );
};
