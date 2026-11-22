/**
 * @file moreEditCommands.ts
 * @description أوامر تحرير إضافية: وصل ركن (f) · شطف ركن (cha) · كسر (br) · دمج (j) · تمطيط (s) · أبعاد متسلسلة (dch).
 * الحسابات في model/editOps.ts (دوال صرفة مختبرة)، وهنا التفاعل والمعاينة فقط.
 */
import Konva from 'konva';
import type { Point, ProjectObject, WallObject, LineObject, RouteObject } from '../../model/types.ts';
import { planFillet, planChamfer, planBreak, planJoin, planStretch, chainDimensions, type BoxRect } from '../../model/editOps.ts';
import { SnapEngine } from '../snap.ts';
import { registerCommand, parseNumbers } from './commandRegistry.ts';
import type { CadEngine } from '../renderer.ts';
import type { EditCommandState } from './editCommands.ts';

const ppmOf = (e: CadEngine) => e.model.getMeta().scale || 50;
const tolOf = (e: CadEngine) => 12 / Math.max(0.05, e.camera.getState().zoom || 1);

/** أقرب عنصر خطي للنقطة من الأنواع المطلوبة */
function pick(engine: CadEngine, p: Point, types: ('wall' | 'line' | 'route')[]): ProjectObject | null {
  const tol = tolOf(engine);
  let best: ProjectObject | null = null;
  let bestD = Infinity;
  for (const o of engine.model.getObjects()) {
    if (!types.includes(o.type as 'wall')) continue;
    const layer = engine.model.getLayers().find((l) => l.id === o.layerId);
    if (layer && (!layer.visible || layer.locked)) continue;
    let d = Infinity;
    if (o.type === 'wall') {
      const w = o as WallObject;
      d = SnapEngine.pointToSegmentDistance(p, w.start, w.end) - w.thickness / 2;
    } else {
      const pts = (o as LineObject | RouteObject).points;
      for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, SnapEngine.pointToSegmentDistance(p, pts[i], pts[i + 1]));
      if ((o as LineObject).closed && pts.length > 2) d = Math.min(d, SnapEngine.pointToSegmentDistance(p, pts[pts.length - 1], pts[0]));
    }
    if (d <= tol && d < bestD) {
      bestD = d;
      best = o;
    }
  }
  return best;
}

function applyPlanOrMessage(engine: CadEngine, plan: ReturnType<typeof planFillet>, label: string): boolean {
  if (typeof plan === 'string') {
    engine.editMessage = plan;
    return false;
  }
  engine.editMessage = null;
  engine.model.applyEdits(plan, label);
  return true;
}

function highlight(engine: CadEngine, o: ProjectObject | undefined | null): void {
  if (!o) return;
  const toS = (p: Point) => engine.camera.worldToScreen(p);
  if (o.type === 'wall') {
    const w = o as WallObject;
    const a = toS(w.start);
    const b = toS(w.end);
    engine.interactionLayer.add(new Konva.Line({ points: [a.x, a.y, b.x, b.y], stroke: '#f59e0b', strokeWidth: Math.max(3, w.thickness * engine.camera.getState().zoom), opacity: 0.45, listening: false }));
  } else if (o.type === 'line' || o.type === 'route') {
    const pts = (o as LineObject).points.flatMap((p) => {
      const s = toS(p);
      return [s.x, s.y];
    });
    engine.interactionLayer.add(new Konva.Line({ points: pts, stroke: '#f59e0b', strokeWidth: 3, opacity: 0.6, listening: false }));
  }
}

const data = (c: EditCommandState) => (c.data ??= {});

// ─── وصل ركن ───
registerCommand('fillet', {
  name: 'وصل ركن',
  needsSelection: false,
  prompt: (_e, c) => (data(c).firstId ? 'اختر الجدار الثاني' : 'وصل ركن: اختر الجدار الأول (الجهة المراد الاحتفاظ بها)'),
  click(engine, c, _p, _s, _sh, raw) {
    const at = raw || _p;
    const w = pick(engine, at, ['wall']) as WallObject | null;
    if (!w) {
      engine.editMessage = 'انقر على جدار';
      return false;
    }
    const d = data(c);
    if (!d.firstId) {
      d.firstId = w.id;
      d.firstClick = at;
      engine.editMessage = null;
      return false;
    }
    const a = engine.model.getObjectById(String(d.firstId)) as WallObject;
    const ok = applyPlanOrMessage(engine, planFillet(engine.model.getObjects(), a, d.firstClick as Point, w, at), 'وصل ركن');
    if (!ok) return false;
    c.data = {};
    return false; // يتكرر حتى Esc
  },
  preview(engine, c, cursor) {
    highlight(engine, data(c).firstId ? engine.model.getObjectById(String(data(c).firstId)) : null);
    highlight(engine, pick(engine, cursor, ['wall']));
  },
});

