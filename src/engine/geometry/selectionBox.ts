/**
 * @file selectionBox.ts
 * @description فحص وقوع العناصر داخل مربع التحديد (Marquee)
 */

import { Point, ProjectObject, WallObject, DoorObject, WindowObject, DimensionObject, SymbolObject, RouteObject, TextObject } from '../../model/types.ts';

export interface BoxRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function pointInBox(p: Point, box: BoxRect): boolean {
  return p.x >= box.minX && p.x <= box.maxX && p.y >= box.minY && p.y <= box.maxY;
}

export function segmentIntersectsBox(p1: Point, p2: Point, box: BoxRect): boolean {
  if (pointInBox(p1, box) || pointInBox(p2, box)) return true;
  const minX = Math.min(p1.x, p2.x);
  const maxX = Math.max(p1.x, p2.x);
  const minY = Math.min(p1.y, p2.y);
  const maxY = Math.max(p1.y, p2.y);
  if (maxX < box.minX || minX > box.maxX || maxY < box.minY || minY > box.maxY) return false;
  return true;
}

export function isObjectInBox(obj: ProjectObject, box: BoxRect, allObjects?: ProjectObject[]): boolean {
  if (obj.type === 'wall') {
    const wall = obj as WallObject;
    return segmentIntersectsBox(wall.start, wall.end, box);
  }
  if (obj.type === 'symbol') {
    const sym = obj as SymbolObject;
    return (
      pointInBox({ x: sym.x, y: sym.y }, box) ||
      (sym.x >= box.minX - 15 && sym.x <= box.maxX + 15 && sym.y >= box.minY - 15 && sym.y <= box.maxY + 15)
    );
  }
  if (obj.type === 'line') {
    const ln = obj as { points: Point[]; closed?: boolean };
    if (!ln.points || ln.points.length === 0) return false;
    for (let i = 0; i < ln.points.length - 1; i++) {
      if (segmentIntersectsBox(ln.points[i], ln.points[i + 1], box)) return true;
    }
    if (ln.closed && ln.points.length > 2 && segmentIntersectsBox(ln.points[ln.points.length - 1], ln.points[0], box)) return true;
    return pointInBox(ln.points[0], box);
  }
  if (obj.type === 'route') {
    const rt = obj as RouteObject;
    if (!rt.points || rt.points.length === 0) return false;
    for (let i = 0; i < rt.points.length - 1; i++) {
      if (segmentIntersectsBox(rt.points[i], rt.points[i + 1], box)) return true;
    }
    return pointInBox(rt.points[0], box);
  }
  if (obj.type === 'dimension') {
    const dim = obj as DimensionObject;
    return segmentIntersectsBox(dim.start, dim.end, box);
  }
  if (obj.type === 'door' || obj.type === 'window') {
    const item = obj as DoorObject | WindowObject;
    if (allObjects) {
      const parentWall = allObjects.find((o) => o.id === item.wallId) as WallObject | undefined;
      if (parentWall) {
        const cx = parentWall.start.x + item.position * (parentWall.end.x - parentWall.start.x);
        const cy = parentWall.start.y + item.position * (parentWall.end.y - parentWall.start.y);
        return (
          pointInBox({ x: cx, y: cy }, box) ||
          (cx >= box.minX - 12 && cx <= box.maxX + 12 && cy >= box.minY - 12 && cy <= box.maxY + 12)
        );
      }
    }
    return false;
  }
  if (obj.type === 'column') {
    const c = obj as unknown as { x: number; y: number; width: number; depth: number };
    const r = Math.max(c.width, c.depth) / 2;
    return c.x + r >= box.minX && c.x - r <= box.maxX && c.y + r >= box.minY && c.y - r <= box.maxY;
  }
  if (obj.type === 'stairs') {
    const st = obj as unknown as { start: Point; end: Point };
    return pointInBox(st.start, box) || pointInBox(st.end, box) || segmentIntersectsBox(st.start, st.end, box);
  }
  if (obj.type === 'room') {
    // بطاقة الغرفة: صندوق تقريبي حول نقطة الارتكاز (البطاقة متمركزة عليها)
    const r = obj as unknown as { x: number; y: number };
    return r.x + 40 >= box.minX && r.x - 40 <= box.maxX && r.y + 20 >= box.minY && r.y - 20 <= box.maxY;
  }
  if (obj.type === 'text') {
    const txt = obj as TextObject;
    const pad = txt.padding || 6;
    const estW = Math.max(50, (txt.text?.length || 8) * (txt.fontSize || 14) * 0.65 + pad * 2);
    const estH = Math.max(28, (txt.fontSize || 14) * 1.5 + pad * 2);
    return (
      pointInBox({ x: txt.x, y: txt.y }, box) ||
      pointInBox({ x: txt.x + estW, y: txt.y + estH }, box) ||
      (txt.x <= box.maxX && txt.x + estW >= box.minX && txt.y <= box.maxY && txt.y + estH >= box.minY)
    );
  }
  return false;
}
