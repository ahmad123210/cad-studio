/**
 * @file renderer.ts
 * @description محرك الرسم والتفاعل الهندسي المعتمد على Konva.js (Engine Layer).
 * يربط بين نموذج البيانات (Model)، نظام الإحداثيات (Camera)، ونظام الالتقاط (Snap).
 * يدعم:
 * - المرحلة 1: رسم وتعديل الجدران والشبكة اللانهائية والتراجع والإعادة.
 * - المرحلة 2: الأبواب والنوافذ والربط بالجدران وصورة الخلفية المرجعية.
 * - المرحلة 3: المقياس الحقيقي، أدوات القياس (Dimension)، قياس المساحة (Shoelace Formula)، والمحيط، والمعايرة.
 */

import Konva from 'konva';
import {
  Point,
  ProjectObject,
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
  | 'text';

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
}

interface BoxRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function pointInBox(p: Point, box: BoxRect): boolean {
  return p.x >= box.minX && p.x <= box.maxX && p.y >= box.minY && p.y <= box.maxY;
}

function segmentIntersectsBox(p1: Point, p2: Point, box: BoxRect): boolean {
  if (pointInBox(p1, box) || pointInBox(p2, box)) return true;
  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const maxY = Math.max(p1.y, p2.y);
  if (maxX < box.minX || minX > box.maxX || maxY < box.minY || minY > box.maxY) return false;
  return true;
}

function isObjectInBox(obj: ProjectObject, box: BoxRect, allObjects?: ProjectObject[]): boolean {
  if (obj.type === 'wall') {
    const wall = obj as WallObject;
    return segmentIntersectsBox(wall.start, wall.end, box);
  }
  if (obj.type === 'symbol') {
    const sym = obj as SymbolObject;
    return (
      pointInBox({ x: sym.x, y: sym.y }, box) ||
      (sym.x >= box.minX - 15 && sym.x <= box.maxX + 15 && sym.y >= box.minY - 15 && sym.y <= box.maxY + 15)
    );
  }
  if (obj.type === 'route') {
    const rt = obj as RouteObject;
    if (!rt.points || rt.points.length === 0) return false;
    for (let i = 0; i < rt.points.length - 1; i++) {
      if (segmentIntersectsBox(rt.points[i], rt.points[i + 1], box)) return true;
    }
    return pointInBox(rt.points[0], box);
  }
  if (obj.type === 'dimension') {
    const dim = obj as DimensionObject;
    return segmentIntersectsBox(dim.start, dim.end, box);
  }
  if (obj.type === 'door' || obj.type === 'window') {
    const item = obj as DoorObject | WindowObject;
    if (allObjects) {
      const parentWall = allObjects.find((o) => o.id === item.wallId) as WallObject | undefined;
      if (parentWall) {
        const cx = parentWall.start.x + item.position * (parentWall.end.x - parentWall.start.x);
        const cy = parentWall.start.y + item.position * (parentWall.end.y - parentWall.start.y);
        return (
          pointInBox({ x: cx, y: cy }, box) ||
          (cx >= box.minX - 12 && cx <= box.maxX + 12 && cy >= box.minY - 12 && cy <= box.maxY + 12)
        );
      }
    }
    return false;
  }
  if (obj.type === 'text') {
    const txt = obj as TextObject;
    const pad = txt.padding || 6;
    const estW = Math.max(50, (txt.text?.length || 8) * (txt.fontSize || 14) * 0.65 + pad * 2);
    const estH = Math.max(28, (txt.fontSize || 14) * 1.5 + pad * 2);
    return (
      pointInBox({ x: txt.x, y: txt.y }, box) ||
      pointInBox({ x: txt.x + estW, y: txt.y + estH }, box) ||
      (txt.x <= box.maxX && txt.x + estW >= box.minX && txt.y <= box.maxY && txt.y + estH >= box.minY)
    );
  }
  return false;
}

export class CadEngine {
  private container: HTMLDivElement;
  private stage: Konva.Stage;
  private backgroundLayer: Konva.Layer;
  private gridLayer: Konva.Layer;
  private objectsLayer: Konva.Layer;
  private interactionLayer: Konva.Layer;

  private model: ProjectModel;
  private camera: Camera;
  private toolMode: ToolMode = 'select';
  private selectedObjectId: string | null = null;
  private selectedObjectIds: string[] = [];
  private selectionSubMode: 'single' | 'box' | 'multi' = 'single';
  private isMarqueeSelecting: boolean = false;
  private marqueeStartPoint: Point | null = null;
  private hoveredObjectId: string | null = null;
  private groupDragStartPositions: Map<string, { x: number; y: number }> = new Map();
  private isShiftKeyPressed: boolean = false;
  private wasGroupDragged: boolean = false;
  private isTransformPending: boolean = false;
  private isPointerMovePending: boolean = false;
  private pendingPointerPos: Point | null = null;
  private pendingShiftKey: boolean = false;

  // إعدادات المظهر والسمة
  private theme: 'dark' | 'light' = 'dark';

  // إعدادات الالتقاط والشبكة
  private gridDensity: GridDensity = 'medium';
  private snapOptions: SnapOptions = {
    enableGridSnap: true,
    enableObjectSnap: true,
    gridSize: 20,
    snapRadius: 8,
  };
  private activeCalibrationLine: { p1: Point; p2: Point; dist: number } | null = null;

  // إعدادات الأبواب والنوافذ الافتراضية
  private defaultDoorWidth: number = 45; // 0.90م
  private defaultWindowWidth: number = 60; // 1.20م
  private defaultDoorDirection: DoorOpenDirection = 'inward_right';

  // حالة الرسم النشط (رسم الجدار)
  private isDrawingWall: boolean = false;
  private wallStartPoint: Point | null = null;

  // حالة رسم البعد الهندسي (Dimension)
  private isDrawingDimension: boolean = false;
  private dimensionStartPoint: Point | null = null;

  // حالة شريط القياس المؤقت (Measure Tape)
  private isMeasuring: boolean = false;
  private measureStartPoint: Point | null = null;

  // حالة قياس المساحة والمحيط (Area & Perimeter)
  private areaPoints: Point[] = [];

  // حالة أداة المعايرة (Calibration)
  private isCalibrating: boolean = false;
  private calibrateStartPoint: Point | null = null;

  // حالة رسم المسار (Route - المرحلة 5)
  private isDrawingRoute: boolean = false;
  private routePoints: Point[] = [];
  private activeRouteKind: RouteKind = 'electrical';
  private activeRouteLineStyle: 'solid' | 'dashed' | 'dotted' = 'solid';
  private routeStartSymbolId?: string;

  private currentSnapResult: SnapResult = { point: { x: 0, y: 0 }, snapped: false, type: 'none' };
  private currentWallSnap: WallSnapResult | null = null;
  private currentSymbolWallSnap: SymbolWallSnapResult | null = null;
  private activeSymbolKind: string = 'socket_single';

  // كاش صورة الخلفية لتفادي إعادة التحميل المتكررة
  private bgImageElement: HTMLImageElement | null = null;
  private lastBgDataUrl: string | null = null;
  private pendingBgDataUrl: string | null = null;

  // إظهار أو إخفاء أطوال الجدران
  private showWallLengths: boolean = true;

  // حالة التحريك (Pan)
  private isPanning: boolean = false;
  private panStartPos: Point = { x: 0, y: 0 };
  private isSpacePressed: boolean = false;

  // callbacks للواجهة
  private callbacks: EngineCallbacks;

