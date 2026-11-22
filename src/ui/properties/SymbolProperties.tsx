/**
 * @file SymbolProperties.tsx
 * @description لوحة خصائص الرمز الهندسي
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
import { CircuitFields } from './CircuitFields.tsx';
import type { PanelContext } from './context.ts';

export const SymbolProperties: React.FC<PanelContext> = (ctx) => {
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

    const symbol = selectedObject as SymbolObject;
    const symDef = getSymbolById(symbol.symbolKind);
    const catMeta = symDef ? CATEGORIES_META[symDef.category] : null;

    const handleRotationChange = (deg: number) => {
      const normalized = ((deg % 360) + 360) % 360;
      model.updateObject(symbol.id, { rotation: Math.round(normalized) });
    };

    const handleRotateBy = (delta: number) => {
      handleRotationChange(symbol.rotation + delta);
    };

    const handleLabelChange = (label: string) => {
      model.updateObject(symbol.id, { label });
    };

    const handleScaleChange = (scale: number) => {
      const clamped = Math.max(0.1, Math.min(5.0, Math.round(scale * 100) / 100));
      model.updateObject(symbol.id, { scale: clamped });
      saveLastUsedSymbolConfig(symbol.symbolKind, { scale: clamped });
    };

    const handleColorChange = (color?: string) => {
      model.updateObject(symbol.id, { color: color || undefined });
      saveLastUsedSymbolConfig(symbol.symbolKind, { color });
    };

    const handleDetachWall = () => {
      let newX = symbol.x;
      let newY = symbol.y;
      if (symbol.wallId) {
        const wall = model.getObjectById(symbol.wallId) as WallObject | undefined;
        if (wall) {
          const wdx = wall.end.x - wall.start.x;
          const wdy = wall.end.y - wall.start.y;
          const len = Math.sqrt(wdx * wdx + wdy * wdy);
          if (len > 0) {
            const nx = -wdy / len;
            const ny = wdx / len;
            const side = symbol.wallSide || 1;
            newX += nx * side * 28;
            newY += ny * side * 28;
          }
        }
      }
      model.updateObject(symbol.id, {
        x: newX,
        y: newY,
        wallId: undefined,
        wallPosition: undefined,
        wallSide: undefined,
      }, true);
    };

    const handleDuplicate = () => {
      const newSym: SymbolObject = {
        ...symbol,
        id: 'sym_' + Math.random().toString(36).substring(2, 9),
        x: symbol.x + 25,
        y: symbol.y + 25,
        wallId: undefined,
        wallPosition: undefined,
      };
      model.addObject(newSym);
    };

    const xMeters = (symbol.x / pixelsPerMeter).toFixed(2);
    const yMeters = (symbol.y / pixelsPerMeter).toFixed(2);

    return (
      <aside className="w-72 bg-neutral-900 border-r border-neutral-800 flex flex-col text-neutral-200 select-none z-10 overflow-y-auto">
        <div className="p-4 flex flex-col gap-4">
          {/* رأس اللوحة */}
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: catMeta?.color || '#f59e0b' }}
                />
                خصائص الرمز الهندسي
              </h2>
              <div className="text-[10px] text-neutral-400 font-mono-cad mt-0.5">
                المعرف: {symbol.id}
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

          {/* بطاقة معلومات الرمز */}
          <div className="bg-neutral-950/60 p-3 rounded-xl border border-neutral-800 flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center p-2 shrink-0"
              style={{ color: catMeta?.color || '#f59e0b' }}
              dangerouslySetInnerHTML={{ __html: symDef?.svgPreview || '' }}
            />
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-white truncate">
                {symDef?.name || symbol.symbolKind}
              </h3>
              <p className="text-[10px] text-neutral-400 font-mono-cad truncate">
                {symDef?.nameEn}
              </p>
              {catMeta && (
                <span
                  className="inline-block px-1.5 py-0.2 rounded text-[9px] font-semibold mt-1"
                  style={{
                    backgroundColor: `${catMeta.color}20`,
                    color: catMeta.color,
                  }}
                >
                  {catMeta.name}
                </span>
              )}
            </div>
          </div>

          {/* حالة الالتصاق بالجدار (البند 1) */}
          <div className="bg-neutral-950/60 p-2.5 rounded-lg border border-neutral-800 text-xs flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-neutral-400">حالة التثبيت:</span>
              {symbol.wallId ? (
                <span className="text-sky-400 font-semibold flex items-center gap-1">
                  <span>🧲 ملتصق بجدار</span>
                </span>
              ) : (
                <span className="text-emerald-400 font-medium">حر / سقف (غير ملتصق)</span>
              )}
            </div>
            {symbol.wallId && (
              <div className="flex flex-col gap-1.5 pt-1.5 border-t border-neutral-800/80 mt-1">
                <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono-cad">
                  <span>معرف الجدار:</span>
                  <span className="text-sky-300 font-bold">{symbol.wallId}</span>
                </div>
                <button
                  type="button"
                  onClick={handleDetachWall}
                  className="w-full py-1.5 px-2 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 hover:text-amber-200 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                  title="فك ارتباط الرمز بالجدار وتحويله إلى رمز حر في الفراغ أو السقف"
                >
                  <Unlink size={13} />
                  <span>فك الالتصاق بالجدار (تحويل لرمز حر)</span>
                </button>
              </div>
            )}
          </div>

          {/* اختيار لون الرمز (البند 4 و 5) */}
          <div className="flex flex-col gap-2 bg-neutral-950/60 p-2.5 rounded-lg border border-neutral-800">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                <Palette size={13} className="text-amber-400" />
                لون الرمز الهندسي:
              </span>
              <span className="font-mono-cad text-[11px] text-neutral-400">
                {symbol.color ? symbol.color.toUpperCase() : 'لون الطبقة'}
              </span>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {[
                { hex: '#f59e0b', title: 'كهرماني (افتراضي)' },
                { hex: '#38bdf8', title: 'أزرق سماوي' },
                { hex: '#10b981', title: 'أخضر زمردي' },
                { hex: '#ef4444', title: 'أحمر ناري' },
                { hex: '#a855f7', title: 'بنفسجي' },
                { hex: '#eab308', title: 'أصفر ذهبي' },
                { hex: '#ffffff', title: 'أبيض ناصع' },
              ].map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  onClick={() => handleColorChange(c.hex)}
                  title={c.title}
                  className={`h-6 rounded border transition-transform hover:scale-110 ${
                    symbol.color === c.hex ? 'ring-2 ring-sky-400 border-white' : 'border-neutral-700'
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <label className="flex items-center gap-1 text-[11px] text-neutral-400 cursor-pointer">
                <span>مخصص:</span>
                <input
                  type="color"
                  value={symbol.color || '#f59e0b'}
                  onChange={(e) => handleColorChange(e.target.value)}
                  className="w-6 h-6 rounded border border-neutral-700 bg-transparent cursor-pointer p-0"
                />
              </label>
              <button
                type="button"
                onClick={() => handleColorChange(undefined)}
                className="flex-1 py-1 text-[10px] text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded border border-neutral-700 transition-colors"
                title="إعادة التعيين للون الطبقة الافتراضي"
              >
                لون الطبقة
              </button>
            </div>
          </div>

          {/* التسمية التوضيحية (Label) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-neutral-300">
              التسمية التوضيحية (Label):
            </label>
            <LabelInput
              placeholder="مثال: DB-01, 220V, AC-Bed1"
              value={symbol.label || ''}
              onSave={(val, recordHistory = true) => model.updateObject(symbol.id, { label: val }, recordHistory)}
              accentColorClass="focus:border-sky-500"
            />
          </div>

          {/* الدائرة الكهربائية والحمل */}
          <CircuitFields model={model} symbols={[symbol]} />

          {/* زاوية الدوران */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-300">زاوية الدوران:</span>
              <span className="font-mono-cad text-sky-400 font-bold">
                {Math.round(symbol.rotation)}°
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="359"
              step="1"
              value={Math.round(symbol.rotation)}
              onChange={(e) => handleRotationChange(parseFloat(e.target.value))}
              className="w-full accent-sky-500 cursor-pointer"
            />
            <div className="grid grid-cols-4 gap-1 text-[10px]">
              <button
                onClick={() => handleRotateBy(-90)}
                className="py-1 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300 font-mono-cad"
              >
                -90°
              </button>
              <button
                onClick={() => handleRotationChange(0)}
                className="py-1 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300 font-mono-cad"
              >
                0°
              </button>
              <button
                onClick={() => handleRotationChange(180)}
                className="py-1 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300 font-mono-cad"
              >
                180°
              </button>
              <button
                onClick={() => handleRotateBy(90)}
                className="py-1 bg-neutral-800 hover:bg-neutral-700 rounded text-neutral-300 font-mono-cad"
              >
                +90°
              </button>
            </div>
            <button
              onClick={() => handleRotateBy(180)}
              className="w-full py-1.5 mt-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 rounded text-amber-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              title="عكس اتجاه الرمز بمقدار 180 درجة ليواجه الجهة المقابلة"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>عكس اتجاه الرمز (180°)</span>
            </button>
          </div>

          {/* مقياس الحجم الموسع (البند 6) */}
          <div className="flex flex-col gap-2 bg-neutral-950/60 p-2.5 rounded-lg border border-neutral-800">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                <Maximize size={13} className="text-amber-400" />
                مقياس الحجم الموحد (Scale):
              </span>
              <span className="font-mono-cad text-amber-400 font-bold text-xs">
                {(symbol.scale || 1).toFixed(2)}x
              </span>
            </div>

            {/* حقل رقمي دقيق مع أزرار زيادة ونقصان */}
            <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-lg border border-neutral-800">
              <button
                type="button"
                onClick={() => handleScaleChange(Math.max(0.1, (symbol.scale || 1) - 0.1))}
                className="w-7 h-7 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold flex items-center justify-center border border-neutral-700"
                title="تقليل الحجم بمقدار 0.1x"
              >
                <Minus size={13} />
              </button>
              <input
                type="number"
                min="0.1"
                max="5.0"
                step="0.05"
                value={(symbol.scale || 1).toFixed(2)}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val) && val > 0) handleScaleChange(val);
                }}
                className="flex-1 bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-center font-mono-cad text-xs font-bold text-amber-300 outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={() => handleScaleChange(Math.min(5.0, (symbol.scale || 1) + 0.1))}
                className="w-7 h-7 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold flex items-center justify-center border border-neutral-700"
                title="زيادة الحجم بمقدار 0.1x"
              >
                <Plus size={13} />
              </button>
            </div>

            {/* شريط التمرير بنطاق أوسع (0.1x إلى 5.0x) */}
            <input
              type="range"
              min="0.1"
              max="5.0"
              step="0.05"
              value={symbol.scale || 1}
              onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />

            {/* أزرار المقاييس السريعة */}
            <div className="grid grid-cols-6 gap-1">
              {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleScaleChange(s)}
                  className={`py-1 text-[10px] font-mono-cad rounded border transition-colors ${
                    Math.abs((symbol.scale || 1) - s) < 0.04
                      ? 'bg-amber-600/30 text-amber-300 border-amber-500 font-bold'
                      : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {/* إحداثيات الموقع */}
          <div className="bg-neutral-950/60 p-2.5 rounded-lg border border-neutral-800 flex flex-col gap-1 text-xs">
            <span className="text-neutral-400">إحداثيات الموقع:</span>
            <div className="flex items-center justify-between font-mono-cad text-neutral-300 text-[11px]">
              <span>X: {xMeters} م ({Math.round(symbol.x)} px)</span>
              <span>Y: {yMeters} م ({Math.round(symbol.y)} px)</span>
            </div>
          </div>

          {/* اختيار الطبقة */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <Layers size={14} className="text-sky-400" />
              الطبقة (Layer)
            </label>
            <select
              value={symbol.layerId}
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

          {/* أزرار التكرار والحذف */}
          <div className="flex flex-col gap-2 pt-2 border-t border-neutral-800">
            <button
              onClick={handleDuplicate}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-md transition-colors"
            >
              <Copy size={14} />
              <span>تكرار الرمز</span>
            </button>
            <button
              onClick={handleDelete}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 rounded-md border border-rose-500/40 transition-colors"
            >
              <Trash2 size={14} />
              <span>حذف الرمز</span>
            </button>
          </div>
        </div>
      </aside>
    );
  
};
