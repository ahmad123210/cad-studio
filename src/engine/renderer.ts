/**
 * @file renderer.ts
 * @description محرك الرسم والتفاعل الهندسي المعتمد على Konva.js (Engine Layer).
 * يربط بين نموذج البيانات (Model)، نظام الإحداثيات (Camera)، ونظام الالتقاط (Snap).
 *
 * بنية الوحدات (بعد التقسيم):
 * - render/       الرسم: الخلفية والشبكة، طبقة العناصر، الرموز، المسارات، النصوص والأبعاد، الأبواب والنوافذ، مقابض الجدار، طبقة التفاعل
 * - interaction/  أحداث الفأرة واللمس، لوحة المفاتيح، الإيماءات السريعة (Pan/Zoom/Pinch)، السحب الجماعي
 * - tools/        إنهاء أوامر الرسم (طول الجدار الرقمي، المسار، المعايرة)
 * - export/       حدود المخطط وتصدير الصورة
 * - geometry/     دوال هندسية مساعدة (مربع التحديد)
 *
 * يبقى CadEngine الواجهة العامة الوحيدة؛ كل دالة منقولة تُستدعى عبر نسخة رفيعة داخل الصنف
 * بالسياق this نفسه، لذلك السلوك مطابق تماماً لما قبل التقسيم.
 * الحقول التي كانت private أصبحت عامة تقنياً حتى تصل إليها الوحدات؛ تُعامل كواجهة داخلية للمحرك.
 */

import Konva from 'konva';
import {
  Point,
  ProjectObject,
  LineObject,
  WallObject,
  DoorObject,
  WindowObject,
  DimensionObject,
  SymbolObject,
  RouteObject,
  RouteKind,
  TextObject,
  DoorOpenDirection,
  BackgroundImageData,
} from '../model/types.ts';
import { ProjectModel } from '../model/project.ts';
import { Camera, CameraState } from './camera.ts';
import {
  SnapEngine,
  SnapResult,
  SnapOptions,
  WallSnapResult,
  SymbolWallSnapResult,
} from './snap.ts';
import { GridUtils } from './grid.ts';
import { getSymbolById } from '../symbols/registry.ts';
import {
  ROUTE_KINDS_META,
  calculateRoutePixelLength,
  calculateSegmentLengths,
} from '../symbols/routes.ts';
import {
  getLastUsedSettings,
  updateLastUsedSettings,
  GridDensity,
  getGridOptionsForDensity,
  getLastUsedSymbolConfig,
} from '../model/lastUsedSettings.ts';
import { BoxRect, isObjectInBox } from './geometry/selectionBox.ts';
import { SpatialIndex } from './geometry/spatialIndex.ts';
import { renderLineworkImpl } from './render/linework.ts';
import {
  EditCommandKind,
  EditCommandState,
  startEditCommandImpl,
  isEditAwaitingValueImpl,
  getEditPromptImpl,
  applyEditValueImpl,
  handleEditClickImpl,
  renderEditPreviewImpl,
} from './tools/editCommands.ts';
export type { EditCommandKind } from './tools/editCommands.ts';
import { commitWallWithLengthImpl, finishRouteImpl, finishCalibrationImpl } from './tools/drawingTools.ts';
import { onGroupDragStartImpl, onGroupDragMoveImpl, onGroupDragEndImpl, selectSimilarImpl } from './interaction/groupDrag.ts';
import { getDrawingBoundsImpl, exportDrawingImageDataURLImpl } from './export/exportImage.ts';
import { bindEventsImpl, processPointerMoveImpl } from './interaction/pointerEvents.ts';
import { handleKeyDownImpl, handleKeyUpImpl } from './interaction/keyboard.ts';
import { onViewTransformChangedImpl, touchToLocalImpl, getPinchMetricsImpl, beginPinchImpl, updatePinchImpl, shouldUseFastGestureImpl, beginGestureImpl, scheduleGestureFrameImpl, applyGestureTransformsImpl, scheduleGestureEndImpl, endGestureImpl, flushGestureImpl } from './interaction/gestures.ts';
import { renderBackgroundLayerImpl, renderGridLayerImpl } from './render/backgroundGrid.ts';
import { renderObjectsLayerImpl } from './render/objectsLayer.ts';
import { renderSymbolImpl } from './render/symbols.ts';
import { renderRouteImpl } from './render/routes.ts';
import { renderTextObjectImpl, renderDimensionImpl } from './render/annotations.ts';
import { getRoomGraphImpl, detectRoomsImpl, roomFaceOfImpl, renderRoomFillsImpl, renderRoomLabelImpl } from './render/rooms.ts';
import type { RoomGraph, RoomFace } from '../model/rooms.ts';
import type { RoomObject } from '../model/types.ts';
import { renderDoorImpl, renderWindowImpl } from './render/openings.ts';
import { renderWallHandlesImpl } from './render/wallHandles.ts';
import { renderInteractionLayerImpl, renderAngleGuidelineImpl, renderFloatingBadgeImpl, renderSnapIndicatorOnlyImpl, renderSnapIndicatorShapesImpl } from './render/interactionLayer.ts';
import { planAlign, ALIGN_LABELS, type AlignMode } from '../model/align.ts';


export type ToolMode =
  | 'select'
  | 'wall'
  | 'door'
  | 'window'
  | 'symbol'
  | 'route'
  | 'dimension'
  | 'measure'
  | 'area'
  | 'calibrate'
  | 'pan'
  | 'text'
  | 'edit'; // أمر تحرير بنقطة أساس (نقل/نسخ/تدوير/تحجيم/مرآة/مصفوفة/إزاحة)

export interface SketchUpCalibrationEvent {
  startWorld: Point;
  endWorld: Point;
  pixelDistance: number;
  screenPosition: Point;
}

export interface WallDrawingState {
  isDrawing: boolean;
  startPoint: Point | null;
  currentLengthMeters: number;
  currentAngleDegrees: number;
}

export interface EngineCallbacks {
  onSelectObject: (objectId: string | null) => void;
  onSelectObjects?: (objectIds: string[]) => void;
  onCursorMove: (worldPoint: Point, snap: SnapResult) => void;
  onCameraChange: (cameraState: CameraState) => void;
  onCalibrationRequest?: (p1: Point, p2: Point, pixelDistance: number) => void;
  onSketchUpCalibration?: (event: SketchUpCalibrationEvent) => void;
  onAreaUpdate?: (pixelArea: number, pixelPerimeter: number, pointsCount: number) => void;
  onRouteUpdate?: (pointsCount: number, pixelLength: number, kind: RouteKind) => void;
  onWallDrawingStateChange?: (state: WallDrawingState) => void;
  onContextMenu?: (event: { clientX: number; clientY: number; targetObjectId: string | null }) => void;
  onToolModeChange?: (mode: ToolMode) => void;
  onSelectionSubModeChange?: (subMode: 'single' | 'box' | 'multi') => void;
  /** تغيّر وضع التعامد (F8) */
  onOrthoModeChange?: (enabled: boolean) => void;
}


