/**
 * @file PropertiesPanel.tsx
 * @description لوحة الخصائص الجانبية (يمين الشاشة).
 * تعرض وتتيح تعديل خصائص العنصر المحدد (جدار، باب، نافذة) أو إحصائيات وإعدادات المشروع عند عدم التحديد.
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
import { ProjectModel } from '../model/project.ts';
import { getLastUsedSettings, updateLastUsedSettings, saveLastUsedSymbolConfig } from '../model/lastUsedSettings.ts';
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
} from '../model/types.ts';
import { SnapEngine } from '../engine/snap.ts';
import { GridUtils } from '../engine/grid.ts';
import { getSymbolById, CATEGORIES_META } from '../symbols/registry.ts';
import {
  ROUTE_KINDS_META,
  calculateRoutePixelLength,
  calculateSegmentLengths,
} from '../symbols/routes.ts';

interface PropertiesPanelProps {
  model: ProjectModel;
  selectedObjectId: string | null;
  selectedObjectIds?: string[];
  onClearSelection: () => void;
  onClearCanvas: () => void;
  onOpenBackgroundModal: () => void;
  onOpenCalibrationModal: () => void;
  onOpenSymbolsCatalog?: () => void;
  onOpenScheduleBOQ?: () => void;
  onOpenExport?: () => void;
  onOpenSettings?: () => void;
  isVisible?: boolean;
  onToggleVisible?: () => void;
}

interface LabelInputProps {
  value: string;
  placeholder?: string;
  onSave: (val: string, recordHistory?: boolean) => void;
  accentColorClass?: string;
}

/**
 * مكون إدخال نص التسمية التوضيحية مع استجابة فورية وحفظ سلس دون إبطاء المعالج
 */
