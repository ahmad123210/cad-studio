/**
 * @file StructureProperties.tsx
 * @description لوحتا خصائص العمود والدرج.
 */
import React from 'react';
import { Trash2, PanelRightClose, Square, Footprints, ArrowLeftRight } from 'lucide-react';
import type { ColumnObject, StairObject } from '../../model/types.ts';
import { stairsGeometry, DEFAULT_TREAD, DEFAULT_RISER } from '../../model/stairs.ts';
import type { PanelContext } from './context.ts';

const field = 'w-24 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 font-mono-cad text-neutral-200 outline-none text-center focus:border-sky-500';

/** حقل رقمي يحفظ عند الخروج أو Enter */
const NumField: React.FC<{ label: string; value: number; unit: string; step?: number; min?: number; onCommit: (v: number) => void; testId?: string }> = ({ label, value, unit, step = 0.01, min = 0.01, onCommit, testId }) => (
  <label className="flex items-center justify-between gap-2 text-xs">
    <span className="text-neutral-300 font-semibold">{label}</span>
    <span className="flex items-center gap-1">
      <input
        type="number"
        data-testid={testId}
        step={step}
        min={min}
        key={value}
        defaultValue={value}
        onBlur={(e) => {
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v) && v >= min && v !== value) onCommit(v);
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        className={field}
      />
      <span className="text-neutral-500 w-6">{unit}</span>
    </span>
  </label>
);

const Header: React.FC<{ title: string; icon: React.ReactNode; ctx: PanelContext }> = ({ title, icon, ctx }) => (
  <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
    <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
      {icon}
      {title}
    </h2>
    <div className="flex items-center gap-1">
      {ctx.onToggleVisible && (
        <button onClick={ctx.onToggleVisible} className="text-xs text-neutral-400 hover:text-white px-1.5 py-1 rounded hover:bg-neutral-800" title="إخفاء لوحة الخصائص">
          <PanelRightClose size={15} />
        </button>
      )}
      <button onClick={ctx.onClearSelection} className="text-xs text-neutral-400 hover:text-white px-2 py-1 rounded hover:bg-neutral-800">
        ✕
      </button>
    </div>
  </div>
);

const LayerAndDelete: React.FC<{ ctx: PanelContext; layerId: string; label: string }> = ({ ctx, layerId, label }) => (
  <>
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-neutral-300">الطبقة (Layer)</label>
      <select value={layerId} onChange={(e) => ctx.handleLayerChange(e.target.value)} className="bg-neutral-800 border border-neutral-700 rounded-md px-2.5 py-1.5 text-xs text-neutral-100 outline-none">
        {ctx.layers.map((l) => (
          <option key={l.id} value={l.id}>{l.name}</option>
        ))}
      </select>
    </div>
    <div className="pt-2 border-t border-neutral-800">
      <button onClick={ctx.handleDelete} className="w-full flex items-center justify-center gap-1.5 py-2 text-xs bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 rounded-md border border-rose-500/40">
        <Trash2 size={14} />
        <span>{label}</span>
      </button>
    </div>
  </>
);

