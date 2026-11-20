/**
 * @file dxfImport.ts
 * @description استيراد ملفات DXF (AutoCAD) — قارئ واعٍ بالأقسام:
 * - جدول الطبقات (LAYER): الأسماء والألوان (ACI) والطبقات المطفأة
 * - الكتل (BLOCKS) وإدراجها (INSERT) مع الإزاحة والتدوير والتحجيم والتداخل
 * - LINE · LWPOLYLINE (مع الانحناء bulge) · POLYLINE/VERTEX · ARC · CIRCLE · TEXT · MTEXT
 * - وحدة الرسم من الترويسة ($INSUNITS) مع تخمين احتياطي
 *
 * ملاحظة إصلاح: القارئ السابق كان يقرأ محتوى تعريفات الكتل كأنها عناصر مرسومة عند نقطة الأصل،
 * ويتجاهل الأقواس والدوائر وألوان الطبقات، ويحوّل كل خط إلى جدار سميك.
 */

import type { Point, ProjectObject, WallObject, TextObject, LineObject, Layer } from '../model/types.ts';

export interface DxfLine { x1: number; y1: number; x2: number; y2: number; layer: string; color?: number }
export interface DxfPolyline { points: Point[]; layer: string; closed: boolean; color?: number }
export interface DxfText { x: number; y: number; text: string; height: number; layer: string; rotation?: number }
export interface DxfCircle { x: number; y: number; radius: number; layer: string; color?: number }
export interface DxfArc { x: number; y: number; radius: number; startAngle: number; endAngle: number; layer: string; color?: number }
export interface DxfInsert { name: string; x: number; y: number; rotation: number; layer: string; scaleX?: number; scaleY?: number }

