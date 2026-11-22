/**
 * @file svgExport.ts
 * @description تصدير المخطط كملف SVG متجه (يُفتح في المتصفحات وInkscape وIllustrator ويُطبع بأي دقة):
 * نفس رسم لوحة الرسم بعد تحويله إلى خطوط ودوائر ونصوص، بمقاس حقيقي بالمليمتر حسب مقياس الطباعة.
 */
import type { VPrim } from './vectorize.ts';

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n = (v: number) => (Math.round(v * 100) / 100).toString();

export interface SvgOptions {
  /** مقياس الرسم 1:S لحساب المقاس الفعلي بالمليمتر */
  scale: number;
  pixelsPerMeter: number;
  title?: string;
  padding?: number;
}

export function buildSvg(prims: VPrim[], bounds: { minX: number; minY: number; width: number; height: number }, opts: SvgOptions): string {
  const pad = opts.padding ?? 40;
  const x0 = bounds.minX - pad;
  const y0 = bounds.minY - pad;
  const w = Math.max(1, bounds.width + pad * 2);
  const h = Math.max(1, bounds.height + pad * 2);
  // مم على الورق لكل بكسل عالم = (1000/S)/ppm
  const k = 1000 / opts.scale / (opts.pixelsPerMeter || 50);
  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>');
  out.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${n(x0)} ${n(y0)} ${n(w)} ${n(h)}" width="${n(w * k)}mm" height="${n(h * k)}mm" font-family="Cairo, 'Noto Naskh Arabic', Arial, sans-serif">`
  );
  if (opts.title) out.push(`<title>${esc(opts.title)}</title>`);
  out.push(`<desc>CAD Studio — مقياس 1:${opts.scale}</desc>`);
  out.push(`<rect x="${n(x0)}" y="${n(y0)}" width="${n(w)}" height="${n(h)}" fill="#ffffff"/>`);
  for (const p of prims) {
    const op = p.opacity !== undefined ? ` opacity="${n(p.opacity)}"` : '';
    if (p.kind === 'poly') {
      const pts = p.pts.map((q) => `${n(q.x)},${n(q.y)}`).join(' ');
      const fill = p.closed && p.fill ? p.fill : 'none';
      const stroke = p.stroke ? ` stroke="${p.stroke}" stroke-width="${n(p.width || 1)}" stroke-linecap="round" stroke-linejoin="round"` : '';
      const dash = p.dash && p.stroke ? ` stroke-dasharray="${p.dash.map(n).join(' ')}"` : '';
      if (!p.stroke && fill === 'none') continue;
      out.push(`<${p.closed ? 'polygon' : 'polyline'} points="${pts}" fill="${fill}"${stroke}${dash}${op}/>`);
    } else if (p.kind === 'circle') {
      if (!p.stroke && !p.fill) continue;
      const stroke = p.stroke ? ` stroke="${p.stroke}" stroke-width="${n(p.width || 1)}"` : '';
      out.push(`<circle cx="${n(p.c.x)}" cy="${n(p.c.y)}" r="${n(p.r)}" fill="${p.fill || 'none'}"${stroke}${op}/>`);
    } else {
      const rot = p.rotation ? ` transform="rotate(${n(p.rotation)} ${n(p.p.x)} ${n(p.p.y)})"` : '';
      const lines = p.text.split('\n');
      const weight = p.bold ? ' font-weight="bold"' : '';
      const body =
        lines.length === 1
          ? esc(p.text)
          : lines.map((l, i) => `<tspan x="${n(p.p.x)}" dy="${i === 0 ? 0 : n(p.size * 1.35)}">${esc(l)}</tspan>`).join('');
      out.push(`<text x="${n(p.p.x)}" y="${n(p.p.y)}" font-size="${n(p.size)}" text-anchor="${p.anchor}" fill="${p.fill || '#0f172a'}"${weight}${rot}${op}>${body}</text>`);
    }
  }
  out.push('</svg>');
  return out.join('\n');
}

export function downloadText(content: string, fileName: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
