/**
 * @file templates.ts
 * @description قوالب مشاريع جاهزة (المرحلة 19): شقة، فيلا مع سور، محل تجاري.
 * تُكتب بالمتر ثم تُحوّل لوحدة العالم بمقياس المشروع. الجدران الداخلية تلتقي بالخارجية
 * (تقاطعات T) فيعمل كشف الغرف وحصر الكميات مباشرة، والأبواب والنوافذ مستضافة على الجدران.
 */

import type { DoorObject, Layer, ProjectData, ProjectObject, RoomObject, WallObject, WindowObject } from './types.ts';

type Seg = [number, number, number, number];

interface TemplateSpec {
  name: string;
  /** جدران خارجية: سماكة 25 سم */
  outer: Seg[];
  /** قواطع داخلية: سماكة 12 سم */
  inner: Seg[];
  /** سور خارجي اختياري: سماكة 20 سم */
  fence?: Seg[];
  /** [فهرس الجدار في (outer ثم inner ثم fence)، الموضع 0..1، العرض بالمتر] */
  doors: Array<[number, number, number]>;
  windows: Array<[number, number, number]>;
  rooms: Array<[number, number, string, string]>;
}

export interface ProjectTemplate {
  id: 'empty' | 'apartment' | 'villa' | 'shop';
  title: string;
  description: string;
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  { id: 'empty', title: 'مشروع فارغ', description: 'لوحة بيضاء بالإعدادات الافتراضية' },
  { id: 'apartment', title: 'شقة سكنية', description: 'غرفتا نوم وصالة ومطبخ وحمام وغسيل — 12×10 م' },
  { id: 'villa', title: 'فيلا مع سور', description: 'مجلس وصالتان وثلاث غرف وخدمات، وسور خارجي ببوابتين — 16×14 م' },
  { id: 'shop', title: 'محل تجاري', description: 'صالة عرض بواجهة زجاجية ومستودع ومطبخ صغير ودورة مياه — 8×14 م' },
];

const rect = (x0: number, y0: number, x1: number, y1: number): Seg[] => [
  [x0, y0, x1, y0],
  [x1, y0, x1, y1],
  [x1, y1, x0, y1],
  [x0, y1, x0, y0],
];

const SPECS: Record<Exclude<ProjectTemplate['id'], 'empty'>, TemplateSpec> = {
  apartment: {
    name: 'شقة سكنية',
    outer: rect(-6, -5, 6, 5),
    inner: [
      [0, -5, 0, 5], // 4
      [-6, 1, 0, 1], // 5
      [0, 0, 6, 0], // 6
      [3.5, 0, 3.5, 5], // 7
      [3.5, 2.5, 6, 2.5], // 8
    ],
    doors: [
      [3, 0.7, 1.0], // مدخل
      [4, 0.25, 0.9], // صالة ↔ نوم 1
      [4, 0.55, 0.9], // صالة ↔ نوم 2
      [5, 0.5, 0.9], // مطبخ
      [7, 0.25, 0.8], // حمام
      [7, 0.75, 0.8], // غسيل
    ],
    windows: [
      [0, 0.25, 1.5],
      [0, 0.75, 1.5],
      [1, 0.625, 0.6],
      [2, 0.354, 1.2],
      [2, 0.75, 1.2],
    ],
    rooms: [
      [-3, -2, 'صالة', 'بورسلان'],
      [-3, 3, 'مطبخ', 'بلاط سيراميك'],
      [3, -2.5, 'غرفة نوم 1', 'باركيه'],
      [1.75, 2.5, 'غرفة نوم 2', 'باركيه'],
      [4.75, 1.25, 'حمام', 'بلاط سيراميك'],
      [4.75, 3.75, 'غسيل', 'بلاط سيراميك'],
    ],
  },
  villa: {
    name: 'فيلا سكنية',
    outer: rect(-8, -7, 8, 7),
    inner: [
      [-1, -7, -1, 7], // 4
      [-8, 0, -1, 0], // 5
      [-1, -2, 8, -2], // 6
      [4, -7, 4, -2], // 7
      [4, -4.5, 8, -4.5], // 8
      [3.5, -2, 3.5, 7], // 9
      [-1, 1.5, 3.5, 1.5], // 10
      [3.5, 4, 8, 4], // 11
    ],
    fence: rect(-12, -11, 12, 11), // 12..15
    doors: [
      [3, 0.75, 1.2], // مدخل المجلس
      [5, 0.786, 0.9], // مجلس ↔ صالة
      [4, 0.839, 0.9], // صالة ↔ صالة عائلية
      [10, 0.5, 0.9], // صالة عائلية ↔ نوم 2
      [6, 0.278, 0.9], // نوم 2 ↔ النوم الرئيسية
      [7, 0.75, 0.8], // رئيسية ↔ ملابس
      [8, 0.5, 0.8], // ملابس ↔ حمام
      [9, 0.528, 0.9], // صالة عائلية ↔ مطبخ
      [9, 0.833, 0.8], // صالة عائلية ↔ مستودع
      [1, 0.571, 0.9], // باب خلفي للمطبخ
      [15, 0.659, 3.0], // بوابة سيارات
      [14, 0.6875, 1.2], // بوابة مشاة
    ],
    windows: [
      [0, 0.219, 1.8],
      [0, 0.594, 1.5],
      [0, 0.875, 0.6],
      [2, 0.781, 1.8],
      [2, 0.422, 1.5],
      [3, 0.25, 1.5],
      [1, 0.893, 0.6],
    ],
    rooms: [
      [-4.5, -3.5, 'مجلس', 'رخام'],
      [-4.5, 3.5, 'صالة', 'بورسلان'],
      [1.5, -4.5, 'غرفة نوم رئيسية', 'باركيه'],
      [6, -5.75, 'حمام رئيسي', 'بلاط سيراميك'],
      [6, -3.25, 'غرفة ملابس', 'باركيه'],
      [1.25, -0.25, 'غرفة نوم 2', 'باركيه'],
      [1.25, 4.25, 'صالة عائلية', 'بورسلان'],
      [5.75, 1, 'مطبخ', 'بلاط سيراميك'],
      [5.75, 5.5, 'مستودع', 'بلاط سيراميك'],
    ],
  },
  shop: {
    name: 'محل تجاري',
    outer: rect(-4, -7, 4, 7),
    inner: [
      [-4, 3, 4, 3], // 4
      [1, 3, 1, 7], // 5
      [1, 5, 4, 5], // 6
    ],
    doors: [
      [0, 0.5, 1.8], // المدخل الرئيسي
      [4, 0.3125, 0.9], // صالة ↔ مستودع
      [4, 0.8125, 0.8], // صالة ↔ مطبخ
      [6, 0.5, 0.7], // مطبخ ↔ دورة مياه
      [2, 0.6875, 1.0], // باب خلفي
    ],
    windows: [
      [0, 0.1875, 2.2],
      [0, 0.8125, 2.2],
      [1, 0.43, 1.2],
    ],
    rooms: [
      [0, -2, 'صالة العرض', 'بورسلان'],
      [-1.5, 5, 'مستودع', 'إيبوكسي'],
      [2.5, 4, 'مطبخ صغير', 'بلاط سيراميك'],
      [2.5, 6, 'دورة مياه', 'بلاط سيراميك'],
    ],
  },
};