const LabelInput: React.FC<LabelInputProps> = ({
  value,
  placeholder,
  onSave,
  accentColorClass = 'focus:border-sky-500',
}) => {
  const [localVal, setLocalVal] = React.useState(value || '');

  React.useEffect(() => {
    setLocalVal(value || '');
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setLocalVal(next);
  };

  const handleBlur = () => {
    if (localVal !== (value || '')) {
      onSave(localVal, true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <input
      type="text"
      dir="auto"
      placeholder={placeholder}
      value={localVal}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={`bg-neutral-800 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none w-full transition-colors ${accentColorClass}`}
    />
  );
};

interface NoteTextareaProps {
  value: string;
  placeholder?: string;
  onSave: (val: string, recordHistory?: boolean) => void;
  accentColorClass?: string;
  autoSelect?: boolean;
}

/**
 * حقل نصي متعدد الأسطر مع استجابة فورية وتظليل النص الافتراضي تلقائياً عند الإنشاء
 */
const NoteTextarea: React.FC<NoteTextareaProps> = ({
  value,
  placeholder,
  onSave,
  accentColorClass = 'focus:border-purple-500',
  autoSelect = true,
}) => {
  const [localVal, setLocalVal] = React.useState(value || '');
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    setLocalVal(value || '');
  }, [value]);

  React.useEffect(() => {
    if (textareaRef.current) {
      const timer = setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          const len = textareaRef.current.value.length;
          textareaRef.current.setSelectionRange(len, len);
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setLocalVal(next);
    onSave(next, false);
  };

  const handleBlur = () => {
    if (localVal !== (value || '')) {
      onSave(localVal, true);
    }
  };

  return (
    <textarea
      ref={textareaRef}
      rows={3}
      dir="auto"
      value={localVal}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={(e) => {
        const len = e.currentTarget.value.length;
        e.currentTarget.setSelectionRange(len, len);
      }}
      onKeyDown={(e) => e.stopPropagation()}
      placeholder={placeholder}
      className={`w-full bg-neutral-950/80 border border-neutral-700 rounded-xl p-2.5 text-xs text-neutral-100 placeholder-neutral-500 outline-none resize-y transition-colors leading-relaxed ${accentColorClass}`}
    />
  );
};

interface PrecisionNumberInputProps {
  value: number;
  unit?: string;
  step?: number | string;
  min?: number;
  max?: number;
  onChange: (val: number) => void;
  accentColorClass?: string;
  onIncrement?: () => void;
  onDecrement?: () => void;
  incrementTitle?: string;
  decrementTitle?: string;
  disabled?: boolean;
  presets?: number[];
  onSelectPreset?: (val: number) => void;
  presetColorClass?: string;
}

/**
 * مكون إدخال رقمي عالي الدقة (Precision Number Input)
 * يستبدل السلايدرات ويتيح كتابة القيم الدقيقة مباشرة (مثل 87.5سم) مع أزرار +/- للتعديل السريع
 */
export const PrecisionNumberInput: React.FC<PrecisionNumberInputProps> = ({
  value,
  unit,
  step = 'any',
  min,
  max,
  onChange,
  accentColorClass = 'focus-within:border-sky-500 border-neutral-700',
  onIncrement,
  onDecrement,
  incrementTitle = 'زيادة',
  decrementTitle = 'تقليل',
  disabled = false,
  presets,
  onSelectPreset,
  presetColorClass = 'bg-sky-600/30 text-sky-300 border-sky-500',
}) => {
  const [localVal, setLocalVal] = React.useState<string>(value.toString());
  const [isFocused, setIsFocused] = React.useState(false);

  React.useEffect(() => {
    if (!isFocused) {
      setLocalVal(value.toString());
    }
  }, [value, isFocused]);

  const handleCommit = (str: string) => {
    let parsed = parseFloat(str);
    if (isNaN(parsed)) {
      setLocalVal(value.toString());
      return;
    }
    if (min !== undefined && parsed < min) parsed = min;
    if (max !== undefined && parsed > max) parsed = max;
    const formatted = Math.round(parsed * 100) / 100;
    setLocalVal(formatted.toString());
    onChange(formatted);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      handleCommit(localVal);
      (e.target as HTMLInputElement).blur();
    } else if (e.key === 'ArrowUp' && onIncrement) {
      e.preventDefault();
      onIncrement();
    } else if (e.key === 'ArrowDown' && onDecrement) {
      e.preventDefault();
      onDecrement();
    }
  };

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div
        className={`flex items-center gap-1.5 bg-neutral-950/60 p-1 rounded-lg border ${accentColorClass} transition-colors`}
      >
        {onDecrement && (
          <button
            type="button"
            disabled={disabled}
            onClick={onDecrement}
            className="w-7 h-7 rounded bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-neutral-300 hover:text-white font-bold text-sm flex items-center justify-center border border-neutral-700 transition-all shrink-0 cursor-pointer disabled:opacity-50"
            title={decrementTitle}
          >
            <Minus size={13} />
          </button>
        )}

        <div className="flex-1 relative flex items-center min-w-0">
          <input
            type="number"
            step={step}
            min={min}
            max={max}
            disabled={disabled}
            value={localVal}
            onFocus={() => setIsFocused(true)}
            onChange={(e) => {
              const next = e.target.value;
              setLocalVal(next);
              const parsed = parseFloat(next);
              if (
                !isNaN(parsed) &&
                (min === undefined || parsed >= min) &&
                (max === undefined || parsed <= max)
              ) {
                onChange(Math.round(parsed * 100) / 100);
              }
            }}
            onBlur={() => {
              setIsFocused(false);
              handleCommit(localVal);
            }}
            onKeyDown={handleKeyDown}
            className="w-full bg-neutral-900 border border-transparent rounded px-2.5 py-1 text-center font-mono-cad text-sm font-bold text-neutral-100 outline-none transition-colors"
          />
          {unit && (
            <span className="absolute left-2 text-[10px] font-mono-cad text-neutral-400 pointer-events-none select-none">
              {unit}
            </span>
          )}
        </div>

        {onIncrement && (
          <button
            type="button"
            disabled={disabled}
            onClick={onIncrement}
            className="w-7 h-7 rounded bg-neutral-800 hover:bg-neutral-700 active:scale-95 text-neutral-300 hover:text-white font-bold text-sm flex items-center justify-center border border-neutral-700 transition-all shrink-0 cursor-pointer disabled:opacity-50"
            title={incrementTitle}
          >
            <Plus size={13} />
          </button>
        )}
      </div>

      {presets && presets.length > 0 && (
        <div className="flex items-center gap-1">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                if (onSelectPreset) {
                  onSelectPreset(p);
                } else {
                  onChange(p);
                }
              }}
              className={`flex-1 py-1 text-[10px] font-mono-cad rounded border transition-colors ${
                Math.abs(value - p) < 0.25
                  ? `${presetColorClass} font-bold`
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white'
              }`}
            >
              {p}{unit || ''}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  model,
  selectedObjectId,
  selectedObjectIds = [],
  onClearSelection,
  onClearCanvas,
  onOpenBackgroundModal,
  onOpenCalibrationModal,
  onOpenSymbolsCatalog,
  onOpenScheduleBOQ,
  onOpenExport,
  onOpenSettings,
  isVisible = true,
  onToggleVisible,
}) => {
  const selectedObject = selectedObjectId ? model.getObjectById(selectedObjectId) : null;
  const layers = model.getLayers();
  const meta = model.getMeta();
  const pixelsPerMeter = meta.scale || 50;

  // شريط الإخفاء / الطي: إخفاء اللوحة كلياً لتحرير كامل مساحة العرض للكانفس (المرحلة 3)
  if (!isVisible) {
    return null;
  }

  // ============================================
  // حالة: تحديد عناصر متعددة (Multi-Selection & Bulk Edit)
  // ============================================
  if (selectedObjectIds && selectedObjectIds.length > 1) {
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
  }

  // حذف العنصر المحدد
  const handleDelete = () => {
    if (!selectedObject) return;
    model.deleteObject(selectedObject.id);
    onClearSelection();
  };

  // تغيير الطبقة
  const handleLayerChange = (layerId: string) => {
    if (!selectedObject) return;
    model.updateObject(selectedObject.id, { layerId });
  };

  // ============================================
  // حالة 1: العنصر المحدد هو جدار (Wall)
  // ============================================
  if (selectedObject?.type === 'wall') {
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
  }

  // ============================================
  // حالة 2: العنصر المحدد هو باب (Door)
  // ============================================
  if (selectedObject?.type === 'door') {
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
  }

  // ============================================
  // حالة 3: العنصر المحدد هو نافذة (Window)
  // ============================================
  if (selectedObject?.type === 'window') {
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
  }

  // ============================================
  // حالة 4: العنصر المحدد هو بُعد هندسي (Dimension - المرحلة 3)
  // ============================================
  if (selectedObject?.type === 'dimension') {
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
  }

  // ============================================
  // حالة 5: العنصر المحدد هو رمز هندسي (Symbol - المرحلة 4)
  // ============================================
  if (selectedObject?.type === 'symbol') {
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
  }

  // ============================================
  // حالة 6: العنصر المحدد هو مسار كهروميكانيكي (Route - المرحلة 5)
  // ============================================
  if (selectedObject?.type === 'route') {
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
  }

  // ============================================
  // حالة 6: العنصر المحدد هو ملاحظة وتلميح نصي (Text / Annotation Note Object)
  // ============================================
  if (selectedObject?.type === 'text') {
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
  }

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
