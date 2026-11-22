/**
 * @file groupDrag.ts
 * @description السحب الجماعي للعناصر وتحديد المتشابه
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

export function selectSimilarImpl(this: CadEngine, targetId?: string): void {
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
    } else if (target.type === 'room') {
      matches = allObjects.filter((o) => o.type === 'room');
    }

    this.selectObjects(matches.map((o) => o.id));
  }

export function onGroupDragStartImpl(this: CadEngine, draggedId: string): void {
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

export function onGroupDragMoveImpl(this: CadEngine, draggedId: string, currentDraggedPos: { x: number; y: number }): void {
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

export function onGroupDragEndImpl(this: CadEngine, draggedId: string, finalDraggedPos: { x: number; y: number }): boolean {
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