export class CadEngine {
  container: HTMLDivElement;
  stage: Konva.Stage;
  backgroundLayer: Konva.Layer;
  gridLayer: Konva.Layer;
  objectsLayer: Konva.Layer;
  interactionLayer: Konva.Layer;

  model: ProjectModel;
  camera: Camera;
  toolMode: ToolMode = 'select';
  selectedObjectId: string | null = null;
  selectedObjectIds: string[] = [];
  selectionSubMode: 'single' | 'box' | 'multi' = 'single';
  isMarqueeSelecting: boolean = false;
  marqueeStartPoint: Point | null = null;
  hoveredObjectId: string | null = null;
  groupDragStartPositions: Map<string, { x: number; y: number }> = new Map();
  isShiftKeyPressed: boolean = false;
  wasGroupDragged: boolean = false;
  isTransformPending: boolean = false;
  isPointerMovePending: boolean = false;
  pendingPointerPos: Point | null = null;
  pendingShiftKey: boolean = false;

  // إعدادات المظهر والسمة
  theme: 'dark' | 'light' = 'dark';

  /** مخطط الغرف المحسوب من الجدران (يُبطل عند تغير إصدار النموذج) */
  roomGraphCache: { version: number; graph: RoomGraph } | null = null;

  // إعدادات الالتقاط والشبكة
  gridDensity: GridDensity = 'medium';
  snapOptions: SnapOptions = {
    enableGridSnap: true,
    enableObjectSnap: true,
    gridSize: 20,
    snapRadius: 8,
  };
  activeCalibrationLine: { p1: Point; p2: Point; dist: number } | null = null;

  // إعدادات الأبواب والنوافذ الافتراضية
  defaultDoorWidth: number = 45; // 0.90م
  defaultWindowWidth: number = 60; // 1.20م
  defaultDoorDirection: DoorOpenDirection = 'inward_right';

  // حالة الرسم النشط (رسم الجدار)
  isDrawingWall: boolean = false;
  wallStartPoint: Point | null = null;

  // حالة رسم البعد الهندسي (Dimension)
  isDrawingDimension: boolean = false;
  dimensionStartPoint: Point | null = null;

  // حالة شريط القياس المؤقت (Measure Tape)
  isMeasuring: boolean = false;
  measureStartPoint: Point | null = null;

  // حالة قياس المساحة والمحيط (Area & Perimeter)
  areaPoints: Point[] = [];

  // حالة أداة المعايرة (Calibration)
  isCalibrating: boolean = false;
  calibrateStartPoint: Point | null = null;

  // حالة رسم المسار (Route - المرحلة 5)
  isDrawingRoute: boolean = false;
  routePoints: Point[] = [];
  activeRouteKind: RouteKind = 'electrical';
  activeRouteLineStyle: 'solid' | 'dashed' | 'dotted' = 'solid';
  routeStartSymbolId?: string;

  currentSnapResult: SnapResult = { point: { x: 0, y: 0 }, snapped: false, type: 'none' };
  currentWallSnap: WallSnapResult | null = null;
  currentSymbolWallSnap: SymbolWallSnapResult | null = null;
  activeSymbolKind: string = 'socket_single';

  // كاش صورة الخلفية لتفادي إعادة التحميل المتكررة
  bgImageElement: HTMLImageElement | null = null;
  lastBgDataUrl: string | null = null;
  pendingBgDataUrl: string | null = null;

  // إظهار أو إخفاء أطوال الجدران
  showWallLengths: boolean = true;

  // حالة التحريك (Pan)
  isPanning: boolean = false;
  panStartPos: Point = { x: 0, y: 0 };
  isSpacePressed: boolean = false;

  // callbacks للواجهة
  callbacks: EngineCallbacks;

  // ─── تحسينات الأداء للمخططات الكبيرة (Large Drawings Performance) ───
  /** طبقة بديلة تعرض لقطة نقطية (Bitmap Snapshot) من طبقة العناصر أثناء التكبير/التحريك */
  gestureProxyLayer: Konva.Layer;
  gestureProxyImage: Konva.Image | null = null;
  gestureSnapshotCanvas: HTMLCanvasElement | null = null;
  /** حالة الكاميرا التي رُسمت بها طبقة العناصر آخر مرة (أساس حساب التحويل المؤقت) */
  objectsRenderedCamera: CameraState | null = null;
  bgRenderedCamera: CameraState | null = null;
  isGestureActive: boolean = false;
  gestureBaseCamera: CameraState | null = null;
  gestureFramePending: boolean = false;
  gestureEndTimer: ReturnType<typeof setTimeout> | null = null;
  /** مدة آخر إعادة بناء لطبقة العناصر (ms) لاختيار الوضع السريع تلقائياً */
  lastObjectsRenderMs: number = 0;
  /** عدد مجموعات العناصر المرسومة فعلياً في آخر إعادة بناء (تقدير كلفة الرسم على الكانفس) */
  lastRenderedGroupCount: number = 0;
  static readonly FAST_GESTURE_GROUP_THRESHOLD = 400;
  /** عتبة التحول للوضع السريع: إذا تجاوزت إعادة البناء هذه المدة نستخدم اللقطة النقطية */
  static readonly FAST_GESTURE_THRESHOLD_MS = 12;
  static readonly GESTURE_SETTLE_MS = 140;
  /** تعطيل الاقتطاع (Culling) أثناء التصدير لضمان رسم كامل المخطط */
  disableCulling: boolean = false;
  /** طلب إعادة رسم مجمّع في الإطار القادم (Coalesced Render) */
  renderRequested: boolean = false;
  /** ذاكرة مؤقتة لمجموعة العناصر المحددة لتسريع isObjectSelected */
  selectionCacheSource: string[] | null = null;
  selectionCacheSet: Set<string> = new Set();
  /** إيماءة اللمس بإصبعين (Pinch Zoom / Two-finger Pan) */
  pinchState: { dist: number; center: Point } | null = null;
  /** حالة ما قبل لمسة الإصبع الأول لإلغاء أثرها إن تبيّن أنها بداية إيماءة قرص */
  touchStartSnapshot: {
    time: number;
    wasDrawingWall: boolean;
    routeLen: number;
    areaLen: number;
    undoCount: number;
    selectedIds: string[];
  } | null = null;
  /** مستمعات النافذة لإزالتها عند التدمير (منع تسرب الذاكرة) */
  windowMouseUpHandler: (() => void) | null = null;
  containerPointerDownCapture: ((e: Event) => void) | null = null;
  containerContextMenuHandler: ((e: MouseEvent) => void) | null = null;

