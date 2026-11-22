/**
 * @file drawCommands.ts
 * @description أوامر رسم الأشكال: مستطيل (rec) · دائرة (c) · قوس من 3 نقاط (a) · مضلع منتظم (pol).
 * تعمل بالنقر مع الالتقاط، أو بإدخال القيم في شريط الأوامر (أبعاد/نصف قطر بالمتر، x,y، @dx,dy).
 * الناتج خط حر (LineObject) على الطبقة النشطة، بخطوة تراجع واحدة.
 */
import Konva from 'konva';
import type { LineObject, Point } from '../../model/types.ts';
import { rectPoints, circlePoints, arcThrough, polygonPoints } from '../../model/shapes.ts';
import { registerCommand, parseNumbers } from './commandRegistry.ts';
import type { CadEngine } from '../renderer.ts';
import type { EditCommandState } from './editCommands.ts';

const PREVIEW = '#38bdf8';

function addShape(engine: CadEngine, points: Point[], closed: boolean, name: string): void {
  const obj: LineObject = {
    id: `line_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    type: 'line',
    layerId: engine.model.getActiveLayerId(),
    points,
    closed,
  };
  engine.model.addObjects([obj], name);
}

function drawPreview(engine: CadEngine, pts: Point[], closed: boolean): void {
  if (pts.length < 2) return;
  const flat = pts.flatMap((p) => {
    const s = engine.camera.worldToScreen(p);
    return [s.x, s.y];
  });
  engine.interactionLayer.add(new Konva.Line({ points: flat, closed, stroke: PREVIEW, strokeWidth: 1.5, dash: [6, 4], listening: false }));
}

function marker(engine: CadEngine, p: Point): void {
  const s = engine.camera.worldToScreen(p);
  engine.interactionLayer.add(new Konva.Circle({ x: s.x, y: s.y, radius: 4, fill: '#f59e0b', listening: false }));
}

const pts = (c: EditCommandState) => (c.pts ??= []);
/** نص نقطة (@dx,dy أو x,y) يُمرَّر لإدخال النقاط المعتاد بدل تفسيره كقيمة */
const asPoint = (engine: CadEngine, text: string) => engine.applyPointInput(text);
const ppmOf = (e: CadEngine) => e.model.getMeta().scale || 50;

// ─── مستطيل: ركنان، أو ركن ثم "العرض,الارتفاع" بالمتر ───
registerCommand('rect', {
  name: 'مستطيل',
  needsSelection: false,
  prompt: (_e, c) => (pts(c).length === 0 ? 'مستطيل: حدد الركن الأول' : 'حدد الركن المقابل، أو اكتب العرض,الارتفاع بالمتر (مثل 4,3)'),
  awaitingValue: (_e, c) => pts(c).length === 1,
  click(engine, c, p) {
    const P = pts(c);
    if (P.length === 0) {
      P.push({ ...p });
      c.base = { ...p };
      c.step = 1;
      return false;
    }
    if (Math.abs(p.x - P[0].x) < 1e-6 || Math.abs(p.y - P[0].y) < 1e-6) return false;
    addShape(engine, rectPoints(P[0], p), true, 'رسم مستطيل');
    return true;
  },
  value(engine, c, text) {
    const P = pts(c);
    if (text.trim().startsWith('@')) return asPoint(engine, text);
    const n = parseNumbers(text);
    if (P.length === 0) return 'حدد الركن الأول بالنقر أو اكتب x,y';
    if (n.length !== 2 || !n.every((v) => isFinite(v) && v !== 0)) return 'اكتب العرض,الارتفاع بالمتر مثل 4,3';
    const ppm = ppmOf(engine);
    addShape(engine, rectPoints(P[0], { x: P[0].x + n[0] * ppm, y: P[0].y + n[1] * ppm }), true, 'رسم مستطيل');
    return true;
  },
  preview(engine, c, cursor) {
    const P = pts(c);
    if (P.length === 1) {
      marker(engine, P[0]);
      drawPreview(engine, rectPoints(P[0], cursor), true);
    }
  },
});

// ─── دائرة: المركز ثم نقطة على المحيط أو نصف القطر بالمتر ───
registerCommand('circle', {
  name: 'دائرة',
  needsSelection: false,
  prompt: (_e, c) => (pts(c).length === 0 ? 'دائرة: حدد المركز' : 'حدد نقطة على المحيط، أو اكتب نصف القطر بالمتر'),
  awaitingValue: (_e, c) => pts(c).length === 1,
  click(engine, c, p) {
    const P = pts(c);
    if (P.length === 0) {
      P.push({ ...p });
      c.base = { ...p };
      c.step = 1;
      return false;
    }
    const r = Math.hypot(p.x - P[0].x, p.y - P[0].y);
    if (r < 1e-6) return false;
    addShape(engine, circlePoints(P[0], r), true, 'رسم دائرة');
    return true;
  },
  value(engine, c, text) {
    const P = pts(c);
    if (P.length === 0) return 'حدد المركز بالنقر أو اكتب x,y';
    if (/[@,،]/.test(text)) return asPoint(engine, text);
    const n = parseNumbers(text);
    if (n.length !== 1 || !(n[0] > 0)) return 'اكتب نصف القطر بالمتر مثل 1.5';
    addShape(engine, circlePoints(P[0], n[0] * ppmOf(engine)), true, 'رسم دائرة');
    return true;
  },
  preview(engine, c, cursor) {
    const P = pts(c);
    if (P.length === 1) {
      marker(engine, P[0]);
      const r = Math.hypot(cursor.x - P[0].x, cursor.y - P[0].y);
      if (r > 0.5) drawPreview(engine, circlePoints(P[0], r), true);
    }
  },
});

// ─── قوس من ثلاث نقاط: البداية، نقطة عليه، النهاية ───
registerCommand('arc', {
  name: 'قوس',
  needsSelection: false,
  prompt: (_e, c) => ['قوس: حدد نقطة البداية', 'حدد نقطة يمر بها القوس', 'حدد نقطة النهاية'][Math.min(2, pts(c).length)],
  click(engine, c, p) {
    const P = pts(c);
    if (P.length < 2) {
      if (P.length === 1 && Math.hypot(p.x - P[0].x, p.y - P[0].y) < 1e-6) return false;
      P.push({ ...p });
      c.base = { ...p };
      c.step = P.length;
      return false;
    }
    const arc = arcThrough(P[0], P[1], p);
    if (!arc) {
      engine.editMessage = 'النقاط الثلاث على استقامة واحدة';
      return false;
    }
    engine.editMessage = null;
    addShape(engine, arc, false, 'رسم قوس');
    return true;
  },
  preview(engine, c, cursor) {
    const P = pts(c);
    P.forEach((q) => marker(engine, q));
    if (P.length === 1) drawPreview(engine, [P[0], cursor], false);
    if (P.length === 2) {
      const arc = arcThrough(P[0], P[1], cursor);
      if (arc) drawPreview(engine, arc, false);
    }
  },
});

// ─── مضلع منتظم: (اختياري) عدد الأضلاع، المركز، ثم رأس أو نصف القطر ───
registerCommand('polygon', {
  name: 'مضلع',
  needsSelection: false,
  prompt: (_e, c) => {
    const sides = (c.data?.sides as number) || 6;
    return pts(c).length === 0
      ? `مضلع (${sides} أضلاع): حدد المركز — أو اكتب عدد الأضلاع أولاً`
      : 'حدد رأس المضلع، أو اكتب نصف القطر بالمتر';
  },
  click(engine, c, p) {
    const P = pts(c);
    const sides = (c.data?.sides as number) || 6;
    if (P.length === 0) {
      P.push({ ...p });
      c.base = { ...p };
      c.step = 1;
      return false;
    }
    if (Math.hypot(p.x - P[0].x, p.y - P[0].y) < 1e-6) return false;
    addShape(engine, polygonPoints(P[0], p, sides), true, `رسم مضلع ${sides} أضلاع`);
    return true;
  },
  value(engine, c, text) {
    const P = pts(c);
    if (/[@,،]/.test(text)) return asPoint(engine, text);
    const n = parseNumbers(text);
    if (n.length !== 1 || !isFinite(n[0])) return P.length === 0 ? 'اكتب عدد الأضلاع (3 إلى 64)' : 'اكتب نصف القطر بالمتر';
    if (P.length === 0) {
      if (!Number.isInteger(n[0]) || n[0] < 3 || n[0] > 64) return 'عدد الأضلاع من 3 إلى 64';
      c.data = { ...(c.data || {}), sides: n[0] };
      return null;
    }
    if (!(n[0] > 0)) return 'نصف القطر يجب أن يكون موجباً';
    const sides = (c.data?.sides as number) || 6;
    const r = n[0] * ppmOf(engine);
    // الرأس الأول أعلى المركز (مضلع قائم)
    addShape(engine, polygonPoints(P[0], { x: P[0].x, y: P[0].y - r }, sides), true, `رسم مضلع ${sides} أضلاع`);
    return true;
  },
  // رقم واحد = عدد الأضلاع (قبل المركز) أو نصف القطر (بعده)؛ x,y و@dx,dy تبقى نقاطاً
  awaitingValue: () => true,
  preview(engine, c, cursor) {
    const P = pts(c);
    if (P.length === 1) {
      marker(engine, P[0]);
      if (Math.hypot(cursor.x - P[0].x, cursor.y - P[0].y) > 0.5) drawPreview(engine, polygonPoints(P[0], cursor, (c.data?.sides as number) || 6), true);
    }
  },
});
