/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback, useReducer } from 'react';
import { ProjectModel } from './model/project.ts';
import { CadEngine, ToolMode } from './engine/renderer.ts';
import {
  Point,
  ProjectData,
  WallObject,
  DoorObject,
  WindowObject,
  DimensionObject,
  SymbolObject,
  RouteObject,
  TextObject,
  RouteKind,
  ProjectObject,
} from './model/types.ts';
import { SnapResult } from './engine/snap.ts';
import { CameraState } from './engine/camera.ts';
import { TopBar } from './ui/TopBar.tsx';
import { LeftToolbar } from './ui/LeftToolbar.tsx';
import { PropertiesPanel } from './ui/PropertiesPanel.tsx';
import { CommandPalette, type PaletteAction } from './ui/CommandPalette.tsx';
import { TemplatesModal } from './ui/TemplatesModal.tsx';
import { OnboardingTour } from './ui/OnboardingTour.tsx';
import { buildTemplateProject, PROJECT_TEMPLATES, type ProjectTemplate } from './model/templates.ts';
import { getLang, setLang } from './i18n/index.ts';
import { saveFileAs, pickSaveHandle, writeToHandle, safeFileName, FILE_TYPES } from './utils/saveFile.ts';
import { IS_SECONDARY_WINDOW, WINDOW_PROJECT_ID } from './model/windowContext.ts';
import { LayersPanel } from './ui/LayersPanel.tsx';
import { StatusBar } from './ui/StatusBar.tsx';
import { HelpModal } from './ui/HelpModal.tsx';
import { ConfirmModal } from './ui/ConfirmModal.tsx';
import { BackgroundImageModal } from './ui/BackgroundImageModal.tsx';
import { CalibrationModal } from './ui/CalibrationModal.tsx';
import { AreaBadge } from './ui/AreaBadge.tsx';
import { SymbolsCatalogModal } from './ui/SymbolsCatalogModal.tsx';
import { ScheduleBOQModal } from './ui/ScheduleBOQModal.tsx';
import { BlocksModal } from './ui/BlocksModal.tsx';
import { MepModal } from './ui/MepModal.tsx';
import { copyProps, planPasteProps, type PropsSnapshot } from './model/matchProps.ts';
import { RouteControlBar } from './ui/RouteControlBar.tsx';
// تحميل كسول: نافذتا التصدير (jsPDF ≈630KB) وDXF تُحمَّلان عند أول فتح فقط
const ExportModal = React.lazy(() => import('./ui/ExportModal.tsx').then((m) => ({ default: m.ExportModal })));
const DxfModal = React.lazy(() => import('./ui/DxfModal.tsx').then((m) => ({ default: m.DxfModal })));
import { CustomSymbolModal } from './ui/CustomSymbolModal.tsx';
import { AiAssistantModal } from './ui/AiAssistantModal.tsx';
import { AboutInfoModal } from './ui/AboutInfoModal.tsx';
import { SettingsModal } from './ui/SettingsModal.tsx';
import { initializeCustomSymbols } from './symbols/customSymbols.ts';
import { SketchUpCalibrateWidget } from './ui/SketchUpCalibrateWidget.tsx';
import { SketchUpCalibrationEvent, WallDrawingState } from './engine/renderer.ts';
import { ContextMenu } from './ui/ContextMenu.tsx';
import { SheetsBar } from './ui/SheetsBar.tsx';
import { WallLengthHud } from './ui/WallLengthHud.tsx';
import { GridDensity, ThemeMode, getLastUsedSettings, updateLastUsedSettings } from './model/lastUsedSettings.ts';
import { PanelRightOpen } from 'lucide-react';
import { liveStatus, useLiveStatus } from './engine/liveStatus.ts';
import { CommandBar } from './ui/CommandBar.tsx';
import { rotateSpec, selectionCenter, withHostedObjects } from './model/transforms.ts';

/**
 * شريط الحالة المتصل مباشرة بالقيم عالية التردد (المؤشر/الالتقاط/الزوم)
 * حتى لا تُعاد تصيير واجهة التطبيق كاملة مع كل حركة فأرة.
 */
function LiveStatusBar(props: Omit<React.ComponentProps<typeof StatusBar>, 'cursorWorld' | 'snapResult' | 'zoom' | 'orthoMode'>) {
  const live = useLiveStatus();
  return (
    <StatusBar
      {...props}
      cursorWorld={live.cursorWorld}
      snapResult={live.snapResult}
      zoom={live.zoom}
      orthoMode={live.orthoMode}
    />
  );
}

/** شريط إدخال طول الجدار متصل مباشرة بالطول/الزاوية اللحظيين */
function LiveWallLengthHud(props: Omit<React.ComponentProps<typeof WallLengthHud>, 'currentLengthMeters' | 'currentAngleDegrees'>) {
  const { wallDrawing } = useLiveStatus();
  if (!wallDrawing?.isDrawing) return null;
  return (
    <WallLengthHud
      {...props}
      currentLengthMeters={wallDrawing.currentLengthMeters}
      currentAngleDegrees={wallDrawing.currentAngleDegrees}
    />
  );
}