  constructor(
    container: HTMLDivElement,
    model: ProjectModel,
    callbacks: EngineCallbacks
  ) {
    this.container = container;
    this.model = model;
    this.callbacks = callbacks;
    this.camera = new Camera(1.0, container.clientWidth / 2, container.clientHeight / 2);

    // تحديد دقة البكسل القصوى (2x) لتخفيف الحمل على شاشات الهواتف والـ 4K دون فقدان وضوح ملحوظ
    if (typeof window !== 'undefined' && window.devicePixelRatio > 2) {
      Konva.pixelRatio = 2;
    }

    // تهيئة مسرح Konva
    this.stage = new Konva.Stage({
      container: container,
      width: container.clientWidth,
      height: container.clientHeight,
    });

    this.backgroundLayer = new Konva.Layer();
    this.gridLayer = new Konva.Layer({ listening: false });
    this.objectsLayer = new Konva.Layer();
    this.interactionLayer = new Konva.Layer({ listening: false });
    this.gestureProxyLayer = new Konva.Layer({ listening: false, visible: false });

    this.stage.add(this.backgroundLayer);
    this.stage.add(this.gridLayer);
    this.stage.add(this.gestureProxyLayer);
    this.stage.add(this.objectsLayer);
    this.stage.add(this.interactionLayer);

    // تهيئة دقة الشبكة والالتقاط والسمة من آخر إعداد مستخدم
    const lastSettings = getLastUsedSettings();
    this.theme = (lastSettings.themeMode as 'dark' | 'light') || 'dark';
    this.gridDensity = lastSettings.gridDensity || 'medium';
    this.showWallLengths = lastSettings.showWallLengths !== false;
    const gridOpts = getGridOptionsForDensity(this.gridDensity, model.getMeta().scale || 50);
    this.snapOptions.gridSize = gridOpts.gridSize;
    this.snapOptions.snapRadius = gridOpts.snapRadius;

    // فهرس مكاني للالتقاط في المخططات الكبيرة (يُبنى عند الحاجة ويُبطل مع كل تغيير في النموذج)
    SnapEngine.narrowProvider = (all, p, radius) => {
      if (all.length < CadEngine.SPATIAL_INDEX_MIN_OBJECTS || all.length !== this.model.getObjectCount()) return all;
      const v = this.model.getVersion();
      if (!this.spatialIndex || this.spatialIndexVersion !== v) {
        this.spatialIndex = new SpatialIndex(this.model.getObjects());
        this.spatialIndexVersion = v;
      }
      return this.spatialIndex.query(p.x - radius, p.y - radius, p.x + radius, p.y + radius);
    };

    this.bindEvents();

    // الاستماع لزر الفأرة الأيمن لعرض قائمة الخيارات السياقية بدقة وموثوقية عالية
    let lastContextMenuTimestamp = 0;
    const triggerContextMenu = (clientX: number, clientY: number) => {
      try {
        const now = Date.now();
        if (now - lastContextMenuTimestamp < 25) return;
        lastContextMenuTimestamp = now;

        this.isPanning = false;
        this.isMarqueeSelecting = false;
        this.marqueeStartPoint = null;

        // إذا كان المستخدم يرسم أو يقيس، نلغي حالة الرسم الحالية لنعيد الحالة للوضع الطبيعي
        if (this.isDrawingWall || this.isDrawingRoute || this.isDrawingDimension || this.isMeasuring || this.isCalibrating || this.toolMode === 'area') {
          this.cancelDrawing();
          this.renderInteractionLayer();
        }

        const rect = this.container.getBoundingClientRect();
        const pointer = {
          x: clientX - rect.left,
          y: clientY - rect.top,
        };
        const worldPoint = this.camera.screenToWorld(pointer);
        let targetObjectId: string | null = null;

        // 1. فحص الشكل المباشر عبر Konva
        const shape = this.stage.getIntersection(pointer);
        if (shape) {
          let current: Konva.Node | null = shape;
          while (current && current !== this.stage) {
            const id = current.id();
            if (id && this.model.getObjectById(id)) {
              targetObjectId = id;
              break;
            }
            current = current.parent;
          }
        }

        // 2. فحص العناصر هندسياً في حال كان النقر قريباً من الجدار أو الرمز أو المسار أو الباب أو النافذة
        if (!targetObjectId) {
          const all = this.model.getObjects();
          for (const obj of all) {
            if (obj.type === 'wall') {
              const w = obj as WallObject;
              const d = SnapEngine.pointToSegmentDistance(worldPoint, w.start, w.end);
              if (d <= Math.max(20, w.thickness / 2 + 14)) {
                targetObjectId = w.id;
                break;
              }
            } else if (obj.type === 'symbol') {
              const s = obj as SymbolObject;
              if (SnapEngine.distance(worldPoint, { x: s.x, y: s.y }) <= 32) {
                targetObjectId = s.id;
                break;
              }
            } else if (obj.type === 'route') {
              const r = obj as RouteObject;
              for (let i = 0; i < r.points.length - 1; i++) {
                if (SnapEngine.pointToSegmentDistance(worldPoint, r.points[i], r.points[i + 1]) <= 20) {
                  targetObjectId = r.id;
                  break;
                }
              }
              if (targetObjectId) break;
            } else if (obj.type === 'text' || obj.type === 'room') {
              const t = obj as TextObject;
              if (SnapEngine.distance(worldPoint, { x: t.x, y: t.y }) <= 40) {
                targetObjectId = t.id;
                break;
              }
            } else if (obj.type === 'dimension') {
              const dim = obj as DimensionObject;
              if (SnapEngine.pointToSegmentDistance(worldPoint, dim.start, dim.end) <= 20) {
                targetObjectId = dim.id;
                break;
              }
            } else if (obj.type === 'door' || obj.type === 'window') {
              const item = obj as DoorObject | WindowObject;
              const parentWall = all.find((o) => o.id === item.wallId) as WallObject | undefined;
              if (parentWall) {
                const cx = parentWall.start.x + item.position * (parentWall.end.x - parentWall.start.x);
                const cy = parentWall.start.y + item.position * (parentWall.end.y - parentWall.start.y);
                if (SnapEngine.distance(worldPoint, { x: cx, y: cy }) <= 28) {
                  targetObjectId = item.id;
                  break;
                }
              }
            }
          }
        }

        if (targetObjectId) {
          if (!this.selectedObjectIds.includes(targetObjectId)) {
            this.selectObject(targetObjectId);
          }
        } else {
          // نقر الزر الأيمن في منطقة فارغة يلغي التحديدات السابقة لفتح خيارات المخطط العامة
          this.deselectAll();
        }

        this.callbacks.onContextMenu?.({
          clientX,
          clientY,
          targetObjectId,
        });
      } catch (err) {
        console.error('Error handling contextmenu event:', err);
      }
    };

    this.containerContextMenuHandler = (e: MouseEvent) => {
      e.preventDefault();
      triggerContextMenu(e.clientX, e.clientY);
    };
    this.container.addEventListener('contextmenu', this.containerContextMenuHandler);

    this.stage.on('contextmenu', (e) => {
      e.evt.preventDefault();
      triggerContextMenu(e.evt.clientX, e.evt.clientY);
    });

    this.render();
  }

  public setShowWallLengths(show: boolean): void {
    this.showWallLengths = show;
    updateLastUsedSettings({ showWallLengths: show });
    this.render();
  }

