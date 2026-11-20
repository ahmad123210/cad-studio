/**
 * @file WindowProperties.tsx
 * @description لوحة خصائص النافذة
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

export const WindowProperties: React.FC<PanelContext> = (ctx) => {
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

    const win = selectedObject as WindowObject;
    const parentWall = model.getObjectById(win.wallId) as WallObject | undefined;

    const handleWindowWidthChange = (w: number) => {
      const finalW = Math.max(20, Math.min(300, w));
      model.updateObject(win.id, { width: finalW });
      updateLastUsedSettings({ windowWidth: finalW });
    };

    const handleWindowWidthChangeCm = (cm: number) => {
      const wPx = (cm / 100) * pixelsPerMeter;
      handleWindowWidthChange(wPx);
    };

    const handleWindowHeightChange = (h: number) => {
      model.updateObject(win.id, { height: h });
      updateLastUsedSettings({ windowHeight: h });
    };

    const handleWindowSillHeightChange = (s: number) => {
      model.updateObject(win.id, { sillHeight: s });
      updateLastUsedSettings({ windowSillHeight: s });
    };

    const handlePositionChange = (pos: number) => {
      model.updateObject(win.id, { position: Math.max(0.05, Math.min(0.95, pos)) });
    };

    return (
      <aside className="w-72 bg-neutral-900 border-r border-neutral-800 flex flex-col text-neutral-200 select-none z-10 overflow-y-auto">
        <div className="p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <AppWindow size={16} className="text-teal-400" />
                خصائص النافذة
              </h2>
              <div className="text-[10px] text-neutral-400 font-mono-cad mt-0.5">
                المعرف: {win.id}
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
              >
                ✕
              </button>
            </div>
          </div>

          {/* التسمية التوضيحية للنافذة */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-neutral-300">
              التسمية التوضيحية (Label):
            </label>
            <LabelInput
              placeholder="مثال: W-01, نافذة صالة, W-120"
              value={win.label || ''}
              onSave={(val, recordHistory = true) => model.updateObject(win.id, { label: val }, recordHistory)}
              accentColorClass="focus:border-teal-500"
            />
          </div>

          {/* الجدار الحاضن */}
          <div className="bg-neutral-950/60 p-2.5 rounded-lg border border-neutral-800 text-xs">
            <span className="text-neutral-400 block mb-1">الجدار الحاضن:</span>
            <div className="font-mono-cad text-sky-400 font-semibold flex items-center justify-between">
              <span>{win.wallId}</span>
              <span className="text-[10px] text-neutral-500">
                {parentWall ? 'متصل بنجاح ✓' : 'جدار مفقود'}
              </span>
            </div>
          </div>

          {/* عرض النافذة كرقم دقيق بدلاً من Slider */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-300">عرض فتحة النافذة:</span>
              <span className="font-mono-cad text-teal-400 font-bold">
                {GridUtils.formatLength(win.width, pixelsPerMeter, meta.unit)}
              </span>
            </div>

            {(() => {
              const winWidthCm = Math.round((win.width / pixelsPerMeter) * 100 * 10) / 10;
              return (
                <PrecisionNumberInput
                  value={winWidthCm}
                  unit="سم"
                  min={30}
                  max={350}
                  step={0.5}
                  accentColorClass="focus-within:border-teal-400 border-teal-500/40"
                  onDecrement={() => handleWindowWidthChangeCm(Math.max(30, Math.round((winWidthCm - 5) * 10) / 10))}
                  onIncrement={() => handleWindowWidthChangeCm(Math.min(350, Math.round((winWidthCm + 5) * 10) / 10))}
                  decrementTitle="تقليل 5 سم"
                  incrementTitle="زيادة 5 سم"
                  onChange={(val) => handleWindowWidthChangeCm(val)}
                  presets={[60, 80, 100, 120, 150]}
                  onSelectPreset={(p) => handleWindowWidthChangeCm(p)}
                  presetColorClass="bg-teal-600/30 text-teal-300 border-teal-500"
                />
              );
            })()}
          </div>

          {/* موقع النافذة على الجدار */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-300 flex items-center gap-1">
                <Sliders size={13} className="text-sky-400" />
                الموقع على الجدار:
              </span>
              <span className="font-mono-cad text-neutral-300 font-bold">
                {Math.round(win.position * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.95"
              step="0.01"
              value={win.position}
              onChange={(e) => handlePositionChange(parseFloat(e.target.value))}
              className="w-full accent-sky-500 cursor-pointer"
            />
          </div>

          {/* ارتفاع الجلسة وارتفاع النافذة */}
          <div className="grid grid-cols-2 gap-2 bg-neutral-950/50 p-2.5 rounded-lg border border-neutral-800 text-xs">
            <div>
              <label className="text-[10px] text-neutral-400 block mb-0.5">جلسة النافذة (Sill):</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="2"
                value={win.sillHeight ?? 0.9}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) handleWindowSillHeightChange(val);
                }}
                className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 font-mono-cad text-neutral-200 outline-none text-center focus:border-teal-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-neutral-400 block mb-0.5">ارتفاع النافذة:</label>
              <input
                type="number"
                step="0.1"
                min="0.3"
                max="3"
                value={win.height ?? 1.2}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val > 0) handleWindowHeightChange(val);
                }}
                className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 font-mono-cad text-neutral-200 outline-none text-center focus:border-teal-500"
              />
            </div>
          </div>

          {/* الطبقة */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <Layers size={14} className="text-sky-400" />
              الطبقة (Layer)
            </label>
            <select
              value={win.layerId}
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

          {/* حذف النافذة */}
          <div className="pt-2 border-t border-neutral-800">
            <button
              onClick={handleDelete}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 rounded-md border border-rose-500/40 transition-colors"
            >
              <Trash2 size={14} />
              <span>حذف النافذة</span>
            </button>
          </div>
        </div>
      </aside>
    );
  
};
