/**
 * @file vectorize.ts
 * @description تحويل رسم الرمز (نفس renderKonva المستخدم على لوحة الرسم) إلى عناصر متجهية بسيطة:
 * خطوط متعددة، دوائر، نصوص — بإحداثيات الرمز المحلية (المركز 0,0 وبحجمه الافتراضي).
 * تُستخدم لكتل DXF ولتصدير SVG، فيخرج الرمز بشكله الحقيقي بدل دائرة وتسمية.
 */
import Konva from 'konva';
import type { Point } from '../../model/types.ts';
import { getSymbolById } from '../../symbols/registry.ts';

interface PrimBase {
  /** شفافية الشكل (0..1) */
  opacity?: number;
  /** معرف العنصر الذي ينتمي إليه الشكل (أقرب أب يحمل معرف عنصر) */
  oid?: string;
}
export type VPrim = PrimBase &
  (
    | { kind: 'poly'; pts: Point[]; closed: boolean; stroke?: string; fill?: string; width: number; dash?: number[] }
    | { kind: 'circle'; c: Point; r: number; stroke?: string; fill?: string; width: number }
    | { kind: 'text'; p: Point; text: string; size: number; anchor: 'start' | 'middle' | 'end'; rotation: number; fill?: string; bold?: boolean }
  );

const colorOf = (v: unknown): string | undefined => (typeof v === 'string' && v && v !== 'transparent' ? v : undefined);

function arcPoints(cx: number, cy: number, r: number, startDeg: number, sweepDeg: number): Point[] {
  const n = Math.max(6, Math.ceil(Math.abs(sweepDeg) / 6));
  const out: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const a = ((startDeg + (sweepDeg * i) / n) * Math.PI) / 180;
    out.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return out;
}