  public getShowWallLengths(): boolean {
    return this.showWallLengths;
  }

  public setTheme(theme: 'dark' | 'light'): void {
    if (this.theme !== theme) {
      this.theme = theme;
      this.render();
    }
  }

  public getTheme(): 'dark' | 'light' {
    return this.theme;
  }

  public getCamera(): Camera {
    return this.camera;
  }

  public setToolMode(mode: ToolMode): void {
    if (this.toolMode !== mode) {
      this.toolMode = mode;
      this.cancelDrawing();
      this.trackPoints = [];
      if (mode !== 'select') {
        this.deselectAll();
      }
      this.render();
      this.renderInteractionLayer();
      this.updateCursor();
      this.callbacks.onToolModeChange?.(mode);
    }
  }

  public getToolMode(): ToolMode {
    return this.toolMode;
  }

  public setGridDensity(density: GridDensity): void {
    this.gridDensity = density;
    updateLastUsedSettings({ gridDensity: density });
    const gridOpts = getGridOptionsForDensity(density, this.model.getMeta().scale || 50);
    this.snapOptions.gridSize = gridOpts.gridSize;
    this.snapOptions.snapRadius = gridOpts.snapRadius;
    this.render();
  }

  public getGridDensity(): GridDensity {
    return this.gridDensity;
  }

  public clearActiveCalibration(): void {
    this.activeCalibrationLine = null;
    this.isCalibrating = false;
    this.calibrateStartPoint = null;
    this.renderInteractionLayer();
  }

  public getWallDrawingState(): WallDrawingState {
    if (!this.isDrawingWall || !this.wallStartPoint) {
      return { isDrawing: false, startPoint: null, currentLengthMeters: 0, currentAngleDegrees: 0 };
    }
    const endWorld = this.currentSnapResult.point;
    const pixelsPerMeter = this.model.getMeta().scale || 50;
    const distPx = SnapEngine.distance(this.wallStartPoint, endWorld);
    const currentLengthMeters = distPx / pixelsPerMeter;
    const dx = endWorld.x - this.wallStartPoint.x;
    const dy = endWorld.y - this.wallStartPoint.y;
    let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (angleDeg < 0) angleDeg += 360;
    return {
      isDrawing: true,
      startPoint: { ...this.wallStartPoint },
      currentLengthMeters,
      currentAngleDegrees: angleDeg,
    };
  }

  public commitWallWithLength(lengthMeters: number): boolean {
    return commitWallWithLengthImpl.call(this, lengthMeters);
  }

  public getActiveCalibration(): { p1: Point; p2: Point; dist: number } | null {
    return this.activeCalibrationLine ? { ...this.activeCalibrationLine } : null;
  }

  public setSnapOptions(options: Partial<SnapOptions>): void {
    this.snapOptions = { ...this.snapOptions, ...options };
    this.render();
  }

  public getSnapOptions(): SnapOptions {
    return { ...this.snapOptions };
  }

  public isObjectSelected(id: string): boolean {
    if (this.selectedObjectId === id) return true;
    // O(1) بدلاً من O(n) — مهم عند تحديد آلاف العناصر (Ctrl+A) ثم إعادة الرسم
    if (this.selectionCacheSource !== this.selectedObjectIds) {
      this.selectionCacheSource = this.selectedObjectIds;
      this.selectionCacheSet = new Set(this.selectedObjectIds);
    }
    return this.selectionCacheSet.has(id);
  }

  /**
   * خيارات الالتقاط الفعلية: نصف قطر الالتقاط يُحسب بالبكسل على الشاشة (كما في AutoCAD Aperture)
   * فلا يصبح الالتقاط معدوماً عند التصغير الشديد ولا "لاصقاً" بشكل مزعج عند التكبير الشديد.
   * عند تكبير 100% تبقى القيم مطابقة تماماً للسلوك السابق.
   */
  getEffectiveSnapOptions(): SnapOptions {
    const zoom = this.camera.getState().zoom || 1;
    const base = this.snapOptions.snapRadius;
    const factor = Math.max(0.25, Math.min(4, 1 / zoom));
    const opts: SnapOptions = { ...this.snapOptions, snapRadius: base * factor };
    // أدوات الرسم فقط: الالتقاط العمودي من نقطة البداية + تتبع المحاذاة
    if (CadEngine.TRACKING_TOOLS.includes(this.toolMode)) {
      const origin = this.getDrawingOrigin();
      opts.fromPoint = origin;
      const pts = origin ? [origin, ...this.trackPoints] : [...this.trackPoints];
      if (pts.length > 0) opts.trackPoints = pts;
    }
    return opts;
  }

  // ═══ دقة الرسم: التعامد F8، تتبع المحاذاة، والإدخال الرقمي للإحداثيات ═══

  /** الأدوات التي يُفعَّل فيها تتبع المحاذاة والالتقاط العمودي */
  static readonly TRACKING_TOOLS: ToolMode[] = ['wall', 'dimension', 'measure', 'route', 'area', 'calibrate', 'edit'];

  // ═══ أوامر التحرير بنقطة أساس (tools/editCommands.ts) ═══
  editCmd: EditCommandState | null = null;

  // ═══ الفهرس المكاني للالتقاط (المرحلة 5) ═══
  static readonly SPATIAL_INDEX_MIN_OBJECTS = 2000;
  spatialIndex: SpatialIndex | null = null;
  spatialIndexVersion = -1;

  public startEditCommand(kind: EditCommandKind): string | null {
    return startEditCommandImpl.call(this, kind);
  }

  /** محاذاة/توزيع العناصر المحددة (خطوة تراجع واحدة). يعيد رسالة خطأ أو null */
  public alignSelection(mode: AlignMode): string | null {
    const ids = this.getSelectedObjectIds();
    const plan = planAlign(this.model.getObjects(), ids, mode);
    if (typeof plan === 'string') return plan;
    this.model.applyEdits(plan, ALIGN_LABELS[mode]);
    this.render();
    return null;
  }

  public isEditAwaitingValue(): boolean {
    return isEditAwaitingValueImpl.call(this);
  }

  public getEditPrompt(): string {
    return getEditPromptImpl.call(this);
  }

  public applyEditValue(text: string): string | null {
    return applyEditValueImpl.call(this, text);
  }

  handleEditClick(point: Point, objectSnapped: boolean, shift: boolean, rawPoint?: Point): void {
    return handleEditClickImpl.call(this, point, objectSnapped, shift, rawPoint);
  }

  /** رسالة حالة أمر التحرير (مثل: لا توجد حدود للقص) تظهر في شريط الأوامر */
  editMessage: string | null = null;

  renderEditPreview(shift: boolean): void {
    return renderEditPreviewImpl.call(this, shift);
  }

