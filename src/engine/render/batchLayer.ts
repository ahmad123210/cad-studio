/**
 * @file batchLayer.ts
 * @description الرسم المجمّع للمخططات الضخمة (Batched Rendering).
 *
 * عندما يتجاوز عدد العناصر المرئية حداً معيناً (مثلاً عرض مخطط من آلاف الجدران كاملاً)
 * يصبح إنشاء عقدة Konva لكل عنصر هو عنق الزجاجة. في هذا الوضع تُرسم العناصر غير المحددة
 * كلها داخل شكل Konva واحد (sceneFunc) بمسار واحد لكل لون، فتنخفض إعادة البناء من ثوانٍ إلى أجزاء من الثانية.
 *
 * التفاعل: الشكل المجمّع لا يستقبل الأحداث؛ النقر يمر للوحة فيعمل التحديد الهندسي بالقرب (الموجود أصلاً)،
 * والعنصر المحدد يُرسم كعقدة كاملة فوقه فيصبح قابلاً للسحب والتعديل كالمعتاد.
 */

import Konva from 'konva';
import type {
  Layer,
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
} from '../../model/types.ts';
import { getSymbolById } from '../../symbols/registry.ts';
import { wallOutline } from '../geometry/wallJoins.ts';
import type { CadEngine } from '../renderer.ts';

/** عدد العناصر المرئية الذي يبدأ عنده الرسم المجمّع */
export const BATCH_RENDER_THRESHOLD = 1500;

const LIGHT_WALL_COLORS = new Set(['#f3f4f6', '#ffffff', '#e2e8f0', '#f8fafc']);

export interface BatchInput {
  walls: WallObject[];
  doors: { door: DoorObject; wall: WallObject }[];
  windows: { win: WindowObject; wall: WallObject }[];
  dimensions: DimensionObject[];
  symbols: SymbolObject[];
  routes: RouteObject[];
  texts: TextObject[];
  lines: LineObject[];
  layerById: Map<string, Layer>;
  wallEndpointIndex: Map<string, WallObject[]>;
}

function pushGroup<T>(map: Map<string, T[]>, key: string, v: T): void {
  const l = map.get(key);
  if (l) l.push(v);
  else map.set(key, [v]);
}

