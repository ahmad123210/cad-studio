/**
 * @file blocks.ts
 * @description الكتل القابلة لإعادة الاستخدام (مطبخ، حمام، غرفة نوم...):
 *  - كتل جاهزة مدمجة (معرّفة بالمتر وتُحوَّل لمقياس المشروع)
 *  - حفظ التحديد ككتلة في المشروع (نقطة الأساس = الركن الأعلى الأيسر للتحديد)
 *  - إدراج كتلة: نسخ عناصرها بمعرفات جديدة مع إزاحة ودوران (والأبواب تبقى مع جدرانها)
 */
import type { Point, ProjectObject, SymbolObject, LineObject } from './types.ts';
import { cloneTransformed, translateSpec, type TransformSpec } from './transforms.ts';

export interface BlockDef {
  id: string;
  name: string;
  /** العناصر بإحداثيات نسبية لنقطة الأساس (0,0) */
  objects: ProjectObject[];
  builtin?: boolean;
}

const r6 = (v: number) => Math.round(v * 1e6) / 1e6;

/** تحويل إدراج: دوران حول الأصل ثم إزاحة إلى نقطة الإدراج (وتحجيم اختياري) */
export function placementSpec(at: Point, deg: number, scale = 1): TransformSpec {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return {
    map: (p) => ({ x: r6(at.x + (p.x * c - p.y * s) * scale), y: r6(at.y + (p.x * s + p.y * c) * scale) }),
    rotateDeg: deg,
    mirrorAxisDeg: null,
    scale,
  };
}

/** حدود عناصر بسيطة لحساب نقطة الأساس */
function boundsOf(objs: ProjectObject[]): { minX: number; minY: number } {
  let minX = Infinity;
  let minY = Infinity;
  const inc = (p: Point) => {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
  };
  for (const o of objs) {
    const a = o as unknown as { start?: Point; end?: Point; points?: Point[]; x?: number; y?: number };
    if (a.start && a.end) {
      inc(a.start);
      inc(a.end);
    } else if (a.points) a.points.forEach(inc);
    else if (typeof a.x === 'number' && typeof a.y === 'number') inc({ x: a.x, y: a.y });
  }
  return { minX: isFinite(minX) ? minX : 0, minY: isFinite(minY) ? minY : 0 };
}

export function makeBlock(objs: ProjectObject[], name: string): BlockDef {
  const b = boundsOf(objs);
  return {
    id: `blk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    name: name.trim() || 'كتلة',
    objects: cloneTransformed(objs, translateSpec(-b.minX, -b.minY)),
  };
}

/** عناصر الكتلة في موضع الإدراج بمعرفات جديدة */
export function placeBlock(block: BlockDef, at: Point, deg = 0, scale = 1): ProjectObject[] {
  return cloneTransformed(block.objects, placementSpec(at, deg, scale));
}

// ─── الكتل الجاهزة (بالمتر؛ الرموز بأحجامها الافتراضية عند 50 بكسل/م) ───
type Sym = [kind: string, x: number, y: number, rot?: number];
const sym = (k: string, x: number, y: number, rot = 0, ppm = 50): SymbolObject => ({
  id: `b_${k}_${x}_${y}`,
  type: 'symbol',
  layerId: k.startsWith('plumb') ? 'plumb' : k.startsWith('furn_') ? 'furn' : 'arch',
  symbolKind: k,
  x: x * ppm,
  y: y * ppm,
  rotation: rot,
  scale: ppm / 50,
});
const poly = (id: string, pts: [number, number][], closed: boolean, ppm: number): LineObject => ({
  id,
  type: 'line',
  layerId: 'arch',
  points: pts.map(([x, y]) => ({ x: x * ppm, y: y * ppm })),
  closed,
});

export function builtinBlocks(ppm: number): BlockDef[] {
  const S = (list: Sym[]) => list.map(([k, x, y, r]) => sym(k, x, y, r ?? 0, ppm));
  return [
    {
      id: 'builtin_kitchen_l',
      name: 'مطبخ على شكل L',
      builtin: true,
      objects: [
        // سطح العمل بعمق 60 سم: 3م أفقياً و2م رأسياً
        poly('b_counter', [[0, 0], [3, 0], [3, 0.6], [0.6, 0.6], [0.6, 2], [0, 2]], true, ppm),
        ...S([
          ['furn_gas_stove', 1.5, 0.3],
          ['furn_dishwasher', 2.4, 0.3],
          ['plumb_sink', 0.3, 1.2, 90],
          ['furn_refrigerator', 3.5, 0.4],
        ]),
      ],
    },
    {
      id: 'builtin_bathroom',
      name: 'حمام (مرحاض، مغسلة، دش)',
      builtin: true,
      objects: [
        poly('b_bath_outline', [[0, 0], [2, 0], [2, 1.6], [0, 1.6]], true, ppm),
        ...S([
          ['furn_toilet_wc', 0.4, 0.35],
          ['furn_washbasin', 1.1, 0.25],
          ['furn_shower', 1.55, 1.15],
          ['plumb_floor_drain', 1.0, 1.1],
        ]),
      ],
    },
    {
      id: 'builtin_bedroom',
      name: 'غرفة نوم رئيسية',
      builtin: true,
      objects: S([
        ['furn_bed_double', 1.6, 1.0],
        ['furn_nightstand', 0.55, 0.25],
        ['furn_nightstand', 2.65, 0.25],
        ['furn_wardrobe', 1.6, 3.4, 180],
      ]),
    },
    {
      id: 'builtin_living',
      name: 'جلسة صالة',
      builtin: true,
      objects: S([
        ['furn_sofa_corner', 1.2, 0.9],
        ['furn_coffee_table', 1.5, 2.3],
        ['furn_tv_unit', 1.5, 3.6, 180],
      ]),
    },
    {
      id: 'builtin_dining',
      name: 'طاولة سفرة 6 أشخاص',
      builtin: true,
      objects: S([['furn_dining_6seat', 1.2, 0.9]]),
    },
  ];
}

/** تحقق خفيف عند فتح الملفات */
export function sanitizeBlocks(raw: unknown): BlockDef[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((b): b is BlockDef => !!b && typeof b === 'object' && typeof (b as BlockDef).id === 'string' && Array.isArray((b as BlockDef).objects))
    .map((b) => ({ id: b.id, name: typeof b.name === 'string' && b.name ? b.name : 'كتلة', objects: b.objects }));
}
