/**
 * @file DimensionProperties.tsx
 * @description لوحة خصائص البُعد الهندسي
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

export const DimensionProperties: React.FC<PanelContext> = (ctx) => {
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

    const dim = selectedObject as DimensionObject;
    const lengthPx = SnapEngine.distance(dim.start, dim.end);
    const lengthDisplay = GridUtils.formatLength(lengthPx, pixelsPerMeter, meta.unit);

    const handleOffsetChange = (val: number) => {
      model.updateObject(dim.id, { offset: val });
    };

    const handleCustomTextChange = (text: string) => {
      model.updateObject(dim.id, { displayText: text });
    };

    return (
      <aside className="w-72 bg-neutral-900 border-r border-neutral-800 flex flex-col text-neutral-200 select-none z-10 overflow-y-auto">
        <div className="p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Ruler size={16} className="text-indigo-400" />
                خصائص البُعد الهندسي
              </h2>
              <div className="text-[10px] text-neutral-400 font-mono-cad mt-0.5">
                المعرف: {dim.id}
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
                className="text-xs text-neutral-400 hover:text-white px-2 py-1 rounded hover:bg-neutral-800"
              >
                ✕
              </button>
            </div>
          </div>

          {/* التسمية التوضيحية للبعد */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-neutral-300">
              التسمية التوضيحية (Label):
            </label>
            <LabelInput
              placeholder="مثال: محور A-B, ارتداد أمامي"
              value={dim.label || ''}
              onSave={(val, recordHistory = true) => model.updateObject(dim.id, { label: val }, recordHistory)}
              accentColorClass="focus:border-indigo-500"
            />
          </div>

          {/* المسافة المقاسة */}
          <div className="bg-neutral-950/60 p-3 rounded-lg border border-neutral-800 flex flex-col gap-1">
            <span className="text-neutral-400 text-xs">المسافة الحقيقية المقاسة:</span>
            <div className="text-lg font-bold text-indigo-300 font-mono-cad">
              {lengthDisplay}
            </div>
            <span className="text-[10px] text-neutral-500 font-mono-cad">
              ({lengthPx.toFixed(1)} بكسل على المخطط)
            </span>
          </div>

          {/* نص مخصص اختياري */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-neutral-300">
              نص مخصص للبعد (اختياري):
            </label>
            <input
              type="text"
              placeholder={lengthDisplay}
              value={dim.displayText || ''}
              onChange={(e) => handleCustomTextChange(e.target.value)}
              onKeyDown={(e) => e.stopPropagation()}
              className="bg-neutral-800 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-indigo-500"
            />
            <span className="text-[10px] text-neutral-400">
              اتركه فارغاً للعرض التلقائي للطول المقاس.
            </span>
          </div>

          {/* مسافة إزاحة خط البعد */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-300">مسافة الإزاحة (Offset):</span>
              <span className="font-mono-cad text-indigo-400 font-bold">
                {dim.offset || 20} px
              </span>
            </div>
            <input
              type="range"
              min="-60"
              max="60"
              step="5"
              value={dim.offset || 20}
              onChange={(e) => handleOffsetChange(parseFloat(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
            />
          </div>

          {/* الطبقة */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <Layers size={14} className="text-sky-400" />
              الطبقة (Layer)
            </label>
            <select
              value={dim.layerId}
              onChange={(e) => handleLayerChange(e.target.value)}
              className="bg-neutral-800 border border-neutral-700 rounded-md px-2.5 py-1.5 text-xs text-neutral-100 outline-none"
            >
              {layers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          {/* حذف البعد */}
          <div className="pt-2 border-t border-neutral-800">
            <button
              onClick={handleDelete}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 rounded-md border border-rose-500/40 transition-colors"
            >
              <Trash2 size={14} />
              <span>حذف خط البعد</span>
            </button>
          </div>
        </div>
      </aside>
    );
  
};
