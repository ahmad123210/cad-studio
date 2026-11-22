/**
 * @file LeftToolbar.tsx
 * @description شريط الأدوات الجانبي (يسار الشاشة).
 * يحتوي على أدوات الرسم (تحديد، جدار، تحريك)، ومفاتيح الالتقاط، وأزرار التحكم بالتكبير.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  MousePointer,
  Square,
  Hand,
  Grid,
  Magnet,
  ZoomIn,
  ZoomOut,
  Maximize2,
  DoorOpen,
  AppWindow,
  Zap,
  GitBranch,
  Ruler,
  Shapes,
  Compass,
  Target,
  Image as ImageIcon,
  FileSpreadsheet,
  FileDown,
  FileCode2,
  Bot,
  ChevronDown,
  Boxes,
  ScanLine,
  Filter,
  Layers,
  Check,
  Info,
  X,
  Type,
  LayoutGrid,
  RectangleHorizontal,
  Spline,
  Hexagon,
  Circle as CircleIcon,
  Footprints,
} from 'lucide-react';
import { ToolMode, CadEngine } from '../engine/renderer.ts';
import { SnapOptions } from '../engine/snap.ts';
import { RouteKind } from '../model/types.ts';
import { ROUTE_KINDS_META } from '../symbols/routes.ts';
import { ProjectModel } from '../model/project.ts';

interface LeftToolbarProps {
  currentTool: ToolMode;
  selectionSubMode?: 'single' | 'box' | 'multi';
  onSelectTool: (tool: ToolMode) => void;
  onSelectSubMode?: (subMode: 'single' | 'box' | 'multi') => void;
  snapOptions: SnapOptions;
  engine?: CadEngine | null;
  model?: ProjectModel;
  onOpenAbout?: () => void;
  onToggleGridSnap: () => void;
  onToggleObjectSnap: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onOpenBackgroundModal: () => void;
  onOpenCalibrationModal: () => void;
  onOpenSymbolsCatalog: () => void;
  onOpenScheduleBOQ?: () => void;
  onOpenExport?: () => void;
  onOpenDxf?: () => void;
  onOpenAiAssistant?: () => void;
  activeRouteKind?: RouteKind;
  onSelectRouteKind?: (kind: RouteKind) => void;
  hasBackgroundImage: boolean;
  /** فتح مكتبة الكتل */
  onOpenBlocks?: () => void;
}

