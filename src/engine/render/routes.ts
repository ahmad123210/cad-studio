/**
 * @file routes.ts
 * @description رسم المسارات الكهروميكانيكية ورؤوسها وأطوالها
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

export function renderRouteImpl(this: CadEngine, route: RouteObject, isLocked: boolean, layerColor: string, layerOpacity: number): void {
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
