/**
 * @file gestures.ts
 * @description التكبير والتحريك السريع (لقطة نقطية) وإيماءات اللمس المتعدد
 * (مُستخرج من renderer.ts دون تغيير في السلوك؛ الدوال تُستدعى بسياق المحرك this)
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
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
} from '../../model/types.ts';
import { ProjectModel } from '../../model/project.ts';
import { Camera, CameraState } from '../camera.ts';
import {
  SnapEngine,
  SnapResult,
  SnapOptions,
  WallSnapResult,
  SymbolWallSnapResult,
} from '../snap.ts';
import { GridUtils } from '../grid.ts';
import { getSymbolById } from '../../symbols/registry.ts';
import {
  ROUTE_KINDS_META,
  calculateRoutePixelLength,
  calculateSegmentLengths,
} from '../../symbols/routes.ts';
import {
  getLastUsedSettings,
  updateLastUsedSettings,
  GridDensity,
  getGridOptionsForDensity,
  getLastUsedSymbolConfig,
} from '../../model/lastUsedSettings.ts';
import type { CadEngine, ToolMode, SketchUpCalibrationEvent, WallDrawingState, EngineCallbacks } from '../renderer.ts';
import { BoxRect, isObjectInBox, pointInBox, segmentIntersectsBox } from '../geometry/selectionBox.ts';

export function onViewTransformChangedImpl(this: CadEngine, immediate: boolean = false): void {
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

export function touchToLocalImpl(this: CadEngine, t: Touch): Point {
    const rect = this.container.getBoundingClientRect();
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  }

export function getPinchMetricsImpl(this: CadEngine, touches: TouchList): { dist: number; center: Point } {
    const a = this.touchToLocal(touches[0]);
    const b = this.touchToLocal(touches[1]);
    return {
      dist: Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)),
      center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
  }

export function beginPinchImpl(this: CadEngine, touches: TouchList): void {
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

export function updatePinchImpl(this: CadEngine, touches: TouchList): void {
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

export function shouldUseFastGestureImpl(this: CadEngine): boolean {
    if (this.disableCulling) return false;
    if (Konva.isDragging()) return false;
    return (
      this.isGestureActive ||
      this.lastObjectsRenderMs > (this.constructor as typeof CadEngine).FAST_GESTURE_THRESHOLD_MS ||
      this.lastRenderedGroupCount > (this.constructor as typeof CadEngine).FAST_GESTURE_GROUP_THRESHOLD
    );
  }

export function beginGestureImpl(this: CadEngine): void {
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

export function scheduleGestureFrameImpl(this: CadEngine): void {
    if (this.gestureFramePending) return;
    this.gestureFramePending = true;
    requestAnimationFrame(() => {
      this.gestureFramePending = false;
      this.applyGestureTransforms();
    });
  }

export function applyGestureTransformsImpl(this: CadEngine): void {
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

export function scheduleGestureEndImpl(this: CadEngine): void {
    if (this.gestureEndTimer) clearTimeout(this.gestureEndTimer);
    this.gestureEndTimer = setTimeout(() => {
      this.gestureEndTimer = null;
      if (this.isPanning || this.pinchState) return; // ستنتهي عند رفع الإصبع/الزر
      this.endGesture();
      this.callbacks.onCameraChange(this.camera.getState());
      this.render();
    }, (this.constructor as typeof CadEngine).GESTURE_SETTLE_MS);
  }

export function endGestureImpl(this: CadEngine): void {
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

export function flushGestureImpl(this: CadEngine): void {
    if (!this.isGestureActive && !this.gestureEndTimer) return;
    this.endGesture();
    this.callbacks.onCameraChange(this.camera.getState());
    this.render();
    // رسم متزامن للمشهد ولوحة الإصابة (Hit Canvas): batchDraw مؤجل للإطار القادم،
    // بينما Konva يفحص الإصابة لهذه النقرة الآن — بدونه تسقط النقرة على الخلفية ولا يبدأ السحب
    this.objectsLayer.draw();
  }
