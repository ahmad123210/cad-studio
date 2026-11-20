/**
 * @file symbols.ts
 * @description رسم الرموز الهندسية وسحبها والتصاقها بالجدران
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

export function renderSymbolImpl(this: CadEngine, symbol: SymbolObject, isLocked: boolean, layerColor: string, layerOpacity: number): void {
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
