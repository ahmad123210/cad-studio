/**
 * @file WallProperties.tsx
 * @description لوحة خصائص الجدار
 * (مُستخرج من PropertiesPanel.tsx دون تغيير في السلوك)
 */

import React from 'react';
import {
  Trash2,
  Copy,
  FlipHorizontal,
  Layers,
  Ruler,
  Maximize,
  Compass,
  Info,
  ShieldAlert,
  DoorOpen,
  AppWindow,
  Sliders,
  Image as ImageIcon,
  ArrowRightLeft,
  Target,
  Sparkles,
  Zap,
  GitBranch,
  Droplet,
  Wind,
  Flame,
  FileSpreadsheet,
  FileDown,
  Link,
  Unlink,
  PanelRightClose,
  PanelRightOpen,
  Boxes,
  Plus,
  Minus,
  RotateCw,
  Settings,
  HardDrive,
  Type,
  AlignRight,
  AlignCenter,
  AlignLeft,
  Bold,
  Palette,
  Eye,
  EyeOff,
} from 'lucide-react';
import { ProjectModel } from '../../model/project.ts';
import { getLastUsedSettings, updateLastUsedSettings, saveLastUsedSymbolConfig } from '../../model/lastUsedSettings.ts';
import {
  WallObject,
  DoorObject,
  WindowObject,
  DimensionObject,
  SymbolObject,
  RouteObject,
  TextObject,
  RouteKind,
  DoorOpenDirection,
} from '../../model/types.ts';
import { SnapEngine } from '../../engine/snap.ts';
import { GridUtils } from '../../engine/grid.ts';
import { getSymbolById, CATEGORIES_META } from '../../symbols/registry.ts';
import {
  ROUTE_KINDS_META,
  calculateRoutePixelLength,
  calculateSegmentLengths,
} from '../../symbols/routes.ts';

import { LabelInput, NoteTextarea, PrecisionNumberInput } from './inputs.tsx';
import type { PanelContext } from './context.ts';