  renderLinework(line: LineObject, isLocked: boolean, layerColor: string, layerOpacity: number): void {
    return renderLineworkImpl.call(this, line, isLocked, layerColor, layerOpacity);
  }
  /** نقاط التقاط مكتسبة (نهايات/منتصفات/تقاطعات مرّ عليها المؤشر) لتتبع المحاذاة */
  trackPoints: Point[] = [];
  /** نقطة مفروضة من شريط الأوامر تُستخدم بدلاً من موضع المؤشر في النقرة المحاكاة */
  forcedInputPoint: Point | null = null;
  /** آخر نقطة أُدخلت أو نُقرت (مرجع الإحداثيات النسبية @ عند عدم وجود أمر جارٍ) */
  lastInputPoint: Point | null = null;
  /** آخر موضع للمؤشر بإحداثيات العالم (لاتجاه إدخال "الطول فقط") */
  lastCursorWorld: Point | null = null;

  public getOrthoMode(): boolean {
    return SnapEngine.orthoMode;
  }

  public setOrthoMode(enabled: boolean): void {
    SnapEngine.orthoMode = enabled;
    this.callbacks.onOrthoModeChange?.(enabled);
    this.renderInteractionLayer(this.isShiftKeyPressed);
  }

  public toggleOrthoMode(): void {
    this.setOrthoMode(!SnapEngine.orthoMode);
  }

  /** اكتساب نقطة تتبع (بحد أقصى 4 نقاط، الأحدث أولاً) */
  acquireTrackPoint(p: Point): void {
    if (this.trackPoints.some((t) => Math.abs(t.x - p.x) < 0.5 && Math.abs(t.y - p.y) < 0.5)) return;
    this.trackPoints = [{ x: p.x, y: p.y }, ...this.trackPoints].slice(0, 4);
  }

  /** نقطة أصل الأمر الجاري (بداية الجدار، آخر نقطة مسار...) أو null */
  public getDrawingOrigin(): Point | null {
    if (this.isDrawingWall && this.wallStartPoint) return this.wallStartPoint;
    if (this.isDrawingDimension && this.dimensionStartPoint) return this.dimensionStartPoint;
    if (this.isMeasuring && this.measureStartPoint) return this.measureStartPoint;
    if (this.isCalibrating && this.calibrateStartPoint) return this.calibrateStartPoint;
    if (this.toolMode === 'route' && this.routePoints.length > 0) return this.routePoints[this.routePoints.length - 1];
    if (this.toolMode === 'area' && this.areaPoints.length > 0) return this.areaPoints[this.areaPoints.length - 1];
    if (this.toolMode === 'edit' && this.editCmd?.base && this.editCmd.step >= 1) return this.editCmd.base;
    return null;
  }

  /**
   * إدخال نقطة رقمياً (بالمتر) كأنها نقرة دقيقة على اللوحة للأداة الحالية:
   *  - مطلق:  x,y        مثال 3,2.5
   *  - نسبي:  @dx,dy     مثال @4,0
   *  - قطبي:  @طول<زاوية مثال @3<90 (الزاوية بنفس اصطلاح البرنامج: 0° يمين، 90° للأسفل)
   *  - طول فقط: 3.5  ← على امتداد اتجاه المؤشر من نقطة البداية
   * يعيد رسالة خطأ عربية أو null عند النجاح.
   */
  /** إنهاء الأمر الجاري متعدد النقاط (Enter): إنهاء المسار أو إغلاق مضلع المساحة. يعيد true إن نفّذ شيئاً */
  public completeCurrentCommand(): boolean {
    if (this.toolMode === 'route' && this.isDrawingRoute && this.routePoints.length >= 2) {
      this.finishRoute();
      return true;
    }
    if (this.toolMode === 'area' && this.areaPoints.length >= 3) {
      this.closeAreaPolygon();
      return true;
    }
    if (this.isDrawingWall) {
      this.cancelDrawing();
      return true;
    }
    return false;
  }

  public applyPointInput(text: string): string | null {
    if (this.toolMode === 'select' || this.toolMode === 'pan') {
      return 'اختر أداة رسم أولاً (جدار، بُعد، مسار...)';
    }
    const ppm = this.model.getMeta().scale || 50;
    const raw = text.trim().replace(/،/g, ',').replace(/\s+/g, '');
    if (!raw) return 'أدخل قيمة';
    const origin = this.getDrawingOrigin();
    const ref = origin || this.lastInputPoint;
    let target: Point | null = null;
    const num = (v: string) => (v === '' ? NaN : Number(v));
    if (raw.startsWith('@')) {
      const body = raw.slice(1);
      const base = ref || { x: 0, y: 0 };
      if (body.includes('<')) {
        const [l, a] = body.split('<');
        const len = num(l);
        const ang = num(a);
        if (!isFinite(len) || !isFinite(ang)) return 'صيغة قطبية غير صحيحة. مثال: @3<90';
        const rad = (ang * Math.PI) / 180;
        target = { x: base.x + len * ppm * Math.cos(rad), y: base.y + len * ppm * Math.sin(rad) };
      } else {
        const [dx, dy] = body.split(',');
        if (!isFinite(num(dx)) || !isFinite(num(dy))) return 'صيغة نسبية غير صحيحة. مثال: @2,0';
        target = { x: base.x + num(dx) * ppm, y: base.y + num(dy) * ppm };
      }
    } else if (raw.includes(',')) {
      const [x, y] = raw.split(',');
      if (!isFinite(num(x)) || !isFinite(num(y))) return 'صيغة الإحداثيات غير صحيحة. مثال: 3,2.5';
      target = { x: num(x) * ppm, y: num(y) * ppm };
    } else {
      const len = num(raw);
      if (!isFinite(len) || len <= 0) return 'قيمة غير مفهومة';
      if (!origin) return 'حدد نقطة البداية أولاً أو أدخل إحداثيات x,y';
      const cursor = this.lastCursorWorld || this.currentSnapResult.point;
      let dir = { x: cursor.x - origin.x, y: cursor.y - origin.y };
      const polar = SnapEngine.getPolarAngleSnap(origin, cursor, [0, 45, 90, 135, 180, 225, 270, 315, 360], this.isShiftKeyPressed ? 25 : 5.0);
      if (polar.isSnapped) dir = { x: polar.point.x - origin.x, y: polar.point.y - origin.y };
      const d = Math.hypot(dir.x, dir.y);
      const ux = d > 0.001 ? dir.x / d : 1;
      const uy = d > 0.001 ? dir.y / d : 0;
      target = { x: origin.x + ux * len * ppm, y: origin.y + uy * len * ppm };
    }
    // تقريب لإزالة ضجيج الفاصلة العائمة (مثل 39.99999 ← 40)
    target = { x: Math.round(target.x * 1e6) / 1e6, y: Math.round(target.y * 1e6) / 1e6 };
    this.forcedInputPoint = target;
    try {
      this.stage.fire('mousedown', { evt: { button: 0, shiftKey: false } } as unknown as Konva.KonvaEventObject<MouseEvent>);
    } finally {
      this.forcedInputPoint = null;
    }
    this.lastInputPoint = target;
    this.currentSnapResult = { point: target, snapped: true, type: 'input', label: 'إدخال رقمي' };
    this.renderInteractionLayer();
    return null;
  }

