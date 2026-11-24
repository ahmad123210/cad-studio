/**
 * @file openings.ts
 * @description رسم الأبواب والنوافذ المرتبطة بالجدران
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

export function renderDoorImpl(this: CadEngine, door: DoorObject, wall: WallObject, isLocked: boolean): void {
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
      this.pickObjectDown(door.id, e.evt as MouseEvent);
    });

    group.on('click tap', (e) => {
      if (e.evt && e.evt.button !== 0 && !e.evt.touches) return;
      if (this.toolMode !== 'select' || this.selectionSubMode === 'box') return;
      e.cancelBubble = true;
      if (this.wasGroupDragged) {
        return;
      }
      this.pickObjectClick(door.id, e.evt as MouseEvent);
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

export function renderWindowImpl(this: CadEngine, win: WindowObject, wall: WallObject, isLocked: boolean): void {
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
      this.pickObjectDown(win.id, e.evt as MouseEvent);
    });

    group.on('click tap', (e) => {
      if (e.evt && e.evt.button !== 0 && !e.evt.touches) return;
      if (this.toolMode !== 'select' || this.selectionSubMode === 'box') return;
      e.cancelBubble = true;
      if (this.wasGroupDragged) {
        return;
      }
      this.pickObjectClick(win.id, e.evt as MouseEvent);
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
