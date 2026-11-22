/**
 * @file structureCommands.ts
 * @description أمرا العناصر الإنشائية:
 *  - عمود (col): نقرة لكل عمود (يتكرر حتى Esc)؛ اكتب المقاس بالمتر: 0.3 (مربع) أو 0.3x0.5
 *  - درج (st): نقطة أسفل الدرج ثم أعلاه (أو الطول بالمتر)؛ قبل النقرة الأولى اكتب العرض بالمتر لتغييره
 */
import Konva from 'konva';
import type { ColumnObject, StairObject } from '../../model/types.ts';
import { stairsGeometry, DEFAULT_TREAD, DEFAULT_RISER } from '../../model/stairs.ts';
import { registerCommand, parseNumbers } from './commandRegistry.ts';
import { constrained } from './editCommands.ts';
import { drawStairsShapes } from '../render/structure.ts';
import type { CadEngine } from '../renderer.ts';

/** آخر مقاسات مستخدمة (بالمتر) — تبقى طوال الجلسة */
const last = { colW: 0.3, colD: 0.3, colShape: 'rect' as 'rect' | 'round', stairW: 1.2 };
const ppmOf = (e: CadEngine) => e.model.getMeta().scale || 50;
const newId = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
const r2 = (v: number) => Math.round(v * 100) / 100;

registerCommand('column', {
  name: 'عمود',
  needsSelection: false,
  prompt: () => `عمود ${Math.round(last.colW * 100)}×${Math.round(last.colD * 100)} سم: انقر لوضع عمود (يتكرر حتى Esc) — أو اكتب المقاس بالمتر مثل 0.3 أو 0.3x0.5`,
  awaitingValue: () => true,
  click(engine, _c, p) {
    const ppm = ppmOf(engine);
    const col: ColumnObject = {
      id: newId('col'),
      type: 'column',
      layerId: engine.model.getLayers().some((l) => l.id === 'arch') ? 'arch' : engine.model.getActiveLayerId(),
      x: r2(p.x),
      y: r2(p.y),
      width: r2(last.colW * ppm),
      depth: r2((last.colShape === 'round' ? last.colW : last.colD) * ppm),
      rotation: 0,
      shape: last.colShape,
    };
    engine.model.addObjects([col], 'إضافة عمود');
    return false; // يبقى الأمر نشطاً لوضع أعمدة أخرى
  },
  value(engine, _c, text) {
    const t = text.trim();
    // المقاس: رقم واحد (عمود مربع) أو "العرض×العمق" مثل 0.3x0.5 — أما x,y و@dx,dy فهي نقاط
    const size = t.match(/^(\d*\.?\d+)\s*[x×*]\s*(\d*\.?\d+)$/i);
    if (size) {
      const [w, d] = [Number(size[1]), Number(size[2])];
      if (!(w > 0 && d > 0 && w < 10 && d < 10)) return 'مقاس غير منطقي';
      last.colW = w;
      last.colD = d;
      return null;
    }
    const n = parseNumbers(t);
    if (n.length === 1 && n[0] > 0 && n[0] < 10 && !t.startsWith('@')) {
      last.colW = n[0];
      last.colD = n[0];
      return null;
    }
    return engine.applyPointInput(t);
  },
  preview(engine, _c, cursor) {
    const ppm = ppmOf(engine);
    const zoom = engine.camera.getState().zoom;
    const s = engine.camera.worldToScreen(cursor);
    const w = last.colW * ppm * zoom;
    const d = last.colD * ppm * zoom;
    engine.interactionLayer.add(new Konva.Rect({ x: s.x - w / 2, y: s.y - d / 2, width: w, height: d, stroke: '#38bdf8', dash: [4, 3], strokeWidth: 1.2, listening: false }));
  },
});

registerCommand('stairs', {
  name: 'درج',
  needsSelection: false,
  prompt: (_e, c) =>
    (c.pts?.length ?? 0) === 0
      ? `درج بعرض ${last.stairW} م: حدد بداية الصعود (أسفل الدرج) — أو اكتب العرض بالمتر`
      : 'حدد نهاية الدرج (أعلاه) أو اكتب الطول بالمتر — عدد الدرجات يُحسب تلقائياً',
  awaitingValue: (_e, c) => (c.pts?.length ?? 0) === 0,
  click(engine, c, p, objectSnapped, shift) {
    c.pts ??= [];
    if (c.pts.length === 0) {
      c.pts.push({ ...p });
      c.base = { ...p };
      c.step = 1;
      return false;
    }
    const end = constrained(engine, c.pts[0], p, objectSnapped, shift);
    if (Math.hypot(end.x - c.pts[0].x, end.y - c.pts[0].y) < 5) return false;
    const st: StairObject = {
      id: newId('stairs'),
      type: 'stairs',
      layerId: engine.model.getLayers().some((l) => l.id === 'arch') ? 'arch' : engine.model.getActiveLayerId(),
      start: { x: r2(c.pts[0].x), y: r2(c.pts[0].y) },
      end: { x: r2(end.x), y: r2(end.y) },
      width: r2(last.stairW * ppmOf(engine)),
      tread: DEFAULT_TREAD,
      riser: DEFAULT_RISER,
    };
    engine.model.addObjects([st], `إضافة درج (${stairsGeometry(st, ppmOf(engine)).treads} درجة)`);
    engine.selectObject(st.id);
    return true;
  },
  value(engine, c, text) {
    const n = parseNumbers(text);
    if ((c.pts?.length ?? 0) === 0 && n.length === 1 && n[0] > 0 && n[0] < 10) {
      last.stairW = n[0];
      return null;
    }
    return engine.applyPointInput(text);
  },
  preview(engine, c, cursor, shift) {
    if (!c.pts?.length) return;
    const end = constrained(engine, c.pts[0], cursor, engine.currentSnapResult.snapped && engine.currentSnapResult.type !== 'grid', shift);
    const ghost: StairObject = { id: 'ghost', type: 'stairs', layerId: 'arch', start: c.pts[0], end, width: last.stairW * ppmOf(engine) };
    drawStairsShapes(engine, engine.interactionLayer, ghost, '#38bdf8', { preview: true });
  },
});