// ─── شطف ركن ───
registerCommand('chamfer', {
  name: 'شطف ركن',
  needsSelection: false,
  prompt: (_e, c) => {
    const d = data(c);
    const dA = (d.dA as number) ?? 0.5;
    const dB = (d.dB as number) ?? dA;
    return d.firstId ? 'اختر الجدار الثاني' : `شطف ركن (${dA}${dB !== dA ? `، ${dB}` : ''} م): اختر الجدار الأول — أو اكتب المسافة d أو d1,d2 بالمتر`;
  },
  awaitingValue: (_e, c) => !data(c).firstId,
  value(_engine, c, text) {
    const n = parseNumbers(text);
    if (!(n.length === 1 || n.length === 2) || !n.every((v) => v > 0)) return 'اكتب مسافة موجبة بالمتر (d أو d1,d2)';
    data(c).dA = n[0];
    data(c).dB = n[1] ?? n[0];
    return null;
  },
  click(engine, c, _p, _s, _sh, raw) {
    const at = raw || _p;
    const w = pick(engine, at, ['wall']) as WallObject | null;
    if (!w) {
      engine.editMessage = 'انقر على جدار';
      return false;
    }
    const d = data(c);
    if (!d.firstId) {
      d.firstId = w.id;
      d.firstClick = at;
      engine.editMessage = null;
      return false;
    }
    const ppm = ppmOf(engine);
    const dA = ((d.dA as number) ?? 0.5) * ppm;
    const dB = ((d.dB as number) ?? (d.dA as number) ?? 0.5) * ppm;
    const a = engine.model.getObjectById(String(d.firstId)) as WallObject;
    if (!applyPlanOrMessage(engine, planChamfer(engine.model.getObjects(), a, d.firstClick as Point, w, at, dA, dB), 'شطف ركن')) return false;
    c.data = { dA: d.dA, dB: d.dB };
    return false;
  },
  preview(engine, c, cursor) {
    highlight(engine, data(c).firstId ? engine.model.getObjectById(String(data(c).firstId)) : null);
    highlight(engine, pick(engine, cursor, ['wall']));
  },
});

// ─── كسر ───
registerCommand('break', {
  name: 'كسر',
  needsSelection: false,
  prompt: (_e, c) => (data(c).objId ? 'النقطة الثانية للكسر (انقر نفس النقطة للتقسيم دون فجوة)' : 'كسر: انقر على جدار أو خط عند النقطة الأولى'),
  click(engine, c, p, _s, _sh, raw) {
    const d = data(c);
    if (!d.objId) {
      const o = pick(engine, raw || p, ['wall', 'line', 'route']);
      if (!o) {
        engine.editMessage = 'انقر على جدار أو خط أو مسار';
        return false;
      }
      d.objId = o.id;
      d.p1 = p;
      engine.editMessage = null;
      return false;
    }
    const obj = engine.model.getObjectById(String(d.objId));
    if (!obj) return true;
    const ok = applyPlanOrMessage(engine, planBreak(engine.model.getObjects(), obj, d.p1 as Point, p, Math.max(1, tolOf(engine) / 3)), 'كسر');
    if (!ok) return false;
    c.data = {};
    return false;
  },
  preview(engine, c, cursor) {
    const d = data(c);
    highlight(engine, d.objId ? engine.model.getObjectById(String(d.objId)) : pick(engine, cursor, ['wall', 'line', 'route']));
    if (d.p1) {
      const a = engine.camera.worldToScreen(d.p1 as Point);
      const b = engine.camera.worldToScreen(cursor);
      engine.interactionLayer.add(new Konva.Line({ points: [a.x, a.y, b.x, b.y], stroke: '#ef4444', strokeWidth: 3, listening: false }));
    }
  },
});

