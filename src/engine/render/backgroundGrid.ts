/**
 * @file backgroundGrid.ts
 * @description رسم صورة الخلفية المرجعية والشبكة الهندسية
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

export function renderBackgroundLayerImpl(this: CadEngine): void {
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

export function renderGridLayerImpl(this: CadEngine): void {
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