export function renderBatchedImpl(this: CadEngine, input: BatchInput): void {
  const cam = this.camera.getState();
  const z = cam.zoom;
  const ox = cam.offsetX;
  const oy = cam.offsetY;
  const isDark = this.theme === 'dark';
  const sx = (x: number) => x * z + ox;
  const sy = (y: number) => y * z + oy;

  const wallColor = (w: WallObject): string => {
    const layer = input.layerById.get(w.layerId);
    if (!isDark && (!layer?.color || LIGHT_WALL_COLORS.has(layer.color) || layer.id === 'arch')) return '#1e293b';
    return layer?.color || '#e2e8f0';
  };

  // ── تجهيز البيانات مرة واحدة (sceneFunc قد يُستدعى أكثر من مرة) ──
  const wallPolys = new Map<string, number[][]>();
  for (const w of input.walls) {
    const poly = wallOutline(w, input.wallEndpointIndex);
    if (!poly) continue;
    pushGroup(wallPolys, wallColor(w), poly.flatMap((p) => [sx(p.x), sy(p.y)]));
  }

  const cutoutColor = isDark ? '#1e1e1e' : '#f7f7f7';
  const openingCuts: number[][] = [];
  const doorLeaves: number[][] = [];
  const windowLines: number[][] = [];
  const opening = (wall: WallObject, position: number, width: number) => {
    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return null;
    const ux = dx / len;
    const uy = dy / len;
    const nx = -uy;
    const ny = ux;
    const cx = wall.start.x + position * dx;
    const cy = wall.start.y + position * dy;
    const hw = width / 2;
    const ht = (wall.thickness || 20) / 2 + 0.5 / z;
    const quad = [
      { x: cx - hw * ux + nx * ht, y: cy - hw * uy + ny * ht },
      { x: cx + hw * ux + nx * ht, y: cy + hw * uy + ny * ht },
      { x: cx + hw * ux - nx * ht, y: cy + hw * uy - ny * ht },
      { x: cx - hw * ux - nx * ht, y: cy - hw * uy - ny * ht },
    ];
    openingCuts.push(quad.flatMap((p) => [sx(p.x), sy(p.y)]));
    return { cx, cy, ux, uy, nx, ny, hw };
  };
  for (const { door, wall } of input.doors) {
    const o = opening(wall, door.position, door.width);
    if (!o) continue;
    const side = door.openDirection.startsWith('inward') ? 1 : -1;
    const hingeSign = door.openDirection.endsWith('right') ? 1 : -1;
    const hinge = { x: o.cx + hingeSign * o.hw * o.ux, y: o.cy + hingeSign * o.hw * o.uy };
    const tip = { x: hinge.x + side * o.nx * o.hw * 2, y: hinge.y + side * o.ny * o.hw * 2 };
    doorLeaves.push([sx(hinge.x), sy(hinge.y), sx(tip.x), sy(tip.y)]);
  }
  for (const { win, wall } of input.windows) {
    const o = opening(wall, win.position, win.width);
    if (!o) continue;
    const a = { x: o.cx - o.hw * o.ux, y: o.cy - o.hw * o.uy };
    const b = { x: o.cx + o.hw * o.ux, y: o.cy + o.hw * o.uy };
    windowLines.push([sx(a.x), sy(a.y), sx(b.x), sy(b.y)]);
  }

  const routeLines = new Map<string, number[][]>();
  for (const r of input.routes) {
    const layer = input.layerById.get(r.layerId);
    const color = r.color || layer?.color || '#f59e0b';
    pushGroup(routeLines, color, r.points.flatMap((p) => [sx(p.x), sy(p.y)]));
  }

  const symbolMarks = new Map<string, number[][]>();
  for (const s of input.symbols) {
    const layer = input.layerById.get(s.layerId);
    let color = s.color || layer?.color || '#f59e0b';
    if (!isDark && !s.color && (!layer?.color || LIGHT_WALL_COLORS.has(color) || layer?.id === 'arch')) color = '#0f172a';
    const def = getSymbolById(s.symbolKind);
    const r = Math.max(2.5, ((def?.defaultWidth || 24) / 2) * (s.scale || 1) * z);
    pushGroup(symbolMarks, color, [sx(s.x), sy(s.y), r]);
  }

  const freeLines = new Map<string, { pts: number[]; closed: boolean }[]>();
  for (const l of input.lines) {
    const layer = input.layerById.get(l.layerId);
    let color = l.color || layer?.color || '#94a3b8';
    if (!isDark && LIGHT_WALL_COLORS.has(color)) color = '#334155';
    pushGroup(freeLines, color, { pts: l.points.flatMap((p) => [sx(p.x), sy(p.y)]), closed: Boolean(l.closed) });
  }

  const dimLines: number[][] = [];
  for (const d of input.dimensions) {
    dimLines.push([sx(d.start.x), sy(d.start.y), sx(d.end.x), sy(d.end.y)]);
  }

  const texts: { x: number; y: number; rot: number; size: number; text: string; color: string }[] = [];
  for (const t of input.texts) {
    const size = (t.fontSize || 16) * z;
    if (size < 5) continue; // لا يُقرأ عند هذا التصغير
    texts.push({ x: sx(t.x), y: sy(t.y), rot: ((t.rotation || 0) * Math.PI) / 180, size, text: t.text || '', color: t.color || '#38bdf8' });
  }

  const shape = new Konva.Shape({
    name: 'batched-objects',
    listening: false,
    perfectDrawEnabled: false,
    sceneFunc: (konvaCtx) => {
      const ctx = konvaCtx._context as CanvasRenderingContext2D;
      ctx.save();
      // الجدران: مسار مملوء واحد لكل لون
      // نملأ على دفعات صغيرة: مسار واحد بآلاف المضلعات المتراكبة يجعل حساب التعبئة بطيئاً جداً (غير خطي)
      const CHUNK = 128;
      for (const [color, polys] of wallPolys) {
        ctx.fillStyle = color;
        for (let start = 0; start < polys.length; start += CHUNK) {
          ctx.beginPath();
          const end = Math.min(polys.length, start + CHUNK);
          for (let j = start; j < end; j++) {
            const p = polys[j];
            ctx.moveTo(p[0], p[1]);
            for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
            ctx.closePath();
          }
          ctx.fill();
        }
      }
      // فتحات الأبواب والنوافذ
      if (openingCuts.length) {
        ctx.fillStyle = cutoutColor;
        for (let start = 0; start < openingCuts.length; start += CHUNK) {
          ctx.beginPath();
          const end = Math.min(openingCuts.length, start + CHUNK);
          for (let j = start; j < end; j++) {
            const p = openingCuts[j];
            ctx.moveTo(p[0], p[1]);
            for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
            ctx.closePath();
          }
          ctx.fill();
        }
      }
      ctx.lineCap = 'butt';
      if (doorLeaves.length) {
        ctx.beginPath();
        for (const l of doorLeaves) {
          ctx.moveTo(l[0], l[1]);
          ctx.lineTo(l[2], l[3]);
        }
        ctx.strokeStyle = isDark ? '#f59e0b' : '#b45309';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      if (windowLines.length) {
        ctx.beginPath();
        for (const l of windowLines) {
          ctx.moveTo(l[0], l[1]);
          ctx.lineTo(l[2], l[3]);
        }
        ctx.strokeStyle = isDark ? '#38bdf8' : '#0369a1';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      // الخطوط الحرة
      ctx.lineJoin = 'round';
      for (const [color, lines] of freeLines) {
        ctx.beginPath();
        for (const l of lines) {
          ctx.moveTo(l.pts[0], l.pts[1]);
          for (let i = 2; i < l.pts.length; i += 2) ctx.lineTo(l.pts[i], l.pts[i + 1]);
          if (l.closed) ctx.closePath();
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      // المسارات
      for (const [color, lines] of routeLines) {
        ctx.beginPath();
        for (const p of lines) {
          ctx.moveTo(p[0], p[1]);
          for (let i = 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, 2.5 * Math.min(1, z * 2));
        ctx.stroke();
      }
      // الأبعاد
      if (dimLines.length) {
        ctx.beginPath();
        for (const l of dimLines) {
          ctx.moveTo(l[0], l[1]);
          ctx.lineTo(l[2], l[3]);
        }
        ctx.strokeStyle = isDark ? '#38bdf8' : '#0284c7';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      // الرموز: علامة دائرية مبسطة بحجم الرمز الحقيقي
      for (const [color, marks] of symbolMarks) {
        ctx.beginPath();
        for (const m of marks) {
          ctx.moveTo(m[0] + m[2], m[1]);
          ctx.arc(m[0], m[1], m[2], 0, Math.PI * 2);
        }
        // دائرة مملوءة شبه شفافة + إطار: تبقى مرئية حتى عند التصغير الشديد
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.55;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      // النصوص المقروءة فقط
      if (texts.length) {
        ctx.textBaseline = 'top';
        for (const t of texts) {
          ctx.save();
          ctx.translate(t.x, t.y);
          if (t.rot) ctx.rotate(t.rot);
          ctx.font = `bold ${t.size}px Cairo, sans-serif`;
          ctx.fillStyle = t.color;
          const lines = t.text.split('\n');
          lines.forEach((ln, i) => ctx.fillText(ln, 0, i * t.size * 1.25));
          ctx.restore();
        }
      }
      ctx.restore();
    },
  });
  this.objectsLayer.add(shape);
}

/** هل يجب تفعيل الرسم المجمّع؟ (عدّ سريع مع خروج مبكر) */
export function countVisibleUpTo(objects: ProjectObject[], inView: (o: ProjectObject) => boolean, limit: number): number {
  let n = 0;
  for (const o of objects) {
    if (inView(o) && ++n >= limit) return n;
  }
  return n;
}

export type { Point };