// ─── دمج (فوري على التحديد) ───
registerCommand('join', {
  name: 'دمج',
  needsSelection: true,
  validate: (_e, ids) => (ids.length < 2 ? 'حدد عنصرين أو أكثر للدمج' : null),
  runImmediately(engine, ids) {
    const plan = planJoin(engine.model.getObjects(), ids, Math.max(1, tolOf(engine) / 3));
    if (typeof plan === 'string') return plan;
    engine.model.applyEdits(plan, 'دمج');
    const remaining = ids.filter((id) => !plan.deletes.includes(id));
    engine.selectObjects(remaining);
    return null;
  },
  prompt: () => '',
  click: () => true,
});

// ─── تمطيط ───
registerCommand('stretch', {
  name: 'تمطيط',
  needsSelection: false,
  prompt: (_e, c) =>
    ['تمطيط: الركن الأول لنافذة اختيار الرؤوس', 'الركن المقابل للنافذة', 'نقطة الأساس', 'نقطة الوجهة (أو @dx,dy)'][Math.min(3, c.pts?.length ?? 0)],
  click(engine, c, p) {
    c.pts ??= [];
    c.pts.push({ ...p });
    if (c.pts.length >= 3) {
      c.base = { ...c.pts[2] };
      c.step = 1;
    }
    if (c.pts.length < 4) return false;
    const [a, b, base, dest] = c.pts;
    const box: BoxRect = { minX: Math.min(a.x, b.x), minY: Math.min(a.y, b.y), maxX: Math.max(a.x, b.x), maxY: Math.max(a.y, b.y) };
    const plan = planStretch(engine.model.getObjects(), box, { x: dest.x - base.x, y: dest.y - base.y });
    if (typeof plan === 'string') {
      engine.editMessage = plan;
      c.pts = [];
      c.step = 0;
      c.base = null;
      return false;
    }
    engine.model.applyEdits(plan, 'تمطيط');
    return true;
  },
  preview(engine, c, cursor) {
    const P = c.pts ?? [];
    const toS = (p: Point) => engine.camera.worldToScreen(p);
    if (P.length >= 1) {
      const a = toS(P[0]);
      const b = toS(P.length >= 2 ? P[1] : cursor);
      engine.interactionLayer.add(new Konva.Rect({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y), stroke: '#22c55e', dash: [6, 4], strokeWidth: 1, fill: 'rgba(34,197,94,0.06)', listening: false }));
    }
    if (P.length >= 3) {
      const box: BoxRect = { minX: Math.min(P[0].x, P[1].x), minY: Math.min(P[0].y, P[1].y), maxX: Math.max(P[0].x, P[1].x), maxY: Math.max(P[0].y, P[1].y) };
      const plan = planStretch(engine.model.getObjects(), box, { x: cursor.x - P[2].x, y: cursor.y - P[2].y });
      if (typeof plan !== 'string') {
        for (const u of plan.updates) {
          const o = engine.model.getObjectById(u.id);
          if (!o) continue;
          highlight(engine, { ...o, ...u.after } as ProjectObject);
        }
      }
      const a = toS(P[2]);
      const b = toS(cursor);
      engine.interactionLayer.add(new Konva.Line({ points: [a.x, a.y, b.x, b.y], stroke: '#f59e0b', dash: [6, 4], strokeWidth: 1, listening: false }));
    }
  },
});

// ─── أبعاد متسلسلة لجدار كامل ───
registerCommand('dimchain', {
  name: 'أبعاد متسلسلة',
  needsSelection: false,
  prompt: () => 'أبعاد متسلسلة: انقر على جدار من الجهة المطلوبة للأبعاد (يتكرر حتى Esc)',
  click(engine, _c, p, _s, _sh, raw) {
    const at = raw || p;
    const w = pick(engine, at, ['wall']) as WallObject | null;
    if (!w) {
      engine.editMessage = 'انقر على جدار';
      return false;
    }
    engine.editMessage = null;
    const dx = w.end.x - w.start.x;
    const dy = w.end.y - w.start.y;
    const side: 1 | -1 = (at.x - w.start.x) * -dy + (at.y - w.start.y) * dx >= 0 ? 1 : -1;
    const dims = chainDimensions(engine.model.getObjects(), w, side, 0.6 * ppmOf(engine), w.layerId);
    engine.model.addObjects(dims, `أبعاد متسلسلة (${dims.length})`);
    return false;
  },
  preview(engine, _c, cursor) {
    highlight(engine, pick(engine, cursor, ['wall']));
  },
});
