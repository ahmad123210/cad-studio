/**
 * @file ExportModal.tsx
 * @description نافذة تصدير المخططات الهندسية التنفيذية وجداول الكميات (المرحلة 6).
 * توفر معاينة فورية لشيت المخطط الهندسي (A4/A3/A2/A1)، تخصيص الخرطوشة المعمارية،
 * الفلاتر والطبقات، وتصدير PDF احترافي مع صفحة BOQ اختيارية، وصور عالية الدقة، وCSV.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  FileDown,
  Printer,
  FileSpreadsheet,
  Image as ImageIcon,
  CheckCircle2,
  Layers,
  Compass,
  FileText,
  Palette,
  Layout,
  Stamp,
  Sliders,
  Sparkles,
  Eye,
  RefreshCw,
  FileCode2,
} from 'lucide-react';
import { ProjectModel } from '../model/project.ts';
import { CadEngine } from '../engine/renderer.ts';
import {
  ExportEngine,
  ExportPDFOptions,
  PaperFormat,
  Orientation,
  ColorTheme,
  StampStatus,
  PAPER_DIMENSIONS_MM,
} from '../engine/exportEngine.ts';
import { downloadDxfFile } from '../engine/dxfEngine.ts';
import { STANDARD_SCALES } from '../engine/print/printLayout.ts';
import type { PrintSettings } from '../model/types.ts';
import type { PrintView } from '../engine/exportEngine.ts';

/** تصغير الشعار المرفوع إلى PNG بعرض/ارتفاع أقصى 400 بكسل (حجم ملف المشروع) */
function shrinkImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('صورة غير صالحة'));
      img.onload = () => {
        const k = Math.min(1, 400 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * k));
        c.height = Math.max(1, Math.round(img.height * k));
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/png'));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/** سماكات خطوط الطباعة المعيارية (مم) */
const LINE_WEIGHTS_MM = [0.13, 0.18, 0.25, 0.35, 0.5, 0.7, 1.0];

