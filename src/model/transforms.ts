/**
 * @file transforms.ts
 * @description التحويلات الهندسية لعناصر المشروع (نقل، تدوير، مرآة، تحجيم، مصفوفة، إزاحة متوازية).
 * دوال صرفة لا تعدّل العناصر: تُرجع التحديثات المطلوبة أو نسخاً جديدة، وتُطبَّق عبر ProjectModel كخطوة تراجع واحدة.
 */

import type {
  Point,
  ProjectObject,
  WallObject,
  DoorObject,
  WindowObject,
  DimensionObject,
  SymbolObject,
  RouteObject,
  TextObject,
  LineObject,
  DoorOpenDirection,
} from './types.ts';

export interface TransformSpec {
  /** تحويل نقطة بإحداثيات العالم */
  map: (p: Point) => Point;
  /** زاوية تُضاف لدوران الرموز والنصوص (بالدرجات، مع عقارب الساعة كما في Konva) */
  rotateDeg: number;
  /** محور المرآة (زاويته بالدرجات) إن كان التحويل انعكاساً */
  mirrorAxisDeg: number | null;
  /** معامل التحجيم (يطبق على حجم الرموز والنصوص) */
  scale: number;
}

const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
const rp = (p: Point): Point => ({ x: r6(p.x), y: r6(p.y) });
const norm360 = (a: number) => ((a % 360) + 360) % 360;

export function translateSpec(dx: number, dy: number): TransformSpec {
  return { map: (p) => rp({ x: p.x + dx, y: p.y + dy }), rotateDeg: 0, mirrorAxisDeg: null, scale: 1 };
}

export function rotateSpec(center: Point, deg: number): TransformSpec {
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return {
    map: (p) => {
      const x = p.x - center.x;
      const y = p.y - center.y;
      return rp({ x: center.x + x * c - y * s, y: center.y + x * s + y * c });
    },
    rotateDeg: deg,
    mirrorAxisDeg: null,
    scale: 1,
  };
}

export function scaleSpec(center: Point, factor: number): TransformSpec {
  return {
    map: (p) => rp({ x: center.x + (p.x - center.x) * factor, y: center.y + (p.y - center.y) * factor }),
    rotateDeg: 0,
    mirrorAxisDeg: null,
    scale: factor,
  };
}

export function mirrorSpec(a: Point, b: Point): TransformSpec {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy || 1;
  return {
    map: (p) => {
      const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
      const fx = a.x + t * dx;
      const fy = a.y + t * dy;
      return rp({ x: 2 * fx - p.x, y: 2 * fy - p.y });
    },
    rotateDeg: 0,
    mirrorAxisDeg: (Math.atan2(dy, dx) * 180) / Math.PI,
    scale: 1,
  };
}

function flipDoorSide(dir: DoorOpenDirection): DoorOpenDirection {
  switch (dir) {
    case 'inward_right':
      return 'outward_right';
    case 'inward_left':
      return 'outward_left';
    case 'outward_right':
      return 'inward_right';
    case 'outward_left':
      return 'inward_left';
  }
}

function newRotation(rot: number, spec: TransformSpec, keepReadable = false): number {
  let r = rot || 0;
  if (spec.mirrorAxisDeg !== null && !keepReadable) r = 2 * spec.mirrorAxisDeg - r;
  return norm360(r + spec.rotateDeg);
}

/**
 * التحديثات اللازمة لتحويل عنصر. wallIds: الجدران المشمولة بالتحويل
 * (الأبواب والنوافذ والرموز الملتصقة تتبع جدرانها). يُرجع null إن كان العنصر لا يتأثر.
 */
export function transformUpdates(
  obj: ProjectObject,
  spec: TransformSpec,
  wallIds: Set<string>
): Partial<ProjectObject> | null {
  switch (obj.type) {
    case 'wall': {
      const w = obj as WallObject;
      return { start: spec.map(w.start), end: spec.map(w.end) } as Partial<WallObject>;
    }
    case 'door': {
      const d = obj as DoorObject;
      if (!wallIds.has(d.wallId)) return null; // الباب يتبع جداره فقط
      // الانعكاس يقلب جهة الجدار (الناظم)، فنقلب داخل/خارج ليبقى الباب مفتوحاً نحو نفس الفراغ المنعكس
      return spec.mirrorAxisDeg !== null ? ({ openDirection: flipDoorSide(d.openDirection) } as Partial<DoorObject>) : null;
    }
    case 'window': {
      const w = obj as WindowObject;
      void w;
      return null; // النافذة تتبع جدارها تلقائياً (موضع نسبي)
    }
    case 'dimension': {
      const d = obj as DimensionObject;
      const upd: Partial<DimensionObject> = { start: spec.map(d.start), end: spec.map(d.end) };
      if (spec.mirrorAxisDeg !== null) upd.offset = -(d.offset ?? 25);
      if (spec.scale !== 1 && d.offset !== undefined) upd.offset = (upd.offset ?? d.offset) * spec.scale;
      return upd as Partial<ProjectObject>;
    }
    case 'symbol': {
      const s = obj as SymbolObject;
      const p = spec.map({ x: s.x, y: s.y });
      const upd: Partial<SymbolObject> = { x: p.x, y: p.y, rotation: newRotation(s.rotation, spec) };
      if (spec.scale !== 1) upd.scale = r6((s.scale || 1) * spec.scale);
      if (spec.mirrorAxisDeg !== null && s.wallSide) upd.wallSide = (s.wallSide * -1) as 1 | -1;
      return upd as Partial<ProjectObject>;
    }
    case 'route': {
      const r = obj as RouteObject;
      return { points: r.points.map(spec.map) } as Partial<RouteObject>;
    }
    case 'line': {
      const l = obj as LineObject;
      return { points: l.points.map(spec.map) } as Partial<LineObject>;
    }
    case 'text': {
      const t = obj as TextObject;
      const p = spec.map({ x: t.x, y: t.y });
      // النص يبقى مقروءاً عند الانعكاس (مثل MIRRTEXT=0 في AutoCAD)
      const upd: Partial<TextObject> = { x: p.x, y: p.y, rotation: newRotation(t.rotation, spec, true) };
      if (spec.scale !== 1) upd.fontSize = r6((t.fontSize || 16) * spec.scale);
      return upd as Partial<ProjectObject>;
    }
  }
  return null;
}

