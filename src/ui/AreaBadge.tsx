/**
 * @file AreaBadge.tsx
 * @description شريط عائم لعرض نتائج قياس المساحة والمحيط المباشرة (المرحلة 3).
 */

import React from 'react';
import { Shapes, Check, X, RotateCcw } from 'lucide-react';
import { UnitType } from '../model/types.ts';
import { GridUtils } from '../engine/grid.ts';

interface AreaBadgeProps {
  pixelArea: number;
  pixelPerimeter: number;
  pointsCount: number;
  pixelsPerMeter: number;
  unit: UnitType;
  onClosePolygon: () => void;
  onClear: () => void;
  onDone: () => void;
}

export const AreaBadge: React.FC<AreaBadgeProps> = ({
  pixelArea,
  pixelPerimeter,
  pointsCount,
  pixelsPerMeter,
  unit,
  onClosePolygon,
  onClear,
  onDone,
}) => {
  const formattedArea = GridUtils.formatArea(pixelArea, pixelsPerMeter, unit);
  const formattedPerimeter = GridUtils.formatLength(pixelPerimeter, pixelsPerMeter, unit);

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 bg-neutral-900/95 border border-sky-500/50 backdrop-blur-md rounded-xl shadow-2xl p-3 flex items-center gap-4 text-xs text-neutral-200 select-none animate-in fade-in slide-in-from-top-3">
      <div className="flex items-center gap-2 pr-1 border-r border-neutral-800">
        <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
          <Shapes size={17} />
        </div>
        <div>
          <span className="font-bold text-white text-xs block">أداة قياس المساحة والمحيط</span>
          <span className="text-[10px] text-neutral-400">
            {pointsCount < 3
              ? `انقر على زوايا الغرفة (${pointsCount}/3 نقاط)`
              : `${pointsCount} نقاط مسجلة`}
          </span>
        </div>
      </div>

      {/* عرض المساحة والمحيط */}
      <div className="flex items-center gap-4 font-mono-cad">
        <div className="flex flex-col">
          <span className="text-[10px] text-neutral-400 font-sans">المساحة المحسوبة:</span>
          <span className="text-sm font-extrabold text-emerald-400">{formattedArea}</span>
        </div>
        <div className="h-6 w-px bg-neutral-800" />
        <div className="flex flex-col">
          <span className="text-[10px] text-neutral-400 font-sans">المحيط:</span>
          <span className="text-sm font-extrabold text-sky-400">{formattedPerimeter}</span>
        </div>
      </div>

      {/* أزرار الإجراءات */}
      <div className="flex items-center gap-1.5 pl-1 border-l border-neutral-800">
        {pointsCount >= 3 && (
          <button
            onClick={onClosePolygon}
            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
            title="إغلاق المضلع وحساب المساحة النهائية"
          >
            <Check size={13} />
            <span>إغلاق المضلع</span>
          </button>
        )}
        <button
          onClick={onClear}
          className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors"
          title="مسح النقاط والبدء من جديد"
        >
          <RotateCcw size={14} />
        </button>
        <button
          onClick={onDone}
          className="p-1.5 bg-neutral-800 hover:bg-rose-950/60 text-neutral-400 hover:text-rose-400 rounded-lg transition-colors"
          title="إنهاء وضع قياس المساحة"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  );
};
