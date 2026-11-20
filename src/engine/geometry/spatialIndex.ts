/**
 * @file spatialIndex.ts
 * @description فهرس مكاني شبكي (Uniform Grid Hash) لعناصر المخطط.
 * يُستخدم لتسريع الالتقاط في المخططات الضخمة: بدلاً من فحص كل العناصر مع كل حركة فأرة
 * نفحص فقط العناصر الواقعة في الخلايا القريبة من المؤشر.
 */

import type { ProjectObject, WallObject, DoorObject, DimensionObject, SymbolObject, RouteObject, TextObject } from '../../model/types.ts';

interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export class SpatialIndex {
  private cells = new Map<string, ProjectObject[]>();
  private cellSize: number;
  /** عناصر بلا موضع محدد (احتياط) تُعاد دائماً */
  private unplaced: ProjectObject[] = [];

  constructor(objects: ProjectObject[], cellSize = 250) {
    this.cellSize = cellSize;
    const walls = new Map<string, WallObject>();
    for (const o of objects) if (o.type === 'wall') walls.set(o.id, o as WallObject);
    for (const o of objects) {
      const b = boxOf(o, walls);
      if (!b) {
        this.unplaced.push(o);
        continue;
      }
      const x0 = Math.floor(b.minX / cellSize);
      const x1 = Math.floor(b.maxX / cellSize);
      const y0 = Math.floor(b.minY / cellSize);
      const y1 = Math.floor(b.maxY / cellSize);
      // عنصر ضخم جداً (يغطي آلاف الخلايا) نتركه في القائمة الدائمة بدلاً من تضخيم الفهرس
      if ((x1 - x0 + 1) * (y1 - y0 + 1) > 4000) {
        this.unplaced.push(o);
        continue;
      }
      for (let cx = x0; cx <= x1; cx++) {
        for (let cy = y0; cy <= y1; cy++) {
          const k = `${cx},${cy}`;
          const list = this.cells.get(k);
          if (list) list.push(o);
          else this.cells.set(k, [o]);
        }
      }
    }
  }

  /** العناصر القريبة من مستطيل (قد تتضمن عناصر أبعد قليلاً؛ الفحص الدقيق على المستدعي) */
  query(minX: number, minY: number, maxX: number, maxY: number): ProjectObject[] {
    const cs = this.cellSize;
    const seen = new Set<ProjectObject>();
    const out: ProjectObject[] = [...this.unplaced];
    for (let cx = Math.floor(minX / cs); cx <= Math.floor(maxX / cs); cx++) {
      for (let cy = Math.floor(minY / cs); cy <= Math.floor(maxY / cs); cy++) {
        const list = this.cells.get(`${cx},${cy}`);
        if (!list) continue;
        for (const o of list) {
          if (!seen.has(o)) {
            seen.add(o);
            out.push(o);
          }
        }
      }
    }
    return out;
  }
}

function boxOf(o: ProjectObject, walls: Map<string, WallObject>): Box | null {
  switch (o.type) {
    case 'wall':
    case 'dimension': {
      const w = o as WallObject | DimensionObject;
      const pad = o.type === 'wall' ? ((w as WallObject).thickness || 20) / 2 : 0;
      return {
        minX: Math.min(w.start.x, w.end.x) - pad,
        minY: Math.min(w.start.y, w.end.y) - pad,
        maxX: Math.max(w.start.x, w.end.x) + pad,
        maxY: Math.max(w.start.y, w.end.y) + pad,
      };
    }
    case 'door':
    case 'window': {
      const host = walls.get((o as DoorObject).wallId);
      return host ? boxOf(host, walls) : null;
    }
    case 'symbol':
    case 'text': {
      const s = o as SymbolObject | TextObject;
      return { minX: s.x, minY: s.y, maxX: s.x, maxY: s.y };
    }
    case 'route': {
      const pts = (o as RouteObject).points;
      if (pts.length === 0) return null;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of pts) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      return { minX, minY, maxX, maxY };
    }
  }
  return null;
}
