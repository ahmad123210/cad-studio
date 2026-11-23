/**
 * @file exportEngine.ts
 * @description محرك تصدير المخططات الهندسية وجداول الكميات (المرحلة 6).
 * يدعم:
 * 1. تصدير PDF هندسي عالي الدقة (jsPDF) مع خرطوشة معمارية احترافية، إطار حدود اللوحة، سهم الشمال، ومقياس الرسم.
 * 2. دعم مقاسات الورق المعيارية (A4, A3, A2, A1) بالوضع الأفقي أو الرأسي.
 * 3. خيارات المخطط اللوني (ورق أبيض رسمي، أو أوتوكاد داكن، أو بلوبرينت أزرق).
 * 4. تصدير صفحة ثانية اختيارية لجدول حصر الكميات والمواد (BOQ Sheet) داخل ملف PDF.
 * 5. تصدير جدول الكميات كـ CSV متوافق مع Excel باللغة العربية (UTF-8 BOM).
 * 6. تصدير صور عالية الدقة (300 DPI PNG/JPEG).
 */

import { localizeCsv } from '../i18n/workbook.ts';
import { jsPDF } from 'jspdf';
import { ProjectModel } from '../model/project.ts';
import { CadEngine } from './renderer.ts';
import { SymbolObject, RouteObject, WallObject, DoorObject, WindowObject } from '../model/types.ts';
import { getSymbolById, CATEGORIES_META } from '../symbols/registry.ts';
import { ROUTE_KINDS_META, calculateRoutePixelLength } from '../symbols/routes.ts';
import { SnapEngine } from './snap.ts';
import { fitStandardScale, fitsAtScale, mmPerWorldPx, niceScaleBar } from './print/printLayout.ts';
import { renderSymbolIcon } from './print/symbolIcon.ts';
import { buildSvg, downloadText } from './export/svgExport.ts';
import { computeQuantities, lineTotal, BOQ_SECTION_TITLES, type BoqLine, type BoqSection } from '../model/quantities.ts';

export type PaperFormat = 'a4' | 'a3' | 'a2' | 'a1' | 'a0' | 'letter';
export type Orientation = 'landscape' | 'portrait';
export type ColorTheme = 'white' | 'dark' | 'blueprint';
export type StampStatus = 'approved' | 'draft' | 'as_built' | 'for_review';

export interface TitleBlockData {
  projectName: string;
  drawingTitle: string;
  discipline: string;
  scaleText: string;
  sheetNumber: string;
  revision: string;
  date: string;
  engineer: string;
  client: string;
  stampStatus: StampStatus;
  notes?: string;
}

export interface ExportPDFOptions {
  paperFormat: PaperFormat;
  orientation: Orientation;
  theme: ColorTheme;
  includeTitleBlock: boolean;
  includeLegend: boolean;
  includeNorthArrow: boolean;
  includeScaleBar: boolean;
  includeStamp: boolean;
  includeGrid: boolean;
  includeBackground: boolean;
  includeDimensions: boolean;
  includeBOQSheet: boolean;
  includeSymbolsSheet?: boolean;
  includeSymbolsLegendSheet?: boolean;
  visibleLayerIds: string[];
  titleBlock: TitleBlockData;
  /** مقياس الطباعة الحقيقي (1:S) أو ملاءمة تلقائية لأقرب مقياس معياري يتسع فيه المخطط */
  printScale?: number | 'fit';
  /** زاوية سهم الشمال بالدرجات (0 = أعلى الورقة، مع عقارب الساعة) */
  northAngle?: number;
  /** سماكة خط الطباعة لكل طبقة بالمم (الطبقات غير المذكورة = تلقائي) */
  lineWeights?: Record<string, number>;
  /** عدة مناظير على اللوحة نفسها (فارغ = منظور واحد لكامل اللوحة الحالية) */
  views?: PrintView[];
  /** اسم الشركة/المكتب وشعاره (DataURL) في الخرطوشة */
  companyName?: string;
  logoDataUrl?: string;
  /** جدول المراجعات أعلى الخرطوشة */
  revisions?: { rev: string; date: string; description: string }[];
  /** طباعة كل لوحات المشروع في ملف PDF واحد (صفحة لكل لوحة) */
  allSheets?: boolean;
}

/** منظور على اللوحة: لوحة المصدر، والمنطقة (أو كامل المخطط)، والمقياس */
export interface PrintView {
  id: string;
  title: string;
  /** لوحة المصدر (افتراضياً اللوحة الحالية) */
  sheetId?: string;
  /** منطقة بإحداثيات العالم؛ غير موجودة = كامل عناصر اللوحة */
  region?: { minX: number; minY: number; maxX: number; maxY: number };
  /** 0 = ملاءمة تلقائية */
  scale: number;
}

/** نتيجة رسم اللوحة: المقياس المستخدم وهل يتسع المخطط بالكامل */
export interface SheetRenderInfo {
  scale: number;
  fits: boolean;
}

export const PAPER_DIMENSIONS_MM: Record<PaperFormat, { width: number; height: number }> = {
  a4: { width: 297, height: 210 },
  a3: { width: 420, height: 297 },
  a2: { width: 594, height: 420 },
  a1: { width: 841, height: 594 },
  a0: { width: 1189, height: 841 },
  letter: { width: 279.4, height: 215.9 },
};

/**
 * محرك التصدير الهندسي
 */
