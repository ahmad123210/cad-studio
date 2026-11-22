/**
 * @file matchProps.ts
 * @description نسخ الخصائص من عنصر ولصقها على عناصر أخرى (Match Properties):
 * بين عنصرين من النوع نفسه تُنسخ خصائص المظهر والمقاس (لا الموضع ولا الشكل الهندسي)،
 * وبين نوعين مختلفين تُنسخ الطبقة واللون فقط.
 */
import type { ProjectObject } from './types.ts';
import type { EditPlan } from './trimExtend.ts';

/** الخصائص القابلة للنسخ لكل نوع (بدون الإحداثيات والارتباطات) */
const PROPS: Record<string, string[]> = {
  wall: ['thickness', 'height', 'wallKind'],
  door: ['width', 'height', 'openDirection'],
  window: ['width', 'height', 'sillHeight'],
  dimension: ['offset'],
  symbol: ['scale', 'rotation'],
  route: ['routeKind', 'material', 'diameter', 'strokeWidth', 'lineStyle', 'showLength'],
  text: ['fontSize', 'fontWeight', 'align', 'backgroundColor', 'backgroundOpacity', 'borderColor', 'padding', 'rotation'],
  line: ['strokeWidth', 'lineStyle'],
  room: ['floorType'],
  column: ['width', 'depth', 'shape', 'rotation'],
  stairs: ['width', 'tread', 'riser'],
};
const COMMON = ['layerId', 'color'];

export interface PropsSnapshot {
  type: string;
  values: Record<string, unknown>;
}

export function copyProps(o: ProjectObject): PropsSnapshot {
  const values: Record<string, unknown> = {};
  const src = o as unknown as Record<string, unknown>;
  for (const k of [...COMMON, ...(PROPS[o.type] || [])]) values[k] = src[k];
  return { type: o.type, values };
}

/** خطة لصق الخصائص على الأهداف (تتجاهل المصدر نفسه والقيم المتطابقة) */
export function planPasteProps(targets: ProjectObject[], snap: PropsSnapshot): EditPlan {
  const plan: EditPlan = { updates: [], adds: [], deletes: [] };
  for (const t of targets) {
    const keys = t.type === snap.type ? [...COMMON, ...(PROPS[t.type] || [])] : COMMON;
    const after: Record<string, unknown> = {};
    const cur = t as unknown as Record<string, unknown>;
    for (const k of keys) {
      if (!(k in snap.values)) continue;
      if (JSON.stringify(cur[k]) !== JSON.stringify(snap.values[k])) after[k] = snap.values[k];
    }
    if (Object.keys(after).length) plan.updates.push({ id: t.id, after: after as Partial<ProjectObject> });
  }
  return plan;
}
