/**
 * @file blockCommands.ts
 * @description إدراج كتلة (insertblock): معاينة الكتلة تتبع المؤشر، نقرة للإدراج (يتكرر حتى Esc)،
 * واكتب زاوية بالدرجات (مثل 90) لتدوير الكتلة قبل الإدراج.
 */
import Konva from 'konva';
import type { Point, ProjectObject, SymbolObject, WallObject, LineObject } from '../../model/types.ts';
import { builtinBlocks, placeBlock, type BlockDef } from '../../model/blocks.ts';
import { getSymbolById } from '../../symbols/registry.ts';
import { registerCommand, parseNumbers } from './commandRegistry.ts';
import type { CadEngine } from '../renderer.ts';

export function findBlock(engine: CadEngine, id: string): BlockDef | undefined {
  const ppm = engine.model.getMeta().scale || 50;
  return builtinBlocks(ppm).find((b) => b.id === id) || engine.model.getBlocks().find((b) => b.id === id);
}

/** رسم عناصر (معاينة أو صورة مصغرة) داخل حاوية Konva بتحويل من العالم إلى الشاشة */
export function drawObjectsGhost(target: Konva.Container, objs: ProjectObject[], toS: (p: Point) => Point, zoom: number, color: string): void {
  for (const o of objs) {
    if (o.type === 'wall') {
      const w = o as WallObject;
      const a = toS(w.start);
      const b = toS(w.end);
      target.add(new Konva.Line({ points: [a.x, a.y, b.x, b.y], stroke: color, strokeWidth: Math.max(1.5, w.thickness * zoom), opacity: 0.45, listening: false }));
    } else if (o.type === 'line') {
      const l = o as LineObject;
      target.add(new Konva.Line({ points: l.points.flatMap((p) => { const s = toS(p); return [s.x, s.y]; }), closed: Boolean(l.closed), stroke: color, strokeWidth: 1.2, listening: false }));
    } else if (o.type === 'symbol') {
      const s = o as SymbolObject;
      const def = getSymbolById(s.symbolKind);
      const p = toS({ x: s.x, y: s.y });
      const g = new Konva.Group({ x: p.x, y: p.y, rotation: s.rotation || 0, scale: { x: (s.scale || 1) * zoom, y: (s.scale || 1) * zoom }, listening: false });
      if (def) def.renderKonva(g, { color, isSelected: false, zoom });
      else g.add(new Konva.Circle({ radius: 8, stroke: color }));
      target.add(g);
    } else if ('x' in o && 'y' in o) {
      const q = o as unknown as Point;
      const p = toS({ x: q.x, y: q.y });
      target.add(new Konva.Circle({ x: p.x, y: p.y, radius: 4, stroke: color, listening: false }));
    }
  }
}

registerCommand('insertblock', {
  name: 'إدراج كتلة',
  needsSelection: false,
  prompt(engine, c) {
    const b = findBlock(engine, String(c.data?.blockId || ''));
    const rot = Number(c.data?.rotation || 0);
    return b ? `إدراج «${b.name}»${rot ? ` (دوران ${rot}°)` : ''}: انقر لموضع الإدراج (يتكرر حتى Esc) — اكتب زاوية للتدوير مثل 90` : 'الكتلة غير موجودة';
  },
  awaitingValue: () => true,
  click(engine, c, p) {
    const b = findBlock(engine, String(c.data?.blockId || ''));
    if (!b) return true;
    const placed = placeBlock(b, p, Number(c.data?.rotation || 0));
    // الفرش في الكتل يذهب لطبقة الأثاث (تُنشأ إن لزم — المرحلة 20)
    if (placed.some((o) => o.layerId === 'furn')) engine.model.ensureLayer('furn');
    const layerIds = new Set(engine.model.getLayers().map((l) => l.id));
    const active = engine.model.getActiveLayerId();
    const objs = placed.map((o) => (layerIds.has(o.layerId) ? o : { ...o, layerId: active }));
    engine.model.addObjects(objs, `إدراج كتلة: ${b.name}`);
    engine.selectObjects(objs.map((o) => o.id));
    return false;
  },
  value(engine, c, text) {
    const t = text.trim();
    if (/[@,،]/.test(t)) return engine.applyPointInput(t);
    const n = parseNumbers(t);
    if (n.length !== 1 || !isFinite(n[0])) return 'اكتب زاوية بالدرجات مثل 90';
    c.data = { ...(c.data || {}), rotation: ((n[0] % 360) + 360) % 360 };
    return null;
  },
  preview(engine, c, cursor) {
    const b = findBlock(engine, String(c.data?.blockId || ''));
    if (!b) return;
    const objs = placeBlock(b, cursor, Number(c.data?.rotation || 0));
    drawObjectsGhost(engine.interactionLayer, objs, (p) => engine.camera.worldToScreen(p), engine.camera.getState().zoom, '#38bdf8');
  },
});
