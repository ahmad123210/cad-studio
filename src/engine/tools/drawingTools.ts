/**
 * @file drawingTools.ts
 * @description إنهاء أوامر الرسم: طول الجدار الرقمي، المسار، المعايرة
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

export function commitWallWithLengthImpl(this: CadEngine, lengthMeters: number): boolean {
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

export function finishRouteImpl(this: CadEngine): void {
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

export function finishCalibrationImpl(this: CadEngine, p1: Point, p2: Point): void {
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