/** يبني بيانات مشروع كاملة من قالب (ppm = بكسل لكل متر). */
export function buildTemplateProject(id: ProjectTemplate['id'], layers: Layer[], ppm = 50): ProjectData {
  const today = new Date().toISOString().split('T')[0];
  const archLayer = layers.find((l) => l.id === 'arch')?.id ?? layers[0]?.id ?? 'arch';
  if (id === 'empty') {
    return { project: { name: 'مشروع جديد', unit: 'meter', scale: ppm, createdAt: today }, layers, objects: [], backgroundImage: null };
  }
  const spec = SPECS[id];
  const P = (v: number) => Math.round(v * ppm * 100) / 100;
  const objects: ProjectObject[] = [];
  const wallIds: string[] = [];
  const addWalls = (segs: Seg[], thickness: number, kind?: 'fence') =>
    segs.forEach(([x0, y0, x1, y1]) => {
      const id = `tpl_w${wallIds.length + 1}`;
      wallIds.push(id);
      const w: WallObject = { id, type: 'wall', layerId: archLayer, start: { x: P(x0), y: P(y0) }, end: { x: P(x1), y: P(y1) }, thickness: P(thickness) };
      if (kind) {
        w.wallKind = 'fence';
        w.height = 2;
      }
      objects.push(w);
    });
  addWalls(spec.outer, 0.25);
  addWalls(spec.inner, 0.12);
  if (spec.fence) addWalls(spec.fence, 0.2, 'fence');

  spec.doors.forEach(([wi, pos, width], i) => {
    const d: DoorObject = { id: `tpl_d${i + 1}`, type: 'door', layerId: archLayer, wallId: wallIds[wi], position: pos, width: P(width), openDirection: 'inward_right' };
    objects.push(d);
  });
  spec.windows.forEach(([wi, pos, width], i) => {
    const w: WindowObject = { id: `tpl_n${i + 1}`, type: 'window', layerId: archLayer, wallId: wallIds[wi], position: pos, width: P(width), height: 1.2, sillHeight: 0.9 };
    objects.push(w);
  });
  spec.rooms.forEach(([x, y, name, floorType], i) => {
    const r: RoomObject = { id: `tpl_r${i + 1}`, type: 'room', layerId: archLayer, x: P(x), y: P(y), name, floorType };
    objects.push(r);
  });
  return { project: { name: spec.name, unit: 'meter', scale: ppm, createdAt: today }, layers, objects, backgroundImage: null };
}

/** خطوط معاينة مصغرة للقالب (بالمتر) لرسمها في بطاقة الاختيار. */
export function templatePreview(id: ProjectTemplate['id']): { walls: Seg[]; fence: Seg[] } {
  if (id === 'empty') return { walls: [], fence: [] };
  const s = SPECS[id];
  return { walls: [...s.outer, ...s.inner], fence: s.fence ?? [] };
}