export class ExportEngine {
  /**
   * توليد وتنزيل ملف PDF متكامل للمشروع (المرحلة 6)
   */
  public static async exportPDF(
    engine: CadEngine,
    model: ProjectModel,
    options: ExportPDFOptions
  ): Promise<void> {
    const isLandscape = options.orientation === 'landscape';
    const paper = PAPER_DIMENSIONS_MM[options.paperFormat];
    const pdfW = isLandscape ? Math.max(paper.width, paper.height) : Math.min(paper.width, paper.height);
    const pdfH = isLandscape ? Math.min(paper.width, paper.height) : Math.max(paper.width, paper.height);

    const doc = new jsPDF({
      orientation: options.orientation,
      unit: 'mm',
      format: options.paperFormat,
      compress: true,
    });

    // 1. لوحة المخطط (أو كل اللوحات: صفحة لكل لوحة بعنوانها ورقم متسلسل)
    const pages: ExportPDFOptions[] = [];
    if (options.allSheets) {
      const sheets = model.getSheetSummaries();
      sheets.forEach((sh, i) => {
        pages.push({
          ...options,
          views: [{ id: sh.id, title: '', sheetId: sh.id, scale: typeof options.printScale === 'number' ? options.printScale : 0 }],
          titleBlock: {
            ...options.titleBlock,
            drawingTitle: sh.name,
            sheetNumber: sheets.length > 1 ? `${options.titleBlock.sheetNumber}-${String(i + 1).padStart(2, '0')}` : options.titleBlock.sheetNumber,
          },
        });
      });
    } else {
      pages.push(options);
    }
    for (let i = 0; i < pages.length; i++) {
      if (i > 0) doc.addPage(options.paperFormat, options.orientation);
      const drawingCanvas = await this.renderSheetToCanvas(engine, model, pages[i], pdfW, pdfH);
      const drawingImgData = drawingCanvas.toDataURL('image/jpeg', 0.95);
      doc.addImage(drawingImgData, 'JPEG', 0, 0, pdfW, pdfH, undefined, 'FAST');
    }

    // 2. إذا طُلب إرفاق جدول الرموز المستخدمة كصفحة مستقلة (Symbols Legend Sheet - البند 9)
    if (options.includeSymbolsSheet || options.includeSymbolsLegendSheet) {
      doc.addPage(options.paperFormat, options.orientation);
      const symbolsCanvas = await this.renderSymbolsLegendSheetToCanvas(model, options, pdfW, pdfH);
      const symbolsImgData = symbolsCanvas.toDataURL('image/jpeg', 0.95);
      doc.addImage(symbolsImgData, 'JPEG', 0, 0, pdfW, pdfH, undefined, 'FAST');
    }

    // 3. إذا طُلب إرفاق جدول الكميات كصفحة (BOQ Sheet - البند 7)
    if (options.includeBOQSheet) {
      for (const boqCanvas of this.renderBOQPagesToCanvases(model, options, pdfW, pdfH)) {
        doc.addPage(options.paperFormat, options.orientation);
        doc.addImage(boqCanvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pdfW, pdfH, undefined, 'FAST');
      }
    }

    // تنزيل الملف
    const cleanProjectName = (options.titleBlock.projectName || 'Drawing').replace(/[/\\?%*:|"<>]/g, '_');
    const cleanSheetNo = (options.titleBlock.sheetNumber || '01').replace(/[/\\?%*:|"<>]/g, '_');
    const fileName = `${cleanProjectName}_${cleanSheetNo}.pdf`;
    doc.save(fileName);
  }

  /**
   * توليد وتنزيل صورة عالية الدقة للمخطط (PNG أو JPEG)
   */
  public static async exportImage(
    engine: CadEngine,
    model: ProjectModel,
    options: ExportPDFOptions,
    format: 'png' | 'jpeg' = 'png',
    dpi = 288
  ): Promise<number> {
    const isLandscape = options.orientation === 'landscape';
    const paper = PAPER_DIMENSIONS_MM[options.paperFormat];
    const pdfW = isLandscape ? Math.max(paper.width, paper.height) : Math.min(paper.width, paper.height);
    const pdfH = isLandscape ? Math.min(paper.width, paper.height) : Math.max(paper.width, paper.height);

    // الدقة المطلوبة مع سقف حجم اللوحة في المتصفح (16000 بكسل للضلع الأطول)
    const maxSide = 16000;
    const effDpi = Math.min(dpi, (maxSide / (Math.max(pdfW, pdfH) / 25.4)));
    const canvas = await this.renderSheetToCanvas(engine, model, options, pdfW, pdfH, effDpi / 96);
    const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const dataUrl = canvas.toDataURL(mime, 0.95);

    const cleanProjectName = (options.titleBlock.projectName || 'Drawing').replace(/[/\\?%*:|"<>]/g, '_');
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `${cleanProjectName}_${options.titleBlock.sheetNumber || '01'}.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return Math.round(effDpi);
  }

  /** تصدير المخطط (اللوحة الحالية) كملف SVG متجه بمقاسه الحقيقي حسب مقياس الطباعة */
  public static exportSVG(engine: CadEngine, model: ProjectModel, options: ExportPDFOptions): void {
    const ppm = model.getMeta().scale || 50;
    const { prims } = engine.exportVectorPrims({ visibleLayerIds: options.visibleLayerIds, includeDimensions: options.includeDimensions, theme: 'light' });
    // الرموز مصممة لخلفية داكنة (تعبئة داكنة وخطوط بلون الطبقة الفاتح): نقلبها لتظهر على الورق الأبيض
    const symbolIds = new Set(model.getObjects().filter((o) => o.type === 'symbol').map((o) => o.id));
    // العناصر التي تُعكس ألوانها الفاتحة جداً على الورق الأبيض (لا الجدران والفتحات: الأبيض فيها لإخفاء الجدار)
    const recolorIds = new Set(model.getObjects().filter((o) => !['wall', 'door', 'window', 'room'].includes(o.type)).map((o) => o.id));
    const lum = (c?: string) => {
      const m = c && /^#([0-9a-f]{6})$/i.exec(c);
      if (!m) return 0;
      const v = parseInt(m[1], 16);
      return (0.299 * ((v >> 16) & 255) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) / 255;
    };
    for (const pr of prims) {
      if (!pr.oid || !recolorIds.has(pr.oid)) continue;
      if (pr.kind !== 'text' && pr.stroke && lum(pr.stroke) > 0.88) pr.stroke = '#0f172a';
      if (pr.kind === 'text' && lum(pr.fill) > 0.88) pr.fill = '#0f172a';
      if (symbolIds.has(pr.oid) && pr.kind !== 'text' && pr.fill && lum(pr.fill) < 0.2) pr.fill = '#ffffff';
    }
    // حدود الرسم من العناصر نفسها (تشمل أقواس الأبواب الخارجة عن الجدران)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const inc = (x: number, y: number) => {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    };
    for (const pr of prims) {
      if (pr.kind === 'poly') pr.pts.forEach((q) => inc(q.x, q.y));
      else if (pr.kind === 'circle') {
        inc(pr.c.x - pr.r, pr.c.y - pr.r);
        inc(pr.c.x + pr.r, pr.c.y + pr.r);
      } else inc(pr.p.x, pr.p.y);
    }
    if (!isFinite(minX)) throw new Error('لا توجد عناصر لتصديرها');
    const bounds = { minX, minY, width: maxX - minX, height: maxY - minY };
    const scale = typeof options.printScale === 'number' && options.printScale > 0 ? options.printScale : 100;
    const svg = buildSvg(prims, bounds, { scale, pixelsPerMeter: ppm, title: options.titleBlock.projectName, padding: 20 });
    const clean = (options.titleBlock.projectName || 'Drawing').replace(/[/\\?%*:|"<>]/g, '_');
    downloadText(svg, `${clean}_${options.titleBlock.sheetNumber || '01'}.svg`, 'image/svg+xml;charset=utf-8');
  }

  /**
   * تصدير جدول الكميات بصيغة CSV متوافقة مع Excel مع دعم UTF-8 الكامل للغة العربية
   */
  public static exportBOQCSV(model: ProjectModel): void {
    // نفس بنود نافذة الكميات (model/quantities.ts) لضمان تطابق كل المخرجات
    const meta = model.getMeta();
    const prices = model.getQuantitySettings().prices;
    const report = computeQuantities(model.getObjects(), {
      pixelsPerMeter: meta.scale || 50,
      settings: model.getQuantitySettings(),
      symbolName: (k) => getSymbolById(k)?.name || k,
      routeMeta: (k) => ROUTE_KINDS_META[k],
    });
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    let csv = `\uFEFFجدول الكميات - مشروع ${meta.name}\nالتاريخ,${new Date().toLocaleDateString('ar-EG')}\n\n`;
    csv += 'الرقم,البند,الوحدة,الكمية,سعر الوحدة,الإجمالي,ملاحظة\n';
    let n = 0;
    for (const sec of Object.keys(BOQ_SECTION_TITLES) as BoqSection[]) {
      const ls = report.lines.filter((l) => l.section === sec);
      if (!ls.length) continue;
      csv += `${esc(BOQ_SECTION_TITLES[sec])}\n`;
      for (const l of ls) {
        const t = lineTotal(l, prices);
        csv += [++n, esc(l.name), esc(l.unit), l.qty, prices[l.key] ?? '', t ?? '', esc(l.note || '')].join(',') + '\n';
      }
    }
    const blob = new Blob([localizeCsv(csv)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `BOQ_${meta.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * رسم اللوحة الهندسية الكاملة (إطار + مخطط + خرطوشة + سهم شمال + مقياس رسم + مفتاح رموز)
   * على عنصر Canvas عالي الدقة.
   */
  public static async renderSheetToCanvas(
    engine: CadEngine,
    model: ProjectModel,
    options: ExportPDFOptions,
    widthMm: number,
    heightMm: number,
    scaleDpi: number = 2.5
  ): Promise<HTMLCanvasElement> {
    // نسبة الدقة (DPI Factor): مثلاً 1مم = ~3.78 بكسل على 96DPI، مضروبة في معامل الدقة
    const pxPerMm = 3.7795 * scaleDpi;
    const canvasW = Math.round(widthMm * pxPerMm);
    const canvasH = Math.round(heightMm * pxPerMm);

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create canvas 2d context');
    let logoImg: HTMLImageElement | null = null;
    if (options.logoDataUrl) {
      try {
        logoImg = await this.loadImage(options.logoDataUrl);
      } catch {
        logoImg = null;
      }
    }

    // 1. تحديد ألوان السمة (Theme)
    let bgColor = '#ffffff';
    let borderColor = '#0f172a';
    let borderInnerColor = '#475569';
    let textColor = '#0f172a';
    let textMutedColor = '#475569';
    let titleBlockBg = '#f8fafc';
    let titleBlockBorder = '#0f172a';

    if (options.theme === 'dark') {
      bgColor = '#0f172a';
      borderColor = '#38bdf8';
      borderInnerColor = '#1e293b';
      textColor = '#f8fafc';
      textMutedColor = '#94a3b8';
      titleBlockBg = '#1e293b';
      titleBlockBorder = '#38bdf8';
    } else if (options.theme === 'blueprint') {
      bgColor = '#0b2545';
      borderColor = '#60a5fa';
      borderInnerColor = '#1e3a8a';
      textColor = '#ffffff';
      textMutedColor = '#93c5fd';
      titleBlockBg = '#133e68';
      titleBlockBorder = '#60a5fa';
    }

    // تعبئة خلفية الصفحة
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvasW, canvasH);

    // 2. رسم الإطار الهندسي الخارجي والداخلي (Engineering Borders)
    const marginMm = 10; // هامش 10مم من حواف الورقة
    const marginPx = marginMm * pxPerMm;

    // الإطار الخارجي السميك
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = Math.max(2, 0.7 * scaleDpi);
    ctx.strokeRect(marginPx, marginPx, canvasW - marginPx * 2, canvasH - marginPx * 2);

    // الإطار الداخلي الرفيع (على بعد 5مم)
    const innerMarginPx = marginPx + 4 * pxPerMm;
    ctx.strokeStyle = borderInnerColor;
    ctx.lineWidth = Math.max(1, 0.35 * scaleDpi);
    ctx.strokeRect(innerMarginPx, innerMarginPx, canvasW - innerMarginPx * 2, canvasH - innerMarginPx * 2);

    // رسم علامات المحاور المرجعية (Grid reference ticks e.g. A, B, C / 1, 2, 3)
    this.drawBorderGridTicks(ctx, innerMarginPx, canvasW, canvasH, textMutedColor, scaleDpi);

    // 3. حساب أبعاد منطقة رسم المخطط الفعلية وموقع الخرطوشة
    // أبعاد الخرطوشة الهندسية المعمارية القياسية:
    // في الوضع الأفقي: شريط أفقي سفلي بارتفاع 48مم يوفر مساحة فسيحة ومريحة للنصوص
    const titleBlockHeightMm = options.includeTitleBlock ? 48 : 0;
    const titleBlockHeightPx = titleBlockHeightMm * pxPerMm;

    const drawingAreaX = innerMarginPx + 2 * pxPerMm;
    const drawingAreaY = innerMarginPx + 2 * pxPerMm;
    const drawingAreaW = canvasW - innerMarginPx * 2 - 4 * pxPerMm;
    const drawingAreaH = canvasH - innerMarginPx * 2 - 4 * pxPerMm - titleBlockHeightPx;

    // 4. المناظير بمقياس حقيقي: 1 م في الواقع = 1000/S مم على الورق.
    // كل منظور يُرسم من لوحته (تبديل مؤقت لا يمس سجل التراجع) في خانته من مساحة الرسم.
    const views: PrintView[] =
      options.views && options.views.length > 0
        ? options.views
        : [{ id: 'main', title: '', scale: typeof options.printScale === 'number' ? options.printScale : 0 }];
    const multi = views.length > 1;
    const gapPx = multi ? 6 * pxPerMm : 0;
    const captionPx = multi ? 9 * pxPerMm : 0;
    const slotW = (drawingAreaW - gapPx * (views.length - 1)) / views.length;
    const slotH = drawingAreaH - captionPx;
    // كثافة الصورة: نفس كثافة الصفحة مع سقف إجمالي لعدد البكسلات (ورق A1/A0)
    let renderPxPerMm = pxPerMm;
    const maxPixels = 36e6;
    if (drawingAreaW * drawingAreaH > maxPixels) renderPxPerMm *= Math.sqrt(maxPixels / (drawingAreaW * drawingAreaH));
    const lineWeightsPx: Record<string, number> = {};
    for (const [lid, mm] of Object.entries(options.lineWeights || {})) if (mm > 0) lineWeightsPx[lid] = mm * renderPxPerMm;

    const results: { scale: number; fits: boolean }[] = [];
    views.forEach((view, i) => {
      // ترتيب من اليمين لليسار
      const slotX = drawingAreaX + drawingAreaW - (i + 1) * slotW - i * gapPx;
      const areaWmm = slotW / pxPerMm;
      const areaHmm = slotH / pxPerMm;
      const sheetId = view.sheetId || model.getActiveSheetId();
      const r = model.withSheetTemporarily(sheetId, () => {
        const ppm = model.getMeta().scale || 50;
        const b = view.region
          ? { ...view.region, width: view.region.maxX - view.region.minX, height: view.region.maxY - view.region.minY }
          : engine.getDrawingBounds(options.includeBackground);
        const sc = view.scale > 0 ? view.scale : fitStandardScale(b.width, b.height, areaWmm * 0.94, areaHmm * 0.94, ppm);
        const imgW = Math.max(1, Math.round(areaWmm * renderPxPerMm));
        const imgH = Math.max(1, Math.round(areaHmm * renderPxPerMm));
        const img = engine.exportDrawingCanvas({
          pixelRatio: 1,
          includeGrid: options.includeGrid,
          includeBackground: options.includeBackground,
          includeDimensions: options.includeDimensions,
          visibleLayerIds: options.visibleLayerIds,
          customWidth: imgW,
          customHeight: imgH,
          camera: { centerX: b.minX + b.width / 2, centerY: b.minY + b.height / 2, zoom: renderPxPerMm * mmPerWorldPx(sc, ppm) },
          lineWeightsPx,
          theme: options.theme === 'white' ? 'light' : 'dark',
        });
        return { img, scale: sc, fits: fitsAtScale(b.width, b.height, areaWmm, areaHmm, sc, ppm) };
      });
      ctx.drawImage(r.img, slotX, drawingAreaY, slotW, slotH);
      results.push({ scale: r.scale, fits: r.fits });
      if (multi) {
        ctx.strokeStyle = borderInnerColor;
        ctx.lineWidth = 0.25 * pxPerMm;
        ctx.strokeRect(slotX, drawingAreaY, slotW, slotH);
        const cap = `${view.title || `منظور ${i + 1}`} — 1:${r.scale}`;
        ctx.fillStyle = textColor;
        ctx.font = `bold ${Math.round(3.2 * pxPerMm)}px 'Cairo', sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const cy = drawingAreaY + slotH + captionPx / 2;
        ctx.fillText(cap, slotX + slotW / 2, cy, slotW - 4 * pxPerMm);
        const tw = Math.min(ctx.measureText(cap).width, slotW - 4 * pxPerMm);
        ctx.lineWidth = 0.3 * pxPerMm;
        ctx.beginPath();
        ctx.moveTo(slotX + slotW / 2 - tw / 2, cy + 2.2 * pxPerMm);
        ctx.lineTo(slotX + slotW / 2 + tw / 2, cy + 2.2 * pxPerMm);
        ctx.stroke();
        ctx.textBaseline = 'alphabetic';
      }
    });
    // الشاشة: إعادة رسم اللوحة الحالية بعد أي تبديل مؤقت
    engine.render();
    const printScale = results[0].scale;
    const info: SheetRenderInfo = { scale: printScale, fits: results.every((r) => r.fits) };
    (canvas as HTMLCanvasElement & { printInfo?: SheetRenderInfo }).printInfo = info;
    options = { ...options, titleBlock: { ...options.titleBlock, scaleText: multi ? 'كما هو مبين' : String(printScale) } };

    // 5. رسم سهم الشمال المعماري (North Arrow) — يدور حسب الزاوية المختارة
    if (options.includeNorthArrow) {
      const naX = drawingAreaX + 25 * pxPerMm;
      const naY = drawingAreaY + 25 * pxPerMm;
      // إصلاح وحدات: كانت الأبعاد بمعامل scaleDpi (بكسل) فيخرج السهم ونصوصه أصغر بنحو 3.8 مرات من المقصود
      this.drawNorthArrow(ctx, naX, naY, pxPerMm * 0.7, borderColor, textColor, options.northAngle || 0);
    }

    // 6. مسطرة المقياس الحقيقية (أطوال بالمتر مطابقة للمقياس المطبوع)
    if (options.includeScaleBar && !multi) {
      const sbX = drawingAreaX + 12 * pxPerMm;
      const sbY = drawingAreaY + drawingAreaH - 12 * pxPerMm;
      this.drawScaleBar(ctx, sbX, sbY, pxPerMm * 0.85, textColor, borderColor, printScale, pxPerMm, bgColor);
    }

    // 7. رسم مفتاح الرموز الهندسية المصغر (Mini Legend)
    if (options.includeLegend) {
      const legendSheet = views[0].sheetId || model.getActiveSheetId();
      model.withSheetTemporarily(legendSheet, () => this.drawMiniLegend(
        ctx,
        model,
        options,
        innerMarginPx + 4 * pxPerMm,
        drawingAreaY + 50 * pxPerMm,
        pxPerMm * 0.85, // نفس إصلاح الوحدات: مفتاح الرموز كان شبه غير مقروء
        titleBlockBg,
        titleBlockBorder,
        textColor,
        textMutedColor
      ));
    }

    // 7.5 جدول المراجعات (أعلى الخرطوشة من اليمين)
    if (options.revisions && options.revisions.length > 0) {
      this.drawRevisionsTable(ctx, options.revisions, drawingAreaX + drawingAreaW, drawingAreaY + slotH, pxPerMm, titleBlockBg, titleBlockBorder, textColor, textMutedColor);
    }

    // 8. رسم الخرطوشة الهندسية التنفيذية (Engineering Title Block)
    if (options.includeTitleBlock) {
      const tbX = innerMarginPx;
      const tbY = canvasH - innerMarginPx - titleBlockHeightPx;
      let tbW = canvasW - innerMarginPx * 2;
      const tbH = titleBlockHeightPx;

      // خانة الشركة/المكتب وشعارها في أقصى يمين الخرطوشة (إن وُجدت)
      if (options.companyName || logoImg) {
        const compW = Math.min(tbW * 0.16, 62 * pxPerMm);
        const cx = tbX + tbW - compW;
        ctx.fillStyle = titleBlockBg;
        ctx.fillRect(cx, tbY, compW, tbH);
        ctx.strokeStyle = titleBlockBorder;
        ctx.lineWidth = Math.max(1.5, 0.7 * scaleDpi);
        ctx.strokeRect(cx, tbY, compW, tbH);
        const pad = 3 * pxPerMm;
        const nameH = options.companyName ? 9 * pxPerMm : 0;
        if (logoImg) {
          const maxW = compW - pad * 2;
          const maxH = tbH - pad * 2 - nameH;
          const k = Math.min(maxW / logoImg.width, maxH / logoImg.height);
          const lw = logoImg.width * k;
          const lh = logoImg.height * k;
          ctx.drawImage(logoImg, cx + (compW - lw) / 2, tbY + pad + (maxH - lh) / 2, lw, lh);
        }
        if (options.companyName) {
          ctx.fillStyle = textColor;
          ctx.font = `bold ${Math.round(3.6 * pxPerMm)}px 'Cairo', sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(options.companyName, cx + compW / 2, logoImg ? tbY + tbH - pad - nameH / 2 : tbY + tbH / 2, compW - pad * 2);
          ctx.textBaseline = 'alphabetic';
        }
        tbW -= compW;
      }

      this.drawTitleBlock(
        ctx,
        options.titleBlock,
        options.includeStamp,
        tbX,
        tbY,
        tbW,
        tbH,
        scaleDpi,
        titleBlockBg,
        titleBlockBorder,
        textColor,
        textMutedColor
      );
    }

    return canvas;
  }

  /**
   * صفحة جدول الكميات (أول صفحة فقط — للمعاينة). للتصدير استخدم renderBOQPagesToCanvases.
   */
  public static renderBOQSheetToCanvas(
    model: ProjectModel,
    options: ExportPDFOptions,
    widthMm: number,
    heightMm: number,
    scaleDpi: number = 2.5
  ): HTMLCanvasElement {
    return this.renderBOQPagesToCanvases(model, options, widthMm, heightMm, scaleDpi)[0];
  }

  /**
   * صفحات جدول الكميات في PDF — نفس بنود نافذة الكميات (model/quantities.ts):
   * البند، الوحدة، الكمية، سعر الوحدة، الإجمالي (فارغان حتى يُدخل السعر)، مع مجموع لكل قسم والمجموع الكلي
   * وخانات التوقيع في الصفحة الأخيرة. تُقسَّم تلقائياً على أكثر من صفحة عند طول الجدول.
   */
  public static renderBOQPagesToCanvases(
    model: ProjectModel,
    options: ExportPDFOptions,
    widthMm: number,
    heightMm: number,
    scaleDpi: number = 2.5
  ): HTMLCanvasElement[] {
    const pxPerMm = 3.7795 * scaleDpi;
    const W = Math.round(widthMm * pxPerMm);
    const H = Math.round(heightMm * pxPerMm);
    const report = computeQuantities(model.getObjects(), {
      pixelsPerMeter: model.getMeta().scale || 50,
      settings: model.getQuantitySettings(),
      symbolName: (k) => getSymbolById(k)?.name || k,
      routeMeta: (k) => ROUTE_KINDS_META[k],
    });
    const prices = model.getQuantitySettings().prices;
    const fmt = (v: number, d = 2) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

    type Row = { kind: 'section'; title: string } | { kind: 'line'; n: number; line: BoqLine } | { kind: 'subtotal'; title: string; value: number | null };
    const rows: Row[] = [];
    let n = 0;
    const sections = (Object.keys(BOQ_SECTION_TITLES) as BoqSection[]).filter((sec) => report.lines.some((l) => l.section === sec));
    for (const sec of sections) {
      rows.push({ kind: 'section', title: BOQ_SECTION_TITLES[sec] });
      const ls = report.lines.filter((l) => l.section === sec);
      ls.forEach((line) => rows.push({ kind: 'line', n: ++n, line }));
      const t = ls.reduce<number | null>((a, l) => {
        const v = lineTotal(l, prices);
        return v === null ? a : (a ?? 0) + v;
      }, null);
      if (t !== null) rows.push({ kind: 'subtotal', title: `مجموع ${BOQ_SECTION_TITLES[sec]}`, value: t });
    }
    const grand = report.lines.reduce<number | null>((a, l) => {
      const v = lineTotal(l, prices);
      return v === null ? a : (a ?? 0) + v;
    }, null);

    const margin = 14 * pxPerMm;
    const contentX = margin + 6 * pxPerMm;
    const contentW = W - contentX * 2;
    const rowH = 6.2 * pxPerMm;
    const headerTop = margin + 6 * pxPerMm;
    const tableTop = headerTop + 18 * pxPerMm;
    const signH = 26 * pxPerMm;
    const footerY = H - margin - 4 * pxPerMm;
    // أعمدة من اليمين: #، البند، الوحدة، الكمية، سعر الوحدة، الإجمالي
    const fr = [0.06, 0.46, 0.09, 0.13, 0.13, 0.13];
    const cols = fr.map((f) => f * contentW);
    const heads = ['#', 'البند', 'الوحدة', 'الكمية', 'سعر الوحدة', 'الإجمالي'];

    const pages: HTMLCanvasElement[] = [];
    let idx = 0;
    const font = (size: number, bold = false) => `${bold ? 'bold ' : ''}${Math.round(size * pxPerMm)}px 'Cairo', sans-serif`;
    do {
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not create 2d context for BOQ');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 0.5 * pxPerMm;
      ctx.strokeRect(margin, margin, W - margin * 2, H - margin * 2);

      // الرأس
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'alphabetic';
      ctx.font = font(6, true);
      ctx.fillText('جدول الكميات', contentX + contentW, headerTop + 5 * pxPerMm);
      ctx.fillStyle = '#475569';
      ctx.font = font(3.2);
      const sub = [`المشروع: ${options.titleBlock.projectName}`, options.companyName ? `المكتب: ${options.companyName}` : '', `التاريخ: ${options.titleBlock.date}`, `رقم اللوحة: ${options.titleBlock.sheetNumber}`]
        .filter(Boolean)
        .join('   |   ');
      ctx.fillText(sub, contentX + contentW, headerTop + 11 * pxPerMm, contentW);

      // رأس الجدول
      let y = tableTop;
      ctx.fillStyle = '#1f2937';
      ctx.fillRect(contentX, y, contentW, rowH);
      let cx = contentX + contentW;
      ctx.fillStyle = '#ffffff';
      ctx.font = font(3, true);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      heads.forEach((h, i) => {
        ctx.fillText(h, cx - cols[i] / 2, y + rowH / 2);
        cx -= cols[i];
      });
      y += rowH;

      const bottomLimit = footerY - 8 * pxPerMm;
      while (idx < rows.length && y + rowH <= bottomLimit) {
        const r = rows[idx++];
        if (r.kind === 'section') {
          ctx.fillStyle = '#e6f4ea';
          ctx.fillRect(contentX, y, contentW, rowH);
          ctx.fillStyle = '#0f766e';
          ctx.font = font(3.1, true);
          ctx.textAlign = 'right';
          ctx.fillText(r.title, contentX + contentW - 2 * pxPerMm, y + rowH / 2);
        } else {
          const vals =
            r.kind === 'line'
              ? (() => {
                  const p = prices[r.line.key];
                  const t = lineTotal(r.line, prices);
                  const q = r.line.unit === 'عدد' ? String(r.line.qty) : fmt(r.line.qty, r.line.unit === 'م³' ? 3 : 2);
                  return [String(r.n), r.line.name, r.line.unit, q, typeof p === 'number' ? fmt(p) : '', t === null ? '' : fmt(t)];
                })()
              : ['', r.title, '', '', '', r.value === null ? '' : fmt(r.value)];
          if (r.kind === 'subtotal') {
            ctx.fillStyle = '#f3f4f6';
            ctx.fillRect(contentX, y, contentW, rowH);
          }
          let x = contentX + contentW;
          vals.forEach((v, i) => {
            ctx.fillStyle = '#0f172a';
            ctx.font = font(2.9, r.kind === 'subtotal' || i === 3);
            ctx.textAlign = i === 1 ? 'right' : 'center';
            ctx.fillText(v, i === 1 ? x - 2 * pxPerMm : x - cols[i] / 2, y + rowH / 2, cols[i] - 3 * pxPerMm);
            x -= cols[i];
          });
        }
        // حدود الصف والأعمدة
        ctx.strokeStyle = '#d1d5db';
        ctx.lineWidth = 0.15 * pxPerMm;
        ctx.strokeRect(contentX, y, contentW, rowH);
        if (r.kind !== 'section') {
          let x = contentX + contentW;
          for (let i = 0; i < cols.length - 1; i++) {
            x -= cols[i];
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + rowH);
            ctx.stroke();
          }
        }
        y += rowH;
      }

      const done = idx >= rows.length;
      if (done) {
        if (grand !== null && y + rowH * 1.3 <= bottomLimit) {
          ctx.fillStyle = '#d1fae5';
          ctx.fillRect(contentX, y, contentW, rowH * 1.3);
          ctx.strokeStyle = '#0f172a';
          ctx.strokeRect(contentX, y, contentW, rowH * 1.3);
          ctx.fillStyle = '#0f172a';
          ctx.font = font(3.4, true);
          ctx.textAlign = 'right';
          ctx.fillText('المجموع الكلي', contentX + contentW - 2 * pxPerMm, y + rowH * 0.65);
          ctx.textAlign = 'center';
          ctx.fillText(fmt(grand), contentX + cols[5] / 2, y + rowH * 0.65);
          y += rowH * 1.3;
        }
        if (report.lines.length === 0) {
          ctx.fillStyle = '#64748b';
          ctx.font = font(3.4);
          ctx.textAlign = 'center';
          ctx.fillText('لا توجد عناصر للحصر في هذه اللوحة.', contentX + contentW / 2, y + 10 * pxPerMm);
          y += 16 * pxPerMm;
        }
        // خانات التوقيع إن اتسعت الصفحة
        if (y + signH + 6 * pxPerMm <= bottomLimit) {
          const sy = y + 8 * pxPerMm;
          const sw = contentW / 3;
          const labels = [
            ['إعداد', options.titleBlock.engineer || ''],
            ['مراجعة', ''],
            ['اعتماد المالك / الاستشاري', options.titleBlock.client || ''],
          ];
          labels.forEach(([label, name], i) => {
            const x = contentX + contentW - (i + 1) * sw;
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 0.2 * pxPerMm;
            ctx.strokeRect(x + 2 * pxPerMm, sy, sw - 4 * pxPerMm, signH - 6 * pxPerMm);
            ctx.fillStyle = '#475569';
            ctx.font = font(2.8, true);
            ctx.textAlign = 'center';
            ctx.fillText(label, x + sw / 2, sy + 4 * pxPerMm);
            ctx.fillStyle = '#0f172a';
            ctx.font = font(2.8);
            if (name) ctx.fillText(name, x + sw / 2, sy + 10 * pxPerMm, sw - 8 * pxPerMm);
          });
        }
      }

      // التذييل: رقم الصفحة
      pages.push(canvas);
      ctx.fillStyle = '#64748b';
      ctx.font = font(2.6);
      ctx.textAlign = 'center';
      ctx.fillText(`صفحة ${pages.length}`, W / 2, footerY);
    } while (idx < rows.length);

    return pages;
  }

  /**
   * رسم صفحة مستقلة لجدول الرموز الهندسية المستخدمة (Symbols Legend Sheet - البند 9)
   */
  public static async renderSymbolsLegendSheetToCanvas(
    model: ProjectModel,
    options: ExportPDFOptions,
    pdfWidthMm: number,
    pdfHeightMm: number
  ): Promise<HTMLCanvasElement> {
    const scaleDpi = 2.0;
    const pxPerMm = 3.78 * scaleDpi;
    const canvasW = Math.round(pdfWidthMm * pxPerMm);
    const canvasH = Math.round(pdfHeightMm * pxPerMm);

    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    // خلفية الصفحة بيضاء نظيفة للطباعة الرسمية
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // إطار الصفحة الخارجي
    const marginMm = 8;
    const marginPx = marginMm * pxPerMm;
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 1.5 * scaleDpi;
    ctx.strokeRect(marginPx, marginPx, canvasW - marginPx * 2, canvasH - marginPx * 2);

    const innerMarginPx = marginPx + 4 * pxPerMm;

    // ترويسة الصفحة
    const headerH = 22 * pxPerMm;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(innerMarginPx, innerMarginPx, canvasW - innerMarginPx * 2, headerH);

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(7 * scaleDpi)}px 'Cairo', sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText('دليل ومفتاح الرموز الهندسية المستخدمة (SYMBOLS SCHEDULE & LEGEND)', canvasW - innerMarginPx - 8 * pxPerMm, innerMarginPx + 10 * pxPerMm);

    ctx.font = `${Math.round(4 * scaleDpi)}px 'Cairo', sans-serif`;
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(
      `المشروع: ${options.titleBlock.projectName || 'مشروع هندسي'} | اللوحة: ${options.titleBlock.drawingTitle || 'دليل الرموز'} | التاريخ: ${options.titleBlock.date || ''}`,
      canvasW - innerMarginPx - 8 * pxPerMm,
      innerMarginPx + 17 * pxPerMm
    );

    // حصر وتجميع الرموز المستخدمة في المشروع
    const allObjects = model.getObjects();
    const symbols = allObjects.filter((o) => o.type === 'symbol') as SymbolObject[];
    const symbolCounts: Record<string, { count: number; colors: Set<string> }> = {};
    symbols.forEach((s) => {
      if (!symbolCounts[s.symbolKind]) {
        symbolCounts[s.symbolKind] = { count: 0, colors: new Set() };
      }
      symbolCounts[s.symbolKind].count++;
      if (s.color) symbolCounts[s.symbolKind].colors.add(s.color);
    });

    const symbolKinds = Object.keys(symbolCounts);
    const contentX = innerMarginPx;
    let curY = innerMarginPx + headerH + 6 * pxPerMm;
    const contentW = canvasW - innerMarginPx * 2;

    ctx.fillStyle = '#0f172a';
    ctx.font = `bold ${Math.round(5.5 * scaleDpi)}px 'Cairo', sans-serif`;
    ctx.textAlign = 'right';
    const totalSymbolsCount = symbols.length;
    ctx.fillText(
      `جدول الرموز الكهربائية والميكانيكية والمعمارية (إجمالي: ${totalSymbolsCount} رمز)`,
      contentX + contentW,
      curY
    );
    curY += 5 * pxPerMm;

    // أعمدة جدول الرموز
    // 1. م (7%)
    // 2. المعاينة البصرية (12%)
    // 3. اسم الرمز بالعربية (28%)
    // 4. الاسم بالإنجليزية والكود (25%)
    // 5. التصنيف الهندسي (16%)
    // 6. العدد (12%)
    const colWidths = [
      contentW * 0.07,
      contentW * 0.12,
      contentW * 0.28,
      contentW * 0.25,
      contentW * 0.16,
      contentW * 0.12,
    ];
    const colHeaders = ['م', 'الرمز', 'الوصف والاسم العربي', 'English Name & Code', 'التصنيف', 'العدد الإجمالي'];

    const headerRowH = 8 * pxPerMm;
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(contentX, curY, contentW, headerRowH);

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(3.8 * scaleDpi)}px 'Cairo', sans-serif`;
    ctx.textAlign = 'center';

    let hX = contentX + contentW;
    colHeaders.forEach((h, idx) => {
      ctx.fillText(h, hX - colWidths[idx] / 2, curY + headerRowH * 0.65);
      hX -= colWidths[idx];
    });

    curY += headerRowH;

    if (symbolKinds.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = `${Math.round(4 * scaleDpi)}px 'Cairo', sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('لا توجد رموز مستخدمة حالياً في هذا المخطط.', contentX + contentW / 2, curY + 15 * pxPerMm);
      curY += 25 * pxPerMm;
    } else {
      const rowH = 9.5 * pxPerMm;
      for (let index = 0; index < symbolKinds.length; index++) {
        const kind = symbolKinds[index];
        const data = symbolCounts[kind];
        const symDef = getSymbolById(kind);
        const catMeta = symDef?.category ? CATEGORIES_META[symDef.category] : null;

        // تلوين الصفوف بالتناوب
        ctx.fillStyle = index % 2 === 0 ? '#f8fafc' : '#ffffff';
        ctx.fillRect(contentX, curY, contentW, rowH);

        // خط أفقي فاصل
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 0.5 * scaleDpi;
        ctx.beginPath();
        ctx.moveTo(contentX, curY + rowH);
        ctx.lineTo(contentX + contentW, curY + rowH);
        ctx.stroke();

        let rX = contentX + contentW;

        // 1. الرقم
        ctx.fillStyle = '#334155';
        ctx.font = `${Math.round(3.4 * scaleDpi)}px 'Cairo', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`${index + 1}`, rX - colWidths[0] / 2, curY + rowH * 0.62);
        rX -= colWidths[0];

        // 2. معاينة الرمز (SVG preview / رسم دائري مصغر)
        const previewCellW = colWidths[1];
        const previewCellCenterX = rX - previewCellW / 2;
        const previewCellCenterY = curY + rowH / 2;
        if (symDef) {
          try {
            // الرمز بشكله الحقيقي كما على لوحة الرسم (كانت معاينة SVG مبسطة لا تطابقه)
            const iconSize = Math.min(rowH * 0.8, previewCellW * 0.8);
            const icon = renderSymbolIcon(kind, iconSize * 2, catMeta?.color);
            ctx.drawImage(icon, previewCellCenterX - iconSize / 2, previewCellCenterY - iconSize / 2, iconSize, iconSize);
          } catch {
            ctx.fillStyle = catMeta?.color || '#0284c7';
            ctx.beginPath();
            ctx.arc(previewCellCenterX, previewCellCenterY, rowH * 0.25, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          ctx.fillStyle = catMeta?.color || '#0284c7';
          ctx.beginPath();
          ctx.arc(previewCellCenterX, previewCellCenterY, rowH * 0.25, 0, Math.PI * 2);
          ctx.fill();
        }
        rX -= previewCellW;

        // 3. الوصف والاسم العربي
        ctx.textAlign = 'right';
        ctx.fillStyle = '#0f172a';
        ctx.font = `bold ${Math.round(3.5 * scaleDpi)}px 'Cairo', sans-serif`;
        const arName = symDef?.name || kind;
        ctx.fillText(arName, rX - 3 * pxPerMm, curY + rowH * 0.62);
        rX -= colWidths[2];

        // 4. الاسم بالإنجليزية والكود
        ctx.textAlign = 'left';
        ctx.fillStyle = '#475569';
        ctx.font = `${Math.round(3.2 * scaleDpi)}px 'Cairo', monospace`;
        const enName = symDef?.nameEn ? `${symDef.nameEn} (${kind})` : kind;
        ctx.fillText(enName, rX - colWidths[3] + 3 * pxPerMm, curY + rowH * 0.62);
        rX -= colWidths[3];

        // 5. التصنيف الهندسي
        ctx.textAlign = 'center';
        ctx.font = `${Math.round(3.2 * scaleDpi)}px 'Cairo', sans-serif`;
        ctx.fillStyle = catMeta?.color || '#334155';
        ctx.fillText(catMeta?.name || 'عام', rX - colWidths[4] / 2, curY + rowH * 0.62);
        rX -= colWidths[4];

        // 6. العدد الإجمالي
        ctx.textAlign = 'center';
        ctx.font = `bold ${Math.round(3.8 * scaleDpi)}px 'Cairo', monospace`;
        ctx.fillStyle = '#0284c7';
        ctx.fillText(`${data.count}`, rX - colWidths[5] / 2, curY + rowH * 0.62);

        curY += rowH;

        // منع خروج الجدول خارج حدود الصفحة
        if (curY > canvasH - innerMarginPx - 30 * pxPerMm) {
          break;
        }
      }
    }

    // صندوق التوقيع والاعتماد أسفل صفحة الرموز
    const signBoxY = canvasH - innerMarginPx - 22 * pxPerMm;
    const signBoxW = contentW;
    const signBoxH = 18 * pxPerMm;

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1 * scaleDpi;
    ctx.strokeRect(contentX, signBoxY, signBoxW, signBoxH);

    const signCols = [signBoxW * 0.33, signBoxW * 0.33, signBoxW * 0.34];
    ctx.beginPath();
    ctx.moveTo(contentX + signCols[0], signBoxY);
    ctx.lineTo(contentX + signCols[0], signBoxY + signBoxH);
    ctx.moveTo(contentX + signCols[0] + signCols[1], signBoxY);
    ctx.lineTo(contentX + signCols[0] + signCols[1], signBoxY + signBoxH);
    ctx.stroke();

    ctx.fillStyle = '#475569';
    ctx.font = `${Math.round(3 * scaleDpi)}px 'Cairo', sans-serif`;
    ctx.textAlign = 'center';

    ctx.fillText('إعداد مهندس التصميم:', contentX + signCols[0] / 2, signBoxY + 5 * pxPerMm);
    ctx.fillText(options.titleBlock.engineer || 'مهندس المشروع', contentX + signCols[0] / 2, signBoxY + 11 * pxPerMm);

    ctx.fillText('مراجعة وتدقيق المخطط:', contentX + signCols[0] + signCols[1] / 2, signBoxY + 5 * pxPerMm);
    ctx.fillText('مطابق للمواصفات والكود', contentX + signCols[0] + signCols[1] / 2, signBoxY + 11 * pxPerMm);

    ctx.fillText('اعتماد المالك / الاستشاري:', contentX + signCols[0] + signCols[1] + signCols[2] / 2, signBoxY + 5 * pxPerMm);
    ctx.fillText(options.titleBlock.client || 'المالك الموقر', contentX + signCols[0] + signCols[1] + signCols[2] / 2, signBoxY + 11 * pxPerMm);

    return canvas;
  }

  /**
   * رسم الخرطوشة الهندسية المعمارية التنفيذية (Engineering Title Block)
   */
  private static drawTitleBlock(
    ctx: CanvasRenderingContext2D,
    data: TitleBlockData,
    includeStamp: boolean,
    x: number,
    y: number,
    w: number,
    h: number,
    scaleDpi: number,
    bgColor: string,
    borderColor: string,
    textColor: string,
    mutedColor: string
  ): void {
    // خلفية وإطار الخرطوشة
    ctx.fillStyle = bgColor;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = Math.max(1.5, 0.7 * scaleDpi);
    ctx.strokeRect(x, y, w, h);

    // تقسيم الخرطوشة الهندسية إلى خلايا وأعمدة احترافية واسعة
    // عمود 1 (اليمين): اسم المشروع والمالك (28%)
    // عمود 2 (الوسط): عنوان اللوحة والتخصص (28%)
    // عمود 3 (اليسار الأوسط): مقياس الرسم، التاريخ، التعديل، والمهندس في شبكة 2×2 (26%)
    // عمود 4 (أقصى اليسار): ختم الاعتماد ورقم اللوحة (18%)
    const col1W = w * 0.28;
    const col2W = w * 0.28;
    const col3W = w * 0.26;
    const col4W = w * 0.18;

    const xCol4 = x;
    const xCol3 = x + col4W;
    const xCol2 = x + col4W + col3W;
    const xCol1 = x + w - col1W;

    // حساب أحجام خطوط متناسقة وكبيرة ومريحة للقراءة تتناسب طردياً مع ارتفاع الخرطوشة
    const labelFontSize = Math.max(12, Math.min(16, Math.round(h * 0.085)));
    const valueFontSize = Math.max(14, Math.min(22, Math.round(h * 0.115)));
    const titleFontSize = Math.max(15, Math.min(25, Math.round(h * 0.135)));
    const sheetNoFontSize = Math.max(18, Math.min(30, Math.round(h * 0.17)));

    // خطوط التقسيم الرأسية الرئيسية بين الأعمدة
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = Math.max(1.2, 0.45 * scaleDpi);
    ctx.beginPath();
    ctx.moveTo(xCol1, y);
    ctx.lineTo(xCol1, y + h);

    ctx.moveTo(xCol2, y);
    ctx.lineTo(xCol2, y + h);

    ctx.moveTo(xCol3, y);
    ctx.lineTo(xCol3, y + h);
    ctx.stroke();

    // خطوط التقسيم الأفقية داخل الأعمدة لمنع أي تداخل
    ctx.beginPath();
    // فاصل أفقي في العمود 1 (المشروع / المالك)
    ctx.moveTo(xCol1, y + h * 0.5);
    ctx.lineTo(x + w, y + h * 0.5);

    // فاصل أفقي في العمود 2 (عنوان اللوحة / التخصص)
    ctx.moveTo(xCol2, y + h * 0.5);
    ctx.lineTo(xCol1, y + h * 0.5);

    // فاصل أفقي في العمود 3 (المقياس والتاريخ / المهندس والمراجعة)
    ctx.moveTo(xCol3, y + h * 0.5);
    ctx.lineTo(xCol2, y + h * 0.5);

    // فاصل رأسي فرعي داخل العمود 3 لإنشاء 4 خلايا مستقلة تماماً
    ctx.moveTo(xCol3 + col3W * 0.5, y);
    ctx.lineTo(xCol3 + col3W * 0.5, y + h);

    // فاصل أفقي في العمود 4 (الختم / رقم اللوحة)
    ctx.moveTo(xCol4, y + h * 0.46);
    ctx.lineTo(xCol3, y + h * 0.46);
    ctx.stroke();

    // ==========================================
    // 1. العمود الأول (اليمين - اسم المشروع والمالك)
    // ==========================================
    const padRight1 = x + w - 12;
    const maxTextW1 = col1W - 24;
    ctx.textAlign = 'right';

    // خلية المشروع (أعلى)
    ctx.fillStyle = mutedColor;
    ctx.font = `600 ${labelFontSize}px 'Cairo', sans-serif`;
    ctx.fillText('مشروع / PROJECT:', padRight1, y + h * 0.18, maxTextW1);

    ctx.fillStyle = textColor;
    ctx.font = `bold ${titleFontSize}px 'Cairo', sans-serif`;
    ctx.fillText(data.projectName || 'مخطط فيلا سكنية معتمدة', padRight1, y + h * 0.39, maxTextW1);

    // خلية المالك (أسفل)
    ctx.fillStyle = mutedColor;
    ctx.font = `600 ${labelFontSize}px 'Cairo', sans-serif`;
    ctx.fillText('المالك / CLIENT:', padRight1, y + h * 0.68, maxTextW1);

    ctx.fillStyle = textColor;
    ctx.font = `bold ${valueFontSize}px 'Cairo', sans-serif`;
    ctx.fillText(data.client || 'المالك الموقر', padRight1, y + h * 0.89, maxTextW1);

    // ==========================================
    // 2. العمود الثاني (الوسط - عنوان المخطط والتخصص)
    // ==========================================
    const padRight2 = xCol1 - 12;
    const maxTextW2 = col2W - 24;

    // خلية عنوان المخطط (أعلى)
    ctx.fillStyle = mutedColor;
    ctx.font = `600 ${labelFontSize}px 'Cairo', sans-serif`;
    ctx.fillText('عنوان اللوحة / DRAWING TITLE:', padRight2, y + h * 0.18, maxTextW2);

    ctx.fillStyle = textColor;
    ctx.font = `bold ${titleFontSize}px 'Cairo', sans-serif`;
    ctx.fillText(data.drawingTitle || 'المخطط التنفيذي الكهروميكانيكي', padRight2, y + h * 0.39, maxTextW2);

    // خلية التخصص (أسفل)
    ctx.fillStyle = mutedColor;
    ctx.font = `600 ${labelFontSize}px 'Cairo', sans-serif`;
    ctx.fillText('التخصص / DISCIPLINE:', padRight2, y + h * 0.68, maxTextW2);

    ctx.fillStyle = '#0284c7';
    ctx.font = `bold ${valueFontSize}px 'Cairo', sans-serif`;
    ctx.fillText(data.discipline || 'المعماري والكهروميكانيكي (MEP)', padRight2, y + h * 0.89, maxTextW2);

    // ==========================================
    // 3. العمود الثالث (اليسار الأوسط - شبكة خلايا البيانات الفنية 2×2)
    // ==========================================
    const subColW = col3W * 0.5;
    const rightSubcellEdge = xCol2 - 10;
    const leftSubcellEdge = xCol3 + subColW - 10;
    const maxSubW = subColW - 20;

    // 3.1 الخلية العلوية اليمنى: مقياس الرسم
    ctx.fillStyle = mutedColor;
    ctx.font = `600 ${labelFontSize}px 'Cairo', sans-serif`;
    ctx.fillText('المقياس / SCALE:', rightSubcellEdge, y + h * 0.18, maxSubW);

    ctx.fillStyle = textColor;
    ctx.font = `bold ${valueFontSize}px 'Cairo', monospace`;
    ctx.fillText(/^\d+(\.\d+)?$/.test(data.scaleText || '50') ? `1:${data.scaleText || '50'}` : data.scaleText, rightSubcellEdge, y + h * 0.39, maxSubW);

    // 3.2 الخلية العلوية اليسرى: التاريخ
    ctx.fillStyle = mutedColor;
    ctx.font = `600 ${labelFontSize}px 'Cairo', sans-serif`;
    ctx.fillText('التاريخ / DATE:', leftSubcellEdge, y + h * 0.18, maxSubW);

    ctx.fillStyle = textColor;
    ctx.font = `bold ${valueFontSize}px 'Cairo', monospace`;
    ctx.fillText(data.date || new Date().toLocaleDateString('ar-EG'), leftSubcellEdge, y + h * 0.39, maxSubW);

    // 3.3 الخلية السفلية اليمنى: المهندس المصمم
    ctx.fillStyle = mutedColor;
    ctx.font = `600 ${labelFontSize}px 'Cairo', sans-serif`;
    ctx.fillText('المهندس / ENG:', rightSubcellEdge, y + h * 0.68, maxSubW);

    ctx.fillStyle = textColor;
    ctx.font = `bold ${valueFontSize}px 'Cairo', sans-serif`;
    ctx.fillText(data.engineer || 'مهندس التصميم', rightSubcellEdge, y + h * 0.89, maxSubW);

    // 3.4 الخلية السفلية اليسرى: المراجعة
    ctx.fillStyle = mutedColor;
    ctx.font = `600 ${labelFontSize}px 'Cairo', sans-serif`;
    ctx.fillText('المراجعة / REV:', leftSubcellEdge, y + h * 0.68, maxSubW);

    ctx.fillStyle = textColor;
    ctx.font = `bold ${valueFontSize}px 'Cairo', monospace`;
    ctx.fillText(data.revision || 'Rev 01', leftSubcellEdge, y + h * 0.89, maxSubW);

    // ==========================================
    // 4. العمود الرابع (أقصى اليسار - ختم الاعتماد ورقم اللوحة)
    // ==========================================
    const c4Center = xCol4 + col4W / 2;

    // ختم الاعتماد (Stamp) في النصف العلوي
    if (includeStamp) {
      let stampColor = '#16a34a';
      let stampText = 'معتمد للتنفيذ';
      let stampSub = 'APPROVED';

      if (data.stampStatus === 'draft') {
        stampColor = '#d97706';
        stampText = 'مسودة للدراسة';
        stampSub = 'PRELIMINARY DRAFT';
      } else if (data.stampStatus === 'as_built') {
        stampColor = '#2563eb';
        stampText = 'كما نُفّذ بالموقع';
        stampSub = 'AS-BUILT';
      } else if (data.stampStatus === 'for_review') {
        stampColor = '#9333ea';
        stampText = 'للمراجعة والتدقيق';
        stampSub = 'FOR REVIEW';
      }

      ctx.save();
      ctx.strokeStyle = stampColor;
      ctx.lineWidth = Math.max(1.2, 0.8 * scaleDpi);
      ctx.fillStyle = `${stampColor}14`;
      const stampBoxW = col4W - 16;
      const stampBoxH = h * 0.36;
      const stampBoxX = xCol4 + 8;
      const stampBoxY = y + h * 0.05;

      ctx.fillRect(stampBoxX, stampBoxY, stampBoxW, stampBoxH);
      ctx.strokeRect(stampBoxX, stampBoxY, stampBoxW, stampBoxH);

      ctx.fillStyle = stampColor;
      ctx.font = `bold ${Math.max(12, Math.round(labelFontSize * 1.05))}px 'Cairo', sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(stampText, c4Center, stampBoxY + stampBoxH * 0.52);
      ctx.font = `bold ${Math.max(10, Math.round(labelFontSize * 0.8))}px 'Cairo', monospace`;
      ctx.fillText(stampSub, c4Center, stampBoxY + stampBoxH * 0.86);
      ctx.restore();
    }

    // رقم اللوحة (Sheet Number) في النصف السفلي
    ctx.textAlign = 'center';
    ctx.fillStyle = mutedColor;
    ctx.font = `600 ${labelFontSize}px 'Cairo', sans-serif`;
    ctx.fillText('رقم اللوحة / SHEET NO.', c4Center, y + h * 0.65);

    ctx.fillStyle = textColor;
    ctx.font = `bold ${sheetNoFontSize}px 'Cairo', monospace`;
    ctx.fillText(data.sheetNumber || 'MEP-01', c4Center, y + h * 0.89);
  }

  /**
   * جدول المراجعات: يُرسم أعلى الخرطوشة ملاصقاً لزاوية مساحة الرسم اليمنى السفلى
   */
  private static drawRevisionsTable(
    ctx: CanvasRenderingContext2D,
    revisions: { rev: string; date: string; description: string }[],
    rightX: number,
    bottomY: number,
    pxPerMm: number,
    bg: string,
    border: string,
    text: string,
    muted: string
  ): void {
    const rows = revisions.slice(-6);
    const colW = [14, 24, 62].map((w) => w * pxPerMm); // رقم، تاريخ، وصف (من اليمين)
    const W = colW.reduce((a, b) => a + b, 0);
    const rowH = 5.2 * pxPerMm;
    const H = rowH * (rows.length + 2);
    const x = rightX - W;
    const y = bottomY - H;
    ctx.save();
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, W, H);
    ctx.strokeStyle = border;
    ctx.lineWidth = 0.3 * pxPerMm;
    ctx.strokeRect(x, y, W, H);
    ctx.fillStyle = text;
    ctx.font = `bold ${Math.round(2.8 * pxPerMm)}px 'Cairo', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('جدول المراجعات', x + W / 2, y + rowH / 2);
    const heads = ['المراجعة', 'التاريخ', 'الوصف'];
    const cells = (r: number, vals: string[], bold: boolean, color: string) => {
      let cx = x + W;
      vals.forEach((v, i) => {
        ctx.strokeRect(cx - colW[i], y + rowH * r, colW[i], rowH);
        ctx.fillStyle = color;
        ctx.font = `${bold ? 'bold ' : ''}${Math.round(2.4 * pxPerMm)}px 'Cairo', sans-serif`;
        ctx.textAlign = i === 2 ? 'right' : 'center';
        ctx.fillText(v, i === 2 ? cx - 1.5 * pxPerMm : cx - colW[i] / 2, y + rowH * r + rowH / 2, colW[i] - 3 * pxPerMm);
        cx -= colW[i];
      });
    };
    cells(1, heads, true, muted);
    rows.forEach((r, i) => cells(i + 2, [r.rev, r.date, r.description], false, text));
    ctx.restore();
  }

  /**
   * رسم سهم الشمال المعماري (North Arrow)
   */
  private static drawNorthArrow(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scaleDpi: number,
    borderColor: string,
    textColor: string,
    angleDeg: number = 0
  ): void {
    const radius = 12 * scaleDpi;
    ctx.save();
    ctx.translate(x, y);
    // كلمة «شمال» تبقى أفقية أسفل الدائرة، والسهم وحرف N يدوران
    ctx.fillStyle = textColor;
    ctx.font = `600 ${Math.round(2.6 * scaleDpi)}px 'Cairo', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('شمال', 0, radius + 5 * scaleDpi);
    ctx.rotate((angleDeg * Math.PI) / 180);

    // دائرة البوصلة الخارجية
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1 * scaleDpi;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();

    // سهم الشمال (نصف مظلل ونصف مفرغ)
    const arrowLen = radius * 1.35;
    const arrowW = radius * 0.45;

    // نصف مظلل (اليمين)
    ctx.fillStyle = borderColor;
    ctx.beginPath();
    ctx.moveTo(0, -arrowLen);
    ctx.lineTo(arrowW, 0);
    ctx.lineTo(0, -arrowW * 0.3);
    ctx.closePath();
    ctx.fill();

    // نصف مفرغ (اليسار)
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1 * scaleDpi;
    ctx.beginPath();
    ctx.moveTo(0, -arrowLen);
    ctx.lineTo(-arrowW, 0);
    ctx.lineTo(0, -arrowW * 0.3);
    ctx.closePath();
    ctx.stroke();

    // حرف N / سهم الشمال
    ctx.fillStyle = textColor;
    ctx.font = `bold ${Math.round(4.5 * scaleDpi)}px 'Cairo', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('N', 0, -arrowLen - 2 * scaleDpi);

    ctx.restore();
  }

  /**
   * رسم مقياس الرسم الشريطي المتري (Graphic Scale Bar)
   */
  private static drawScaleBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    scaleDpi: number,
    textColor: string,
    borderColor: string,
    printScale: number,
    pxPerMm: number,
    bgColor: string
  ): void {
    ctx.save();
    const bar = niceScaleBar(printScale, 70, 4);
    const segPx = bar.segmentMm * pxPerMm;
    const barH = 2.2 * pxPerMm;
    const fmtM = (m: number) => (Number.isInteger(m) ? String(m) : m.toFixed(m < 1 ? 2 : 1).replace(/0+$/, '').replace(/\.$/, ''));

    ctx.fillStyle = textColor;
    ctx.font = `bold ${Math.round(2.8 * scaleDpi)}px 'Cairo', sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`مقياس الرسم 1:${printScale}`, x, y - 2.5 * pxPerMm);

    for (let i = 0; i < bar.segments; i++) {
      const segX = x + i * segPx;
      ctx.fillStyle = i % 2 === 0 ? borderColor : bgColor;
      ctx.fillRect(segX, y, segPx, barH);
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 0.25 * pxPerMm;
      ctx.strokeRect(segX, y, segPx, barH);
    }
    ctx.fillStyle = textColor;
    ctx.font = `${Math.round(2.3 * scaleDpi)}px 'Cairo', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let i = 0; i <= bar.segments; i++) {
      ctx.fillText(i === bar.segments ? `${fmtM(i * bar.segmentMeters)} م` : fmtM(i * bar.segmentMeters), x + i * segPx, y + barH + 1 * pxPerMm);
    }
    ctx.restore();
  }

  /**
   * رسم مفتاح الرموز الهندسية المصغر (Mini Legend)
   */
  private static drawMiniLegend(
    ctx: CanvasRenderingContext2D,
    model: ProjectModel,
    options: ExportPDFOptions,
    x: number,
    y: number,
    scaleDpi: number,
    bgColor: string,
    borderColor: string,
    textColor: string,
    mutedColor: string
  ): void {
    const objects = model.getObjects();
    const symbols = objects.filter((o) => o.type === 'symbol') as SymbolObject[];
    const routes = objects.filter((o) => o.type === 'route') as RouteObject[];

    // تصفية حسب الطبقات المرئية
    const activeSymbols = symbols.filter((s) => options.visibleLayerIds.includes(s.layerId));
    const activeRoutes = routes.filter((r) => options.visibleLayerIds.includes(r.layerId));

    if (activeSymbols.length === 0 && activeRoutes.length === 0) return;

    // أخذ عينات فريدة (مع لون أول رمز من كل نوع كما يظهر على المخطط)
    const symbolColor = new Map<string, string>();
    const layerColor = new Map(model.getLayers().map((l) => [l.id, l.color]));
    for (const s of activeSymbols) if (!symbolColor.has(s.symbolKind)) symbolColor.set(s.symbolKind, s.color || layerColor.get(s.layerId) || '#334155');
    const uniqueSymbols = Array.from(symbolColor.keys()).slice(0, 12);
    const uniqueRoutes = Array.from(new Set(activeRoutes.map((r) => r.routeKind))).slice(0, 5);
    // الألوان الفاتحة جداً (لون الطبقة المعمارية مثلاً) لا تظهر على الورق الأبيض
    const onPaper = (c: string) => (options.theme === 'white' && /^#(f[0-9a-f]){3}$|^#(e[0-9a-f]|f[0-9a-f]){3}$/i.test(c) ? '#0f172a' : c);

    const totalRows = uniqueSymbols.length + uniqueRoutes.length;
    const legendW = 58 * scaleDpi;
    const legendH = (8 + totalRows * 6.5) * scaleDpi;

    ctx.save();
    ctx.fillStyle = `${bgColor}ee`;
    ctx.fillRect(x, y, legendW, legendH);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 0.8 * scaleDpi;
    ctx.strokeRect(x, y, legendW, legendH);

    // عنوان المفتاح
    ctx.fillStyle = textColor;
    ctx.font = `bold ${Math.round(2.8 * scaleDpi)}px 'Cairo', sans-serif`;
    ctx.textAlign = 'right';
    ctx.fillText('مفتاح الرموز (LEGEND)', x + legendW - 3 * scaleDpi, y + 5 * scaleDpi);

    let rowY = y + 10 * scaleDpi;

    // رسم رموز الـ MEP
    uniqueSymbols.forEach((kind) => {
      const def = getSymbolById(kind);
      // الرمز بشكله الحقيقي (نفس رسم لوحة الرسم) بدل نقطة ملونة
      const iconPx = 5.6 * scaleDpi;
      const icon = renderSymbolIcon(kind, iconPx * 2, onPaper(symbolColor.get(kind) || '#334155'));
      ctx.drawImage(icon, x + legendW - 3 * scaleDpi - iconPx, rowY - 1.4 * scaleDpi - iconPx / 2, iconPx, iconPx);

      ctx.fillStyle = textColor;
      ctx.font = `${Math.round(2.4 * scaleDpi)}px 'Cairo', sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(def?.name || kind, x + legendW - 11 * scaleDpi, rowY);

      rowY += 6.5 * scaleDpi;
    });

    // رسم خطوط المسارات
    uniqueRoutes.forEach((kind) => {
      const meta = ROUTE_KINDS_META[kind];

      ctx.strokeStyle = meta?.defaultColor || '#38bdf8';
      ctx.lineWidth = 0.6 * scaleDpi;
      ctx.setLineDash((meta?.dashPattern || []).map((d) => d * 0.25 * scaleDpi));
      ctx.beginPath();
      ctx.moveTo(x + legendW - 3 * scaleDpi, rowY - 1.2 * scaleDpi);
      ctx.lineTo(x + legendW - 9 * scaleDpi, rowY - 1.2 * scaleDpi);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = textColor;
      ctx.font = `${Math.round(2.4 * scaleDpi)}px 'Cairo', sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(meta?.name || kind, x + legendW - 10 * scaleDpi, rowY);

      rowY += 6.5 * scaleDpi;
    });

    ctx.restore();
  }

  /**
   * رسم علامات الشبكة المرجعية على حواف الإطار الداخلي
   */
  private static drawBorderGridTicks(
    ctx: CanvasRenderingContext2D,
    marginPx: number,
    canvasW: number,
    canvasH: number,
    color: string,
    scaleDpi: number
  ): void {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.font = `${Math.round(2 * scaleDpi)}px 'Cairo', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 0.5 * scaleDpi;

    const tickSize = 2 * scaleDpi;
    const numCols = 6;
    const numRows = 4;
    const innerW = canvasW - marginPx * 2;
    const innerH = canvasH - marginPx * 2;

    // محاور أفقية (أرقام 1، 2، 3، 4، 5، 6)
    for (let i = 1; i < numCols; i++) {
      const tx = marginPx + (innerW / numCols) * i;
      // أعلى
      ctx.beginPath();
      ctx.moveTo(tx, marginPx);
      ctx.lineTo(tx, marginPx - tickSize);
      ctx.stroke();
      ctx.fillText(`${i}`, tx, marginPx - tickSize * 2);

      // أسفل
      ctx.beginPath();
      ctx.moveTo(tx, canvasH - marginPx);
      ctx.lineTo(tx, canvasH - marginPx + tickSize);
      ctx.stroke();
    }

    // محاور رأسية (حروف A, B, C, D)
    const letters = ['A', 'B', 'C', 'D'];
    for (let j = 1; j < numRows; j++) {
      const ty = marginPx + (innerH / numRows) * j;
      // يمين
      ctx.beginPath();
      ctx.moveTo(canvasW - marginPx, ty);
      ctx.lineTo(canvasW - marginPx + tickSize, ty);
      ctx.stroke();
      ctx.fillText(letters[j - 1] || `${j}`, canvasW - marginPx + tickSize * 2.5, ty);

      // يسار
      ctx.beginPath();
      ctx.moveTo(marginPx, ty);
      ctx.lineTo(marginPx - tickSize, ty);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * تحميل صورة DataURL برمجياً
   */
  private static loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(err);
      img.src = url;
    });
  }
}