export interface DxfParseResult {
  header: Record<string, any>;
  layers: { name: string; color: number; off?: boolean }[];
  lines: DxfLine[];
  polylines: DxfPolyline[];
  texts: DxfText[];
  circles: DxfCircle[];
  arcs: DxfArc[];
  inserts: DxfInsert[];
  /** عدد الكتل المعرّفة في قسم BLOCKS */
  blockCount?: number;
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

interface BlockDef {
  name: string;
  baseX: number;
  baseY: number;
  lines: DxfLine[];
  polylines: DxfPolyline[];
  texts: DxfText[];
  circles: DxfCircle[];
  arcs: DxfArc[];
  inserts: DxfInsert[];
}

type Bag = Pick<BlockDef, 'lines' | 'polylines' | 'texts' | 'circles' | 'arcs' | 'inserts'>;

const emptyBag = (): Bag => ({ lines: [], polylines: [], texts: [], circles: [], arcs: [], inserts: [] });

/** تحويل قوس انحناء (bulge) بين نقطتين إلى نقاط وسيطة */
function bulgePoints(a: Point, b: Point, bulge: number): Point[] {
  const theta = 4 * Math.atan(bulge);
  const chord = Math.hypot(b.x - a.x, b.y - a.y);
  if (chord < 1e-9 || Math.abs(theta) < 1e-6) return [];
  const r = chord / (2 * Math.sin(theta / 2));
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const h = r * Math.cos(theta / 2);
  // مركز القوس على العمودي من منتصف الوتر
  const ux = (b.x - a.x) / chord;
  const uy = (b.y - a.y) / chord;
  const cx = mx - uy * h;
  const cy = my + ux * h;
  const a0 = Math.atan2(a.y - cy, a.x - cx);
  const steps = Math.max(2, Math.min(64, Math.ceil(Math.abs(theta) / (Math.PI / 24))));
  const pts: Point[] = [];
  const R = Math.abs(r);
  for (let i = 1; i < steps; i++) {
    const t = a0 + (theta * i) / steps;
    pts.push({ x: cx + R * Math.cos(t), y: cy + R * Math.sin(t) });
  }
  return pts;
}

/** نقاط تقريبية لقوس (زوايا DXF بالدرجات عكس عقارب الساعة) */
export function arcToPoints(cx: number, cy: number, r: number, startDeg: number, endDeg: number): Point[] {
  let sweep = endDeg - startDeg;
  while (sweep <= 0) sweep += 360;
  const steps = Math.max(4, Math.min(128, Math.ceil(sweep / 7.5)));
  const pts: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = ((startDeg + (sweep * i) / steps) * Math.PI) / 180;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

export function parseDxfString(dxfText: string): DxfParseResult {
  const raw = dxfText.split(/\r?\n/);
  const pairs: [string, string][] = [];
  for (let k = 0; k + 1 < raw.length; k += 2) pairs.push([raw[k].trim(), (raw[k + 1] ?? '').trim()]);

  const result: DxfParseResult = {
    header: {},
    layers: [],
    lines: [],
    polylines: [],
    texts: [],
    circles: [],
    arcs: [],
    inserts: [],
    bounds: { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  };
  const blocks = new Map<string, BlockDef>();

  let section = '';
  let currentBlock: BlockDef | null = null;
  let i = 0;
  const n = pairs.length;

  /** قراءة كيان: تجمع كل الأزواج حتى الرمز 0 التالي */
  const readEntity = (): [string, string][] => {
    const out: [string, string][] = [];
    while (i < n && pairs[i][0] !== '0') out.push(pairs[i++]);
    return out;
  };

  while (i < n) {
    const [code, value] = pairs[i++];
    if (code !== '0') continue;

    if (value === 'SECTION') {
      const nm = pairs[i] && pairs[i][0] === '2' ? pairs[i][1] : '';
      section = nm;
      continue;
    }
    if (value === 'ENDSEC') {
      section = '';
      continue;
    }
    if (value === 'EOF') break;

    if (section === 'HEADER') continue;

    if (section === 'TABLES' && value === 'LAYER') {
      const ent = readEntity();
      let name = '';
      let color = 7;
      for (const [c, v] of ent) {
        if (c === '2') name = v;
        else if (c === '62') color = parseInt(v, 10);
      }
      if (name && !result.layers.some((l) => l.name === name)) {
        result.layers.push({ name, color: Math.abs(color) || 7, off: color < 0 });
      }
      continue;
    }

    if (section === 'BLOCKS') {
      if (value === 'BLOCK') {
        const ent = readEntity();
        const b: BlockDef = { name: '', baseX: 0, baseY: 0, ...emptyBag() };
        for (const [c, v] of ent) {
          if (c === '2') b.name = v;
          else if (c === '10') b.baseX = parseFloat(v) || 0;
          else if (c === '20') b.baseY = parseFloat(v) || 0;
        }
        currentBlock = b;
        continue;
      }
      if (value === 'ENDBLK') {
        if (currentBlock?.name) blocks.set(currentBlock.name, currentBlock);
        currentBlock = null;
        readEntity();
        continue;
      }
    }

    const inEntities = section === 'ENTITIES';
    const inBlock = section === 'BLOCKS' && currentBlock !== null;
    if (!inEntities && !inBlock) continue;
    const target: Bag = inBlock ? currentBlock! : result;

    switch (value) {
      case 'LINE': {
        const e = readEntity();
        const l: DxfLine = { x1: 0, y1: 0, x2: 0, y2: 0, layer: '0' };
        for (const [c, v] of e) {
          if (c === '8') l.layer = v;
          else if (c === '10') l.x1 = parseFloat(v);
          else if (c === '20') l.y1 = parseFloat(v);
          else if (c === '11') l.x2 = parseFloat(v);
          else if (c === '21') l.y2 = parseFloat(v);
          else if (c === '62') l.color = parseInt(v, 10);
        }
        target.lines.push(l);
        break;
      }
      case 'LWPOLYLINE': {
        const e = readEntity();
        const p: DxfPolyline = { points: [], layer: '0', closed: false };
        const bulges: number[] = [];
        let curX: number | null = null;
        for (const [c, v] of e) {
          if (c === '8') p.layer = v;
          else if (c === '70') p.closed = (parseInt(v, 10) & 1) === 1;
          else if (c === '62') p.color = parseInt(v, 10);
          else if (c === '10') curX = parseFloat(v);
          else if (c === '20' && curX !== null) {
            p.points.push({ x: curX, y: parseFloat(v) });
            bulges.push(0);
            curX = null;
          } else if (c === '42' && bulges.length > 0) bulges[bulges.length - 1] = parseFloat(v) || 0;
        }
        // توسيع مقاطع الانحناء (bulge) إلى نقاط قوس
        if (bulges.some((b) => b !== 0)) {
          const expanded: Point[] = [];
          const cnt = p.points.length;
          const segs = p.closed ? cnt : cnt - 1;
          for (let k = 0; k < cnt; k++) {
            expanded.push(p.points[k]);
            if (k < segs && bulges[k]) expanded.push(...bulgePoints(p.points[k], p.points[(k + 1) % cnt], bulges[k]));
          }
          p.points = expanded;
        }
        if (p.points.length > 0) target.polylines.push(p);
        break;
      }
      case 'POLYLINE': {
        const head = readEntity();
        const p: DxfPolyline = { points: [], layer: '0', closed: false };
        for (const [c, v] of head) {
          if (c === '8') p.layer = v;
          else if (c === '70') p.closed = (parseInt(v, 10) & 1) === 1;
          else if (c === '62') p.color = parseInt(v, 10);
        }
        while (i < n) {
          const [c, v] = pairs[i];
          if (c === '0' && v === 'VERTEX') {
            i++;
            const ve = readEntity();
            let vx = 0, vy = 0;
            for (const [vc, vv] of ve) {
              if (vc === '10') vx = parseFloat(vv);
              else if (vc === '20') vy = parseFloat(vv);
            }
            p.points.push({ x: vx, y: vy });
          } else if (c === '0' && v === 'SEQEND') {
            i++;
            readEntity();
            break;
          } else break;
        }
        if (p.points.length > 0) target.polylines.push(p);
        break;
      }
      case 'CIRCLE': {
        const e = readEntity();
        const ci: DxfCircle = { x: 0, y: 0, radius: 1, layer: '0' };
        for (const [c, v] of e) {
          if (c === '8') ci.layer = v;
          else if (c === '10') ci.x = parseFloat(v);
          else if (c === '20') ci.y = parseFloat(v);
          else if (c === '40') ci.radius = parseFloat(v);
          else if (c === '62') ci.color = parseInt(v, 10);
        }
        target.circles.push(ci);
        break;
      }
      case 'ARC': {
        const e = readEntity();
        const a: DxfArc = { x: 0, y: 0, radius: 1, startAngle: 0, endAngle: 360, layer: '0' };
        for (const [c, v] of e) {
          if (c === '8') a.layer = v;
          else if (c === '10') a.x = parseFloat(v);
          else if (c === '20') a.y = parseFloat(v);
          else if (c === '40') a.radius = parseFloat(v);
          else if (c === '50') a.startAngle = parseFloat(v);
          else if (c === '51') a.endAngle = parseFloat(v);
          else if (c === '62') a.color = parseInt(v, 10);
        }
        target.arcs.push(a);
        break;
      }
      case 'TEXT':
      case 'MTEXT': {
        const e = readEntity();
        const t: DxfText = { x: 0, y: 0, text: '', height: 0.2, layer: '0' };
        let mtextExtra = '';
        for (const [c, v] of e) {
          if (c === '8') t.layer = v;
          else if (c === '10') t.x = parseFloat(v);
          else if (c === '20') t.y = parseFloat(v);
          else if (c === '40') t.height = parseFloat(v);
          else if (c === '50') t.rotation = parseFloat(v);
          else if (c === '1') t.text = v;
          else if (c === '3') mtextExtra += v; // أجزاء MTEXT الطويلة
        }
        let txt = (mtextExtra + t.text)
          .replace(/\\P/g, '\n')
          .replace(/\\[A-Za-z][^;]*;/g, '')
          .replace(/[{}]/g, '');
        txt = txt.trim();
        if (txt) target.texts.push({ ...t, text: txt });
        break;
      }
      case 'INSERT': {
        const e = readEntity();
        const ins: DxfInsert = { name: '', x: 0, y: 0, rotation: 0, layer: '0', scaleX: 1, scaleY: 1 };
        for (const [c, v] of e) {
          if (c === '2') ins.name = v;
          else if (c === '8') ins.layer = v;
          else if (c === '10') ins.x = parseFloat(v);
          else if (c === '20') ins.y = parseFloat(v);
          else if (c === '41') ins.scaleX = parseFloat(v) || 1;
          else if (c === '42') ins.scaleY = parseFloat(v) || 1;
          else if (c === '50') ins.rotation = parseFloat(v) || 0;
        }
        if (ins.name) target.inserts.push(ins);
        break;
      }
      default:
        readEntity();
    }
  }

  // ترويسة الوحدات
  for (let k = 0; k < pairs.length - 1; k++) {
    if (pairs[k][0] === '9' && pairs[k][1] === '$INSUNITS' && pairs[k + 1][0] === '70') {
      result.header.$INSUNITS = parseInt(pairs[k + 1][1], 10);
      break;
    }
  }

  // ─── توسيع إدراجات الكتل (INSERT) إلى عناصر حقيقية بإحداثيات الرسم ───
  result.blockCount = blocks.size;
  const expand = (bag: Bag, ins: DxfInsert, depth: number) => {
    const b = blocks.get(ins.name);
    if (!b || depth > 4) return;
    const rad = (ins.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const sxs = ins.scaleX ?? 1;
    const sys = ins.scaleY ?? 1;
    const tf = (p: Point): Point => {
      const lx = (p.x - b.baseX) * sxs;
      const ly = (p.y - b.baseY) * sys;
      return { x: ins.x + lx * cos - ly * sin, y: ins.y + lx * sin + ly * cos };
    };
    // الطبقة "0" داخل الكتلة ترث طبقة الإدراج (سلوك AutoCAD)
    const lay = (l: string) => (l === '0' ? ins.layer : l);
    for (const l of b.lines) {
      const a = tf({ x: l.x1, y: l.y1 });
      const c = tf({ x: l.x2, y: l.y2 });
      bag.lines.push({ x1: a.x, y1: a.y, x2: c.x, y2: c.y, layer: lay(l.layer), color: l.color });
    }
    for (const p of b.polylines) bag.polylines.push({ ...p, layer: lay(p.layer), points: p.points.map(tf) });
    for (const c of b.circles) {
      bag.polylines.push({ points: arcToPoints(c.x, c.y, c.radius, 0, 360).map(tf), layer: lay(c.layer), closed: true, color: c.color });
    }
    for (const a of b.arcs) {
      bag.polylines.push({ points: arcToPoints(a.x, a.y, a.radius, a.startAngle, a.endAngle).map(tf), layer: lay(a.layer), closed: false, color: a.color });
    }
    for (const t of b.texts) {
      const p = tf({ x: t.x, y: t.y });
      bag.texts.push({ ...t, x: p.x, y: p.y, layer: lay(t.layer), height: t.height * Math.abs(sys), rotation: (t.rotation || 0) + ins.rotation });
    }
    for (const sub of b.inserts) {
      // إدراج متداخل: نحسب موضعه ودورانه داخل الأب
      const p = tf({ x: sub.x, y: sub.y });
      expand(bag, { ...sub, x: p.x, y: p.y, rotation: sub.rotation + ins.rotation, scaleX: (sub.scaleX ?? 1) * sxs, scaleY: (sub.scaleY ?? 1) * sys, layer: lay(sub.layer) }, depth + 1);
    }
  };
  for (const ins of result.inserts) expand(result, ins, 0);

  // الحدود
  const ub = (x: number, y: number) => {
    if (!isFinite(x) || !isFinite(y)) return;
    if (x < result.bounds.minX) result.bounds.minX = x;
    if (x > result.bounds.maxX) result.bounds.maxX = x;
    if (y < result.bounds.minY) result.bounds.minY = y;
    if (y > result.bounds.maxY) result.bounds.maxY = y;
  };
  result.lines.forEach((l) => { ub(l.x1, l.y1); ub(l.x2, l.y2); });
  result.polylines.forEach((p) => p.points.forEach((q) => ub(q.x, q.y)));
  result.circles.forEach((c) => { ub(c.x - c.radius, c.y - c.radius); ub(c.x + c.radius, c.y + c.radius); });
  result.arcs.forEach((c) => { ub(c.x - c.radius, c.y - c.radius); ub(c.x + c.radius, c.y + c.radius); });
  result.texts.forEach((t) => ub(t.x, t.y));
  if (!isFinite(result.bounds.minX)) result.bounds = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
  return result;
}

/** ألوان AutoCAD القياسية (ACI) الأساسية */
const ACI_BASE: Record<number, string> = {
  1: '#ff0000', 2: '#ffff00', 3: '#00ff00', 4: '#00ffff', 5: '#0000ff', 6: '#ff00ff', 7: '#f3f4f6',
  8: '#808080', 9: '#c0c0c0', 250: '#333333', 251: '#505050', 252: '#696969', 253: '#828282', 254: '#bebebe', 255: '#ffffff',
};

export function aciToHex(aci: number | undefined): string | undefined {
  if (aci === undefined || aci === 256 || aci === 0) return undefined; // ByLayer / ByBlock
  if (ACI_BASE[aci]) return ACI_BASE[aci];
  if (aci >= 10 && aci <= 249) {
    // تقريب عجلة الألوان: كل 10 أرقام = تدرّج لون
    const hue = ((aci - 10) / 240) * 360;
    const shade = (aci % 10) % 2 === 0 ? 50 : 35;
    return `hsl(${Math.round(hue)}, 85%, ${shade}%)`;
  }
  return undefined;
}

/** أنماط أسماء طبقات الجدران الشائعة (AIA: A-WALL، عربية، فرنسية...) */
const WALL_LAYER_RE = /(^|[^a-z])(a[-_ ]?)?wall|walls|جدار|جدران|حوائط|mur|wand/i;

export type DxfWallMode = 'auto' | 'byLayer' | 'all' | 'none';

export interface DxfImportOptions {
  /**
   * byLayer: الخطوط في طبقات الجدران فقط تصبح جدراناً والباقي خطوطاً حرة
   * all: كل الخطوط جدران (السلوك السابق) · none: كل شيء خطوط حرة
   * auto: byLayer إن وُجدت طبقة جدران، وإلا all
   */
  wallMode?: DxfWallMode;
  wallThickness?: number;
}

/**
 * تحويل نتيجة قراءة DXF إلى عناصر مشروع حقيقية (جدران، خطوط حرة، نصوص) وطبقات بألوانها
 */
export function convertDxfToProjectData(
  parsed: DxfParseResult,
  targetPixelsPerMeter = 50,
  options: DxfImportOptions = {}
): { objects: ProjectObject[]; layers: Layer[] } {
  const objects: ProjectObject[] = [];
  const layersMap: Map<string, Layer> = new Map();

  const width = parsed.bounds.maxX - parsed.bounds.minX;
  const height = parsed.bounds.maxY - parsed.bounds.minY;
  const centerX = (parsed.bounds.minX + parsed.bounds.maxX) / 2;
  const centerY = (parsed.bounds.minY + parsed.bounds.maxY) / 2;

  // الوحدة: من الترويسة إن وُجدت ($INSUNITS)، وإلا التخمين السابق (مليمتر إن كان الامتداد > 500)
  const insunits = parsed.header?.$INSUNITS as number | undefined;
  const unitByHeader: Record<number, number> = { 1: 0.0254, 2: 0.3048, 4: 0.001, 5: 0.01, 6: 1 };
  const dxfUnitScale = insunits && unitByHeader[insunits] ? unitByHeader[insunits] : width > 500 || height > 500 ? 0.001 : 1.0;

  const toWorld = (p: Point): Point => ({
    x: (p.x - centerX) * dxfUnitScale * targetPixelsPerMeter,
    // في CAD المحور Y موجب للأعلى ومعكوس بالنسبة لكانفس الويب
    y: -(p.y - centerY) * dxfUnitScale * targetPixelsPerMeter,
  });

  const layerInfo = new Map(parsed.layers.map((l) => [l.name, l]));
  const getOrCreateLayer = (name: string): string => {
    const safeId = 'dxf_' + (name || '0').toLowerCase().replace(/[^a-z0-9؀-ۿ]/g, '_');
    if (!layersMap.has(safeId)) {
      const info = layerInfo.get(name);
      layersMap.set(safeId, {
        id: safeId,
        name: name || 'DXF Layer',
        visible: info ? !info.off : true,
        locked: false,
        color: aciToHex(info?.color) || '#38bdf8',
        opacity: 1,
      });
    }
    return safeId;
  };

  const anyWallLayer = [...new Set([...parsed.lines.map((l) => l.layer), ...parsed.polylines.map((p) => p.layer), ...parsed.layers.map((l) => l.name)])].some((n) => WALL_LAYER_RE.test(n));
  const mode: DxfWallMode = options.wallMode && options.wallMode !== 'auto' ? options.wallMode : anyWallLayer ? 'byLayer' : 'all';
  const isWallLayer = (layer: string) => mode === 'all' || (mode === 'byLayer' && WALL_LAYER_RE.test(layer));
  const thickness = options.wallThickness ?? 20;

  let idCounter = 1;
  const pushWall = (a: Point, b: Point, layerId: string) => {
    if (Math.hypot(b.x - a.x, b.y - a.y) > 3) {
      objects.push({ id: `dxf_wall_${idCounter++}`, type: 'wall', layerId, start: a, end: b, thickness } as WallObject);
    }
  };
  const pushLine = (pts: Point[], closed: boolean, layerId: string, color?: number) => {
    if (pts.length < 2) return;
    const obj: LineObject = { id: `dxf_line_${idCounter++}`, type: 'line', layerId, points: pts, closed };
    const c = aciToHex(color);
    if (c) obj.color = c;
    objects.push(obj);
  };

  // 1. الخطوط
  for (const line of parsed.lines) {
    const layerId = getOrCreateLayer(line.layer);
    const a = toWorld({ x: line.x1, y: line.y1 });
    const b = toWorld({ x: line.x2, y: line.y2 });
    if (isWallLayer(line.layer)) pushWall(a, b, layerId);
    else pushLine([a, b], false, layerId, line.color);
  }

  // 2. الخطوط المتعددة
  for (const poly of parsed.polylines) {
    const layerId = getOrCreateLayer(poly.layer);
    const pts = poly.points.map(toWorld);
    if (isWallLayer(poly.layer)) {
      for (let j = 0; j < pts.length - 1; j++) pushWall(pts[j], pts[j + 1], layerId);
      if (poly.closed && pts.length > 2) pushWall(pts[pts.length - 1], pts[0], layerId);
    } else {
      pushLine(pts, poly.closed, layerId, poly.color);
    }
  }

  // 3. الدوائر والأقواس (كانت تُتجاهل سابقاً) ← خطوط حرة بتقريب منحنٍ
  for (const c of parsed.circles) {
    pushLine(arcToPoints(c.x, c.y, c.radius, 0, 360).map(toWorld), true, getOrCreateLayer(c.layer), c.color);
  }
  for (const a of parsed.arcs) {
    pushLine(arcToPoints(a.x, a.y, a.radius, a.startAngle, a.endAngle).map(toWorld), false, getOrCreateLayer(a.layer), a.color);
  }

  // 4. النصوص
  for (const txt of parsed.texts) {
    const layerId = getOrCreateLayer(txt.layer);
    const p = toWorld({ x: txt.x, y: txt.y });
    objects.push({
      id: `dxf_text_${idCounter++}`,
      type: 'text',
      layerId,
      text: txt.text,
      x: p.x,
      y: p.y,
      fontSize: Math.max(10, Math.min(80, Math.round((txt.height || 0.25) * targetPixelsPerMeter * dxfUnitScale))),
      color: '#38bdf8',
      // DXF: الزاوية عكس عقارب الساعة؛ Konva: مع عقارب الساعة ومحور Y معكوس
      rotation: txt.rotation ? ((-txt.rotation % 360) + 360) % 360 : 0,
      backgroundColor: '#0f172a',
      backgroundOpacity: 0.9,
      borderColor: '#38bdf8',
      padding: 6,
      fontWeight: 'normal',
      align: 'right',
    } as TextObject);
  }

  return { objects, layers: Array.from(layersMap.values()) };
}