/** توليد معرف جديد بنفس بادئة النوع */
export function newObjectId(type: string): string {
  return `${type}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * نسخ عناصر مع تطبيق تحويل على النسخ، وإعادة ربط الأبواب/النوافذ/الرموز الملتصقة بنسخ جدرانها.
 */
export function cloneTransformed(source: ProjectObject[], spec: TransformSpec): ProjectObject[] {
  const idMap = new Map<string, string>();
  const wallIds = new Set(source.filter((o) => o.type === 'wall').map((o) => o.id));
  const clones = source.map((orig) => {
    const clone = JSON.parse(JSON.stringify(orig)) as ProjectObject;
    clone.id = newObjectId(orig.type);
    idMap.set(orig.id, clone.id);
    const upd = transformUpdates(orig, spec, wallIds);
    if (upd) Object.assign(clone, upd);
    return clone;
  });
  for (const c of clones) {
    if (c.type === 'door' || c.type === 'window') {
      const mapped = idMap.get((c as DoorObject | WindowObject).wallId);
      if (mapped) (c as DoorObject | WindowObject).wallId = mapped;
    }
    if (c.type === 'symbol' && (c as SymbolObject).wallId) {
      const mapped = idMap.get((c as SymbolObject).wallId!);
      if (mapped) (c as SymbolObject).wallId = mapped;
    }
  }
  // الأبواب/النوافذ المنسوخة دون جدرانها كانت ستتراكب فوق الأصل على الجدار نفسه: نستبعدها
  const clonedWalls = new Set(clones.filter((c) => c.type === 'wall').map((c) => c.id));
  return clones.filter(
    (c) => !((c.type === 'door' || c.type === 'window') && !clonedWalls.has((c as DoorObject | WindowObject).wallId))
  );
}

/** إضافة الأبواب والنوافذ (والرموز الملتصقة) التابعة للجدران المحددة إلى قائمة المعرفات */
export function withHostedObjects(ids: string[], all: ProjectObject[]): string[] {
  const set = new Set(ids);
  const wallIds = new Set(all.filter((o) => o.type === 'wall' && set.has(o.id)).map((o) => o.id));
  for (const o of all) {
    if ((o.type === 'door' || o.type === 'window') && wallIds.has((o as DoorObject).wallId)) set.add(o.id);
  }
  return all.filter((o) => set.has(o.id)).map((o) => o.id);
}

/** مركز صندوق الإحاطة لمجموعة عناصر (للتدوير السريع حول المركز) */
export function selectionCenter(objs: ProjectObject[]): Point | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const inc = (p: Point) => {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  };
  for (const o of objs) {
    if (o.type === 'wall' || o.type === 'dimension') {
      inc((o as WallObject).start);
      inc((o as WallObject).end);
    } else if (o.type === 'symbol' || o.type === 'text') {
      inc({ x: (o as SymbolObject).x, y: (o as SymbolObject).y });
    } else if (o.type === 'route' || o.type === 'line') {
      (o as RouteObject | LineObject).points.forEach(inc);
    }
  }
  if (!isFinite(minX)) return null;
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
}

/** جدار موازٍ بإزاحة distance (موجبة = جهة الناظم الأيسر) */
export function offsetWall(w: WallObject, distance: number): WallObject {
  const dx = w.end.x - w.start.x;
  const dy = w.end.y - w.start.y;
  const l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l;
  const ny = dx / l;
  return {
    ...JSON.parse(JSON.stringify(w)),
    id: newObjectId('wall'),
    start: rp({ x: w.start.x + nx * distance, y: w.start.y + ny * distance }),
    end: rp({ x: w.end.x + nx * distance, y: w.end.y + ny * distance }),
  };
}