interface ExportModalProps {
  model: ProjectModel;
  engine: CadEngine | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenScheduleBOQ?: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  model,
  engine,
  isOpen,
  onClose,
  onOpenScheduleBOQ,
}) => {
  const meta = model.getMeta();
  const allLayers = model.getLayers();

  // إعدادات التصدير
  const [paperFormat, setPaperFormat] = useState<PaperFormat>('a4');
  const [orientation, setOrientation] = useState<Orientation>('landscape');
  const [theme, setTheme] = useState<ColorTheme>('white');
  const [includeTitleBlock, setIncludeTitleBlock] = useState(true);
  const [includeLegend, setIncludeLegend] = useState(true);
  const [includeNorthArrow, setIncludeNorthArrow] = useState(true);
  const [includeScaleBar, setIncludeScaleBar] = useState(true);
  const [includeStamp, setIncludeStamp] = useState(true);
  const [includeGrid, setIncludeGrid] = useState(false);
  const [includeBackground, setIncludeBackground] = useState(true);
  const [includeDimensions, setIncludeDimensions] = useState(true);
  const [includeBOQSheet, setIncludeBOQSheet] = useState(true);
  const [includeSymbolsLegendSheet, setIncludeSymbolsLegendSheet] = useState(true);

  // الطبقات المختارة للطباعة
  const [selectedLayers, setSelectedLayers] = useState<string[]>(() =>
    allLayers.filter((l) => l.visible).map((l) => l.id)
  );

  // بيانات الخرطوشة الهندسية
  const [projectName, setProjectName] = useState(meta.name || 'مشروع فيلا سكنية');
  const [drawingTitle, setDrawingTitle] = useState('المخطط التنفيذي الكهروميكانيكي');
  const [discipline, setDiscipline] = useState('المعماري والكهروميكانيكي (MEP & Architectural)');
  const [scaleText, setScaleText] = useState('50');
  const [sheetNumber, setSheetNumber] = useState('MEP-101');
  const [revision, setRevision] = useState('Rev 01');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [engineer, setEngineer] = useState('م. أحمد المهندس');
  const [client, setClient] = useState('المالك الموقر');
  const [stampStatus, setStampStatus] = useState<StampStatus>('approved');

  // تبويب المعاينة: صفحة المخطط أو صفحة BOQ
  const [previewTab, setPreviewTab] = useState<'drawing' | 'boq'>('drawing');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // الطباعة بمقياس حقيقي (0 = ملاءمة تلقائية لأقرب مقياس معياري) وسهم الشمال وسماكة الخطوط
  const [printScale, setPrintScale] = useState<number>(0);
  const [northAngle, setNorthAngle] = useState<number>(0);
  const [lineWeights, setLineWeights] = useState<Record<string, number>>({});
  const [previewInfo, setPreviewInfo] = useState<{ scale: number; fits: boolean } | null>(null);
  const [imageDpi, setImageDpi] = useState(300);
  // الشركة والشعار والمراجعات والمناظير وكل اللوحات
  const [companyName, setCompanyName] = useState('');
  const [logoDataUrl, setLogoDataUrl] = useState<string>('');
  const [revisions, setRevisions] = useState<{ rev: string; date: string; description: string }[]>([]);
  const [views, setViews] = useState<PrintView[]>([]);
  const [allSheets, setAllSheets] = useState(false);
  const sheetList = model.getSheetSummaries();
  const loadedSnapshot = useRef<string>('');

  /** الإعدادات الحالية بالصيغة المحفوظة مع المشروع */
  const currentPrintSettings = (): PrintSettings => ({
    paperFormat,
    orientation,
    theme,
    printScale,
    northAngle,
    lineWeights,
    titleBlock: { projectName, drawingTitle, discipline, sheetNumber, revision, engineer, client, stampStatus },
    companyName,
    logoDataUrl: logoDataUrl || undefined,
    revisions,
    views,
    allSheets,
  });
  /** حفظ الإعدادات مع المشروع إن تغيرت منذ فتح النافذة */
  const persistPrintSettings = () => {
    const cur = currentPrintSettings();
    if (JSON.stringify(cur) !== loadedSnapshot.current) model.setPrintSettings({ ...model.getPrintSettings(), ...cur });
  };
  const handleClose = () => {
    persistPrintSettings();
    onClose();
  };

  // تحديث الطبقات عند فتح النافذة
  useEffect(() => {
    if (isOpen) {
      setSelectedLayers(model.getLayers().filter((l) => l.visible).map((l) => l.id));
      // استعادة إعدادات الطباعة المحفوظة مع المشروع
      const ps = model.getPrintSettings();
      const tb = ps.titleBlock || {};
      const v = {
        paperFormat: (ps.paperFormat as PaperFormat) || paperFormat,
        orientation: ps.orientation || orientation,
        theme: (ps.theme as ColorTheme) || theme,
        printScale: ps.printScale ?? 0,
        northAngle: ps.northAngle ?? 0,
        lineWeights: ps.lineWeights || {},
        projectName: tb.projectName || model.getMeta().name || 'مشروع فيلا سكنية',
        drawingTitle: tb.drawingTitle ?? drawingTitle,
        discipline: tb.discipline ?? discipline,
        sheetNumber: tb.sheetNumber ?? sheetNumber,
        revision: tb.revision ?? revision,
        engineer: tb.engineer ?? engineer,
        client: tb.client ?? client,
        stampStatus: (tb.stampStatus as StampStatus) || stampStatus,
      };
      setPaperFormat(v.paperFormat);
      setOrientation(v.orientation);
      setTheme(v.theme);
      setPrintScale(v.printScale);
      setNorthAngle(v.northAngle);
      setLineWeights(v.lineWeights);
      setProjectName(v.projectName);
      setDrawingTitle(v.drawingTitle);
      setDiscipline(v.discipline);
      setSheetNumber(v.sheetNumber);
      setRevision(v.revision);
      setEngineer(v.engineer);
      setClient(v.client);
      setStampStatus(v.stampStatus);
      const sheetIds = new Set(model.getSheetSummaries().map((s) => s.id));
      const extra = {
        companyName: ps.companyName || '',
        logoDataUrl: ps.logoDataUrl || undefined,
        revisions: ps.revisions || [],
        // منظور من لوحة حُذفت لا يُستعاد
        views: (ps.views || []).filter((vw) => !vw.sheetId || sheetIds.has(vw.sheetId)),
        allSheets: Boolean(ps.allSheets),
      };
      setCompanyName(extra.companyName);
      setLogoDataUrl(extra.logoDataUrl || '');
      setRevisions(extra.revisions);
      setViews(extra.views);
      setAllSheets(extra.allSheets);
      loadedSnapshot.current = JSON.stringify({
        paperFormat: v.paperFormat, orientation: v.orientation, theme: v.theme, printScale: v.printScale, northAngle: v.northAngle, lineWeights: v.lineWeights,
        titleBlock: { projectName: v.projectName, drawingTitle: v.drawingTitle, discipline: v.discipline, sheetNumber: v.sheetNumber, revision: v.revision, engineer: v.engineer, client: v.client, stampStatus: v.stampStatus },
        ...extra,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, model]);

  // خيارات التصدير المجمعة
  const exportOptions: ExportPDFOptions = {
    paperFormat,
    orientation,
    theme,
    includeTitleBlock,
    includeLegend,
    includeNorthArrow,
    includeScaleBar,
    includeStamp,
    includeGrid,
    includeBackground,
    includeDimensions,
    includeBOQSheet,
    includeSymbolsLegendSheet,
    visibleLayerIds: selectedLayers,
    printScale: printScale > 0 ? printScale : 'fit',
    northAngle,
    lineWeights,
    companyName: companyName.trim() || undefined,
    logoDataUrl: logoDataUrl || undefined,
    revisions: revisions.filter((r) => r.rev || r.description),
    views: allSheets ? [] : views,
    allSheets: allSheets && sheetList.length > 1,
    titleBlock: {
      projectName,
      drawingTitle,
      discipline,
      scaleText,
      sheetNumber,
      revision,
      date,
      engineer,
      client,
      stampStatus,
    },
  };

  // توليد المعاينة الحية للوحة
  const updatePreview = async () => {
    if (!engine || !isOpen) return;
    setIsGenerating(true);

    try {
      const isLandscape = orientation === 'landscape';
      const paper = PAPER_DIMENSIONS_MM[paperFormat];
      const pdfW = isLandscape ? Math.max(paper.width, paper.height) : Math.min(paper.width, paper.height);
      const pdfH = isLandscape ? Math.min(paper.width, paper.height) : Math.max(paper.width, paper.height);

      let canvas: HTMLCanvasElement;
      if (previewTab === 'drawing') {
        // معاينة بدقة خفيفة وسريعة للعرض
        canvas = await ExportEngine.renderSheetToCanvas(engine, model, exportOptions, pdfW, pdfH, 1.2);
        setPreviewInfo((canvas as HTMLCanvasElement & { printInfo?: { scale: number; fits: boolean } }).printInfo ?? null);
      } else {
        canvas = ExportEngine.renderBOQSheetToCanvas(model, exportOptions, pdfW, pdfH, 1.2);
      }

      setPreviewUrl(canvas.toDataURL('image/jpeg', 0.85));
    } catch (err) {
      console.error('Preview error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // تحديث المعاينة عند تغير أي خيار
  useEffect(() => {
    const timer = setTimeout(() => {
      updatePreview();
    }, 150);
    return () => clearTimeout(timer);
  }, [
    isOpen,
    previewTab,
    paperFormat,
    orientation,
    theme,
    includeTitleBlock,
    includeLegend,
    includeNorthArrow,
    includeScaleBar,
    includeStamp,
    includeGrid,
    includeBackground,
    includeDimensions,
    selectedLayers,
    projectName,
    drawingTitle,
    discipline,
    scaleText,
    sheetNumber,
    revision,
    date,
    engineer,
    client,
    stampStatus,
    printScale,
    northAngle,
    lineWeights,
    companyName,
    logoDataUrl,
    revisions,
    views,
    allSheets,
  ]);

  if (!isOpen) return null;

  // تنفيذ تصدير PDF
  const handleExportPDF = async () => {
    if (!engine) return;
    setIsExportingPDF(true);
    setExportSuccessMsg(null);
    try {
      persistPrintSettings();
      await ExportEngine.exportPDF(engine, model, exportOptions);
      setExportSuccessMsg('تم تصدير ملف PDF الهندسي بنجاح!');
      setTimeout(() => setExportSuccessMsg(null), 4000);
    } catch (err) {
      alert('حدث خطأ أثناء تصدير PDF: ' + (err as Error).message);
    } finally {
      setIsExportingPDF(false);
    }
  };

  // تنفيذ تصدير صورة عالية الدقة
  const handleExportImage = async (format: 'png' | 'jpeg') => {
    if (!engine) return;
    try {
      const dpi = await ExportEngine.exportImage(engine, model, exportOptions, format, imageDpi);
      setExportSuccessMsg(`تم تصدير الصورة بدقة ${dpi} DPI (${format.toUpperCase()}) بنجاح!${dpi < imageDpi ? ' (خُفّضت الدقة لحدود المتصفح)' : ''}`);
      setTimeout(() => setExportSuccessMsg(null), 4000);
    } catch (err) {
      alert('حدث خطأ أثناء تصدير الصورة: ' + (err as Error).message);
    }
  };

  // تصدير SVG متجه بالمقياس الحقيقي
  const handleExportSVG = () => {
    if (!engine) return;
    try {
      ExportEngine.exportSVG(engine, model, exportOptions);
      setExportSuccessMsg('تم تصدير المخطط كملف SVG متجه بالمقاس الحقيقي');
      setTimeout(() => setExportSuccessMsg(null), 4000);
    } catch (err) {
      alert('حدث خطأ أثناء تصدير SVG: ' + (err as Error).message);
    }
  };

  // تنفيذ تصدير BOQ CSV
  const handleExportCSV = () => {
    ExportEngine.exportBOQCSV(model);
    setExportSuccessMsg('تم تنزيل جدول حصر الكميات بصيغة Excel (CSV)!');
    setTimeout(() => setExportSuccessMsg(null), 4000);
  };

  // تنفيذ تصدير AutoCAD DXF القياسي
  const handleExportDxf = () => {
    downloadDxfFile(model, {
      version: 'R12',
      units: 'meters',
      exportWallsAsDoubleLines: true,
      includeDimensions: includeDimensions,
      includeSymbols: true,
      includeRoutes: true,
      selectedLayerIds: selectedLayers,
    });
    setExportSuccessMsg('تم تصدير ملف AutoCAD DXF القياسي بنجاح!');
    setTimeout(() => setExportSuccessMsg(null), 4000);
  };

  // طباعة مباشرة
  const handleDirectPrint = () => {
    if (!previewUrl) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>${projectName} - ${sheetNumber}</title>
          <style>
            @page { size: ${paperFormat} ${orientation}; margin: 0; }
            body { margin: 0; display: flex; justify-content: center; align-items: center; background: white; }
            img { width: 100vw; height: 100vh; object-fit: contain; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <img src="${previewUrl}" />
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const toggleLayer = (layerId: string) => {
    setSelectedLayers((prev) =>
      prev.includes(layerId) ? prev.filter((id) => id !== layerId) : [...prev, layerId]
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs select-none p-2 sm:p-4">
      <div className="w-full max-w-6xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[96vh] text-neutral-200 animate-in fade-in zoom-in-95 duration-150">
        {/* رأس النافذة */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <FileDown size={22} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <span>تصدير المخطط الهندسي وجداول الكميات (PDF & BOQ Export)</span>
                <span className="text-[10px] bg-sky-950 text-sky-400 border border-sky-800 px-2 py-0.5 rounded-full font-mono-cad font-semibold">
                  تصدير متقدم
                </span>
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {exportSuccessMsg && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-3 py-1.5 rounded-lg animate-in fade-in">
                <CheckCircle2 size={15} />
                <span>{exportSuccessMsg}</span>
              </div>
            )}

            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg hover:bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white transition-colors ml-2"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* جسم النافذة: قسم المعاينة (يسار) وقسم الخيارات (يمين) */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* قسم المعاينة الحية للوحة الهندسية */}
          <div className="flex-1 bg-neutral-950/90 p-4 flex flex-col border-b lg:border-b-0 lg:border-l border-neutral-800 overflow-hidden">
            {/* أشرطة التحكم بالمعاينة والتبويبات */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 bg-neutral-900 p-1 rounded-lg border border-neutral-800">
                <button
                  onClick={() => setPreviewTab('drawing')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                    previewTab === 'drawing'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  <Eye size={13} />
                  <span>لوحة المخطط (Sheet 1)</span>
                </button>
                {includeBOQSheet && (
                  <button
                    onClick={() => setPreviewTab('boq')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
                      previewTab === 'boq'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <FileSpreadsheet size={13} />
                    <span>جدول الكميات (Sheet 2 - BOQ)</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-neutral-400 font-mono-cad">
                  {paperFormat.toUpperCase()} ({orientation === 'landscape' ? 'أفقي' : 'رأسي'})
                </span>
                <button
                  onClick={updatePreview}
                  disabled={isGenerating}
                  className="p-1.5 rounded-md hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                  title="تحديث المعاينة"
                >
                  <RefreshCw size={14} className={isGenerating ? 'animate-spin text-sky-400' : ''} />
                </button>
              </div>
            </div>

            {/* مساحة عرض الشيت الهندسي المجهز */}
            <div className="flex-1 bg-neutral-900/60 rounded-xl border border-neutral-800/80 p-3 flex items-center justify-center overflow-hidden relative shadow-inner">
              {isGenerating && (
                <div className="absolute inset-0 bg-neutral-950/50 backdrop-blur-xs flex items-center justify-center z-10">
                  <div className="flex items-center gap-2 text-xs text-sky-400 bg-neutral-900 px-3 py-2 rounded-lg border border-neutral-800 shadow-lg">
                    <RefreshCw size={15} className="animate-spin" />
                    <span>جاري معالجة اللوحة ورسم الخرطوشة...</span>
                  </div>
                </div>
              )}

              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Engineering Sheet Preview"
                  className="max-h-full max-w-full object-contain rounded shadow-2xl border border-neutral-700/50"
                  style={{
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
                  }}
                />
              ) : (
                <div className="text-center text-neutral-500 text-xs">
                  جاري تحميل المعاينة الهندسية...
                </div>
              )}
            </div>

            {/* شريط الإجراءات السريعة أسفل المعاينة */}
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-800/70 text-xs">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDirectPrint}
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg font-medium transition-colors flex items-center gap-1.5 border border-neutral-700"
                  title="طباعة فورية"
                >
                  <Printer size={14} />
                  <span>طباعة (Print)</span>
                </button>

                <span className="flex items-center rounded-lg border border-neutral-700 overflow-hidden">
                  <button
                    onClick={() => handleExportImage('png')}
                    className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-medium transition-colors flex items-center gap-1.5"
                    title="تحميل كصورة عالية الدقة للواتساب والمواقع"
                  >
                    <ImageIcon size={14} />
                    <span>صورة PNG</span>
                  </button>
                  <select
                    data-testid="image-dpi"
                    value={imageDpi}
                    onChange={(e) => setImageDpi(Number(e.target.value))}
                    className="bg-neutral-900 text-neutral-300 px-1.5 py-1.5 text-[11px] outline-none border-r border-neutral-700"
                    title="دقة الصورة"
                  >
                    {[150, 300, 600].map((d) => (
                      <option key={d} value={d}>{d} DPI</option>
                    ))}
                  </select>
                </span>

                <button
                  data-testid="export-svg"
                  onClick={handleExportSVG}
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg font-medium transition-colors flex items-center gap-1.5 border border-neutral-700"
                  title="ملف متجه بالمقاس الحقيقي (Illustrator / Inkscape / المتصفح)"
                >
                  <FileCode2 size={14} />
                  <span>SVG متجه</span>
                </button>

                <button
                  onClick={handleExportCSV}
                  className="px-3 py-1.5 bg-emerald-950/70 hover:bg-emerald-900 text-emerald-300 rounded-lg font-medium transition-colors flex items-center gap-1.5 border border-emerald-700/60"
                  title="تصدير جدول الكميات كملف Excel"
                >
                  <FileSpreadsheet size={14} />
                  <span>حصر الكميات (CSV)</span>
                </button>

                <button
                  onClick={handleExportDxf}
                  className="px-3 py-1.5 bg-sky-950/70 hover:bg-sky-900 text-sky-300 rounded-lg font-medium transition-colors flex items-center gap-1.5 border border-sky-700/60"
                  title="تصدير ملف AutoCAD DXF القياسي المتوافق 100% مع أوتوكاد وجميع برامج وعوارض CAD"
                >
                  <FileCode2 size={14} />
                  <span>AutoCAD (DXF)</span>
                </button>
              </div>

              <div className="text-[11px] text-neutral-500 flex items-center gap-1">
                <span>معاينة حية للمخطط 1:1</span>
              </div>
            </div>
          </div>

          {/* لوحة التحكم والإعدادات الهندسية (يمين) */}
          <div className="w-full lg:w-96 p-5 overflow-y-auto flex flex-col gap-5 bg-neutral-900">
            {/* 1. إعدادات الورقة والمظهر */}
            <div className="flex flex-col gap-2.5">
              <h4 className="text-xs font-bold text-white flex items-center gap-2">
                <Layout size={15} className="text-sky-400" />
                <span>إعدادات اللوحة والمقاس (Layout & Format)</span>
              </h4>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-neutral-400 block mb-1">حجم الورقة:</label>
                  <select
                    data-testid="paper-format"
                    value={paperFormat}
                    onChange={(e) => setPaperFormat(e.target.value as PaperFormat)}
                    className="w-full bg-neutral-800 border border-neutral-700 text-neutral-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-sky-500"
                  >
                    <option value="a4">A4 (297 × 210 مم)</option>
                    <option value="a3">A3 (420 × 297 مم) - قياسي</option>
                    <option value="a2">A2 (594 × 420 مم)</option>
                    <option value="a1">A1 (841 × 594 مم) - ورشة</option>
                    <option value="a0">A0 (1189 × 841 مم)</option>
                    <option value="letter">Letter</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] text-neutral-400 block mb-1">اتجاه الورقة:</label>
                  <select
                    value={orientation}
                    onChange={(e) => setOrientation(e.target.value as Orientation)}
                    className="w-full bg-neutral-800 border border-neutral-700 text-neutral-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-sky-500"
                  >
                    <option value="landscape">أفقي (Landscape)</option>
                    <option value="portrait">رأسي (Portrait)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">مقياس الطباعة (حقيقي):</label>
                <select
                  data-testid="print-scale"
                  value={printScale}
                  onChange={(e) => setPrintScale(Number(e.target.value))}
                  className="w-full bg-neutral-800 border border-neutral-700 text-neutral-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-sky-500 font-mono-cad"
                >
                  <option value={0}>ملاءمة تلقائية (أقرب مقياس معياري يتسع)</option>
                  {STANDARD_SCALES.map((s) => (
                    <option key={s} value={s}>1:{s}</option>
                  ))}
                </select>
                {previewInfo && (
                  <div className={`mt-1 text-[11px] ${previewInfo.fits ? 'text-emerald-400' : 'text-amber-300'}`} data-testid="print-scale-info">
                    {previewInfo.fits
                      ? `يُطبع بمقياس 1:${previewInfo.scale} — القياس على الورق مطابق للواقع`
                      : `المخطط لا يتسع بمقياس 1:${previewInfo.scale} على هذا الورق؛ اختر مقياساً أصغر أو ورقاً أكبر`}
                  </div>
                )}
              </div>

              <div>
                <label className="text-[11px] text-neutral-400 block mb-1">المظهر اللوني (Theme):</label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => setTheme('white')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 border transition-colors ${
                      theme === 'white'
                        ? 'bg-neutral-100 text-neutral-900 border-white font-bold'
                        : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-white border border-neutral-400" />
                    <span>ورق أبيض</span>
                  </button>

                  <button
                    onClick={() => setTheme('dark')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 border transition-colors ${
                      theme === 'dark'
                        ? 'bg-sky-950 text-sky-300 border-sky-500 font-bold'
                        : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-neutral-900 border border-sky-400" />
                    <span>أوتوكاد</span>
                  </button>

                  <button
                    onClick={() => setTheme('blueprint')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1 border transition-colors ${
                      theme === 'blueprint'
                        ? 'bg-blue-950 text-blue-300 border-blue-500 font-bold'
                        : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:text-white'
                    }`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-900 border border-blue-400" />
                    <span>بلوبرينت</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="h-px bg-neutral-800" />

            {/* 2. بيانات الخرطوشة الهندسية (Title Block) */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText size={17} className="text-amber-400" />
                  <span>بيانات الخرطوشة الهندسية (Title Block)</span>
                </h4>
                <label className="flex items-center gap-1.5 text-xs text-neutral-200 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeTitleBlock}
                    onChange={(e) => setIncludeTitleBlock(e.target.checked)}
                    className="accent-sky-500 rounded"
                  />
                  <span>تضمين الخرطوشة</span>
                </label>
              </div>

              {includeTitleBlock && (
                <div className="flex flex-col gap-3 text-xs">
                  {/* الشركة/المكتب والشعار */}
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-neutral-200 block mb-1">الشركة / المكتب الهندسي:</label>
                      <input data-testid="company-name" type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="اسم المكتب (اختياري)" className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs text-white outline-none focus:border-sky-500" />
                    </div>
                    <label className="shrink-0 cursor-pointer" title="شعار الشركة (PNG/JPG)">
                      <input
                        type="file"
                        accept="image/*"
                        data-testid="logo-input"
                        className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          try {
                            setLogoDataUrl(await shrinkImage(f));
                          } catch (err) {
                            alert((err as Error).message);
                          }
                          e.target.value = '';
                        }}
                      />
                      <span className="w-16 h-[34px] rounded-lg border border-dashed border-neutral-600 hover:border-sky-500 flex items-center justify-center overflow-hidden bg-neutral-800">
                        {logoDataUrl ? <img src={logoDataUrl} alt="الشعار" className="max-w-full max-h-full object-contain" /> : <span className="text-[10px] text-neutral-400">+ شعار</span>}
                      </span>
                    </label>
                    {logoDataUrl && (
                      <button onClick={() => setLogoDataUrl('')} className="shrink-0 text-[10px] text-rose-300 hover:text-rose-200 pb-2" title="إزالة الشعار">
                        إزالة
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-neutral-200 block mb-1">اسم المشروع:</label>
                    <input
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500 font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-xs font-semibold text-neutral-200 block mb-1">عنوان اللوحة:</label>
                      <input
                        type="text"
                        value={drawingTitle}
                        onChange={(e) => setDrawingTitle(e.target.value)}
                        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500 font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-neutral-200 block mb-1">التخصص:</label>
                      <input
                        type="text"
                        value={discipline}
                        onChange={(e) => setDiscipline(e.target.value)}
                        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500 font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="text-xs font-semibold text-neutral-200 block mb-1">رقم اللوحة:</label>
                      <input
                        type="text"
                        value={sheetNumber}
                        onChange={(e) => setSheetNumber(e.target.value)}
                        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-2 text-sm text-white font-mono-cad outline-none focus:border-sky-500 text-center font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-neutral-200 block mb-1">المراجعة:</label>
                      <input
                        type="text"
                        value={revision}
                        onChange={(e) => setRevision(e.target.value)}
                        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-2 text-sm text-white font-mono-cad outline-none focus:border-sky-500 text-center font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-neutral-200 block mb-1">المقياس:</label>
                      {/* يُملأ تلقائياً من مقياس الطباعة الحقيقي */}
                      <div className="flex items-center gap-1 bg-neutral-800/60 border border-neutral-700 rounded-lg px-2.5 py-2 text-sm font-mono-cad text-neutral-300" title="يُحدد من «مقياس الطباعة» في إعدادات اللوحة">
                        <span>1:{previewInfo?.scale ?? (printScale || scaleText)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-xs font-semibold text-neutral-200 block mb-1">المهندس / المصمم:</label>
                      <input
                        type="text"
                        value={engineer}
                        onChange={(e) => setEngineer(e.target.value)}
                        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500 font-medium"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-neutral-200 block mb-1">المالك / العميل:</label>
                      <input
                        type="text"
                        value={client}
                        onChange={(e) => setClient(e.target.value)}
                        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500 font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-neutral-200 block mb-1">ختم الاعتماد الهندسي:</label>
                    <div className="flex items-center gap-2">
                      <select
                        value={stampStatus}
                        onChange={(e) => setStampStatus(e.target.value as StampStatus)}
                        className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-sky-500 font-medium"
                      >
                        <option value="approved">معتمد للتنفيذ (Approved)</option>
                        <option value="draft">مسودة أولية (Preliminary Draft)</option>
                        <option value="as_built">كما نُفّذ بالموقع (As-Built)</option>
                        <option value="for_review">للمراجعة والتدقيق (For Review)</option>
                      </select>

                      <label className="flex items-center gap-1 text-[11px] text-neutral-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeStamp}
                          onChange={(e) => setIncludeStamp(e.target.checked)}
                          className="accent-sky-500 rounded"
                        />
                        <span>إظهار</span>
                      </label>
                    </div>
                  </div>

                  {/* جدول المراجعات */}
                  <div data-testid="revisions">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-neutral-200">جدول المراجعات:</label>
                      <button
                        onClick={() => setRevisions([...revisions, { rev: String(revisions.length).padStart(2, '0'), date: new Date().toISOString().split('T')[0], description: '' }])}
                        className="text-[11px] text-sky-300 hover:text-sky-200"
                      >
                        + إضافة مراجعة
                      </button>
                    </div>
                    {revisions.length === 0 && <div className="text-[11px] text-neutral-500">لا توجد مراجعات (لن يظهر الجدول على اللوحة).</div>}
                    {revisions.map((r, i) => (
                      <div key={i} className="flex items-center gap-1 mb-1">
                        <input value={r.rev} onChange={(e) => setRevisions(revisions.map((x, j) => (j === i ? { ...x, rev: e.target.value } : x)))} className="w-12 bg-neutral-800 border border-neutral-700 rounded px-1.5 py-1 text-center font-mono-cad" aria-label="رقم المراجعة" />
                        <input type="date" value={r.date} onChange={(e) => setRevisions(revisions.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} className="w-32 bg-neutral-800 border border-neutral-700 rounded px-1.5 py-1 font-mono-cad" aria-label="تاريخ المراجعة" />
                        <input value={r.description} placeholder="الوصف" onChange={(e) => setRevisions(revisions.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} className="flex-1 min-w-0 bg-neutral-800 border border-neutral-700 rounded px-1.5 py-1" aria-label="وصف المراجعة" />
                        <button onClick={() => setRevisions(revisions.filter((_, j) => j !== i))} className="text-rose-300 px-1" title="حذف المراجعة">✕</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="h-px bg-neutral-800" />

            {/* المناظير على اللوحة وكل اللوحات */}
            <div className="flex flex-col gap-2 text-xs" data-testid="print-views">
              <h4 className="text-xs font-bold text-white">المناظير على اللوحة</h4>
              {sheetList.length > 1 && (
                <label className="flex items-center gap-2 p-2 rounded-lg bg-neutral-800/60 border border-neutral-800 cursor-pointer">
                  <input type="checkbox" data-testid="all-sheets" checked={allSheets} onChange={(e) => setAllSheets(e.target.checked)} className="accent-sky-500" />
                  <span>طباعة كل اللوحات ({sheetList.length}) في ملف PDF واحد — صفحة لكل لوحة</span>
                </label>
              )}
              {!allSheets && (
                <>
                  <p className="text-[11px] text-neutral-500">بدون مناظير: تُطبع اللوحة الحالية كاملة. أضف مناظير لوضع أكثر من عرض بمقاييس مختلفة على الورقة نفسها (مثل مسقط 1:100 وتفصيلة 1:20).</p>
                  {views.map((v, i) => (
                    <div key={v.id} className="flex flex-col gap-1 p-2 rounded-lg bg-neutral-800/50 border border-neutral-800">
                      <div className="flex items-center gap-1">
                        <input value={v.title} onChange={(e) => setViews(views.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} placeholder={`منظور ${i + 1}`} className="flex-1 min-w-0 bg-neutral-900 border border-neutral-700 rounded px-1.5 py-1" aria-label="عنوان المنظور" />
                        <select value={v.scale} onChange={(e) => setViews(views.map((x, j) => (j === i ? { ...x, scale: Number(e.target.value) } : x)))} className="bg-neutral-900 border border-neutral-700 rounded px-1 py-1 font-mono-cad" aria-label="مقياس المنظور">
                          <option value={0}>ملاءمة</option>
                          {STANDARD_SCALES.map((sc) => (
                            <option key={sc} value={sc}>1:{sc}</option>
                          ))}
                        </select>
                        <button onClick={() => setViews(views.filter((_, j) => j !== i))} className="text-rose-300 px-1" title="حذف المنظور">✕</button>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-neutral-400">
                        <span>من:</span>
                        <select value={v.sheetId || ''} onChange={(e) => setViews(views.map((x, j) => (j === i ? { ...x, sheetId: e.target.value || undefined, region: undefined } : x)))} className="bg-neutral-900 border border-neutral-700 rounded px-1 py-0.5 max-w-40" aria-label="لوحة المنظور">
                          <option value="">اللوحة الحالية</option>
                          {sheetList.map((sh) => (
                            <option key={sh.id} value={sh.id}>{sh.name}</option>
                          ))}
                        </select>
                        <span>{v.region ? '· منطقة محددة' : '· كامل اللوحة'}</span>
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-1.5">
                    <button
                      data-testid="add-view-full"
                      onClick={() => setViews([...views, { id: `v_${Date.now().toString(36)}`, title: model.getSheetSummaries().find((x) => x.id === model.getActiveSheetId())?.name || 'المسقط', sheetId: model.getActiveSheetId(), scale: 0 }])}
                      className="flex-1 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700"
                    >
                      + منظور لكامل اللوحة
                    </button>
                    <button
                      data-testid="add-view-current"
                      disabled={!engine}
                      onClick={() => {
                        if (!engine) return;
                        const a = engine.camera.screenToWorld({ x: 0, y: 0 });
                        const b = engine.camera.screenToWorld({ x: engine.stage.width(), y: engine.stage.height() });
                        setViews([...views, { id: `v_${Date.now().toString(36)}`, title: 'تفصيلة', sheetId: model.getActiveSheetId(), scale: 0, region: { minX: Math.min(a.x, b.x), minY: Math.min(a.y, b.y), maxX: Math.max(a.x, b.x), maxY: Math.max(a.y, b.y) } }]);
                      }}
                      className="flex-1 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700"
                      title="يأخذ المنطقة الظاهرة على الشاشة الآن (كبّر على التفصيلة قبل فتح نافذة الطباعة)"
                    >
                      + منظور من العرض الحالي
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="h-px bg-neutral-800" />

            {/* 3. عناصر الإظهار الهندسية (Toggles) */}
            <div className="flex flex-col gap-2">
              <h4 className="text-xs font-bold text-white flex items-center gap-2">
                <Sliders size={15} className="text-indigo-400" />
                <span>عناصر الإظهار والإخراج</span>
              </h4>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 p-2 rounded-lg bg-neutral-800/60 border border-neutral-800 cursor-pointer hover:bg-neutral-800">
                  <input
                    type="checkbox"
                    checked={includeNorthArrow}
                    onChange={(e) => setIncludeNorthArrow(e.target.checked)}
                    className="accent-sky-500 rounded"
                  />
                  <span>سهم الشمال (🧭)</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-lg bg-neutral-800/60 border border-neutral-800 cursor-pointer hover:bg-neutral-800">
                  <input
                    type="checkbox"
                    checked={includeScaleBar}
                    onChange={(e) => setIncludeScaleBar(e.target.checked)}
                    className="accent-sky-500 rounded"
                  />
                  <span>مقياس الرسم المتري</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-lg bg-neutral-800/60 border border-neutral-800 cursor-pointer hover:bg-neutral-800">
                  <input
                    type="checkbox"
                    checked={includeLegend}
                    onChange={(e) => setIncludeLegend(e.target.checked)}
                    className="accent-sky-500 rounded"
                  />
                  <span>مفتاح الرموز (Legend)</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-lg bg-neutral-800/60 border border-neutral-800 cursor-pointer hover:bg-neutral-800">
                  <input
                    type="checkbox"
                    checked={includeDimensions}
                    onChange={(e) => setIncludeDimensions(e.target.checked)}
                    className="accent-sky-500 rounded"
                  />
                  <span>القياسات والأبعاد</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-lg bg-neutral-800/60 border border-neutral-800 cursor-pointer hover:bg-neutral-800">
                  <input
                    type="checkbox"
                    checked={includeGrid}
                    onChange={(e) => setIncludeGrid(e.target.checked)}
                    className="accent-sky-500 rounded"
                  />
                  <span>شبكة المحاور (Grid)</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-lg bg-neutral-800/60 border border-neutral-800 cursor-pointer hover:bg-neutral-800">
                  <input
                    type="checkbox"
                    checked={includeBackground}
                    onChange={(e) => setIncludeBackground(e.target.checked)}
                    className="accent-sky-500 rounded"
                  />
                  <span>صورة الخلفية</span>
                </label>
              </div>

              {includeNorthArrow && (
                <div className="flex items-center gap-2 text-xs text-neutral-300 px-1">
                  <span>اتجاه سهم الشمال:</span>
                  <input
                    type="range"
                    min={0}
                    max={355}
                    step={5}
                    value={northAngle}
                    onChange={(e) => setNorthAngle(Number(e.target.value))}
                    className="flex-1 accent-sky-500"
                    aria-label="زاوية سهم الشمال"
                  />
                  <input
                    type="number"
                    data-testid="north-angle"
                    min={0}
                    max={359}
                    value={northAngle}
                    onChange={(e) => setNorthAngle(((Math.round(Number(e.target.value) || 0) % 360) + 360) % 360)}
                    className="w-14 bg-neutral-800 border border-neutral-700 rounded px-1 py-0.5 text-center font-mono-cad"
                  />
                  <span className="text-neutral-500">°</span>
                </div>
              )}

              {/* خيار صفحة BOQ في ملف الـ PDF */}
              <div className="mt-1 p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/60 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="includeBOQ"
                  checked={includeBOQSheet}
                  onChange={(e) => setIncludeBOQSheet(e.target.checked)}
                  className="accent-emerald-500 rounded mt-0.5"
                />
                <div>
                  <label htmlFor="includeBOQ" className="text-xs font-bold text-emerald-300 block cursor-pointer">
                    إرفاق صفحة جدول حصر الكميات والمواد (BOQ Sheet)
                  </label>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    توليد صفحة ملحقة بالـ PDF تتضمن جداول حصر المواد، أطوال الكابلات والمواسير، وتوقيعات المهندس.
                  </p>
                </div>
              </div>

              {/* خيار صفحة منفصلة لجدول الرموز المستخدمة */}
              <div className="p-2.5 rounded-xl bg-sky-950/40 border border-sky-800/60 flex items-start gap-2.5">
                <input
                  type="checkbox"
                  id="includeSymbolsLegend"
                  checked={includeSymbolsLegendSheet}
                  onChange={(e) => setIncludeSymbolsLegendSheet(e.target.checked)}
                  className="accent-sky-500 rounded mt-0.5"
                />
                <div>
                  <label htmlFor="includeSymbolsLegend" className="text-xs font-bold text-sky-300 block cursor-pointer">
                    إرفاق صفحة منفصلة لجدول ومفتاح الرموز المستخدمة (Symbols Legend Sheet)
                  </label>
                  <p className="text-[11px] text-neutral-400 mt-0.5">
                    توليد صفحة مستقلة متخصصة تعرض كافة الرموز الهندسية والأجهزة المستخدمة مع أسمائها الفنية وتصنيفاتها.
                  </p>
                </div>
              </div>
            </div>

            <div className="h-px bg-neutral-800" />

            {/* 4. تصفية الطبقات المراد تصديرها (Layers Filter) */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <Layers size={15} className="text-emerald-400" />
                  <span>الطبقات المشمولة في الطباعة ({selectedLayers.length}/{allLayers.length})</span>
                </h4>
                <button
                  onClick={() => setSelectedLayers(allLayers.map((l) => l.id))}
                  className="text-[11px] text-sky-400 hover:underline"
                >
                  تحديد الكل
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5 text-xs">
                {allLayers.map((layer) => {
                  const isChecked = selectedLayers.includes(layer.id);
                  return (
                    <label
                      key={layer.id}
                      className={`flex items-center gap-2 p-2 rounded-lg border transition-colors cursor-pointer ${
                        isChecked
                          ? 'bg-neutral-800 border-neutral-700 text-white'
                          : 'bg-neutral-900/60 border-neutral-800 text-neutral-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleLayer(layer.id)}
                        className="accent-sky-500 rounded"
                      />
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: layer.color }}
                      />
                      <span className="truncate">{layer.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* سماكة خطوط الطباعة لكل طبقة */}
            <details className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-2.5 text-xs" data-testid="line-weights">
              <summary className="cursor-pointer font-bold text-neutral-200">سماكة خطوط الطباعة لكل طبقة</summary>
              <div className="mt-2 flex flex-col gap-1.5">
                {allLayers.map((l) => (
                  <label key={l.id} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 truncate">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: l.color }} />
                      <span className="truncate">{l.name}</span>
                    </span>
                    <select
                      value={lineWeights[l.id] ?? ''}
                      onChange={(e) => {
                        const next = { ...lineWeights };
                        if (e.target.value === '') delete next[l.id];
                        else next[l.id] = Number(e.target.value);
                        setLineWeights(next);
                      }}
                      className="bg-neutral-800 border border-neutral-700 rounded px-1.5 py-0.5 font-mono-cad"
                    >
                      <option value="">تلقائي</option>
                      {LINE_WEIGHTS_MM.map((w) => (
                        <option key={w} value={w}>{w} مم</option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            </details>

            {/* زر التصدير الرئيسي البارز */}
            <div className="pt-2 mt-auto">
              <button
                onClick={handleExportPDF}
                disabled={isExportingPDF}
                className="w-full py-3 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 shadow-lg shadow-sky-600/30 cursor-pointer disabled:opacity-50"
              >
                {isExportingPDF ? (
                  <>
                    <RefreshCw size={18} className="animate-spin" />
                    <span>جاري معالجة وتصدير الـ PDF...</span>
                  </>
                ) : (
                  <>
                    <FileDown size={18} />
                    <span>تنزيل المخطط الهندسي (PDF عالي الدقة)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
