/**
 * @file linework.ts
 * @description رسم الخطوط الحرة (LineObject): خطوط DXF المستوردة، الأقواس والدوائر بعد تقريبها، ومحتوى الكتل.
 * سماكتها ثابتة بالبكسل على الشاشة (كخطوط CAD)، قابلة للتحديد والسحب والتحويل كبقية العناصر.
 */

import Konva from 'konva';
import type { LineObject } from '../../model/types.ts';
import type { CadEngine } from '../renderer.ts';

export function renderLineworkImpl(this: CadEngine, line: LineObject, isLocked: boolean, layerColor: string, layerOpacity: number): void {
  if (!line.points || line.points.length < 2) return;
  const isSelected = this.isObjectSelected(line.id);
  const zoom = this.camera.getState().zoom;
  const pts: number[] = [];
  for (const p of line.points) {
    const s = this.camera.worldToScreen(p);
    pts.push(s.x, s.y);
  }
  const isDark = this.theme === 'dark';
  let color = line.color || layerColor || '#94a3b8';
  if (!isDark && (color === '#f3f4f6' || color === '#ffffff' || color === '#e2e8f0' || color === '#f8fafc')) color = '#334155';

  const group = new Konva.Group({
    id: line.id,
    opacity: layerOpacity,
    draggable: !isLocked && this.toolMode === 'select' && this.selectionSubMode !== 'box',
  });
  const width = line.strokeWidth || 1.2;
  if (isSelected) {
    group.add(
      new Konva.Line({ points: pts, closed: line.closed, stroke: '#38bdf8', strokeWidth: width + 6, opacity: 0.35, lineJoin: 'round', lineCap: 'round', listening: false })
    );
  }
  group.add(
    new Konva.Line({
      points: pts,
      closed: line.closed,
      stroke: isSelected ? '#38bdf8' : color,
      strokeWidth: width,
      hitStrokeWidth: Math.max(14, width + 10),
      dash: line.lineStyle === 'dashed' ? [10, 6] : line.lineStyle === 'dotted' ? [2, 6] : undefined,
      lineJoin: 'round',
      lineCap: 'round',
      fillEnabled: false,
      perfectDrawEnabled: false,
    })
  );

  group.on('mousedown touchstart', (e) => {
    if (e.evt && (e.evt as MouseEvent).button !== 0 && !(e.evt as TouchEvent).touches) return;
    if (this.toolMode !== 'select' || this.selectionSubMode === 'box') return;
    e.cancelBubble = true;
    if (!this.selectedObjectIds.includes(line.id)) {
      if ((e.evt as MouseEvent)?.shiftKey || this.selectionSubMode === 'multi') {
        this.toggleObjectSelection(line.id);
      } else {
        // مثل الجدران: نحدّث التحديد دون إعادة البناء حتى لا تُهدم العقدة قبل بدء السحب
        this.selectedObjectId = line.id;
        this.selectedObjectIds = [line.id];
        this.callbacks.onSelectObject(line.id);
        this.callbacks.onSelectObjects?.([line.id]);
      }
    }
  });
  group.on('click tap', (e) => {
    if (e.evt && (e.evt as MouseEvent).button !== 0 && !(e.evt as TouchEvent).touches) return;
    if (this.toolMode !== 'select' || this.selectionSubMode === 'box') return;
    e.cancelBubble = true;
    if (this.wasGroupDragged) return;
    if ((e.evt as MouseEvent)?.shiftKey || this.selectionSubMode === 'multi') this.toggleObjectSelection(line.id);
    else this.selectObject(line.id);
  });
  group.on('dragstart', () => {
    if (!this.selectedObjectIds.includes(line.id)) {
      this.selectedObjectId = line.id;
      this.selectedObjectIds = [line.id];
      this.callbacks.onSelectObject(line.id);
      this.callbacks.onSelectObjects?.([line.id]);
    }
    this.onGroupDragStart(line.id);
  });
  group.on('dragmove', () => this.onGroupDragMove(line.id, { x: group.x(), y: group.y() }));
  group.on('dragend', () => {
    if (this.onGroupDragEnd(line.id, { x: group.x(), y: group.y() })) return;
    const dx = group.x() / zoom;
    const dy = group.y() / zoom;
    group.position({ x: 0, y: 0 });
    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
      this.wasGroupDragged = true;
      this.model.moveObjects([line.id], { x: dx, y: dy });
    }
    setTimeout(() => {
      this.wasGroupDragged = false;
    }, 120);
    this.render();
  });
  this.objectsLayer.add(group);
}
