/**
 * @file objectsLayer.ts
 * @description بناء طبقة العناصر: الجدران وتوزيع رسم بقية الأنواع مع الاقتطاع ومستويات التفاصيل
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
  LineObject,
  RoomObject,
  ColumnObject,
  StairObject,
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
import { buildEndpointIndex, computeWallPolygon } from '../geometry/wallJoins.ts';
import { renderBatchedImpl, countVisibleUpTo, BATCH_RENDER_THRESHOLD, BatchInput } from './batchLayer.ts';
import { computeOpeningTypes } from '../../model/quantities.ts';

export function renderObjectsLayerImpl(this: CadEngine): void {
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

    // فهرس نهايات الجدران المرئية لحساب وصلات الأركان (Miter Joins)
    const visibleWalls: WallObject[] = [];
    for (const o of objects) {
      if (o.type !== 'wall') continue;
      const lyr = layerById.get(o.layerId);
      if (lyr && !lyr.visible) continue;
      visibleWalls.push(o as WallObject);
    }
    const wallEndpointIndex = buildEndpointIndex(visibleWalls);

    // ─── الرسم المجمّع للمخططات الضخمة: عند تجاوز عدد العناصر المرئية للحد ───
    const quickInView = (o: ProjectObject): boolean => {
      const lyr = layerById.get(o.layerId);
      if (lyr && !lyr.visible) return false;
      switch (o.type) {
        case 'wall':
          return wallInView(o as WallObject);
        case 'door':
        case 'window': {
          const host = wallById.get((o as DoorObject).wallId);
          return host ? wallInView(host) : false;
        }
        case 'dimension': {
          const d = o as DimensionObject;
          return inView(Math.min(d.start.x, d.end.x), Math.min(d.start.y, d.end.y), Math.max(d.start.x, d.end.x), Math.max(d.start.y, d.end.y));
        }
        case 'column':
        case 'symbol':
        case 'room':
        case 'text': {
          const t = o as SymbolObject;
          return inView(t.x - 100, t.y - 100, t.x + 100, t.y + 100);
        }
        case 'stairs': {
          const st = o as StairObject;
          const r = st.width / 2 + 40;
          return inView(Math.min(st.start.x, st.end.x) - r, Math.min(st.start.y, st.end.y) - r, Math.max(st.start.x, st.end.x) + r, Math.max(st.start.y, st.end.y) + r);
        }
        case 'route':
        case 'line': {
          const pts = (o as RouteObject).points;
          if (pts.length === 0) return false;
          let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
          for (const p of pts) {
            if (p.x < a) a = p.x; if (p.y < b) b = p.y; if (p.x > c) c = p.x; if (p.y > d) d = p.y;
          }
          return inView(a, b, c, d);
        }
      }
      return false;
    };
    const batchMode =
      cullEnabled && countVisibleUpTo(objects, quickInView, BATCH_RENDER_THRESHOLD) >= BATCH_RENDER_THRESHOLD;
    if (batchMode) {
      const sel = (id: string) => this.isObjectSelected(id);
      const input: BatchInput = {
        walls: [], doors: [], windows: [], dimensions: [], symbols: [], routes: [], texts: [], lines: [],
        layerById, wallEndpointIndex,
      };
      for (const o of objects) {
        if (sel(o.id) || !quickInView(o)) continue;
        switch (o.type) {
          case 'wall': input.walls.push(o as WallObject); break;
          case 'door': {
            const w = wallById.get((o as DoorObject).wallId);
            if (w && !sel(w.id)) input.doors.push({ door: o as DoorObject, wall: w });
            break;
          }
          case 'window': {
            const w = wallById.get((o as WindowObject).wallId);
            if (w && !sel(w.id)) input.windows.push({ win: o as WindowObject, wall: w });
            break;
          }
          case 'dimension': input.dimensions.push(o as DimensionObject); break;
          case 'symbol': input.symbols.push(o as SymbolObject); break;
          case 'route': input.routes.push(o as RouteObject); break;
          case 'text': input.texts.push(o as TextObject); break;
          case 'line': input.lines.push(o as LineObject); break;
        }
      }
      renderBatchedImpl.call(this, input);
    }
    /** في الوضع المجمّع تُرسم كعُقد كاملة فقط العناصر المحددة (أو فتحات الجدار المحدد) */
    const skipForBatch = (id: string, hostId?: string): boolean =>
      batchMode && !this.isObjectSelected(id) && !(hostId !== undefined && this.isObjectSelected(hostId));

    // 0. الخطوط الحرة (تحت الجدران: غالباً خلفية مستوردة من DXF)
    for (const obj of objects) {
      if (obj.type !== 'line') continue;
      const ln = obj as LineObject;
      const layer = layerById.get(ln.layerId);
      if (layer && !layer.visible) continue;
      if (skipForBatch(ln.id)) continue;
      if (!this.isObjectSelected(ln.id) && !quickInView(ln)) continue;
      this.renderLinework(ln, layer?.locked ?? false, layer?.color || '#94a3b8', layer?.opacity ?? 1);
    }

    // 0.5 تعبئة الغرف (تحت الجدران)
    const visibleRooms = objects.filter((o) => {
      if (o.type !== 'room') return false;
      const lyr = layerById.get(o.layerId);
      return !lyr || lyr.visible;
    }) as RoomObject[];
    this.renderRoomFills(visibleRooms);

    // 1. رسم الجدران
    for (const obj of objects) {
      if (obj.type !== 'wall') continue;
      const wall = obj as WallObject;
      const layer = layerById.get(wall.layerId);
      if (layer && !layer.visible) continue;

      const isSelected = this.isObjectSelected(wall.id);
      if (!isSelected && !wallInView(wall)) continue;
      if (skipForBatch(wall.id)) continue;
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

      // وصل الأركان: إذا التقى الجدار بجدار آخر عند نهاية مشتركة نرسمه كمضلع بقطع مائل
      const joinPoly = wall.thickness * zoom >= 2 ? computeWallPolygon(wall, wallEndpointIndex) : null;
      if (joinPoly) {
        const pts: number[] = [];
        for (const p of joinPoly) {
          const sp = this.camera.worldToScreen(p);
          pts.push(sp.x, sp.y);
        }
        const wallPoly = new Konva.Line({
          name: 'wall-poly',
          points: pts,
          closed: true,
          fill: wallStroke,
          stroke: wallStroke,
          strokeWidth: 0.5,
          hitStrokeWidth: Math.max(28, screenThickness + 18),
          lineJoin: 'miter',
        });
        // عرض الخط الأصلي لاستخدامه أثناء معاينة سحب مقابض الجدار
        wallPoly.setAttr('fullWidth', screenThickness);
        group.add(wallPoly);
      } else {
        const wallLine = new Konva.Line({
          points: [sScreen.x, sScreen.y, eScreen.x, eScreen.y],
          stroke: wallStroke,
          strokeWidth: screenThickness,
          hitStrokeWidth: Math.max(28, screenThickness + 18),
          lineCap: 'square',
          lineJoin: 'miter',
        });
        group.add(wallLine);
      }

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
        this.pickObjectDown(wall.id, e.evt as MouseEvent, true);
      });

      group.on('click tap', (e) => {
        if (e.evt && e.evt.button !== 0 && !e.evt.touches) return;
        if (this.toolMode !== 'select' || this.selectionSubMode === 'box') return;
        e.cancelBubble = true;
        if (this.wasGroupDragged) {
          return;
        }
        this.pickObjectClick(wall.id, e.evt as MouseEvent);
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
      if (skipForBatch(door.id, wall.id)) continue;

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
      if (skipForBatch(win.id, wall.id)) continue;

      this.renderWindow(win, wall, layer?.locked ?? false);
    }

    // 3.5 العناصر الإنشائية: الدرج ثم الأعمدة (فوق الجدران وتحت الأبعاد والرموز)
    for (const obj of objects) {
      if (obj.type !== 'stairs') continue;
      const layer = layerById.get(obj.layerId);
      if (layer && !layer.visible) continue;
      if (!this.isObjectSelected(obj.id) && !quickInView(obj)) continue;
      this.renderStairs(obj as StairObject, Boolean(layer?.locked || obj.locked), layer?.color || '#e5e7eb', layer?.opacity ?? 1);
    }
    for (const obj of objects) {
      if (obj.type !== 'column') continue;
      const layer = layerById.get(obj.layerId);
      if (layer && !layer.visible) continue;
      if (!this.isObjectSelected(obj.id) && !quickInView(obj)) continue;
      this.renderColumn(obj as ColumnObject, Boolean(layer?.locked || obj.locked), layer?.color || '#e5e7eb', layer?.opacity ?? 1);
    }

    // 4. رسم الأبعاد الهندسية (Dimensions - المرحلة 3)
    for (const obj of objects) {
      if (obj.type !== 'dimension') continue;
      const dim = obj as DimensionObject;
      const layer = layerById.get(dim.layerId);
      if (layer && !layer.visible) continue;
      if (skipForBatch(dim.id)) continue;
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
      if (skipForBatch(sym.id)) continue;
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
      if (skipForBatch(route.id)) continue;
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
      if (skipForBatch(textObj.id)) continue;
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

    // 7.4 رموز الأبواب والشبابيك (D1، W1…) — اختيارية من نافذة الكميات
    const qs = this.model.getQuantitySettings();
    if (qs.showOpeningTags) {
      const codeById: Record<string, string> = {};
      for (const t of computeOpeningTypes(objects, pixelsPerMeter, qs)) t.ids.forEach((id) => (codeById[id] = t.code));
      const fs = Math.max(8, Math.min(16, Math.round(10 * zoom)));
      for (const o of objects) {
        if (o.type !== 'door' && o.type !== 'window') continue;
        const op = o as DoorObject | WindowObject;
        const w = wallById.get(op.wallId);
        const lyr = layerById.get(op.layerId);
        if (!w || (lyr && !lyr.visible) || !wallInView(w)) continue;
        const dx = w.end.x - w.start.x;
        const dy = w.end.y - w.start.y;
        const L = Math.hypot(dx, dy) || 1;
        const c = { x: w.start.x + dx * op.position, y: w.start.y + dy * op.position };
        const off = (w.thickness || 20) / 2 + 12 / zoom;
        const p = this.camera.worldToScreen({ x: c.x + (dy / L) * off, y: c.y - (dx / L) * off });
        const color = o.type === 'door' ? '#f59e0b' : '#14b8a6';
        const label = new Konva.Text({ text: codeById[o.id] || '', fontSize: fs, fontFamily: 'JetBrains Mono, monospace', fontStyle: 'bold', fill: color, listening: false });
        const pad = 2;
        this.objectsLayer.add(
          new Konva.Rect({ x: p.x - label.width() / 2 - pad, y: p.y - label.height() / 2 - pad, width: label.width() + pad * 2, height: label.height() + pad * 2, fill: isDark ? '#0f172a' : '#ffffff', stroke: color, strokeWidth: 1, cornerRadius: 3, listening: false })
        );
        label.position({ x: p.x - label.width() / 2, y: p.y - label.height() / 2 });
        this.objectsLayer.add(label);
      }
    }

    // 7.5 بطاقات الغرف (الاسم والمساحة)
    for (const room of visibleRooms) {
      if (!this.isObjectSelected(room.id) && !inView(room.x - 200, room.y - 100, room.x + 200, room.y + 100)) continue;
      const layer = layerById.get(room.layerId);
      this.renderRoomLabel(room, Boolean(layer?.locked || room.locked), layer?.opacity ?? 1);
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
    // الوضع المجمّع يمثّل آلاف العناصر بعقدة واحدة: نعامله كمشهد ثقيل لتفعيل الإيماءات السريعة
    if (batchMode) this.lastRenderedGroupCount += BATCH_RENDER_THRESHOLD;
  }
