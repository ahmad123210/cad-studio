/**
 * @file annotations.ts
 * @description رسم الملاحظات النصية وأبعاد القياس
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

export function renderTextObjectImpl(this: CadEngine, textObj: TextObject, isLocked: boolean, fallbackColor: string, layerOpacity: number): void {
    const isSelected = this.isObjectSelected(textObj.id);
    const zoom = this.camera.getState().zoom;
    const sPos = this.camera.worldToScreen({ x: textObj.x, y: textObj.y });
    const isDark = this.theme === 'dark';

    // اختيار لون النص: في الوضع النهاري يتم استخدام لون متباين عالي الوضوح (#0f172a / #0284c7)
    let textColor = isSelected ? '#38bdf8' : (textObj.color || fallbackColor || (isDark ? '#38bdf8' : '#0284c7'));
    if (!isDark && !isSelected) {
      if (textColor === '#ffffff' || textColor === '#f8fafc' || textColor === '#f3f4f6') {
        textColor = '#0f172a';
      }
    }

    const fontSize = Math.max(9, Math.round((textObj.fontSize || 16) * zoom));
    const pad = Math.max(4, Math.round((textObj.padding || 6) * zoom));

    const group = new Konva.Group({
      id: textObj.id,
      name: 'text-group',
      x: sPos.x,
      y: sPos.y,
      rotation: textObj.rotation || 0,
      opacity: layerOpacity,
      draggable: !isLocked && this.toolMode === 'select',
    });

    const konvaText = new Konva.Text({
      id: textObj.id,
      name: 'text-node',
      x: pad,
      y: pad,
      text: textObj.text || 'ملاحظة',
      fontSize,
      fontFamily: 'Cairo, sans-serif',
      fontStyle: textObj.fontWeight === 'bold' ? 'bold' : 'normal',
      fill: textColor,
      align: textObj.align || 'center',
      lineHeight: 1.35,
      wrap: 'none',
      listening: true,
    });

    const textWidth = Math.ceil(konvaText.width());
    const textHeight = Math.ceil(konvaText.height());
    const boxW = Math.max(40, textWidth + pad * 2);
    const boxH = Math.max(26, textHeight + pad * 2);

    // إضافة هامش لعرض النص لمنع التفاف أي حرف أو ظهور عامود في نهاية السطر
    konvaText.width(textWidth + 14);

    // بطاقة الملاحظة: دائماً موجودة لضمان التقاط النقر والسحب عبر كامل مساحة النص
    const hasCustomBg = textObj.backgroundColor && textObj.backgroundColor !== 'transparent';
    const bgFill = hasCustomBg
      ? textObj.backgroundColor
      : isDark
      ? 'rgba(15, 23, 42, 0.88)'
      : 'rgba(255, 255, 255, 0.96)';
    const bgOpacity =
      textObj.backgroundOpacity !== undefined
        ? textObj.backgroundOpacity
        : isDark
        ? 0.88
        : 0.96;

    const cardBg = new Konva.Rect({
      id: textObj.id,
      name: 'text-bg',
      x: 0,
      y: 0,
      width: boxW,
      height: boxH,
      fill: bgFill,
      opacity: bgOpacity,
      cornerRadius: 4,
      stroke: isSelected ? (isDark ? '#38bdf8' : '#0284c7') : (isDark ? '#334155' : '#cbd5e1'),
      strokeWidth: isSelected ? 1.5 : 0.8,
      shadowColor: isSelected ? '#38bdf8' : isDark ? '#000000' : '#64748b',
      shadowBlur: isSelected ? 6 : 2,
      shadowOpacity: isSelected ? 0.35 : 0.15,
      listening: true,
    });
    group.add(cardBg);
    group.add(konvaText);

    // إطار وهالة التحديد المنقطة عند اختيار الملاحظة
    if (isSelected) {
      group.add(
        new Konva.Rect({
          x: -3,
          y: -3,
          width: boxW + 6,
          height: boxH + 6,
          stroke: isDark ? '#38bdf8' : '#0284c7',
          strokeWidth: 1.5,
          dash: [4, 4],
          cornerRadius: 6,
          listening: false,
        })
      );
    }

    group.on('mouseenter', () => {
      if (this.toolMode === 'select' && !isLocked) {
        this.stage.container().style.cursor = isSelected ? 'move' : 'pointer';
      }
    });

    group.on('mouseleave', () => {
      this.updateCursor();
    });

    group.on('mousedown touchstart', (e) => {
      if (e.evt && e.evt.button !== 0 && !e.evt.touches) return;
      if (this.toolMode !== 'select' || this.selectionSubMode === 'box') return;
      e.cancelBubble = true;
      if (!this.selectedObjectIds.includes(textObj.id)) {
        if (e.evt?.shiftKey || this.selectionSubMode === 'multi') {
          this.toggleObjectSelection(textObj.id);
        } else {
          this.selectObject(textObj.id);
        }
      }
    });

    group.on('click tap', (e) => {
      if (e.evt && e.evt.button !== 0 && !e.evt.touches) return;
      if (this.toolMode !== 'select' || this.selectionSubMode === 'box') return;
      e.cancelBubble = true;
      if (this.wasGroupDragged) return;
      if (e.evt.shiftKey || this.selectionSubMode === 'multi') {
        this.toggleObjectSelection(textObj.id);
      } else {
        this.selectObject(textObj.id);
      }
    });

    group.on('dblclick dbltap', (e) => {
      e.cancelBubble = true;
      this.selectObject(textObj.id);
      this.setToolMode('select');
    });

    group.on('dragstart', (e) => {
      e.cancelBubble = true;
      this.wasGroupDragged = true;
      this.onGroupDragStart(textObj.id);
    });

    group.on('dragmove', (e) => {
      e.cancelBubble = true;
      this.onGroupDragMove(textObj.id, { x: group.x(), y: group.y() });
    });

    group.on('dragend', (e) => {
      e.cancelBubble = true;
      if (this.onGroupDragEnd(textObj.id, { x: group.x(), y: group.y() })) {
        this.render();
        return;
      }
      const dxScreen = group.x() - sPos.x;
      const dyScreen = group.y() - sPos.y;
      const dxWorld = dxScreen / zoom;
      const dyWorld = dyScreen / zoom;

      group.position({ x: sPos.x, y: sPos.y });

      if (Math.abs(dxWorld) > 0.01 || Math.abs(dyWorld) > 0.01) {
        this.wasGroupDragged = true;
        this.model.updateObject(textObj.id, {
          x: Math.round(textObj.x + dxWorld),
          y: Math.round(textObj.y + dyWorld),
        });
      }
      setTimeout(() => {
        this.wasGroupDragged = false;
      }, 120);
      this.render();
    });

    this.objectsLayer.add(group);
  }

export function renderDimensionImpl(this: CadEngine, dim: DimensionObject, isLocked: boolean): void {
    const isSelected = this.isObjectSelected(dim.id);
    const zoom = this.camera.getState().zoom;
    const meta = this.model.getMeta();
    const pixelsPerMeter = meta.scale || 50;

    const sScreen = this.camera.worldToScreen(dim.start);
    const eScreen = this.camera.worldToScreen(dim.end);

    const dx = eScreen.x - sScreen.x;
    const dy = eScreen.y - sScreen.y;
    const screenLen = Math.sqrt(dx * dx + dy * dy);
    if (screenLen === 0) return;

    const ux = dx / screenLen;
    const uy = dy / screenLen;
    const nx = -uy;
    const ny = ux;

    const offsetScreen = (dim.offset || 20) * zoom;

    // خط البعد الرئيسي المزاح
    const p1 = { x: sScreen.x + nx * offsetScreen, y: sScreen.y + ny * offsetScreen };
    const p2 = { x: eScreen.x + nx * offsetScreen, y: eScreen.y + ny * offsetScreen };

    const group = new Konva.Group({
      id: dim.id,
      draggable: !isLocked && this.toolMode === 'select' && this.selectionSubMode !== 'box',
    });

    const isDark = this.theme === 'dark';
    const dimColor = isSelected ? (isDark ? '#38bdf8' : '#0284c7') : (isDark ? '#38bdf8' : '#0284c7');
    const dimBgColor = isDark ? '#0f172a' : '#ffffff';
    const dimTextColor = isSelected ? (isDark ? '#38bdf8' : '#0284c7') : (isDark ? '#ffffff' : '#0f172a');
    const witnessColor = isDark ? '#475569' : '#64748b';

    // 1. خطوط الامتداد (Witness lines / Extension lines)
    group.add(
      new Konva.Line({
        points: [
          sScreen.x,
          sScreen.y,
          p1.x + nx * 5,
          p1.y + ny * 5,
        ],
        stroke: witnessColor,
        strokeWidth: 1,
        dash: [2, 2],
      })
    );
    group.add(
      new Konva.Line({
        points: [
          eScreen.x,
          eScreen.y,
          p2.x + nx * 5,
          p2.y + ny * 5,
        ],
        stroke: witnessColor,
        strokeWidth: 1,
        dash: [2, 2],
      })
    );

    // 2. خط البعد الرئيسي
    group.add(
      new Konva.Line({
        points: [p1.x, p1.y, p2.x, p2.y],
        stroke: dimColor,
        strokeWidth: 1.5,
      })
    );

    // 3. علامات الأطراف الهندسية المعمارية (Architectural 45° Ticks)
    const tickLen = 6;
    group.add(
      new Konva.Line({
        points: [
          p1.x - (ux - nx) * tickLen,
          p1.y - (uy - ny) * tickLen,
          p1.x + (ux - nx) * tickLen,
          p1.y + (uy - ny) * tickLen,
        ],
        stroke: dimColor,
        strokeWidth: 2,
      })
    );
    group.add(
      new Konva.Line({
        points: [
          p2.x - (ux - nx) * tickLen,
          p2.y - (uy - ny) * tickLen,
          p2.x + (ux - nx) * tickLen,
          p2.y + (uy - ny) * tickLen,
        ],
        stroke: dimColor,
        strokeWidth: 2,
      })
    );

    // 4. كتابة البعد الهندسي الحقيقي
    const lengthWorld = SnapEngine.distance(dim.start, dim.end);
    const displayText =
      dim.displayText || GridUtils.formatLength(lengthWorld, pixelsPerMeter, meta.unit);

    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    const readableAngle = angleDeg > 90 || angleDeg < -90 ? angleDeg + 180 : angleDeg;

    const textBadge = new Konva.Group({
      x: midX,
      y: midY,
      rotation: readableAngle,
    });

    const finalLabel = dim.label ? `${dim.label}: ${displayText}` : displayText;

    const dimText = new Konva.Text({
      text: finalLabel,
      fontSize: 11,
      fontFamily: 'JetBrains Mono',
      fill: dimTextColor,
      padding: 2,
      align: 'center',
    });

    const dimBg = new Konva.Rect({
      width: dimText.width() + 6,
      height: dimText.height() + 2,
      fill: dimBgColor,
      stroke: dimColor,
      strokeWidth: 0.8,
      cornerRadius: 3,
      offsetX: (dimText.width() + 6) / 2,
      offsetY: (dimText.height() + 2) / 2,
    });

    dimText.offsetX(dimText.width() / 2);
    dimText.offsetY(dimText.height() / 2);

    textBadge.add(dimBg);
    textBadge.add(dimText);
    group.add(textBadge);

    // هالة التحديد
    if (isSelected) {
      group.add(
        new Konva.Line({
          points: [p1.x, p1.y, p2.x, p2.y],
          stroke: '#38bdf8',
          strokeWidth: 10,
          opacity: 0.25,
          lineCap: 'round',
        })
      );
    }

    group.on('mousedown touchstart', (e) => {
      if (e.evt && e.evt.button !== 0 && !e.evt.touches) return;
      if (this.toolMode !== 'select' || this.selectionSubMode === 'box') return;
      e.cancelBubble = true;
      if (!this.selectedObjectIds.includes(dim.id)) {
        if (e.evt?.shiftKey || this.selectionSubMode === 'multi') {
          this.toggleObjectSelection(dim.id);
        } else {
          this.selectObject(dim.id);
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
        this.toggleObjectSelection(dim.id);
      } else {
        this.selectObject(dim.id);
      }
    });

    group.on('dragstart', () => {
      this.onGroupDragStart(dim.id);
    });

    group.on('dragmove', () => {
      this.onGroupDragMove(dim.id, { x: group.x(), y: group.y() });
    });

    group.on('dragend', () => {
      if (this.onGroupDragEnd(dim.id, { x: group.x(), y: group.y() })) {
        return;
      }
      const dxScreen = group.x();
      const dyScreen = group.y();
      const dxWorld = dxScreen / zoom;
      const dyWorld = dyScreen / zoom;

      group.position({ x: 0, y: 0 });

      if (Math.abs(dxWorld) > 0.01 || Math.abs(dyWorld) > 0.01) {
        this.wasGroupDragged = true;
        this.model.updateObject(dim.id, {
          start: { x: dim.start.x + dxWorld, y: dim.start.y + dyWorld },
          end: { x: dim.end.x + dxWorld, y: dim.end.y + dyWorld },
        });
      }
      setTimeout(() => {
        this.wasGroupDragged = false;
      }, 120);
    });

    this.objectsLayer.add(group);
  }
