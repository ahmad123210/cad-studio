/**
 * @file rooms.ts (render)
 * @description رسم الغرف: تعبئة خفيفة للمساحة الصافية تحت الجدران، وبطاقة الاسم والمساحة فوقها.
 * المضلع يُحسب من الجدران الحالية (model/rooms.ts) ويُخزَّن مؤقتاً حسب إصدار النموذج.
 */

import Konva from 'konva';
import type { RoomObject, WallObject, Point } from '../../model/types.ts';
import { buildRoomGraph, findRoomAt, roomLabelPoint, type RoomGraph, type RoomFace } from '../../model/rooms.ts';
import type { CadEngine } from '../renderer.ts';

const ROOM_COLOR = '#22c55e';

/** مخطط الغرف للوحة الحالية (مخزّن مؤقتاً حتى يتغير النموذج) */
export function getRoomGraphImpl(this: CadEngine): RoomGraph {
  const v = this.model.getVersion();
  if (this.roomGraphCache && this.roomGraphCache.version === v) return this.roomGraphCache.graph;
  const walls = this.model.getObjects().filter((o) => o.type === 'wall') as WallObject[];
  const graph = buildRoomGraph(walls);
  this.roomGraphCache = { version: v, graph };
  return graph;
}

/** يضيف بطاقة لكل غرفة مغلقة لا تحتوي بطاقة بعد. يعيد عدد الغرف المضافة */
export function detectRoomsImpl(this: CadEngine): number {
  const graph = this.getRoomGraph();
  const existing = this.model.getObjects().filter((o) => o.type === 'room') as RoomObject[];
  const taken = new Set<RoomFace>();
  for (const r of existing) {
    const f = findRoomAt(graph, { x: r.x, y: r.y });
    if (f) taken.add(f);
  }
  let next = existing.length + 1;
  const adds: RoomObject[] = [];
  for (const face of graph.rooms) {
    if (taken.has(face)) continue;
    // نتأكد أن نقطة البطاقة تقع في هذه الغرفة نفسها وليست في غرفة أصغر داخلها
    const p = roomLabelPoint(face);
    if (findRoomAt(graph, p) !== face) continue;
    adds.push({
      id: `room_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      type: 'room',
      layerId: 'arch',
      x: Math.round(p.x * 100) / 100,
      y: Math.round(p.y * 100) / 100,
      name: `غرفة ${next++}`,
    });
  }
  if (adds.length) this.model.addObjects(adds);
  return adds.length;
}

/** الوجه الهندسي الذي تقع فيه بطاقة الغرفة (أو null إن لم تعد الغرفة مغلقة) */
export function roomFaceOfImpl(this: CadEngine, room: RoomObject): RoomFace | null {
  return findRoomAt(this.getRoomGraph(), { x: room.x, y: room.y });
}

/** تعبئة المساحات (تُرسم قبل الجدران) */
export function renderRoomFillsImpl(this: CadEngine, rooms: RoomObject[]): void {
  if (rooms.length === 0) return;
  const isDark = this.theme === 'dark';
  for (const room of rooms) {
    const face = this.roomFaceOf(room);
    if (!face) continue;
    const sel = this.isObjectSelected(room.id);
    const pts = face.net.flatMap((p: Point) => {
      const s = this.camera.worldToScreen(p);
      return [s.x, s.y];
    });
    this.objectsLayer.add(
      new Konva.Line({
        points: pts,
        closed: true,
        fill: ROOM_COLOR,
        opacity: sel ? 0.16 : isDark ? 0.05 : 0.07,
        stroke: sel ? ROOM_COLOR : undefined,
        strokeWidth: sel ? 1.5 : 0,
        dash: sel ? [6, 4] : undefined,
        listening: false,
        perfectDrawEnabled: false,
      })
    );
  }
}

const fmtArea = (a: number) => a.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** بطاقات الغرف (تُرسم فوق كل شيء) */
export function renderRoomLabelImpl(this: CadEngine, room: RoomObject, isLocked: boolean, layerOpacity: number): void {
  const isSelected = this.isObjectSelected(room.id);
  const zoom = this.camera.getState().zoom;
  const sPos = this.camera.worldToScreen({ x: room.x, y: room.y });
  const isDark = this.theme === 'dark';
  const ppm = this.model.getMeta().scale || 50;
  const face = this.roomFaceOf(room);

  const nameSize = Math.max(9, Math.min(26, Math.round(13 * zoom)));
  const subSize = Math.max(8, Math.round(nameSize * 0.82));
  const main = isDark ? '#e5e7eb' : '#0f172a';
  const sub = face ? (isDark ? '#86efac' : '#15803d') : '#f59e0b';
  const subText = face ? `${fmtArea(face.netArea / (ppm * ppm))} م²${room.floorType ? ` · ${room.floorType}` : ''}` : 'غير مغلقة';

  const group = new Konva.Group({
    id: room.id,
    name: 'room-label',
    x: sPos.x,
    y: sPos.y,
    opacity: layerOpacity,
    draggable: !isLocked && this.toolMode === 'select',
  });
  const t1 = new Konva.Text({ text: room.name || 'غرفة', fontSize: nameSize, fontFamily: 'Cairo, sans-serif', fontStyle: 'bold', fill: main, align: 'center' });
  const t2 = new Konva.Text({ text: subText, fontSize: subSize, fontFamily: 'Cairo, sans-serif', fill: sub, align: 'center' });
  const w = Math.max(t1.width(), t2.width());
  const h = t1.height() + t2.height();
  const pad = Math.max(3, Math.round(4 * Math.min(zoom, 1.5)));
  t1.position({ x: -t1.width() / 2, y: -h / 2 });
  t2.position({ x: -t2.width() / 2, y: -h / 2 + t1.height() });
  group.add(
    new Konva.Rect({
      x: -w / 2 - pad,
      y: -h / 2 - pad,
      width: w + pad * 2,
      height: h + pad * 2,
      fill: isDark ? 'rgba(15,23,42,0.72)' : 'rgba(255,255,255,0.85)',
      stroke: isSelected ? ROOM_COLOR : 'transparent',
      strokeWidth: 1.5,
      dash: isSelected ? [4, 3] : undefined,
      cornerRadius: 4,
    })
  );
  group.add(t1);
  group.add(t2);

  group.on('mouseenter', () => {
    if (this.toolMode === 'select' && !isLocked) this.stage.container().style.cursor = isSelected ? 'move' : 'pointer';
  });
  group.on('mouseleave', () => this.updateCursor());
  group.on('mousedown touchstart', (e) => {
    if (e.evt && (e.evt as MouseEvent).button !== 0 && !(e.evt as TouchEvent).touches) return;
    if (this.toolMode !== 'select' || this.selectionSubMode === 'box') return;
    e.cancelBubble = true;
    if (!this.selectedObjectIds.includes(room.id)) {
      if ((e.evt as MouseEvent)?.shiftKey || this.selectionSubMode === 'multi') this.toggleObjectSelection(room.id);
      else this.selectObject(room.id);
    }
  });
  group.on('click tap', (e) => {
    if (e.evt && (e.evt as MouseEvent).button !== 0 && !(e.evt as TouchEvent).touches) return;
    if (this.toolMode !== 'select' || this.selectionSubMode === 'box') return;
    e.cancelBubble = true;
    if (this.wasGroupDragged) return;
    if ((e.evt as MouseEvent).shiftKey || this.selectionSubMode === 'multi') this.toggleObjectSelection(room.id);
    else this.selectObject(room.id);
  });
  group.on('dragstart', (e) => {
    e.cancelBubble = true;
    this.wasGroupDragged = true;
    this.onGroupDragStart(room.id);
  });
  group.on('dragmove', (e) => {
    e.cancelBubble = true;
    this.onGroupDragMove(room.id, { x: group.x(), y: group.y() });
  });
  group.on('dragend', (e) => {
    e.cancelBubble = true;
    if (this.onGroupDragEnd(room.id, { x: group.x(), y: group.y() })) {
      this.render();
      return;
    }
    const dx = (group.x() - sPos.x) / zoom;
    const dy = (group.y() - sPos.y) / zoom;
    group.position({ x: sPos.x, y: sPos.y });
    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
      this.model.updateObject(room.id, { x: Math.round((room.x + dx) * 100) / 100, y: Math.round((room.y + dy) * 100) / 100 });
    }
    setTimeout(() => {
      this.wasGroupDragged = false;
    }, 120);
    this.render();
  });
  this.objectsLayer.add(group);
}