  public selectObject(id: string | null, updateMulti: boolean = true): void {
    this.selectedObjectId = id;
    if (updateMulti) {
      this.selectedObjectIds = id ? [id] : [];
    }
    this.callbacks.onSelectObject(id);
    this.callbacks.onSelectObjects?.(this.selectedObjectIds);
    this.renderObjectsLayer();
    this.renderInteractionLayer();
  }

  public selectObjects(ids: string[]): void {
    this.selectedObjectIds = [...ids];
    this.selectedObjectId = ids.length > 0 ? ids[0] : null;
    this.callbacks.onSelectObject(this.selectedObjectId);
    this.callbacks.onSelectObjects?.(this.selectedObjectIds);
    this.renderObjectsLayer();
    this.renderInteractionLayer();
  }

  public toggleObjectSelection(id: string): void {
    if (this.selectedObjectIds.includes(id)) {
      this.selectedObjectIds = this.selectedObjectIds.filter((item) => item !== id);
      this.selectedObjectId = this.selectedObjectIds.length > 0 ? this.selectedObjectIds[0] : null;
    } else {
      this.selectedObjectIds = [...this.selectedObjectIds, id];
      this.selectedObjectId = id;
    }
    this.callbacks.onSelectObject(this.selectedObjectId);
    this.callbacks.onSelectObjects?.(this.selectedObjectIds);
    this.renderObjectsLayer();
    this.renderInteractionLayer();
  }

  public getSelectedObjectId(): string | null {
    return this.selectedObjectId;
  }

  public getSelectedObjectIds(): string[] {
    return [...this.selectedObjectIds];
  }

  public setSelectionSubMode(mode: 'single' | 'box' | 'multi'): void {
    if (this.selectionSubMode !== mode) {
      this.selectionSubMode = mode;
      this.renderInteractionLayer();
      this.callbacks.onSelectionSubModeChange?.(mode);
    }
  }

  public getSelectionSubMode(): 'single' | 'box' | 'multi' {
    return this.selectionSubMode;
  }

  public selectAllInLayer(layerId: string): void {
    const layerObjects = this.model.getObjects().filter((obj) => obj.layerId === layerId);
    this.selectObjects(layerObjects.map((o) => o.id));
  }

  public selectSimilar(targetId?: string): void {
    return selectSimilarImpl.call(this, targetId);
  }

  public deselectAll(): void {
    this.selectObjects([]);
  }

  /**
   * بدء تحريك جماعي أو فردي للعناصر المحددة معاً في الكانفس
   */
  onGroupDragStart(draggedId: string): void {
    return onGroupDragStartImpl.call(this, draggedId);
  }

  /**
   * تحريك العناصر المحددة الأخرى لحظياً في الكانفس أثناء سحب أحدها (60/120 FPS بدون هدم الكانفس)
   */
  onGroupDragMove(draggedId: string, currentDraggedPos: { x: number; y: number }): void {
    return onGroupDragMoveImpl.call(this, draggedId, currentDraggedPos);
  }

  /**
   * إنهاء التحريك الجماعي وتطبيق الإزاحة المتجهة (Delta) على نموذج البيانات في خطوة واحدة
   */
  onGroupDragEnd(draggedId: string, finalDraggedPos: { x: number; y: number }): boolean {
    return onGroupDragEndImpl.call(this, draggedId, finalDraggedPos);
  }

  public setDefaultDoorWidth(width: number): void {
    this.defaultDoorWidth = width;
  }

  public setDefaultWindowWidth(width: number): void {
    this.defaultWindowWidth = width;
  }

  public setDefaultDoorDirection(dir: DoorOpenDirection): void {
    this.defaultDoorDirection = dir;
  }

  public getActiveSymbolKind(): string {
    return this.activeSymbolKind;
  }

  public setActiveSymbolKind(kind: string): void {
    this.activeSymbolKind = kind;
    this.renderInteractionLayer();
  }

  public getActiveRouteKind(): RouteKind {
    return this.activeRouteKind;
  }

  public setActiveRouteKind(kind: RouteKind): void {
    this.activeRouteKind = kind;
    this.notifyRouteUpdate();
    this.renderInteractionLayer();
  }

  public getActiveRouteLineStyle(): 'solid' | 'dashed' | 'dotted' {
    return this.activeRouteLineStyle;
  }

  public setActiveRouteLineStyle(style: 'solid' | 'dashed' | 'dotted'): void {
    this.activeRouteLineStyle = style;
    this.renderInteractionLayer();
  }

  notifyRouteUpdate(): void {
    const pixelLen = calculateRoutePixelLength(this.routePoints);
    this.callbacks.onRouteUpdate?.(this.routePoints.length, pixelLen, this.activeRouteKind);
  }

  /**
   * إنهاء وحفظ المسار الهندسي الحالي (المرحلة 5)
   */
  public finishRoute(): void {
    return finishRouteImpl.call(this);
  }

  public cancelRoute(): void {
    this.isDrawingRoute = false;
    this.routePoints = [];
    this.routeStartSymbolId = undefined;
    this.notifyRouteUpdate();
    this.renderInteractionLayer();
  }

  public zoomIn(): void {
    const center = { x: this.stage.width() / 2, y: this.stage.height() / 2 };
    this.camera.zoomAtScreenPoint(1.2, center);
    this.onViewTransformChanged();
  }

  public zoomOut(): void {
    const center = { x: this.stage.width() / 2, y: this.stage.height() / 2 };
    this.camera.zoomAtScreenPoint(1 / 1.2, center);
    this.onViewTransformChanged();
  }

  public resetZoom(): void {
    this.camera.reset(this.stage.width(), this.stage.height());
    this.onViewTransformChanged();
  }

  /**
   * حساب الإطار المحيط بكافة عناصر المشروع في إحداثيات العالم
   */
  public getDrawingBounds(includeBackground: boolean = false): {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  } {
    return getDrawingBoundsImpl.call(this, includeBackground);
  }

  /**
   * ملاءمة العرض لكامل عناصر المخطط (Zoom to Fit)
   */
  public zoomToFit(): void {
    const bounds = this.getDrawingBounds(true);
    this.camera.fitBounds(bounds, this.stage.width(), this.stage.height(), 60);
    this.onViewTransformChanged();
  }

  /**
   * تصدير مشهد الرسم عالي الدقة كصورة بصيغة DataURL لاستخدامه في تصدير PDF والصور (المرحلة 6)
   */
  public exportDrawingImageDataURL(options?: {
    pixelRatio?: number;
    includeGrid?: boolean;
    includeBackground?: boolean;
    includeDimensions?: boolean;
    visibleLayerIds?: string[];
    boundsMode?: 'drawing' | 'current';
    padding?: number;
    customWidth?: number;
    customHeight?: number;
    /** سمة ألوان العناصر في الصورة المصدّرة (افتراضياً سمة الواجهة الحالية) */
    theme?: 'dark' | 'light';
    /** طباعة بمقياس حقيقي: مركز الإطار بإحداثيات العالم والتكبير (بكسل صورة لكل بكسل عالم) */
    camera?: { centerX: number; centerY: number; zoom: number };
    /** سماكة خط الطباعة لكل طبقة بالبكسل (في الصورة الناتجة) — الطبقات غير المذكورة تبقى كما هي */
    lineWeightsPx?: Record<string, number>;
  }): string {
    return exportDrawingImageDataURLImpl.call(this, { ...options, output: 'dataUrl' }) as string;
  }

