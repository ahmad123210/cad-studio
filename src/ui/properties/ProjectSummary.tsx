/**
 * @file ProjectSummary.tsx
 * @description لوحة معلومات المشروع (لا يوجد عنصر محدد)
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

export const ProjectSummary: React.FC<PanelContext> = (ctx) => {
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
  // ============================================
  // حالة 7: لا يوجد عنصر محدد (إحصائيات المشروع والمعايرة وجدول الكميات)
  // ============================================
  const allObjects = model.getObjects();
  const totalWalls = allObjects.filter((o) => o.type === 'wall') as WallObject[];
  const totalDoors = allObjects.filter((o) => o.type === 'door') as DoorObject[];
  const totalWindows = allObjects.filter((o) => o.type === 'window') as WindowObject[];
  const totalDimensions = allObjects.filter((o) => o.type === 'dimension') as DimensionObject[];
  const totalSymbols = allObjects.filter((o) => o.type === 'symbol') as SymbolObject[];
  const totalRoutes = allObjects.filter((o) => o.type === 'route') as RouteObject[];
  const totalTexts = allObjects.filter((o) => o.type === 'text') as TextObject[];

  const totalLengthPixels = totalWalls.reduce(
    (sum, w) => sum + SnapEngine.distance(w.start, w.end),
    0
  );
  const formattedTotalLength = GridUtils.formatLength(
    totalLengthPixels,
    pixelsPerMeter,
    meta.unit
  );

  const totalRoutePixels = totalRoutes.reduce(
    (sum, r) => sum + calculateRoutePixelLength(r.points),
    0
  );
  const totalRouteMeters = (totalRoutePixels / pixelsPerMeter).toFixed(2);
  const bg = model.getBackgroundImage();

  return (
    <aside className="w-72 bg-neutral-900 border-r border-neutral-800 flex flex-col text-neutral-200 select-none z-10 overflow-y-auto">
      <div className="p-4 flex flex-col gap-4">
        <div className="pb-3 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Info size={17} className="text-sky-400" />
              لوحة معلومات المشروع
            </h2>
            <p className="text-xs text-neutral-300 mt-1">
              حدد عنصراً لتعديل خصائصه أو استخدم أدوات الرسم وحصر الكميات.
            </p>
          </div>
          {onToggleVisible && (
            <button
              onClick={onToggleVisible}
              className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
              title="إخفاء لوحة معلومات المشروع"
            >
              <PanelRightClose size={17} />
            </button>
          )}
        </div>

        {/* زر بارز لجدول الرموز وحصر الكميات التلقائي */}
        {onOpenScheduleBOQ && (
          <button
            onClick={onOpenScheduleBOQ}
            className="w-full py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-950/40 border border-emerald-400/40 transition-all flex items-center justify-center gap-2 group cursor-pointer"
          >
            <FileSpreadsheet size={17} className="text-emerald-100 group-hover:scale-110 transition-transform" />
            <span>جدول الرموز وحصر الكميات (BOQ)</span>
          </button>
        )}

        {/* إحصائيات عناصر المشروع */}
        <div className="bg-neutral-950/60 p-3.5 rounded-xl border border-neutral-800 flex flex-col gap-2.5">
          <span className="text-sm font-bold text-neutral-200">عناصر المخطط وحصر الكميات</span>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-neutral-900 p-2.5 rounded-lg border border-neutral-800 flex items-center justify-between">
              <span className="text-neutral-300 font-medium">الجدران:</span>
              <span className="font-bold text-white font-mono-cad text-sm">{totalWalls.length}</span>
            </div>
            <div className="bg-neutral-900 p-2.5 rounded-lg border border-neutral-800 flex items-center justify-between">
              <span className="text-neutral-300 font-medium">الأبواب:</span>
              <span className="font-bold text-amber-400 font-mono-cad text-sm">{totalDoors.length}</span>
            </div>
            <div className="bg-neutral-900 p-2.5 rounded-lg border border-neutral-800 flex items-center justify-between">
              <span className="text-neutral-300 font-medium">النوافذ:</span>
              <span className="font-bold text-teal-400 font-mono-cad text-sm">{totalWindows.length}</span>
            </div>
            <div className="bg-neutral-900 p-2.5 rounded-lg border border-neutral-800 flex items-center justify-between">
              <span className="text-neutral-300 font-medium">الأبعاد:</span>
              <span className="font-bold text-indigo-400 font-mono-cad text-sm">{totalDimensions.length}</span>
            </div>
            <div className="bg-neutral-900 p-2.5 rounded-lg border border-neutral-800 flex items-center justify-between">
              <span className="text-neutral-300 font-medium flex items-center gap-1">
                <Zap size={13} className="text-amber-400" />
                الرموز:
              </span>
              <span className="font-bold text-amber-400 font-mono-cad text-sm">{totalSymbols.length}</span>
            </div>
            <div className="bg-neutral-900 p-2.5 rounded-lg border border-neutral-800 flex items-center justify-between">
              <span className="text-neutral-300 font-medium flex items-center gap-1">
                <GitBranch size={13} className="text-sky-400" />
                المسارات:
              </span>
              <span className="font-bold text-sky-400 font-mono-cad text-sm">{totalRoutes.length}</span>
            </div>
            <div className="bg-neutral-900 p-2.5 rounded-lg border border-neutral-800 flex items-center justify-between col-span-2">
              <span className="text-neutral-300 font-medium flex items-center gap-1">
                <Type size={13} className="text-purple-400" />
                الملاحظات والتلميحات:
              </span>
              <span className="font-bold text-purple-400 font-mono-cad text-sm">{totalTexts.length}</span>
            </div>
          </div>

          <div className="flex justify-between items-center text-sm pt-2 border-t border-neutral-800">
            <span className="text-neutral-300 font-medium">مجموع الجدران:</span>
            <span className="font-bold text-emerald-400 font-mono-cad">
              {formattedTotalLength}
            </span>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-neutral-300 font-medium">أطوال المسارات:</span>
            <span className="font-bold text-sky-400 font-mono-cad">
              {totalRouteMeters} م
            </span>
          </div>

          {onOpenSymbolsCatalog && (
            <button
              onClick={onOpenSymbolsCatalog}
              className="mt-1 w-full py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Zap size={14} />
              <span>تصفح مكتبة الرموز الهندسية</span>
            </button>
          )}

          {onOpenExport && (
            <button
              onClick={onOpenExport}
              className="mt-1 w-full py-2 px-3 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm shadow-sky-600/30 cursor-pointer"
            >
              <FileDown size={15} />
              <span>تصدير المخطط الهندسي (PDF)</span>
            </button>
          )}

          {onOpenScheduleBOQ && (
            <button
              onClick={onOpenScheduleBOQ}
              className="mt-1 w-full py-2 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet size={14} />
              <span>جدول وحصر الكميات (BOQ)</span>
            </button>
          )}
        </div>

        {/* إعدادات العناصر الافتراضية للعناصر الجديدة (Last Used Settings) */}
        <div className="bg-neutral-950/60 p-3.5 rounded-xl border border-neutral-800 flex flex-col gap-2.5">
          <span className="text-sm font-bold text-sky-400 flex items-center gap-1.5">
            <Sliders size={14} />
            إعدادات العناصر الجديدة الافتراضية:
          </span>
          <div className="flex flex-col gap-2.5 text-xs">
            <div>
              <span className="text-neutral-300 text-xs font-medium block mb-1">سماكة الجدران الجديدة:</span>
              <PrecisionNumberInput
                value={getLastUsedSettings().wallThickness}
                unit="سم"
                min={5}
                max={100}
                step={5}
                accentColorClass="focus-within:border-sky-400 border-sky-500/30"
                onDecrement={() => updateLastUsedSettings({ wallThickness: Math.max(5, getLastUsedSettings().wallThickness - 5) })}
                onIncrement={() => updateLastUsedSettings({ wallThickness: Math.min(100, getLastUsedSettings().wallThickness + 5) })}
                onChange={(val) => updateLastUsedSettings({ wallThickness: val })}
                presets={[10, 15, 20, 25, 30]}
                onSelectPreset={(p) => updateLastUsedSettings({ wallThickness: p })}
                presetColorClass="bg-sky-600/30 text-sky-300 border-sky-500"
              />
            </div>
            <div>
              <span className="text-neutral-300 text-xs font-medium block mb-1">عرض الأبواب الجديدة:</span>
              {(() => {
                const currentDoorCm = Math.round((getLastUsedSettings().doorWidth / pixelsPerMeter) * 100 * 10) / 10;
                return (
                  <PrecisionNumberInput
                    value={currentDoorCm}
                    unit="سم"
                    min={30}
                    max={250}
                    step={2.5}
                    accentColorClass="focus-within:border-amber-400 border-amber-500/30"
                    onDecrement={() => updateLastUsedSettings({ doorWidth: ((Math.max(30, currentDoorCm - 2.5)) / 100) * pixelsPerMeter })}
                    onIncrement={() => updateLastUsedSettings({ doorWidth: ((Math.min(250, currentDoorCm + 2.5)) / 100) * pixelsPerMeter })}
                    onChange={(cm) => updateLastUsedSettings({ doorWidth: (cm / 100) * pixelsPerMeter })}
                    presets={[70, 80, 90, 100, 120]}
                    onSelectPreset={(p) => updateLastUsedSettings({ doorWidth: (p / 100) * pixelsPerMeter })}
                    presetColorClass="bg-amber-600/30 text-amber-300 border-amber-500"
                  />
                );
              })()}
            </div>
            <div>
              <span className="text-neutral-300 text-xs font-medium block mb-1">عرض النوافذ الجديدة:</span>
              {(() => {
                const currentWinCm = Math.round((getLastUsedSettings().windowWidth / pixelsPerMeter) * 100 * 10) / 10;
                return (
                  <PrecisionNumberInput
                    value={currentWinCm}
                    unit="سم"
                    min={30}
                    max={350}
                    step={5}
                    accentColorClass="focus-within:border-teal-400 border-teal-500/30"
                    onDecrement={() => updateLastUsedSettings({ windowWidth: ((Math.max(30, currentWinCm - 5)) / 100) * pixelsPerMeter })}
                    onIncrement={() => updateLastUsedSettings({ windowWidth: ((Math.min(350, currentWinCm + 5)) / 100) * pixelsPerMeter })}
                    onChange={(cm) => updateLastUsedSettings({ windowWidth: (cm / 100) * pixelsPerMeter })}
                    presets={[60, 80, 100, 120, 150]}
                    onSelectPreset={(p) => updateLastUsedSettings({ windowWidth: (p / 100) * pixelsPerMeter })}
                    presetColorClass="bg-teal-600/30 text-teal-300 border-teal-500"
                  />
                );
              })()}
            </div>
          </div>
        </div>

        {/* المقياس الحقيقي والمعايرة (المرحلة 3) */}
        <div className="bg-emerald-950/20 border border-emerald-800/40 p-3.5 rounded-xl flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-emerald-300 flex items-center gap-1.5">
              <Target size={15} className="text-emerald-400" />
              المقياس الحقيقي (Scale)
            </span>
            <span className="text-xs font-mono-cad bg-emerald-900/60 text-emerald-200 px-2 py-0.5 rounded border border-emerald-700/50 font-bold">
              1م = {pixelsPerMeter} px
            </span>
          </div>
          <p className="text-xs text-neutral-300">
            كل الأطوال والمساحات تُحسب وفقاً لهذا المقياس الحقيقي.
          </p>
          <button
            onClick={onOpenCalibrationModal}
            className="w-full py-2 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Ruler size={14} />
            <span>معايرة مقياس الرسم الآن</span>
          </button>
        </div>

        {/* إعدادات الحفظ التلقائي وملفات ويندوز (المرحلة 4) */}
        <div className="bg-sky-950/20 border border-sky-800/40 p-3.5 rounded-xl flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-sky-300 text-sm flex items-center gap-1.5">
              <HardDrive size={15} className="text-sky-400" />
              الحفظ التلقائي وملفات ويندوز
            </span>
            <span className="text-xs font-mono-cad bg-sky-900/60 text-sky-200 px-2 py-0.5 rounded border border-sky-700/50">
              {getLastUsedSettings().autoSaveEnabled ? 'تلقائي مفعل' : 'يدوي'}
            </span>
          </div>
          <p className="text-xs text-neutral-300 truncate dir-ltr text-left font-mono-cad">
            {getLastUsedSettings().lastSavedPath
              ? getLastUsedSettings().lastSavedPath?.split(/[\\/]/).pop()
              : 'لم يُحدد مسار الملف على القرص بعد'}
          </p>
          {onOpenSettings && (
            <button
              onClick={onOpenSettings}
              className="w-full py-2 text-xs bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/40 font-semibold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Settings size={14} />
              <span>إعدادات الحفظ والمسار</span>
            </button>
          )}
        </div>

        {/* حالة صورة المخطط المرجعية في الخلفية */}
        <div className="bg-neutral-950/50 p-3.5 rounded-xl border border-neutral-800 flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-neutral-200 text-sm flex items-center gap-1.5">
              <ImageIcon size={15} className="text-teal-400" />
              صورة الخلفية المرجعية
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded font-medium ${
                bg ? 'bg-teal-950 text-teal-400 border border-teal-800' : 'text-neutral-500'
              }`}
            >
              {bg ? 'موجودة' : 'فارغ'}
            </span>
          </div>
          <button
            onClick={onOpenBackgroundModal}
            className="w-full py-2 text-xs bg-neutral-800 hover:bg-neutral-700 text-teal-300 rounded-lg border border-neutral-700 transition-colors flex items-center justify-center gap-1.5 font-semibold cursor-pointer"
          >
            <ImageIcon size={14} />
            <span>{bg ? 'إدارة صورة الخلفية' : 'استيراد صورة مخطط'}</span>
          </button>
        </div>

        {/* الطبقة النشطة حالياً */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
            <Layers size={15} className="text-sky-400" />
            طبقة الرسم الحالية (Active Layer)
          </label>
          <select
            value={model.getActiveLayerId()}
            onChange={(e) => model.setActiveLayerId(e.target.value)}
            className="bg-neutral-800 border border-neutral-700 rounded-lg px-2.5 py-2 text-xs text-neutral-100 outline-none focus:border-sky-500 font-medium"
          >
            {layers.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        {/* تنظيف مساحة العمل */}
        {allObjects.length > 0 && (
          <button
            onClick={onClearCanvas}
            className="mt-auto flex items-center justify-center gap-1.5 py-2 text-xs bg-neutral-800 hover:bg-rose-950/40 text-neutral-400 hover:text-rose-300 rounded-md border border-neutral-700 hover:border-rose-800/50 transition-colors"
          >
            <ShieldAlert size={14} />
            <span>تفريغ كل العناصر</span>
          </button>
        )}
      </div>
    </aside>
  );
};
