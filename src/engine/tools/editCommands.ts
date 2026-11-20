/**
 * @file editCommands.ts
 * @description أوامر التحرير بنقطة أساس (بنمط AutoCAD) على العناصر المحددة:
 * نقل (Move) · نسخ متعدد (Copy) · تدوير (Rotate) · تحجيم (Scale) · مرآة (Mirror) · مصفوفة (Array) · إزاحة متوازية (Offset)
 * تعمل بالنقر مع الالتقاط والتعامد، أو بإدخال القيم في شريط الأوامر. كل أمر خطوة تراجع واحدة.
 */

import Konva from 'konva';
import type { Point, ProjectObject, WallObject, RouteObject, DimensionObject, SymbolObject, TextObject } from '../../model/types.ts';
import { SnapEngine } from '../snap.ts';
import {
  TransformSpec,
  translateSpec,
  rotateSpec,
  scaleSpec,
  mirrorSpec,
  transformUpdates,
  cloneTransformed,
  withHostedObjects,
  offsetWall,
} from '../../model/transforms.ts';
import type { CadEngine } from '../renderer.ts';

export type EditCommandKind = 'move' | 'copy' | 'rotate' | 'scale' | 'mirror' | 'array' | 'offset';

export interface EditCommandState {
  kind: EditCommandKind;
  ids: string[];
  /** 0 = بانتظار النقطة/القيمة الأولى، 1 = بانتظار الثانية */
  step: number;
  base: Point | null;
  /** مسافة الإزاحة المتوازية (بوحدة العالم) بعد إدخالها */
  offsetDistance?: number;
}

export const EDIT_COMMAND_NAMES: Record<EditCommandKind, string> = {
  move: 'نقل',
  copy: 'نسخ',
  rotate: 'تدوير',
  scale: 'تحجيم',
  mirror: 'مرآة',
  array: 'مصفوفة',
  offset: 'إزاحة متوازية',
};

const POLAR = [0, 45, 90, 135, 180, 225, 270, 315, 360];

/** بدء أمر تحرير على التحديد الحالي. يعيد رسالة خطأ أو null */
export function startEditCommandImpl(this: CadEngine, kind: EditCommandKind): string | null {
  const ids = this.selectedObjectIds.length > 0 ? [...this.selectedObjectIds] : this.selectedObjectId ? [this.selectedObjectId] : [];
  if (ids.length === 0) return 'حدد عنصراً أو أكثر أولاً ثم اختر الأمر';
  if (kind === 'offset') {
    const walls = ids.filter((id) => this.model.getObjectById(id)?.type === 'wall');
    if (walls.length === 0) return 'الإزاحة المتوازية تعمل على الجدران: حدد جداراً';
  }
  this.cancelDrawing();
  this.editCmd = { kind, ids, step: 0, base: null };
  this.toolMode = 'edit';
  this.callbacks.onToolModeChange?.('edit');
  this.updateCursor();
  this.renderInteractionLayer();
  return null;
}

/** هل ينتظر الأمر قيمة رقمية (زاوية/معامل/مسافة/أبعاد مصفوفة) بدلاً من نقطة؟ */
export function isEditAwaitingValueImpl(this: CadEngine): boolean {
  const c = this.editCmd;
  if (!c) return false;
  if (c.kind === 'array') return true;
  if (c.kind === 'offset') return c.step === 0;
  if ((c.kind === 'rotate' || c.kind === 'scale') && c.step === 1) return true;
  return false;
}

