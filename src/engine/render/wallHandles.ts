/**
 * @file wallHandles.ts
 * @description مقابض تعديل نهايتي الجدار المحدد
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

/** مضلع الجدار الموصول يتحول مؤقتاً لخط سميك أثناء معاينة السحب (يُعاد بناؤه عند الإفلات) */
function prepareWallLineForDrag(line: Konva.Line): void {
  if (line.name() !== 'wall-poly' || !line.closed()) return;
  line.closed(false);
  line.fillEnabled(false);
  line.strokeWidth(line.getAttr('fullWidth') || 2);
  line.lineCap('square');
}

export function renderWallHandlesImpl(this: CadEngine, wall: WallObject): void {
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
          prepareWallLineForDrag(line as Konva.Line);
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
          prepareWallLineForDrag(line as Konva.Line);
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
