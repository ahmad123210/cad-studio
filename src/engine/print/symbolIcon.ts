/**
 * @file symbolIcon.ts
 * @description رسم أيقونة الرمز بشكله الحقيقي كما يظهر على لوحة الرسم (نفس دالة renderKonva)،
 * لاستخدامها في مفتاح الرموز عند الطباعة/التصدير. سابقاً كان المفتاح يرسم دائرة ملونة
 * أو معاينة SVG مبسطة لا تطابق شكل الرمز الفعلي.
 */

import Konva from 'konva';
import { getSymbolById, CATEGORIES_META } from '../../symbols/registry.ts';

const cache = new Map<string, HTMLCanvasElement>();

/**
 * يعيد Canvas مربعاً بحجم sizePx فيه الرمز متمركزاً ومحجّماً ليملأ المساحة مع هامش.
 * color: لون الرسم (لون الطبقة أو اللون المخصص)، ويُستخدم لون التخصص إن لم يُحدد.
 */
export function renderSymbolIcon(kind: string, sizePx: number, color?: string): HTMLCanvasElement {
  const def = getSymbolById(kind);
  const c = color || (def ? CATEGORIES_META[def.category]?.color : undefined) || '#334155';
  const key = `${kind}|${Math.round(sizePx)}|${c}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const size = Math.max(8, Math.round(sizePx));
  const container = document.createElement('div');
  const stage = new Konva.Stage({ container, width: size, height: size });
  const layer = new Konva.Layer();
  stage.add(layer);
  const group = new Konva.Group();
  if (def) {
    def.renderKonva(group, { color: c, isSelected: false, zoom: 1 });
  } else {
    group.add(new Konva.Circle({ radius: 10, stroke: c, strokeWidth: 2 }));
  }
  layer.add(group);
  const box = group.getClientRect({ skipShadow: true });
  const pad = size * 0.08;
  const k = box.width > 0 && box.height > 0 ? Math.min((size - pad * 2) / box.width, (size - pad * 2) / box.height) : 1;
  group.scale({ x: k, y: k });
  group.position({ x: size / 2 - (box.x + box.width / 2) * k, y: size / 2 - (box.y + box.height / 2) * k });
  layer.draw();
  const out = stage.toCanvas({ pixelRatio: 1 });
  stage.destroy();
  cache.set(key, out);
  return out;
}