export function getEditPromptImpl(this: CadEngine): string {
  const c = this.editCmd;
  if (!c) return '';
  const n = `${c.ids.length} عنصر`;
  switch (c.kind) {
    case 'move':
      return c.step === 0 ? `نقل ${n}: حدد نقطة الأساس` : 'حدد نقطة الوجهة (أو @dx,dy)';
    case 'copy':
      return c.step === 0 ? `نسخ ${n}: حدد نقطة الأساس` : 'حدد موضع النسخة (تكرار حتى Esc)';
    case 'rotate':
      return c.step === 0 ? `تدوير ${n}: حدد مركز التدوير` : 'اكتب الزاوية بالدرجات أو انقر لتحديدها';
    case 'scale':
      return c.step === 0 ? `تحجيم ${n}: حدد نقطة الأساس` : 'اكتب معامل التحجيم (مثل 2 أو 0.5)';
    case 'mirror':
      return c.step === 0 ? `مرآة ${n}: النقطة الأولى لمحور الانعكاس` : 'النقطة الثانية لمحور الانعكاس';
    case 'array':
      return `مصفوفة ${n}: صفوف,أعمدة,تباعد الصفوف,تباعد الأعمدة (بالمتر) مثل 2,3,4,5`;
    case 'offset':
      return c.step === 0 ? 'اكتب مسافة الإزاحة بالمتر' : 'انقر في الجهة المطلوبة للجدار الجديد';
  }
}

function finish(engine: CadEngine): void {
  engine.editCmd = null;
  engine.toolMode = 'select';
  engine.callbacks.onToolModeChange?.('select');
  engine.updateCursor();
  engine.render();
}

/** نقطة الوجهة مع التعامد/القطبي (التقاط العناصر له الأولوية) */
function constrained(engine: CadEngine, base: Point, p: Point, objectSnapped: boolean, shift: boolean): Point {
  const polar = SnapEngine.getPolarAngleSnap(base, p, POLAR, shift ? 25 : 5.0);
  return (!objectSnapped && polar.isSnapped) || shift ? polar.point : p;
}

function specFor(engine: CadEngine, c: EditCommandState, cursor: Point): TransformSpec | null {
  if (!c.base) return null;
  const ppm = engine.model.getMeta().scale || 50;
  switch (c.kind) {
    case 'move':
    case 'copy':
      return translateSpec(cursor.x - c.base.x, cursor.y - c.base.y);
    case 'rotate': {
      const ang = (Math.atan2(cursor.y - c.base.y, cursor.x - c.base.x) * 180) / Math.PI;
      return rotateSpec(c.base, ang);
    }
    case 'scale': {
      const f = Math.hypot(cursor.x - c.base.x, cursor.y - c.base.y) / ppm;
      return f > 0.001 ? scaleSpec(c.base, f) : null;
    }
    case 'mirror':
      return Math.hypot(cursor.x - c.base.x, cursor.y - c.base.y) > 0.5 ? mirrorSpec(c.base, cursor) : null;
    default:
      return null;
  }
}

function sideSign(w: WallObject, p: Point): 1 | -1 {
  const dx = w.end.x - w.start.x;
  const dy = w.end.y - w.start.y;
  // الناظم الأيسر (-dy, dx): إشارة الجداء النقطي تحدد الجهة
  return (p.x - w.start.x) * -dy + (p.y - w.start.y) * dx >= 0 ? 1 : -1;
}

function applySpec(engine: CadEngine, c: EditCommandState, spec: TransformSpec): void {
  const all = engine.model.getObjects();
  const ids = withHostedObjects(c.ids, all);
  const label = EDIT_COMMAND_NAMES[c.kind];
  if (c.kind === 'copy' || c.kind === 'mirror') {
    const src = all.filter((o) => ids.includes(o.id));
    const clones = cloneTransformed(src, spec);
    engine.model.addObjects(clones, `${label} ${clones.length} عناصر`);
    if (c.kind === 'mirror') engine.selectObjects(clones.map((o) => o.id));
  } else {
    engine.model.applyTransform(ids, spec, `${label} ${c.ids.length} عناصر`);
  }
}

