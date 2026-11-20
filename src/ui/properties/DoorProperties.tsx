/**
 * @file DoorProperties.tsx
 * @description لوحة خصائص الباب
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

export const DoorProperties: React.FC<PanelContext> = (ctx) => {
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

    const door = selectedObject as DoorObject;
    const parentWall = model.getObjectById(door.wallId) as WallObject | undefined;

    const handleDoorWidthChange = (w: number) => {
      const finalW = Math.max(20, Math.min(250, w));
      model.updateObject(door.id, { width: finalW });
      updateLastUsedSettings({ doorWidth: finalW });
    };

    const handleDoorWidthChangeCm = (cm: number) => {
      const wPx = (cm / 100) * pixelsPerMeter;
      handleDoorWidthChange(wPx);
    };

    const handlePositionChange = (pos: number) => {
      model.updateObject(door.id, { position: Math.max(0.05, Math.min(0.95, pos)) });
    };

    const toggleInwardOutward = () => {
      const isCurrentlyInward = door.openDirection.startsWith('inward');
      const isRight = door.openDirection.endsWith('right');
      const newDir: DoorOpenDirection = isCurrentlyInward
        ? isRight ? 'outward_right' : 'outward_left'
        : isRight ? 'inward_right' : 'inward_left';
      model.updateObject(door.id, { openDirection: newDir });
      updateLastUsedSettings({ doorDirection: newDir });
    };

    const toggleHingeSide = () => {
      const isInward = door.openDirection.startsWith('inward');
      const isCurrentlyRight = door.openDirection.endsWith('right');
      const newDir: DoorOpenDirection = isCurrentlyRight
        ? isInward ? 'inward_left' : 'outward_left'
        : isInward ? 'inward_right' : 'outward_right';
      model.updateObject(door.id, { openDirection: newDir });
      updateLastUsedSettings({ doorDirection: newDir });
    };

    return (
      <aside className="w-72 bg-neutral-900 border-r border-neutral-800 flex flex-col text-neutral-200 select-none z-10 overflow-y-auto">
        <div className="p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <DoorOpen size={16} className="text-amber-400" />
                خصائص الباب المعماري
              </h2>
              <div className="text-[10px] text-neutral-400 font-mono-cad mt-0.5">
                المعرف: {door.id}
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

          {/* التسمية التوضيحية للباب */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-neutral-300">
              التسمية التوضيحية (Label):
            </label>
            <LabelInput
              placeholder="مثال: D-01, باب صالة, W-90"
              value={door.label || ''}
              onSave={(val, recordHistory = true) => model.updateObject(door.id, { label: val }, recordHistory)}
              accentColorClass="focus:border-amber-500"
            />
          </div>

          {/* الجدار المرتبط */}
          <div className="bg-neutral-950/60 p-2.5 rounded-lg border border-neutral-800 text-xs">
            <span className="text-neutral-400 block mb-1">الجدار الحاضن:</span>
            <div className="font-mono-cad text-sky-400 font-semibold flex items-center justify-between">
              <span>{door.wallId}</span>
              <span className="text-[10px] text-neutral-500">
                {parentWall ? 'متصل بنجاح ✓' : 'جدار مفقود'}
              </span>
            </div>
          </div>

          {/* عرض الباب */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-300">عرض فتحة الباب:</span>
              <span className="font-mono-cad text-amber-400 font-bold">
                {GridUtils.formatLength(door.width, pixelsPerMeter, meta.unit)}
              </span>
            </div>

            {(() => {
              const doorWidthCm = Math.round((door.width / pixelsPerMeter) * 100 * 10) / 10;
              return (
                <PrecisionNumberInput
                  value={doorWidthCm}
                  unit="سم"
                  min={30}
                  max={250}
                  step={0.5}
                  accentColorClass="focus-within:border-amber-400 border-amber-500/40"
                  onDecrement={() => handleDoorWidthChangeCm(Math.max(30, Math.round((doorWidthCm - 2.5) * 10) / 10))}
                  onIncrement={() => handleDoorWidthChangeCm(Math.min(250, Math.round((doorWidthCm + 2.5) * 10) / 10))}
                  decrementTitle="تقليل 2.5 سم"
                  incrementTitle="زيادة 2.5 سم"
                  onChange={(val) => handleDoorWidthChangeCm(val)}
                  presets={[70, 80, 90, 100, 120]}
                  onSelectPreset={(p) => handleDoorWidthChangeCm(p)}
                  presetColorClass="bg-amber-600/30 text-amber-300 border-amber-500"
                />
              );
            })()}
          </div>

          {/* موقع الباب على الجدار */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-300 flex items-center gap-1">
                <Sliders size={13} className="text-sky-400" />
                الموقع على طول الجدار:
              </span>
              <span className="font-mono-cad text-neutral-300 font-bold">
                {Math.round(door.position * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.95"
              step="0.01"
              value={door.position}
              onChange={(e) => handlePositionChange(parseFloat(e.target.value))}
              className="w-full accent-sky-500 cursor-pointer"
            />
          </div>

          {/* اتجاه ومسار فتح الباب */}
          <div className="flex flex-col gap-2 bg-neutral-950/50 p-2.5 rounded-lg border border-neutral-800">
            <span className="text-xs font-semibold text-neutral-300">
              اتجاه الفتح ومسار الدوران:
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={toggleInwardOutward}
                className="flex items-center justify-center gap-1.5 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-md border border-neutral-700 transition-colors"
              >
                <ArrowRightLeft size={13} />
                <span>
                  {door.openDirection.startsWith('inward') ? 'داخل ↔ خارج' : 'خارج ↔ داخل'}
                </span>
              </button>

              <button
                onClick={toggleHingeSide}
                className="flex items-center justify-center gap-1.5 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-md border border-neutral-700 transition-colors"
              >
                <FlipHorizontal size={13} />
                <span>
                  {door.openDirection.endsWith('right') ? 'يمين ↔ يسار' : 'يسار ↔ يمين'}
                </span>
              </button>
            </div>
            <div className="text-[10px] text-neutral-400 text-center font-mono-cad">
              الحالة الحالية: {door.openDirection}
            </div>
          </div>

          {/* الطبقة */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <Layers size={14} className="text-sky-400" />
              الطبقة (Layer)
            </label>
            <select
              value={door.layerId}
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

          {/* حذف الباب */}
          <div className="pt-2 border-t border-neutral-800">
            <button
              onClick={handleDelete}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 rounded-md border border-rose-500/40 transition-colors"
            >
              <Trash2 size={14} />
              <span>حذف الباب</span>
            </button>
          </div>
        </div>
      </aside>
    );
  
};