  /** مثل exportDrawingImageDataURL لكن يعيد Canvas (للطباعة بمقياس حقيقي على ورق كبير) */
  public exportDrawingCanvas(options: Parameters<CadEngine['exportDrawingImageDataURL']>[0]): HTMLCanvasElement {
    return exportDrawingImageDataURLImpl.call(this, { ...options, output: 'canvas' }) as HTMLCanvasElement;
  }

  public resize(width: number, height: number): void {
    this.stage.width(width);
    this.stage.height(height);
    this.render();
  }

  /**
   * إنهاء وإغلاق مضلع قياس المساحة يدوياً
   */
  public closeAreaPolygon(): void {
    if (this.areaPoints.length >= 3) {
      const pixelArea = GridUtils.calculatePolygonArea(this.areaPoints);
      const pixelPerimeter = GridUtils.calculatePolygonPerimeter(this.areaPoints);
      this.callbacks.onAreaUpdate?.(pixelArea, pixelPerimeter, this.areaPoints.length);
    }
  }

  /**
   * مسح نقاط المساحة الحالية
   */
  public clearAreaPoints(): void {
    this.areaPoints = [];
    this.callbacks.onAreaUpdate?.(0, 0, 0);
    this.renderInteractionLayer();
  }

  /**
   * ربط أحداث الفأرة ولوحة المفاتيح
   */
  bindEvents(): void {
    return bindEventsImpl.call(this);
  }

  handleKeyDown = (e: KeyboardEvent): void => handleKeyDownImpl.call(this, e);

  handleKeyUp = (e: KeyboardEvent): void => handleKeyUpImpl.call(this, e);

  /**
   * إنهاء رسم خط المعايرة وتوليد نافذة الإدخال المباشرة على طريقة SketchUp
   */
  finishCalibration(p1: Point, p2: Point): void {
    return finishCalibrationImpl.call(this, p1, p2);
  }

  public cancelDrawing(): void {
    this.trackPoints = [];
    this.editMessage = null;
    if (this.editCmd) {
      this.editCmd = null;
      if (this.toolMode === 'edit') {
        this.toolMode = 'select';
        this.callbacks.onToolModeChange?.('select');
      }
    }
    this.isDrawingWall = false;
    this.wallStartPoint = null;
    this.callbacks.onWallDrawingStateChange?.({
      isDrawing: false,
      startPoint: null,
      currentLengthMeters: 0,
      currentAngleDegrees: 0,
    });
    this.isDrawingDimension = false;
    this.dimensionStartPoint = null;
    this.isMeasuring = false;
    this.measureStartPoint = null;
    this.isCalibrating = false;
    this.calibrateStartPoint = null;
    this.activeCalibrationLine = null;
    this.areaPoints = [];
    this.isDrawingRoute = false;
    this.routePoints = [];
    this.routeStartSymbolId = undefined;
    this.currentWallSnap = null;
    this.renderInteractionLayer();
  }

  processPointerMove(pointer: Point, shiftKey: boolean): void {
    return processPointerMoveImpl.call(this, pointer, shiftKey);
  }