/** معالجة نقرة (أو نقطة مُدخلة) أثناء أمر التحرير */
export function handleEditClickImpl(this: CadEngine, point: Point, objectSnapped: boolean, shift: boolean): void {
  const c = this.editCmd;
  if (!c) return;
  if (c.kind === 'array') return; // ينتظر قيماً رقمية
  if (c.kind === 'offset') {
    if (c.step !== 1 || !c.offsetDistance) return;
    const walls = c.ids
      .map((id) => this.model.getObjectById(id))
      .filter((o): o is WallObject => o?.type === 'wall');
    if (walls.length === 0) return finish(this);
    // كل جدار يُزاح نحو جهة المؤشر بالنسبة له
    const perWall = walls.map((w) => offsetWall(w, sideSign(w, point) * c.offsetDistance!));
    this.model.addObjects(perWall, `إزاحة متوازية لـ ${perWall.length} جدار`);
    this.selectObjects(perWall.map((w) => w.id));
    return finish(this);
  }
  if (c.step === 0) {
    c.base = { ...point };
    c.step = 1;
    this.renderInteractionLayer(shift);
    return;
  }
  const target = constrained(this, c.base!, point, objectSnapped, shift);
  if (c.kind === 'move') {
    const dx = target.x - c.base!.x;
    const dy = target.y - c.base!.y;
    // moveObjects يتولى انزلاق الأبواب على جدرانها عند نقلها وحدها
    this.model.moveObjects(c.ids, { x: dx, y: dy });
    return finish(this);
  }
  const spec = specFor(this, c, target);
  if (!spec) return;
  applySpec(this, c, spec);
  if (c.kind === 'copy') {
    this.renderInteractionLayer(shift); // نسخ متعدد: يبقى الأمر نشطاً
    return;
  }
  finish(this);
}

/** إدخال قيمة رقمية للأمر الحالي. يعيد رسالة خطأ أو null */
export function applyEditValueImpl(this: CadEngine, text: string): string | null {
  const c = this.editCmd;
  if (!c) return 'لا يوجد أمر تحرير نشط';
  const ppm = this.model.getMeta().scale || 50;
  const raw = text.trim().replace(/،/g, ',').replace(/\s+/g, '');
  const nums = raw.split(',').map(Number);
  if (c.kind === 'array') {
    const [rows, cols, dyM, dxM] = nums;
    if (![rows, cols].every((v) => Number.isInteger(v) && v >= 1) || !isFinite(dyM ?? NaN) || !isFinite(dxM ?? NaN)) {
      return 'الصيغة: صفوف,أعمدة,تباعد الصفوف,تباعد الأعمدة — مثل 2,3,4,5';
    }
    if (rows * cols > 400) return 'الحد الأقصى 400 نسخة في المصفوفة الواحدة';
    const all = this.model.getObjects();
    const ids = withHostedObjects(c.ids, all);
    const src = all.filter((o) => ids.includes(o.id));
    const clones: ProjectObject[] = [];
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < cols; k++) {
        if (r === 0 && k === 0) continue; // الأصل نفسه
        clones.push(...cloneTransformed(src, translateSpec(k * dxM * ppm, r * dyM * ppm)));
      }
    }
    if (clones.length === 0) return 'لا توجد نسخ (1×1)';
    this.model.addObjects(clones, `مصفوفة ${rows}×${cols}`);
    finish(this);
    return null;
  }
  if (c.kind === 'offset' && c.step === 0) {
    const d = nums[0];
    if (!isFinite(d) || d <= 0 || nums.length !== 1) return 'اكتب مسافة موجبة بالمتر مثل 0.2';
    c.offsetDistance = d * ppm;
    c.step = 1;
    this.renderInteractionLayer();
    return null;
  }
  if ((c.kind === 'rotate' || c.kind === 'scale') && c.step === 1 && c.base) {
    const v = nums[0];
    if (!isFinite(v) || nums.length !== 1) return c.kind === 'rotate' ? 'اكتب الزاوية بالدرجات مثل 90' : 'اكتب معاملاً مثل 2';
    if (c.kind === 'scale' && v <= 0) return 'معامل التحجيم يجب أن يكون موجباً';
    applySpec(this, c, c.kind === 'rotate' ? rotateSpec(c.base, v) : scaleSpec(c.base, v));
    finish(this);
    return null;
  }
  return 'هذا الأمر ينتظر نقطة: انقر على اللوحة أو اكتب x,y أو @dx,dy';
}

