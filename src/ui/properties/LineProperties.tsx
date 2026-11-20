/**
 * @file LineProperties.tsx
 * @description لوحة خصائص الخط الحر (Linework) — خطوط DXF المستوردة والأقواس والدوائر
 */

import React from 'react';
import { Trash2, PanelRightClose, Spline } from 'lucide-react';
import type { LineObject } from '../../model/types.ts';
import { GridUtils } from '../../engine/grid.ts';
import { LabelInput } from './inputs.tsx';
import type { PanelContext } from './context.ts';

export const LineProperties: React.FC<PanelContext> = (ctx) => {
  const { model, selectedObject, layers, meta, pixelsPerMeter, handleDelete, handleLayerChange, onToggleVisible, onClearSelection } = ctx;
  const line = selectedObject as LineObject;
  const n = line.points.length;
  let lengthPx = 0;
  for (let i = 0; i < n - 1; i++) lengthPx += Math.hypot(line.points[i + 1].x - line.points[i].x, line.points[i + 1].y - line.points[i].y);
  if (line.closed && n > 2) lengthPx += Math.hypot(line.points[0].x - line.points[n - 1].x, line.points[0].y - line.points[n - 1].y);
  const layerColor = layers.find((l) => l.id === line.layerId)?.color || '#94a3b8';

  return (
    <aside className="w-72 bg-neutral-900 border-r border-neutral-800 flex flex-col text-neutral-200 select-none z-10 overflow-y-auto">
      <div className="p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Spline size={16} className="text-slate-300" />
              خصائص الخط
            </h2>
            <div className="text-[10px] text-neutral-400 font-mono-cad mt-0.5">المعرف: {line.id}</div>
          </div>
          <div className="flex items-center gap-1">
            {onToggleVisible && (
              <button onClick={onToggleVisible} className="text-xs text-neutral-400 hover:text-white px-1.5 py-1 rounded hover:bg-neutral-800" title="إخفاء لوحة الخصائص">
                <PanelRightClose size={15} />
              </button>
            )}
            <button onClick={onClearSelection} className="text-xs text-neutral-400 hover:text-white px-2 py-1 rounded hover:bg-neutral-800">
              ✕
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-neutral-300">التسمية التوضيحية (Label):</label>
          <LabelInput
            placeholder="مثال: محور، خط أثاث"
            value={line.label || ''}
            onSave={(val, recordHistory = true) => model.updateObject(line.id, { label: val }, recordHistory)}
          />
        </div>

        <div className="bg-neutral-950/60 p-3 rounded-lg border border-neutral-800 flex flex-col gap-1 text-xs">
          <div className="flex justify-between">
            <span className="text-neutral-400">الطول الكلي:</span>
            <span className="font-mono-cad text-sky-300 font-bold">{GridUtils.formatLength(lengthPx, pixelsPerMeter, meta.unit)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-400">عدد الرؤوس:</span>
            <span className="font-mono-cad">{n}{line.closed ? ' (مغلق)' : ''}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-semibold text-neutral-300">اللون:</label>
          <input
            type="color"
            value={line.color || layerColor}
            onChange={(e) => model.updateObject(line.id, { color: e.target.value })}
            className="w-10 h-7 rounded border border-neutral-700 bg-transparent"
          />
        </div>

        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-semibold text-neutral-300">سماكة الخط (بكسل):</label>
          <select
            value={String(line.strokeWidth || 1.2)}
            onChange={(e) => model.updateObject(line.id, { strokeWidth: Number(e.target.value) })}
            className="bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1 text-xs"
          >
            {['0.6', '1.2', '2', '3', '4'].map((w) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-semibold text-neutral-300">نمط الخط:</label>
          <select
            value={line.lineStyle || 'solid'}
            onChange={(e) => model.updateObject(line.id, { lineStyle: e.target.value as LineObject['lineStyle'] })}
            className="bg-neutral-800 border border-neutral-700 rounded-md px-2 py-1 text-xs"
          >
            <option value="solid">متصل</option>
            <option value="dashed">متقطع</option>
            <option value="dotted">منقط</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">الطبقة (Layer)</label>
          <select
            value={line.layerId}
            onChange={(e) => handleLayerChange(e.target.value)}
            className="bg-neutral-800 border border-neutral-700 rounded-md px-2.5 py-1.5 text-xs text-neutral-100 outline-none"
          >
            {layers.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        <div className="pt-2 border-t border-neutral-800">
          <button
            onClick={handleDelete}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 rounded-md border border-rose-500/40 transition-colors"
          >
            <Trash2 size={14} />
            <span>حذف الخط</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
