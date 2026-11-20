/**
 * @file StatusBar.tsx
 * @description شريط الحالة السفلي (Status Bar).
 * يعرض إحداثيات مؤشر الفأرة الحقيقية، حالة الالتقاط، نسبة التكبير، والطبقة النشطة.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Point, UnitType } from '../model/types.ts';
import { SnapResult } from '../engine/snap.ts';
import { GridUtils } from '../engine/grid.ts';
import { GridDensity } from '../model/lastUsedSettings.ts';
import { Grid, ChevronDown, Check } from 'lucide-react';

interface StatusBarProps {
  cursorWorld: Point;
  snapResult: SnapResult;
  zoom: number;
  activeLayerName: string;
  pixelsPerMeter: number;
  unit: UnitType;
  gridDensity?: GridDensity;
  onChangeGridDensity?: (density: GridDensity) => void;
  onOpenHelp: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  cursorWorld,
  snapResult,
  zoom,
  activeLayerName,
  pixelsPerMeter,
  unit,
  gridDensity = 'medium',
  onChangeGridDensity,
  onOpenHelp,
}) => {
  const [isGridMenuOpen, setIsGridMenuOpen] = useState(false);
  const gridMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (gridMenuRef.current && !gridMenuRef.current.contains(e.target as Node)) {
        setIsGridMenuOpen(false);
      }
    };
    if (isGridMenuOpen) {
      window.addEventListener('mousedown', handleOutsideClick);
    }
    return () => window.removeEventListener('mousedown', handleOutsideClick);
  }, [isGridMenuOpen]);

  const formattedX = GridUtils.formatLength(cursorWorld.x, pixelsPerMeter, unit);
  const formattedY = GridUtils.formatLength(cursorWorld.y, pixelsPerMeter, unit);

  const densityLabels: Record<GridDensity, { label: string; desc: string }> = {
    fine: { label: 'دقيق (10cm)', desc: 'دقة فائقة بدون قفزات' },
    medium: { label: 'متوسط (25cm)', desc: 'التوازن الأمثل للرسم' },
    coarse: { label: 'خشن (50cm)', desc: 'للكتل والمخططات الكبيرة' },
  };

  return (
    <footer className="h-7 bg-neutral-950 border-t border-neutral-800 px-3 flex items-center justify-between text-[11px] text-neutral-400 select-none z-20">
      {/* القسم الأيمن: إحداثيات المؤشر والالتقاط ودقة الشبكة */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 font-mono-cad">
          <span className="text-neutral-500 font-semibold">الموقع:</span>
          <span className="text-neutral-300">X: {formattedX}</span>
          <span className="text-neutral-600">|</span>
          <span className="text-neutral-300">Y: {formattedY}</span>
        </div>

        <div className="h-3 w-px bg-neutral-800" />

        {/* حالة الالتقاط النشطة */}
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              snapResult.snapped
                ? snapResult.type === 'endpoint'
                  ? 'bg-emerald-400 animate-ping'
                  : snapResult.type === 'midpoint'
                  ? 'bg-cyan-400'
                  : 'bg-amber-400'
                : 'bg-neutral-600'
            }`}
          />
          <span
            className={`${
              snapResult.snapped ? 'text-sky-300 font-medium' : 'text-neutral-500'
            }`}
          >
            {snapResult.snapped ? snapResult.label || 'التقاط نشط' : 'حركة حرة'}
          </span>
        </div>

        <div className="h-3 w-px bg-neutral-800" />

        {/* محدد دقة الشبكة والـ Snap (المرحلة 2) */}
        {onChangeGridDensity && (
          <div className="relative" ref={gridMenuRef}>
            <button
              onClick={() => setIsGridMenuOpen(!isGridMenuOpen)}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-neutral-800/80 text-neutral-300 hover:text-white transition-colors cursor-pointer"
              title="تغيير مستوى دقة الشبكة والالتقاط (Grid Density)"
            >
              <Grid size={12} className="text-amber-400" />
              <span>الشبكة:</span>
              <span className="font-semibold text-amber-300 font-mono-cad">
                {densityLabels[gridDensity]?.label || gridDensity}
              </span>
              <ChevronDown size={11} className="text-neutral-500" />
            </button>

            {isGridMenuOpen && (
              <div className="absolute bottom-8 right-0 w-52 bg-neutral-900 border border-neutral-700/80 rounded-xl shadow-2xl p-1.5 flex flex-col gap-1 z-50 backdrop-blur-md animate-in fade-in zoom-in-95">
                <div className="px-2 py-1 text-[10px] font-bold text-neutral-400 border-b border-neutral-800 flex items-center justify-between">
                  <span>مستوى دقة الشبكة (Grid Spacing)</span>
                </div>
                {(['fine', 'medium', 'coarse'] as GridDensity[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      onChangeGridDensity(d);
                      setIsGridMenuOpen(false);
                    }}
                    className={`flex items-center justify-between px-2 py-1.5 rounded-lg text-right text-xs transition-colors cursor-pointer ${
                      gridDensity === d
                        ? 'bg-amber-950/60 border border-amber-500/50 text-amber-300 font-bold'
                        : 'hover:bg-neutral-800 text-neutral-300 border border-transparent'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-xs">{densityLabels[d].label}</span>
                      <span className="text-[9.5px] text-neutral-400">{densityLabels[d].desc}</span>
                    </div>
                    {gridDensity === d && <Check size={14} className="text-amber-400 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* القسم الأوسط: نصائح الاختصارات السريعة */}
      <div className="hidden md:flex items-center gap-2.5 text-neutral-400">
        <span>
          <kbd className="bg-neutral-800 text-neutral-300 px-1 py-0.2 rounded border border-neutral-700">W</kbd> جدار
        </span>
        <span>
          <kbd className="bg-neutral-800 text-amber-300 px-1 py-0.2 rounded border border-neutral-700">D</kbd> باب
        </span>
        <span>
          <kbd className="bg-neutral-800 text-teal-300 px-1 py-0.2 rounded border border-neutral-700">N</kbd> نافذة
        </span>
        <span>
          <kbd className="bg-neutral-800 text-amber-400 px-1 py-0.2 rounded border border-neutral-700">S</kbd> رمز MEP
        </span>
        <span>
          <kbd className="bg-neutral-800 text-neutral-300 px-1 py-0.2 rounded border border-neutral-700">V</kbd> تحديد
        </span>
        <span>
          <kbd className="bg-neutral-800 text-neutral-300 px-1 py-0.2 rounded border border-neutral-700">Ctrl+Z</kbd> تراجع
        </span>
      </div>

      {/* القسم الأيسر: الطبقة النشطة ومستوى التكبير */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-neutral-500">الطبقة:</span>
          <span className="text-neutral-200 font-medium">{activeLayerName}</span>
        </div>

        <div className="h-3 w-px bg-neutral-800" />

        <div className="flex items-center gap-1 font-mono-cad">
          <span className="text-neutral-500">التكبير:</span>
          <span className="text-sky-400 font-semibold">{Math.round(zoom * 100)}%</span>
        </div>

        <div className="h-3 w-px bg-neutral-800" />

        <button
          onClick={onOpenHelp}
          className="text-neutral-400 hover:text-white transition-colors cursor-pointer"
          title="عرض جميع الاختصارات"
        >
          مساعدة ⌨️
        </button>
      </div>
    </footer>
  );
};
