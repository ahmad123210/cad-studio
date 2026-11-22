/**
 * @file exportImage.ts
 * @description حدود المخطط وتصدير صورة عالية الدقة
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

export function getDrawingBoundsImpl(this: CadEngine, includeBackground: boolean = false): {
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
      } else if (obj.type === 'route' || obj.type === 'line') {
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

export function exportDrawingImageDataURLImpl(this: CadEngine, options?: {
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
    /** إرجاع Canvas مباشرة بدل DataURL (أسرع وأقل ذاكرة للصفحات الكبيرة) */
    output?: 'dataUrl' | 'canvas';
  }): string | HTMLCanvasElement {
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
      if (opts.camera) {
        const { centerX, centerY, zoom } = opts.camera;
        this.camera.setState({ zoom, offsetX: this.stage.width() / 2 - centerX * zoom, offsetY: this.stage.height() / 2 - centerY * zoom });
      } else if (opts.boundsMode === 'drawing') {
        const bounds = this.getDrawingBounds(opts.includeBackground);
        this.camera.fitBounds(bounds, this.stage.width(), this.stage.height(), opts.padding);
      }

      // إعادة رسم الطبقات بالوضع الجديد
      this.renderBackgroundLayer();
      if (opts.includeGrid) this.renderGridLayer();
      this.renderObjectsLayer();
      if (opts.lineWeightsPx && Object.keys(opts.lineWeightsPx).length > 0) applyPrintLineWeights(this, opts.lineWeightsPx);

      // التقاط اللوحة بدقة فائقة
      if (opts.output === 'canvas') return this.stage.toCanvas({ pixelRatio: opts.pixelRatio });
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

/**
 * سماكة خطوط الطباعة حسب الطبقة: كل شكل له حدّ (stroke) ينتمي لعنصر (عبر معرف العقدة أو أحد آبائها)
 * تُضبط سماكته لتظهر بالقيمة المطلوبة في الصورة بغض النظر عن تحجيم مجموعته (الرموز مثلاً).
 */
function applyPrintLineWeights(engine: CadEngine, weights: Record<string, number>): void {
  const layerOf = new Map(engine.model.getObjects().map((o) => [o.id, o.layerId]));
  const layer = engine.objectsLayer;
  layer.find('Shape').forEach((node) => {
    const shape = node as Konva.Shape;
    if (shape.getClassName() === 'Text' || !shape.stroke() || !shape.strokeEnabled()) return;
    let cur: Konva.Node | null = shape;
    let layerId: string | undefined;
    while (cur && cur !== layer) {
      layerId = layerOf.get(cur.id());
      if (layerId) break;
      cur = cur.getParent();
    }
    if (!layerId || weights[layerId] === undefined) return;
    const sc = Math.abs(shape.getAbsoluteScale().x) || 1;
    shape.strokeWidth(weights[layerId] / sc);
  });
}