export const ColumnProperties: React.FC<PanelContext> = (ctx) => {
  const col = ctx.selectedObject as ColumnObject;
  const ppm = ctx.pixelsPerMeter || 50;
  const toM = (v: number) => Math.round((v / ppm) * 100) / 100;
  const set = (patch: Partial<ColumnObject>) => ctx.model.updateObject(col.id, patch);
  return (
    <aside className="w-72 bg-neutral-900 border-r border-neutral-800 flex flex-col text-neutral-200 select-none z-10 overflow-y-auto">
      <div className="p-4 flex flex-col gap-4">
        <Header title="خصائص العمود" icon={<Square size={16} className="text-slate-300" />} ctx={ctx} />
        <div className="grid grid-cols-2 gap-1 p-0.5 bg-neutral-800 rounded-md text-xs">
          {([
            ['rect', 'مستطيل'],
            ['round', 'دائري'],
          ] as const).map(([k, l]) => (
            <button key={k} onClick={() => set({ shape: k, ...(k === 'round' ? { depth: col.width } : {}) })} className={`py-1 rounded ${(col.shape || 'rect') === k ? 'bg-sky-600 text-white font-bold' : 'text-neutral-300 hover:bg-neutral-700'}`}>
              {l}
            </button>
          ))}
        </div>
        <NumField testId="column-width" label={col.shape === 'round' ? 'القطر' : 'العرض'} unit="م" value={toM(col.width)} onCommit={(v) => set({ width: v * ppm, ...(col.shape === 'round' ? { depth: v * ppm } : {}) })} />
        {col.shape !== 'round' && <NumField testId="column-depth" label="العمق" unit="م" value={toM(col.depth)} onCommit={(v) => set({ depth: v * ppm })} />}
        <NumField label="الدوران" unit="°" step={5} min={0} value={Math.round(col.rotation || 0)} onCommit={(v) => set({ rotation: v % 360 })} />
        <LayerAndDelete ctx={ctx} layerId={col.layerId} label="حذف العمود" />
      </div>
    </aside>
  );
};

export const StairsProperties: React.FC<PanelContext> = (ctx) => {
  const st = ctx.selectedObject as StairObject;
  const ppm = ctx.pixelsPerMeter || 50;
  const g = stairsGeometry(st, ppm);
  const set = (patch: Partial<StairObject>) => ctx.model.updateObject(st.id, patch);
  const setLength = (m: number) => {
    const L = m * ppm;
    set({ end: { x: Math.round((st.start.x + g.dir.x * L) * 100) / 100, y: Math.round((st.start.y + g.dir.y * L) * 100) / 100 } });
  };
  return (
    <aside className="w-72 bg-neutral-900 border-r border-neutral-800 flex flex-col text-neutral-200 select-none z-10 overflow-y-auto">
      <div className="p-4 flex flex-col gap-4">
        <Header title="خصائص الدرج" icon={<Footprints size={16} className="text-slate-300" />} ctx={ctx} />
        <div className="bg-neutral-950/60 p-3 rounded-lg border border-neutral-800 grid grid-cols-2 gap-y-1.5 text-xs" data-testid="stairs-metrics">
          <span className="text-neutral-400">عدد الدرجات:</span>
          <span className="font-mono-cad text-emerald-300 font-bold text-left">{g.treads}</span>
          <span className="text-neutral-400">عدد القوائم:</span>
          <span className="font-mono-cad text-left">{g.risers}</span>
          <span className="text-neutral-400">النائمة الفعلية:</span>
          <span className="font-mono-cad text-left">{g.actualTreadM.toFixed(3)} م</span>
          <span className="text-neutral-400">الارتفاع الكلي:</span>
          <span className="font-mono-cad text-sky-300 text-left">{g.riseM.toFixed(2)} م</span>
        </div>
        <p className="text-[10px] text-neutral-500 -mt-2">اسحب المقبضين على المخطط لتمطيط الدرج — يُعاد حساب الدرجات تلقائياً.</p>
        <NumField testId="stairs-length" label="الطول" unit="م" value={Math.round(g.lengthM * 100) / 100} onCommit={setLength} />
        <NumField testId="stairs-width" label="العرض" unit="م" value={Math.round((st.width / ppm) * 100) / 100} onCommit={(v) => set({ width: v * ppm })} />
        <NumField testId="stairs-tread" label="عمق النائمة" unit="م" value={st.tread ?? DEFAULT_TREAD} onCommit={(v) => set({ tread: v })} />
        <NumField testId="stairs-riser" label="ارتفاع القائمة" unit="م" value={st.riser ?? DEFAULT_RISER} onCommit={(v) => set({ riser: v })} />
        <button onClick={() => set({ start: st.end, end: st.start })} className="flex items-center justify-center gap-1.5 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 rounded-md border border-neutral-700">
          <ArrowLeftRight size={13} /> عكس اتجاه الصعود
        </button>
        <LayerAndDelete ctx={ctx} layerId={st.layerId} label="حذف الدرج" />
      </div>
    </aside>
  );
};
