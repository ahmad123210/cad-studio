/**
 * @file DxfModal.tsx
 * @description نافذة تصدير واستيراد ملفات AutoCAD DXF (المرحلة 7).
 * تتيح تصدير المخطط إلى ملف DXF متوافق مع كافة برامج CAD (AutoCAD, Revit, LibreCAD, Civil 3D)،
 * واستيراد ملفات DXF الخارجية وتحويلها تلقائياً إلى عناصر مخطط هندسي حقيقي.
 */

import React, { useState, useRef } from 'react';
import {
  X,
  FileCode2,
  Download,
  Upload,
  Layers,
  Settings2,
  CheckCircle2,
  AlertCircle,
  FileUp,
} from 'lucide-react';
import { ProjectModel } from '../model/project.ts';
import {
  downloadDxfFile,
  DxfExportOptions,
  parseDxfString,
  convertDxfToProjectData,
  DxfParseResult,
} from '../engine/dxfEngine.ts';

interface DxfModalProps {
  model: ProjectModel;
  isOpen: boolean;
  onClose: () => void;
  onProjectUpdated: () => void;
}

export const DxfModal: React.FC<DxfModalProps> = ({
  model,
  isOpen,
  onClose,
  onProjectUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');

  // خيارات التصدير (R12 هي الصيغة المعيارية ذات التوافق الأوسع 100% مع أوتوكاد وجميع العوارض)
  const [version, setVersion] = useState<'R12' | 'AC1015'>('R12');
  const [units, setUnits] = useState<'meters' | 'mm' | 'cm'>('meters');
  const [exportWallsAsDoubleLines, setExportWallsAsDoubleLines] = useState(true);
  const [includeDimensions, setIncludeDimensions] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [includeRoutes, setIncludeRoutes] = useState(true);
  const [selectedLayers, setSelectedLayers] = useState<string[]>(() =>
    model.getLayers().map((l) => l.id)
  );

  // حالة الاستيراد
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<DxfParseResult | null>(null);
  const [importMode, setImportMode] = useState<'replace' | 'merge'>('replace');
  const [isParsing, setIsParsing] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const layers = model.getLayers();
  const objects = model.getObjects();

  const handleToggleLayer = (id: string) => {
    setSelectedLayers((prev) =>
      prev.includes(id) ? prev.filter((l) => l !== id) : [...prev, id]
    );
  };

  const handleSelectAllLayers = () => {
    setSelectedLayers(layers.map((l) => l.id));
  };

  const handleExport = () => {
    const options: DxfExportOptions = {
      version,
      units,
      exportWallsAsDoubleLines,
      includeDimensions,
      includeSymbols,
      includeRoutes,
      selectedLayerIds: selectedLayers,
    };
    downloadDxfFile(model, options);
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processDxfFile(file);
  };

  const processDxfFile = (file: File) => {
    setImportFile(file);
    setIsParsing(true);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseDxfString(text);
        setParseResult(parsed);
        setIsParsing(false);
      } catch (err: any) {
        console.error('DXF parse error:', err);
        setImportError('تعذر قراءة ملف DXF. يرجى التأكد من أن الملف بصيغة ASCII DXF القياسية.');
        setIsParsing(false);
      }
    };
    reader.onerror = () => {
      setImportError('حدث خطأ أثناء قراءة الملف من القرص.');
      setIsParsing(false);
    };
    reader.readAsText(file);
  };

  const handleExecuteImport = () => {
    if (!parseResult) return;

    const scale = model.getMeta().scale || 50;
    const { objects: newObjects, layers: newLayers } = convertDxfToProjectData(
      parseResult,
      scale
    );

    if (importMode === 'replace') {
      // تفريغ الكائنات وإضافة عناصر DXF
      model.clearAllObjects(true);
      newLayers.forEach((lay) => {
        if (!model.getLayers().some((l) => l.id === lay.id)) {
          model.addLayer(lay);
        }
      });
      newObjects.forEach((obj) => model.addObject(obj, true));
    } else {
      // دمج مع المخطط الحالي
      newLayers.forEach((lay) => {
        if (!model.getLayers().some((l) => l.id === lay.id)) {
          model.addLayer(lay);
        }
      });
      newObjects.forEach((obj) => model.addObject(obj, true));
    }

    onProjectUpdated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs select-none p-4">
      <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-neutral-200 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh]">
        {/* رأس النافذة */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <FileCode2 size={22} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <span>تصدير واستيراد AutoCAD DXF</span>
                <span className="text-[10px] bg-sky-950 text-sky-400 border border-sky-800 px-2 py-0.5 rounded-full font-mono-cad">
                  AutoCAD R12/2000
                </span>
              </h3>
              <p className="text-xs text-neutral-400">
                توافقية كاملة مع AutoCAD, Revit, LibreCAD, Civil 3D بدقة هندسية عالية
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* التبويبات: تصدير / استيراد */}
        <div className="px-6 pt-3 border-b border-neutral-800 bg-neutral-900/80 flex items-center gap-3">
          <button
            onClick={() => setActiveTab('export')}
            className={`pb-3 text-xs font-semibold flex items-center gap-2 transition-colors border-b-2 ${
              activeTab === 'export'
                ? 'text-sky-400 border-sky-500'
                : 'text-neutral-400 border-transparent hover:text-neutral-200'
            }`}
          >
            <Download size={15} />
            <span>تصدير إلى DXF</span>
          </button>

          <button
            onClick={() => setActiveTab('import')}
            className={`pb-3 text-xs font-semibold flex items-center gap-2 transition-colors border-b-2 ${
              activeTab === 'import'
                ? 'text-emerald-400 border-emerald-500'
                : 'text-neutral-400 border-transparent hover:text-neutral-200'
            }`}
          >
            <Upload size={15} />
            <span>استيراد ملف DXF خارجي</span>
          </button>
        </div>

        {/* محتوى التبويب */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {activeTab === 'export' ? (
            <>
              {/* خيارات التصدير الأساسية */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-neutral-950/60 p-3.5 rounded-xl border border-neutral-800">
                  <label className="text-xs font-medium text-neutral-300 block mb-1.5 flex items-center gap-1.5">
                    <Settings2 size={14} className="text-sky-400" />
                    <span>إصدار ومعيار ملف DXF</span>
                  </label>
                  <select
                    value={version}
                    onChange={(e) => setVersion(e.target.value as any)}
                    className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-sky-500 font-mono-cad"
                  >
                    <option value="R12">AutoCAD R12 / AC1009 (موصى به - أقصى توافق 100% مع كافة البرامج)</option>
                    <option value="AC1015">AutoCAD 2000+ / AC1015 (معايير المقابض والبلوكات المتقدمة)</option>
                  </select>
                  <p className="text-[10px] text-emerald-400 mt-1">
                    صيغة R12 تفتح مباشرة بدون أي أخطاء في AutoCAD، Autodesk Viewer، وتطبيقات الموبايل.
                  </p>
                </div>

                <div className="bg-neutral-950/60 p-3.5 rounded-xl border border-neutral-800">
                  <label className="text-xs font-medium text-neutral-300 block mb-1.5 flex items-center gap-1.5">
                    <Settings2 size={14} className="text-emerald-400" />
                    <span>وحدة القياس في CAD</span>
                  </label>
                  <select
                    value={units}
                    onChange={(e) => setUnits(e.target.value as any)}
                    className="w-full bg-neutral-900 border border-neutral-700 text-neutral-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-sky-500"
                  >
                    <option value="meters">متر (Meters - الافتراضي للمباني)</option>
                    <option value="mm">مليمتر (Millimeters)</option>
                    <option value="cm">سنتيمتر (Centimeters)</option>
                  </select>
                  <p className="text-[10px] text-neutral-400 mt-1">
                    يتم تحويل أبعاد الرسم إلى القياس الحقيقي مباشرة.
                  </p>
                </div>
              </div>

              {/* تخصيص طبقات التصدير */}
              <div className="bg-neutral-950/60 p-4 rounded-xl border border-neutral-800">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-xs font-semibold text-neutral-200 flex items-center gap-1.5">
                    <Layers size={14} className="text-indigo-400" />
                    <span>الطبقات المراد تضمينها بالملف</span>
                  </span>
                  <button
                    onClick={handleSelectAllLayers}
                    className="text-[11px] text-sky-400 hover:text-sky-300 transition-colors"
                  >
                    تحديد الكل
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {layers.map((lay) => {
                    const isChecked = selectedLayers.includes(lay.id);
                    return (
                      <label
                        key={lay.id}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-neutral-900 border-neutral-700 text-white'
                            : 'bg-neutral-950/40 border-neutral-800/80 text-neutral-500'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleLayer(lay.id)}
                          className="rounded text-sky-500 focus:ring-0"
                        />
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: lay.color }}
                        />
                        <span className="truncate">{lay.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* خيارات تفصيلية */}
              <div className="bg-neutral-950/60 p-4 rounded-xl border border-neutral-800 space-y-2.5">
                <span className="text-xs font-semibold text-neutral-200 block mb-1">
                  خيارات التصدير الهندسي
                </span>

                <label className="flex items-center gap-2.5 text-xs text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportWallsAsDoubleLines}
                    onChange={(e) => setExportWallsAsDoubleLines(e.target.checked)}
                    className="rounded text-sky-500"
                  />
                  <span>
                    تصدير الجدران كخطين متوازيين مع السماكة الحقيقية (Double Lines)
                  </span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeDimensions}
                    onChange={(e) => setIncludeDimensions(e.target.checked)}
                    className="rounded text-sky-500"
                  />
                  <span>تصدير خطوط ونصوص الأبعاد والقياسات (Dimensions)</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeSymbols}
                    onChange={(e) => setIncludeSymbols(e.target.checked)}
                    className="rounded text-sky-500"
                  />
                  <span>تصدير الرموز والفرش المعماري والأجهزة المنزلية (Furniture & MEP Symbols)</span>
                </label>

                <label className="flex items-center gap-2.5 text-xs text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeRoutes}
                    onChange={(e) => setIncludeRoutes(e.target.checked)}
                    className="rounded text-sky-500"
                  />
                  <span>تصدير مسارات الكابلات والأنابيب والمجاري الهوائية (Routes & Conduits)</span>
                </label>
              </div>

              {/* ملخص الكائنات المصدرة */}
              <div className="text-[11px] text-neutral-400 bg-neutral-950/40 p-2.5 rounded-lg border border-neutral-800 flex items-center justify-between">
                <span>إجمالي الكائنات في المخطط: {objects.length} عنصر</span>
                <span className="text-emerald-400">جاهز للتصدير المباشر بصيغة .dxf</span>
              </div>
            </>
          ) : (
            <>
              {/* قسم استيراد DXF */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-neutral-700 hover:border-emerald-500/70 bg-neutral-950/40 hover:bg-neutral-950/80 p-8 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-colors text-center"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".dxf"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <FileUp size={36} className="text-emerald-400 mb-2.5" />
                <h4 className="text-sm font-semibold text-neutral-200">
                  انقر هنا لاختيار ملف DXF من جهازك
                </h4>
                <p className="text-xs text-neutral-400 mt-1 max-w-sm">
                  يدعم ملفات ASCII DXF المصدرة من AutoCAD أو Revit أو Civil 3D أو أي برنامج CAD آخر
                </p>
              </div>

              {isParsing && (
                <div className="text-center py-4 text-xs text-sky-400 animate-pulse">
                  جاري قراءة وتحليل ملف الـ DXF...
                </div>
              )}

              {importError && (
                <div className="p-3 bg-rose-950/50 border border-rose-800 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0 text-rose-400" />
                  <span>{importError}</span>
                </div>
              )}

              {parseResult && (
                <div className="bg-neutral-950/60 p-4 rounded-xl border border-neutral-800 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                    <CheckCircle2 size={16} />
                    <span>تم تحليل ملف DXF بنجاح: {importFile?.name}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                    <div className="bg-neutral-900 p-2 rounded-lg border border-neutral-800">
                      <div className="text-neutral-400 text-[10px]">الخطوط (Lines)</div>
                      <div className="font-bold text-white text-sm font-mono-cad">
                        {parseResult.lines.length}
                      </div>
                    </div>
                    <div className="bg-neutral-900 p-2 rounded-lg border border-neutral-800">
                      <div className="text-neutral-400 text-[10px]">المسارات (Polylines)</div>
                      <div className="font-bold text-white text-sm font-mono-cad">
                        {parseResult.polylines.length}
                      </div>
                    </div>
                    <div className="bg-neutral-900 p-2 rounded-lg border border-neutral-800">
                      <div className="text-neutral-400 text-[10px]">النصوص (Texts)</div>
                      <div className="font-bold text-white text-sm font-mono-cad">
                        {parseResult.texts.length}
                      </div>
                    </div>
                    <div className="bg-neutral-900 p-2 rounded-lg border border-neutral-800">
                      <div className="text-neutral-400 text-[10px]">الدوائر (Circles)</div>
                      <div className="font-bold text-white text-sm font-mono-cad">
                        {parseResult.circles.length}
                      </div>
                    </div>
                  </div>

                  {/* خيار الاستبدال أو الدمج */}
                  <div className="pt-2 border-t border-neutral-800 flex items-center gap-4 text-xs">
                    <span className="text-neutral-400">طريقة الإدراج:</span>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        value="replace"
                        checked={importMode === 'replace'}
                        onChange={() => setImportMode('replace')}
                        className="text-emerald-500"
                      />
                      <span>استبدال المخطط الحالي</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="importMode"
                        value="merge"
                        checked={importMode === 'merge'}
                        onChange={() => setImportMode('merge')}
                        className="text-emerald-500"
                      />
                      <span>دمج مع المخطط الحالي</span>
                    </label>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* تذييل النافذة */}
        <div className="px-6 py-3.5 border-t border-neutral-800 bg-neutral-950/70 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            إلغاء
          </button>

          {activeTab === 'export' ? (
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold bg-sky-600 hover:bg-sky-500 text-white shadow-md shadow-sky-600/30 transition-all cursor-pointer"
            >
              <Download size={15} />
              <span>تنزيل ملف DXF الآن</span>
            </button>
          ) : (
            <button
              onClick={handleExecuteImport}
              disabled={!parseResult}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-bold transition-all ${
                parseResult
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 cursor-pointer'
                  : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
              }`}
            >
              <Upload size={15} />
              <span>استيراد إلى المخطط</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
