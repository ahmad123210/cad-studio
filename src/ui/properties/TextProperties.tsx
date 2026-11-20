/**
 * @file TextProperties.tsx
 * @description لوحة خصائص الملاحظة النصية
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

export const TextProperties: React.FC<PanelContext> = (ctx) => {
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

    const textObj = selectedObject as TextObject;

    const handleTextChange = (newText: string, recordHistory: boolean = false) => {
      model.updateObject(textObj.id, { text: newText }, recordHistory);
    };

    const handleFontSizeChange = (size: number) => {
      const clamped = Math.max(8, Math.min(120, Math.round(size)));
      model.updateObject(textObj.id, { fontSize: clamped });
      updateLastUsedSettings({ textFontSize: clamped });
    };

    const handleColorChange = (color: string) => {
      model.updateObject(textObj.id, { color, borderColor: color });
      updateLastUsedSettings({ textColor: color });
    };

    const handleFontWeightChange = (weight: 'normal' | 'bold') => {
      model.updateObject(textObj.id, { fontWeight: weight });
      updateLastUsedSettings({ textFontWeight: weight });
    };

    const handleAlignChange = (align: 'left' | 'center' | 'right') => {
      model.updateObject(textObj.id, { align });
      updateLastUsedSettings({ textAlign: align });
    };

    const handleRotationChange = (deg: number) => {
      const normalized = ((deg % 360) + 360) % 360;
      model.updateObject(textObj.id, { rotation: Math.round(normalized) });
    };

    const handleToggleBackground = () => {
      const hasBg = textObj.backgroundColor !== 'transparent' && textObj.backgroundOpacity !== 0;
      if (hasBg) {
        model.updateObject(textObj.id, {
          backgroundColor: 'transparent',
          backgroundOpacity: 0,
          borderColor: 'transparent',
        });
      } else {
        model.updateObject(textObj.id, {
          backgroundColor: '#0f172a',
          backgroundOpacity: 0.9,
          borderColor: textObj.color || '#38bdf8',
        });
      }
    };

    const handleDuplicate = () => {
      const offset = 25;
      const newText: TextObject = {
        ...textObj,
        id: 'text_' + Math.random().toString(36).substring(2, 9),
        x: textObj.x + offset,
        y: textObj.y + offset,
      };
      model.addObject(newText);
    };

    const colorPresets = [
      { name: 'سماوي (Sky)', value: '#38bdf8' },
      { name: 'أزرق (Blue)', value: '#0284c7' },
      { name: 'كهرماني (Amber)', value: '#f59e0b' },
      { name: 'أحمر (Red)', value: '#ef4444' },
      { name: 'زمردي (Green)', value: '#10b981' },
      { name: 'بنفسجي (Purple)', value: '#a855f7' },
      { name: 'برتقالي (Orange)', value: '#f97316' },
      { name: 'أبيض (White)', value: '#ffffff' },
      { name: 'رمادي (Slate)', value: '#94a3b8' },
    ];

    const currentFontSize = textObj.fontSize || 16;
    const currentColor = textObj.color || '#38bdf8';
    const currentWeight = textObj.fontWeight || 'normal';
    const currentAlign = textObj.align || 'right';
    const currentRotation = textObj.rotation || 0;
    const hasBackground = textObj.backgroundColor !== 'transparent' && textObj.backgroundOpacity !== 0;

    return (
      <aside className="w-72 bg-neutral-900 border-r border-neutral-800 flex flex-col text-neutral-200 select-none z-10 overflow-y-auto">
        <div className="p-4 flex flex-col gap-4">
          {/* رأس اللوحة */}
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Type size={16} className="text-purple-400" />
                خصائص الملاحظة والتلميح
              </h2>
              <div className="text-[10px] text-purple-400/80 font-mono-cad mt-0.5">
                المعرف: {textObj.id}
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
                title="إلغاء التحديد"
              >
                ✕
              </button>
            </div>
          </div>

          {/* محتوى الملاحظة */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
              <span>نص الملاحظة / التلميح:</span>
              <span className="text-[10px] text-neutral-500 font-mono-cad">
                {(textObj.text || '').length} حرف
              </span>
            </label>
            <NoteTextarea
              key={textObj.id}
              value={textObj.text || ''}
              onSave={handleTextChange}
              placeholder="اكتب الملاحظة أو التلميح الهندسي هنا..."
              accentColorClass="focus:border-purple-500"
              autoSelect={true}
            />
          </div>

          {/* حجم الخط (Font Size) مع إدخال رقمي مباشر وأزرار +/- سريعة */}
          <div className="flex flex-col gap-2 bg-neutral-950/60 p-3 rounded-xl border border-neutral-800">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                <Type size={14} className="text-purple-400" />
                حجم الخط (Font Size):
              </span>
              <span className="font-mono-cad text-purple-300 font-bold">
                {currentFontSize} px
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => handleFontSizeChange(currentFontSize - 1)}
                className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-purple-300 font-bold text-base flex items-center justify-center border border-neutral-700 transition-colors"
                title="تصغير الخط بمقدار 1 بكسل"
              >
                <Minus size={14} />
              </button>
              <div className="flex-1 relative flex items-center">
                <input
                  type="number"
                  min="8"
                  max="120"
                  step="1"
                  value={currentFontSize}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val > 0) handleFontSizeChange(val);
                  }}
                  className="w-full bg-neutral-900 border border-neutral-700 focus:border-purple-500 rounded-lg px-2.5 py-1.5 text-center font-mono-cad text-sm font-bold text-purple-200 outline-none transition-colors"
                />
                <span className="absolute left-2 text-[10px] font-mono-cad text-neutral-400 pointer-events-none">
                  px
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleFontSizeChange(currentFontSize + 1)}
                className="w-8 h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-purple-300 font-bold text-base flex items-center justify-center border border-neutral-700 transition-colors"
                title="تكبير الخط بمقدار 1 بكسل"
              >
                <Plus size={14} />
              </button>
            </div>

            {/* أزرار أحجام شائعة سريعة */}
            <div className="grid grid-cols-6 gap-1 pt-1">
              {[12, 14, 16, 20, 24, 32].map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => handleFontSizeChange(sz)}
                  className={`py-1 text-[11px] font-mono-cad rounded-md border transition-colors ${
                    currentFontSize === sz
                      ? 'bg-purple-600/30 text-purple-300 border-purple-500 font-bold shadow-sm shadow-purple-950'
                      : 'bg-neutral-800/80 text-neutral-400 border-neutral-700 hover:text-white hover:bg-neutral-700'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>

          {/* لون الخط والملاحظة (Color) مع منتقي الألوان ولوحة جاهزة */}
          <div className="flex flex-col gap-2 bg-neutral-950/60 p-3 rounded-xl border border-neutral-800">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                <Palette size={14} className="text-pink-400" />
                لون الخط والبطاقة:
              </span>
              <div className="flex items-center gap-1.5">
                <span
                  className="w-3.5 h-3.5 rounded-full border border-neutral-600 shadow-sm"
                  style={{ backgroundColor: currentColor }}
                />
                <span className="font-mono-cad text-[11px] text-neutral-300">
                  {currentColor}
                </span>
              </div>
            </div>

            {/* لوحة الألوان السريعة */}
            <div className="grid grid-cols-9 gap-1.5">
              {colorPresets.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => handleColorChange(c.value)}
                  className={`w-6 h-6 rounded-full border transition-all ${
                    currentColor.toLowerCase() === c.value.toLowerCase()
                      ? 'ring-2 ring-purple-400 scale-110 border-white'
                      : 'border-neutral-700 hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                />
              ))}
            </div>

            {/* حقل اختيار لون مخصص يدوي */}
            <div className="flex items-center gap-2 pt-1 border-t border-neutral-800/80">
              <input
                type="color"
                value={currentColor.startsWith('#') && currentColor.length === 7 ? currentColor : '#38bdf8'}
                onChange={(e) => handleColorChange(e.target.value)}
                className="w-8 h-8 rounded-lg border border-neutral-700 bg-neutral-800 cursor-pointer p-0.5"
                title="اختر لوناً مخصصاً"
              />
              <input
                type="text"
                value={currentColor}
                onChange={(e) => handleColorChange(e.target.value)}
                className="flex-1 bg-neutral-900 border border-neutral-700 focus:border-purple-500 rounded-lg px-2.5 py-1 text-xs font-mono-cad text-neutral-200 outline-none uppercase"
                placeholder="#38BDF8"
              />
            </div>
          </div>

          {/* سماكة ومحاذاة النص */}
          <div className="grid grid-cols-2 gap-2">
            {/* سماكة الخط */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-neutral-400 font-medium">سماكة الخط:</label>
              <div className="grid grid-cols-2 gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
                <button
                  type="button"
                  onClick={() => handleFontWeightChange('normal')}
                  className={`py-1 text-xs rounded transition-colors ${
                    currentWeight === 'normal'
                      ? 'bg-purple-600/30 text-purple-200 font-medium border border-purple-500/50'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  عادي
                </button>
                <button
                  type="button"
                  onClick={() => handleFontWeightChange('bold')}
                  className={`py-1 text-xs rounded transition-colors flex items-center justify-center gap-1 ${
                    currentWeight === 'bold'
                      ? 'bg-purple-600/30 text-purple-200 font-bold border border-purple-500/50'
                      : 'text-neutral-400 hover:text-white font-bold'
                  }`}
                >
                  <Bold size={12} />
                  <span>عريض</span>
                </button>
              </div>
            </div>

            {/* محاذاة النص */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-neutral-400 font-medium">محاذاة النص:</label>
              <div className="grid grid-cols-3 gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800">
                <button
                  type="button"
                  onClick={() => handleAlignChange('right')}
                  className={`py-1 flex items-center justify-center rounded transition-colors ${
                    currentAlign === 'right'
                      ? 'bg-purple-600/30 text-purple-200 border border-purple-500/50'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="محاذاة لليمين"
                >
                  <AlignRight size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => handleAlignChange('center')}
                  className={`py-1 flex items-center justify-center rounded transition-colors ${
                    currentAlign === 'center'
                      ? 'bg-purple-600/30 text-purple-200 border border-purple-500/50'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="توسيط"
                >
                  <AlignCenter size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => handleAlignChange('left')}
                  className={`py-1 flex items-center justify-center rounded transition-colors ${
                    currentAlign === 'left'
                      ? 'bg-purple-600/30 text-purple-200 border border-purple-500/50'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                  title="محاذاة لليسار"
                >
                  <AlignLeft size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* شكل وخلفية البطاقة */}
          <div className="flex flex-col gap-2 bg-neutral-950/60 p-3 rounded-xl border border-neutral-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-neutral-300">صندوق خلفية الملاحظة:</span>
              <button
                type="button"
                onClick={handleToggleBackground}
                className={`px-2.5 py-1 text-xs rounded-md border font-medium transition-colors ${
                  hasBackground
                    ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white'
                }`}
              >
                {hasBackground ? 'مفعل (بطاقة هندسية)' : 'شفاف (بدون خلفية)'}
              </button>
            </div>
          </div>

          {/* زاوية الدوران (Rotation) */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-300 flex items-center gap-1.5">
                <RotateCw size={14} className="text-amber-400" />
                زاوية الدوران:
              </span>
              <span className="font-mono-cad text-amber-300 font-bold">
                {currentRotation}°
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[0, 90, 180, 270].map((deg) => (
                <button
                  key={deg}
                  type="button"
                  onClick={() => handleRotationChange(deg)}
                  className={`py-1 text-xs font-mono-cad rounded-md border transition-colors ${
                    currentRotation === deg
                      ? 'bg-amber-600/30 text-amber-300 border-amber-500 font-bold'
                      : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white'
                  }`}
                >
                  {deg}°
                </button>
              ))}
            </div>
          </div>

          {/* اختيار الطبقة */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <Layers size={14} className="text-sky-400" />
              الطبقة (Layer)
            </label>
            <select
              value={textObj.layerId}
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
              <span>تكرار الملاحظة</span>
            </button>
            <button
              onClick={handleDelete}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 rounded-md border border-rose-500/40 transition-colors"
            >
              <Trash2 size={14} />
              <span>حذف الملاحظة</span>
            </button>
          </div>
        </div>
      </aside>
    );
  
};