/** توليد معرف عنصر جديد */
function newObjectId(type: string): string {
  return `${type}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * نسخ مجموعة عناصر مع إزاحة، وإعادة ربط الأبواب/النوافذ بنسخ جدرانها إن نُسخت معها.
 * (إصلاح: سابقاً كان الباب المنسوخ يبقى مرتبطاً بالجدار الأصلي فيظهر فوق الباب الأصلي تماماً)
 */
function cloneObjectsWithOffset(source: ProjectObject[], offset: number): ProjectObject[] {
  const idMap = new Map<string, string>();
  const clones = source.map((orig) => {
    const clone = JSON.parse(JSON.stringify(orig));
    clone.id = newObjectId(clone.type);
    idMap.set(orig.id, clone.id);
    if (clone.type === 'wall' || clone.type === 'dimension' || clone.type === 'stairs') {
      clone.start.x += offset;
      clone.start.y += offset;
      clone.end.x += offset;
      clone.end.y += offset;
    } else if (clone.type === 'symbol' || clone.type === 'text' || clone.type === 'room' || clone.type === 'column') {
      clone.x += offset;
      clone.y += offset;
    } else if (clone.type === 'route' || clone.type === 'line') {
      clone.points = clone.points.map((p: Point) => ({ x: p.x + offset, y: p.y + offset }));
    }
    return clone as ProjectObject;
  });
  // النسخة الملصقة مجموعة جديدة لا تختلط بمجموعة الأصل (المرحلة 20)
  const groupMap = new Map<string, string>();
  for (const c of clones) {
    if (c.groupId) {
      if (!groupMap.has(c.groupId)) groupMap.set(c.groupId, `grp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`);
      c.groupId = groupMap.get(c.groupId)!;
    }
  }
  for (const c of clones) {
    if (c.type === 'door' || c.type === 'window') {
      const mapped = idMap.get((c as DoorObject | WindowObject).wallId);
      if (mapped) (c as DoorObject | WindowObject).wallId = mapped;
    }
    if (c.type === 'symbol' && (c as SymbolObject).wallId) {
      const mapped = idMap.get((c as SymbolObject).wallId!);
      if (mapped) (c as SymbolObject).wallId = mapped;
    }
  }
  return clones;
}

/**
 * عناصر نموذجية أولية للمشروع (غرفة سكنية 6م × 4م مع باب ونافذة وخط بُعد هندسي)
 */
function createSampleElements(layerId: string): ProjectObject[] {
  const walls: WallObject[] = [
    {
      id: 'wall_north',
      type: 'wall',
      layerId,
      start: { x: -150, y: -100 },
      end: { x: 150, y: -100 },
      thickness: 20,
    },
    {
      id: 'wall_east',
      type: 'wall',
      layerId,
      start: { x: 150, y: -100 },
      end: { x: 150, y: 100 },
      thickness: 20,
    },
    {
      id: 'wall_south',
      type: 'wall',
      layerId,
      start: { x: 150, y: 100 },
      end: { x: -150, y: 100 },
      thickness: 20,
    },
    {
      id: 'wall_west',
      type: 'wall',
      layerId,
      start: { x: -150, y: 100 },
      end: { x: -150, y: -100 },
      thickness: 20,
    },
    {
      id: 'wall_partition',
      type: 'wall',
      layerId,
      start: { x: 0, y: -100 },
      end: { x: 0, y: 40 },
      thickness: 15,
    },
  ];

  const door: DoorObject = {
    id: 'door_main',
    type: 'door',
    layerId,
    wallId: 'wall_south',
    position: 0.65,
    width: 45, // 0.90م
    openDirection: 'inward_right',
  };

  const windowNorth: WindowObject = {
    id: 'win_main',
    type: 'window',
    layerId,
    wallId: 'wall_north',
    position: 0.5,
    width: 60, // 1.20م
    height: 1.2,
    sillHeight: 0.9,
  };

  // بُعد هندسي قياسي للغرفة (عرض 6.00 م)
  const sampleDimension: DimensionObject = {
    id: 'dim_south_wall',
    type: 'dimension',
    layerId,
    start: { x: -150, y: 135 },
    end: { x: 150, y: 135 },
    measuredLength: 300, // 300 بكسل على مقياس 50 = 6.00 م
    offset: 25,
  };

  // رموز هندسية نموذجية (كهرباء، تكييف، إطفاء حريق)
  const sampleSocket: SymbolObject = {
    id: 'sym_socket_1',
    type: 'symbol',
    symbolKind: 'socket_double',
    layerId: 'elec',
    x: -80,
    y: -100,
    rotation: 0,
    wallId: 'wall_north',
    wallPosition: 0.23,
    wallSide: 1,
    scale: 1,
    label: '220V',
  };

  const sampleSwitch: SymbolObject = {
    id: 'sym_switch_1',
    type: 'symbol',
    symbolKind: 'switch_single',
    layerId: 'elec',
    x: 100,
    y: 100,
    rotation: 180,
    wallId: 'wall_south',
    wallPosition: 0.83,
    wallSide: 1,
    scale: 1,
  };

  const sampleCeilingLight: SymbolObject = {
    id: 'sym_light_1',
    type: 'symbol',
    symbolKind: 'light_ceiling',
    layerId: 'elec',
    x: 0,
    y: 0,
    rotation: 0,
    scale: 1.2,
  };

  const sampleAc: SymbolObject = {
    id: 'sym_ac_1',
    type: 'symbol',
    symbolKind: 'hvac_split_ac',
    layerId: 'hvac',
    x: 80,
    y: -100,
    rotation: 0,
    wallId: 'wall_north',
    wallPosition: 0.76,
    wallSide: 1,
    scale: 1,
    label: 'AC-01',
  };

  const sampleSprinkler: SymbolObject = {
    id: 'sym_sprinkler_1',
    type: 'symbol',
    symbolKind: 'fire_sprinkler',
    layerId: 'fire',
    x: -75,
    y: 0,
    rotation: 0,
    scale: 1,
  };

  // مسار كابل كهرباء يربط المفتاح بنقطة الإنارة السقفية
  const sampleElectricalRoute: RouteObject = {
    id: 'route_elec_1',
    type: 'route',
    routeKind: 'electrical',
    layerId: 'elec',
    points: [
      { x: -80, y: 100 },
      { x: -80, y: 0 },
      { x: 0, y: 0 },
    ],
    diameter: 20,
    material: 'PVC Conduit (مواسير بي في سي)',
    lengthCalculated: 3.6,
    startSymbolId: 'sym_switch_1',
    endSymbolId: 'sym_light_1',
    strokeWidth: 2.5,
    color: '#f59e0b',
  };

  // مسار تغذية مياه
  const sampleWaterRoute: RouteObject = {
    id: 'route_water_1',
    type: 'route',
    routeKind: 'water',
    layerId: 'plumb',
    points: [
      { x: 100, y: -100 },
      { x: 100, y: -60 },
      { x: 80, y: -60 },
    ],
    diameter: 25,
    material: 'PPR Pipe (بولي بروبيلين أخضر)',
    lengthCalculated: 1.2,
    strokeWidth: 2.5,
    color: '#3b82f6',
  };

  // مسار شبكة إطفاء الحريق المتصل بالرشاش الآلي
  const sampleFireRoute: RouteObject = {
    id: 'route_fire_1',
    type: 'route',
    routeKind: 'fire',
    layerId: 'fire',
    points: [
      { x: -150, y: 0 },
      { x: -75, y: 0 },
    ],
    diameter: 50,
    material: 'Black Steel Sch 40 (أنابيب حديد أسود)',
    lengthCalculated: 1.5,
    endSymbolId: 'sym_sprinkler_1',
    strokeWidth: 3,
    color: '#ef4444',
  };

  // ملاحظة وتلميح هندسي (Text Note Object)
  const sampleNote: TextObject = {
    id: 'text_note_1',
    type: 'text',
    layerId: 'arch',
    text: 'غرفة معيشة رئيسية\n(Main Living Hall)',
    x: -30,
    y: 35,
    fontSize: 14,
    color: '#38bdf8',
    rotation: 0,
    backgroundColor: '#0f172a',
    backgroundOpacity: 0.9,
    padding: 6,
    fontWeight: 'bold',
    align: 'center',
  };

  return [
    ...walls,
    door,
    windowNorth,
    sampleDimension,
    sampleSocket,
    sampleSwitch,
    sampleCeilingLight,
    sampleAc,
    sampleSprinkler,
    sampleElectricalRoute,
    sampleWaterRoute,
    sampleFireRoute,
    sampleNote,
  ];
}

export default function App() {
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<CadEngine | null>(null);
  const [model] = useState<ProjectModel>(() => {
    // نافذة إضافية (ويندوز متعدد النوافذ): مشروع فارغ مستقل لا يمس جلسة النافذة الرئيسية
    if (IS_SECONDARY_WINDOW) {
      const extra = new ProjectModel(WINDOW_PROJECT_ID, 'مشروع جديد');
      extra.rememberAsActive = false;
      return extra;
    }
    const proj = new ProjectModel('proj_default', 'مخطط فيلا سكنية 01');
    const loaded = proj.loadFromLocalStorage();
    // إصلاح: سابقاً كانت العناصر النموذجية تُعاد إضافتها لأي مشروع محفوظ فارغ (بعد تفريغ اللوحة ثم إعادة التحميل)
    if (!loaded) {
      const samples = createSampleElements('arch');
      samples.forEach((obj) => proj.addObject(obj, false));
    }
    return proj;
  });

  // حالات الواجهة (React State)
  const [, setProjectData] = useState<ProjectData>(() => model.toJSON());
  const [currentTool, setCurrentTool] = useState<ToolMode>('select');
  const [selectionSubMode, setSelectionSubMode] = useState<'single' | 'box' | 'multi'>('single');
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isSaved, setIsSaved] = useState(true);
  // الشاشات الضيقة (هاتف/جهاز لوحي عمودي): نبدأ بلوحة الخصائص مخفية لإفساح مساحة الرسم
  const [isPropertiesPanelVisible, setIsPropertiesPanelVisible] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 900
  );

  // إحداثيات المؤشر وحالة الكاميرا للشريط السفلي: انتقلت إلى مخزن liveStatus (انظر LiveStatusBar)
  // لإعادة تصيير الواجهة عند تغيّر حالة داخلية في المحرك لا تمر عبر React (مثل خيارات الالتقاط)
  const [, forceRender] = useReducer((x: number) => x + 1, 0);

  // النوافذ المنبثقة
  const [isLayersOpen, setIsLayersOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isBackgroundModalOpen, setIsBackgroundModalOpen] = useState(false);
  const [isCalibrationModalOpen, setIsCalibrationModalOpen] = useState(false);
  const [isSymbolsCatalogOpen, setIsSymbolsCatalogOpen] = useState(false);
  const [isScheduleBOQOpen, setIsScheduleBOQOpen] = useState(false);
  const [isBlocksOpen, setIsBlocksOpen] = useState(false);
  const [isMepOpen, setIsMepOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  // نسخة المتصفح: ملف المشروع الذي اختاره المستخدم بـ «حفظ باسم» (File System Access) — المرحلة 20
  const webFileHandleRef = useRef<FileSystemFileHandle | null>(null);
  const [webFileName, setWebFileName] = useState<string | null>(null);
  // آخر الملفات (نسخة ويندوز): تُحدّث عند فتح نافذة القوالب وعند تغيّر القائمة
  const [recentFiles, setRecentFiles] = useState<Array<{ path: string; name: string; exists: boolean }>>([]);
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.getRecentFiles) return;
    const refresh = () => {
      api.getRecentFiles?.().then(setRecentFiles).catch(() => {});
    };
    refresh();
    return api.onRecentChanged?.(refresh);
  }, [isTemplatesOpen]);
  // تغيير لغة الواجهة: إعادة رسم اللوحة لتُترجم نصوص Canvas (المرحلة 19)
  useEffect(() => {
    const rerender = () => engineRef.current?.render();
    window.addEventListener('cad:lang', rerender);
    return () => window.removeEventListener('cad:lang', rerender);
  }, []);
  useEffect(() => {
    const open = () => setIsMepOpen(true);
    window.addEventListener('cad:open-mep', open);
    return () => window.removeEventListener('cad:open-mep', open);
  }, []);
  // حافظة الخصائص (نسخ الخصائص من عنصر ولصقها على غيره)
  const [propsClipboard, setPropsClipboard] = useState<PropsSnapshot | null>(null);
  // فتح مكتبة الكتل من شريط الأوامر (الأمر blocks يرسل هذا الحدث)
  useEffect(() => {
    const open = () => setIsBlocksOpen(true);
    window.addEventListener('cad:open-blocks', open);
    return () => window.removeEventListener('cad:open-blocks', open);
  }, []);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const exportEverOpened = useRef(false);
  if (isExportModalOpen) exportEverOpened.current = true;
  const [isDxfModalOpen, setIsDxfModalOpen] = useState(false);
  // تبقى النافذة الكسولة مركّبة بعد أول فتح (للحفاظ على حالتها كما كانت)
  const dxfEverOpened = useRef(false);
  if (isDxfModalOpen) dxfEverOpened.current = true;
  const [isCustomSymbolModalOpen, setIsCustomSymbolModalOpen] = useState(false);
  const [isAiAssistantModalOpen, setIsAiAssistantModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [lastSavedPath, setLastSavedPathState] = useState<string | null>(() => (IS_SECONDARY_WINDOW ? null : getLastUsedSettings().lastSavedPath));
  useEffect(() => {
    window.electronAPI?.setCurrentFilePath?.(lastSavedPath);
  }, [lastSavedPath]);
  // «آخر مسار حفظ» في الإعدادات المشتركة يخص النافذة الرئيسية فقط (المرحلة 20)
  const setLastSavedPath = useCallback((p: string | null) => {
    setLastSavedPathState(p);
    if (!IS_SECONDARY_WINDOW) updateLastUsedSettings({ lastSavedPath: p });
  }, []);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(() => getLastUsedSettings().autoSaveEnabled);
  const [autoSaveIntervalMinutes, setAutoSaveIntervalMinutes] = useState<number>(() => getLastUsedSettings().autoSaveIntervalMinutes || 5);
  const [measuredPixelDistance, setMeasuredPixelDistance] = useState<number | null>(null);
  const [sketchUpCalibration, setSketchUpCalibration] = useState<SketchUpCalibrationEvent | null>(null);
  const [gridDensity, setGridDensity] = useState<GridDensity>(() => getLastUsedSettings().gridDensity || 'medium');
  const [theme, setTheme] = useState<ThemeMode>(() => getLastUsedSettings().themeMode || 'dark');
  const [showWallLengths, setShowWallLengths] = useState<boolean>(() => getLastUsedSettings().showWallLengths !== false);
  const [activeSheetId, setActiveSheetId] = useState<string>(() => model.getActiveSheetId());
  // نُبقي في React فقط "هل يجري رسم جدار" (يتغير نادراً)، أما الطول والزاوية اللحظيان ففي liveStatus
  const [isDrawingWallUi, setIsDrawingWallUi] = useState<boolean>(false);
  const [contextMenu, setContextMenu] = useState<{
    position: { x: number; y: number } | null;
    targetObjectId: string | null;
  }>({ position: null, targetObjectId: null });
  const [clipboardObjects, setClipboardObjects] = useState<ProjectObject[]>([]);

  const handleToggleWallLengths = useCallback(() => {
    setShowWallLengths((prev) => {
      const next = !prev;
      engineRef.current?.setShowWallLengths(next);
      updateLastUsedSettings({ showWallLengths: next });
      return next;
    });
  }, []);

  // تطبيق السمة على الـ DOM والمحرك
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.className = `theme-${theme}`;
    engineRef.current?.setTheme(theme);
  }, [theme]);

  const handleToggleTheme = useCallback(() => {
    const nextTheme: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    updateLastUsedSettings({ themeMode: nextTheme });
    document.documentElement.setAttribute('data-theme', nextTheme);
    document.body.className = `theme-${nextTheme}`;
    engineRef.current?.setTheme(nextTheme);
  }, [theme]);

  // تهيئة الرموز المخصصة من LocalStorage
  useEffect(() => {
    initializeCustomSymbols();
  }, []);


  const [areaData, setAreaData] = useState<{
    pixelArea: number;
    pixelPerimeter: number;
    pointsCount: number;
  }>({
    pixelArea: 0,
    pixelPerimeter: 0,
    pointsCount: 0,
  });
  const [routeData, setRouteData] = useState<{
    pointsCount: number;
    pixelLength: number;
    kind: RouteKind;
  }>({
    pointsCount: 0,
    pixelLength: 0,
    kind: 'electrical',
  });
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: () => void;
    variant: 'primary' | 'danger';
  }>({
    isOpen: false,
    title: '',
    message: '',
    action: () => {},
    variant: 'primary',
  });

  // معالجة معايرة مقياس الرسم على طريقة SketchUp
  const handleApplySketchUpCalibration = useCallback((realMeters: number) => {
    if (sketchUpCalibration && realMeters > 0) {
      const calculatedPpm = sketchUpCalibration.pixelDistance / realMeters;
      const roundedPpm = Math.round(calculatedPpm * 100) / 100;
      model.setMeta({ scale: roundedPpm });
      engineRef.current?.clearActiveCalibration();
      engineRef.current?.setToolMode('select');
      setCurrentTool('select');
      setSketchUpCalibration(null);
    }
  }, [sketchUpCalibration, model]);

  const handleCancelSketchUpCalibration = useCallback(() => {
    engineRef.current?.clearActiveCalibration();
    engineRef.current?.setToolMode('select');
    setCurrentTool('select');
    setSketchUpCalibration(null);
  }, []);

  const handleChangeGridDensity = useCallback((density: GridDensity) => {
    setGridDensity(density);
    engineRef.current?.setGridDensity(density);
  }, []);

  // تهيئة محرك الرسم CadEngine
  useEffect(() => {
    if (!canvasContainerRef.current) return;

    const engine = new CadEngine(canvasContainerRef.current, model, {
      onSelectObject: (id) => {
        setSelectedObjectId(id);
        setSelectedObjectIds(id ? [id] : []);
        if (id && window.innerWidth >= 900) {
          setIsPropertiesPanelVisible(true);
        }
      },
      onSelectObjects: (ids) => {
        setSelectedObjectIds(ids);
        setSelectedObjectId(ids.length > 0 ? ids[0] : null);
        if (ids && ids.length > 0 && window.innerWidth >= 900) {
          setIsPropertiesPanelVisible(true);
        }
      },
      onCursorMove: (worldPt, snap) => {
        liveStatus.setCursor(worldPt, snap);
      },
      onCameraChange: (cam: CameraState) => liveStatus.setZoom(cam.zoom),
      onCalibrationRequest: (_p1, _p2, dist) => {
        setMeasuredPixelDistance(dist);
      },
      onSketchUpCalibration: (event) => {
        setSketchUpCalibration(event);
      },
      onAreaUpdate: (pixelArea, pixelPerimeter, pointsCount) => {
        setAreaData({ pixelArea, pixelPerimeter, pointsCount });
      },
      onRouteUpdate: (pointsCount, pixelLength, kind) => {
        setRouteData({ pointsCount, pixelLength, kind });
      },
      onWallDrawingStateChange: (state) => {
        liveStatus.setWallDrawing(state);
        setIsDrawingWallUi(Boolean(state?.isDrawing));
      },
      onContextMenu: (e) => {
        setContextMenu({
          position: { x: e.clientX, y: e.clientY },
          targetObjectId: e.targetObjectId,
        });
      },
      onToolModeChange: (tool) => {
        setCurrentTool(tool);
      },
      onSelectionSubModeChange: (sub) => {
        setSelectionSubMode(sub);
      },
      onOrthoModeChange: (enabled) => {
        liveStatus.setOrthoMode(enabled);
      },
    });

    engineRef.current = engine;

    // subscribe() يستدعي المستمع فوراً مرة أولى: لا نعتبرها تعديلاً (كان المشروع يظهر "غير محفوظ" فور فتحه)
    let isInitialNotify = true;
    const unsubscribeModel = model.subscribe((data) => {
      setProjectData(data);
      if (isInitialNotify) {
        isInitialNotify = false;
        return;
      }
      setIsSaved(false);
      // رسم مجمّع: عدة تغييرات في نفس الإطار = إعادة رسم واحدة
      engine.requestRender();
    });

    // إن كانت نسخة IndexedDB أحدث من localStorage (أو المشروع أكبر من حدّه) نحمّلها بعد الإقلاع
    (IS_SECONDARY_WINDOW ? Promise.resolve(false) : model.loadNewerFromIndexedDB()).then((loaded) => {
      if (loaded) {
        setActiveSheetId(model.getActiveSheetId());
        setIsSaved(true);
        engine.render();
      }
    });

    const unsubscribeHistory = model.getHistory().subscribe((undoable, redoable) => {
      setCanUndo(undoable);
      setCanRedo(redoable);
    });

    const handleResize = () => {
      if (canvasContainerRef.current) {
        engine.resize(
          canvasContainerRef.current.clientWidth,
          canvasContainerRef.current.clientHeight
        );
      }
    };

    window.addEventListener('resize', handleResize);

    // مراقب تغيير أبعاد الحاوية التلقائي (ResizeObserver) لضمان تمدد الكانفس بالكامل فور إخفاء أي لوحة (المرحلة 3)
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          engine.resize(Math.round(width), Math.round(height));
        }
      }
    });

    if (canvasContainerRef.current) {
      resizeObserver.observe(canvasContainerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      unsubscribeModel();
      unsubscribeHistory();
      engine.destroy();
    };
  }, [model]);

  // تبديل أداة الرسم
  const handleSelectTool = (tool: ToolMode) => {
    setCurrentTool(tool);
    engineRef.current?.setToolMode(tool);
  };

  // تبديل التقاط الشبكة
  const handleToggleGridSnap = () => {
    if (!engineRef.current) return;
    const current = engineRef.current.getSnapOptions();
    engineRef.current.setSnapOptions({ enableGridSnap: !current.enableGridSnap });
    forceRender();
  };

  // تبديل التقاط نهايات الجدران
  const handleToggleObjectSnap = () => {
    if (!engineRef.current) return;
    const current = engineRef.current.getSnapOptions();
    engineRef.current.setSnapOptions({ enableObjectSnap: !current.enableObjectSnap });
    forceRender();
  };

  // معالجات قائمة الخيارات السياقية (الزر الأيمن)
  const handleContextMenuCopy = useCallback(() => {
    const targets = selectedObjectIds.length > 0
      ? selectedObjectIds
      : (contextMenu.targetObjectId ? [contextMenu.targetObjectId] : []);
    const objs = targets.map((id) => model.getObjectById(id)).filter(Boolean) as ProjectObject[];
    setClipboardObjects(JSON.parse(JSON.stringify(objs)));
    setContextMenu({ position: null, targetObjectId: null });
  }, [selectedObjectIds, contextMenu.targetObjectId, model]);

  const handleContextMenuCut = useCallback(() => {
    const targets = selectedObjectIds.length > 0
      ? selectedObjectIds
      : (contextMenu.targetObjectId ? [contextMenu.targetObjectId] : []);
    const objs = targets.map((id) => model.getObjectById(id)).filter(Boolean) as ProjectObject[];
    setClipboardObjects(JSON.parse(JSON.stringify(objs)));
    if (targets.length > 0) {
      model.deleteObjects(targets);
      setSelectedObjectId(null);
      setSelectedObjectIds([]);
      engineRef.current?.deselectAll();
      engineRef.current?.render();
    }
    setContextMenu({ position: null, targetObjectId: null });
  }, [selectedObjectIds, contextMenu.targetObjectId, model]);

  const handleContextMenuPaste = useCallback(() => {
    if (clipboardObjects.length > 0) {
      // لصق كخطوة تراجع واحدة (سابقاً: خطوة لكل عنصر)
      const clones = cloneObjectsWithOffset(clipboardObjects, 30);
      model.addObjects(clones, `لصق ${clones.length} عناصر`);
      const newIds = clones.map((c) => c.id);
      setSelectedObjectIds(newIds);
      setSelectedObjectId(newIds[0] || null);
      engineRef.current?.selectObjects(newIds);
      engineRef.current?.render();
    }
    setContextMenu({ position: null, targetObjectId: null });
  }, [clipboardObjects, model]);

  const handleContextMenuDuplicate = useCallback(() => {
    const targets = selectedObjectIds.length > 0
      ? selectedObjectIds
      : (contextMenu.targetObjectId ? [contextMenu.targetObjectId] : []);
    const originals = targets
      .map((id) => model.getObjectById(id))
      .filter((o): o is ProjectObject => Boolean(o));
    const clones = cloneObjectsWithOffset(originals, 25);
    model.addObjects(clones, `تكرار ${clones.length} عناصر`);
    const newIds = clones.map((c) => c.id);
    if (newIds.length > 0) {
      setSelectedObjectIds(newIds);
      setSelectedObjectId(newIds[0]);
      engineRef.current?.selectObjects(newIds);
      engineRef.current?.render();
    }
    setContextMenu({ position: null, targetObjectId: null });
  }, [selectedObjectIds, contextMenu.targetObjectId, model]);

  const handleContextMenuDelete = useCallback(() => {
    const targets = selectedObjectIds.length > 0
      ? selectedObjectIds
      : (contextMenu.targetObjectId ? [contextMenu.targetObjectId] : []);
    if (targets.length > 0) {
      model.deleteObjects(targets);
      setSelectedObjectId(null);
      setSelectedObjectIds([]);
      engineRef.current?.deselectAll();
      engineRef.current?.render();
    }
    setContextMenu({ position: null, targetObjectId: null });
  }, [selectedObjectIds, contextMenu.targetObjectId, model]);

  const handleContextMenuLockToggle = useCallback(() => {
    const targets = selectedObjectIds.length > 0
      ? selectedObjectIds
      : (contextMenu.targetObjectId ? [contextMenu.targetObjectId] : []);
    targets.forEach((id) => {
      const obj = model.getObjectById(id);
      if (obj) {
        model.updateObject(id, { locked: !(obj as any).locked });
      }
    });
    engineRef.current?.render();
    setContextMenu({ position: null, targetObjectId: null });
  }, [selectedObjectIds, contextMenu.targetObjectId, model]);

  const handleContextMenuRotate = useCallback((deg: number = 90) => {
    const targets = selectedObjectIds.length > 0
      ? selectedObjectIds
      : (contextMenu.targetObjectId ? [contextMenu.targetObjectId] : []);
    const objs = targets.map((id) => model.getObjectById(id)).filter((o): o is ProjectObject => Boolean(o));
    const onlySymbolsOrTexts = objs.every((o) => o.type === 'symbol' || o.type === 'text');
    if (onlySymbolsOrTexts) {
      // السلوك الأصلي: كل رمز/نص يدور حول نفسه
      targets.forEach((id) => {
        const obj = model.getObjectById(id);
        if (obj && (obj.type === 'symbol' || obj.type === 'text')) {
          const curRot = (obj as any).rotation || 0;
          model.updateObject(id, { rotation: (curRot + deg) % 360 });
        }
      });
    } else {
      // جدران/مسارات/أبعاد (أو تحديد مختلط): تدوير المجموعة حول مركزها كخطوة تراجع واحدة
      const center = selectionCenter(objs);
      if (center) {
        model.applyTransform(withHostedObjects(targets, model.getObjects()), rotateSpec(center, deg), `تدوير ${deg}°`);
      }
    }
    engineRef.current?.render();
    setContextMenu({ position: null, targetObjectId: null });
  }, [selectedObjectIds, contextMenu.targetObjectId, model]);

  const handleContextMenuSelectAll = useCallback(() => {
    const allIds = model.getObjects().map((o) => o.id);
    setSelectedObjectIds(allIds);
    setSelectedObjectId(allIds[0] || null);
    engineRef.current?.selectObjects(allIds);
    setContextMenu({ position: null, targetObjectId: null });
  }, [model]);

  // حفظ المشروع باسم على ويندوز (نافذة الحفظ الأصلية dialog.showSaveDialog) - المرحلة 4 متطلب 1
  const handleSaveAs = useCallback(async () => {
    const projectData = model.toJSON();
    if (window.electronAPI?.saveProject) {
      try {
        const res = await window.electronAPI.saveProject(projectData, {
          title: 'حفظ المشروع باسم',
          defaultPath: lastSavedPath || undefined,
        });
        if (!res.canceled && res.success && res.filePath) {
          setLastSavedPath(res.filePath);
          setIsSaved(true);
          window.electronAPI.setUnsavedChanges(false);
          model.saveToLocalStorage();
        }
      } catch (err) {
        console.error('Error in handleSaveAs:', err);
      }
    } else {
      // بيئة المتصفح: نافذة حفظ النظام لاختيار المكان (Chrome/Edge)، وإلا تنزيل الملف (المرحلة 20)
      model.saveToLocalStorage();
      setIsSaved(true);
      const jsonStr = JSON.stringify(projectData, null, 2);
      const name = `${safeFileName(projectData.project.name)}.cadproj`;
      const handle = await pickSaveHandle(name, FILE_TYPES.project);
      if (handle === null) return;
      if (handle !== 'unsupported') {
        try {
          await writeToHandle(handle, jsonStr);
          webFileHandleRef.current = handle;
          setWebFileName(handle.name);
          return;
        } catch (err) {
          console.warn('Writing project file failed, downloading instead:', err);
        }
      }
      void saveFileAs(jsonStr, `${safeFileName(projectData.project.name)}_${new Date().toISOString().split('T')[0]}.json`, FILE_TYPES.json);
    }
  }, [model, lastSavedPath]);

  // حفظ المشروع (زر الحفظ بالواجهة / Ctrl+S)
  const handleSave = useCallback(async () => {
    const projectData = model.toJSON();
    if (window.electronAPI) {
      if (lastSavedPath && window.electronAPI.saveProjectDirect) {
        try {
          const res = await window.electronAPI.saveProjectDirect(projectData, lastSavedPath);
          if (res.success) {
            setIsSaved(true);
            window.electronAPI.setUnsavedChanges(false);
            model.saveToLocalStorage();
            return;
          }
        } catch (err) {
          console.warn('Direct save failed, falling back to Save As dialog:', err);
        }
      }
      // إذا لم يكن هناك مسار سابق، نفتح نافذة حفظ ويندوز الحقيقية مباشرة
      await handleSaveAs();
    } else {
      // المتصفح: IndexedDB (بلا حد حجم) + localStorage + نسخة احتياطية
      const res = await model.saveLocal({ forceBackup: true });
      // وإن سبق «حفظ باسم» إلى ملف على الجهاز نكتب فيه أيضاً (المرحلة 20)
      if (webFileHandleRef.current) {
        try {
          await writeToHandle(webFileHandleRef.current, JSON.stringify(projectData, null, 2));
        } catch (err) {
          console.warn('Writing to the chosen project file failed:', err);
          webFileHandleRef.current = null;
          setWebFileName(null);
        }
      }
      if (res.ok) {
        setIsSaved(true);
      } else {
        alert('تعذّر الحفظ في ذاكرة المتصفح. استخدم "حفظ باسم" لتنزيل ملف المشروع.');
      }
    }
  }, [model, lastSavedPath, handleSaveAs]);

  // تفعيل الحفظ التلقائي من الإعدادات باستخدام setInterval (المرحلة 4 متطلب 2)
  useEffect(() => {
    if (!autoSaveEnabled) return;

    const intervalMinutes = Math.max(1, autoSaveIntervalMinutes || 5);
    const intervalMs = intervalMinutes * 60 * 1000;

    const timerId = setInterval(async () => {
      try {
        const projectData = model.toJSON();
        if (window.electronAPI && lastSavedPath && window.electronAPI.saveProjectDirect) {
          const res = await window.electronAPI.saveProjectDirect(projectData, lastSavedPath);
          if (res.success) {
            setIsSaved(true);
            window.electronAPI.setUnsavedChanges(false);
            model.saveToLocalStorage();
          }
        } else {
          // حفظ دوري احتياطي في الذاكرة المحلية (IndexedDB + localStorage) مع نسخة احتياطية دورية
          const res = await model.saveLocal();
          if (res.ok) {
            setIsSaved(true);
            window.electronAPI?.setUnsavedChanges(false);
          }
        }
      } catch (err) {
        console.warn('Auto-save tick failed:', err);
      }
    }, intervalMs);

    return () => clearInterval(timerId);
  }, [model, lastSavedPath, autoSaveEnabled, autoSaveIntervalMinutes]);

  // إبلاغ العملية الرئيسية بوجود تعديلات غير محفوظة (المرحلة 4 متطلب 3)
  useEffect(() => {
    window.electronAPI?.setUnsavedChanges(!isSaved);
  }, [isSaved]);

  // سؤال المستخدم قبل إغلاق التبويب في المتصفح
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isSaved) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isSaved]);

  // استجابة لطلب الحفظ عند محاولة إغلاق التطبيق مع تعديلات غير محفوظة في Electron
  useEffect(() => {
    if (!window.electronAPI?.onTriggerSaveAndClose) return;

    const cleanup = window.electronAPI.onTriggerSaveAndClose(async () => {
      try {
        const projectData = model.toJSON();
        let success = false;
        if (lastSavedPath && window.electronAPI?.saveProjectDirect) {
          const res = await window.electronAPI.saveProjectDirect(projectData, lastSavedPath);
          success = Boolean(res.success);
        } else if (window.electronAPI?.saveProject) {
          const res = await window.electronAPI.saveProject(projectData);
          success = Boolean(res.success && !res.canceled);
          if (success && res.filePath) {
            setLastSavedPath(res.filePath);
            }
        }
        if (success) {
          setIsSaved(true);
          model.saveToLocalStorage();
          window.electronAPI?.responseSaveAndClose({ success: true });
        } else {
          window.electronAPI?.responseSaveAndClose({ success: false });
        }
      } catch (err) {
        window.electronAPI?.responseSaveAndClose({ success: false });
      }
    });

    return () => cleanup();
  }, [model, lastSavedPath]);

  // استرجاع آخر مسار تم الحفظ فيه من Electron عند بدء التشغيل
  useEffect(() => {
    if (window.electronAPI?.getLastSavedPath) {
      window.electronAPI.getLastSavedPath().then((p) => {
        if (p) {
          setLastSavedPath(p);
        }
      }).catch(() => {});
    }
  }, []);

  // التراجع
  const handleUndo = () => {
    model.undo();
  };

  // الإعادة
  const handleRedo = () => {
    model.redo();
  };

  // مشروع جديد: يفتح اختيار القالب (فارغ، شقة، فيلا، محل) ثم يؤكد قبل استبدال المشروع الحالي
  const handleNewProject = () => setIsTemplatesOpen(true);

  const createFromTemplate = (id: ProjectTemplate['id']) => {
    setIsTemplatesOpen(false);
    const tpl = PROJECT_TEMPLATES.find((x) => x.id === id);
    setConfirmDialog({
      isOpen: true,
      title: 'إنشاء مشروع جديد',
      message:
        id === 'empty'
          ? 'هل أنت متأكد من إنشاء مشروع جديد؟ سيتم مسح العناصر الحالية إذا لم تكن محفوظة.'
          : `إنشاء مشروع من قالب «${tpl?.title ?? id}»؟ سيتم مسح العناصر الحالية إذا لم تكن محفوظة.`,
      variant: 'primary',
      action: () => {
        model.loadFromJSON(buildTemplateProject(id, model.getLayers(), 50));
        setSelectedObjectId(null);
        if (id === 'empty') engineRef.current?.resetZoom();
        else engineRef.current?.zoomToFit();
      },
    });
  };


  // تفريغ اللوحة
  const handleClearCanvas = () => {
    setConfirmDialog({
      isOpen: true,
      title: 'تفريغ مساحة العمل',
      message: 'هل أنت متأكد من حذف جميع الجدران والأبواب والنوافذ من اللوحة؟',
      variant: 'danger',
      action: () => {
        // خطوة تراجع واحدة وإشعار واحد (سابقاً: حذف كل عنصر منفرداً = N إعادة رسم و N خطوة تراجع)
        model.clearAllObjects(true);
        setSelectedObjectId(null);
        setSelectedObjectIds([]);
        engineRef.current?.deselectAll();
      },
    });
  };

  // معالجة كافة الاختصارات المركبة (Ctrl+...) بدقة وتوافق تام مع لوحة المفاتيح العربية والإنجليزية
  useEffect(() => {
    const handleGlobalCompositeKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      const code = e.code;
      const key = e.key.toLowerCase();

      // 1. حفظ المشروع (Ctrl+S / Cmd+S)
      if (isCtrlOrMeta && !e.shiftKey && (code === 'KeyS' || key === 's' || key === 'س')) {
        e.preventDefault();
        handleSave();
        return;
      }

      // 2. حفظ باسم (Ctrl+Shift+S / Cmd+Shift+S)
      if (isCtrlOrMeta && e.shiftKey && (code === 'KeyS' || key === 's' || key === 'س')) {
        e.preventDefault();
        handleSaveAs();
        return;
      }

      // 3. التراجع (Ctrl+Z / Cmd+Z)
      if (isCtrlOrMeta && !e.shiftKey && (code === 'KeyZ' || key === 'z' || key === 'ئ')) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // 4. الإعادة (Ctrl+Y / Cmd+Y أو Ctrl+Shift+Z)
      if (
        (isCtrlOrMeta && (code === 'KeyY' || key === 'y' || key === 'إ')) ||
        (isCtrlOrMeta && e.shiftKey && (code === 'KeyZ' || key === 'z' || key === 'ئ'))
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // 5. تصدير وطباعة (Ctrl+P / Cmd+P)
      if (isCtrlOrMeta && (code === 'KeyP' || key === 'p' || key === 'ح')) {
        e.preventDefault();
        setIsExportModalOpen(true);
        return;
      }

      // 6. مشروع جديد (Ctrl+N / Cmd+N)
      if (isCtrlOrMeta && !e.shiftKey && (code === 'KeyN' || key === 'n' || key === 'ى')) {
        e.preventDefault();
        handleNewProject();
        return;
      }

      // 6-ب. تجميع / فك تجميع (Ctrl+G / Ctrl+Shift+G) — المرحلة 20
      if (isCtrlOrMeta && (code === 'KeyG' || key === 'g' || key === 'ل')) {
        e.preventDefault();
        if (e.shiftKey) engineRef.current?.ungroupSelection();
        else engineRef.current?.groupSelection();
        return;
      }

      // 7. نسخ العناصر المحددة (Ctrl+C / Cmd+C)
      if (isCtrlOrMeta && (code === 'KeyC' || key === 'c' || key === 'ؤ')) {
        e.preventDefault();
        handleContextMenuCopy();
        return;
      }

      // 8. لصق العناصر المنسوخة (Ctrl+V / Cmd+V)
      if (isCtrlOrMeta && (code === 'KeyV' || key === 'v' || key === 'ر')) {
        e.preventDefault();
        handleContextMenuPaste();
        return;
      }

      // 9. قص العناصر المحددة (Ctrl+X / Cmd+X)
      if (isCtrlOrMeta && (code === 'KeyX' || key === 'x' || key === 'ء')) {
        e.preventDefault();
        handleContextMenuCut();
        return;
      }

      // 10. مضاعفة وتكرار العناصر المحددة (Ctrl+D / Cmd+D)
      if (isCtrlOrMeta && (code === 'KeyD' || key === 'd' || key === 'ي')) {
        e.preventDefault();
        handleContextMenuDuplicate();
        return;
      }

      // 11. تحديد الكل (Ctrl+A / Cmd+A)
      if (isCtrlOrMeta && (code === 'KeyA' || key === 'a' || key === 'ش')) {
        e.preventDefault();
        const allIds = model.getObjects().map((o) => o.id);
        setSelectedObjectIds(allIds);
        setSelectedObjectId(allIds[0] || null);
        engineRef.current?.selectObjects(allIds);
        return;
      }

      // 12. فتح ملف مشروع (Ctrl+O / Cmd+O)
      if (isCtrlOrMeta && (code === 'KeyO' || key === 'o' || key === 'خ')) {
        e.preventDefault();
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement | null;
        fileInput?.click();
        return;
      }

      // 13. إعادة ضبط الزوم 100% (Ctrl+0 / Cmd+0)
      if (isCtrlOrMeta && (code === 'Digit0' || key === '0')) {
        e.preventDefault();
        engineRef.current?.resetZoom();
        return;
      }

      // 14. تكبير المخطط (Ctrl+= أو Ctrl++)
      if (isCtrlOrMeta && (code === 'Equal' || key === '=' || key === '+')) {
        e.preventDefault();
        engineRef.current?.zoomIn();
        return;
      }

      // 15. تصغير المخطط (Ctrl+-)
      if (isCtrlOrMeta && (code === 'Minus' || key === '-')) {
        e.preventDefault();
        engineRef.current?.zoomOut();
        return;
      }

      // 16. فتح جدول الكميات (Ctrl+B)
      if (isCtrlOrMeta && (code === 'KeyB' || key === 'b' || key === 'لا')) {
        e.preventDefault();
        setIsScheduleBOQOpen((prev) => !prev);
        return;
      }

      // 17. فتح إدارة الطبقات (Ctrl+L)
      if (isCtrlOrMeta && (code === 'KeyL' || key === 'l' || key === 'م')) {
        e.preventDefault();
        setIsLayersOpen((prev: boolean) => !prev);
        return;
      }

      // 18. فتح مكتبة الرموز (صار Ctrl+Shift+K؛ Ctrl+K وحده لبحث الأوامر — المرحلة 19)
      if (isCtrlOrMeta && (code === 'KeyK' || key === 'k' || key === 'ن')) {
        e.preventDefault();
        setIsSymbolsCatalogOpen((prev) => !prev);
        return;
      }

      // 19. فتح نافذة التصدير والطباعة (Ctrl+E)
      if (isCtrlOrMeta && (code === 'KeyE' || key === 'e' || key === 'ث')) {
        e.preventDefault();
        setIsExportModalOpen((prev) => !prev);
        return;
      }

      // 20. تحريك العناصر المحددة بواسطة مفاتيح الأسهم (Arrow Keys Nudge)
      if (
        (code === 'ArrowUp' || code === 'ArrowDown' || code === 'ArrowLeft' || code === 'ArrowRight') &&
        (selectedObjectId || selectedObjectIds.length > 0)
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 50 : 10;
        let dx = 0;
        let dy = 0;
        if (code === 'ArrowUp') dy = -step;
        if (code === 'ArrowDown') dy = step;
        if (code === 'ArrowLeft') dx = -step;
        if (code === 'ArrowRight') dx = step;
        const targets = selectedObjectIds.length > 0 ? selectedObjectIds : [selectedObjectId!];
        model.moveObjects(targets, { x: dx, y: dy }, true);
        engineRef.current?.render();
        return;
      }

      // 21. حذف العناصر المحددة (Delete / Backspace)
      if (code === 'Delete' || code === 'Backspace') {
        if (selectedObjectIds.length > 0) {
          e.preventDefault();
          model.deleteObjects(selectedObjectIds);
          setSelectedObjectId(null);
          setSelectedObjectIds([]);
          engineRef.current?.deselectAll();
        } else if (selectedObjectId) {
          e.preventDefault();
          model.deleteObject(selectedObjectId);
          setSelectedObjectId(null);
          setSelectedObjectIds([]);
          engineRef.current?.selectObject(null);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalCompositeKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalCompositeKeyDown);
  }, [
    handleSave,
    handleSaveAs,
    handleUndo,
    handleRedo,
    handleNewProject,
    handleContextMenuCopy,
    handleContextMenuPaste,
    handleContextMenuCut,
    handleContextMenuDuplicate,
    model,
  ]);

  // تكامل أجهزة سطح المكتب والتطبيق التنفيذي (Electron Desktop Integration)
  useEffect(() => {
    if (!window.electronAPI) return;

    const cleanupMenu = window.electronAPI.onMenuAction((action: string) => {
      switch (action) {
        case 'new-project':
          handleNewProject();
          break;
        case 'save-project':
          handleSave();
          break;
        case 'save-project-as':
          handleSaveAs();
          break;
        case 'undo':
          handleUndo();
          break;
        case 'redo':
          handleRedo();
          break;
        case 'export-png':
        case 'export-pdf':
          setIsExportModalOpen(true);
          break;
        case 'export-dxf':
          setIsDxfModalOpen(true);
          break;
        case 'select-all':
          engineRef.current?.selectObjects(model.getObjects().map((o) => o.id));
          break;
        case 'delete-selected': {
          const selected = engineRef.current?.getSelectedObjectIds() || [];
          model.deleteObjects(selected);
          engineRef.current?.deselectAll();
          break;
        }
        case 'zoom-in':
          engineRef.current?.zoomIn();
          break;
        case 'zoom-out':
          engineRef.current?.zoomOut();
          break;
        case 'reset-zoom':
          engineRef.current?.resetZoom();
          break;
      }
    });

    const cleanupFile = window.electronAPI.onFileOpened(({ filePath, content }: { filePath?: string; content: string }) => {
      try {
        const data = JSON.parse(content);
        const warnings = model.loadFromJSON(data);
        if (warnings.length) alert('فُتح الملف مع ملاحظات:\n' + warnings.join('\n'));
        if (filePath) {
          setLastSavedPath(filePath);
        }
        setIsSaved(true);
        window.electronAPI?.setUnsavedChanges(false);
      } catch (err) {
        console.error('Failed to parse opened CAD file:', err);
      }
    });

    return () => {
      cleanupMenu?.();
      cleanupFile?.();
    };
  }, [model, handleSave, handleSaveAs]);

  const activeLayer = model.getLayers().find((l) => l.id === model.getActiveLayerId());
  const meta = model.getMeta();
  const hasBg = Boolean(model.getBackgroundImage()?.dataUrl);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--cad-canvas-bg)] text-[var(--cad-text-primary)] font-sans transition-colors">
      {/* 1. الشريط العلوي (TopBar) */}
      <TopBar
        model={model}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSave={handleSave}
        onSaveAs={handleSaveAs}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onNewProject={handleNewProject}
        onOpenLayers={() => setIsLayersOpen(true)}
        onOpenSymbols={() => setIsSymbolsCatalogOpen(true)}
        onOpenScheduleBOQ={() => setIsScheduleBOQOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
        isPropertiesPanelVisible={isPropertiesPanelVisible}
        onTogglePropertiesPanel={() => setIsPropertiesPanelVisible((prev) => !prev)}
        isSaved={isSaved}
        lastSavedPath={window.electronAPI ? lastSavedPath : webFileName}
        autoSaveActive={autoSaveEnabled}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        showWallLengths={showWallLengths}
        onToggleWallLengths={handleToggleWallLengths}
      />

      {/* 2. منطقة العمل المركزية (Canvas + الأدوات + الخصائص) */}
      <div className="flex-1 flex relative overflow-hidden bg-[var(--cad-canvas-bg)]">
        {/* شريط الأدوات الأيسر */}
        <LeftToolbar
          onOpenBlocks={() => setIsBlocksOpen(true)}
          onOpenMep={() => setIsMepOpen(true)}
          currentTool={currentTool}
          selectionSubMode={selectionSubMode}
          onSelectTool={handleSelectTool}
          onSelectSubMode={(sub) => {
            setSelectionSubMode(sub);
            engineRef.current?.setSelectionSubMode(sub);
          }}
          snapOptions={engineRef.current?.getSnapOptions() || {
            enableGridSnap: true,
            enableObjectSnap: true,
            gridSize: 25,
            snapRadius: 15,
          }}
          engine={engineRef.current}
          model={model}
          onOpenAbout={() => setIsAboutModalOpen(true)}
          onToggleGridSnap={handleToggleGridSnap}
          onToggleObjectSnap={handleToggleObjectSnap}
          onZoomIn={() => engineRef.current?.zoomIn()}
          onZoomOut={() => engineRef.current?.zoomOut()}
          onResetZoom={() => engineRef.current?.resetZoom()}
          onOpenBackgroundModal={() => setIsBackgroundModalOpen(true)}
          onOpenCalibrationModal={() => {
            setMeasuredPixelDistance(null);
            setIsCalibrationModalOpen(true);
          }}
          onOpenSymbolsCatalog={() => setIsSymbolsCatalogOpen(true)}
          onOpenScheduleBOQ={() => setIsScheduleBOQOpen(true)}
          onOpenExport={() => setIsExportModalOpen(true)}
          onOpenDxf={() => setIsDxfModalOpen(true)}
          onOpenAiAssistant={() => setIsAiAssistantModalOpen(true)}
          activeRouteKind={routeData.kind}
          onSelectRouteKind={(kind) => {
            engineRef.current?.setActiveRouteKind(kind);
            setRouteData((prev) => ({ ...prev, kind }));
          }}
          hasBackgroundImage={hasBg}
        />

        {/* حاوية الكانفس (Konva Drawing Canvas) */}
        <main
          ref={canvasContainerRef}
          className="flex-1 h-full w-full bg-[var(--cad-canvas-bg)] relative overflow-hidden focus:outline-none transition-colors"
          tabIndex={0}
        >
          {/* شريط رسم المسارات الكهروميكانيكية العائم */}
          {(currentTool === 'route' || routeData.pointsCount > 0) && (
            <RouteControlBar
              activeKind={routeData.kind}
              onSelectKind={(kind) => {
                engineRef.current?.setActiveRouteKind(kind);
                setRouteData((prev) => ({ ...prev, kind }));
              }}
              activeLineStyle={engineRef.current?.getActiveRouteLineStyle() || 'solid'}
              onSelectLineStyle={(style) => {
                engineRef.current?.setActiveRouteLineStyle(style);
                forceRender();
              }}
              pointsCount={routeData.pointsCount}
              currentLengthMeters={
                routeData.pixelLength / (meta.scale || 50)
              }
              onFinishRoute={() => engineRef.current?.finishRoute()}
              onCancelRoute={() => {
                engineRef.current?.cancelRoute();
                handleSelectTool('select');
              }}
            />
          )}

          {/* شريط نتائج قياس المساحة والمحيط العائم */}
          {(currentTool === 'area' || areaData.pointsCount > 0) && (
            <AreaBadge
              pixelArea={areaData.pixelArea}
              pixelPerimeter={areaData.pixelPerimeter}
              pointsCount={areaData.pointsCount}
              pixelsPerMeter={meta.scale || 50}
              unit={meta.unit}
              onClosePolygon={() => engineRef.current?.closeAreaPolygon()}
              onClear={() => {
                engineRef.current?.clearAreaPoints();
                setAreaData({ pixelArea: 0, pixelPerimeter: 0, pointsCount: 0 });
              }}
              onDone={() => {
                handleSelectTool('select');
                engineRef.current?.clearAreaPoints();
                setAreaData({ pixelArea: 0, pixelPerimeter: 0, pointsCount: 0 });
              }}
            />
          )}

          {/* أداة المعايرة المباشرة على طريقة SketchUp */}
          {sketchUpCalibration && canvasContainerRef.current && (
            <SketchUpCalibrateWidget
              measuredPixelDistance={sketchUpCalibration.pixelDistance}
              screenPosition={sketchUpCalibration.screenPosition}
              containerWidth={canvasContainerRef.current.clientWidth}
              containerHeight={canvasContainerRef.current.clientHeight}
              onApply={handleApplySketchUpCalibration}
              onCancel={handleCancelSketchUpCalibration}
            />
          )}

          {/* شريط تحديد طول الجدار يدوياً بالمتر أثناء الرسم */}
          {isDrawingWallUi && (
            <LiveWallLengthHud
              onCommitLength={(meters) => {
                engineRef.current?.commitWallWithLength(meters);
              }}
              onCommitPointText={(text) => engineRef.current?.applyPointInput(text) ?? null}
              onCancel={() => {
                engineRef.current?.cancelDrawing();
              }}
            />
          )}
        </main>

        {/*
          ملاحظة: العناصر الظاهرة منذ أول تصيير لا توضع داخل <main>، لأن Konva يفرّغ حاوية اللوحة عند إنشاء المسرح
          فتختفي من الصفحة. لذلك شريط الأوامر وزر إظهار اللوحة هنا كإخوة للوحة الرسم.
        */}
        {/* شريط الأوامر وإدخال الإحداثيات الدقيقة (يُخفى أثناء رسم الجدار لأن WallLengthHud يتولى ذلك) */}
        <CommandBar engine={engineRef.current} currentTool={currentTool} hidden={isDrawingWallUi} />
          {/* زر إعادة إظهار لوحة المعلومات العائم عند إخفائها لتوفير أقصى مساحة عمل */}
          {!isPropertiesPanelVisible && (
            <button
              onClick={() => setIsPropertiesPanelVisible(true)}
              className="absolute top-3 left-3 z-10 px-2.5 py-1.5 rounded-lg bg-[var(--cad-panel-bg)] hover:bg-[var(--cad-surface-hover)] border border-[var(--cad-border)] text-sky-400 hover:text-sky-300 shadow-md flex items-center gap-1.5 text-xs font-medium transition-all"
              title="إظهار لوحة معلومات المشروع والخصائص"
            >
              <PanelRightOpen size={15} />
              <span className="hidden sm:inline">لوحة المعلومات</span>
            </button>
          )}

        {/* لوحة الخصائص اليمنى */}
        <PropertiesPanel
          model={model}
          selectedObjectId={selectedObjectId}
          selectedObjectIds={selectedObjectIds}
          onClearSelection={() => {
            setSelectedObjectId(null);
            setSelectedObjectIds([]);
            engineRef.current?.deselectAll();
          }}
          onClearCanvas={handleClearCanvas}
          onOpenBackgroundModal={() => setIsBackgroundModalOpen(true)}
          onOpenCalibrationModal={() => {
            setMeasuredPixelDistance(null);
            setIsCalibrationModalOpen(true);
          }}
          onOpenSymbolsCatalog={() => setIsSymbolsCatalogOpen(true)}
          onOpenScheduleBOQ={() => setIsScheduleBOQOpen(true)}
          onOpenExport={() => setIsExportModalOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isVisible={isPropertiesPanelVisible}
          onToggleVisible={() => setIsPropertiesPanelVisible((prev) => !prev)}
        />
      </div>

      {/* شريط الصفحات واللوحات المتعددة (نمط Excel) */}
      <SheetsBar
        model={model}
        activeSheetId={activeSheetId}
        onSheetChange={(newId) => {
          model.setActiveSheet(newId);
          setActiveSheetId(newId);
          engineRef.current?.deselectAll();
          engineRef.current?.render();
        }}
      />

      {/* شريط الحالة السفلي (StatusBar) */}
      <LiveStatusBar
        onToggleOrtho={() => engineRef.current?.toggleOrthoMode()}
        activeLayerName={activeLayer?.name || 'المعماري'}
        pixelsPerMeter={meta.scale || 50}
        unit={meta.unit}
        gridDensity={gridDensity}
        onChangeGridDensity={handleChangeGridDensity}
        onOpenHelp={() => setIsHelpOpen(true)}
      />

      {/* 4. النوافذ المنبثقة: إدارة الطبقات، مكتبة الرموز، المساعدة، صورة الخلفية، المعايرة، التصدير، والتأكيد */}
      <LayersPanel
        model={model}
        isOpen={isLayersOpen}
        onClose={() => setIsLayersOpen(false)}
      />

      {exportEverOpened.current && (
      <React.Suspense fallback={null}>
      <ExportModal
        model={model}
        engine={engineRef.current}
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        onOpenScheduleBOQ={() => setIsScheduleBOQOpen(true)}
      />
      </React.Suspense>
      )}

      <SymbolsCatalogModal
        isOpen={isSymbolsCatalogOpen}
        onClose={() => setIsSymbolsCatalogOpen(false)}
        activeSymbolKind={engineRef.current?.getActiveSymbolKind() || 'socket_single'}
        onSelectSymbol={(sym) => {
          engineRef.current?.setActiveSymbolKind(sym.id);
          handleSelectTool('symbol');
        }}
        onOpenCustomSymbolModal={() => setIsCustomSymbolModalOpen(true)}
      />

      {/* أدوات AutoCAD DXF، استوديو الرموز المخصصة، والمساعد الهندسي الذكي */}
      {dxfEverOpened.current && (
      <React.Suspense fallback={null}>
      <DxfModal
        model={model}
        isOpen={isDxfModalOpen}
        onClose={() => setIsDxfModalOpen(false)}
        onProjectUpdated={() => {
          setProjectData(model.toJSON());
          engineRef.current?.render();
        }}
      />
      </React.Suspense>
      )}

      <CustomSymbolModal
        isOpen={isCustomSymbolModalOpen}
        onClose={() => setIsCustomSymbolModalOpen(false)}
        onSymbolCreated={(symId) => {
          engineRef.current?.setActiveSymbolKind(symId);
          handleSelectTool('symbol');
        }}
      />

      <AiAssistantModal
        model={model}
        isOpen={isAiAssistantModalOpen}
        onClose={() => setIsAiAssistantModalOpen(false)}
        onSelectObject={(objId) => {
          setSelectedObjectId(objId);
          engineRef.current?.selectObject(objId);
        }}
      />

      <BlocksModal model={model} engine={engineRef.current} isOpen={isBlocksOpen} onClose={() => setIsBlocksOpen(false)} />
      <MepModal
        model={model}
        engine={engineRef.current}
        isOpen={isMepOpen}
        onClose={() => setIsMepOpen(false)}
        onExportExcel={() => {
          import('./engine/export/panelExcel.ts')
            .then((m) => m.downloadPanelExcel(model))
            .catch((err) => alert(`تعذّر إنشاء ملف Excel: ${err?.message || err}`));
        }}
      />

      <ScheduleBOQModal
        model={model}
        isOpen={isScheduleBOQOpen}
        onClose={() => setIsScheduleBOQOpen(false)}
        onDetectRooms={() => engineRef.current?.detectRooms() ?? 0}
        onExportExcel={(report) => {
          // exceljs تُحمَّل عند أول تصدير فقط
          import('./engine/export/boqExcel.ts')
            .then((m) => m.downloadBoqExcel(report, model.getQuantitySettings().prices, model.getMeta().name))
            .catch((err) => alert(`تعذّر إنشاء ملف Excel: ${err?.message || err}`));
        }}
      />

      <BackgroundImageModal
        model={model}
        isOpen={isBackgroundModalOpen}
        onClose={() => setIsBackgroundModalOpen(false)}
      />

      <CalibrationModal
        model={model}
        isOpen={isCalibrationModalOpen}
        onClose={() => setIsCalibrationModalOpen(false)}
        measuredPixelDistance={measuredPixelDistance}
      />

      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />

      <AboutInfoModal
        isOpen={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          const current = getLastUsedSettings();
          setAutoSaveEnabled(current.autoSaveEnabled);
          setAutoSaveIntervalMinutes(current.autoSaveIntervalMinutes);
          if (!IS_SECONDARY_WINDOW) setLastSavedPathState(current.lastSavedPath);
        }}
        model={model}
        onSaveAs={handleSaveAs}
        onThemeChange={(newTheme) => {
          setTheme(newTheme);
          document.documentElement.setAttribute('data-theme', newTheme);
          document.body.className = `theme-${newTheme}`;
          engineRef.current?.setTheme(newTheme);
        }}
        onGridDensityChange={handleChangeGridDensity}
      />

      {/* بحث الأوامر Ctrl+K والقوالب والجولة التعريفية (المرحلة 19) */}
      <CommandPalette
        engine={engineRef.current}
        actions={[
          { id: 'new', label: 'مشروع جديد من قالب', keywords: ['new', 'template', 'قالب', 'شقة', 'فيلا', 'محل'], hint: 'Ctrl+N', run: () => setIsTemplatesOpen(true) },
          { id: 'save', label: 'حفظ المشروع', keywords: ['save'], hint: 'Ctrl+S', run: () => void handleSave() },
          { id: 'saveas', label: 'حفظ المشروع باسم', keywords: ['save as'], hint: 'Ctrl+Shift+S', run: () => void handleSaveAs() },
          { id: 'export', label: 'الطباعة وتصدير PDF', keywords: ['print', 'pdf', 'export', 'طباعة', 'تصدير', 'svg', 'ifc', 'png'], hint: 'Ctrl+P', run: () => setIsExportModalOpen(true) },
          { id: 'boq', label: 'جدول الكميات', keywords: ['boq', 'quantities', 'excel', 'كميات', 'حصر', 'اسعار'], run: () => setIsScheduleBOQOpen(true) },
          { id: 'mep', label: 'حسابات التمديدات', keywords: ['mep', 'electrical', 'plumbing', 'كهرباء', 'صرف', 'مياه', 'تعارض'], run: () => setIsMepOpen(true) },
          { id: 'dxf', label: 'تصدير واستيراد AutoCAD DXF', keywords: ['dxf', 'dwg', 'autocad', 'اوتوكاد'], run: () => setIsDxfModalOpen(true) },
          { id: 'layers', label: 'الطبقات', keywords: ['layers', 'طبقة'], run: () => setIsLayersOpen(true) },
          { id: 'symbols', label: 'مكتبة الرموز', keywords: ['symbols', 'library', 'رموز', 'فرش'], run: () => setIsSymbolsCatalogOpen(true) },
          { id: 'blocks', label: 'مكتبة الكتل', keywords: ['blocks', 'كتل'], run: () => setIsBlocksOpen(true) },
          { id: 'background', label: 'استيراد صورة مخطط', keywords: ['image', 'background', 'صورة', 'خلفية'], run: () => setIsBackgroundModalOpen(true) },
          { id: 'ai', label: 'المساعد الهندسي الذكي', keywords: ['ai', 'assistant', 'مساعد', 'ذكاء'], run: () => setIsAiAssistantModalOpen(true) },
          { id: 'settings', label: 'إعدادات التطبيق والحفظ', keywords: ['settings', 'اعدادات'], run: () => setIsSettingsOpen(true) },
          { id: 'help', label: 'دليل الاختصارات والمساعدة', keywords: ['help', 'shortcuts', 'مساعده'], run: () => setIsHelpOpen(true) },
          { id: 'theme', label: 'تبديل السمة الداكنة/الفاتحة', keywords: ['theme', 'dark', 'light', 'سمة', 'فاتح', 'داكن'], run: handleToggleTheme },
          { id: 'lang', label: getLang() === 'en' ? 'التبديل إلى العربية' : 'Switch to English', keywords: ['language', 'english', 'arabic', 'لغة', 'انجليزي', 'عربي'], run: () => void setLang(getLang() === 'en' ? 'ar' : 'en') },
          { id: 'wall-lengths', label: 'إظهار / إخفاء أطوال الجدران', keywords: ['lengths'], run: handleToggleWallLengths },
          ...recentFiles
            .filter((f) => f.exists)
            .map((f) => ({ id: `recent:${f.path}`, label: `فتح ملف حديث: ${f.name}`, keywords: ['recent', 'open', 'حديث', 'فتح', f.path], run: () => void window.electronAPI?.openRecentFile?.(f.path) })),
          ...(window.electronAPI?.newWindow
            ? [{ id: 'new-window', label: 'نافذة جديدة', keywords: ['window', 'new window', 'نافذه', 'ملف اخر'], hint: 'Ctrl+Shift+N', run: () => void window.electronAPI?.newWindow?.() }]
            : []),
          ...(window.electronAPI?.checkForUpdates
            ? [{ id: 'update', label: 'التحقق من التحديثات', keywords: ['update', 'تحديث', 'اصدار'], run: () => void window.electronAPI?.checkForUpdates?.() }]
            : []),
          { id: 'tour', label: 'الجولة التعريفية', keywords: ['tour', 'onboarding', 'جوله', 'شرح'], run: () => window.dispatchEvent(new Event('cad:start-tour')) },
        ] satisfies PaletteAction[]}
      />
      <TemplatesModal
        isOpen={isTemplatesOpen}
        onClose={() => setIsTemplatesOpen(false)}
        onChoose={createFromTemplate}
        recentFiles={recentFiles}
        onOpenRecent={(p) => {
          setIsTemplatesOpen(false);
          void window.electronAPI?.openRecentFile?.(p);
        }}
      />
      <OnboardingTour />

      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmVariant={confirmDialog.variant}
        confirmLabel="تأكيد"
        onConfirm={confirmDialog.action}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* قائمة الخيارات المنبثقة بالزر الأيمن (Context Menu) */}
      {contextMenu.position && (
        <ContextMenu
          position={contextMenu.position}
          targetObject={contextMenu.targetObjectId ? model.getObjectById(contextMenu.targetObjectId) || null : null}
          selectedCount={selectedObjectIds.length > 0 ? selectedObjectIds.length : (contextMenu.targetObjectId ? 1 : 0)}
          hasClipboard={clipboardObjects.length > 0}
          onCopy={handleContextMenuCopy}
          onCut={handleContextMenuCut}
          onPaste={handleContextMenuPaste}
          onDuplicate={handleContextMenuDuplicate}
          onDelete={handleContextMenuDelete}
          onLockToggle={handleContextMenuLockToggle}
          onRotate={handleContextMenuRotate}
          onToggleLength={handleToggleWallLengths}
          onEditCommand={(kind) => {
            const err = engineRef.current?.startEditCommand(kind);
            if (err) alert(err);
          }}
          onOpenBlocks={() => setIsBlocksOpen(true)}
          canPasteProps={Boolean(propsClipboard)}
          onGroup={() => engineRef.current?.groupSelection()}
          onUngroup={() => engineRef.current?.ungroupSelection()}
          canUngroup={selectedObjectIds.some((id) => model.getObjectById(id)?.groupId)}
          onCopyProps={() => {
            const src = contextMenu.targetObjectId ? model.getObjectById(contextMenu.targetObjectId) : undefined;
            if (src) setPropsClipboard(copyProps(src));
          }}
          onPasteProps={() => {
            if (!propsClipboard) return;
            const ids = selectedObjectIds.length > 0 ? selectedObjectIds : contextMenu.targetObjectId ? [contextMenu.targetObjectId] : [];
            const targets = ids.map((id) => model.getObjectById(id)).filter((o): o is ProjectObject => Boolean(o));
            const plan = planPasteProps(targets, propsClipboard);
            if (plan.updates.length) model.applyEdits(plan, `لصق الخصائص على ${plan.updates.length} عنصر`);
          }}
          onAlign={(mode) => {
            const err = engineRef.current?.alignSelection(mode);
            if (err) alert(err);
          }}
          onSelectAll={handleContextMenuSelectAll}
          onZoomFit={() => engineRef.current?.resetZoom()}
          onOpenProperties={() => setIsPropertiesPanelVisible(true)}
          onAddSheet={() => {
            const newSheetId = model.addSheet();
            setActiveSheetId(newSheetId);
            engineRef.current?.render();
          }}
          onClose={() => setContextMenu({ position: null, targetObjectId: null })}
        />
      )}
    </div>
  );
}
