/**
 * @file RouteProperties.tsx
 * @description لوحة خصائص المسار الكهروميكانيكي
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

export const RouteProperties: React.FC<PanelContext> = (ctx) => {
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

    const route = selectedObject as RouteObject;
    const metaRoute = ROUTE_KINDS_META[route.routeKind];
    const pixelLen = calculateRoutePixelLength(route.points);
    const lengthMeters = Number((pixelLen / pixelsPerMeter).toFixed(2));
    const segments = calculateSegmentLengths(route.points);

    // تغيير نوع المسار وتحديث خواصه المعيارية تلقائياً
    const handleRouteKindChange = (kind: RouteKind) => {
      const newMeta = ROUTE_KINDS_META[kind];
      model.updateObject(route.id, {
        routeKind: kind,
        layerId: newMeta.defaultLayerId,
        material: newMeta.defaultMaterial,
        diameter: newMeta.defaultDiameter,
        strokeWidth: newMeta.defaultStrokeWidth,
        color: newMeta.defaultColor,
      });
    };

    const handleDiameterChange = (diameter: number) => {
      model.updateObject(route.id, { diameter: Math.max(1, diameter) });
    };

    const handleMaterialChange = (material: string) => {
      model.updateObject(route.id, { material });
    };

    const handleLabelChange = (label: string) => {
      model.updateObject(route.id, { label });
    };

    const handleLineStyleChange = (lineStyle: 'solid' | 'dashed' | 'dotted') => {
      model.updateObject(route.id, { lineStyle });
    };

    const handleStrokeWidthChange = (strokeWidth: number) => {
      model.updateObject(route.id, { strokeWidth: Math.max(1, Math.min(10, strokeWidth)) });
    };

    const handleDuplicate = () => {
      const offset = 20;
      const newPoints = route.points.map((p) => ({ x: p.x + offset, y: p.y + offset }));
      const newRoute: RouteObject = {
        ...route,
        id: 'route_' + Math.random().toString(36).substring(2, 9),
        points: newPoints,
        startSymbolId: undefined,
        endSymbolId: undefined,
      };
      model.addObject(newRoute);
    };

    const startSym = route.startSymbolId ? (model.getObjectById(route.startSymbolId) as SymbolObject | undefined) : undefined;
    const endSym = route.endSymbolId ? (model.getObjectById(route.endSymbolId) as SymbolObject | undefined) : undefined;
    const startSymDef = startSym ? getSymbolById(startSym.symbolKind) : undefined;
    const endSymDef = endSym ? getSymbolById(endSym.symbolKind) : undefined;

    return (
      <aside className="w-72 bg-neutral-900 border-r border-neutral-800 flex flex-col text-neutral-200 select-none z-10 overflow-y-auto">
        <div className="p-4 flex flex-col gap-4">
          {/* رأس اللوحة */}
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: route.color || metaRoute.defaultColor }}
                />
                خصائص المسار (Route)
              </h2>
              <div className="text-[10px] text-neutral-400 font-mono-cad mt-0.5">
                المعرف: {route.id}
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

          {/* التسمية التوضيحية للمسار */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-neutral-300">
              التسمية التوضيحية (Label):
            </label>
            <LabelInput
              placeholder="مثال: C-01, مغذي إنارة 1, PPR-Cold"
              value={route.label || ''}
              onSave={(val, recordHistory = true) => model.updateObject(route.id, { label: val }, recordHistory)}
              accentColorClass="focus:border-amber-500"
            />
          </div>

          {/* نوع النظام الكهروميكانيكي */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <GitBranch size={14} className="text-amber-400" />
              نظام المسار (Discipline)
            </label>
            <select
              value={route.routeKind}
              onChange={(e) => handleRouteKindChange(e.target.value as RouteKind)}
              className="bg-neutral-800 border border-neutral-700 rounded-md px-2.5 py-1.5 text-xs text-neutral-100 outline-none focus:border-amber-500 font-medium"
            >
              <option value="electrical">⚡ كهرباء (Electrical Conduit / Cable)</option>
              <option value="water">💧 تغذية مياه (Domestic Water Supply)</option>
              <option value="drainage">🟣 صرف صحي ومطر (Drainage Pipe)</option>
              <option value="hvac">❄️ تكييف ودكتات (HVAC Duct & Pipe)</option>
              <option value="fire">🔥 شبكة إطفاء حريق (Fire Pipeline)</option>
            </select>
          </div>

          {/* قياسات الطول الإجمالي المحسوب */}
          <div className="bg-neutral-950/70 p-3 rounded-xl border border-neutral-800 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-400 font-medium">الطول الحقيقي المحسوب:</span>
              <span className="text-base font-extrabold text-emerald-400 font-mono-cad">
                {lengthMeters} م
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1 border-t border-neutral-800/80">
              <span>الطول بالبكسل:</span>
              <span className="font-mono-cad text-neutral-300">{pixelLen.toFixed(1)} px</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-neutral-400">
              <span>عدد المقاطع (Segments):</span>
              <span className="font-mono-cad text-sky-400 font-semibold">{segments.length} مقطع</span>
            </div>
          </div>

          {/* التحكم بظهور أو إخفاء طول المسار على الرسم */}
          <div className="flex items-center justify-between p-2.5 rounded-xl bg-neutral-950/70 border border-neutral-800">
            <div className="flex items-center gap-2">
              {route.showLength !== false ? (
                <Eye size={16} className="text-emerald-400 shrink-0" />
              ) : (
                <EyeOff size={16} className="text-neutral-500 shrink-0" />
              )}
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-neutral-200">ظهور الطول على المخطط:</span>
                <span className="text-[10px] text-neutral-400">التحكم في ظهور أو إخفاء بطاقة القياس</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => model.updateObject(route.id, { showLength: route.showLength === false ? true : false })}
              className={`px-3 py-1 text-xs rounded-lg font-bold border transition-all cursor-pointer ${
                route.showLength !== false
                  ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/60 hover:bg-emerald-600/40'
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white'
              }`}
            >
              {route.showLength !== false ? 'ظاهر' : 'مخفي'}
            </button>
          </div>

          {/* القطر والمقاس */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-300">القطر / المقاس:</span>
              <span className="font-mono-cad text-amber-400 font-bold">
                {route.diameter} {metaRoute.diameterUnit}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {metaRoute.presetSizes.slice(0, 4).map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => handleDiameterChange(size)}
                  className={`py-1 text-xs rounded border transition-colors font-mono-cad ${
                    route.diameter === size
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                      : 'bg-neutral-800/80 text-neutral-300 border-neutral-700 hover:bg-neutral-700'
                  }`}
                >
                  {size}mm
                </button>
              ))}
            </div>
            <input
              type="number"
              min="1"
              max="500"
              value={route.diameter}
              onChange={(e) => handleDiameterChange(parseFloat(e.target.value) || 20)}
              className="bg-neutral-800 border border-neutral-700 rounded px-2.5 py-1 text-xs text-neutral-100 outline-none mt-1"
              placeholder="مقاس مخصص..."
            />
          </div>

          {/* مادة المسار (Material) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-neutral-300">
              المادة والمواصفة (Material):
            </label>
            <select
              value={route.material || metaRoute.defaultMaterial}
              onChange={(e) => handleMaterialChange(e.target.value)}
              className="bg-neutral-800 border border-neutral-700 rounded-md px-2.5 py-1.5 text-xs text-neutral-100 outline-none"
            >
              {metaRoute.presetMaterials.map((mat) => (
                <option key={mat} value={mat}>
                  {mat}
                </option>
              ))}
            </select>
          </div>

          {/* نمط الخط وسمكه */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] text-neutral-400">نمط الخط:</label>
              <select
                value={route.lineStyle || 'solid'}
                onChange={(e) => handleLineStyleChange(e.target.value as any)}
                className="bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs text-neutral-200 outline-none"
              >
                <option value="solid">مستمر (Solid)</option>
                <option value="dashed">متقطع (Dashed)</option>
                <option value="dotted">منقط (Dotted)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-[11px] text-neutral-400">
                <span>سمك الخط:</span>
                <span className="font-mono-cad text-neutral-200">{route.strokeWidth || 2.5}px</span>
              </div>
              <input
                type="range"
                min="1"
                max="8"
                step="0.5"
                value={route.strokeWidth || 2.5}
                onChange={(e) => handleStrokeWidthChange(parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer mt-1"
              />
            </div>
          </div>

          {/* اختيار الطبقة */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <Layers size={14} className="text-sky-400" />
              الطبقة (Layer)
            </label>
            <select
              value={route.layerId}
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

          {/* رابط سريع لجدول الكميات */}
          {onOpenScheduleBOQ && (
            <button
              onClick={onOpenScheduleBOQ}
              className="w-full py-1.5 px-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
            >
              <FileSpreadsheet size={14} />
              <span>عرض في جدول حصر الكميات (BOQ)</span>
            </button>
          )}

          {/* أزرار التكرار والحذف */}
          <div className="flex flex-col gap-2 pt-2 border-t border-neutral-800">
            <button
              onClick={handleDuplicate}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-md transition-colors"
            >
              <Copy size={14} />
              <span>تكرار المسار</span>
            </button>
            <button
              onClick={handleDelete}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 rounded-md border border-rose-500/40 transition-colors"
            >
              <Trash2 size={14} />
              <span>حذف المسار</span>
            </button>
          </div>
        </div>
      </aside>
    );
  
};
