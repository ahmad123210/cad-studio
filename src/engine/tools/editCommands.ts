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
import { planTrim, planExtend } from '../../model/trimExtend.ts';
import type { CadEngine } from '../renderer.ts';
import { EXT_COMMANDS } from './commandRegistry.ts';

export type EditCommandKind =
  | 'move' | 'copy' | 'rotate' | 'scale' | 'mirror' | 'array' | 'offset' | 'trim' | 'extend' | 'arraypolar'
  // أشكال الرسم (drawCommands.ts)
  | 'rect' | 'circle' | 'arc' | 'polygon'
  // عناصر إنشائية (structureCommands.ts)
  | 'column' | 'stairs'
  // أوامر تحرير إضافية (moreEditCommands.ts)
  | 'fillet' | 'chamfer' | 'break' | 'join' | 'stretch' | 'dimchain' | 'insertblock';

export interface EditCommandState {
  kind: EditCommandKind;
  ids: string[];
  /** 0 = بانتظار النقطة/القيمة الأولى، 1 = بانتظار الثانية */
  step: number;
  base: Point | null;
  /** مسافة الإزاحة المتوازية (بوحدة العالم) بعد إدخالها */
  offsetDistance?: number;
  /** نقاط مُدخلة للأوامر الموسّعة (أشكال، تمطيط...) */
  pts?: Point[];
  /** بيانات خاصة بالأمر الموسّع */
  data?: Record<string, unknown>;
}

export const EDIT_COMMAND_NAMES: Record<EditCommandKind, string> = {
  move: 'نقل',
  copy: 'نسخ',
  rotate: 'تدوير',
  scale: 'تحجيم',
  mirror: 'مرآة',
  array: 'مصفوفة',
  offset: 'إزاحة متوازية',
  trim: 'قص',
  extend: 'تمديد',
  arraypolar: 'مصفوفة دائرية',
  rect: 'مستطيل',
  circle: 'دائرة',
  arc: 'قوس',
  polygon: 'مضلع',
  column: 'عمود',
  stairs: 'درج',
  fillet: 'وصل ركن',
  chamfer: 'شطف ركن',
  break: 'كسر',
  join: 'دمج',
  stretch: 'تمطيط',
  dimchain: 'أبعاد متسلسلة',
  insertblock: 'إدراج كتلة',
};

/** أوامر لا تحتاج تحديداً مسبقاً (تعمل بالنقر على العنصر مباشرة) */
const PICK_COMMANDS: EditCommandKind[] = ['trim', 'extend'];

const POLAR = [0, 45, 90, 135, 180, 225, 270, 315, 360];

/** بدء أمر تحرير على التحديد الحالي. يعيد رسالة خطأ أو null */
export function startEditCommandImpl(this: CadEngine, kind: EditCommandKind, data?: Record<string, unknown>): string | null {
  const ids = this.selectedObjectIds.length > 0 ? [...this.selectedObjectIds] : this.selectedObjectId ? [this.selectedObjectId] : [];
  const ext = EXT_COMMANDS[kind];
  if (ext) {
    if (ext.needsSelection && ids.length === 0) return 'حدد عنصراً أو أكثر أولاً ثم اختر الأمر';
    const err = ext.validate?.(this, ids);
    if (err) return err;
    if (ext.runImmediately) {
      const r = ext.runImmediately(this, ids);
      this.render();
      return r;
    }
    this.cancelDrawing();
    this.editCmd = { kind, ids, step: 0, base: null, pts: [], data: data ? { ...data } : {} };
    this.toolMode = 'edit';
    this.callbacks.onToolModeChange?.('edit');
    this.updateCursor();
    this.renderInteractionLayer();
    return null;
  }
  if (ids.length === 0 && !PICK_COMMANDS.includes(kind)) return 'حدد عنصراً أو أكثر أولاً ثم اختر الأمر';
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
  if (EXT_COMMANDS[c.kind]) return EXT_COMMANDS[c.kind].awaitingValue?.(this, c) ?? false;
  if (c.kind === 'array') return true;
  if (c.kind === 'offset') return c.step === 0;
  if (c.kind === 'arraypolar') return c.step === 1;
  if ((c.kind === 'rotate' || c.kind === 'scale') && c.step === 1) return true;
  return false;
}

export function getEditPromptImpl(this: CadEngine): string {
  const c = this.editCmd;
  if (!c) return '';
  if (EXT_COMMANDS[c.kind]) return EXT_COMMANDS[c.kind].prompt(this, c);
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
    case 'trim':
      return 'انقر على الجزء المراد قصه (بين تقاطعين) — يتكرر حتى Esc';
    case 'extend':
      return 'انقر قرب طرف الجدار/الخط لتمديده حتى أقرب حد — يتكرر حتى Esc';
    case 'arraypolar':
      return c.step === 0 ? `مصفوفة دائرية ${n}: حدد المركز` : 'العدد,الزاوية الكلية — مثل 6,360 أو 4,90';
    default:
      return EDIT_COMMAND_NAMES[c.kind];
  }
}

export function finishEditCommand(engine: CadEngine): void {
  finish(engine);
}