/** معاينة شبحية للعناصر المحوّلة أثناء الأمر */
export function renderEditPreviewImpl(this: CadEngine, shift: boolean): void {
  const c = this.editCmd;
  if (!c) return;
  const color = '#38bdf8';
  const zoom = this.camera.getState().zoom;
  const cursor = this.currentSnapResult.point;
  const layer = this.interactionLayer;
  const toS = (p: Point) => this.camera.worldToScreen(p);

  let spec: TransformSpec | null = null;
  if (c.kind === 'offset') {
    if (c.step === 1 && c.offsetDistance) {
      for (const id of c.ids) {
        const w = this.model.getObjectById(id);
        if (w?.type !== 'wall') continue;
        const ow = offsetWall(w as WallObject, sideSign(w as WallObject, cursor) * c.offsetDistance);
        const a = toS(ow.start);
        const b = toS(ow.end);
        layer.add(new Konva.Line({ points: [a.x, a.y, b.x, b.y], stroke: color, strokeWidth: Math.max(2, ow.thickness * zoom), opacity: 0.35, listening: false }));
      }
    }
    return;
  }
  if (c.step >= 1 && c.base) {
    const target = constrained(this, c.base, cursor, this.currentSnapResult.snapped && this.currentSnapResult.type !== 'grid', shift);
    spec = specFor(this, c, target);
    const a = toS(c.base);
    const b = toS(target);
    layer.add(new Konva.Line({ points: [a.x, a.y, b.x, b.y], stroke: '#f59e0b', strokeWidth: 1, dash: [6, 4], listening: false }));
    layer.add(new Konva.Circle({ x: a.x, y: a.y, radius: 4, fill: '#f59e0b', listening: false }));
    if (c.kind === 'mirror') {
      // امتداد محور الانعكاس
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      layer.add(new Konva.Line({ points: [a.x - dx * 20, a.y - dy * 20, b.x + dx * 20, b.y + dy * 20], stroke: '#a78bfa', strokeWidth: 1, dash: [10, 6], opacity: 0.7, listening: false }));
    }
  }
  if (!spec) return;
  const all = this.model.getObjects();
  const idSet = new Set(withHostedObjects(c.ids, all));
  const wallIds = new Set(all.filter((o) => o.type === 'wall' && idSet.has(o.id)).map((o) => o.id));
  let count = 0;
  for (const o of all) {
    if (!idSet.has(o.id)) continue;
    if (++count > 400) break; // حد للمعاينة في التحديدات الضخمة
    const ghost = JSON.parse(JSON.stringify(o)) as ProjectObject;
    const upd = transformUpdates(o, spec, wallIds);
    if (upd) Object.assign(ghost, upd);
    if (ghost.type === 'wall' || ghost.type === 'dimension') {
      const g = ghost as WallObject | DimensionObject;
      const a = toS(g.start);
      const b = toS(g.end);
      const w = ghost.type === 'wall' ? Math.max(2, (ghost as WallObject).thickness * zoom) : 1.5;
      layer.add(new Konva.Line({ points: [a.x, a.y, b.x, b.y], stroke: color, strokeWidth: w, opacity: 0.35, lineCap: 'square', listening: false }));
    } else if (ghost.type === 'route') {
      const pts = (ghost as RouteObject).points.flatMap((p) => {
        const s = toS(p);
        return [s.x, s.y];
      });
      layer.add(new Konva.Line({ points: pts, stroke: color, strokeWidth: 2, opacity: 0.6, dash: [4, 3], listening: false }));
    } else if (ghost.type === 'symbol' || ghost.type === 'text') {
      const s = toS({ x: (ghost as SymbolObject | TextObject).x, y: (ghost as SymbolObject | TextObject).y });
      const r = 10 * zoom * ((ghost as SymbolObject).scale || 1);
      layer.add(new Konva.Circle({ x: s.x, y: s.y, radius: Math.max(4, r), stroke: color, strokeWidth: 1.5, dash: [3, 2], listening: false }));
    }
  }
}