export const WallProperties: React.FC<PanelContext> = (ctx) => {
  const {
    model,
    selectedObjectId,
    selectedObjectIds,
    onClearSelection,
    onClearCanvas,
    onOpenBackgroundModal,
    onOpenCalibrationModal,
    onOpenSymbolsCatalog,
    onOpenScheduleBOQ,
    onOpenExport,
    onOpenSettings,
    isVisible,
    onToggleVisible,
    selectedObject,
    layers,
    meta,
    pixelsPerMeter,
    handleDelete,
    handleLayerChange,
  } = ctx;

    const wall = selectedObject as WallObject;

    const handleThicknessChange = (newThickness: number) => {
      const t = Math.max(5, Math.min(100, newThickness));
      model.updateObject(wall.id, { thickness: t });
      updateLastUsedSettings({ wallThickness: t });
    };

    const handleCoordChange = (pointKey: 'start' | 'end', axis: 'x' | 'y', val: number) => {
      const currentPoint = { ...wall[pointKey] };
      currentPoint[axis] = isNaN(val) ? 0 : val;
      model.updateObject(wall.id, { [pointKey]: currentPoint });
    };

    const handleDuplicate = () => {
      const offset = 30;
      const newWall: WallObject = {
        ...wall,
        id: 'wall_' + Math.random().toString(36).substring(2, 9),
        start: { x: wall.start.x + offset, y: wall.start.y + offset },
        end: { x: wall.end.x + offset, y: wall.end.y + offset },
      };
      model.addObject(newWall);
    };

    const handleReverseDirection = () => {
      model.updateObject(wall.id, {
        start: { ...wall.end },
        end: { ...wall.start },
      });
    };

    const lengthPx = SnapEngine.distance(wall.start, wall.end);
    const lengthDisplay = GridUtils.formatLength(lengthPx, pixelsPerMeter, meta.unit);
    const angleDeg =
      ((Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x) * 180) / Math.PI + 360) %
      360;

    return (
      <aside className="w-72 bg-neutral-900 border-r border-neutral-800 flex flex-col text-neutral-200 select-none z-10 overflow-y-auto">
        <div className="p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span>
                خصائص الجدار
              </h2>
              <div className="text-[10px] text-neutral-400 font-mono-cad mt-0.5">
                المعرف: {wall.id}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {onToggleVisible && (
                <button
                  onClick={onToggleVisible}
                  className="text-xs text-neutral-400 hover:text-white px-1.5 py-1 rounded hover:bg-neutral-800"
                  title="إخفاء لوحة الخصائص"
                >
                  <PanelRightClose size={15} />
                </button>
              )}
              <button
                onClick={onClearSelection}
                className="text-xs text-neutral-400 hover:text-white px-1.5 py-1 rounded hover:bg-neutral-800"
                title="إلغاء التحديد"
              >
                ✕
              </button>
            </div>
          </div>

          {/* التسمية التوضيحية للجدار */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-neutral-300">
              التسمية التوضيحية (Label):
            </label>
            <LabelInput
              placeholder="مثال: W-01, جدار استنادي, جدار 20سم"
              value={wall.label || ''}
              onSave={(val, recordHistory = true) => model.updateObject(wall.id, { label: val }, recordHistory)}
              accentColorClass="focus:border-sky-500"
            />
          </div>

          {/* الطبقة */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <Layers size={14} className="text-sky-400" />
              الطبقة (Layer)
            </label>
            <select
              value={wall.layerId}
              onChange={(e) => handleLayerChange(e.target.value)}
              className="bg-neutral-800 border border-neutral-700 rounded-md px-2.5 py-1.5 text-xs text-neutral-100 outline-none focus:border-sky-500"
            >
              {layers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          {/* قياسات الطول والزاوية */}
          <div className="grid grid-cols-2 gap-2 bg-neutral-950/60 p-2.5 rounded-lg border border-neutral-800">
            <div className="flex flex-col">
              <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                <Ruler size={12} className="text-emerald-400" />
                الطول الحقيقي
              </span>
              <span className="text-sm font-bold text-emerald-300 font-mono-cad mt-0.5">
                {lengthDisplay}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-neutral-400 flex items-center gap-1">
                <Compass size={12} className="text-amber-400" />
                الزاوية
              </span>
              <span className="text-sm font-bold text-amber-300 font-mono-cad mt-0.5">
                {angleDeg.toFixed(1)}°
              </span>
            </div>
          </div>

          {/* سماكة الجدار */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-300 flex items-center gap-1">
                <Maximize size={14} className="text-sky-400" />
                سماكة الجدار:
              </span>
              <span className="font-mono-cad text-sky-400 font-bold">
                {GridUtils.formatLength(wall.thickness, pixelsPerMeter, meta.unit)}
              </span>
            </div>

            <PrecisionNumberInput
              value={wall.thickness}
              unit="سم"
              min={5}
              max={100}
              step={1}
              accentColorClass="focus-within:border-sky-400 border-sky-500/40"
              onDecrement={() => handleThicknessChange(Math.max(5, wall.thickness - 5))}
              onIncrement={() => handleThicknessChange(Math.min(100, wall.thickness + 5))}
              decrementTitle="تقليل 5 سم"
              incrementTitle="زيادة 5 سم"
              onChange={(val) => handleThicknessChange(val)}
              presets={[10, 15, 20, 25, 30]}
              onSelectPreset={(p) => handleThicknessChange(p)}
              presetColorClass="bg-sky-600/30 text-sky-300 border-sky-500"
            />
          </div>

          {/* إحداثيات نقطة البداية */}
          <div className="flex flex-col gap-1.5 bg-neutral-950/40 p-2.5 rounded-lg border border-neutral-800/80">
            <span className="text-xs font-semibold text-neutral-300">نقطة البداية (Start)</span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-neutral-400 block mb-0.5">X</label>
                <input
                  type="number"
                  value={Math.round(wall.start.x)}
                  onChange={(e) => handleCoordChange('start', 'x', parseFloat(e.target.value))}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs font-mono-cad text-neutral-200 outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-neutral-400 block mb-0.5">Y</label>
                <input
                  type="number"
                  value={Math.round(wall.start.y)}
                  onChange={(e) => handleCoordChange('start', 'y', parseFloat(e.target.value))}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs font-mono-cad text-neutral-200 outline-none focus:border-sky-500"
                />
              </div>
            </div>
          </div>

          {/* إحداثيات نقطة النهاية */}
          <div className="flex flex-col gap-1.5 bg-neutral-950/40 p-2.5 rounded-lg border border-neutral-800/80">
            <span className="text-xs font-semibold text-neutral-300">نقطة النهاية (End)</span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-neutral-400 block mb-0.5">X</label>
                <input
                  type="number"
                  value={Math.round(wall.end.x)}
                  onChange={(e) => handleCoordChange('end', 'x', parseFloat(e.target.value))}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs font-mono-cad text-neutral-200 outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="text-[10px] text-neutral-400 block mb-0.5">Y</label>
                <input
                  type="number"
                  value={Math.round(wall.end.y)}
                  onChange={(e) => handleCoordChange('end', 'y', parseFloat(e.target.value))}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs font-mono-cad text-neutral-200 outline-none focus:border-sky-500"
                />
              </div>
            </div>
          </div>

          {/* إجراءات الجدار */}
          <div className="flex flex-col gap-2 pt-2 border-t border-neutral-800">
            <div className="flex gap-2">
              <button
                onClick={handleDuplicate}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-md border border-neutral-700 transition-colors"
                title="مضاعفة هذا الجدار"
              >
                <Copy size={13} />
                <span>مضاعفة</span>
              </button>
              <button
                onClick={handleReverseDirection}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-md border border-neutral-700 transition-colors"
                title="عكس اتجاه البداية والنهاية"
              >
                <FlipHorizontal size={13} />
                <span>عكس الاتجاه</span>
              </button>
            </div>

            <button
              onClick={handleDelete}
              className="flex items-center justify-center gap-1.5 py-2 text-xs bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 rounded-md border border-rose-500/40 transition-colors mt-1"
              title="حذف هذا الجدار من المشروع (Delete)"
            >
              <Trash2 size={14} />
              <span>حذف الجدار</span>
            </button>
          </div>
        </div>
      </aside>
    );
  
};