/** يحوّل كل الأشكال داخل حاوية Konva إلى عناصر متجهية بإحداثياتها المطلقة. ids: معرفات العناصر لربط كل شكل بعنصره */
export function vectorizeGroup(root: Konva.Container, ids?: Set<string>): VPrim[] {
  const all: VPrim[] = [];
  root.find('Shape').forEach((node) => {
    const s = node as Konva.Shape;
    if (!s.isVisible()) return;
    const opacity = s.getAbsoluteOpacity();
    if (opacity <= 0.001) return;
    let oid: string | undefined;
    if (ids) {
      let cur: Konva.Node | null = s;
      while (cur && cur !== root) {
        if (ids.has(cur.id())) {
          oid = cur.id();
          break;
        }
        cur = cur.getParent();
      }
    }
    const out: VPrim[] = [];
    const tr = s.getAbsoluteTransform().copy();
    const m = (p: Point) => tr.point(p);
    const sc = Math.abs(s.getAbsoluteScale().x) || 1;
    const stroke = s.strokeEnabled() ? colorOf(s.stroke()) : undefined;
    const fill = s.fillEnabled() ? colorOf(s.fill()) : undefined;
    const width = (s.strokeWidth() || 0) * sc;
    const dash = s.dashEnabled() && s.dash()?.length ? s.dash().map((d) => d * sc) : undefined;
    const cls = s.getClassName();
    const a = s.attrs as Record<string, number | string | boolean | number[] | undefined>;
    const push = (pts: Point[], closed: boolean) => pts.length >= 2 && out.push({ kind: 'poly', pts: pts.map(m), closed, stroke, fill: closed ? fill : undefined, width, dash });
    switch (cls) {
      case 'Line':
      case 'Arrow': {
        const p = (a.points as number[]) || [];
        const pts: Point[] = [];
        for (let i = 0; i + 1 < p.length; i += 2) pts.push({ x: p[i], y: p[i + 1] });
        push(pts, Boolean(a.closed));
        break;
      }
      case 'Rect': {
        const w = Number(a.width || 0);
        const h = Number(a.height || 0);
        push([{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }], true);
        break;
      }
      case 'Circle': {
        const r = Number(a.radius || 0);
        const c = m({ x: 0, y: 0 });
        const k = Math.hypot(tr.point({ x: 1, y: 0 }).x - c.x, tr.point({ x: 1, y: 0 }).y - c.y);
        out.push({ kind: 'circle', c, r: r * k, stroke, fill, width });
        break;
      }
      case 'Ellipse': {
        const rx = Number(a.radiusX || 0);
        const ry = Number(a.radiusY || 0);
        const pts: Point[] = [];
        for (let i = 0; i < 48; i++) {
          const t = (i / 48) * Math.PI * 2;
          pts.push({ x: rx * Math.cos(t), y: ry * Math.sin(t) });
        }
        push(pts, true);
        break;
      }
      case 'Arc': {
        const outer = Number(a.outerRadius || 0);
        const inner = Number(a.innerRadius || 0);
        const ang = Number(a.angle || 0);
        const sweep = a.clockwise ? -(360 - ang) : ang;
        const o = arcPoints(0, 0, outer, 0, sweep);
        if (inner > 0) {
          const i = arcPoints(0, 0, inner, 0, sweep).reverse();
          push([...o, ...i], fill !== undefined);
        } else push(o, false);
        break;
      }
      case 'Wedge': {
        const r = Number(a.radius || 0);
        push([{ x: 0, y: 0 }, ...arcPoints(0, 0, r, 0, Number(a.angle || 0))], true);
        break;
      }
      case 'Ring': {
        const c = m({ x: 0, y: 0 });
        const k = Math.hypot(tr.point({ x: 1, y: 0 }).x - c.x, tr.point({ x: 1, y: 0 }).y - c.y);
        out.push({ kind: 'circle', c, r: Number(a.outerRadius || 0) * k, stroke, fill: undefined, width });
        out.push({ kind: 'circle', c, r: Number(a.innerRadius || 0) * k, stroke, fill: undefined, width });
        break;
      }
      case 'RegularPolygon':
      case 'Star': {
        const n = Number(a.sides || a.numPoints || 5) * (cls === 'Star' ? 2 : 1);
        const pts: Point[] = [];
        for (let i = 0; i < n; i++) {
          const r = cls === 'Star' ? (i % 2 ? Number(a.innerRadius) : Number(a.outerRadius)) : Number(a.radius);
          const t = (i / n) * Math.PI * 2 - Math.PI / 2;
          pts.push({ x: r * Math.cos(t), y: r * Math.sin(t) });
        }
        push(pts, true);
        break;
      }
      case 'Path': {
        const path = s as Konva.Path;
        const L = path.getLength();
        if (L > 0) {
          const n = Math.max(8, Math.min(200, Math.ceil(L / 2)));
          const pts: Point[] = [];
          for (let i = 0; i <= n; i++) {
            const q = path.getPointAtLength((L * i) / n);
            if (q) pts.push(q);
          }
          const closed = /z\s*$/i.test(String(a.data || ''));
          push(pts, closed);
        }
        break;
      }
      case 'Text': {
        const t = s as Konva.Text;
        const size = (t.fontSize() || 10) * sc;
        const w = t.width();
        const align = t.align();
        const anchor: 'start' | 'middle' | 'end' = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start';
        const lx = anchor === 'middle' ? w / 2 : anchor === 'end' ? w : 0;
        const p = m({ x: lx, y: (t.fontSize() || 10) * 0.85 });
        if (t.text()) out.push({ kind: 'text', p, text: t.text(), size, anchor, rotation: s.getAbsoluteRotation(), fill: fill || stroke, bold: /bold/.test(t.fontStyle()) });
        break;
      }
    }
    for (const pr of out) {
      if (opacity < 0.999) pr.opacity = opacity;
      if (oid) pr.oid = oid;
      all.push(pr);
    }
  });
  return all;
}

const cache = new Map<string, VPrim[]>();

/** عناصر الرمز المتجهية بحجمه الافتراضي (scale = 1)، أو [] إن تعذر رسمه */
export function vectorizeSymbol(kind: string, color: string): VPrim[] {
  const key = `${kind}|${color}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const def = getSymbolById(kind);
  let prims: VPrim[] = [];
  if (def) {
    try {
      const g = new Konva.Group();
      def.renderKonva(g, { color, isSelected: false, zoom: 1 });
      prims = vectorizeGroup(g);
      g.destroy();
    } catch {
      prims = [];
    }
  }
  cache.set(key, prims);
  return prims;
}
