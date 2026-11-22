/**
 * @file MultiSelectionProperties.tsx
 * @description لوحة خصائص التحديد المتعدد والتعديل الجماعي
 * (مُستخرج من PropertiesPanel.tsx دون تغيير في السلوك)
 */

import { CircuitFields } from './CircuitFields.tsx';
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

export const MultiSelectionProperties: React.FC<PanelContext> = (ctx) => {
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

    const selectedObjects = model.getObjects().filter((obj) => selectedObjectIds.includes(obj.id));
    const totalSelected = selectedObjects.length;
    const wallsCount = selectedObjects.filter((o) => o.type === 'wall').length;
    const doorsCount = selectedObjects.filter((o) => o.type === 'door').length;
    const windowsCount = selectedObjects.filter((o) => o.type === 'window').length;
    const symbolsCount = selectedObjects.filter((o) => o.type === 'symbol').length;
    const routesCount = selectedObjects.filter((o) => o.type === 'route').length;
    const dimensionsCount = selectedObjects.filter((o) => o.type === 'dimension').length;
    const textsCount = selectedObjects.filter((o) => o.type === 'text').length;

    const isAllWalls = wallsCount === totalSelected && totalSelected > 0;
    const isAllDoors = doorsCount === totalSelected && totalSelected > 0;
    const isAllWindows = windowsCount === totalSelected && totalSelected > 0;
    const isAllSymbols = symbolsCount === totalSelected && totalSelected > 0;
    const isAllTexts = textsCount === totalSelected && totalSelected > 0;
    const isAllRoutes = routesCount === totalSelected && totalSelected > 0;

    const handleBulkLayerChange = (layerId: string) => {
      model.updateObjects(selectedObjectIds, { layerId });
    };

    const handleBulkColorChange = (color: string) => {
      model.updateObjects(selectedObjectIds, { color });
    };

    const handleBulkDuplicate = () => {
      const offset = 30;
      selectedObjects.forEach((obj) => {
        if (obj.type === 'wall') {
          const w = obj as WallObject;
          model.addObject({
            ...w,
            id: 'wall_' + Math.random().toString(36).substring(2, 9),
            start: { x: w.start.x + offset, y: w.start.y + offset },
            end: { x: w.end.x + offset, y: w.end.y + offset },
          });
        } else if (obj.type === 'symbol') {
          const s = obj as SymbolObject;
          model.addObject({
            ...s,
            id: 'sym_' + Math.random().toString(36).substring(2, 9),
            x: s.x + offset,
            y: s.y + offset,
          });
        } else if (obj.type === 'route') {
          const r = obj as RouteObject;
          model.addObject({
            ...r,
            id: 'route_' + Math.random().toString(36).substring(2, 9),
            points: r.points.map((p) => ({ x: p.x + offset, y: p.y + offset })),
          });
        } else if (obj.type === 'text') {
          const t = obj as TextObject;
          model.addObject({
            ...t,
            id: 'text_' + Math.random().toString(36).substring(2, 9),
            x: t.x + offset,
            y: t.y + offset,
          });
        }
      });
    };

    const handleBulkDelete = () => {
      model.deleteObjects(selectedObjectIds);
      onClearSelection();
    };

    // Bulk Wall Thickness
    const handleBulkWallThickness = (newThickness: number) => {
      const t = Math.max(5, Math.min(100, newThickness));
      model.updateObjects(selectedObjectIds, { thickness: t });
      updateLastUsedSettings({ wallThickness: t });
    };

    // Bulk Wall Reverse
    const handleBulkWallReverse = () => {
      selectedObjects.forEach((obj, idx) => {
        if (obj.type === 'wall') {
          const w = obj as WallObject;
          model.updateObject(
            w.id,
            { start: { ...w.end }, end: { ...w.start } },
            idx === selectedObjects.length - 1
          );
        }
      });
    };

    // Bulk Door Width
    const handleBulkDoorWidth = (wPx: number) => {
      const finalW = Math.max(15, Math.min(250, wPx));
      model.updateObjects(selectedObjectIds, { width: finalW });
      updateLastUsedSettings({ doorWidth: finalW });
    };

    // Bulk Door Direction
    const handleBulkDoorDirection = (dir: DoorOpenDirection) => {
      model.updateObjects(selectedObjectIds, { openDirection: dir });
      updateLastUsedSettings({ doorDirection: dir });
    };

    // Bulk Window Width
    const handleBulkWindowWidth = (wPx: number) => {
      const finalW = Math.max(15, Math.min(300, wPx));
      model.updateObjects(selectedObjectIds, { width: finalW });
      updateLastUsedSettings({ windowWidth: finalW });
    };

    // Bulk Window Height & Sill
    const handleBulkWindowHeight = (h: number) => {
      model.updateObjects(selectedObjectIds, { height: h });
      updateLastUsedSettings({ windowHeight: h });
    };
    const handleBulkWindowSillHeight = (s: number) => {
      model.updateObjects(selectedObjectIds, { sillHeight: s });
      updateLastUsedSettings({ windowSillHeight: s });
    };

    // Bulk Symbol Rotation & Scale & Label
    const handleBulkSymbolRotate = (angleDelta: number) => {
      selectedObjects.forEach((obj, idx) => {
        if (obj.type === 'symbol') {
          const s = obj as SymbolObject;
          const newRot = ((s.rotation || 0) + angleDelta + 360) % 360;
          model.updateObject(s.id, { rotation: newRot }, idx === selectedObjects.length - 1);
        }
      });
    };

    const handleBulkSymbolExactRotate = (deg: number) => {
      const normalized = ((deg % 360) + 360) % 360;
      model.updateObjects(selectedObjectIds, { rotation: Math.round(normalized) });
    };

    const handleBulkSymbolScale = (scaleVal: number) => {
      const clamped = Math.max(0.2, Math.min(5, Math.round(scaleVal * 100) / 100));
      model.updateObjects(selectedObjectIds, { scale: clamped });
    };

    const handleBulkSymbolLabel = (label: string) => {
      model.updateObjects(selectedObjectIds, { label });
    };

    const handleBulkSymbolColor = (color?: string) => {
      model.updateObjects(selectedObjectIds, { color: color || undefined });
    };

    // Bulk Text Handlers (حجم الخط واللون والسماكة والمحاذاة لكافة النصوص)
    const handleBulkTextFontSize = (size: number) => {
      const clamped = Math.max(8, Math.min(120, Math.round(size)));
      model.updateObjects(selectedObjectIds, { fontSize: clamped });
      updateLastUsedSettings({ textFontSize: clamped });
    };

    const handleBulkTextColor = (color: string) => {
      model.updateObjects(selectedObjectIds, { color, borderColor: color });
      updateLastUsedSettings({ textColor: color });
    };

    const handleBulkTextWeight = (fontWeight: 'normal' | 'bold') => {
      model.updateObjects(selectedObjectIds, { fontWeight });
      updateLastUsedSettings({ textFontWeight: fontWeight });
    };

    const handleBulkTextAlign = (align: 'left' | 'center' | 'right') => {
      model.updateObjects(selectedObjectIds, { align });
      updateLastUsedSettings({ textAlign: align });
    };

    // Bulk Route Handlers (المسارات والكابلات والمواسير المشتركة)
    const handleBulkRouteDiameter = (diameter: number) => {
      const d = Math.max(10, Math.min(300, Math.round(diameter)));
      model.updateObjects(selectedObjectIds, { diameter: d });
    };

    const handleBulkRouteMaterial = (material: string) => {
      model.updateObjects(selectedObjectIds, { material });
    };

    const handleBulkRouteLineStyle = (lineStyle: 'solid' | 'dashed' | 'dotted') => {
      model.updateObjects(selectedObjectIds, { lineStyle });
    };

    const handleBulkRouteColor = (color: string) => {
      model.updateObjects(selectedObjectIds, { color });
    };

    const handleBulkRouteStrokeWidth = (strokeWidth: number) => {
      const w = Math.max(1, Math.min(20, Math.round(strokeWidth)));
      model.updateObjects(selectedObjectIds, { strokeWidth: w });
    };

    // القيم المشتركة الحالية إن اتفقت
    const sampleWall = isAllWalls ? (selectedObjects[0] as WallObject) : null;
    const sampleDoor = isAllDoors ? (selectedObjects[0] as DoorObject) : null;
    const sampleWindow = isAllWindows ? (selectedObjects[0] as WindowObject) : null;
    const sampleText = isAllTexts ? (selectedObjects[0] as TextObject) : null;
    const sampleRoute = isAllRoutes ? (selectedObjects[0] as RouteObject) : null;
    const sampleSymbol = isAllSymbols ? (selectedObjects[0] as SymbolObject) : null;

    return (
      <aside className="w-72 bg-neutral-900 border-r border-neutral-800 flex flex-col text-neutral-200 select-none z-10 overflow-y-auto">
        <div className="p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Boxes size={16} className="text-sky-400" />
                {isAllWalls
                  ? `تعديل الجدران (${wallsCount} جدار)`
                  : isAllDoors
                  ? `تعديل الأبواب (${doorsCount} باب)`
                  : isAllWindows
                  ? `تعديل النوافذ (${windowsCount} نافذة)`
                  : isAllSymbols
                  ? `تعديل الرموز (${symbolsCount} رمز)`
                  : isAllRoutes
                  ? `تعديل المسارات (${routesCount} مسار)`
                  : isAllTexts
                  ? `تعديل الملاحظات (${textsCount} ملاحظة)`
                  : `تحديد متعدد (${selectedObjectIds.length} عناصر)`}
              </h2>
              <div className="text-[10px] text-sky-400/80 font-mono-cad mt-0.5">
                {isAllWalls || isAllDoors || isAllWindows || isAllSymbols || isAllRoutes || isAllTexts
                  ? 'تعديل الخصائص المشتركة دفعة واحدة'
                  : 'تحديد متعدد لعناصر متنوعة'}
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

          {/* 1. حالة: جميع العناصر المحددة جدران (All Walls) */}
          {isAllWalls && sampleWall && (
            <div className="flex flex-col gap-3 bg-neutral-950/60 p-3 rounded-xl border border-sky-500/30">
              <span className="text-xs font-semibold text-sky-300 flex items-center gap-1.5">
                <Maximize size={14} />
                سماكة الجدران المشتركة ({wallsCount} جدار):
              </span>

              <PrecisionNumberInput
                value={sampleWall.thickness}
                unit="سم"
                min={5}
                max={100}
                step={1}
                accentColorClass="focus-within:border-sky-400 border-sky-500/40"
                onDecrement={() => handleBulkWallThickness(Math.max(5, sampleWall.thickness - 5))}
                onIncrement={() => handleBulkWallThickness(Math.min(100, sampleWall.thickness + 5))}
                decrementTitle="تقليل 5 سم"
                incrementTitle="زيادة 5 سم"
                onChange={(val) => handleBulkWallThickness(val)}
                presets={[10, 15, 20, 25, 30]}
                onSelectPreset={(p) => handleBulkWallThickness(p)}
                presetColorClass="bg-sky-600/30 text-sky-300 border-sky-500"
              />

              {/* زر عكس اتجاه كافة الجدران */}
              <button
                onClick={handleBulkWallReverse}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg border border-neutral-700 transition-colors mt-1"
                title="عكس اتجاه البداية والنهاية لكافة الجدران المحددة"
              >
                <ArrowRightLeft size={13} className="text-sky-400" />
                <span>عكس اتجاه كافة الجدران</span>
              </button>
            </div>
          )}

          {/* 2. حالة: جميع العناصر المحددة أبواب (All Doors) */}
          {isAllDoors && sampleDoor && (
            <div className="flex flex-col gap-3 bg-neutral-950/60 p-3 rounded-xl border border-amber-500/30">
              <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                <DoorOpen size={14} />
                عرض فتحة الأبواب المشترك ({doorsCount} باب):
              </span>

              {(() => {
                const doorWidthCm = Math.round((sampleDoor.width / pixelsPerMeter) * 100 * 10) / 10;
                return (
                  <PrecisionNumberInput
                    value={doorWidthCm}
                    unit="سم"
                    min={30}
                    max={250}
                    step={0.5}
                    accentColorClass="focus-within:border-amber-400 border-amber-500/40"
                    onDecrement={() => handleBulkDoorWidth((Math.max(30, doorWidthCm - 2.5) / 100) * pixelsPerMeter)}
                    onIncrement={() => handleBulkDoorWidth((Math.min(250, doorWidthCm + 2.5) / 100) * pixelsPerMeter)}
                    decrementTitle="تقليل 2.5 سم"
                    incrementTitle="زيادة 2.5 سم"
                    onChange={(val) => handleBulkDoorWidth((val / 100) * pixelsPerMeter)}
                    presets={[70, 80, 90, 100, 120]}
                    onSelectPreset={(p) => handleBulkDoorWidth((p / 100) * pixelsPerMeter)}
                    presetColorClass="bg-amber-600/30 text-amber-300 border-amber-500"
                  />
                );
              })()}

              <div className="flex flex-col gap-1.5 pt-2 border-t border-neutral-800">
                <span className="text-[11px] text-neutral-300 font-semibold">اتجاه الفتح للكل:</span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => handleBulkDoorDirection('inward_right')}
                    className="py-1 text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded border border-neutral-700"
                  >
                    للداخل (يمين)
                  </button>
                  <button
                    onClick={() => handleBulkDoorDirection('inward_left')}
                    className="py-1 text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded border border-neutral-700"
                  >
                    للداخل (يسار)
                  </button>
                  <button
                    onClick={() => handleBulkDoorDirection('outward_right')}
                    className="py-1 text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded border border-neutral-700"
                  >
                    للخارج (يمين)
                  </button>
                  <button
                    onClick={() => handleBulkDoorDirection('outward_left')}
                    className="py-1 text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded border border-neutral-700"
                  >
                    للخارج (يسار)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 3. حالة: جميع العناصر المحددة نوافذ (All Windows) */}
          {isAllWindows && sampleWindow && (
            <div className="flex flex-col gap-3 bg-neutral-950/60 p-3 rounded-xl border border-teal-500/30">
              <span className="text-xs font-semibold text-teal-300 flex items-center gap-1.5">
                <AppWindow size={14} />
                عرض فتحة النوافذ المشترك ({windowsCount} نافذة):
              </span>

              {(() => {
                const winWidthCm = Math.round((sampleWindow.width / pixelsPerMeter) * 100 * 10) / 10;
                return (
                  <PrecisionNumberInput
                    value={winWidthCm}
                    unit="سم"
                    min={30}
                    max={350}
                    step={0.5}
                    accentColorClass="focus-within:border-teal-400 border-teal-500/40"
                    onDecrement={() => handleBulkWindowWidth((Math.max(30, winWidthCm - 5) / 100) * pixelsPerMeter)}
                    onIncrement={() => handleBulkWindowWidth((Math.min(350, winWidthCm + 5) / 100) * pixelsPerMeter)}
                    decrementTitle="تقليل 5 سم"
                    incrementTitle="زيادة 5 سم"
                    onChange={(val) => handleBulkWindowWidth((val / 100) * pixelsPerMeter)}
                    presets={[60, 80, 100, 120, 150]}
                    onSelectPreset={(p) => handleBulkWindowWidth((p / 100) * pixelsPerMeter)}
                    presetColorClass="bg-teal-600/30 text-teal-300 border-teal-500"
                  />
                );
              })()}

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-neutral-800">
                      <div>
                        <label className="text-[10px] text-neutral-400 block mb-1">الارتفاع (م):</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0.4"
                          max="3"
                          defaultValue={sampleWindow.height || 1.2}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val) && val > 0) handleBulkWindowHeight(val);
                          }}
                          className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs font-mono-cad text-neutral-200 outline-none focus:border-teal-500 text-center"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-neutral-400 block mb-1">الجلسة (م):</label>
                        <input
                          type="number"
                          step="0.1"
                          min="0"
                          max="2"
                          defaultValue={sampleWindow.sillHeight || 0.9}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) handleBulkWindowSillHeight(val);
                          }}
                          className="w-full bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-xs font-mono-cad text-neutral-200 outline-none focus:border-teal-500 text-center"
                        />
                      </div>
                    </div>
            </div>
          )}

          {/* 4. حالة: جميع العناصر المحددة رموز MEP */}
          {isAllSymbols && sampleSymbol && (
            <div className="flex flex-col gap-3 bg-neutral-950/60 p-3 rounded-xl border border-amber-500/30">
              <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                <RotateCw size={14} />
                تعديل الرموز المشتركة ({symbolsCount} رمز):
              </span>

              {/* تدوير الرموز المشتركة */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-300">زاوية الدوران:</span>
                  <span className="font-mono-cad text-amber-300 font-bold">
                    {sampleSymbol.rotation || 0}°
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[0, 90, 180, 270].map((deg) => (
                    <button
                      key={deg}
                      onClick={() => handleBulkSymbolExactRotate(deg)}
                      className={`py-1 text-[10px] font-mono-cad rounded border transition-colors ${
                        (sampleSymbol.rotation || 0) === deg
                          ? 'bg-amber-600/30 text-amber-300 border-amber-500 font-bold'
                          : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white'
                      }`}
                    >
                      {deg}°
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1.5 mt-1">
                  <button
                    onClick={() => handleBulkSymbolRotate(90)}
                    className="py-1 text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded border border-neutral-700 flex items-center justify-center gap-1"
                  >
                    <RotateCw size={11} className="text-amber-400" />
                    <span>+90°</span>
                  </button>
                  <button
                    onClick={() => handleBulkSymbolRotate(180)}
                    className="py-1 text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded border border-neutral-700 flex items-center justify-center gap-1"
                  >
                    <RotateCw size={11} className="text-amber-400" />
                    <span>عكس 180°</span>
                  </button>
                </div>
              </div>

              {/* تطبيق لون موحد لكافة الرموز المحددة (البند 4) */}
              <div className="flex flex-col gap-1.5 pt-2 border-t border-neutral-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-300 flex items-center gap-1.5">
                    <Palette size={13} className="text-amber-400" />
                    تطبيق لون موحد للرموز:
                  </span>
                  <span className="font-mono-cad text-[11px] text-neutral-400">
                    {sampleSymbol.color ? sampleSymbol.color.toUpperCase() : 'لون الطبقة'}
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
                      onClick={() => handleBulkSymbolColor(c.hex)}
                      title={c.title}
                      className="h-6 rounded border border-neutral-700 hover:scale-110 transition-transform"
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <label className="flex items-center gap-1 text-[11px] text-neutral-400 cursor-pointer">
                    <span>مخصص:</span>
                    <input
                      type="color"
                      value={sampleSymbol.color || '#f59e0b'}
                      onChange={(e) => handleBulkSymbolColor(e.target.value)}
                      className="w-6 h-6 rounded border border-neutral-700 bg-transparent cursor-pointer p-0"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => handleBulkSymbolColor(undefined)}
                    className="flex-1 py-1 text-[10px] text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded border border-neutral-700 transition-colors"
                  >
                    إعادة تعيين للون الطبقة
                  </button>
                </div>
              </div>

              {/* مقياس التكبير الموحد للرموز (Scale - البند 6) */}
              <div className="flex flex-col gap-2 pt-2 border-t border-neutral-800">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-300 flex items-center gap-1.5">
                    <Maximize size={13} className="text-amber-400" />
                    مقياس الحجم المشترك (Scale):
                  </span>
                  <span className="font-mono-cad text-amber-300 font-bold text-xs">
                    {(sampleSymbol.scale || 1).toFixed(2)}x
                  </span>
                </div>

                <div className="flex items-center gap-1 bg-neutral-900 p-1 rounded-lg border border-neutral-800">
                  <button
                    type="button"
                    onClick={() => handleBulkSymbolScale(Math.max(0.1, (sampleSymbol.scale || 1) - 0.1))}
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
                    value={(sampleSymbol.scale || 1).toFixed(2)}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val > 0) handleBulkSymbolScale(val);
                    }}
                    className="flex-1 bg-neutral-950 border border-neutral-700 rounded px-2 py-1 text-center font-mono-cad text-xs font-bold text-amber-300 outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleBulkSymbolScale(Math.min(5.0, (sampleSymbol.scale || 1) + 0.1))}
                    className="w-7 h-7 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-bold flex items-center justify-center border border-neutral-700"
                    title="زيادة الحجم بمقدار 0.1x"
                  >
                    <Plus size={13} />
                  </button>
                </div>

                <input
                  type="range"
                  min="0.1"
                  max="5.0"
                  step="0.05"
                  value={sampleSymbol.scale || 1}
                  onChange={(e) => handleBulkSymbolScale(parseFloat(e.target.value))}
                  className="w-full accent-amber-500 cursor-pointer"
                />

                <div className="grid grid-cols-6 gap-1">
                  {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleBulkSymbolScale(s)}
                      className={`py-1 text-[10px] font-mono-cad rounded border transition-colors ${
                        Math.abs((sampleSymbol.scale || 1) - s) < 0.04
                          ? 'bg-amber-600/30 text-amber-300 border-amber-500 font-bold'
                          : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white'
                      }`}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>

              {/* تسمية توضيحية موحدة لكافة الرموز */}
              <div className="flex flex-col gap-1.5 pt-2 border-t border-neutral-800">
                <span className="text-xs text-neutral-300">تسمية توضيحية موحدة:</span>
                <input
                  type="text"
                  value={sampleSymbol.label || ''}
                  onChange={(e) => handleBulkSymbolLabel(e.target.value)}
                  placeholder="مثال: P-01 أو SW-1..."
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1 text-xs text-neutral-100 outline-none focus:border-amber-500"
                />
              </div>
            </div>
          )}

          {/* 5. حالة: جميع العناصر المحددة ملاحظات وتلميحات نصية */}
          {isAllTexts && sampleText && (
            <div className="flex flex-col gap-3 bg-neutral-950/60 p-3 rounded-xl border border-purple-500/30">
              <span className="text-xs font-semibold text-purple-300 flex items-center gap-1.5">
                <Type size={14} />
                تعديل خصائص الملاحظات المشتركة ({textsCount} ملاحظة):
              </span>

              {/* تعديل حجم الخط المشترك */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-300">حجم الخط:</span>
                  <span className="font-mono-cad text-purple-300 font-bold">
                    {sampleText.fontSize || 16} px
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleBulkTextFontSize((sampleText.fontSize || 16) - 1)}
                    className="w-7 h-7 rounded bg-neutral-800 hover:bg-neutral-700 text-purple-300 font-bold flex items-center justify-center border border-neutral-700"
                  >
                    <Minus size={13} />
                  </button>
                  <input
                    type="number"
                    min="8"
                    max="120"
                    step="1"
                    value={sampleText.fontSize || 16}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val > 0) handleBulkTextFontSize(val);
                    }}
                    className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1 text-center font-mono-cad text-xs font-bold text-purple-200 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleBulkTextFontSize((sampleText.fontSize || 16) + 1)}
                    className="w-7 h-7 rounded bg-neutral-800 hover:bg-neutral-700 text-purple-300 font-bold flex items-center justify-center border border-neutral-700"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>

              {/* تعديل اللون المشترك */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-neutral-300">تطبيق لون موحد:</label>
                <div className="grid grid-cols-6 gap-1">
                  {['#38bdf8', '#f59e0b', '#ef4444', '#10b981', '#a855f7', '#ffffff'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handleBulkTextColor(c)}
                      className="h-6 rounded-md border border-neutral-700 hover:scale-105 transition-transform"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 6. حالة: جميع العناصر المحددة مسارات كهروميكانيكية (All Routes) */}
          {isAllRoutes && sampleRoute && (
            <div className="flex flex-col gap-3 bg-neutral-950/60 p-3 rounded-xl border border-sky-500/30">
              <span className="text-xs font-semibold text-sky-300 flex items-center gap-1.5">
                <GitBranch size={14} />
                تعديل خصائص المسارات المشتركة ({routesCount} مسار):
              </span>

              {/* قطر المسار (مم) */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-neutral-300">القطر / المقاس المشترك:</span>
                  <span className="font-mono-cad text-sky-400 font-bold">
                    {sampleRoute.diameter || 20} مم
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-neutral-900 p-1.5 rounded-lg border border-neutral-800">
                  <button
                    onClick={() => handleBulkRouteDiameter(Math.max(10, (sampleRoute.diameter || 20) - 5))}
                    className="w-7 h-7 rounded bg-neutral-800 hover:bg-neutral-700 text-sky-400 font-bold text-sm flex items-center justify-center border border-neutral-700"
                    title="تقليل 5 مم"
                  >
                    <Minus size={13} />
                  </button>
                  <div className="flex-1 relative flex items-center">
                    <input
                      type="number"
                      step="1"
                      min="10"
                      max="300"
                      value={sampleRoute.diameter || 20}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val > 0) handleBulkRouteDiameter(val);
                      }}
                      className="w-full bg-neutral-950 border border-sky-500/40 rounded px-2.5 py-1 text-center font-mono-cad text-sm font-bold text-sky-300 outline-none"
                    />
                    <span className="absolute left-2 text-[10px] font-mono-cad text-neutral-400 pointer-events-none">
                      مم
                    </span>
                  </div>
                  <button
                    onClick={() => handleBulkRouteDiameter(Math.min(300, (sampleRoute.diameter || 20) + 5))}
                    className="w-7 h-7 rounded bg-neutral-800 hover:bg-neutral-700 text-sky-400 font-bold text-sm flex items-center justify-center border border-neutral-700"
                    title="زيادة 5 مم"
                  >
                    <Plus size={13} />
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  {[16, 20, 25, 32, 50, 100].map((d) => (
                    <button
                      key={d}
                      onClick={() => handleBulkRouteDiameter(d)}
                      className={`flex-1 py-1 text-[10px] font-mono-cad rounded border transition-colors ${
                        (sampleRoute.diameter || 20) === d
                          ? 'bg-sky-600/30 text-sky-300 border-sky-500 font-bold'
                          : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white'
                      }`}
                    >
                      {d}مم
                    </button>
                  ))}
                </div>
              </div>

              {/* نمط خط المسار (Line Style) */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-neutral-300">نمط الخط المشترك:</span>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { id: 'solid', label: 'مصمت' },
                    { id: 'dashed', label: 'متقطع' },
                    { id: 'dotted', label: 'منقط' },
                  ].map((st) => (
                    <button
                      key={st.id}
                      onClick={() => handleBulkRouteLineStyle(st.id as 'solid' | 'dashed' | 'dotted')}
                      className={`py-1 text-[10px] rounded border transition-colors ${
                        (sampleRoute.lineStyle || 'solid') === st.id
                          ? 'bg-sky-600/30 text-sky-300 border-sky-500 font-bold'
                          : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* خامة ومواصفة المسار */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-neutral-300">المواصفة والخامة المشتركة:</span>
                <input
                  type="text"
                  value={sampleRoute.material || ''}
                  onChange={(e) => handleBulkRouteMaterial(e.target.value)}
                  placeholder="مثال: PVC Conduit, Black Steel..."
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-neutral-100 outline-none focus:border-sky-500"
                />
                <div className="flex flex-wrap gap-1">
                  {['PVC Conduit', 'Black Steel Sch 40', 'Copper Type L', 'HDPE PN16', 'EMT Conduit'].map((mat) => (
                    <button
                      key={mat}
                      onClick={() => handleBulkRouteMaterial(mat)}
                      className="px-2 py-0.5 text-[9px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded border border-neutral-700"
                    >
                      {mat}
                    </button>
                  ))}
                </div>
              </div>

              {/* إظهار أو إخفاء أطوال المسارات المشتركة على الرسم */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-neutral-900 border border-neutral-800">
                <div className="flex items-center gap-1.5">
                  <Eye size={13} className="text-sky-400" />
                  <span className="text-xs text-neutral-200 font-semibold">أطوال المسارات على الرسم:</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => model.updateObjects(selectedObjectIds, { showLength: true })}
                    className="px-2.5 py-1 text-[10px] rounded bg-emerald-600/30 text-emerald-300 border border-emerald-500 font-bold hover:bg-emerald-600/40 cursor-pointer"
                  >
                    إظهار الكل
                  </button>
                  <button
                    type="button"
                    onClick={() => model.updateObjects(selectedObjectIds, { showLength: false })}
                    className="px-2.5 py-1 text-[10px] rounded bg-neutral-800 text-neutral-400 border border-neutral-700 hover:text-white cursor-pointer"
                  >
                    إخفاء الكل
                  </button>
                </div>
              </div>

              {/* ألوان المسار المشتركة */}
              <div className="flex flex-col gap-1.5">
                <span className="text-xs text-neutral-300">تطبيق لون موحد لكافة المسارات:</span>
                <div className="grid grid-cols-6 gap-1">
                  {['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handleBulkRouteColor(c)}
                      className="h-6 rounded-md border border-neutral-700 hover:scale-105 transition-transform"
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* تفاصيل العناصر المحددة (عند الاختلاط) */}
          {!isAllWalls && !isAllDoors && !isAllWindows && !isAllSymbols && !isAllRoutes && !isAllTexts && (
            <div className="bg-neutral-950/60 p-3 rounded-xl border border-neutral-800 flex flex-col gap-2">
              <span className="text-xs font-semibold text-neutral-300">مكونات التحديد الحالي:</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {wallsCount > 0 && (
                  <div className="bg-neutral-900 p-2 rounded border border-neutral-800 flex items-center justify-between">
                    <span className="text-neutral-400">جدران:</span>
                    <span className="font-bold text-sky-400 font-mono-cad">{wallsCount}</span>
                  </div>
                )}
                {doorsCount > 0 && (
                  <div className="bg-neutral-900 p-2 rounded border border-neutral-800 flex items-center justify-between">
                    <span className="text-neutral-400">أبواب:</span>
                    <span className="font-bold text-amber-400 font-mono-cad">{doorsCount}</span>
                  </div>
                )}
                {windowsCount > 0 && (
                  <div className="bg-neutral-900 p-2 rounded border border-neutral-800 flex items-center justify-between">
                    <span className="text-neutral-400">نوافذ:</span>
                    <span className="font-bold text-teal-400 font-mono-cad">{windowsCount}</span>
                  </div>
                )}
                {symbolsCount > 0 && (
                  <div className="col-span-full">
                    <CircuitFields model={model} symbols={selectedObjects.filter((o) => o.type === 'symbol') as SymbolObject[]} />
                  </div>
                )}
                {symbolsCount > 0 && (
                  <div className="bg-neutral-900 p-2 rounded border border-neutral-800 flex items-center justify-between">
                    <span className="text-neutral-400">رموز MEP:</span>
                    <span className="font-bold text-amber-400 font-mono-cad">{symbolsCount}</span>
                  </div>
                )}
                {routesCount > 0 && (
                  <div className="bg-neutral-900 p-2 rounded border border-neutral-800 flex items-center justify-between">
                    <span className="text-neutral-400">مسارات:</span>
                    <span className="font-bold text-sky-400 font-mono-cad">{routesCount}</span>
                  </div>
                )}
                {dimensionsCount > 0 && (
                  <div className="bg-neutral-900 p-2 rounded border border-neutral-800 flex items-center justify-between">
                    <span className="text-neutral-400">أبعاد:</span>
                    <span className="font-bold text-indigo-400 font-mono-cad">{dimensionsCount}</span>
                  </div>
                )}
                {textsCount > 0 && (
                  <div className="bg-neutral-900 p-2 rounded border border-neutral-800 flex items-center justify-between">
                    <span className="text-neutral-400">ملاحظات:</span>
                    <span className="font-bold text-purple-400 font-mono-cad">{textsCount}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* الخاصية المشتركة لكافة الأنواع: تغيير الطبقة */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <Layers size={14} className="text-sky-400" />
              تغيير طبقة كافة العناصر المحددة:
            </label>
            <select
              onChange={(e) => handleBulkLayerChange(e.target.value)}
              defaultValue=""
              className="bg-neutral-800 border border-neutral-700 rounded-md px-2.5 py-1.5 text-xs text-neutral-100 outline-none focus:border-sky-500"
            >
              <option value="" disabled>اختر طبقة لنقل الكل إليها...</option>
              {layers.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          {/* الخاصية المشتركة لكافة الأنواع: تغيير اللون */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
              <Palette size={14} className="text-sky-400" />
              تطبيق لون موحد لكافة العناصر:
            </label>
            <div className="grid grid-cols-7 gap-1.5 bg-neutral-950/60 p-2 rounded-lg border border-neutral-800">
              {[
                { name: 'سماوي (Sky)', value: '#38bdf8' },
                { name: 'كهرماني (Amber)', value: '#f59e0b' },
                { name: 'زمردي (Emerald)', value: '#10b981' },
                { name: 'أحمر (Red)', value: '#ef4444' },
                { name: 'بنفسجي (Purple)', value: '#8b5cf6' },
                { name: 'رمادي داكن', value: '#334155' },
                { name: 'أبيض ناصع', value: '#ffffff' },
              ].map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => handleBulkColorChange(c.value)}
                  className="h-6 rounded-md border border-neutral-700/80 hover:scale-110 active:scale-95 transition-all shadow-xs"
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          {/* إجراءات مجمعة عامة */}
          <div className="flex flex-col gap-2 pt-2 border-t border-neutral-800">
            {!isAllDoors && !isAllWindows && (
              <button
                onClick={handleBulkDuplicate}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-md border border-neutral-700 transition-colors"
              >
                <Copy size={13} />
                <span>مضاعفة كافة العناصر المحددة</span>
              </button>
            )}
            <button
              onClick={handleBulkDelete}
              className="w-full flex items-center justify-center gap-1.5 py-2 text-xs bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 rounded-md border border-rose-500/40 transition-colors"
            >
              <Trash2 size={14} />
              <span>حذف كافة العناصر المحددة ({selectedObjectIds.length})</span>
            </button>
          </div>
        </div>
      </aside>
    );
  
};