function finish(engine: CadEngine): void {
  engine.editCmd = null;
  engine.toolMode = 'select';
  engine.callbacks.onToolModeChange?.('select');
  engine.updateCursor();
  engine.render();
}

/** نقطة الوجهة مع التعامد/القطبي (التقاط العناصر له الأولوية) */
export function constrained(engine: CadEngine, base: Point, p: Point, objectSnapped: boolean, shift: boolean): Point {
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

/** معالجة نقرة (أو نقطة مُدخلة) أثناء أمر التحرير. rawPoint: موضع النقرة دون التقاط (للقص والتمديد) */
export function handleEditClickImpl(this: CadEngine, point: Point, objectSnapped: boolean, shift: boolean, rawPoint?: Point): void {
  const c = this.editCmd;
  if (!c) return;
  const ext = EXT_COMMANDS[c.kind];
  if (ext) {
    if (ext.click(this, c, point, objectSnapped, shift, rawPoint)) finish(this);
    else {
      this.callbacks.onCursorMove(this.currentSnapResult.point, this.currentSnapResult);
      this.render();
    }
    return;
  }
  if (c.kind === 'array') return; // ينتظر قيماً رقمية
  if (c.kind === 'trim' || c.kind === 'extend') {
    const zf = Math.max(1, 1 / (this.camera.getState().zoom || 1));
    const at = rawPoint || point;
    const plan = c.kind === 'trim' ? planTrim(this.model.getObjects(), at, 12 * zf) : planExtend(this.model.getObjects(), at, 12 * zf);
    if (typeof plan === 'string') {
      this.editMessage = plan;
    } else {
      this.editMessage = null;
      this.model.applyEdits(plan, EDIT_COMMAND_NAMES[c.kind]);
    }
    // تحديث شريط الأوامر برسالة الحالة (عبر مخزن القيم اللحظية)
    this.callbacks.onCursorMove(this.currentSnapResult.point, this.currentSnapResult);
    this.render();
    return; // الأمر يبقى نشطاً لعدة نقرات
  }
  if (c.kind === 'arraypolar') {
    if (c.step === 0) {
      c.base = { ...point };
      c.step = 1;
      this.renderInteractionLayer(shift);
    }
    return;
  }
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
  const ext = EXT_COMMANDS[c.kind];
  if (ext) {
    if (!ext.value) return 'هذا الأمر ينتظر نقطة: انقر على اللوحة أو اكتب x,y أو @dx,dy';
    const r = ext.value(this, c, text);
    if (r === true) {
      finish(this);
      return null;
    }
    if (r === null) this.render();
    return r;
  }
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
  if (c.kind === 'arraypolar' && c.step === 1 && c.base) {
    const count = Math.round(nums[0]);
    const total = nums.length > 1 ? nums[1] : 360;
    if (!Number.isInteger(count) || count < 2 || !isFinite(total) || total === 0) return 'الصيغة: العدد,الزاوية الكلية — مثل 6,360';
    if (count > 360) return 'الحد الأقصى 360 نسخة';
    // دائرة كاملة: توزيع متساوٍ دون تكرار الأصل؛ قوس جزئي: الأولى والأخيرة على طرفي القوس
    const step = Math.abs(total) >= 360 ? total / count : total / (count - 1);
    const all = this.model.getObjects();
    const ids = withHostedObjects(c.ids, all);
    const src = all.filter((o) => ids.includes(o.id));
    const clones: ProjectObject[] = [];
    for (let k = 1; k < count; k++) clones.push(...cloneTransformed(src, rotateSpec(c.base, step * k)));
    this.model.addObjects(clones, `مصفوفة دائرية ${count}`);
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
  if (EXT_COMMANDS[c.kind]) {
    EXT_COMMANDS[c.kind].preview?.(this, c, cursor, shift);
    return;
  }
  if (c.kind === 'trim' || c.kind === 'extend') return;
  if (c.kind === 'arraypolar') {
    if (c.base) {
      const a = toS(c.base);
      layer.add(new Konva.Circle({ x: a.x, y: a.y, radius: 5, fill: '#f59e0b', listening: false }));
      const b = toS(cursor);
      layer.add(new Konva.Circle({ x: a.x, y: a.y, radius: Math.hypot(b.x - a.x, b.y - a.y), stroke: '#a78bfa', dash: [6, 5], strokeWidth: 1, listening: false }));
    }
    return;
  }
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
    if (ghost.type === 'wall' || ghost.type === 'dimension' || ghost.type === 'stairs') {
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
    } else if (ghost.type === 'symbol' || ghost.type === 'text' || ghost.type === 'room' || ghost.type === 'column') {
      const s = toS({ x: (ghost as SymbolObject | TextObject).x, y: (ghost as SymbolObject | TextObject).y });
      const r = 10 * zoom * ((ghost as SymbolObject).scale || 1);
      layer.add(new Konva.Circle({ x: s.x, y: s.y, radius: Math.max(4, r), stroke: color, strokeWidth: 1.5, dash: [3, 2], listening: false }));
    }
  }
}