export const LeftToolbar: React.FC<LeftToolbarProps> = ({
  onOpenBlocks,
  currentTool,
  selectionSubMode,
  onSelectTool,
  onSelectSubMode,
  snapOptions,
  engine,
  model,
  onOpenAbout,
  onToggleGridSnap,
  onToggleObjectSnap,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onOpenBackgroundModal,
  onOpenCalibrationModal,
  onOpenSymbolsCatalog,
  onOpenScheduleBOQ,
  onOpenExport,
  onOpenDxf,
  onOpenAiAssistant,
  activeRouteKind = 'electrical',
  onSelectRouteKind,
  hasBackgroundImage,
}) => {
  const [showRouteMenu, setShowRouteMenu] = useState(false);
  const [showSelectMenu, setShowSelectMenu] = useState(false);
  const [showLayerPicker, setShowLayerPicker] = useState(false);
  // لوحة الأشكال المنبثقة (مستطيل، دائرة، قوس، مضلع...)
  const [shapesMenu, setShapesMenu] = useState<{ top: number; right: number } | null>(null);
  const runEdit = (kind: Parameters<CadEngine['startEditCommand']>[0]) => {
    setShapesMenu(null);
    const err = engine?.startEditCommand(kind);
    if (err) alert(err);
  };
  const selectButtonRef = useRef<HTMLButtonElement | null>(null);
  const [menuCoords, setMenuCoords] = useState<{ top: number; left?: number; right?: number }>({ top: 70, right: 72 });
  const currentRouteMeta = ROUTE_KINDS_META[activeRouteKind];
  const currentSubMode = selectionSubMode || engine?.getSelectionSubMode() || 'single';

  const updatePosition = useCallback(() => {
    if (!selectButtonRef.current) return;
    const rect = selectButtonRef.current.getBoundingClientRect();
    const top = Math.max(12, Math.min(window.innerHeight - 520, rect.top));
    const isRightSide = rect.left > window.innerWidth / 2;
    if (isRightSide) {
      setMenuCoords({
        top,
        right: window.innerWidth - rect.left + 8,
      });
    } else {
      setMenuCoords({
        top,
        left: rect.right + 8,
      });
    }
  }, []);

  useEffect(() => {
    if (showSelectMenu) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition);
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition);
      };
    }
  }, [showSelectMenu, updatePosition]);

  useEffect(() => {
    if (!showSelectMenu) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowSelectMenu(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showSelectMenu]);

  return (
    <aside className="w-16 bg-neutral-900 border-l border-neutral-800 flex flex-col items-center py-2.5 justify-between z-10 shadow-lg select-none overflow-y-auto">
      {/* أدوات الرسم والقياس (المرحلة 1 و 2 و 3) */}
      <div className="flex flex-col items-center gap-1.5 w-full px-2">
        <div className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mb-0.5">
          الأدوات
        </div>

        {/* أداة التحديد مع النافذة العائمة للخيارات والأنماط */}
        <div className="relative">
          <button
            ref={selectButtonRef}
            onClick={() => {
              onSelectSubMode?.('single');
              engine?.setSelectionSubMode('single');
              onSelectTool('select');
              setShowSelectMenu(false);
            }}
            className={`w-11 h-10 rounded-xl flex flex-col items-center justify-center transition-all relative cursor-pointer ${
              currentTool === 'select'
                ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30 ring-2 ring-sky-400/50'
                : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800'
            }`}
            title="أداة التحديد القياسي (V أو 1) - انقر لاختيار التحديد القياسي أو انقر السهم للخيارات"
          >
            {currentSubMode === 'box' ? (
              <ScanLine size={17} />
            ) : currentSubMode === 'multi' ? (
              <Boxes size={17} />
            ) : (
              <MousePointer size={17} />
            )}
            <span className="text-[8px] mt-0.5 font-medium">
              {currentSubMode === 'box' ? 'مربع' : currentSubMode === 'multi' ? 'متعدد' : 'تحديد'}
            </span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                updatePosition();
                setShowSelectMenu((prev) => !prev);
              }}
              className="absolute -bottom-1 -left-1 w-4 h-4 rounded-full bg-neutral-800 hover:bg-neutral-700 text-sky-300 border border-neutral-700 flex items-center justify-center text-[8px] cursor-pointer shadow-xs z-10"
              title="قائمة أدوات وأنماط التحديد"
            >
              ▾
            </span>
          </button>
        </div>

        {/* النافذة العائمة لخيارات التحديد (تظهر عند الضغط وتختفي فور اختيار الأداة) */}
        {showSelectMenu && createPortal(
          <div className="select-none font-sans" dir="rtl">
            {/* خلفية شفافة لإغلاق النافذة عند النقر خارجها */}
            <div
              className="fixed inset-0 z-50 bg-black/25 backdrop-blur-[0.5px] transition-opacity cursor-default"
              onClick={() => setShowSelectMenu(false)}
            />

            {/* النافذة العائمة نفسها */}
            <div
              style={{
                top: `${menuCoords.top}px`,
                ...(menuCoords.right !== undefined ? { right: `${menuCoords.right}px` } : {}),
                ...(menuCoords.left !== undefined ? { left: `${menuCoords.left}px` } : {}),
              }}
              className="fixed z-50 w-72 bg-neutral-900/95 border border-sky-500/40 rounded-2xl shadow-2xl shadow-black/80 p-2.5 flex flex-col gap-1.5 text-xs backdrop-blur-md animate-in fade-in zoom-in-95"
              onClick={(e) => e.stopPropagation()}
            >
              {/* ترويسة النافذة العائمة */}
              <div className="px-2 py-1.5 bg-neutral-800/80 rounded-xl border border-neutral-700/50 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sky-400">
                  <MousePointer size={14} className="shrink-0" />
                  <span className="font-bold text-xs text-neutral-100">خيارات وأنماط التحديد</span>
                </div>
                <button
                  onClick={() => setShowSelectMenu(false)}
                  className="p-1 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-700/50 transition-colors cursor-pointer"
                  title="إغلاق النافذة العائمة (Esc)"
                >
                  <X size={13} />
                </button>
              </div>

              {/* قائمة الأدوات والأنماط - كل أداة تنفذ الأمر وتغلق النافذة العائمة فوراً */}
              <div className="flex flex-col gap-1 mt-0.5">
                {/* 1. تحديد فردي قياسي */}
                <button
                  onClick={() => {
                    onSelectSubMode?.('single');
                    engine?.setSelectionSubMode('single');
                    onSelectTool('select');
                    setShowSelectMenu(false);
                  }}
                  className={`flex items-center justify-between p-2 rounded-xl text-right transition-all cursor-pointer ${
                    currentSubMode === 'single'
                      ? 'bg-sky-950/60 border border-sky-500/50 text-white'
                      : 'hover:bg-neutral-800/70 border border-transparent text-neutral-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0">
                      <MousePointer size={14} className="text-sky-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-xs text-neutral-100">تحديد فردي قياسي (V / 1)</span>
                      <span className="text-[10px] text-neutral-400">نقر لاختيار عنصر واحد وتحريكه</span>
                    </div>
                  </div>
                  {currentSubMode === 'single' && (
                    <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                  )}
                </button>

                {/* 2. تحديد بمربع الإحاطة */}
                <button
                  onClick={() => {
                    onSelectSubMode?.('box');
                    engine?.setSelectionSubMode('box');
                    onSelectTool('select');
                    setShowSelectMenu(false);
                  }}
                  className={`flex items-center justify-between p-2 rounded-xl text-right transition-all cursor-pointer ${
                    currentSubMode === 'box'
                      ? 'bg-emerald-950/60 border border-emerald-500/50 text-white'
                      : 'hover:bg-neutral-800/70 border border-transparent text-neutral-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <ScanLine size={14} className="text-emerald-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-xs text-neutral-100">تحديد بمربع الإحاطة (B / 2)</span>
                      <span className="text-[10px] text-neutral-400">سحب مستطيل بالماوس لتحديد ما بداخله</span>
                    </div>
                  </div>
                  {currentSubMode === 'box' && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  )}
                </button>

                {/* 3. تحديد متعدد تراكمي */}
                <button
                  onClick={() => {
                    onSelectSubMode?.('multi');
                    engine?.setSelectionSubMode('multi');
                    onSelectTool('select');
                    setShowSelectMenu(false);
                  }}
                  className={`flex items-center justify-between p-2 rounded-xl text-right transition-all cursor-pointer ${
                    currentSubMode === 'multi'
                      ? 'bg-amber-950/60 border border-amber-500/50 text-white'
                      : 'hover:bg-neutral-800/70 border border-transparent text-neutral-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <Boxes size={14} className="text-amber-400" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-xs text-neutral-100">تحديد متعدد تراكمي (Q / 3)</span>
                      <span className="text-[10px] text-neutral-400">نقر مستمر لإضافة عناصر جديدة للتحديد</span>
                    </div>
                  </div>
                  {currentSubMode === 'multi' && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  )}
                </button>

                {/* 4. تحديد عناصر طبقة كاملة */}
                <div className="rounded-xl border border-neutral-800/80 bg-neutral-950/40 p-1">
                  <button
                    onClick={() => setShowLayerPicker((prev) => !prev)}
                    className="w-full flex items-center justify-between p-1.5 rounded-lg hover:bg-neutral-800/60 text-neutral-200 text-right transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                        <Layers size={14} className="text-indigo-400" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-xs text-neutral-100">تحديد عناصر طبقة معينة</span>
                        <span className="text-[10px] text-neutral-400">اختيار طبقة لتحديد كامل عناصرها</span>
                      </div>
                    </div>
                    <span className={`text-xs text-neutral-400 transition-transform ${showLayerPicker ? 'rotate-180' : ''}`}>▾</span>
                  </button>

                  {showLayerPicker && model && (
                    <div className="mt-1 px-1 pb-1 pt-0.5 flex flex-col gap-1 max-h-36 overflow-y-auto">
                      {model.getLayers().map((l) => {
                        const count = model.getObjects().filter((o) => o.layerId === l.id).length;
                        return (
                          <button
                            key={l.id}
                            onClick={() => {
                              engine?.selectAllInLayer(l.id);
                              onSelectTool('select');
                              setShowSelectMenu(false);
                              setShowLayerPicker(false);
                            }}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-[11px] text-neutral-300 text-right transition-colors group cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                              <span className="group-hover:text-white font-medium">{l.name}</span>
                            </div>
                            <span className="text-[10px] font-mono-cad text-neutral-400 bg-neutral-800 px-1.5 py-0.5 rounded">
                              {count} عنصر
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 5. تحديد العناصر المتشابهة */}
                <button
                  onClick={() => {
                    engine?.selectSimilar();
                    onSelectTool('select');
                    setShowSelectMenu(false);
                  }}
                  className="flex items-center gap-2 p-2 rounded-xl hover:bg-neutral-800/70 border border-transparent text-neutral-200 text-right transition-all cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center shrink-0">
                    <Filter size={14} className="text-pink-400" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-semibold text-xs text-neutral-100">تحديد العناصر المتشابهة (Select Similar)</span>
                    <span className="text-[10px] text-neutral-400">تحديد كل العناصر المشابهة للعنصر المختار</span>
                  </div>
                </button>

                <div className="h-px bg-neutral-800 my-0.5" />

                {/* 6. تحديد الكل وإلغاء التحديد السريع */}
                <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                  <button
                    onClick={() => {
                      if (model && engine) {
                        const allIds = model.getObjects().map((o) => o.id);
                        engine.selectObjects(allIds);
                        onSelectTool('select');
                      }
                      setShowSelectMenu(false);
                    }}
                    className="px-2.5 py-2 rounded-xl bg-sky-950/40 hover:bg-sky-900/60 border border-sky-500/30 text-sky-300 text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    title="تحديد كافة عناصر المشروع"
                  >
                    <Check size={12} />
                    <span>تحديد الكل (Ctrl+A)</span>
                  </button>

                  <button
                    onClick={() => {
                      engine?.deselectAll();
                      setShowSelectMenu(false);
                    }}
                    className="px-2.5 py-2 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    title="إلغاء تحديد كافة العناصر"
                  >
                    <X size={12} />
                    <span>إلغاء التحديد (Esc)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* أداة رسم الجدران */}
        <button
          onClick={() => onSelectTool('wall')}
          className={`w-11 h-10 rounded-xl flex flex-col items-center justify-center transition-all relative ${
            currentTool === 'wall'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30 ring-2 ring-sky-400/50'
              : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800'
          }`}
          title="أداة رسم الجدار (W أو 4) - انقر لتحديد البداية ثم النهاية"
        >
          <Square size={17} />
          <span className="text-[8px] mt-0.5 font-medium">جدار</span>
        </button>

        {/* أداة إدراج الأبواب */}
        <button
          onClick={() => onSelectTool('door')}
          className={`w-11 h-10 rounded-xl flex flex-col items-center justify-center transition-all relative ${
            currentTool === 'door'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 ring-2 ring-amber-400/50'
              : 'text-neutral-400 hover:text-amber-300 hover:bg-neutral-800'
          }`}
          title="أداة إدراج باب (D أو 5) - مرر المؤشر فوق أي جدار وانقر للتثبيت"
        >
          <DoorOpen size={17} />
          <span className="text-[8px] mt-0.5 font-medium">باب</span>
        </button>

        {/* أداة إدراج النوافذ */}
        <button
          onClick={() => onSelectTool('window')}
          className={`w-11 h-10 rounded-xl flex flex-col items-center justify-center transition-all relative ${
            currentTool === 'window'
              ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30 ring-2 ring-teal-400/50'
              : 'text-neutral-400 hover:text-teal-300 hover:bg-neutral-800'
          }`}
          title="أداة إدراج نافذة (N أو 6) - مرر المؤشر فوق أي جدار وانقر للتثبيت"
        >
          <AppWindow size={17} />
          <span className="text-[8px] mt-0.5 font-medium">نافذة</span>
        </button>

        <div className="w-8 h-px bg-neutral-800 my-0.5" />

        {/* أدوات القياس والمساحة والمعايرة */}
        {/* أداة رسم الأبعاد الهندسية الدائمة */}
        <button
          onClick={() => onSelectTool('dimension')}
          className={`w-11 h-10 rounded-xl flex flex-col items-center justify-center transition-all relative ${
            currentTool === 'dimension'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-2 ring-indigo-400/50'
              : 'text-neutral-400 hover:text-indigo-300 hover:bg-neutral-800'
          }`}
          title="أداة الأبعاد الهندسية (M أو 7) - انقر بين نقطتين لتثبيت خط البعد"
        >
          <Ruler size={17} />
          <span className="text-[8px] mt-0.5 font-medium">أبعاد</span>
        </button>

        {/* الأشكال: مستطيل · دائرة · قوس · مضلع */}
        <button
          data-testid="shapes-button"
          onClick={(e) => {
            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
            setShapesMenu(shapesMenu ? null : { top: Math.max(12, Math.min(window.innerHeight - 260, r.top)), right: window.innerWidth - r.left + 8 });
          }}
          className={`w-11 h-10 rounded-xl flex flex-col items-center justify-center transition-all relative ${
            shapesMenu ? 'bg-cyan-700 text-white' : 'text-neutral-400 hover:text-cyan-300 hover:bg-neutral-800'
          }`}
          title="أشكال وعناصر: مستطيل، دائرة، قوس، مضلع، عمود، درج"
        >
          <Shapes size={17} />
          <span className="text-[8px] mt-0.5 font-medium">أشكال</span>
        </button>
        {shapesMenu &&
          createPortal(
            <div dir="rtl" className="select-none">
              <div className="fixed inset-0 z-50" onClick={() => setShapesMenu(null)} />
              <div
                data-testid="shapes-menu"
                style={{ top: shapesMenu.top, right: shapesMenu.right }}
                className="fixed z-50 w-56 bg-neutral-900/95 border border-cyan-500/40 rounded-2xl shadow-2xl p-2 grid grid-cols-2 gap-1.5 text-xs backdrop-blur-md"
              >
                {([
                  ['rect', 'مستطيل', 'rec', RectangleHorizontal],
                  ['circle', 'دائرة', 'c', CircleIcon],
                  ['arc', 'قوس (3 نقاط)', 'arc', Spline],
                  ['polygon', 'مضلع منتظم', 'pol', Hexagon],
                  ['column', 'عمود', 'col', Square],
                  ['stairs', 'درج', 'st', Footprints],
                ] as const).map(([kind, label, alias, Icon]) => (
                  <button
                    key={kind}
                    onClick={() => runEdit(kind)}
                    className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-neutral-800 text-neutral-200"
                    title={`${label} — في شريط الأوامر: ${alias}`}
                  >
                    <Icon size={18} className="text-cyan-300" />
                    <span>{label}</span>
                  </button>
                ))}
                {onOpenBlocks && (
                  <button
                    data-testid="open-blocks"
                    onClick={() => {
                      setShapesMenu(null);
                      onOpenBlocks();
                    }}
                    className="col-span-2 flex items-center justify-center gap-1.5 p-2 rounded-xl bg-neutral-800/70 hover:bg-neutral-800 text-neutral-200"
                    title="مكتبة الكتل: مطبخ، حمام، غرفة نوم... (blocks)"
                  >
                    <Boxes size={16} className="text-sky-300" />
                    <span>مكتبة الكتل</span>
                  </button>
                )}
              </div>
            </div>,
            document.body
          )}

        {/* أداة إضافة الملاحظات والتلميحات النصية */}
        <button
          onClick={() => onSelectTool('text')}
          className={`w-11 h-10 rounded-xl flex flex-col items-center justify-center transition-all relative ${
            currentTool === 'text'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-2 ring-purple-400/50'
              : 'text-neutral-400 hover:text-purple-300 hover:bg-neutral-800'
          }`}
          title="أداة كتابة الملاحظات والنصوص (T) - انقر على مساحة العمل لكتابة ملاحظة"
        >
          <Type size={17} />
          <span className="text-[8px] mt-0.5 font-medium">ملاحظة</span>
        </button>

        {/* أداة شريط القياس المؤقت والمسطرة */}
        <button
          onClick={() => onSelectTool('measure')}
          className={`w-11 h-10 rounded-xl flex flex-col items-center justify-center transition-all relative ${
            currentTool === 'measure'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
              : 'text-neutral-400 hover:text-amber-300 hover:bg-neutral-800'
          }`}
          title="شريط القياس السريع والمسطرة (8) - قياس فوري بين أي نقطتين مع الزاوية"
        >
          <Compass size={17} />
          <span className="text-[8px] mt-0.5 font-medium">قياس</span>
        </button>

        {/* أداة قياس المساحة والمحيط */}
        <button
          onClick={() => onSelectTool('area')}
          className={`w-11 h-10 rounded-xl flex flex-col items-center justify-center transition-all relative ${
            currentTool === 'area'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-2 ring-emerald-400/50'
              : 'text-neutral-400 hover:text-emerald-300 hover:bg-neutral-800'
          }`}
          title="أداة قياس المساحة والمحيط (A أو 0) - انقر على زوايا الغرفة لحساب المساحة بالمتر المربع"
        >
          <Shapes size={17} />
          <span className="text-[8px] mt-0.5 font-medium">مساحة</span>
        </button>

        {/* كشف الغرف المغلقة تلقائياً (بطاقة اسم ومساحة لكل غرفة) */}
        <button
          data-testid="detect-rooms"
          onClick={() => {
            if (!engine) return;
            const n = engine.detectRooms();
            if (n === 0) alert('لم تُعثر على غرف مغلقة جديدة. تأكد أن الجدران المحيطة بكل غرفة متصلة.');
          }}
          className="w-11 h-10 rounded-xl flex flex-col items-center justify-center transition-all relative text-neutral-400 hover:text-emerald-300 hover:bg-neutral-800"
          title="كشف الغرف تلقائياً — يضيف بطاقة اسم ومساحة صافية لكل غرفة مغلقة (rooms)"
        >
          <LayoutGrid size={17} />
          <span className="text-[8px] mt-0.5 font-medium">الغرف</span>
        </button>

        {/* أداة المعايرة */}
        <button
          onClick={() => onSelectTool('calibrate')}
          className={`w-11 h-10 rounded-xl flex flex-col items-center justify-center transition-all relative ${
            currentTool === 'calibrate'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
              : 'text-neutral-400 hover:text-rose-300 hover:bg-neutral-800'
          }`}
          title="أداة معايرة مقياس الرسم - ارسم خطاً على مسافة معلومة لضبط المقياس"
        >
          <Target size={17} />
          <span className="text-[8px] mt-0.5 font-medium">معايرة</span>
        </button>

        {/* أداة التحريك باليد */}
        <button
          onClick={() => onSelectTool('pan')}
          className={`w-11 h-10 rounded-xl flex flex-col items-center justify-center transition-all ${
            currentTool === 'pan'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/30'
              : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800'
          }`}
          title="أداة التحريك باليد (H أو اضغط زر المسافة مع السحب)"
        >
          <Hand size={17} />
          <span className="text-[8px] mt-0.5 font-medium">تحريك</span>
        </button>

        {/* زر صورة المخطط المرجعية (خلفية) */}
        <button
          onClick={onOpenBackgroundModal}
          className={`w-11 h-10 rounded-xl flex flex-col items-center justify-center transition-all relative ${
            hasBackgroundImage
              ? 'bg-teal-950/60 text-teal-400 border border-teal-500/50'
              : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800'
          }`}
          title="استيراد وتعديل صورة المخطط المرجعية في الخلفية"
        >
          <ImageIcon size={16} />
          <span className="text-[8px] mt-0.5 font-medium">خلفية</span>
          {hasBackgroundImage && (
            <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-teal-400" />
          )}
        </button>

        {/* أداة الرموز الهندسية (المرحلة 4) */}
        <button
          onClick={() => {
            if (currentTool === 'symbol') {
              onOpenSymbolsCatalog();
            } else {
              onSelectTool('symbol');
            }
          }}
          className={`w-11 h-10 rounded-xl flex flex-col items-center justify-center transition-all relative ${
            currentTool === 'symbol'
              ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 ring-2 ring-amber-400/50'
              : 'text-neutral-400 hover:text-amber-300 hover:bg-neutral-800'
          }`}
          title="أداة إدراج الرموز والفرش المعماري والأجهزة (S) - انقر لوضع الرمز أو انقر ثانية لفتح المكتبة"
        >
          <Zap size={17} />
          <span className="text-[8px] mt-0.5 font-medium">رموز وفرش</span>
        </button>

        <div className="w-8 h-px bg-neutral-800 my-0.5" />

        {/* أداة المسارات والكابلات (المرحلة 5) */}
        <div className="relative">
          <button
            onClick={() => onSelectTool('route')}
            className={`w-11 h-10 rounded-xl flex flex-col items-center justify-center transition-all relative ${
              currentTool === 'route'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30 ring-2 ring-amber-400/50'
                : 'text-neutral-400 hover:text-amber-300 hover:bg-neutral-800'
            }`}
            title={`أداة رسم المسارات والكابلات والمواسير (R) - الحالي: ${currentRouteMeta?.name || 'كهرباء'}`}
          >
            <GitBranch size={17} style={{ color: currentTool === 'route' ? '#ffffff' : currentRouteMeta?.defaultColor }} />
            <span className="text-[8px] mt-0.5 font-medium">مسار</span>
            <span
              className="absolute top-1 right-1 w-2 h-2 rounded-full border border-neutral-900"
              style={{ backgroundColor: currentRouteMeta?.defaultColor || '#f59e0b' }}
            />
          </button>
        </div>

        {/* زر فتح جدول الرموز وحصر الكميات التلقائي (المرحلة 5) */}
        {onOpenScheduleBOQ && (
          <button
            onClick={onOpenScheduleBOQ}
            className="w-11 h-10 rounded-xl flex flex-col items-center justify-center transition-all text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 border border-emerald-500/20"
            title="جدول الرموز وحصر الكميات التلقائي (Automatic Legend & BOQ)"
          >
            <FileSpreadsheet size={16} />
            <span className="text-[7.5px] mt-0.5 font-bold">BOQ</span>
          </button>
        )}

        {/* زر تصدير المخطط الهندسي كـ PDF */}
        {onOpenExport && (
          <button
            onClick={onOpenExport}
            className="w-11 h-10 rounded-xl flex flex-col items-center justify-center transition-all text-sky-400 hover:text-sky-300 hover:bg-sky-950/40 border border-sky-500/20"
            title="تصدير المخطط الهندسي كملف PDF رسمي"
          >
            <FileDown size={16} />
            <span className="text-[7.5px] mt-0.5 font-bold">PDF</span>
          </button>
        )}

        {/* زر تصدير واستيراد AutoCAD DXF */}
        {onOpenDxf && (
          <button
            onClick={onOpenDxf}
            className="w-11 h-10 rounded-xl flex flex-col items-center justify-center transition-all text-sky-300 hover:text-white hover:bg-neutral-800 border border-sky-500/30"
            title="تصدير واستيراد ملفات AutoCAD DXF"
          >
            <FileCode2 size={16} className="text-sky-400" />
            <span className="text-[7.5px] mt-0.5 font-bold font-mono-cad">DXF</span>
          </button>
        )}

        {/* زر المساعد الهندسي الذكي AI */}
        {onOpenAiAssistant && (
          <button
            onClick={onOpenAiAssistant}
            className="w-11 h-10 rounded-xl flex flex-col items-center justify-center transition-all text-purple-300 hover:text-white bg-purple-950/40 hover:bg-purple-900/60 border border-purple-500/40 shadow-sm shadow-purple-500/10"
            title="المساعد الهندسي الذكي وفحص المخطط"
          >
            <Bot size={16} className="text-purple-400" />
            <span className="text-[7.5px] mt-0.5 font-bold">AI</span>
          </button>
        )}
      </div>

      {/* أدوات الالتقاط والتحكم بالتكبير */}
      <div className="flex flex-col items-center gap-1.5 w-full px-2 pt-2 border-t border-neutral-800">
        {/* مغناطيس الشبكة */}
        <button
          onClick={onToggleGridSnap}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
            snapOptions.enableGridSnap
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              : 'text-neutral-500 hover:bg-neutral-800'
          }`}
          title={`التقاط الشبكة: ${snapOptions.enableGridSnap ? 'مفعّل' : 'معطّل'}`}
        >
          <Grid size={15} />
        </button>

        {/* مغناطيس العناصر */}
        <button
          onClick={onToggleObjectSnap}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
            snapOptions.enableObjectSnap
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              : 'text-neutral-500 hover:bg-neutral-800'
          }`}
          title={`التقاط نهايات ومنتصف الجدران: ${snapOptions.enableObjectSnap ? 'مفعّل' : 'معطّل'}`}
        >
          <Magnet size={15} />
        </button>

        <div className="w-7 h-px bg-neutral-800 my-0.5" />

        {/* تكبير / تصغير / إعادة تعيين */}
        <button
          onClick={onZoomIn}
          className="w-8 h-8 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 flex items-center justify-center transition-colors"
          title="تكبير (+)"
        >
          <ZoomIn size={15} />
        </button>

        <button
          onClick={onZoomOut}
          className="w-8 h-8 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 flex items-center justify-center transition-colors"
          title="تصغير (-)"
        >
          <ZoomOut size={15} />
        </button>

        <button
          onClick={onResetZoom}
          className="w-8 h-8 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-800 flex items-center justify-center transition-colors"
          title="إعادة ضبط الرؤية إلى 100%"
        >
          <Maximize2 size={14} />
        </button>

        {onOpenAbout && (
          <>
            <div className="w-7 h-px bg-neutral-800 my-0.5" />
            <button
              onClick={onOpenAbout}
              className="w-8 h-8 rounded-lg text-sky-400 hover:text-sky-300 hover:bg-sky-950/40 border border-sky-500/30 flex items-center justify-center transition-colors shadow-xs"
              title="دليل النظام، جدول الاختصارات، ومعلومات المطور (أحمد الناطور knatoura@gmail.com)"
            >
              <Info size={15} />
            </button>
          </>
        )}
      </div>
    </aside>
  );
};