  onViewTransformChanged(immediate: boolean = false): void {
    return onViewTransformChangedImpl.call(this, immediate);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  نظام الإيماءات السريعة (Fast Pan/Zoom) للمخططات الكبيرة
  //  الفكرة: أثناء التكبير/التحريك لا نعيد بناء آلاف عُقد Konva في كل إطار،
  //  بل نلتقط طبقة العناصر كصورة نقطية مرة واحدة ونطبّق عليها تحويل الكاميرا
  //  (scale + translate) وهو عملية رسم صورة واحدة فقط لكل إطار. وعند توقف
  //  الإيماءة (140ms) نعيد البناء المتجهي الدقيق مع الاقتطاع (Culling).
  // ═══════════════════════════════════════════════════════════════════════

  // ─── إيماءات اللمس المتعدد (الهواتف والأجهزة اللوحية) ───

  touchToLocal(t: Touch): Point {
    return touchToLocalImpl.call(this, t);
  }

  getPinchMetrics(touches: TouchList): { dist: number; center: Point } {
    return getPinchMetricsImpl.call(this, touches);
  }

  beginPinch(touches: TouchList): void {
    return beginPinchImpl.call(this, touches);
  }

  updatePinch(touches: TouchList): void {
    return updatePinchImpl.call(this, touches);
  }

  shouldUseFastGesture(): boolean {
    return shouldUseFastGestureImpl.call(this);
  }

  beginGesture(): void {
    return beginGestureImpl.call(this);
  }

  /** تطبيق تحويل الكاميرا الحالي على الطبقات المؤقتة (إطار واحد عبر requestAnimationFrame) */
  scheduleGestureFrame(): void {
    return scheduleGestureFrameImpl.call(this);
  }

  applyGestureTransforms(): void {
    return applyGestureTransformsImpl.call(this);
  }

  scheduleGestureEnd(): void {
    return scheduleGestureEndImpl.call(this);
  }

  /** إنهاء وضع اللقطة المؤقتة (لا يعيد الرسم بنفسه) */
  endGesture(): void {
    return endGestureImpl.call(this);
  }

  /** إنهاء الإيماءة فوراً مع إعادة البناء الدقيق (قبل أي نقر حتى تصيب النقرة العناصر الحقيقية) */
  flushGesture(): void {
    return flushGestureImpl.call(this);
  }

  /**
   * طلب إعادة رسم مجمّعة: عدة تغييرات متتالية في النموذج ضمن نفس الإطار
   * تُنتج إعادة رسم واحدة فقط بدلاً من N مرة (مثل الحذف الجماعي أو اللصق).
   */
  public requestRender(): void {
    if (this.renderRequested) return;
    this.renderRequested = true;
    requestAnimationFrame(() => {
      if (!this.renderRequested) return; // تم الرسم مباشرة في الأثناء
      this.render();
    });
  }

  updateCursor(): void {
    if (this.isPanning || this.isSpacePressed) {
      this.stage.container().style.cursor = 'grab';
    } else if (
      this.toolMode === 'wall' ||
      this.toolMode === 'dimension' ||
      this.toolMode === 'measure' ||
      this.toolMode === 'calibrate' ||
      this.toolMode === 'area' ||
      this.toolMode === 'route' ||
      this.toolMode === 'text' ||
      this.toolMode === 'edit'
    ) {
      this.stage.container().style.cursor = 'crosshair';
    } else if (this.toolMode === 'door' || this.toolMode === 'window') {
      this.stage.container().style.cursor = 'pointer';
    } else if (this.toolMode === 'pan') {
      this.stage.container().style.cursor = 'grab';
    } else {
      this.stage.container().style.cursor = 'default';
    }
  }

  /**
   * إعادة رسم المشهد كاملاً
   */
  public render(): void {
    this.renderRequested = false;
    this.renderBackgroundLayer();
    this.renderGridLayer();
    this.renderObjectsLayer();
    this.renderInteractionLayer();
  }

  /**
   * رسم صورة المخطط المرجعية في الخلفية
   */
  renderBackgroundLayer(): void {
    return renderBackgroundLayerImpl.call(this);
  }

  /**
   * رسم شبكة الـ CAD اللانهائية ومحاور الأصل (0,0)
   */
  renderGridLayer(): void {
    return renderGridLayerImpl.call(this);
  }

  /**
   * رسم العناصر الهندسية (الجدران، الأبواب، النوافذ، الأبعاد)
   */
  public renderObjectsLayer(): void {
    return renderObjectsLayerImpl.call(this);
  }

  /**
   * رسم عنصر الرمز الهندسي (Symbol - المرحلة 4)
   * يدعم السحب، التحديد، الدوران، والالتصاق الذكي بالجدار (Wall Snap)
   */
  renderSymbol(symbol: SymbolObject, isLocked: boolean, layerColor: string, layerOpacity: number): void {
    return renderSymbolImpl.call(this, symbol, isLocked, layerColor, layerOpacity);
  }

  /**
   * رسم عنصر المسار الهندسي (Route Object - المرحلة 5)
   * يدعم كابلات الكهرباء، مواسير السباكة، دكتات التكييف، وشبكات الحريق
   */
  renderRoute(route: RouteObject, isLocked: boolean, layerColor: string, layerOpacity: number): void {
    return renderRouteImpl.call(this, route, isLocked, layerColor, layerOpacity);
  }

  /**
   * رسم عنصر الملاحظة والتلميح الهندسي (Text / Annotation Note Object)
   * يعامل معاملة العنصر الكامل: تحديد، سحب، تحريك جماعي، تدوير، تحكم بالألوان وحجم الخط
   * تم حذف أي أعمدة أو خطوط إضافية في نهاية النص لضمان نظافة المخطط الهندسي
   */
  /** مخطط الغرف المغلقة في اللوحة الحالية */
  public getRoomGraph(): RoomGraph {
    return getRoomGraphImpl.call(this);
  }

  /** كشف الغرف: يضيف بطاقة لكل غرفة مغلقة بلا بطاقة (خطوة تراجع واحدة). يعيد عدد المضاف */
  public detectRooms(): number {
    const n = detectRoomsImpl.call(this);
    this.render();
    return n;
  }

  public roomFaceOf(room: RoomObject): RoomFace | null {
    return roomFaceOfImpl.call(this, room);
  }

  renderRoomFills(rooms: RoomObject[]): void {
    return renderRoomFillsImpl.call(this, rooms);
  }

  renderRoomLabel(room: RoomObject, isLocked: boolean, layerOpacity: number): void {
    return renderRoomLabelImpl.call(this, room, isLocked, layerOpacity);
  }

  renderTextObject(textObj: TextObject, isLocked: boolean, fallbackColor: string, layerOpacity: number): void {
    return renderTextObjectImpl.call(this, textObj, isLocked, fallbackColor, layerOpacity);
  }

  /**
   * رسم عنصر البُعد الهندسي (Dimension) وفق معايير المخططات الهندسية المعمارية
   */
  renderDimension(dim: DimensionObject, isLocked: boolean): void {
    return renderDimensionImpl.call(this, dim, isLocked);
  }

  /**
   * رسم عنصر الباب على الجدار
   */
  renderDoor(door: DoorObject, wall: WallObject, isLocked: boolean): void {
    return renderDoorImpl.call(this, door, wall, isLocked);
  }

  /**
   * رسم عنصر النافذة على الجدار
   */
  renderWindow(win: WindowObject, wall: WallObject, isLocked: boolean): void {
    return renderWindowImpl.call(this, win, wall, isLocked);
  }

  /**
   * رسم مقابض السحب لنقاط بداية ونهاية الجدار المحدد (Edit Wall Endpoints)
   * مع مؤشر (+) واضح لإطالة الجدار والحفاظ على الزاوية الحالية عند الضغط على SHIFT
   */
  renderWallHandles(wall: WallObject): void {
    return renderWallHandlesImpl.call(this, wall);
  }

  /**
   * رسم طبقة التفاعل المؤقتة (المعاينة الحية لجميع الأدوات النشطة)
   */
  renderInteractionLayer(shiftKey: boolean = false): void {
    return renderInteractionLayerImpl.call(this, shiftKey);
  }

  /**
   * رسم خط الزاوية الإرشادي وقوس الزاوية وبادج الدرجة الهندسية
   * (Angle Guideline, Polar Tracking Ray & Angular Badge)
   */
  renderAngleGuideline(originWorld: Point, targetWorld: Point, angleDegrees: number, isSnapped: boolean, labelExtra?: string): void {
    return renderAngleGuidelineImpl.call(this, originWorld, targetWorld, angleDegrees, isSnapped, labelExtra);
  }

  renderFloatingBadge(x: number, y: number, text: string, bgColor: string, borderColor: string): void {
    return renderFloatingBadgeImpl.call(this, x, y, text, bgColor, borderColor);
  }

  renderSnapIndicatorOnly(): void {
    return renderSnapIndicatorOnlyImpl.call(this);
  }

  renderSnapIndicatorShapes(): void {
    return renderSnapIndicatorShapesImpl.call(this);
  }

  public destroy(): void {
    if (SnapEngine.narrowProvider) SnapEngine.narrowProvider = null;
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    // إصلاح تسرب: مستمعات النافذة والحاوية لم تكن تُزال، فيبقى المحرك القديم حياً ويستجيب للأحداث
    // (يحدث فعلياً مع React StrictMode الذي يُنشئ المحرك مرتين في وضع التطوير)
    if (this.windowMouseUpHandler) {
      window.removeEventListener('mouseup', this.windowMouseUpHandler);
      window.removeEventListener('touchend', this.windowMouseUpHandler);
      window.removeEventListener('touchcancel', this.windowMouseUpHandler);
      this.windowMouseUpHandler = null;
    }
    if (this.containerContextMenuHandler) {
      this.container.removeEventListener('contextmenu', this.containerContextMenuHandler);
      this.containerContextMenuHandler = null;
    }
    if (this.containerPointerDownCapture) {
      this.container.removeEventListener('pointerdown', this.containerPointerDownCapture, true);
      this.containerPointerDownCapture = null;
    }
    if (this.gestureEndTimer) clearTimeout(this.gestureEndTimer);
    this.renderRequested = false;
    this.gestureSnapshotCanvas = null;
    this.stage.destroy();
  }
}
