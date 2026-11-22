/**
 * @file CircuitFields.tsx
 * @description حقول الكهرباء للرموز: الدائرة المسندة والحمل (واط). تُستخدم في خصائص الرمز والتحديد المتعدد.
 */
import React from 'react';
import type { ProjectModel } from '../../model/project.ts';
import type { SymbolObject } from '../../model/types.ts';
import { defaultLoad } from '../../model/electrical.ts';

const sel = 'bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs outline-none focus:border-amber-500';

/** إسناد مجموعة رموز إلى دائرة (خطوة تراجع واحدة) */
function assign(model: ProjectModel, ids: string[], circuitId: string | undefined) {
  model.applyEdits({ updates: ids.map((id) => ({ id, after: { circuitId } })), adds: [], deletes: [] }, circuitId ? 'إسناد إلى دائرة' : 'إلغاء إسناد الدائرة');
}

export const CircuitFields: React.FC<{ model: ProjectModel; symbols: SymbolObject[] }> = ({ model, symbols }) => {
  const loads = symbols.filter((s) => s.loadW !== undefined || defaultLoad(s.symbolKind));
  if (loads.length === 0) return null;
  const circuits = model.getMep().circuits;
  const single = loads.length === 1 ? loads[0] : null;
  const current = new Set(loads.map((s) => s.circuitId || ''));
  const value = current.size === 1 ? [...current][0] : '__mixed';
  return (
    <div className="flex flex-col gap-2 bg-amber-950/20 p-2.5 rounded-lg border border-amber-900/40" data-testid="circuit-fields">
      <label className="flex items-center justify-between gap-2 text-xs">
        <span className="text-neutral-300 font-semibold">الدائرة الكهربائية{loads.length > 1 ? ` (${loads.length} نقطة)` : ''}:</span>
        <select
          data-testid="circuit-select"
          value={value}
          onChange={(e) => e.target.value !== '__mixed' && assign(model, loads.map((s) => s.id), e.target.value || undefined)}
          className={sel}
        >
          {value === '__mixed' && <option value="__mixed">مختلطة</option>}
          <option value="">بدون</option>
          {circuits.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>
      {single && (
        <label className="flex items-center justify-between gap-2 text-xs">
          <span className="text-neutral-300 font-semibold">الحمل (واط):</span>
          <input
            type="number"
            min={0}
            step={10}
            data-testid="load-input"
            key={single.id + String(single.loadW ?? '')}
            defaultValue={single.loadW ?? ''}
            placeholder={String(defaultLoad(single.symbolKind)?.w ?? 0)}
            onBlur={(e) => {
              const v = parseFloat(e.target.value);
              const next = Number.isFinite(v) && v >= 0 ? v : undefined;
              if (next !== single.loadW) model.updateObject(single.id, { loadW: next });
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            className="w-24 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 font-mono-cad text-center outline-none focus:border-amber-500"
          />
        </label>
      )}
      {circuits.length === 0 && <span className="text-[10px] text-neutral-500">أنشئ الدوائر من نافذة «حسابات التمديدات».</span>}
    </div>
  );
};