  // ─── تحسينات الأداء للمخططات الكبيرة (Large Drawings Performance) ───
  /** طبقة بديلة تعرض لقطة نقطية (Bitmap Snapshot) من طبقة العناصر أثناء التكبير/التحريك */
  private gestureProxyLayer: Konva.Layer;
  private gestureProxyImage: Konva.Image | null = null;
  private gestureSnapshotCanvas: HTMLCanvasElement | null = null;
  /** حالة الكاميرا التي رُسمت بها طبقة العناصر آخر مرة (أساس حساب التحويل المؤقت) */
  private objectsRenderedCamera: CameraState | null = null;
  private bgRenderedCamera: CameraState | null = null;
  private isGestureActive: boolean = false;
  private gestureBaseCamera: CameraState | null = null;
  private gestureFramePending: boolean = false;
  private gestureEndTimer: ReturnType<typeof setTimeout> | null = null;
  /** مدة آخر إعادة بناء لطبقة العناصر (ms) لاختيار الوضع السريع تلقائياً */
  private lastObjectsRenderMs: number = 0;
  /** عدد مجموعات العناصر المرسومة فعلياً في آخر إعادة بناء (تقدير كلفة الرسم على الكانفس) */
  private lastRenderedGroupCount: number = 0;
  private static readonly FAST_GESTURE_GROUP_THRESHOLD = 400;
  /** عتبة التحول للوضع السريع: إذا تجاوزت إعادة البناء هذه المدة نستخدم اللقطة النقطية */
  private static readonly FAST_GESTURE_THRESHOLD_MS = 12;
  private static readonly GESTURE_SETTLE_MS = 140;
  /** تعطيل الاقتطاع (Culling) أثناء التصدير لضمان رسم كامل المخطط */
  private disableCulling: boolean = false;
  /** طلب إعادة رسم مجمّع في الإطار القادم (Coalesced Render) */
  private renderRequested: boolean = false;
  /** ذاكرة مؤقتة لمجموعة العناصر المحددة لتسريع isObjectSelected */
  private selectionCacheSource: string[] | null = null;
  private selectionCacheSet: Set<string> = new Set();
  /** إيماءة اللمس بإصبعين (Pinch Zoom / Two-finger Pan) */
  private pinchState: { dist: number; center: Point } | null = null;
  /** حالة ما قبل لمسة الإصبع الأول لإلغاء أثرها إن تبيّن أنها بداية إيماءة قرص */
  private touchStartSnapshot: {
    time: number;
    wasDrawingWall: boolean;
    routeLen: number;
    areaLen: number;
    undoCount: number;
    selectedIds: string[];
  } | null = null;
  /** مستمعات النافذة لإزالتها عند التدمير (منع تسرب الذاكرة) */
  private windowMouseUpHandler: (() => void) | null = null;
  private containerPointerDownCapture: ((e: Event) => void) | null = null;
  private containerContextMenuHandler: ((e: MouseEvent) => void) | null = null;

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
            } else if (obj.type === 'text') {
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
    if (!this.isDrawingWall || !this.wallStartPoint || lengthMeters <= 0) return false;
    const pixelsPerMeter = this.model.getMeta().scale || 50;
    const lengthPx = lengthMeters * pixelsPerMeter;
    let endWorld = this.currentSnapResult.point;
    const polar = SnapEngine.getPolarAngleSnap(
      this.wallStartPoint,
      endWorld,
      [0, 45, 90, 135, 180, 225, 270, 315, 360],
      this.isShiftKeyPressed ? 25 : 5.0
    );
    const dx = endWorld.x - this.wallStartPoint.x;
    const dy = endWorld.y - this.wallStartPoint.y;
    let angle = polar.isSnapped || this.isShiftKeyPressed
      ? (polar.angleDegrees * Math.PI) / 180
      : Math.atan2(dy, dx);
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
      angle = 0; // اتجاه أفقي افتراضي لليمين إذا لم تتحرك الفأرة
    }

    const endPoint: Point = {
      x: this.wallStartPoint.x + lengthPx * Math.cos(angle),
      y: this.wallStartPoint.y + lengthPx * Math.sin(angle),
    };

    const currentSettings = getLastUsedSettings();
    const newWall: WallObject = {
      id: 'wall_' + Math.random().toString(36).substring(2, 9),
      type: 'wall',
      layerId: this.model.getLayers().some((l) => l.id === 'arch') ? 'arch' : this.model.getActiveLayerId(),
      start: { ...this.wallStartPoint },
      end: { ...endPoint },
      thickness: currentSettings.wallThickness,
    };

    this.model.addObject(newWall);
    this.selectObject(newWall.id);
    this.wallStartPoint = { ...endPoint };
    this.callbacks.onWallDrawingStateChange?.(this.getWallDrawingState());
    this.render();
    return true;
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
  private getEffectiveSnapOptions(): SnapOptions {
    const zoom = this.camera.getState().zoom || 1;
    const base = this.snapOptions.snapRadius;
    const factor = Math.max(0.25, Math.min(4, 1 / zoom));
    return { ...this.snapOptions, snapRadius: base * factor };
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
    const idToMatch = targetId || this.selectedObjectId;
    if (!idToMatch) return;
    const target = this.model.getObjectById(idToMatch);
    if (!target) return;

    const allObjects = this.model.getObjects();
    let matches: ProjectObject[] = [];

    if (target.type === 'symbol') {
      const sym = target as SymbolObject;
      matches = allObjects.filter(
        (o) => o.type === 'symbol' && (o as SymbolObject).symbolKind === sym.symbolKind
      );
    } else if (target.type === 'wall') {
      matches = allObjects.filter((o) => o.type === 'wall');
    } else if (target.type === 'door') {
      matches = allObjects.filter((o) => o.type === 'door');
    } else if (target.type === 'window') {
      matches = allObjects.filter((o) => o.type === 'window');
    } else if (target.type === 'route') {
      const rt = target as RouteObject;
      matches = allObjects.filter(
        (o) => o.type === 'route' && (o as RouteObject).routeKind === rt.routeKind
      );
    } else if (target.type === 'dimension') {
      matches = allObjects.filter((o) => o.type === 'dimension');
    } else if (target.type === 'text') {
      matches = allObjects.filter((o) => o.type === 'text');
    }

    this.selectObjects(matches.map((o) => o.id));
  }

  public deselectAll(): void {
    this.selectObjects([]);
  }

  /**
   * بدء تحريك جماعي أو فردي للعناصر المحددة معاً في الكانفس
   */
  private onGroupDragStart(draggedId: string): void {
    this.wasGroupDragged = false;
    this.groupDragStartPositions.clear();
    const targets = this.selectedObjectIds.includes(draggedId) && this.selectedObjectIds.length > 0
      ? this.selectedObjectIds
      : [draggedId];

    for (const id of targets) {
      const node = this.objectsLayer.findOne('#' + id);
      if (node) {
        this.groupDragStartPositions.set(id, { x: node.x(), y: node.y() });
      }
      // بالإضافة لذلك: إذا كان العنصر جداراً، احفظ مواضع أي أبواب أو نوافذ تابعة له لتتحرك معه بسلاسة
      const obj = this.model.getObjectById(id);
      if (obj?.type === 'wall') {
        const children = this.model.getObjects().filter(
          (o) => (o.type === 'door' || o.type === 'window') && (o as any).wallId === id
        );
        for (const child of children) {
          if (!this.groupDragStartPositions.has(child.id)) {
            const childNode = this.objectsLayer.findOne('#' + child.id);
            if (childNode) {
              this.groupDragStartPositions.set(child.id, { x: childNode.x(), y: childNode.y() });
            }
          }
        }
      }
    }
  }

  /**
   * تحريك العناصر المحددة الأخرى لحظياً في الكانفس أثناء سحب أحدها (60/120 FPS بدون هدم الكانفس)
   */
  private onGroupDragMove(draggedId: string, currentDraggedPos: { x: number; y: number }): void {
    const startPos = this.groupDragStartPositions.get(draggedId);
    if (startPos) {
      const dx = currentDraggedPos.x - startPos.x;
      const dy = currentDraggedPos.y - startPos.y;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        this.wasGroupDragged = true;
      }
      for (const [id, initialPos] of this.groupDragStartPositions.entries()) {
        if (id === draggedId) continue;
        const otherNode = this.objectsLayer.findOne('#' + id);
        if (otherNode) {
          otherNode.position({ x: initialPos.x + dx, y: initialPos.y + dy });
        }
      }
    }
  }

  /**
   * إنهاء التحريك الجماعي وتطبيق الإزاحة المتجهة (Delta) على نموذج البيانات في خطوة واحدة
   */
  private onGroupDragEnd(draggedId: string, finalDraggedPos: { x: number; y: number }): boolean {
    const startPos = this.groupDragStartPositions.get(draggedId);
    const zoom = this.camera.getState().zoom;
    if (startPos) {
      const dxScreen = finalDraggedPos.x - startPos.x;
      const dyScreen = finalDraggedPos.y - startPos.y;
      const dxWorld = dxScreen / zoom;
      const dyWorld = dyScreen / zoom;

      // إعادة ضبط إحداثيات Konva المحلية قبل تحديث النموذج
      for (const [id, pos] of this.groupDragStartPositions.entries()) {
        const node = this.objectsLayer.findOne('#' + id);
        if (node) node.position(pos);
      }
      this.groupDragStartPositions.clear();

      if (Math.abs(dxWorld) > 0.01 || Math.abs(dyWorld) > 0.01) {
        this.wasGroupDragged = true;
        const targets = this.selectedObjectIds.includes(draggedId) && this.selectedObjectIds.length > 0
          ? this.selectedObjectIds
          : [draggedId];
        this.model.moveObjects(targets, { x: dxWorld, y: dyWorld });
      }

      setTimeout(() => {
        this.wasGroupDragged = false;
      }, 120);

      this.render();
      return true;
    }
    return false;
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

  private notifyRouteUpdate(): void {
    const pixelLen = calculateRoutePixelLength(this.routePoints);
    this.callbacks.onRouteUpdate?.(this.routePoints.length, pixelLen, this.activeRouteKind);
  }

  /**
   * إنهاء وحفظ المسار الهندسي الحالي (المرحلة 5)
   */
  public finishRoute(): void {
    if (this.routePoints.length < 2) {
      this.cancelRoute();
      return;
    }

    const pixelsPerMeter = this.model.getMeta().scale || 50;
    const pixelLen = calculateRoutePixelLength(this.routePoints);
    const lengthMeters = Number((pixelLen / pixelsPerMeter).toFixed(2));
    const meta = ROUTE_KINDS_META[this.activeRouteKind];

    // فحص ما إذا كانت النقطة الأخيرة ملتصقة برمز هندسي
    const lastPt = this.routePoints[this.routePoints.length - 1];
    const endSymbolSnap = SnapEngine.findSymbolSnap(lastPt, this.model.getObjects(), 30);
    const endSymbolId = endSymbolSnap?.symbol.id;

    const newRoute: RouteObject = {
      id: 'route_' + Math.random().toString(36).substring(2, 9),
      type: 'route',
      routeKind: this.activeRouteKind,
      layerId: meta?.defaultLayerId || this.model.getActiveLayerId(),
      points: [...this.routePoints],
      lineStyle: this.activeRouteLineStyle,
      diameter: meta?.defaultDiameter || 20,
      material: meta?.defaultMaterial || 'معياري',
      lengthCalculated: lengthMeters,
      startSymbolId: this.routeStartSymbolId,
      endSymbolId: endSymbolId,
      strokeWidth: meta?.defaultStrokeWidth || 2.5,
      color: meta?.defaultColor,
    };

    // ربط الرموز المتصلة بالمسار
    if (this.routeStartSymbolId) {
      const startSym = this.model.getObjectById(this.routeStartSymbolId) as SymbolObject | undefined;
      if (startSym && startSym.type === 'symbol') {
        const conns = startSym.connections || [];
        if (!conns.includes(newRoute.id)) {
          this.model.updateObject(this.routeStartSymbolId, { connections: [...conns, newRoute.id] }, false);
        }
      }
    }
    if (endSymbolId) {
      const endSym = this.model.getObjectById(endSymbolId) as SymbolObject | undefined;
      if (endSym && endSym.type === 'symbol') {
        const conns = endSym.connections || [];
        if (!conns.includes(newRoute.id)) {
          this.model.updateObject(endSymbolId, { connections: [...conns, newRoute.id] }, false);
        }
      }
    }

    this.model.addObject(newRoute);
    this.selectObject(newRoute.id);
    this.isDrawingRoute = false;
    this.routePoints = [];
    this.routeStartSymbolId = undefined;
    this.notifyRouteUpdate();
    this.render();
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
    const objects = this.model.getObjects();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    const includePt = (pt: Point) => {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    };

    objects.forEach((obj) => {
      if (obj.type === 'wall') {
        const w = obj as WallObject;
        includePt(w.start);
        includePt(w.end);
        const t = (w.thickness || 20) / 2;
        minX -= t;
        maxX += t;
        minY -= t;
        maxY += t;
      } else if (obj.type === 'symbol') {
        const s = obj as SymbolObject;
        includePt({ x: s.x - 25, y: s.y - 25 });
        includePt({ x: s.x + 25, y: s.y + 25 });
      } else if (obj.type === 'route') {
        const r = obj as RouteObject;
        r.points.forEach(includePt);
      } else if (obj.type === 'dimension') {
        const d = obj as DimensionObject;
        includePt(d.start);
        includePt(d.end);
      }
    });

    if (includeBackground) {
      const bg = this.model.getBackgroundImage();
      if (bg && bg.dataUrl && bg.visible) {
        const bgW = bg.width;
        const bgH = bg.height;
        includePt({ x: bg.x, y: bg.y });
        includePt({ x: bg.x + bgW, y: bg.y + bgH });
      }
    }

    if (!isFinite(minX) || !isFinite(maxX)) {
      return {
        minX: -200,
        minY: -150,
        maxX: 200,
        maxY: 150,
        width: 400,
        height: 300,
      };
    }

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: Math.max(50, maxX - minX),
      height: Math.max(50, maxY - minY),
    };
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
  }): string {
    const opts = {
      pixelRatio: 2.5,
      includeGrid: false,
      includeBackground: true,
      includeDimensions: true,
      boundsMode: 'drawing' as const,
      padding: 50,
      ...options,
    };

    // حفظ الحالة الحالية
    const savedCam = this.camera.getState();
    const savedSelectedId = this.selectedObjectId;
    const savedSelectedIds = this.selectedObjectIds;
    const savedTheme = this.theme;
    const savedStageW = this.stage.width();
    const savedStageH = this.stage.height();
    const savedGridVisible = this.gridLayer.visible();
    const savedBgVisible = this.backgroundLayer.visible();
    const savedInteractionVisible = this.interactionLayer.visible();

    // حفظ حالات طبقات المشروع
    const originalLayers = this.model.getLayers().map((l) => ({ id: l.id, visible: l.visible }));

    try {
      // التصدير يجب أن يرسم كامل المخطط: نوقف الاقتطاع ووضع اللقطة المؤقتة
      this.endGesture();
      this.disableCulling = true;
      if (opts.theme) this.theme = opts.theme;
      // إزالة التحديد وإخفاء مؤشرات التفاعل اللحظية
      // (إصلاح: كان التحديد المتعدد يظهر بلون التحديد داخل الصورة/PDF المُصدَّر)
      this.selectedObjectId = null;
      this.selectedObjectIds = [];
      this.interactionLayer.visible(false);
      this.gridLayer.visible(opts.includeGrid);
      this.backgroundLayer.visible(opts.includeBackground);

      // تصفية الطبقات حسب طلب التصدير
      if (opts.visibleLayerIds && opts.visibleLayerIds.length > 0) {
        this.model.getLayers().forEach((layer) => {
          layer.visible = opts.visibleLayerIds!.includes(layer.id);
        });
      }

      // تعديل الحجم إن طلب قياسات مخصصة
      if (opts.customWidth && opts.customHeight) {
        this.stage.width(opts.customWidth);
        this.stage.height(opts.customHeight);
      }

      // ضبط زاوية الرؤية حسب نمط التصدير
      if (opts.boundsMode === 'drawing') {
        const bounds = this.getDrawingBounds(opts.includeBackground);
        this.camera.fitBounds(bounds, this.stage.width(), this.stage.height(), opts.padding);
      }

      // إعادة رسم الطبقات بالوضع الجديد
      this.renderBackgroundLayer();
      if (opts.includeGrid) this.renderGridLayer();
      this.renderObjectsLayer();

      // التقاط اللوحة بدقة فائقة
      const dataUrl = this.stage.toDataURL({
        pixelRatio: opts.pixelRatio,
        mimeType: 'image/png',
      });

      return dataUrl;
    } finally {
      this.disableCulling = false;
      this.theme = savedTheme;
      // استعادة الحالة بالكامل
      originalLayers.forEach((orig) => {
        const l = this.model.getLayers().find((layer) => layer.id === orig.id);
        if (l) l.visible = orig.visible;
      });

      this.camera.setState(savedCam);
      this.selectedObjectId = savedSelectedId;
      this.selectedObjectIds = savedSelectedIds;
      this.stage.width(savedStageW);
      this.stage.height(savedStageH);
      this.gridLayer.visible(savedGridVisible);
      this.backgroundLayer.visible(savedBgVisible);
      this.interactionLayer.visible(savedInteractionVisible);
      this.render();
    }
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
  private bindEvents(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    this.stage.on('wheel', (e) => {
      e.evt.preventDefault();
      const pointer = this.stage.getPointerPosition();
      if (!pointer) return;

      // تكبير متناسب مع مقدار العجلة: عجلة الفأرة التقليدية (±100) تعطي نفس الخطوة السابقة 1.08،
      // بينما لوحات اللمس (Trackpad) ترسل قيماً صغيرة متتابعة فيصبح التكبير ناعماً بدل القفزات.
      let dy = e.evt.deltaY;
      if (e.evt.deltaMode === 1) dy *= 33; // وضع الأسطر (Firefox)
      else if (e.evt.deltaMode === 2) dy *= 800; // وضع الصفحات
      dy = Math.max(-300, Math.min(300, dy));
      const sensitivity = e.evt.ctrlKey ? 0.003 : 0.00077; // ctrlKey = إيماءة القرص على لوحة اللمس
      const factor = Math.exp(-dy * sensitivity);
      if (!isFinite(factor) || factor === 1) return;
      this.camera.zoomAtScreenPoint(factor, pointer);
      this.onViewTransformChanged();
    });

    // دعم اللمس: منع إيماءات المتصفح الافتراضية (تمرير/تكبير الصفحة) فوق لوحة الرسم
    this.container.style.touchAction = 'none';

    // قبل أي نقرة بالفأرة أثناء وضع اللقطة المؤقتة: نعيد البناء الدقيق فوراً حتى تصيب النقرة العناصر الحقيقية
    this.containerPointerDownCapture = (ev: Event) => {
      const pe = ev as PointerEvent;
      if (pe.pointerType === 'touch') return; // اللمس: لا نقطع سلسلة إيماءات القرص المتتالية
      this.flushGesture();
    };
    this.container.addEventListener('pointerdown', this.containerPointerDownCapture, true);

    this.stage.on('mousedown touchstart', (e) => {
      // بداية إيماءة القرص/التحريك بإصبعين (Pinch Zoom & Two-Finger Pan)
      const touches = (e.evt as TouchEvent).touches;
      if (touches && touches.length >= 2) {
        this.beginPinch(touches);
        return;
      }
      if (this.pinchState) return;
      if (touches && touches.length === 1) {
        this.touchStartSnapshot = {
          time: Date.now(),
          wasDrawingWall: this.isDrawingWall,
          routeLen: this.routePoints.length,
          areaLen: this.areaPoints.length,
          undoCount: this.model.getHistory().getPushCount(),
          selectedIds: this.selectedObjectIds,
        };
      }

      // التحريك بالزر الأوسط أو بمفتاح المسافة
      if (e.evt.button === 1 || this.isSpacePressed || this.toolMode === 'pan') {
        const pointer = this.stage.getPointerPosition();
        if (pointer) {
          this.isPanning = true;
          this.panStartPos = { x: pointer.x, y: pointer.y };
          this.updateCursor();
        }
        return;
      }

      if (e.evt.button !== 0 && !e.evt.touches) return;

      const pointer = this.stage.getPointerPosition();
      if (!pointer) return;
      this.isPointerMovePending = false;

      const worldRaw = this.camera.screenToWorld(pointer);
      const snap = SnapEngine.findSnapPoint(
        worldRaw,
        this.model.getObjects(),
        this.getEffectiveSnapOptions(),
        this.toolMode === 'select' ? (this.selectedObjectId || undefined) : undefined
      );
      const activeWorldPoint = snap.point;

      // 1. رسم جدار
      if (this.toolMode === 'wall') {
        if (!this.isDrawingWall) {
          this.isDrawingWall = true;
          this.wallStartPoint = activeWorldPoint;
          this.callbacks.onWallDrawingStateChange?.(this.getWallDrawingState());
          this.renderInteractionLayer();
        } else if (this.wallStartPoint) {
          const polar = SnapEngine.getPolarAngleSnap(
            this.wallStartPoint,
            activeWorldPoint,
            [0, 45, 90, 135, 180, 225, 270, 315, 360],
            e.evt.shiftKey || this.isShiftKeyPressed ? 25 : 5.0
          );
          const isObjectSnap = snap.snapped && snap.type !== 'grid';
          const endPoint = (!isObjectSnap && polar.isSnapped) || e.evt.shiftKey || this.isShiftKeyPressed
            ? polar.point
            : activeWorldPoint;

          const dist = SnapEngine.distance(this.wallStartPoint, endPoint);
          if (dist > 5) {
            const currentSettings = getLastUsedSettings();
            const newWall: WallObject = {
              id: 'wall_' + Math.random().toString(36).substring(2, 9),
              type: 'wall',
              layerId: this.model.getLayers().some((l) => l.id === 'arch') ? 'arch' : this.model.getActiveLayerId(),
              start: { ...this.wallStartPoint },
              end: { ...endPoint },
              thickness: currentSettings.wallThickness,
            };
            this.model.addObject(newWall);
            this.wallStartPoint = { ...endPoint };
            this.callbacks.onWallDrawingStateChange?.(this.getWallDrawingState());
          }
          this.render();
        }
        return;
      }

      // 2. إدراج باب
      if (this.toolMode === 'door') {
        const currentSettings = getLastUsedSettings();
        const doorWidth = currentSettings.doorWidth || this.defaultDoorWidth;
        const wallSnap = SnapEngine.findWallProjection(
          worldRaw,
          this.model.getObjects(),
          45,
          doorWidth
        );
        if (wallSnap) {
          const newDoor: DoorObject = {
            id: 'door_' + Math.random().toString(36).substring(2, 9),
            type: 'door',
            layerId: wallSnap.wall.layerId,
            wallId: wallSnap.wall.id,
            position: wallSnap.position,
            width: doorWidth,
            openDirection: currentSettings.doorDirection || this.defaultDoorDirection,
          };
          this.model.addObject(newDoor);
          this.selectObject(newDoor.id);
          this.render();
        }
        return;
      }

      // 3. إدراج نافذة
      if (this.toolMode === 'window') {
        const currentSettings = getLastUsedSettings();
        const winWidth = currentSettings.windowWidth || this.defaultWindowWidth;
        const wallSnap = SnapEngine.findWallProjection(
          worldRaw,
          this.model.getObjects(),
          45,
          winWidth
        );
        if (wallSnap) {
          const newWindow: WindowObject = {
            id: 'win_' + Math.random().toString(36).substring(2, 9),
            type: 'window',
            layerId: wallSnap.wall.layerId,
            wallId: wallSnap.wall.id,
            position: wallSnap.position,
            width: winWidth,
            height: currentSettings.windowHeight ?? 1.2,
            sillHeight: currentSettings.windowSillHeight ?? 0.9,
          };
          this.model.addObject(newWindow);
          this.selectObject(newWindow.id);
          this.render();
        }
        return;
      }

      // 3.5 إدراج رمز هندسي (Symbol Tool - المرحلة 4)
      if (this.toolMode === 'symbol') {
        const symbolDef = getSymbolById(this.activeSymbolKind);
        const wallSnap = SnapEngine.findSymbolWallSnap(
          worldRaw,
          this.model.getObjects(),
          35,
          true
        );

        let finalPoint = activeWorldPoint;
        let rotation = 0;
        let wallId: string | undefined = undefined;
        let wallPosition: number | undefined = undefined;
        let wallSide: 1 | -1 | undefined = undefined;

        if (wallSnap) {
          finalPoint = wallSnap.snappedPoint;
          rotation = Math.round(wallSnap.angle);
          wallId = wallSnap.wall.id;
          wallPosition = wallSnap.position;
          wallSide = wallSnap.wallSide;
        }

        const lastSymConfig = getLastUsedSymbolConfig(this.activeSymbolKind);
        const newSymbol: SymbolObject = {
          id: 'sym_' + Math.random().toString(36).substring(2, 9),
          type: 'symbol',
          symbolKind: this.activeSymbolKind,
          layerId: symbolDef?.defaultLayerId || this.model.getActiveLayerId(),
          x: finalPoint.x,
          y: finalPoint.y,
          rotation: wallSnap ? rotation : (lastSymConfig.rotation || 0),
          wallId,
          wallPosition,
          wallSide,
          scale: lastSymConfig.scale || 1,
          color: lastSymConfig.color,
        };

        this.model.addObject(newSymbol);
        this.selectObject(newSymbol.id);
        this.render();
        return;
      }

      // 3.6 أداة رسم المسارات والكابلات (Route Tool - المرحلة 5)
      if (this.toolMode === 'route') {
        const symbolSnap = SnapEngine.findSymbolSnap(worldRaw, this.model.getObjects(), 25);
        let clickPoint = activeWorldPoint;
        if (symbolSnap) {
          clickPoint = symbolSnap.point;
        }

        // إذا كان مفتاح Shift مضغوطاً، قفل متعامد (Ortho)
        if (e.evt.shiftKey && this.routePoints.length > 0) {
          const lastPt = this.routePoints[this.routePoints.length - 1];
          clickPoint = SnapEngine.getOrthoPoint(lastPt, clickPoint);
        }

        if (this.routePoints.length === 0) {
          this.isDrawingRoute = true;
          this.routeStartSymbolId = symbolSnap?.symbol.id;
          this.routePoints = [clickPoint];
          this.notifyRouteUpdate();
          this.renderInteractionLayer(e.evt.shiftKey);
        } else {
          const lastPt = this.routePoints[this.routePoints.length - 1];
          const distToLast = SnapEngine.distance(lastPt, clickPoint);

          // إذا نقر المستخدم في نفس النقطة تقريباً، إنهِ المسار
          if (distToLast < 10) {
            this.finishRoute();
            return;
          }

          this.routePoints.push(clickPoint);
          this.notifyRouteUpdate();

          // إذا نقر على رمز هندسي وعدد النقاط نقطتان فأكثر، ينهي المسار تلقائياً ويربطه
          if (symbolSnap && this.routePoints.length >= 2) {
            this.finishRoute();
            return;
          }

          this.renderInteractionLayer(e.evt.shiftKey);
        }
        return;
      }

      // 3.7 أداة إدراج ملاحظة وتلميح نصي (Text Note Tool)
      if (this.toolMode === 'text') {
        const isDark = this.theme === 'dark';
        const settings = getLastUsedSettings();
        const initialFontSize = settings.textFontSize || 16;
        const initialColor = settings.textColor || (isDark ? '#38bdf8' : '#0284c7');
        const initialFontWeight = settings.textFontWeight || 'normal';
        const initialAlign = settings.textAlign || 'right';

        const newText: TextObject = {
          id: 'text_' + Math.random().toString(36).substring(2, 9),
          type: 'text',
          layerId: this.model.getActiveLayerId(),
          text: 'ملاحظة وتلميح هندسي',
          x: Math.round(activeWorldPoint.x),
          y: Math.round(activeWorldPoint.y),
          fontSize: initialFontSize,
          color: initialColor,
          rotation: 0,
          backgroundColor: isDark ? '#0f172a' : '#f8fafc',
          backgroundOpacity: 0.9,
          borderColor: initialColor,
          padding: 6,
          fontWeight: initialFontWeight,
          align: initialAlign,
        };
        this.model.addObject(newText);
        this.selectObject(newText.id);
        this.setToolMode('select');
        this.render();
        return;
      }

      // 4. أداة رسم الأبعاد الهندسية (Dimension Tool - المرحلة 3)
      if (this.toolMode === 'dimension') {
        if (!this.isDrawingDimension) {
          this.isDrawingDimension = true;
          this.dimensionStartPoint = activeWorldPoint;
          this.renderInteractionLayer();
        } else if (this.dimensionStartPoint) {
          const polar = SnapEngine.getPolarAngleSnap(
            this.dimensionStartPoint,
            activeWorldPoint,
            [0, 45, 90, 135, 180, 225, 270, 315, 360],
            e.evt.shiftKey || this.isShiftKeyPressed ? 25 : 5.0
          );
          const isObjectSnap = snap.snapped && snap.type !== 'grid';
          const endPoint = (!isObjectSnap && polar.isSnapped) || e.evt.shiftKey || this.isShiftKeyPressed
            ? polar.point
            : activeWorldPoint;
          const dist = SnapEngine.distance(this.dimensionStartPoint, endPoint);
          if (dist > 5) {
            const currentSettings = getLastUsedSettings();
            const newDim: DimensionObject = {
              id: 'dim_' + Math.random().toString(36).substring(2, 9),
              type: 'dimension',
              layerId: this.model.getActiveLayerId(),
              start: { ...this.dimensionStartPoint },
              end: { ...endPoint },
              measuredLength: dist,
              offset: currentSettings.dimensionOffset || 20,
            };
            this.model.addObject(newDim);
            this.selectObject(newDim.id);
          }
          this.isDrawingDimension = false;
          this.dimensionStartPoint = null;
          this.render();
        }
        return;
      }

      // 5. شريط القياس السريع المؤقت (Measure Tape Tool - المرحلة 3)
      if (this.toolMode === 'measure') {
        if (!this.isMeasuring) {
          this.isMeasuring = true;
          this.measureStartPoint = activeWorldPoint;
          this.renderInteractionLayer();
        } else {
          // النقر للمرة الثانية يثبت النتيجة أو يلغيها
          this.isMeasuring = false;
          this.measureStartPoint = null;
          this.renderInteractionLayer();
        }
        return;
      }

      // 6. أداة قياس المساحة والمحيط (Area Tool - المرحلة 3)
      if (this.toolMode === 'area') {
        // إذا كان هناك 3 نقاط على الأقل ونقر المستخدم قرب النقطة الأولى، يغلق المضلع
        if (this.areaPoints.length >= 3) {
          const firstPt = this.areaPoints[0];
          const distToFirst = SnapEngine.distance(activeWorldPoint, firstPt);
          if (distToFirst < 20) {
            this.closeAreaPolygon();
            return;
          }
        }

        let ptToAdd = activeWorldPoint;
        if (this.areaPoints.length > 0) {
          const lastPt = this.areaPoints[this.areaPoints.length - 1];
          const polar = SnapEngine.getPolarAngleSnap(
            lastPt,
            activeWorldPoint,
            [0, 45, 90, 135, 180, 225, 270, 315, 360],
            e.evt?.shiftKey || this.isShiftKeyPressed ? 25 : 5.0
          );
          const isObjectSnap = snap.snapped && snap.type !== 'grid';
          if ((!isObjectSnap && polar.isSnapped) || e.evt?.shiftKey || this.isShiftKeyPressed) {
            ptToAdd = polar.point;
          }
        }

        this.areaPoints.push(ptToAdd);
        const pixelArea = GridUtils.calculatePolygonArea(this.areaPoints);
        const pixelPerimeter = GridUtils.calculatePolygonPerimeter(this.areaPoints);
        this.callbacks.onAreaUpdate?.(pixelArea, pixelPerimeter, this.areaPoints.length);
        this.renderInteractionLayer();
        return;
      }

      // 7. أداة المعايرة (Calibration Tool - أسلوب SketchUp بالمتر المباشر)
      if (this.toolMode === 'calibrate') {
        if (!this.isCalibrating) {
          this.isCalibrating = true;
          this.calibrateStartPoint = activeWorldPoint;
          this.activeCalibrationLine = null;
          this.renderInteractionLayer();
        } else if (this.calibrateStartPoint) {
          let endPoint = activeWorldPoint;
          const polar = SnapEngine.getPolarAngleSnap(
            this.calibrateStartPoint,
            endPoint,
            [0, 45, 90, 135, 180, 225, 270, 315, 360],
            e.evt?.shiftKey || this.isShiftKeyPressed ? 25 : 5.0
          );
          const isObjectSnap = snap.snapped && snap.type !== 'grid';
          if ((!isObjectSnap && polar.isSnapped) || e.evt?.shiftKey || this.isShiftKeyPressed) {
            endPoint = polar.point;
          }
          const dist = SnapEngine.distance(this.calibrateStartPoint, endPoint);
          if (dist > 10) {
            this.finishCalibration(this.calibrateStartPoint, endPoint);
          } else {
            this.isCalibrating = false;
            this.calibrateStartPoint = null;
            this.renderInteractionLayer();
          }
        }
        return;
      }

      // 8. أداة التحديد (Selection & Marquee Box Tool)
      if (this.toolMode === 'select') {
        if (this.selectionSubMode === 'box') {
          this.isMarqueeSelecting = true;
          this.marqueeStartPoint = worldRaw;
          return;
        }

        const isBackgroundTarget =
          e.target === this.stage ||
          e.target.getLayer() === this.backgroundLayer ||
          e.target.getLayer() === this.gridLayer;

        if (isBackgroundTarget) {
          // فحص ذكي: هل النقر قريب من أي عنصر (ضمن 14 بكسل) لتفادي فشل النقر في الشبكة الدقيقة؟
          let nearbyObjId: string | null = null;
          const all = this.model.getObjects();
          for (const obj of all) {
            if (obj.type === 'wall') {
              const w = obj as WallObject;
              const d = SnapEngine.pointToSegmentDistance(worldRaw, w.start, w.end);
              if (d <= (w.thickness / 2 + 14)) {
                nearbyObjId = w.id;
                break;
              }
            } else if (obj.type === 'symbol') {
              const s = obj as SymbolObject;
              if (SnapEngine.distance(worldRaw, { x: s.x, y: s.y }) <= 25) {
                nearbyObjId = s.id;
                break;
              }
            } else if (obj.type === 'route') {
              const r = obj as RouteObject;
              for (let i = 0; i < r.points.length - 1; i++) {
                if (SnapEngine.pointToSegmentDistance(worldRaw, r.points[i], r.points[i + 1]) <= 14) {
                  nearbyObjId = r.id;
                  break;
                }
              }
              if (nearbyObjId) break;
            } else if (obj.type === 'text') {
              const t = obj as TextObject;
              if (SnapEngine.distance(worldRaw, { x: t.x, y: t.y }) <= 30) {
                nearbyObjId = t.id;
                break;
              }
            } else if (obj.type === 'dimension') {
              const dim = obj as DimensionObject;
              if (SnapEngine.pointToSegmentDistance(worldRaw, dim.start, dim.end) <= 14) {
                nearbyObjId = dim.id;
                break;
              }
            }
          }

          if (nearbyObjId) {
            if (e.evt?.shiftKey || this.selectionSubMode === 'multi') {
              this.toggleObjectSelection(nearbyObjId);
            } else {
              this.selectObject(nearbyObjId);
            }
          } else {
            this.isMarqueeSelecting = true;
            this.marqueeStartPoint = worldRaw;
          }
        }
      }
    });

    // النقر المزدوج لإغلاق مضلع المساحة أو إنهاء رسم المسار
    this.stage.on('dblclick', () => {
      if (this.toolMode === 'area' && this.areaPoints.length >= 3) {
        this.closeAreaPolygon();
      } else if (this.toolMode === 'route' && this.isDrawingRoute && this.routePoints.length >= 2) {
        this.finishRoute();
      }
    });

    this.stage.on('mousemove touchmove', (e) => {
      // إيماءة القرص بإصبعين لها الأولوية على أي أداة
      const touches = (e.evt as TouchEvent).touches;
      if (touches && touches.length >= 2) {
        e.evt.preventDefault();
        if (!this.pinchState) this.beginPinch(touches);
        else this.updatePinch(touches);
        return;
      }
      if (this.pinchState) return;

      const pointer = this.stage.getPointerPosition();
      if (!pointer) return;

      if (this.isPanning) {
        const dx = pointer.x - this.panStartPos.x;
        const dy = pointer.y - this.panStartPos.y;
        this.camera.panBy(dx, dy);
        this.panStartPos = { x: pointer.x, y: pointer.y };

        // المخططات الكبيرة: تحريك لقطة نقطية واحدة بدلاً من إعادة رسم آلاف العُقد في كل إطار
        if (this.shouldUseFastGesture()) {
          this.beginGesture();
          this.scheduleGestureFrame();
          return;
        }

        // تحريك طبقات الكانفس مباشرة بأداء فائق 60/144 FPS دون إعادة بناء شجرة العناصر
        this.backgroundLayer.x(this.backgroundLayer.x() + dx);
        this.backgroundLayer.y(this.backgroundLayer.y() + dy);
        this.gridLayer.x(this.gridLayer.x() + dx);
        this.gridLayer.y(this.gridLayer.y() + dy);
        this.objectsLayer.x(this.objectsLayer.x() + dx);
        this.objectsLayer.y(this.objectsLayer.y() + dy);
        this.interactionLayer.x(this.interactionLayer.x() + dx);
        this.interactionLayer.y(this.interactionLayer.y() + dy);
        this.stage.batchDraw();
        return;
      }

      this.pendingPointerPos = pointer;
      this.pendingShiftKey = Boolean(e.evt?.shiftKey || this.isShiftKeyPressed);

      if (!this.isPointerMovePending) {
        this.isPointerMovePending = true;
        requestAnimationFrame(() => {
          this.isPointerMovePending = false;
          if (this.pendingPointerPos) {
            this.processPointerMove(this.pendingPointerPos, this.pendingShiftKey);
          }
        });
      }
    });

    const handleMouseUp = (ev?: Event) => {
      // نهاية إيماءة القرص: عند بقاء أقل من إصبعين
      if (this.pinchState) {
        const remaining = (ev as TouchEvent | undefined)?.touches?.length ?? 0;
        if (remaining < 2) {
          this.pinchState = null;
          this.onViewTransformChanged(true);
        }
        return;
      }
      if (this.isPanning) {
        this.isPanning = false;
        this.updateCursor();
        // تصفير إزاحات طبقات الكانفس وإعادة الرسم الدقيق الثابت
        this.backgroundLayer.position({ x: 0, y: 0 });
        this.gridLayer.position({ x: 0, y: 0 });
        this.objectsLayer.position({ x: 0, y: 0 });
        this.interactionLayer.position({ x: 0, y: 0 });
        this.onViewTransformChanged(true);
      }

      // إنهاء خط المعايرة فور رفع زر الفأرة (SketchUp Drag-to-Measure)
      if (this.toolMode === 'calibrate' && this.isCalibrating && this.calibrateStartPoint) {
        const pointer = this.stage.getPointerPosition();
        if (pointer) {
          const worldRaw = this.camera.screenToWorld(pointer);
          const snap = SnapEngine.findSnapPoint(worldRaw, this.model.getObjects(), this.getEffectiveSnapOptions());
          let endPoint = snap.point;
          const polar = SnapEngine.getPolarAngleSnap(
            this.calibrateStartPoint,
            endPoint,
            [0, 45, 90, 135, 180, 225, 270, 315, 360],
            this.isShiftKeyPressed ? 25 : 5.0
          );
          const isObjectSnap = snap.snapped && snap.type !== 'grid';
          if ((!isObjectSnap && polar.isSnapped) || this.isShiftKeyPressed) {
            endPoint = polar.point;
          }
          const dist = SnapEngine.distance(this.calibrateStartPoint, endPoint);
          if (dist > 15) {
            this.finishCalibration(this.calibrateStartPoint, endPoint);
          }
        }
      }

      if (this.isMarqueeSelecting && this.marqueeStartPoint) {
        const pointer = this.stage.getPointerPosition();
        const p1 = this.marqueeStartPoint;
        const p2 = pointer ? this.camera.screenToWorld(pointer) : this.currentSnapResult.point;
        const minX = Math.min(p1.x, p2.x);
        const maxX = Math.max(p1.x, p2.x);
        const minY = Math.min(p1.y, p2.y);
        const maxY = Math.max(p1.y, p2.y);

        this.isMarqueeSelecting = false;
        this.marqueeStartPoint = null;

        if (maxX - minX > 5 || maxY - minY > 5) {
          const box: BoxRect = { minX, minY, maxX, maxY };
          const all = this.model.getObjects();
          const selected = all.filter((obj) => isObjectInBox(obj, box, all));
          if (this.selectionSubMode === 'multi' || this.isShiftKeyPressed) {
            const combined = Array.from(
              new Set([...this.selectedObjectIds, ...selected.map((o) => o.id)])
            );
            this.selectObjects(combined);
          } else {
            this.selectObjects(selected.map((o) => o.id));
          }
        } else {
          if (this.selectionSubMode !== 'multi' && !this.isShiftKeyPressed && !this.wasGroupDragged) {
            this.selectObject(null);
          }
        }
        this.renderInteractionLayer();
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchend', handleMouseUp);
    window.addEventListener('touchcancel', handleMouseUp);
    this.windowMouseUpHandler = handleMouseUp;
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Shift') {
      this.isShiftKeyPressed = true;
    }
    // حماية حقول الإدخال النصية والتسميات التوضيحية
    const activeTag = document.activeElement?.tagName.toLowerCase();
    if (
      activeTag === 'input' ||
      activeTag === 'textarea' ||
      (document.activeElement as HTMLElement)?.isContentEditable
    ) {
      return;
    }

    // ملاحظة: Ctrl+A و Delete/Backspace تُعالَج في App.tsx فقط (أُزيل الازدواج من هنا)
    if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyA' || e.key.toLowerCase() === 'a' || e.key === 'ش')) {
      return;
    }

    const code = e.code;
    const key = e.key.toLowerCase();
    const isCtrlOrMeta = e.ctrlKey || e.metaKey;
    const hasModifier = isCtrlOrMeta || e.altKey;

    if (code === 'Space' && !this.isSpacePressed) {
      this.isSpacePressed = true;
      this.updateCursor();
    } else if (code === 'Escape') {
      this.cancelDrawing();
      this.deselectAll();
      this.setToolMode('select');
      this.setSelectionSubMode('single');
    } else if (!hasModifier && (code === 'KeyV' || key === 'v' || code === 'Digit1' || key === '1' || key === 'ر')) {
      // أداة التحديد القياسي: إذا كان التحديد مفعلاً، الضغط المتكرر على V يتنقل بين أنماط التحديد
      if (this.toolMode !== 'select') {
        this.setToolMode('select');
        this.setSelectionSubMode('single');
      } else if (code === 'Digit1' || key === '1') {
        this.setSelectionSubMode('single');
      } else {
        const nextSub = this.selectionSubMode === 'single' ? 'box' : this.selectionSubMode === 'box' ? 'multi' : 'single';
        this.setSelectionSubMode(nextSub);
      }
    } else if (!hasModifier && (code === 'KeyB' || key === 'b' || code === 'Digit2' || key === '2' || key === 'لا')) {
      // أداة التحديد بمربع الإحاطة (Box Selection)
      this.setToolMode('select');
      this.setSelectionSubMode('box');
    } else if (!hasModifier && (code === 'KeyQ' || key === 'q' || code === 'Digit3' || key === '3' || key === 'ض')) {
      // أداة التحديد المتعدد التراكمي (Multi Selection)
      this.setToolMode('select');
      this.setSelectionSubMode('multi');
    } else if (!hasModifier && (code === 'KeyW' || key === 'w' || code === 'Digit4' || key === '4' || key === 'ص')) {
      // أداة رسم الجدران (Wall Tool)
      this.setToolMode('wall');
    } else if (!hasModifier && (code === 'KeyD' || key === 'd' || code === 'Digit5' || key === '5' || key === 'ي')) {
      // أداة إدراج الأبواب (Door Tool)
      this.setToolMode('door');
    } else if (!hasModifier && (code === 'KeyN' || key === 'n' || code === 'Digit6' || key === '6' || key === 'ى')) {
      // أداة إدراج النوافذ (Window Tool)
      this.setToolMode('window');
    } else if (!hasModifier && (code === 'KeyM' || key === 'm' || code === 'Digit7' || key === '7' || key === 'ة')) {
      // أداة الأبعاد الهندسية (Dimension Tool)
      this.setToolMode('dimension');
    } else if (!hasModifier && (code === 'Digit8' || key === '8')) {
      // أداة شريط القياس السريع (Measure Tape)
      this.setToolMode('measure');
    } else if (!hasModifier && (code === 'KeyR' || key === 'r' || code === 'Digit9' || key === '9' || key === 'ق')) {
      // أداة المسارات الكهروميكانيكية (Route Tool)
      this.setToolMode('route');
    } else if (!hasModifier && (code === 'KeyA' || key === 'a' || code === 'Digit0' || key === '0' || key === 'ش')) {
      // أداة قياس المساحة والمحيط (Area Tool)
      this.setToolMode('area');
    } else if (!hasModifier && (code === 'KeyS' || key === 's' || key === 'س')) {
      // مكتبة الرموز الهندسية (Symbol Tool)
      this.setToolMode('symbol');
    } else if (!hasModifier && (code === 'KeyT' || key === 't' || key === 'ف')) {
      // أداة النصوص التوضيحية (Text Tool)
      this.setToolMode('text');
    } else if (!hasModifier && (code === 'KeyF' || key === 'f' || key === 'ب')) {
      // عكس اتجاه الرمز المحدد بمقدار 180 درجة (Flip Symbol)
      const selected = this.selectedObjectIds
        .map((id) => this.model.getObjectById(id))
        .filter((o): o is NonNullable<typeof o> => o !== null);
      const symbolObj = selected.find((o) => o.type === 'symbol');
      if (symbolObj && symbolObj.type === 'symbol') {
        const newRot = ((symbolObj.rotation + 180) % 360 + 360) % 360;
        this.model.updateObject(symbolObj.id, { rotation: newRot });
        this.render();
      }
    } else if (!hasModifier && (code === 'KeyH' || key === 'h' || key === 'ا')) {
      // أداة التحريك اليدوي (Pan Tool)
      this.setToolMode('pan');
    } else if (e.code === 'Enter') {
      if (this.toolMode === 'route' && this.isDrawingRoute && this.routePoints.length >= 2) {
        this.finishRoute();
      } else if (this.toolMode === 'area' && this.areaPoints.length >= 3) {
        this.closeAreaPolygon();
      }
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    if (e.key === 'Shift') {
      this.isShiftKeyPressed = false;
    }
    if (e.code === 'Space') {
      this.isSpacePressed = false;
      this.updateCursor();
    }
  };

  /**
   * إنهاء رسم خط المعايرة وتوليد نافذة الإدخال المباشرة على طريقة SketchUp
   */
  private finishCalibration(p1: Point, p2: Point): void {
    const dist = SnapEngine.distance(p1, p2);
    if (dist <= 5) return;

    this.activeCalibrationLine = { p1: { ...p1 }, p2: { ...p2 }, dist };
    this.isCalibrating = false;
    this.calibrateStartPoint = null;

    const sScreen = this.camera.worldToScreen(p1);
    const eScreen = this.camera.worldToScreen(p2);
    const screenPosition: Point = {
      x: (sScreen.x + eScreen.x) / 2,
      y: Math.min(sScreen.y, eScreen.y) - 15,
    };

    // إطلاق حدث المعايرة المباشرة بالمتر
    this.callbacks.onSketchUpCalibration?.({
      startWorld: p1,
      endWorld: p2,
      pixelDistance: dist,
      screenPosition,
    });

    this.callbacks.onCalibrationRequest?.(p1, p2, dist);
    this.renderInteractionLayer();
  }

  public cancelDrawing(): void {
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

  private processPointerMove(pointer: Point, shiftKey: boolean): void {
    const worldRaw = this.camera.screenToWorld(pointer);
    this.currentSnapResult = SnapEngine.findSnapPoint(
      worldRaw,
      this.model.getObjects(),
      this.getEffectiveSnapOptions(),
      this.toolMode === 'select' ? (this.selectedObjectId || undefined) : undefined
    );

    // فحص الالتقاط بالجدار عند تفعيل أداة الباب أو النافذة أو الرمز الهندسي
    const activeSettings = getLastUsedSettings();
    if (this.toolMode === 'door') {
      this.currentWallSnap = SnapEngine.findWallProjection(
        worldRaw,
        this.model.getObjects(),
        45,
        activeSettings.doorWidth || this.defaultDoorWidth
      );
      this.currentSymbolWallSnap = null;
    } else if (this.toolMode === 'window') {
      this.currentWallSnap = SnapEngine.findWallProjection(
        worldRaw,
        this.model.getObjects(),
        45,
        activeSettings.windowWidth || this.defaultWindowWidth
      );
      this.currentSymbolWallSnap = null;
    } else if (this.toolMode === 'symbol') {
      this.currentSymbolWallSnap = SnapEngine.findSymbolWallSnap(
        worldRaw,
        this.model.getObjects(),
        35,
        true
      );
      this.currentWallSnap = null;
    } else {
      this.currentWallSnap = null;
      this.currentSymbolWallSnap = null;
    }

    this.callbacks.onCursorMove(this.currentSnapResult.point, this.currentSnapResult);
    if (this.isDrawingWall && this.wallStartPoint) {
      this.callbacks.onWallDrawingStateChange?.(this.getWallDrawingState());
    }

    const hasActiveTransient =
      (this.isDrawingWall && this.wallStartPoint) ||
      (this.isDrawingDimension && this.dimensionStartPoint) ||
      (this.isMeasuring && this.measureStartPoint) ||
      (this.isCalibrating && this.calibrateStartPoint) ||
      (this.toolMode === 'area' && this.areaPoints.length > 0) ||
      this.toolMode === 'route' ||
      (this.isMarqueeSelecting && this.marqueeStartPoint) ||
      this.toolMode === 'door' ||
      this.toolMode === 'window' ||
      this.toolMode === 'symbol';

    if (hasActiveTransient) {
      this.renderInteractionLayer(shiftKey);
    } else {
      this.renderSnapIndicatorOnly();
    }
  }

  private onViewTransformChanged(immediate: boolean = false): void {
    if (immediate) {
      this.isTransformPending = false;
      this.callbacks.onCameraChange(this.camera.getState());
      this.render();
      return;
    }
    // المخططات الكبيرة: تحويل لقطة نقطية لحظياً ثم إعادة بناء دقيقة بعد توقف الإيماءة
    if (this.shouldUseFastGesture()) {
      this.beginGesture();
      this.scheduleGestureFrame();
      this.scheduleGestureEnd();
      return;
    }
    if (this.isTransformPending) return;
    this.isTransformPending = true;
    requestAnimationFrame(() => {
      this.isTransformPending = false;
      this.callbacks.onCameraChange(this.camera.getState());
      this.render();
    });
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  نظام الإيماءات السريعة (Fast Pan/Zoom) للمخططات الكبيرة
  //  الفكرة: أثناء التكبير/التحريك لا نعيد بناء آلاف عُقد Konva في كل إطار،
  //  بل نلتقط طبقة العناصر كصورة نقطية مرة واحدة ونطبّق عليها تحويل الكاميرا
  //  (scale + translate) وهو عملية رسم صورة واحدة فقط لكل إطار. وعند توقف
  //  الإيماءة (140ms) نعيد البناء المتجهي الدقيق مع الاقتطاع (Culling).
  // ═══════════════════════════════════════════════════════════════════════

  // ─── إيماءات اللمس المتعدد (الهواتف والأجهزة اللوحية) ───

  private touchToLocal(t: Touch): Point {
    const rect = this.container.getBoundingClientRect();
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  }

  private getPinchMetrics(touches: TouchList): { dist: number; center: Point } {
    const a = this.touchToLocal(touches[0]);
    const b = this.touchToLocal(touches[1]);
    return {
      dist: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
      center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
  }

  private beginPinch(touches: TouchList): void {
    this.pinchState = this.getPinchMetrics(touches);
    // إلغاء أي تأثير جانبي للإصبع الأول (تحديد مربع، سحب عنصر، أو بدء رسم) إن حدث للتو
    this.isMarqueeSelecting = false;
    this.marqueeStartPoint = null;
    this.isPanning = false;
    this.stage.find((n: Konva.Node) => n.isDragging()).forEach((n) => n.stopDrag());
    const snap = this.touchStartSnapshot;
    if (snap && Date.now() - snap.time < 450) {
      if (!snap.wasDrawingWall && this.isDrawingWall) this.cancelDrawing();
      if (this.routePoints.length > snap.routeLen) this.routePoints = this.routePoints.slice(0, snap.routeLen);
      if (this.areaPoints.length > snap.areaLen) this.areaPoints = this.areaPoints.slice(0, snap.areaLen);
      if (this.routePoints.length === 0) this.isDrawingRoute = false;
      // نقرة الإصبع الأول أدرجت عنصراً (رمز/باب/نافذة)؟ نتراجع عنها لأنها كانت بداية قرص
      if (this.model.getHistory().getPushCount() > snap.undoCount) {
        this.model.undo();
        this.deselectAll();
      } else if (snap.selectedIds !== this.selectedObjectIds) {
        // الإصبع الأول حدّد عنصراً بالخطأ قبل بدء القرص: نعيد التحديد السابق
        this.selectObjects(snap.selectedIds);
      }
      this.touchStartSnapshot = null;
    }
    this.renderInteractionLayer();
  }

  private updatePinch(touches: TouchList): void {
    if (!this.pinchState) return;
    const next = this.getPinchMetrics(touches);
    const factor = next.dist / this.pinchState.dist;
    this.camera.panBy(next.center.x - this.pinchState.center.x, next.center.y - this.pinchState.center.y);
    if (isFinite(factor) && Math.abs(factor - 1) > 0.0005) {
      this.camera.zoomAtScreenPoint(factor, next.center);
    }
    this.pinchState = next;
    this.onViewTransformChanged();
  }

  private shouldUseFastGesture(): boolean {
    if (this.disableCulling) return false;
    if (Konva.isDragging()) return false;
    return (
      this.isGestureActive ||
      this.lastObjectsRenderMs > CadEngine.FAST_GESTURE_THRESHOLD_MS ||
      this.lastRenderedGroupCount > CadEngine.FAST_GESTURE_GROUP_THRESHOLD
    );
  }

  private beginGesture(): void {
    if (this.isGestureActive) return;
    // نضمن أن الطبقة مرسومة فعلياً بآخر حالة قبل التقاطها
    this.objectsLayer.drawScene();
    const native = this.objectsLayer.getNativeCanvasElement();
    if (!native || native.width === 0 || native.height === 0) return;

    const snap = this.gestureSnapshotCanvas || document.createElement('canvas');
    if (snap.width !== native.width || snap.height !== native.height) {
      snap.width = native.width;
      snap.height = native.height;
    }
    const ctx = snap.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, snap.width, snap.height);
    ctx.drawImage(native, 0, 0);
    this.gestureSnapshotCanvas = snap;

    this.gestureProxyLayer.destroyChildren();
    this.gestureProxyImage = new Konva.Image({
      image: snap,
      x: 0,
      y: 0,
      width: this.stage.width(),
      height: this.stage.height(),
      listening: false,
    });
    this.gestureProxyLayer.add(this.gestureProxyImage);
    this.gestureBaseCamera = this.objectsRenderedCamera || this.camera.getState();
    this.gestureProxyLayer.position({ x: 0, y: 0 });
    this.gestureProxyLayer.scale({ x: 1, y: 1 });
    this.gestureProxyLayer.visible(true);
    this.objectsLayer.visible(false);
    this.isGestureActive = true;
  }

  /** تطبيق تحويل الكاميرا الحالي على الطبقات المؤقتة (إطار واحد عبر requestAnimationFrame) */
  private scheduleGestureFrame(): void {
    if (this.gestureFramePending) return;
    this.gestureFramePending = true;
    requestAnimationFrame(() => {
      this.gestureFramePending = false;
      this.applyGestureTransforms();
    });
  }

  private applyGestureTransforms(): void {
    const cam = this.camera.getState();
    const applyRelative = (layer: Konva.Layer, base: CameraState | null) => {
      if (!base || base.zoom === 0) return;
      const k = cam.zoom / base.zoom;
      layer.scale({ x: k, y: k });
      layer.position({ x: cam.offsetX - base.offsetX * k, y: cam.offsetY - base.offsetY * k });
    };
    if (this.isGestureActive) {
      applyRelative(this.gestureProxyLayer, this.gestureBaseCamera);
      this.gestureProxyLayer.batchDraw();
    }
    applyRelative(this.backgroundLayer, this.bgRenderedCamera);
    this.backgroundLayer.batchDraw();
    // الشبكة وطبقة التفاعل خفيفتان: تُرسمان مباشرة بالكاميرا الحالية لدقة تامة
    this.renderGridLayer();
    this.renderInteractionLayer(this.isShiftKeyPressed);
    this.callbacks.onCameraChange(cam);
  }

  private scheduleGestureEnd(): void {
    if (this.gestureEndTimer) clearTimeout(this.gestureEndTimer);
    this.gestureEndTimer = setTimeout(() => {
      this.gestureEndTimer = null;
      if (this.isPanning || this.pinchState) return; // ستنتهي عند رفع الإصبع/الزر
      this.endGesture();
      this.callbacks.onCameraChange(this.camera.getState());
      this.render();
    }, CadEngine.GESTURE_SETTLE_MS);
  }

  /** إنهاء وضع اللقطة المؤقتة (لا يعيد الرسم بنفسه) */
  private endGesture(): void {
    if (this.gestureEndTimer) {
      clearTimeout(this.gestureEndTimer);
      this.gestureEndTimer = null;
    }
    if (!this.isGestureActive) return;
    this.isGestureActive = false;
    this.gestureProxyLayer.visible(false);
    this.gestureProxyLayer.destroyChildren();
    this.gestureProxyImage = null;
    this.objectsLayer.visible(true);
  }

  /** إنهاء الإيماءة فوراً مع إعادة البناء الدقيق (قبل أي نقر حتى تصيب النقرة العناصر الحقيقية) */
  private flushGesture(): void {
    if (!this.isGestureActive && !this.gestureEndTimer) return;
    this.endGesture();
    this.callbacks.onCameraChange(this.camera.getState());
    this.render();
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

  private updateCursor(): void {
    if (this.isPanning || this.isSpacePressed) {
      this.stage.container().style.cursor = 'grab';
    } else if (
      this.toolMode === 'wall' ||
      this.toolMode === 'dimension' ||
      this.toolMode === 'measure' ||
      this.toolMode === 'calibrate' ||
      this.toolMode === 'area' ||
      this.toolMode === 'route' ||
      this.toolMode === 'text'
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
  private renderBackgroundLayer(): void {
    this.backgroundLayer.destroyChildren();
    this.backgroundLayer.position({ x: 0, y: 0 });
    this.backgroundLayer.scale({ x: 1, y: 1 });
    this.bgRenderedCamera = this.camera.getState();

    const bg = this.model.getBackgroundImage();
    if (!bg || !bg.visible || !bg.dataUrl) {
      this.backgroundLayer.batchDraw();
      return;
    }

    const sPos = this.camera.worldToScreen({ x: bg.x, y: bg.y });
    const zoom = this.camera.getState().zoom;

    const renderKonvaImage = (img: HTMLImageElement) => {
      const konvaImg = new Konva.Image({
        image: img,
        x: sPos.x,
        y: sPos.y,
        width: bg.width * zoom,
        height: bg.height * zoom,
        opacity: Math.max(0.05, Math.min(1.0, bg.opacity)),
        draggable: !bg.locked && this.toolMode === 'select',
      });

      konvaImg.on('dragend', () => {
        const newScreenX = konvaImg.x();
        const newScreenY = konvaImg.y();
        const newWorld = this.camera.screenToWorld({ x: newScreenX, y: newScreenY });
        this.model.updateBackgroundImage({ x: newWorld.x, y: newWorld.y });
      });

      this.backgroundLayer.add(konvaImg);
      this.backgroundLayer.batchDraw();
    };

    if (this.bgImageElement && this.lastBgDataUrl === bg.dataUrl) {
      renderKonvaImage(this.bgImageElement);
    } else if (this.pendingBgDataUrl !== bg.dataUrl) {
      // إصلاح: سابقاً كان كل استدعاء render() قبل اكتمال تحميل الصورة يُنشئ تحميلاً جديداً
      // ثم تُضاف عدة نسخ من الصورة فوق بعضها. الآن تحميل واحد فقط ثم إعادة رسم الطبقة.
      this.pendingBgDataUrl = bg.dataUrl;
      const img = new Image();
      img.onload = () => {
        if (this.pendingBgDataUrl !== bg.dataUrl) return; // تم استبدال الصورة أثناء التحميل
        this.pendingBgDataUrl = null;
        this.bgImageElement = img;
        this.lastBgDataUrl = bg.dataUrl;
        this.renderBackgroundLayer();
      };
      img.onerror = () => {
        if (this.pendingBgDataUrl === bg.dataUrl) this.pendingBgDataUrl = null;
      };
      img.src = bg.dataUrl;
    }
  }

  /**
   * رسم شبكة الـ CAD اللانهائية ومحاور الأصل (0,0)
   */
  private renderGridLayer(): void {
    this.gridLayer.destroyChildren();
    this.gridLayer.position({ x: 0, y: 0 });
    this.gridLayer.scale({ x: 1, y: 1 });

    const width = this.stage.width();
    const height = this.stage.height();
    const gridSize = this.snapOptions.gridSize;
    const zoom = this.camera.getState().zoom;
    const screenGrid = gridSize * zoom;

    // تكييف خطوة الرسم بناءً على التكبير لضمان سلاسة الأداء وعدم تداخل الخطوط
    // (مُحسّن: مضاعف صحيح للشبكة دائماً + منع انفجار عدد الخطوط عند التصغير الشديد)
    let mult = 1;
    if (screenGrid < 6) {
      mult = 5;
    } else if (screenGrid < 11) {
      mult = 2;
    }
    while (gridSize > 0 && gridSize * mult * zoom < 6 && mult < 1e6) {
      mult *= 5;
    }
    const step = gridSize * mult;

    const bounds = GridUtils.getVisibleGridBounds(this.camera, width, height, step);
    const gridLinesGroup = new Konva.Group();

    const isDark = this.theme === 'dark';
    const axisYColor = isDark ? '#6366f1' : '#4f46e5';
    const axisXColor = isDark ? '#ef4444' : '#dc2626';
    const majorColor = isDark ? '#383842' : '#cbd5e1';
    const minorColor = isDark ? '#26262e' : '#e2e8f0';

    // فهارس صحيحة بدلاً من مقارنة باقي القسمة على أعداد عشرية (كانت تفشل مع المقاييس المعايرة غير الصحيحة
    // مثل 37.43 بكسل/متر فتختفي الخطوط الرئيسية، ويتراكم خطأ الفاصلة العائمة مع y += step)
    const iStartX = Math.round(bounds.startX / gridSize);
    const iEndX = Math.round(bounds.endX / gridSize);
    const iStartY = Math.round(bounds.startY / gridSize);
    const iEndY = Math.round(bounds.endY / gridSize);
    const isMajorIdx = (i: number) => i % 4 === 0 || i % 5 === 0;
    const zoomNow = zoom;
    const cam = this.camera.getState();
    const sx = (wx: number) => wx * zoomNow + cam.offsetX;
    const sy = (wy: number) => wy * zoomNow + cam.offsetY;
    const left = sx(bounds.startX);
    const right = sx(bounds.endX);
    const top = sy(bounds.startY);
    const bottom = sy(bounds.endY);

    const gridShape = new Konva.Shape({
      sceneFunc: (context) => {
        if (gridSize <= 0) return;
        const drawLines = (major: boolean) => {
          context.beginPath();
          for (let i = iStartY; i <= iEndY; i += mult) {
            if (i === 0 || isMajorIdx(i) !== major) continue;
            const y = sy(i * gridSize);
            context.moveTo(left, y);
            context.lineTo(right, y);
          }
          for (let i = iStartX; i <= iEndX; i += mult) {
            if (i === 0 || isMajorIdx(i) !== major) continue;
            const x = sx(i * gridSize);
            context.moveTo(x, top);
            context.lineTo(x, bottom);
          }
        };

        // 1. رسم خطوط الشبكة الفرعية المتقطعة بدفعة واحدة
        drawLines(false);
        context.strokeStyle = minorColor;
        context.lineWidth = 0.6;
        context.setLineDash([2, 4]);
        context.stroke();

        // 2. رسم خطوط الشبكة الرئيسية بدفعة واحدة
        drawLines(true);
        context.strokeStyle = majorColor;
        context.lineWidth = 1;
        context.setLineDash([]);
        context.stroke();

        // 3. رسم محاور الأصل (0, 0)
        const y0_1 = this.camera.worldToScreen({ x: bounds.startX, y: 0 });
        const y0_2 = this.camera.worldToScreen({ x: bounds.endX, y: 0 });
        context.beginPath();
        context.moveTo(y0_1.x, y0_1.y);
        context.lineTo(y0_2.x, y0_2.y);
        context.strokeStyle = axisYColor;
        context.lineWidth = 1.5;
        context.stroke();

        const x0_1 = this.camera.worldToScreen({ x: 0, y: bounds.startY });
        const x0_2 = this.camera.worldToScreen({ x: 0, y: bounds.endY });
        context.beginPath();
        context.moveTo(x0_1.x, x0_1.y);
        context.lineTo(x0_2.x, x0_2.y);
        context.strokeStyle = axisXColor;
        context.lineWidth = 1.5;
        context.stroke();
      },
      listening: false,
    });
    gridLinesGroup.add(gridShape);

    const originScreen = this.camera.worldToScreen({ x: 0, y: 0 });
    gridLinesGroup.add(
      new Konva.Circle({
        x: originScreen.x,
        y: originScreen.y,
        radius: 4,
        fill: isDark ? '#818cf8' : '#4f46e5',
      })
    );

    this.gridLayer.add(gridLinesGroup);
    this.gridLayer.batchDraw();
  }

  /**
   * رسم العناصر الهندسية (الجدران، الأبواب، النوافذ، الأبعاد)
   */
  public renderObjectsLayer(): void {
    // أي إعادة بناء حقيقية تُنهي وضع اللقطة المؤقتة وتعيد الطبقة لتحويل الهوية
    this.endGesture();
    const renderStart = performance.now();
    this.objectsLayer.destroyChildren();
    this.objectsLayer.position({ x: 0, y: 0 });
    this.objectsLayer.scale({ x: 1, y: 1 });
    this.objectsRenderedCamera = this.camera.getState();

    const objects = this.model.getObjects();
    const layers = this.model.getLayers();
    const meta = this.model.getMeta();
    const pixelsPerMeter = meta.scale || 50;
    const zoom = this.camera.getState().zoom;
    const isDark = this.theme === 'dark';

    // ─── فهارس سريعة O(1) بدلاً من find() داخل الحلقات ───
    const layerById = new Map(layers.map((l) => [l.id, l]));
    const wallById = new Map<string, WallObject>();
    for (const o of objects) {
      if (o.type === 'wall') wallById.set(o.id, o as WallObject);
    }
    // مشهد ثقيل: نتخلى عن المؤثرات المكلفة (الظلال) للحفاظ على السلاسة
    const heavyScene = objects.length > 800 && !this.disableCulling; // التصدير بجودة كاملة دائماً

    // ─── الاقتطاع حسب نطاق الرؤية (Viewport Culling) مع هامش نصف شاشة ───
    const vw = this.stage.width();
    const vh = this.stage.height();
    const marginPx = Math.max(vw, vh) * 0.5;
    const viewTL = this.camera.screenToWorld({ x: -marginPx, y: -marginPx });
    const viewBR = this.camera.screenToWorld({ x: vw + marginPx, y: vh + marginPx });
    const cullEnabled = !this.disableCulling;
    const inView = (minX: number, minY: number, maxX: number, maxY: number): boolean =>
      !cullEnabled || !(maxX < viewTL.x || minX > viewBR.x || maxY < viewTL.y || minY > viewBR.y);
    const wallInView = (w: WallObject): boolean => {
      const pad = (w.thickness || 20) / 2 + 40 / zoom;
      return inView(
        Math.min(w.start.x, w.end.x) - pad,
        Math.min(w.start.y, w.end.y) - pad,
        Math.max(w.start.x, w.end.x) + pad,
        Math.max(w.start.y, w.end.y) + pad
      );
    };

    // 1. رسم الجدران
    for (const obj of objects) {
      if (obj.type !== 'wall') continue;
      const wall = obj as WallObject;
      const layer = layerById.get(wall.layerId);
      if (layer && !layer.visible) continue;

      const isSelected = this.isObjectSelected(wall.id);
      if (!isSelected && !wallInView(wall)) continue;
      const isLocked = layer?.locked ?? false;

      const sScreen = this.camera.worldToScreen(wall.start);
      const eScreen = this.camera.worldToScreen(wall.end);
      const screenThickness = Math.max(2, wall.thickness * zoom);

      const group = new Konva.Group({
        id: wall.id,
        draggable: !isLocked && this.toolMode === 'select' && this.selectionSubMode !== 'box',
      });

      if (isSelected) {
        group.add(
          new Konva.Line({
            points: [sScreen.x, sScreen.y, eScreen.x, eScreen.y],
            stroke: '#38bdf8',
            strokeWidth: screenThickness + 10,
            lineCap: 'round',
            opacity: 0.4,
          })
        );
      }

      let wallStroke = isSelected ? '#38bdf8' : (layer?.color || '#e2e8f0');
      let centerLineStroke = isSelected ? '#0284c7' : '#475569';
      if (!isDark && !isSelected) {
        if (
          !layer?.color ||
          layer.color === '#f3f4f6' ||
          layer.color === '#ffffff' ||
          layer.color === '#e2e8f0' ||
          layer.color === '#f8fafc' ||
          layer.id === 'arch'
        ) {
          wallStroke = '#1e293b'; // لون داكن متباين عالي الوضوح في الوضع النهاري
          centerLineStroke = '#94a3b8';
        }
      }

      const wallLine = new Konva.Line({
        points: [sScreen.x, sScreen.y, eScreen.x, eScreen.y],
        stroke: wallStroke,
        strokeWidth: screenThickness,
        hitStrokeWidth: Math.max(28, screenThickness + 18),
        lineCap: 'square',
        lineJoin: 'miter',
      });
      group.add(wallLine);

      // (أُزيل خط الاستهداف الشفاف المكرر: hitStrokeWidth على wallLine أعلاه يؤدي الوظيفة نفسها بعقدة أقل)

      // مستوى التفاصيل (LOD): خط المحور لا يُرى عملياً عندما تكون سماكة الجدار على الشاشة أقل من 3px
      if (screenThickness >= 3 || isSelected || this.disableCulling) {
        group.add(
          new Konva.Line({
            points: [sScreen.x, sScreen.y, eScreen.x, eScreen.y],
            stroke: centerLineStroke,
            strokeWidth: 1,
            dash: [4, 4],
            opacity: 0.6,
            listening: false,
          })
        );
      }

      const dist = SnapEngine.distance(wall.start, wall.end);
      const lengthStr = GridUtils.formatLength(dist, pixelsPerMeter, meta.unit);
      const midX = (sScreen.x + eScreen.x) / 2;
      const midY = (sScreen.y + eScreen.y) / 2;
      const dx = eScreen.x - sScreen.x;
      const dy = eScreen.y - sScreen.y;
      const wallLen = Math.sqrt(dx * dx + dy * dy);

      let ux = 0;
      let uy = 0;
      let nx = 0;
      let ny = -1;
      let readableAngle = 0;

      if (wallLen > 0) {
        ux = dx / wallLen;
        uy = dy / wallLen;
        nx = -uy;
        ny = ux;
        if (ny > 0.001 || (Math.abs(ny) <= 0.001 && nx > 0)) {
          nx = -nx;
          ny = -ny;
        }
        readableAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (readableAngle > 90) readableAngle -= 180;
        if (readableAngle < -90) readableAngle += 180;
      }

      // LOD: لا نرسم شارة الطول إذا كان الجدار على الشاشة أقصر من أن تُقرأ الشارة عليه
      if (this.showWallLengths && wallLen > 0 && (wallLen >= 48 || isSelected || this.disableCulling)) {
        // إزاحة نص القياس خارج الجدار بمسافة ثابتة (Offset عمودي على اتجاه الجدار)
        const offsetDist = screenThickness / 2 + 15;
        const textX = midX + nx * offsetDist;
        const textY = midY + ny * offsetDist;

        const badgeGroup = new Konva.Group({
          x: textX,
          y: textY,
          rotation: readableAngle,
        });

        const badgeW = Math.max(38, lengthStr.length * 7.5);
        const badgeH = 16;

        // خلفية أنيقة شبه شفافة لضمان القراءة بوضوح حتى في المخططات المزدحمة
        const badgeBgColor = isDark ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.96)';
        const badgeBorderColor = isSelected ? '#38bdf8' : '#0284c7';
        const badgeTextColor = isSelected ? (isDark ? '#7dd3fc' : '#0284c7') : (isDark ? '#38bdf8' : '#0369a1');

        badgeGroup.add(
          new Konva.Rect({
            x: -badgeW / 2,
            y: -badgeH / 2,
            width: badgeW,
            height: badgeH,
            fill: badgeBgColor,
            stroke: badgeBorderColor,
            strokeWidth: 0.8,
            cornerRadius: 3,
            shadowColor: isDark ? '#000' : '#64748b',
            shadowBlur: heavyScene ? 0 : 3,
            shadowEnabled: !heavyScene,
            shadowOpacity: isDark ? 0.45 : 0.2,
            listening: false,
          })
        );

        // نص القياس بلون أزرق/سماوي ناصع ومختلف تماماً عن لون الجدار
        badgeGroup.add(
          new Konva.Text({
            x: -badgeW / 2,
            y: -badgeH / 2 + 2,
            width: badgeW,
            text: lengthStr,
            fontSize: Math.max(9.5, Math.min(13, 11 * Math.sqrt(zoom))),
            fontFamily: 'JetBrains Mono, monospace',
            fontStyle: 'bold',
            fill: badgeTextColor,
            align: 'center',
            listening: false,
          })
        );

        group.add(badgeGroup);
      }

        if (wall.label) {
          const labelX = midX - nx * (screenThickness / 2 + 13);
          const labelY = midY - ny * (screenThickness / 2 + 13);
          const labelGroup = new Konva.Group({
            x: labelX,
            y: labelY,
            rotation: readableAngle,
          });
          labelGroup.add(
            new Konva.Text({
              x: -30,
              y: -7,
              width: 60,
              text: wall.label,
              fontSize: Math.max(9, Math.min(12, 10 * Math.sqrt(zoom))),
              fontFamily: 'Cairo, sans-serif',
              fontStyle: 'bold',
              fill: isSelected ? (isDark ? '#38bdf8' : '#0284c7') : (isDark ? '#94a3b8' : '#1e293b'),
              align: 'center',
              listening: false,
            })
          );
          group.add(labelGroup);
        }

      group.on('mousedown touchstart', (e) => {
        if (e.evt && e.evt.button !== 0 && !e.evt.touches) return;
        if (this.toolMode !== 'select' || this.selectionSubMode === 'box') return;
        e.cancelBubble = true;
        if (!this.selectedObjectIds.includes(wall.id)) {
          if (e.evt?.shiftKey || this.selectionSubMode === 'multi') {
            this.toggleObjectSelection(wall.id);
          } else {
            this.selectedObjectId = wall.id;
            this.selectedObjectIds = [wall.id];
            this.callbacks.onSelectObject(wall.id);
            this.callbacks.onSelectObjects?.([wall.id]);
          }
        }
      });

      group.on('click tap', (e) => {
        if (e.evt && e.evt.button !== 0 && !e.evt.touches) return;
        if (this.toolMode !== 'select' || this.selectionSubMode === 'box') return;
        e.cancelBubble = true;
        if (this.wasGroupDragged) {
          return;
        }
        if (e.evt?.shiftKey || this.selectionSubMode === 'multi') {
          this.toggleObjectSelection(wall.id);
        } else {
          this.selectObject(wall.id);
        }
      });

      group.on('dragstart', () => {
        if (!this.selectedObjectIds.includes(wall.id)) {
          this.selectedObjectId = wall.id;
          this.selectedObjectIds = [wall.id];
          this.callbacks.onSelectObject(wall.id);
          this.callbacks.onSelectObjects?.([wall.id]);
        }
        this.onGroupDragStart(wall.id);
      });

      group.on('dragmove', () => {
        this.onGroupDragMove(wall.id, { x: group.x(), y: group.y() });
      });

      group.on('dragend', () => {
        if (this.onGroupDragEnd(wall.id, { x: group.x(), y: group.y() })) {
          return;
        }

        const dxScreen = group.x();
        const dyScreen = group.y();
        const dxWorld = dxScreen / zoom;
        const dyWorld = dyScreen / zoom;

        group.position({ x: 0, y: 0 });

        if (Math.abs(dxWorld) > 0.01 || Math.abs(dyWorld) > 0.01) {
          this.wasGroupDragged = true;
          this.model.moveObjects([wall.id], { x: dxWorld, y: dyWorld });
        }

        setTimeout(() => {
          this.wasGroupDragged = false;
        }, 120);
        this.render();
      });

      this.objectsLayer.add(group);
    }

    // 2. رسم الأبواب (Doors)
    for (const obj of objects) {
      if (obj.type !== 'door') continue;
      const door = obj as DoorObject;
      const layer = layerById.get(door.layerId);
      if (layer && !layer.visible) continue;

      const wall = wallById.get(door.wallId);
      if (!wall) continue;
      if (!wallInView(wall) && !this.isObjectSelected(door.id) && !this.isObjectSelected(wall.id)) continue;

      this.renderDoor(door, wall, layer?.locked ?? false);
    }

    // 3. رسم النوافذ (Windows)
    for (const obj of objects) {
      if (obj.type !== 'window') continue;
      const win = obj as WindowObject;
      const layer = layerById.get(win.layerId);
      if (layer && !layer.visible) continue;

      const wall = wallById.get(win.wallId);
      if (!wall) continue;
      if (!wallInView(wall) && !this.isObjectSelected(win.id) && !this.isObjectSelected(wall.id)) continue;

      this.renderWindow(win, wall, layer?.locked ?? false);
    }

    // 4. رسم الأبعاد الهندسية (Dimensions - المرحلة 3)
    for (const obj of objects) {
      if (obj.type !== 'dimension') continue;
      const dim = obj as DimensionObject;
      const layer = layerById.get(dim.layerId);
      if (layer && !layer.visible) continue;
      if (!this.isObjectSelected(dim.id)) {
        const pad = Math.abs(dim.offset || 25) + 60 / zoom;
        if (!inView(
          Math.min(dim.start.x, dim.end.x) - pad, Math.min(dim.start.y, dim.end.y) - pad,
          Math.max(dim.start.x, dim.end.x) + pad, Math.max(dim.start.y, dim.end.y) + pad
        )) continue;
      }

      this.renderDimension(dim, layer?.locked ?? false);
    }

    // 5. رسم الرموز الهندسية (Symbols - المرحلة 4)
    for (const obj of objects) {
      if (obj.type !== 'symbol') continue;
      const sym = obj as SymbolObject;
      const layer = layerById.get(sym.layerId);
      if (layer && !layer.visible) continue;
      if (!this.isObjectSelected(sym.id)) {
        const def = getSymbolById(sym.symbolKind);
        const r = (Math.max(def?.defaultWidth || 40, def?.defaultHeight || 40, 40) * (sym.scale || 1)) + 60 / zoom;
        if (!inView(sym.x - r, sym.y - r, sym.x + r, sym.y + r)) continue;
      }

      let symColor = sym.color || layer?.color || '#f59e0b';
      if (!isDark && !sym.color) {
        if (
          !layer?.color ||
          symColor === '#f3f4f6' ||
          symColor === '#ffffff' ||
          symColor === '#e2e8f0' ||
          symColor === '#f8fafc' ||
          symColor === '#f1f5f9' ||
          layer?.id === 'arch'
        ) {
          symColor = '#0f172a';
        }
      }

      this.renderSymbol(
        sym,
        layer?.locked ?? false,
        symColor,
        layer?.opacity ?? 1
      );
    }

    // 6. رسم المسارات والكابلات والمواسير (Routes - المرحلة 5)
    for (const obj of objects) {
      if (obj.type !== 'route') continue;
      const route = obj as RouteObject;
      const layer = layerById.get(route.layerId);
      if (layer && !layer.visible) continue;
      if (!this.isObjectSelected(route.id) && route.points.length > 0) {
        let rMinX = Infinity, rMinY = Infinity, rMaxX = -Infinity, rMaxY = -Infinity;
        for (const p of route.points) {
          if (p.x < rMinX) rMinX = p.x; if (p.x > rMaxX) rMaxX = p.x;
          if (p.y < rMinY) rMinY = p.y; if (p.y > rMaxY) rMaxY = p.y;
        }
        const pad = 80 / zoom;
        if (!inView(rMinX - pad, rMinY - pad, rMaxX + pad, rMaxY + pad)) continue;
      }

      this.renderRoute(
        route,
        layer?.locked ?? false,
        route.color || layer?.color || '#f59e0b',
        layer?.opacity ?? 1
      );
    }

    // 7. رسم الملاحظات والتلميحات النصية (Text Notes)
    for (const obj of objects) {
      if (obj.type !== 'text') continue;
      const textObj = obj as TextObject;
      const layer = layerById.get(textObj.layerId);
      if (layer && !layer.visible) continue;
      if (!this.isObjectSelected(textObj.id)) {
        // تقدير متحفظ لأبعاد بطاقة النص (لا يتطلب قياس الخط)
        const lines = (textObj.text || '').split('\n');
        const longest = lines.reduce((m, l) => Math.max(m, l.length), 4);
        const fs = textObj.fontSize || 16;
        const w = longest * fs + 40;
        const h = lines.length * fs * 1.6 + 40;
        const r = Math.max(w, h);
        if (!inView(textObj.x - r, textObj.y - r, textObj.x + r, textObj.y + r)) continue;
      }

      this.renderTextObject(
        textObj,
        layer?.locked ?? false,
        textObj.color || layer?.color || '#38bdf8',
        layer?.opacity ?? 1
      );
    }

    // 8. مقابض تعديل الجدار المحدد ومؤشر (+) لإطالته (تُرسم دائماً في أعلى طبقة العناصر لتسهيل الالتقاط المباشر في وضع التحديد فقط)
    if (this.toolMode === 'select' && this.selectedObjectIds.length === 1) {
      const selectedObj = this.model.getObjectById(this.selectedObjectIds[0]);
      if (selectedObj && selectedObj.type === 'wall') {
        const wall = selectedObj as WallObject;
        const layer = layers.find((l) => l.id === wall.layerId);
        if (!layer?.locked) {
          this.renderWallHandles(wall);
        }
      }
    }

    this.objectsLayer.batchDraw();
    this.lastObjectsRenderMs = performance.now() - renderStart;
    this.lastRenderedGroupCount = this.objectsLayer.getChildren().length;
  }

  /**
   * رسم عنصر الرمز الهندسي (Symbol - المرحلة 4)
   * يدعم السحب، التحديد، الدوران، والالتصاق الذكي بالجدار (Wall Snap)
   */
  private renderSymbol(
    symbol: SymbolObject,
    isLocked: boolean,
    layerColor: string,
    layerOpacity: number
  ): void {
    const isSelected = this.isObjectSelected(symbol.id);
    const zoom = this.camera.getState().zoom;
    const sPos = this.camera.worldToScreen({ x: symbol.x, y: symbol.y });
    const symDef = getSymbolById(symbol.symbolKind);
    const isDark = this.theme === 'dark';

    const group = new Konva.Group({
      id: symbol.id,
      x: sPos.x,
      y: sPos.y,
      rotation: symbol.rotation,
      scale: { x: (symbol.scale || 1) * zoom, y: (symbol.scale || 1) * zoom },
      opacity: layerOpacity,
      draggable: !isLocked && this.toolMode === 'select' && this.selectionSubMode !== 'box',
    });

    // هالة التحديد المضيئة عند الاختيار
    if (isSelected) {
      const radius = Math.max(16, (symDef?.defaultWidth || 20) / 2 + 5);
      group.add(
        new Konva.Circle({
          x: 0,
          y: 0,
          radius,
          stroke: '#38bdf8',
          strokeWidth: 2,
          dash: [4, 3],
          fill: '#0284c7',
          opacity: 0.2,
        })
      );
    }

    // رسم محتوى الرمز الهندسي المتجهي (استخدام اللون المخصص للرمز إن وجد، أو لون الطبقة الافتراضي)
    const effectiveSymbolColor = symbol.color || layerColor;
    if (symDef) {
      symDef.renderKonva(group, {
        color: effectiveSymbolColor,
        isSelected,
        zoom,
      });
    } else {
      group.add(
        new Konva.Circle({
          x: 0,
          y: 0,
          radius: 10,
          fill: '#1e293b',
          stroke: effectiveSymbolColor,
          strokeWidth: 2,
        })
      );
    }

    // كتابة التسمية التوضيحية دائماً باتجاه الشاشة لتبقى قابلة للقراءة بشكل صحيح حتى عند تغيير اتجاه الرمز
    if (symbol.label) {
      const offsetDist = Math.max(16, (symDef?.defaultHeight || 20) / 2 + 12);
      const rad = (-symbol.rotation * Math.PI) / 180;
      const localX = -offsetDist * Math.sin(rad);
      const localY = offsetDist * Math.cos(rad);

      const labelGroup = new Konva.Group({
        x: localX,
        y: localY,
        rotation: -symbol.rotation, // مضاد لدوران الرمز ليبقى دائماً أفقياً وموجهاً للشاشة
        name: 'symbol-label-group',
      });
      const badgeW = Math.max(34, symbol.label.length * 8 + 10);
      const labelBg = new Konva.Rect({
        x: -badgeW / 2,
        y: -9,
        width: badgeW,
        height: 18,
        fill: isDark ? 'rgba(15, 23, 42, 0.90)' : 'rgba(255, 255, 255, 0.95)',
        stroke: isSelected ? '#38bdf8' : (isDark ? '#334155' : '#cbd5e1'),
        strokeWidth: 0.8,
        cornerRadius: 4,
        listening: false,
      });
      const labelText = new Konva.Text({
        x: -badgeW / 2,
        y: -7,
        width: badgeW,
        text: symbol.label,
        fontSize: Math.max(9, Math.min(12, 10 / Math.sqrt(zoom))),
        fontFamily: 'Cairo, sans-serif',
        fontStyle: 'bold',
        fill: isSelected ? (isDark ? '#38bdf8' : '#0284c7') : (isDark ? '#e2e8f0' : '#0f172a'),
        align: 'center',
        listening: false,
      });
      labelGroup.add(labelBg);
      labelGroup.add(labelText);
      group.add(labelGroup);
    }

    group.on('mousedown touchstart', (e) => {
      if (e.evt && e.evt.button !== 0 && !e.evt.touches) return;
      if (this.toolMode !== 'select' || this.selectionSubMode === 'box') return;
      e.cancelBubble = true;
      if (!this.selectedObjectIds.includes(symbol.id)) {
        if (e.evt?.shiftKey || this.selectionSubMode === 'multi') {
          this.toggleObjectSelection(symbol.id);
        } else {
          this.selectObject(symbol.id);
        }
      }
    });

    group.on('click tap', (e) => {
      if (e.evt && e.evt.button !== 0 && !e.evt.touches) return;
      if (this.toolMode !== 'select' || this.selectionSubMode === 'box') return;
      e.cancelBubble = true;
      if (this.wasGroupDragged) {
        return;
      }
      if (e.evt.shiftKey || this.selectionSubMode === 'multi') {
        this.toggleObjectSelection(symbol.id);
      } else {
        this.selectObject(symbol.id);
      }
    });

    group.on('dragstart', () => {
      if (!this.selectedObjectIds.includes(symbol.id)) {
        this.selectObject(symbol.id);
      }
      this.onGroupDragStart(symbol.id);
    });

    group.on('dragmove', () => {
      this.onGroupDragMove(symbol.id, { x: group.x(), y: group.y() });
      const pointer = this.stage.getPointerPosition();
      if (!pointer) return;
      const worldRaw = this.camera.screenToWorld(pointer);
      const wallSnap = SnapEngine.findSymbolWallSnap(worldRaw, this.model.getObjects(), 35, true);
      if (wallSnap) {
        group.rotation(wallSnap.angle);
        const lbl = group.findOne('.symbol-label-group') as Konva.Group | undefined;
        if (lbl) {
          lbl.rotation(-wallSnap.angle);
        }
      }
    });

    group.on('dragend', () => {
      if (this.onGroupDragEnd(symbol.id, { x: group.x(), y: group.y() })) {
        return;
      }
      const pointer = this.stage.getPointerPosition();
      if (!pointer) return;
      const worldRaw = this.camera.screenToWorld(pointer);
      const wallSnap = SnapEngine.findSymbolWallSnap(worldRaw, this.model.getObjects(), 35, true);

      this.wasGroupDragged = true;
      if (wallSnap) {
        this.model.updateObject(symbol.id, {
          x: wallSnap.snappedPoint.x,
          y: wallSnap.snappedPoint.y,
          rotation: Math.round(wallSnap.angle),
          wallId: wallSnap.wall.id,
          wallPosition: wallSnap.position,
          wallSide: wallSnap.wallSide,
        });
      } else {
        const dxScreen = group.x() - sPos.x;
        const dyScreen = group.y() - sPos.y;
        this.model.updateObject(symbol.id, {
          x: symbol.x + dxScreen / zoom,
          y: symbol.y + dyScreen / zoom,
          wallId: undefined,
          wallPosition: undefined,
        });
      }
      setTimeout(() => {
        this.wasGroupDragged = false;
      }, 120);
      this.render();
    });

    this.objectsLayer.add(group);
  }

  /**
   * رسم عنصر المسار الهندسي (Route Object - المرحلة 5)
   * يدعم كابلات الكهرباء، مواسير السباكة، دكتات التكييف، وشبكات الحريق
   */
  private renderRoute(
    route: RouteObject,
    isLocked: boolean,
    layerColor: string,
    layerOpacity: number
  ): void {
    if (!route.points || route.points.length < 2) return;

    const isSelected = this.isObjectSelected(route.id);
    const zoom = this.camera.getState().zoom;
    const meta = ROUTE_KINDS_META[route.routeKind];

    // تحويل نقاط المسار من إحداثيات العالم إلى إحداثيات الشاشة
    const screenPoints: number[] = [];
    route.points.forEach((p) => {
      const s = this.camera.worldToScreen(p);
      screenPoints.push(s.x, s.y);
    });

    const group = new Konva.Group({
      id: route.id,
      opacity: layerOpacity,
      draggable: !isLocked && this.toolMode === 'select' && this.selectionSubMode !== 'box',
    });

    const routeColor = isSelected ? '#38bdf8' : (route.color || layerColor || meta?.defaultColor || '#f59e0b');
    const strokeWidth = Math.max(2, (route.strokeWidth || meta?.defaultStrokeWidth || 2.5) * Math.min(1.4, Math.max(0.7, zoom)));

    let dash: number[] | undefined = undefined;
    let lineCap: 'round' | 'square' | 'butt' = 'round';
    if (route.lineStyle === 'dashed') {
      dash = [14, 8];
      lineCap = 'butt';
    } else if (route.lineStyle === 'dotted') {
      dash = [2, 10];
      lineCap = 'round';
    } else if (route.lineStyle === 'solid') {
      dash = undefined;
      lineCap = 'round';
    } else if (meta?.dashPattern) {
      dash = meta.dashPattern;
      lineCap = 'butt';
    }

    // هالة مضيئة عريضة لتسهيل النقر (Hit area) والتحديد
    const hitLine = new Konva.Line({
      points: screenPoints,
      stroke: isSelected ? '#0284c7' : 'transparent',
      strokeWidth: strokeWidth + (isSelected ? 10 : 16),
      lineCap: 'round',
      lineJoin: 'round',
      opacity: isSelected ? 0.25 : 0.001,
    });
    group.add(hitLine);

    // خط المسار الرئيسي
    const mainLine = new Konva.Line({
      points: screenPoints,
      stroke: routeColor,
      strokeWidth,
      dash,
      lineCap,
      lineJoin: 'round',
    });
    group.add(mainLine);

    // نقاط تحكم في الرؤوس (Vertices)
    route.points.forEach((p, idx) => {
      const s = this.camera.worldToScreen(p);
      const isEndpoint = idx === 0 || idx === route.points.length - 1;
      const vertexCircle = new Konva.Circle({
        x: s.x,
        y: s.y,
        radius: isSelected ? 5 : (isEndpoint ? 3.5 : 2.5),
        fill: isSelected ? '#38bdf8' : routeColor,
        stroke: '#0f172a',
        strokeWidth: 1.5,
        draggable: isSelected && !isLocked && this.toolMode === 'select',
      });

      if (isSelected && !isLocked && this.toolMode === 'select') {
        vertexCircle.on('dragmove', () => {
          const newPos = this.camera.screenToWorld({ x: vertexCircle.x(), y: vertexCircle.y() });
          const updatedPoints = [...route.points];
          updatedPoints[idx] = newPos;
          const newScreenPoints: number[] = [];
          updatedPoints.forEach((pt) => {
            const sc = this.camera.worldToScreen(pt);
            newScreenPoints.push(sc.x, sc.y);
          });
          mainLine.points(newScreenPoints);
          hitLine.points(newScreenPoints);
        });

        vertexCircle.on('dragend', () => {
          const newPos = this.camera.screenToWorld({ x: vertexCircle.x(), y: vertexCircle.y() });
          const updatedPoints = [...route.points];
          updatedPoints[idx] = newPos;

          const pixelsPerMeter = this.model.getMeta().scale || 50;
          const pixelLen = calculateRoutePixelLength(updatedPoints);
          const newLenMeters = Number((pixelLen / pixelsPerMeter).toFixed(2));

          this.model.updateObject(route.id, {
            points: updatedPoints,
            lengthCalculated: newLenMeters,
          });
          this.render();
        });
      }

      group.add(vertexCircle);
    });

    // نص الطول والمسمى في منتصف المسار (مع احترام خيار إظهار أو إخفاء طول المسار)
    const midIndex = Math.floor(route.points.length / 2);
    const pA = this.camera.worldToScreen(route.points[Math.max(0, midIndex - 1)]);
    const pB = this.camera.worldToScreen(route.points[midIndex]);
    const labelX = (pA.x + pB.x) / 2;
    const labelY = (pA.y + pB.y) / 2 - 12;

    const pixelsPerMeter = this.model.getMeta().scale || 50;
    const realLen = route.lengthCalculated || calculateRoutePixelLength(route.points) / pixelsPerMeter;
    const shouldShowLength = route.showLength !== false;

    let displayLabel = '';
    if (shouldShowLength) {
      displayLabel = route.label ? `${route.label} (${realLen.toFixed(2)}م)` : `${realLen.toFixed(2)}م`;
    } else if (route.label) {
      displayLabel = route.label;
    }

    if (displayLabel) {
      const labelBadge = new Konva.Label({
        x: labelX,
        y: labelY,
        listening: false,
      });
      labelBadge.add(
        new Konva.Tag({
          fill: '#0f172a',
          stroke: isSelected ? '#38bdf8' : '#334155',
          strokeWidth: 1,
          cornerRadius: 3,
          opacity: 0.9,
        })
      );
      labelBadge.add(
        new Konva.Text({
          text: displayLabel,
          fontSize: Math.max(9, Math.min(11, 10 / Math.sqrt(zoom))),
          fontFamily: 'JetBrains Mono',
          fill: isSelected ? '#38bdf8' : '#e2e8f0',
          padding: 2,
        })
      );
      group.add(labelBadge);
    }

    group.on('mousedown touchstart', (e) => {
      if (e.evt && e.evt.button !== 0 && !e.evt.touches) return;
      if (this.toolMode !== 'select' || this.selectionSubMode === 'box') return;
      e.cancelBubble = true;
      if (!this.selectedObjectIds.includes(route.id)) {
        if (e.evt?.shiftKey || this.selectionSubMode === 'multi') {
          this.toggleObjectSelection(route.id);
        } else {
          this.selectObject(route.id);
        }
      }
    });

    group.on('click tap', (e) => {
      if (e.evt && e.evt.button !== 0 && !e.evt.touches) return;
      if (this.toolMode !== 'select' || this.selectionSubMode === 'box') return;
      e.cancelBubble = true;
      if (this.wasGroupDragged) {
        return;
      }
      if (e.evt.shiftKey || this.selectionSubMode === 'multi') {
        this.toggleObjectSelection(route.id);
      } else {
        this.selectObject(route.id);
      }
    });

    group.on('dragstart', () => {
      if (!this.selectedObjectIds.includes(route.id)) {
        this.selectObject(route.id);
      }
      this.onGroupDragStart(route.id);
    });

    group.on('dragmove', () => {
      this.onGroupDragMove(route.id, { x: group.x(), y: group.y() });
    });

    group.on('dragend', () => {
      if (this.onGroupDragEnd(route.id, { x: group.x(), y: group.y() })) {
        return;
      }
      const dxScreen = group.x();
      const dyScreen = group.y();
      const dxWorld = dxScreen / zoom;
      const dyWorld = dyScreen / zoom;
      group.position({ x: 0, y: 0 });
      if (Math.abs(dxWorld) > 0.01 || Math.abs(dyWorld) > 0.01) {
        this.wasGroupDragged = true;
        this.model.updateObject(route.id, {
          points: route.points.map((p) => ({ x: p.x + dxWorld, y: p.y + dyWorld })),
        });
      }
      setTimeout(() => {
        this.wasGroupDragged = false;
      }, 120);
      this.render();
    });

    this.objectsLayer.add(group);
  }

  /**
   * رسم عنصر الملاحظة والتلميح الهندسي (Text / Annotation Note Object)
   * يعامل معاملة العنصر الكامل: تحديد، سحب، تحريك جماعي، تدوير، تحكم بالألوان وحجم الخط
   * تم حذف أي أعمدة أو خطوط إضافية في نهاية النص لضمان نظافة المخطط الهندسي
   */
  private renderTextObject(
    textObj: TextObject,
    isLocked: boolean,
    fallbackColor: string,
    layerOpacity: number
  ): void {
    const isSelected = this.isObjectSelected(textObj.id);
    const zoom = this.camera.getState().zoom;
    const sPos = this.camera.worldToScreen({ x: textObj.x, y: textObj.y });
    const isDark = this.theme === 'dark';

    // اختيار لون النص: في الوضع النهاري يتم استخدام لون متباين عالي الوضوح (#0f172a / #0284c7)
    let textColor = isSelected ? '#38bdf8' : (textObj.color || fallbackColor || (isDark ? '#38bdf8' : '#0284c7'));
    if (!isDark && !isSelected) {
      if (textColor === '#ffffff' || textColor === '#f8fafc' || textColor === '#f3f4f6') {
        textColor = '#0f172a';
      }
    }

    const fontSize = Math.max(9, Math.round((textObj.fontSize || 16) * zoom));
    const pad = Math.max(4, Math.round((textObj.padding || 6) * zoom));

    const group = new Konva.Group({
      id: textObj.id,
      name: 'text-group',
      x: sPos.x,
      y: sPos.y,
      rotation: textObj.rotation || 0,
      opacity: layerOpacity,
      draggable: !isLocked && this.toolMode === 'select',
    });

    const konvaText = new Konva.Text({
      id: textObj.id,
      name: 'text-node',
      x: pad,
      y: pad,
      text: textObj.text || 'ملاحظة',
      fontSize,
      fontFamily: 'Cairo, sans-serif',
      fontStyle: textObj.fontWeight === 'bold' ? 'bold' : 'normal',
      fill: textColor,
      align: textObj.align || 'center',
      lineHeight: 1.35,
      wrap: 'none',
      listening: true,
    });

    const textWidth = Math.ceil(konvaText.width());
    const textHeight = Math.ceil(konvaText.height());
    const boxW = Math.max(40, textWidth + pad * 2);
    const boxH = Math.max(26, textHeight + pad * 2);

    // إضافة هامش لعرض النص لمنع التفاف أي حرف أو ظهور عامود في نهاية السطر
    konvaText.width(textWidth + 14);

    // بطاقة الملاحظة: دائماً موجودة لضمان التقاط النقر والسحب عبر كامل مساحة النص
    const hasCustomBg = textObj.backgroundColor && textObj.backgroundColor !== 'transparent';
    const bgFill = hasCustomBg
      ? textObj.backgroundColor
      : isDark
      ? 'rgba(15, 23, 42, 0.88)'
      : 'rgba(255, 255, 255, 0.96)';
    const bgOpacity =
      textObj.backgroundOpacity !== undefined
        ? textObj.backgroundOpacity
        : isDark
        ? 0.88
        : 0.96;

    const cardBg = new Konva.Rect({
      id: textObj.id,
      name: 'text-bg',
      x: 0,
      y: 0,
      width: boxW,
      height: boxH,
      fill: bgFill,
      opacity: bgOpacity,
      cornerRadius: 4,
      stroke: isSelected ? (isDark ? '#38bdf8' : '#0284c7') : (isDark ? '#334155' : '#cbd5e1'),
      strokeWidth: isSelected ? 1.5 : 0.8,
      shadowColor: isSelected ? '#38bdf8' : isDark ? '#000000' : '#64748b',
      shadowBlur: isSelected ? 6 : 2,
      shadowOpacity: isSelected ? 0.35 : 0.15,
      listening: true,
    });
    group.add(cardBg);
    group.add(konvaText);

    // إطار وهالة التحديد المنقطة عند اختيار الملاحظة
    if (isSelected) {
      group.add(
        new Konva.Rect({
          x: -3,
          y: -3,
          width: boxW + 6,
          height: boxH + 6,
          stroke: isDark ? '#38bdf8' : '#0284c7',
          strokeWidth: 1.5,
          dash: [4, 4],
          cornerRadius: 6,
          listening: false,
        })
      );
    }

    group.on('mouseenter', () => {
      if (this.toolMode === 'select' && !isLocked) {
        this.stage.container().style.cursor = isSelected ? 'move' : 'pointer';
      }
    });

    group.on('mouseleave', () => {
      this.updateCursor();
    });

    group.on('mousedown touchstart', (e) => {
      if (e.evt && e.evt.button !== 0 && !e.evt.touches) return;
      if (this.toolMode !== 'select' || this.selectionSubMode === 'box') return;
      e.cancelBubble = true;
      if (!this.selectedObjectIds.includes(textObj.id)) {
        if (e.evt?.shiftKey || this.selectionSubMode === 'multi') {
          this.toggleObjectSelection(textObj.id);
        } else {
          this.selectObject(textObj.id);
        }
      }
    });

    group.on('click tap', (e) => {
      if (e.evt && e.evt.button !== 0 && !e.evt.touches) return;
      if (this.toolMode !== 'select' || this.selectionSubMode === 'box') return;
      e.cancelBubble = true;
      if (this.wasGroupDragged) return;
      if (e.evt.shiftKey || this.selectionSubMode === 'multi') {
        this.toggleObjectSelection(textObj.id);
      } else {
        this.selectObject(textObj.id);
      }
    });

    group.on('dblclick dbltap', (e) => {
      e.cancelBubble = true;
      this.selectObject(textObj.id);
      this.setToolMode('select');
    });

    group.on('dragstart', (e) => {
      e.cancelBubble = true;
      this.wasGroupDragged = true;
      this.onGroupDragStart(textObj.id);
    });

    group.on('dragmove', (e) => {
      e.cancelBubble = true;
      this.onGroupDragMove(textObj.id, { x: group.x(), y: group.y() });
    });

    group.on('dragend', (e) => {
      e.cancelBubble = true;
      if (this.onGroupDragEnd(textObj.id, { x: group.x(), y: group.y() })) {
        this.render();
        return;
      }
      const dxScreen = group.x() - sPos.x;
      const dyScreen = group.y() - sPos.y;
      const dxWorld = dxScreen / zoom;
      const dyWorld = dyScreen / zoom;

      group.position({ x: sPos.x, y: sPos.y });

      if (Math.abs(dxWorld) > 0.01 || Math.abs(dyWorld) > 0.01) {
        this.wasGroupDragged = true;
        this.model.updateObject(textObj.id, {
          x: Math.round(textObj.x + dxWorld),
          y: Math.round(textObj.y + dyWorld),
        });
      }
      setTimeout(() => {
        this.wasGroupDragged = false;
      }, 120);
      this.render();
    });

    this.objectsLayer.add(group);
  }

  /**
   * رسم عنصر البُعد الهندسي (Dimension) وفق معايير المخططات الهندسية المعمارية
   */
  private renderDimension(dim: DimensionObject, isLocked: boolean): void {
    const isSelected = this.isObjectSelected(dim.id);
    const zoom = this.camera.getState().zoom;
    const meta = this.model.getMeta();
    const pixelsPerMeter = meta.scale || 50;

    const sScreen = this.camera.worldToScreen(dim.start);
    const eScreen = this.camera.worldToScreen(dim.end);

    const dx = eScreen.x - sScreen.x;
    const dy = eScreen.y - sScreen.y;
    const screenLen = Math.sqrt(dx * dx + dy * dy);
    if (screenLen === 0) return;

    const ux = dx / screenLen;
    const uy = dy / screenLen;
    const nx = -uy;
    const ny = ux;

    const offsetScreen = (dim.offset || 20) * zoom;

    // خط البعد الرئيسي المزاح
    const p1 = { x: sScreen.x + nx * offsetScreen, y: sScreen.y + ny * offsetScreen };
    const p2 = { x: eScreen.x + nx * offsetScreen, y: eScreen.y + ny * offsetScreen };

    const group = new Konva.Group({
      id: dim.id,
      draggable: !isLocked && this.toolMode === 'select' && this.selectionSubMode !== 'box',
    });

    const isDark = this.theme === 'dark';
    const dimColor = isSelected ? (isDark ? '#38bdf8' : '#0284c7') : (isDark ? '#38bdf8' : '#0284c7');
    const dimBgColor = isDark ? '#0f172a' : '#ffffff';
    const dimTextColor = isSelected ? (isDark ? '#38bdf8' : '#0284c7') : (isDark ? '#ffffff' : '#0f172a');
    const witnessColor = isDark ? '#475569' : '#64748b';

    // 1. خطوط الامتداد (Witness lines / Extension lines)
    group.add(
      new Konva.Line({
        points: [
          sScreen.x,
          sScreen.y,
          p1.x + nx * 5,
          p1.y + ny * 5,
        ],
        stroke: witnessColor,
        strokeWidth: 1,
        dash: [2, 2],
      })
    );
    group.add(
      new Konva.Line({
        points: [
          eScreen.x,
          eScreen.y,
          p2.x + nx * 5,
          p2.y + ny * 5,
        ],
        stroke: witnessColor,
        strokeWidth: 1,
        dash: [2, 2],
      })
    );

    // 2. خط البعد الرئيسي
    group.add(
      new Konva.Line({
        points: [p1.x, p1.y, p2.x, p2.y],
        stroke: dimColor,
        strokeWidth: 1.5,
      })
    );

    // 3. علامات الأطراف الهندسية المعمارية (Architectural 45° Ticks)
    const tickLen = 6;
    group.add(
      new Konva.Line({
        points: [
          p1.x - (ux - nx) * tickLen,
          p1.y - (uy - ny) * tickLen,
          p1.x + (ux - nx) * tickLen,
          p1.y + (uy - ny) * tickLen,
        ],
        stroke: dimColor,
        strokeWidth: 2,
      })
    );
    group.add(
      new Konva.Line({
        points: [
          p2.x - (ux - nx) * tickLen,
          p2.y - (uy - ny) * tickLen,
          p2.x + (ux - nx) * tickLen,
          p2.y + (uy - ny) * tickLen,
        ],
        stroke: dimColor,
        strokeWidth: 2,
      })
    );

    // 4. كتابة البعد الهندسي الحقيقي
    const lengthWorld = SnapEngine.distance(dim.start, dim.end);
    const displayText =
      dim.displayText || GridUtils.formatLength(lengthWorld, pixelsPerMeter, meta.unit);

    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    const readableAngle = angleDeg > 90 || angleDeg < -90 ? angleDeg + 180 : angleDeg;

    const textBadge = new Konva.Group({
      x: midX,
      y: midY,
      rotation: readableAngle,
    });

    const finalLabel = dim.label ? `${dim.label}: ${displayText}` : displayText;

    const dimText = new Konva.Text({
      text: finalLabel,
      fontSize: 11,
      fontFamily: 'JetBrains Mono',
      fill: dimTextColor,
      padding: 2,
      align: 'center',
    });

    const dimBg = new Konva.Rect({
      width: dimText.width() + 6,
      height: dimText.height() + 2,
      fill: dimBgColor,
      stroke: dimColor,
      strokeWidth: 0.8,
      cornerRadius: 3,
      offsetX: (dimText.width() + 6) / 2,
      offsetY: (dimText.height() + 2) / 2,
    });

    dimText.offsetX(dimText.width() / 2);
    dimText.offsetY(dimText.height() / 2);

    textBadge.add(dimBg);
    textBadge.add(dimText);
    group.add(textBadge);

    // هالة التحديد
    if (isSelected) {
      group.add(
        new Konva.Line({
          points: [p1.x, p1.y, p2.x, p2.y],
          stroke: '#38bdf8',
          strokeWidth: 10,
          opacity: 0.25,
          lineCap: 'round',
        })
      );
    }

    group.on('mousedown touchstart', (e) => {
      if (e.evt && e.evt.button !== 0 && !e.evt.touches) return;
      if (this.toolMode !== 'select' || this.selectionSubMode === 'box') return;
      e.cancelBubble = true;
      if (!this.selectedObjectIds.includes(dim.id)) {
        if (e.evt?.shiftKey || this.selectionSubMode === 'multi') {
          this.toggleObjectSelection(dim.id);
        } else {
          this.selectObject(dim.id);
        }
      }
    });

    group.on('click tap', (e) => {
      if (e.evt && e.evt.button !== 0 && !e.evt.touches) return;
      if (this.toolMode !== 'select' || this.selectionSubMode === 'box') return;
      e.cancelBubble = true;
      if (this.wasGroupDragged) {
        return;
      }
      if (e.evt.shiftKey || this.selectionSubMode === 'multi') {
        this.toggleObjectSelection(dim.id);
      } else {
        this.selectObject(dim.id);
      }
    });

    group.on('dragstart', () => {
      this.onGroupDragStart(dim.id);
    });

    group.on('dragmove', () => {
      this.onGroupDragMove(dim.id, { x: group.x(), y: group.y() });
    });

    group.on('dragend', () => {
      if (this.onGroupDragEnd(dim.id, { x: group.x(), y: group.y() })) {
        return;
      }
      const dxScreen = group.x();
      const dyScreen = group.y();
      const dxWorld = dxScreen / zoom;
      const dyWorld = dyScreen / zoom;

      group.position({ x: 0, y: 0 });

      if (Math.abs(dxWorld) > 0.01 || Math.abs(dyWorld) > 0.01) {
        this.wasGroupDragged = true;
        this.model.updateObject(dim.id, {
          start: { x: dim.start.x + dxWorld, y: dim.start.y + dyWorld },
          end: { x: dim.end.x + dxWorld, y: dim.end.y + dyWorld },
        });
      }
      setTimeout(() => {
        this.wasGroupDragged = false;
      }, 120);
    });

    this.objectsLayer.add(group);
  }

  /**
   * رسم عنصر الباب على الجدار
   */
  private renderDoor(door: DoorObject, wall: WallObject, isLocked: boolean): void {
    const isSelected = this.isObjectSelected(door.id);
    const zoom = this.camera.getState().zoom;

    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const wallLen = Math.sqrt(dx * dx + dy * dy);
    if (wallLen === 0) return;

    const ux = dx / wallLen;
    const uy = dy / wallLen;
    const nx = -uy;
    const ny = ux;

    const cx = wall.start.x + door.position * dx;
    const cy = wall.start.y + door.position * dy;
    const halfW = door.width / 2;

    const p1 = { x: cx - halfW * ux, y: cy - halfW * uy };
    const p2 = { x: cx + halfW * ux, y: cy + halfW * uy };

    const sP1 = this.camera.worldToScreen(p1);
    const sP2 = this.camera.worldToScreen(p2);
    const screenThickness = Math.max(2, wall.thickness * zoom);
    const screenDoorWidth = door.width * zoom;
    const sOldMid = this.camera.worldToScreen({ x: cx, y: cy });
    let pendingDoorPos = door.position;

    const group = new Konva.Group({
      id: door.id,
      draggable: !isLocked && this.toolMode === 'select' && this.selectionSubMode !== 'box',
      dragBoundFunc: (pos) => {
        const pointer = this.stage.getPointerPosition() || pos;
        const worldRaw = this.camera.screenToWorld(pointer);
        const apx = worldRaw.x - wall.start.x;
        const apy = worldRaw.y - wall.start.y;
        const wallLenSq = dx * dx + dy * dy;
        if (wallLenSq === 0) return { x: 0, y: 0 };
        const t = (apx * dx + apy * dy) / wallLenSq;
        const wallLen = Math.sqrt(wallLenSq);
        const margin = door.width > 0 && wallLen > door.width ? (door.width / 2) / wallLen : 0.05;
        const clampedT = Math.max(margin, Math.min(1 - margin, t));
        pendingDoorPos = clampedT;
        const newCx = wall.start.x + clampedT * dx;
        const newCy = wall.start.y + clampedT * dy;
        const sNewMid = this.camera.worldToScreen({ x: newCx, y: newCy });
        return {
          x: sNewMid.x - sOldMid.x,
          y: sNewMid.y - sOldMid.y,
        };
      },
    });

    const isDark = this.theme === 'dark';
    const cutoutColor = isDark ? '#1e1e1e' : '#f7f7f7';
    const jambColor = isDark ? '#64748b' : '#334155';
    const leafColor = isSelected ? (isDark ? '#38bdf8' : '#0284c7') : (isDark ? '#f59e0b' : '#b45309');
    const arcColor = isSelected ? (isDark ? '#38bdf8' : '#0284c7') : (isDark ? '#d97706' : '#b45309');

    // 1. فتحة الجدار (Cutout)
    group.add(
      new Konva.Line({
        points: [sP1.x, sP1.y, sP2.x, sP2.y],
        stroke: cutoutColor,
        strokeWidth: screenThickness + 1,
        lineCap: 'square',
      })
    );

    // 2. حلق الباب (Jambs)
    const sNormX = nx * (screenThickness / 2);
    const sNormY = ny * (screenThickness / 2);

    group.add(
      new Konva.Line({
        points: [sP1.x - sNormX, sP1.y - sNormY, sP1.x + sNormX, sP1.y + sNormY],
        stroke: jambColor,
        strokeWidth: 2,
      })
    );
    group.add(
      new Konva.Line({
        points: [sP2.x - sNormX, sP2.y - sNormY, sP2.x + sNormX, sP2.y + sNormY],
        stroke: jambColor,
        strokeWidth: 2,
      })
    );

    // 3. تحديد اتجاه ومفصلة الفتح
    const isInward = door.openDirection.startsWith('inward');
    const isRight = door.openDirection.endsWith('right');
    const dirN = isInward ? 1 : -1;

    const hingeWorld = isRight ? p1 : p2;
    const sHinge = this.camera.worldToScreen(hingeWorld);

    const wallAngleRad = Math.atan2(uy, ux);
    const leafEndWorld: Point = {
      x: hingeWorld.x + dirN * door.width * nx,
      y: hingeWorld.y + dirN * door.width * ny,
    };
    const sLeafEnd = this.camera.worldToScreen(leafEndWorld);

    if (isSelected) {
      group.add(
        new Konva.Circle({
          x: sHinge.x,
          y: sHinge.y,
          radius: screenDoorWidth + 6,
          stroke: '#38bdf8',
          strokeWidth: 2,
          opacity: 0.3,
          dash: [4, 4],
        })
      );
    }

    group.add(
      new Konva.Line({
        points: [sHinge.x, sHinge.y, sLeafEnd.x, sLeafEnd.y],
        stroke: leafColor,
        strokeWidth: 2.5,
        lineCap: 'round',
      })
    );

    const startAngleDeg = (wallAngleRad * 180) / Math.PI;
    const arcRotation = isRight
      ? isInward
        ? startAngleDeg
        : startAngleDeg - 90
      : isInward
      ? startAngleDeg + 90
      : startAngleDeg + 180;

    const swingArc = new Konva.Arc({
      x: sHinge.x,
      y: sHinge.y,
      innerRadius: screenDoorWidth,
      outerRadius: screenDoorWidth,
      angle: 90,
      rotation: arcRotation,
      stroke: arcColor,
      strokeWidth: 1.2,
      dash: [3, 3],
    });
    group.add(swingArc);

    group.add(
      new Konva.Circle({
        x: sHinge.x,
        y: sHinge.y,
        radius: 3.5,
        fill: isSelected ? '#38bdf8' : '#f59e0b',
      })
    );

    if (door.label) {
      const sMid = this.camera.worldToScreen({ x: cx, y: cy });
      const labelText = new Konva.Text({
        x: sMid.x,
        y: sMid.y - screenThickness / 2 - 14,
        text: door.label,
        fontSize: Math.max(9, Math.min(13, 10 * Math.sqrt(zoom))),
        fontFamily: 'Cairo, sans-serif',
        fontStyle: 'bold',
        fill: isSelected ? '#38bdf8' : '#fbbf24',
        align: 'center',
        offsetX: 15,
      });
      group.add(labelText);
    }

    group.on('mousedown touchstart', (e) => {
      if (e.evt && e.evt.button !== 0 && !e.evt.touches) return;
      if (this.toolMode !== 'select' || this.selectionSubMode === 'box') return;
      e.cancelBubble = true;
      if (!this.selectedObjectIds.includes(door.id)) {
        if (e.evt?.shiftKey || this.selectionSubMode === 'multi') {
          this.toggleObjectSelection(door.id);
        } else {
          this.selectObject(door.id);
        }
      }
    });

    group.on('click tap', (e) => {
      if (e.evt && e.evt.button !== 0 && !e.evt.touches) return;
      if (this.toolMode !== 'select' || this.selectionSubMode === 'box') return;
      e.cancelBubble = true;
      if (this.wasGroupDragged) {
        return;
      }
      if (e.evt.shiftKey || this.selectionSubMode === 'multi') {
        this.toggleObjectSelection(door.id);
      } else {
        this.selectObject(door.id);
      }
    });

    group.on('dragmove', () => {
      this.wasGroupDragged = true;
    });

    group.on('dragend', () => {
      group.position({ x: 0, y: 0 });
      this.model.updateObject(door.id, { position: pendingDoorPos }, true);
      setTimeout(() => {
        this.wasGroupDragged = false;
      }, 120);
      this.render();
    });

    this.objectsLayer.add(group);
  }

  /**
   * رسم عنصر النافذة على الجدار
   */
  private renderWindow(win: WindowObject, wall: WallObject, isLocked: boolean): void {
    const isSelected = this.isObjectSelected(win.id);
    const zoom = this.camera.getState().zoom;

    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const wallLen = Math.sqrt(dx * dx + dy * dy);
    if (wallLen === 0) return;

    const ux = dx / wallLen;
    const uy = dy / wallLen;
    const nx = -uy;
    const ny = ux;

    const cx = wall.start.x + win.position * dx;
    const cy = wall.start.y + win.position * dy;
    const halfW = win.width / 2;

    const p1 = { x: cx - halfW * ux, y: cy - halfW * uy };
    const p2 = { x: cx + halfW * ux, y: cy + halfW * uy };

    const sP1 = this.camera.worldToScreen(p1);
    const sP2 = this.camera.worldToScreen(p2);
    const screenThickness = Math.max(2, wall.thickness * zoom);
    const sOldMid = this.camera.worldToScreen({ x: cx, y: cy });
    let pendingWinPos = win.position;

    const group = new Konva.Group({
      id: win.id,
      draggable: !isLocked && this.toolMode === 'select' && this.selectionSubMode !== 'box',
      dragBoundFunc: (pos) => {
        const pointer = this.stage.getPointerPosition() || pos;
        const worldRaw = this.camera.screenToWorld(pointer);
        const apx = worldRaw.x - wall.start.x;
        const apy = worldRaw.y - wall.start.y;
        const wallLenSq = dx * dx + dy * dy;
        if (wallLenSq === 0) return { x: 0, y: 0 };
        const t = (apx * dx + apy * dy) / wallLenSq;
        const margin = win.width > 0 && wallLen > win.width ? (win.width / 2) / wallLen : 0.05;
        const clampedT = Math.max(margin, Math.min(1 - margin, t));
        pendingWinPos = clampedT;
        const newCx = wall.start.x + clampedT * dx;
        const newCy = wall.start.y + clampedT * dy;
        const sNewMid = this.camera.worldToScreen({ x: newCx, y: newCy });
        return {
          x: sNewMid.x - sOldMid.x,
          y: sNewMid.y - sOldMid.y,
        };
      },
    });

    const isDark = this.theme === 'dark';
    const cutoutColor = isDark ? '#1e1e1e' : '#f7f7f7';
    const jambColor = isDark ? '#64748b' : '#334155';
    const glassColor = isSelected ? (isDark ? '#38bdf8' : '#0284c7') : (isDark ? '#38bdf8' : '#0284c7');
    const sillColor = isDark ? '#94a3b8' : '#475569';

    // 1. فتحة الجدار
    group.add(
      new Konva.Line({
        points: [sP1.x, sP1.y, sP2.x, sP2.y],
        stroke: cutoutColor,
        strokeWidth: screenThickness + 1,
        lineCap: 'square',
      })
    );

    // 2. حلقي النافذة
    const sNormX = nx * (screenThickness / 2);
    const sNormY = ny * (screenThickness / 2);

    group.add(
      new Konva.Line({
        points: [sP1.x - sNormX, sP1.y - sNormY, sP1.x + sNormX, sP1.y + sNormY],
        stroke: jambColor,
        strokeWidth: 2,
      })
    );
    group.add(
      new Konva.Line({
        points: [sP2.x - sNormX, sP2.y - sNormY, sP2.x + sNormX, sP2.y + sNormY],
        stroke: jambColor,
        strokeWidth: 2,
      })
    );

    // 3. خطوط الزجاج المزدوجة
    const glassOffset = Math.max(1.5, screenThickness * 0.15);
    const sGlassNormX = nx * glassOffset;
    const sGlassNormY = ny * glassOffset;

    group.add(
      new Konva.Line({
        points: [
          sP1.x - sGlassNormX,
          sP1.y - sGlassNormY,
          sP2.x - sGlassNormX,
          sP2.y - sGlassNormY,
        ],
        stroke: glassColor,
        strokeWidth: 1.5,
      })
    );
    group.add(
      new Konva.Line({
        points: [
          sP1.x + sGlassNormX,
          sP1.y + sGlassNormY,
          sP2.x + sGlassNormX,
          sP2.y + sGlassNormY,
        ],
        stroke: glassColor,
        strokeWidth: 1.5,
      })
    );

    // 4. خط جلسة النافذة الخارجي (Sill)
    const sillNormX = nx * (screenThickness / 2 + 3);
    const sillNormY = ny * (screenThickness / 2 + 3);
    const sillP1 = { x: sP1.x + sillNormX, y: sP1.y + sillNormY };
    const sillP2 = { x: sP2.x + sillNormX, y: sP2.y + sillNormY };

    group.add(
      new Konva.Line({
        points: [sillP1.x, sillP1.y, sillP2.x, sillP2.y],
        stroke: sillColor,
        strokeWidth: 1.5,
      })
    );

    if (isSelected) {
      group.add(
        new Konva.Line({
          points: [sP1.x, sP1.y, sP2.x, sP2.y],
          stroke: isDark ? '#38bdf8' : '#0284c7',
          strokeWidth: screenThickness + 8,
          opacity: 0.3,
          lineCap: 'round',
        })
      );
    }

    if (win.label) {
      const sMid = this.camera.worldToScreen({ x: cx, y: cy });
      const labelText = new Konva.Text({
        x: sMid.x,
        y: sMid.y - screenThickness / 2 - 14,
        text: win.label,
        fontSize: Math.max(9, Math.min(13, 10 * Math.sqrt(zoom))),
        fontFamily: 'Cairo, sans-serif',
        fontStyle: 'bold',
        fill: isSelected ? (isDark ? '#38bdf8' : '#0284c7') : (isDark ? '#2dd4bf' : '#0f766e'),
        align: 'center',
        offsetX: 15,
      });
      group.add(labelText);
    }

    group.on('mousedown touchstart', (e) => {
      if (e.evt && e.evt.button !== 0 && !e.evt.touches) return;
      if (this.toolMode !== 'select' || this.selectionSubMode === 'box') return;
      e.cancelBubble = true;
      if (!this.selectedObjectIds.includes(win.id)) {
        if (e.evt?.shiftKey || this.selectionSubMode === 'multi') {
          this.toggleObjectSelection(win.id);
        } else {
          this.selectObject(win.id);
        }
      }
    });

    group.on('click tap', (e) => {
      if (e.evt && e.evt.button !== 0 && !e.evt.touches) return;
      if (this.toolMode !== 'select' || this.selectionSubMode === 'box') return;
      e.cancelBubble = true;
      if (this.wasGroupDragged) {
        return;
      }
      if (e.evt.shiftKey || this.selectionSubMode === 'multi') {
        this.toggleObjectSelection(win.id);
      } else {
        this.selectObject(win.id);
      }
    });

    group.on('dragmove', () => {
      this.wasGroupDragged = true;
    });

    group.on('dragend', () => {
      group.position({ x: 0, y: 0 });
      this.model.updateObject(win.id, { position: pendingWinPos }, true);
      setTimeout(() => {
        this.wasGroupDragged = false;
      }, 120);
      this.render();
    });

    this.objectsLayer.add(group);
  }

  /**
   * رسم مقابض السحب لنقاط بداية ونهاية الجدار المحدد (Edit Wall Endpoints)
   * مع مؤشر (+) واضح لإطالة الجدار والحفاظ على الزاوية الحالية عند الضغط على SHIFT
   */
  private renderWallHandles(wall: WallObject): void {
    const sScreen = this.camera.worldToScreen(wall.start);
    const eScreen = this.camera.worldToScreen(wall.end);

    // 1. مقبض نقطة البداية (مع مؤشر + واضح جداً)
    const handleStart = new Konva.Group({
      x: sScreen.x,
      y: sScreen.y,
      draggable: true,
      name: 'wall-handle-start',
    });

    handleStart.add(
      new Konva.Circle({
        radius: 8.5,
        fill: '#ffffff',
        stroke: '#0284c7',
        strokeWidth: 2.5,
        shadowColor: '#0284c7',
        shadowBlur: 6,
        shadowOpacity: 0.8,
        hitStrokeWidth: 26,
      })
    );

    // خطوط مؤشر (+) داخل المقبض
    handleStart.add(
      new Konva.Line({
        points: [-4.5, 0, 4.5, 0],
        stroke: '#0284c7',
        strokeWidth: 2,
        lineCap: 'round',
        listening: false,
      })
    );
    handleStart.add(
      new Konva.Line({
        points: [0, -4.5, 0, 4.5],
        stroke: '#0284c7',
        strokeWidth: 2,
        lineCap: 'round',
        listening: false,
      })
    );

    handleStart.on('mouseenter', () => {
      this.stage.container().style.cursor = 'crosshair';
    });
    handleStart.on('mouseleave', () => {
      this.updateCursor();
    });

    handleStart.on('dragstart', (e) => {
      e.cancelBubble = true;
      this.wasGroupDragged = true;
    });

    handleStart.on('dragmove', (e) => {
      e.cancelBubble = true;
      const screenPos = { x: handleStart.x(), y: handleStart.y() };
      const rawWorld = this.camera.screenToWorld(screenPos);
      let snap = SnapEngine.findSnapPoint(
        rawWorld,
        this.model.getObjects(),
        this.getEffectiveSnapOptions(),
        wall.id
      );

      // فحص الزاوية القطبية نسبة لنقطة نهاية الجدار الثابتة (wall.end)
      const polar = SnapEngine.getPolarAngleSnap(
        wall.end,
        snap.point,
        [0, 45, 90, 135, 180, 225, 270, 315, 360],
        e.evt?.shiftKey || this.isShiftKeyPressed ? 25 : 5.0
      );

      const isObjectSnap = snap.snapped && snap.type !== 'grid';
      if ((!isObjectSnap && polar.isSnapped) || e.evt?.shiftKey || this.isShiftKeyPressed) {
        snap = { ...snap, point: polar.point };
      }

      this.currentSnapResult = snap;

      // تفعيل خط الزاوية الإرشادي وقوس الزاوية أثناء التعديل
      this.interactionLayer.destroyChildren();
      this.renderAngleGuideline(
        wall.end,
        snap.point,
        polar.angleDegrees,
        polar.isSnapped,
        'تعديل جدار'
      );
      this.renderSnapIndicatorOnly();

      // تحديث خطوط الجدار مؤقتاً في الكانفس لتقديم معاينة فورية سلسة
      const wallGroup = this.objectsLayer.findOne('#' + wall.id) as Konva.Group | undefined;
      if (wallGroup) {
        const lines = wallGroup.find('Line');
        const liveEnd = this.camera.worldToScreen(wall.end);
        lines.forEach((line) => {
          (line as Konva.Line).points([handleStart.x(), handleStart.y(), liveEnd.x, liveEnd.y]);
        });
      }
    });

    handleStart.on('dragend', (e) => {
      e.cancelBubble = true;
      this.interactionLayer.destroyChildren();
      const screenPos = { x: handleStart.x(), y: handleStart.y() };
      const rawWorld = this.camera.screenToWorld(screenPos);
      let snap = SnapEngine.findSnapPoint(
        rawWorld,
        this.model.getObjects(),
        this.getEffectiveSnapOptions(),
        wall.id
      );

      const polar = SnapEngine.getPolarAngleSnap(
        wall.end,
        snap.point,
        [0, 45, 90, 135, 180, 225, 270, 315, 360],
        e.evt?.shiftKey || this.isShiftKeyPressed ? 25 : 5.0
      );
      const isObjectSnap = snap.snapped && snap.type !== 'grid';
      if ((!isObjectSnap && polar.isSnapped) || e.evt?.shiftKey || this.isShiftKeyPressed) {
        snap = { ...snap, point: polar.point };
      }

      this.wasGroupDragged = true;
      this.model.updateObject(wall.id, { start: snap.point });
      setTimeout(() => {
        this.wasGroupDragged = false;
      }, 120);
      this.render();
    });

    // 2. مقبض نقطة النهاية (مع مؤشر + واضح جداً)
    const handleEnd = new Konva.Group({
      x: eScreen.x,
      y: eScreen.y,
      draggable: true,
      name: 'wall-handle-end',
    });

    handleEnd.add(
      new Konva.Circle({
        radius: 8.5,
        fill: '#ffffff',
        stroke: '#0284c7',
        strokeWidth: 2.5,
        shadowColor: '#0284c7',
        shadowBlur: 6,
        shadowOpacity: 0.8,
        hitStrokeWidth: 26,
      })
    );

    // خطوط مؤشر (+) داخل المقبض
    handleEnd.add(
      new Konva.Line({
        points: [-4.5, 0, 4.5, 0],
        stroke: '#0284c7',
        strokeWidth: 2,
        lineCap: 'round',
        listening: false,
      })
    );
    handleEnd.add(
      new Konva.Line({
        points: [0, -4.5, 0, 4.5],
        stroke: '#0284c7',
        strokeWidth: 2,
        lineCap: 'round',
        listening: false,
      })
    );

    handleEnd.on('mouseenter', () => {
      this.stage.container().style.cursor = 'crosshair';
    });
    handleEnd.on('mouseleave', () => {
      this.updateCursor();
    });

    handleEnd.on('dragstart', (e) => {
      e.cancelBubble = true;
      this.wasGroupDragged = true;
    });

    handleEnd.on('dragmove', (e) => {
      e.cancelBubble = true;
      const screenPos = { x: handleEnd.x(), y: handleEnd.y() };
      const rawWorld = this.camera.screenToWorld(screenPos);
      let snap = SnapEngine.findSnapPoint(
        rawWorld,
        this.model.getObjects(),
        this.getEffectiveSnapOptions(),
        wall.id
      );

      // فحص الزاوية القطبية نسبة لنقطة بداية الجدار الثابتة (wall.start)
      const polar = SnapEngine.getPolarAngleSnap(
        wall.start,
        snap.point,
        [0, 45, 90, 135, 180, 225, 270, 315, 360],
        e.evt?.shiftKey || this.isShiftKeyPressed ? 25 : 5.0
      );

      const isObjectSnap = snap.snapped && snap.type !== 'grid';
      if ((!isObjectSnap && polar.isSnapped) || e.evt?.shiftKey || this.isShiftKeyPressed) {
        snap = { ...snap, point: polar.point };
      }

      this.currentSnapResult = snap;

      // تفعيل خط الزاوية الإرشادي وقوس الزاوية أثناء التعديل
      this.interactionLayer.destroyChildren();
      this.renderAngleGuideline(
        wall.start,
        snap.point,
        polar.angleDegrees,
        polar.isSnapped,
        'تعديل جدار'
      );
      this.renderSnapIndicatorOnly();

      // تحديث خطوط الجدار مؤقتاً في الكانفس لتقديم معاينة فورية سلسة
      const wallGroup = this.objectsLayer.findOne('#' + wall.id) as Konva.Group | undefined;
      if (wallGroup) {
        const lines = wallGroup.find('Line');
        const liveStart = this.camera.worldToScreen(wall.start);
        lines.forEach((line) => {
          (line as Konva.Line).points([liveStart.x, liveStart.y, handleEnd.x(), handleEnd.y()]);
        });
      }
    });

    handleEnd.on('dragend', (e) => {
      e.cancelBubble = true;
      this.interactionLayer.destroyChildren();
      const screenPos = { x: handleEnd.x(), y: handleEnd.y() };
      const rawWorld = this.camera.screenToWorld(screenPos);
      let snap = SnapEngine.findSnapPoint(
        rawWorld,
        this.model.getObjects(),
        this.getEffectiveSnapOptions(),
        wall.id
      );

      const polar = SnapEngine.getPolarAngleSnap(
        wall.start,
        snap.point,
        [0, 45, 90, 135, 180, 225, 270, 315, 360],
        e.evt?.shiftKey || this.isShiftKeyPressed ? 25 : 5.0
      );
      const isObjectSnap = snap.snapped && snap.type !== 'grid';
      if ((!isObjectSnap && polar.isSnapped) || e.evt?.shiftKey || this.isShiftKeyPressed) {
        snap = { ...snap, point: polar.point };
      }

      this.wasGroupDragged = true;
      this.model.updateObject(wall.id, { end: snap.point });
      setTimeout(() => {
        this.wasGroupDragged = false;
      }, 120);
      this.render();
    });

    this.objectsLayer.add(handleStart);
    this.objectsLayer.add(handleEnd);
  }

  /**
   * رسم طبقة التفاعل المؤقتة (المعاينة الحية لجميع الأدوات النشطة)
   */
  private renderInteractionLayer(shiftKey: boolean = false): void {
    this.interactionLayer.destroyChildren();
    this.interactionLayer.position({ x: 0, y: 0 });
    this.interactionLayer.scale({ x: 1, y: 1 });

    const zoom = this.camera.getState().zoom;
    const meta = this.model.getMeta();
    const pixelsPerMeter = meta.scale || 50;

    // 1. معاينة رسم الجدار أثناء السحب (مع خط الزاوية الإرشادي وبادج الزاوية المباشر)
    if (this.isDrawingWall && this.wallStartPoint) {
      let endWorld = this.currentSnapResult.point;

      // حساب الالتقاط الزاوي القطبي (0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°)
      const polar = SnapEngine.getPolarAngleSnap(
        this.wallStartPoint,
        endWorld,
        [0, 45, 90, 135, 180, 225, 270, 315, 360],
        shiftKey || this.isShiftKeyPressed ? 25 : 5.0
      );

      const isObjectSnap = this.currentSnapResult.snapped && this.currentSnapResult.type !== 'grid';
      if ((!isObjectSnap && polar.isSnapped) || shiftKey || this.isShiftKeyPressed) {
        endWorld = polar.point;
      }

      // تفعيل خط الزاوية الإرشادي وقوس الزاوية
      this.renderAngleGuideline(
        this.wallStartPoint,
        endWorld,
        polar.angleDegrees,
        polar.isSnapped
      );

      const sScreen = this.camera.worldToScreen(this.wallStartPoint);
      const eScreen = this.camera.worldToScreen(endWorld);
      const currentThickness = getLastUsedSettings().wallThickness || 20;
      const thickness = currentThickness * zoom;

      this.interactionLayer.add(
        new Konva.Line({
          points: [sScreen.x, sScreen.y, eScreen.x, eScreen.y],
          stroke: '#38bdf8',
          strokeWidth: thickness,
          lineCap: 'square',
          opacity: 0.6,
          dash: [8, 4],
        })
      );

      this.interactionLayer.add(
        new Konva.Line({
          points: [sScreen.x, sScreen.y, eScreen.x, eScreen.y],
          stroke: '#0284c7',
          strokeWidth: 1.5,
        })
      );

      const dist = SnapEngine.distance(this.wallStartPoint, endWorld);
      const lengthStr = GridUtils.formatLength(dist, pixelsPerMeter, meta.unit);

      const dx = eScreen.x - sScreen.x;
      const dy = eScreen.y - sScreen.y;
      const wallLen = Math.sqrt(dx * dx + dy * dy);

      let badgeX = (sScreen.x + eScreen.x) / 2;
      let badgeY = (sScreen.y + eScreen.y) / 2 - thickness - 16;

      if (wallLen > 0) {
        let nx = -dy / wallLen;
        let ny = dx / wallLen;
        if (ny > 0.001 || (Math.abs(ny) <= 0.001 && nx > 0)) {
          nx = -nx;
          ny = -ny;
        }
        badgeX = (sScreen.x + eScreen.x) / 2 + nx * (thickness / 2 + 18);
        badgeY = (sScreen.y + eScreen.y) / 2 + ny * (thickness / 2 + 18);
      }

      this.renderFloatingBadge(
        badgeX,
        badgeY,
        `${lengthStr} (${polar.angleDegrees.toFixed(1)}°)`,
        '#0f172a',
        '#38bdf8'
      );
    }

    // 2. معاينة رسم البُعد الهندسي (Dimension Tool مع خط الزاوية الإرشادي)
    if (this.isDrawingDimension && this.dimensionStartPoint) {
      let endWorld = this.currentSnapResult.point;
      const polar = SnapEngine.getPolarAngleSnap(
        this.dimensionStartPoint,
        endWorld,
        [0, 45, 90, 135, 180, 225, 270, 315, 360],
        shiftKey || this.isShiftKeyPressed ? 25 : 5.0
      );

      const isObjectSnap = this.currentSnapResult.snapped && this.currentSnapResult.type !== 'grid';
      if ((!isObjectSnap && polar.isSnapped) || shiftKey || this.isShiftKeyPressed) {
        endWorld = polar.point;
      }

      this.renderAngleGuideline(
        this.dimensionStartPoint,
        endWorld,
        polar.angleDegrees,
        polar.isSnapped
      );

      const sScreen = this.camera.worldToScreen(this.dimensionStartPoint);
      const eScreen = this.camera.worldToScreen(endWorld);

      this.interactionLayer.add(
        new Konva.Line({
          points: [sScreen.x, sScreen.y, eScreen.x, eScreen.y],
          stroke: '#38bdf8',
          strokeWidth: 1.5,
          dash: [4, 4],
        })
      );

      const dist = SnapEngine.distance(this.dimensionStartPoint, endWorld);
      const lengthStr = GridUtils.formatLength(dist, pixelsPerMeter, meta.unit);

      this.renderFloatingBadge(
        (sScreen.x + eScreen.x) / 2,
        (sScreen.y + eScreen.y) / 2 - 20,
        `📐 ${lengthStr} (${polar.angleDegrees.toFixed(1)}°)`,
        '#0f172a',
        '#38bdf8'
      );
    }

    // 3. معاينة شريط القياس السريع (Measure Tape مع خط الزاوية الإرشادي)
    if (this.isMeasuring && this.measureStartPoint) {
      let endWorld = this.currentSnapResult.point;
      const polar = SnapEngine.getPolarAngleSnap(
        this.measureStartPoint,
        endWorld,
        [0, 45, 90, 135, 180, 225, 270, 315, 360],
        shiftKey || this.isShiftKeyPressed ? 25 : 5.0
      );

      const isObjectSnap = this.currentSnapResult.snapped && this.currentSnapResult.type !== 'grid';
      if ((!isObjectSnap && polar.isSnapped) || shiftKey || this.isShiftKeyPressed) {
        endWorld = polar.point;
      }

      this.renderAngleGuideline(
        this.measureStartPoint,
        endWorld,
        polar.angleDegrees,
        polar.isSnapped,
        'قياس'
      );

      const sScreen = this.camera.worldToScreen(this.measureStartPoint);
      const eScreen = this.camera.worldToScreen(endWorld);

      this.interactionLayer.add(
        new Konva.Line({
          points: [sScreen.x, sScreen.y, eScreen.x, eScreen.y],
          stroke: '#f59e0b',
          strokeWidth: 2,
          dash: [6, 3],
        })
      );

      const dist = SnapEngine.distance(this.measureStartPoint, endWorld);
      const dx = Math.abs(endWorld.x - this.measureStartPoint.x);
      const dy = Math.abs(endWorld.y - this.measureStartPoint.y);

      const lengthStr = GridUtils.formatLength(dist, pixelsPerMeter, meta.unit);
      const dxStr = GridUtils.formatLength(dx, pixelsPerMeter, meta.unit);
      const dyStr = GridUtils.formatLength(dy, pixelsPerMeter, meta.unit);

      const label = `📏 ${lengthStr} (∠ ${polar.angleDegrees.toFixed(1)}° | ΔX: ${dxStr}, ΔY: ${dyStr})`;

      this.renderFloatingBadge(
        (sScreen.x + eScreen.x) / 2,
        (sScreen.y + eScreen.y) / 2 - 25,
        label,
        '#1c1917',
        '#f59e0b'
      );
    }

    // 4. معاينة أداة قياس المساحة والمحيط (Area Polygon Tool مع خط الزاوية الإرشادي)
    if (this.toolMode === 'area' && this.areaPoints.length > 0) {
      const lastPoint = this.areaPoints[this.areaPoints.length - 1];
      let endWorld = this.currentSnapResult.point;
      const polar = SnapEngine.getPolarAngleSnap(
        lastPoint,
        endWorld,
        [0, 45, 90, 135, 180, 225, 270, 315, 360],
        shiftKey || this.isShiftKeyPressed ? 25 : 5.0
      );
      const isObjectSnap = this.currentSnapResult.snapped && this.currentSnapResult.type !== 'grid';
      if ((!isObjectSnap && polar.isSnapped) || shiftKey || this.isShiftKeyPressed) {
        endWorld = polar.point;
      }

      this.renderAngleGuideline(
        lastPoint,
        endWorld,
        polar.angleDegrees,
        polar.isSnapped,
        'مساحة'
      );

      const screenPoints: number[] = [];
      for (const pt of this.areaPoints) {
        const s = this.camera.worldToScreen(pt);
        screenPoints.push(s.x, s.y);
      }

      // إضافة النقطة الحالية للمؤشر
      const curS = this.camera.worldToScreen(endWorld);
      const previewScreenPoints = [...screenPoints, curS.x, curS.y];

      // رسم المضلع المظلل
      if (previewScreenPoints.length >= 6) {
        this.interactionLayer.add(
          new Konva.Line({
            points: previewScreenPoints,
            fill: 'rgba(56, 189, 248, 0.2)',
            stroke: '#38bdf8',
            strokeWidth: 2,
            closed: true,
            dash: [4, 4],
          })
        );
      } else {
        this.interactionLayer.add(
          new Konva.Line({
            points: previewScreenPoints,
            stroke: '#38bdf8',
            strokeWidth: 2,
            dash: [4, 4],
          })
        );
      }

      // علامات رؤوس المضلع
      for (let i = 0; i < screenPoints.length; i += 2) {
        this.interactionLayer.add(
          new Konva.Circle({
            x: screenPoints[i],
            y: screenPoints[i + 1],
            radius: 5,
            fill: '#ffffff',
            stroke: '#0284c7',
            strokeWidth: 2,
          })
        );
      }
    }

    // 5. معاينة أداة المعايرة / المسطرة (Calibration Tool مع خط الزاوية الإرشادي)
    if (this.isCalibrating && this.calibrateStartPoint) {
      let endWorld = this.currentSnapResult.point;
      const polar = SnapEngine.getPolarAngleSnap(
        this.calibrateStartPoint,
        endWorld,
        [0, 45, 90, 135, 180, 225, 270, 315, 360],
        shiftKey || this.isShiftKeyPressed ? 25 : 5.0
      );

      const isObjectSnap = this.currentSnapResult.snapped && this.currentSnapResult.type !== 'grid';
      if ((!isObjectSnap && polar.isSnapped) || shiftKey || this.isShiftKeyPressed) {
        endWorld = polar.point;
      }

      this.renderAngleGuideline(
        this.calibrateStartPoint,
        endWorld,
        polar.angleDegrees,
        polar.isSnapped,
        'مسطرة'
      );

      const sScreen = this.camera.worldToScreen(this.calibrateStartPoint);
      const eScreen = this.camera.worldToScreen(endWorld);

      this.interactionLayer.add(
        new Konva.Line({
          points: [sScreen.x, sScreen.y, eScreen.x, eScreen.y],
          stroke: '#10b981',
          strokeWidth: 2.5,
          dash: [5, 3],
        })
      );

      const dist = SnapEngine.distance(this.calibrateStartPoint, endWorld);
      this.renderFloatingBadge(
        (sScreen.x + eScreen.x) / 2,
        (sScreen.y + eScreen.y) / 2 - 22,
        `🎯 مسطرة المعايرة: ${dist.toFixed(1)} px (${polar.angleDegrees.toFixed(1)}°)`,
        '#064e3b',
        '#10b981'
      );
    }

    // 5.1 عرض خط المعايرة المكتمل النشط (SketchUp Active Calibration Line)
    if (this.activeCalibrationLine) {
      const { p1, p2, dist } = this.activeCalibrationLine;
      const sScreen = this.camera.worldToScreen(p1);
      const eScreen = this.camera.worldToScreen(p2);

      this.interactionLayer.add(
        new Konva.Line({
          points: [sScreen.x, sScreen.y, eScreen.x, eScreen.y],
          stroke: '#10b981',
          strokeWidth: 3,
          dash: [6, 4],
          shadowColor: '#10b981',
          shadowBlur: 6,
          shadowOpacity: 0.6,
        })
      );

      [sScreen, eScreen].forEach((pt) => {
        this.interactionLayer.add(
          new Konva.Circle({
            x: pt.x,
            y: pt.y,
            radius: 6,
            fill: '#10b981',
            stroke: '#ffffff',
            strokeWidth: 2,
          })
        );
      });

      this.renderFloatingBadge(
        (sScreen.x + eScreen.x) / 2,
        Math.min(sScreen.y, eScreen.y) - 20,
        `📏 ${dist.toFixed(1)} px (أدخل الطول بالمتر مباشرة)`,
        '#064e3b',
        '#34d399'
      );
    }

    // 6. معاينة الباب أو النافذة فوق الجدار
    if ((this.toolMode === 'door' || this.toolMode === 'window') && this.currentWallSnap) {
      const snap = this.currentWallSnap;
      const wall = snap.wall;
      const width = this.toolMode === 'door' ? this.defaultDoorWidth : this.defaultWindowWidth;

      const dx = wall.end.x - wall.start.x;
      const dy = wall.end.y - wall.start.y;
      const wallLen = Math.sqrt(dx * dx + dy * dy);
      const ux = dx / wallLen;
      const uy = dy / wallLen;

      const halfW = width / 2;
      const p1 = { x: snap.projectedPoint.x - halfW * ux, y: snap.projectedPoint.y - halfW * uy };
      const p2 = { x: snap.projectedPoint.x + halfW * ux, y: snap.projectedPoint.y + halfW * uy };

      const sP1 = this.camera.worldToScreen(p1);
      const sP2 = this.camera.worldToScreen(p2);
      const screenThickness = Math.max(2, wall.thickness * zoom);

      this.interactionLayer.add(
        new Konva.Line({
          points: [sP1.x, sP1.y, sP2.x, sP2.y],
          stroke: this.toolMode === 'door' ? '#f59e0b' : '#38bdf8',
          strokeWidth: screenThickness + 4,
          opacity: 0.7,
          dash: [4, 4],
        })
      );

      const widthStr = GridUtils.formatLength(width, pixelsPerMeter, meta.unit);
      const label = `${this.toolMode === 'door' ? '🚪 باب' : '🪟 نافذة'} (${widthStr})`;

      this.renderFloatingBadge(
        (sP1.x + sP2.x) / 2,
        (sP1.y + sP2.y) / 2 - screenThickness - 18,
        label,
        '#0f172a',
        this.toolMode === 'door' ? '#f59e0b' : '#38bdf8'
      );
    }

    // 6.5 معاينة الرمز الهندسي مع الالتقاط الذكي بالجدار (Symbol Tool Preview - المرحلة 4)
    if (this.toolMode === 'symbol') {
      const symDef = getSymbolById(this.activeSymbolKind);
      if (symDef) {
        let previewPoint = this.currentSnapResult.point;
        let previewAngle = 0;
        let isSnappedToWall = false;

        if (this.currentSymbolWallSnap) {
          previewPoint = this.currentSymbolWallSnap.snappedPoint;
          previewAngle = this.currentSymbolWallSnap.angle;
          isSnappedToWall = true;
        }

        const sPos = this.camera.worldToScreen(previewPoint);
        const ghostGroup = new Konva.Group({
          x: sPos.x,
          y: sPos.y,
          rotation: previewAngle,
          scale: { x: zoom, y: zoom },
          opacity: 0.85,
        });

        symDef.renderKonva(ghostGroup, {
          color: isSnappedToWall ? '#38bdf8' : '#f59e0b',
          isSelected: false,
          zoom,
        });

        if (isSnappedToWall) {
          ghostGroup.add(
            new Konva.Circle({
              x: 0,
              y: 0,
              radius: 14,
              stroke: '#38bdf8',
              strokeWidth: 1.5,
              dash: [3, 3],
            })
          );
        }

        this.interactionLayer.add(ghostGroup);

        const badgeLabel = symDef.name;
        this.renderFloatingBadge(
          sPos.x,
          sPos.y - 24,
          badgeLabel,
          '#0f172a',
          isSnappedToWall ? '#38bdf8' : '#f59e0b'
        );
      }
    }

    // 6.6 معاينة رسم المسار والكابلات بالوقت الفعلي (Real-time Live Route Preview)
    if (this.toolMode === 'route') {
      const meta = ROUTE_KINDS_META[this.activeRouteKind];
      const routeColor = meta?.defaultColor || '#f59e0b';
      const strokeW = Math.max(2, (meta?.defaultStrokeWidth || 2.5) * Math.min(1.4, Math.max(0.7, zoom)));

      let liveDash: number[] | undefined = undefined;
      let liveCap: 'round' | 'square' | 'butt' = 'round';
      if (this.activeRouteLineStyle === 'dashed') {
        liveDash = [14, 8];
        liveCap = 'butt';
      } else if (this.activeRouteLineStyle === 'dotted') {
        liveDash = [2, 10];
        liveCap = 'round';
      }

      if (this.routePoints.length === 0) {
        // معاينة حية قبل النقر الأول لتوضيح إمكانية البدء والارتباط
        const symbolSnap = SnapEngine.findSymbolSnap(this.currentSnapResult.point, this.model.getObjects(), 30);
        const curPt = symbolSnap ? symbolSnap.point : this.currentSnapResult.point;
        const curScreen = this.camera.worldToScreen(curPt);

        this.interactionLayer.add(
          new Konva.Circle({
            x: curScreen.x,
            y: curScreen.y,
            radius: 6,
            fill: symbolSnap ? '#22c55e' : routeColor,
            stroke: '#ffffff',
            strokeWidth: 2,
            opacity: 0.9,
          })
        );

        const hintText = symbolSnap
          ? `التقط بالرمز: ${symbolSnap.symbol.symbolKind} (انقر للبدء)`
          : `⚡ انقر لتحديد بداية مسار ${meta?.name || 'MEP'}`;

        this.renderFloatingBadge(
          curScreen.x,
          curScreen.y - 22,
          hintText,
          '#0f172a',
          symbolSnap ? '#22c55e' : routeColor
        );
      } else {
        const screenPoints: number[] = [];
        this.routePoints.forEach((p) => {
          const s = this.camera.worldToScreen(p);
          screenPoints.push(s.x, s.y);
        });

        let currentEnd = this.currentSnapResult.point;
        const symbolSnap = SnapEngine.findSymbolSnap(this.currentSnapResult.point, this.model.getObjects(), 30);
        const lastPt = this.routePoints[this.routePoints.length - 1];

        const polar = SnapEngine.getPolarAngleSnap(
          lastPt,
          currentEnd,
          [0, 45, 90, 135, 180, 225, 270, 315, 360],
          shiftKey || this.isShiftKeyPressed ? 25 : 5.0
        );

        if (symbolSnap) {
          currentEnd = symbolSnap.point;
        } else if (polar.isSnapped || shiftKey || this.isShiftKeyPressed) {
          currentEnd = polar.point;
        }

        if (!symbolSnap) {
          this.renderAngleGuideline(lastPt, currentEnd, polar.angleDegrees, polar.isSnapped);
        }

        const curScreen = this.camera.worldToScreen(currentEnd);

        // رسم الخطوط السابقة المسجلة للمسار بنمط الخط المختار
        if (screenPoints.length >= 4) {
          this.interactionLayer.add(
            new Konva.Line({
              points: screenPoints,
              stroke: routeColor,
              strokeWidth: strokeW,
              dash: liveDash,
              lineCap: liveCap,
              lineJoin: 'round',
            })
          );
        }

        // رسم الجزء الحي المتحرك المرتبط بالمؤشر (Rubber-banding)
        const lastScreenPt = {
          x: screenPoints[screenPoints.length - 2],
          y: screenPoints[screenPoints.length - 1],
        };

        this.interactionLayer.add(
          new Konva.Line({
            points: [lastScreenPt.x, lastScreenPt.y, curScreen.x, curScreen.y],
            stroke: routeColor,
            strokeWidth: strokeW,
            dash: liveDash || [6, 4],
            lineCap: liveCap,
            lineJoin: 'round',
            opacity: 0.9,
          })
        );

        // رسم دوائر الرؤوس (Vertices)
        for (let i = 0; i < screenPoints.length; i += 2) {
          this.interactionLayer.add(
            new Konva.Circle({
              x: screenPoints[i],
              y: screenPoints[i + 1],
              radius: 4,
              fill: '#ffffff',
              stroke: routeColor,
              strokeWidth: 2,
            })
          );
        }

        // علامة نقطة المؤشر الحالية
        this.interactionLayer.add(
          new Konva.Circle({
            x: curScreen.x,
            y: curScreen.y,
            radius: 5,
            fill: symbolSnap ? '#22c55e' : routeColor,
            stroke: '#ffffff',
            strokeWidth: 1.5,
          })
        );

        // شارة الأطوال بالوقت الفعلي
        const lastWorldPt = this.routePoints[this.routePoints.length - 1];
        const segmentPx = SnapEngine.distance(lastWorldPt, currentEnd);
        const segmentMeters = (segmentPx / pixelsPerMeter).toFixed(2);

        const allPointsWithCur = [...this.routePoints, currentEnd];
        const totalPx = calculateRoutePixelLength(allPointsWithCur);
        const totalMeters = (totalPx / pixelsPerMeter).toFixed(2);

        let badgeText = `⚡ ${meta?.name || 'مسار'}: ${segmentMeters}م (المجموع: ${totalMeters}م)`;
        if (symbolSnap) {
          badgeText = `متصل بـ: ${symbolSnap.symbol.symbolKind} | المجموع: ${totalMeters}م`;
        }

        this.renderFloatingBadge(
          (lastScreenPt.x + curScreen.x) / 2,
          (lastScreenPt.y + curScreen.y) / 2 - 20,
          badgeText,
          '#0f172a',
          symbolSnap ? '#22c55e' : routeColor
        );
      }
    }

    // 6.7 معاينة مستطيل التحديد بمربع الإحاطة (Marquee Box Selection Preview - المتطلب 5)
    if (this.isMarqueeSelecting && this.marqueeStartPoint) {
      const p1 = this.camera.worldToScreen(this.marqueeStartPoint);
      const p2 = this.camera.worldToScreen(this.currentSnapResult.point);
      const x = Math.min(p1.x, p2.x);
      const y = Math.min(p1.y, p2.y);
      const w = Math.abs(p2.x - p1.x);
      const h = Math.abs(p2.y - p1.y);

      this.interactionLayer.add(
        new Konva.Rect({
          x,
          y,
          width: w,
          height: h,
          fill: 'rgba(56, 189, 248, 0.15)',
          stroke: '#38bdf8',
          strokeWidth: 1.5,
          dash: [6, 4],
        })
      );

      const distW = Math.abs(this.currentSnapResult.point.x - this.marqueeStartPoint.x) / pixelsPerMeter;
      const distH = Math.abs(this.currentSnapResult.point.y - this.marqueeStartPoint.y) / pixelsPerMeter;

      this.renderFloatingBadge(
        x + w / 2,
        y - 18,
        `🔲 مربع تحديد: ${distW.toFixed(2)}م × ${distH.toFixed(2)}م`,
        '#0f172a',
        '#38bdf8'
      );
    }

    // 7. رسم مؤشر الالتقاط العادي
    this.renderSnapIndicatorShapes();
    this.interactionLayer.batchDraw();
  }

  /**
   * رسم خط الزاوية الإرشادي وقوس الزاوية وبادج الدرجة الهندسية
   * (Angle Guideline, Polar Tracking Ray & Angular Badge)
   */
  private renderAngleGuideline(
    originWorld: Point,
    targetWorld: Point,
    angleDegrees: number,
    isSnapped: boolean,
    labelExtra?: string
  ): void {
    const sOrigin = this.camera.worldToScreen(originWorld);
    const sTarget = this.camera.worldToScreen(targetWorld);
    const distScreen = Math.hypot(sTarget.x - sOrigin.x, sTarget.y - sOrigin.y);
    if (distScreen < 8) return;

    const rad = (angleDegrees * Math.PI) / 180;
    const dirX = Math.cos(rad);
    const dirY = Math.sin(rad);

    // 1. خط الزاوية الإرشادي الممتد (Polar Guide Ray) عبر الشاشة
    const extLen = 3000;
    const rayStart = {
      x: sOrigin.x - dirX * 150,
      y: sOrigin.y - dirY * 150,
    };
    const rayEnd = {
      x: sOrigin.x + dirX * extLen,
      y: sOrigin.y + dirY * extLen,
    };

    const guideColor = isSnapped ? '#10b981' : '#38bdf8';
    this.interactionLayer.add(
      new Konva.Line({
        points: [rayStart.x, rayStart.y, rayEnd.x, rayEnd.y],
        stroke: guideColor,
        strokeWidth: isSnapped ? 1.5 : 1,
        dash: isSnapped ? [10, 5] : [6, 4],
        opacity: isSnapped ? 0.9 : 0.45,
        listening: false,
      })
    );

    // 2. خط المرجع الأفقي عند نقطة البداية (0° Reference Line)
    if (Math.abs(angleDegrees) > 2 && Math.abs(angleDegrees - 180) > 2 && Math.abs(angleDegrees - 360) > 2) {
      this.interactionLayer.add(
        new Konva.Line({
          points: [sOrigin.x, sOrigin.y, sOrigin.x + Math.min(60, distScreen * 0.7), sOrigin.y],
          stroke: 'rgba(148, 163, 184, 0.4)',
          strokeWidth: 1,
          dash: [3, 3],
          listening: false,
        })
      );

      // قوس الزاوية (Angle Arc)
      const arcRadius = Math.min(26, Math.max(14, distScreen * 0.35));
      this.interactionLayer.add(
        new Konva.Arc({
          x: sOrigin.x,
          y: sOrigin.y,
          innerRadius: arcRadius - 1,
          outerRadius: arcRadius,
          angle: angleDegrees > 180 ? 360 - angleDegrees : angleDegrees,
          rotation: angleDegrees > 180 ? angleDegrees : 0,
          stroke: guideColor,
          strokeWidth: 1.5,
          opacity: 0.8,
          listening: false,
        })
      );
    }

    // 3. بادج قيمة الزاوية
    const badgeText = `${isSnapped ? '⌖ ' : '∠ '}${angleDegrees.toFixed(1)}°${labelExtra ? ' • ' + labelExtra : ''}`;
    const midX = (sOrigin.x + sTarget.x) / 2;
    const midY = (sOrigin.y + sTarget.y) / 2;
    const perpX = -dirY * 20;
    const perpY = dirX * 20;

    this.renderFloatingBadge(
      midX + perpX,
      midY + perpY,
      badgeText,
      isSnapped ? '#064e3b' : '#0f172a',
      isSnapped ? '#34d399' : '#38bdf8'
    );
  }

  private renderFloatingBadge(
    x: number,
    y: number,
    text: string,
    bgColor: string,
    borderColor: string
  ): void {
    const badgeGroup = new Konva.Group({ x, y, listening: false });

    const labelText = new Konva.Text({
      text,
      fontSize: 11,
      fontFamily: 'JetBrains Mono',
      fill: '#ffffff',
      padding: 3,
      align: 'center',
    });

    const labelBg = new Konva.Rect({
      width: labelText.width() + 10,
      height: labelText.height() + 4,
      fill: bgColor,
      stroke: borderColor,
      strokeWidth: 1,
      cornerRadius: 4,
      offsetX: (labelText.width() + 10) / 2,
      offsetY: 2,
    });

    labelText.offsetX(labelText.width() / 2);
    badgeGroup.add(labelBg);
    badgeGroup.add(labelText);
    this.interactionLayer.add(badgeGroup);
  }

  private renderSnapIndicatorOnly(): void {
    const snapNodes = this.interactionLayer.find('.snap-node');
    snapNodes.forEach((node) => node.destroy());

    this.renderSnapIndicatorShapes();
    this.interactionLayer.batchDraw();
  }

  private renderSnapIndicatorShapes(): void {
    if (!this.currentSnapResult.snapped) return;

    const screenPos = this.camera.worldToScreen(this.currentSnapResult.point);
    const snapType = this.currentSnapResult.type;

    let color = '#38bdf8';
    if (snapType === 'endpoint') color = '#22c55e';
    if (snapType === 'midpoint') color = '#06b6d4';
    if (snapType === 'grid') color = '#eab308';

    const marker = new Konva.Circle({
      x: screenPos.x,
      y: screenPos.y,
      radius: 6,
      stroke: color,
      strokeWidth: 2,
      fill: 'rgba(255, 255, 255, 0.2)',
      name: 'snap-node',
      listening: false,
    });
    this.interactionLayer.add(marker);
  }

  public destroy(): void {
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
