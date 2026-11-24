/**
 * @file selection.ts
 * @description التحديد بالنقر والتجميع (المرحلة 20).
 *  - نقرة عادية: تحديد العنصر وحده (أو مجموعته كاملة إن كان مجمّعاً).
 *  - Ctrl (أو ⌘): إضافة/إزالة من التحديد المتعدد.
 *  - Shift: تحديد كل العناصر المشابهة (نفس النوع/الرمز/نوع المسار).
 *  - Alt: يتجاوز التجميع ويحدد عنصراً واحداً من داخل المجموعة.
 *  - تجميع (Ctrl+G) يجعل العناصر المحددة عنصراً واحداً عند التحديد والسحب، وفك التجميع (Ctrl+Shift+G) يعيدها مستقلة.
 */

import type { CadEngine } from '../renderer.ts';
import type { ProjectObject } from '../../model/types.ts';

type PickEvent = { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; altKey?: boolean } | undefined | null;

const mods = (evt: PickEvent) => ({
  ctrl: Boolean(evt && (evt.ctrlKey || evt.metaKey)),
  shift: Boolean(evt && evt.shiftKey),
  alt: Boolean(evt && evt.altKey),
});

/** أعضاء مجموعة العنصر (أو العنصر وحده) على اللوحة الحالية */
export function groupMembers(objects: ProjectObject[], id: string): string[] {
  const obj = objects.find((o) => o.id === id);
  const gid = obj?.groupId;
  if (!gid) return [id];
  return objects.filter((o) => o.groupId === gid).map((o) => o.id);
}

/** يوسّع قائمة معرّفات لتشمل كل أعضاء مجموعاتها (لتحديد المربع) */
export function expandGroups(objects: ProjectObject[], ids: string[]): string[] {
  const gids = new Set(objects.filter((o) => ids.includes(o.id) && o.groupId).map((o) => o.groupId as string));
  if (gids.size === 0) return ids;
  const out = new Set(ids);
  for (const o of objects) if (o.groupId && gids.has(o.groupId)) out.add(o.id);
  return [...out];
}

function setSelection(engine: CadEngine, ids: string[], silent: boolean): void {
  if (silent) {
    // دون إعادة بناء الطبقة حتى لا تُهدم العقدة قبل بدء السحب (الجدران والخطوط)
    engine.selectedObjectIds = [...ids];
    engine.selectedObjectId = ids[0] ?? null;
    engine.callbacks.onSelectObject(engine.selectedObjectId);
    engine.callbacks.onSelectObjects?.(engine.selectedObjectIds);
  } else if (ids.length === 1) {
    engine.selectObject(ids[0]);
  } else {
    engine.selectObjects(ids);
  }
}

/** ضغطة الفأرة على عنصر في وضع التحديد */
export function pickObjectDownImpl(this: CadEngine, id: string, evt: PickEvent, silent = false): void {
  this.pickAddedOnDown = null;
  if (this.selectedObjectIds.includes(id)) return; // يبقى التحديد كما هو ليُسحب كله
  const m = mods(evt);
  if (m.shift) return; // تحديد المشابه يتم عند النقر
  const ids = m.alt ? [id] : groupMembers(this.model.getObjects(), id);
  if (m.ctrl || this.selectionSubMode === 'multi') {
    this.pickAddedOnDown = id;
    setSelection(this, [...new Set([...this.selectedObjectIds, ...ids])], silent);
    return;
  }
  setSelection(this, ids, silent);
}

/** نقرة كاملة على عنصر (دون سحب) */
export function pickObjectClickImpl(this: CadEngine, id: string, evt: PickEvent): void {
  if (this.wasGroupDragged) return;
  const m = mods(evt);
  if (m.shift) {
    this.selectSimilar(id);
    return;
  }
  const ids = m.alt ? [id] : groupMembers(this.model.getObjects(), id);
  if (m.ctrl || this.selectionSubMode === 'multi') {
    if (this.pickAddedOnDown === id) {
      // أُضيف للتو عند الضغط: نعيد الرسم فقط ليظهر التمييز
      this.pickAddedOnDown = null;
      setSelection(this, this.selectedObjectIds, false);
      return;
    }
    const allSelected = ids.every((x) => this.selectedObjectIds.includes(x));
    const next = allSelected ? this.selectedObjectIds.filter((x) => !ids.includes(x)) : [...new Set([...this.selectedObjectIds, ...ids])];
    if (next.length === 0) this.selectObject(null);
    else setSelection(this, next, false);
    return;
  }
  setSelection(this, ids, false);
}

const newGroupId = () => `grp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

/** تجميع العناصر المحددة في عنصر واحد (المجموعات السابقة داخل التحديد تُدمج) */
export function groupSelectionImpl(this: CadEngine): string | null {
  const ids = expandGroups(this.model.getObjects(), this.selectedObjectIds);
  if (ids.length < 2) return 'حدد عنصرين أو أكثر لتجميعها';
  const gid = newGroupId();
  this.model.applyEdits({ updates: ids.map((id) => ({ id, after: { groupId: gid } })), adds: [], deletes: [] }, `تجميع ${ids.length} عناصر`);
  this.selectObjects(ids);
  return null;
}

/** فك تجميع المجموعات الموجودة في التحديد */
export function ungroupSelectionImpl(this: CadEngine): string | null {
  const ids = expandGroups(this.model.getObjects(), this.selectedObjectIds).filter((id) => this.model.getObjectById(id)?.groupId);
  if (ids.length === 0) return 'لا توجد مجموعة في التحديد';
  this.model.applyEdits({ updates: ids.map((id) => ({ id, after: { groupId: null } })), adds: [], deletes: [] }, `فك تجميع ${ids.length} عناصر`);
  this.selectObjects(this.selectedObjectIds);
  return null;
}

export function selectionHasGroup(engine: CadEngine): boolean {
  const objs = engine.model.getObjects();
  return engine.selectedObjectIds.some((id) => objs.find((o) => o.id === id)?.groupId);
}
