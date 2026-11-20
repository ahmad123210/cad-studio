/**
 * @file ScheduleBOQModal.tsx
 * @description جدول الرموز وحصر الكميات التلقائي (Automatic Legend & Bill of Quantities - المرحلة 5).
 * يجمع تلقائياً كافة الرموز الهندسية وأطوال المسارات والأنابيب والكابلات المصنفة حسب النوع والمادة،
 * مع حساب الأطوال الحقيقية بالمتر والتصدير الفوري كملف CSV / Excel.
 */

import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  Download,
  Copy,
  Check,
  Zap,
  Droplet,
  Wind,
  Flame,
  GitBranch,
  Layers,
  Building2,
  TableProperties,
  Sparkles,
} from 'lucide-react';
import { ProjectModel } from '../model/project.ts';
import { SymbolObject, RouteObject, WallObject, RouteKind } from '../model/types.ts';
import { getSymbolById, CATEGORIES_META } from '../symbols/registry.ts';
import { ROUTE_KINDS_META, calculateRoutePixelLength } from '../symbols/routes.ts';
import { SnapEngine } from '../engine/snap.ts';

interface ScheduleBOQModalProps {
  model: ProjectModel;
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'all' | 'symbols' | 'routes' | 'summary';

export const ScheduleBOQModal: React.FC<ScheduleBOQModalProps> = ({
  model,
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const projectMeta = model.getMeta();
  const pixelsPerMeter = projectMeta.scale || 50;
  const allObjects = model.getObjects();
  const layers = model.getLayers();

  // 1. تجميع الرموز الهندسية
  const symbols = allObjects.filter((o) => o.type === 'symbol') as SymbolObject[];
  const symbolsByKind: Record<
    string,
    {
      kind: string;
      count: number;
      labels: Set<string>;
      layers: Set<string>;
    }
  > = {};

  symbols.forEach((sym) => {
    if (!symbolsByKind[sym.symbolKind]) {
      symbolsByKind[sym.symbolKind] = {
        kind: sym.symbolKind,
        count: 0,
        labels: new Set(),
        layers: new Set(),
      };
    }
    symbolsByKind[sym.symbolKind].count += 1;
    if (sym.label) symbolsByKind[sym.symbolKind].labels.add(sym.label);
    const layer = layers.find((l) => l.id === sym.layerId);
    if (layer) symbolsByKind[sym.symbolKind].layers.add(layer.name);
  });

  const symbolSummaryList = Object.values(symbolsByKind).map((item) => {
    const def = getSymbolById(item.kind);
    return {
      ...item,
      def,
      categoryMeta: def ? CATEGORIES_META[def.category] : null,
    };
  });

  // 2. تجميع المسارات والكابلات والمواسير
  const routes = allObjects.filter((o) => o.type === 'route') as RouteObject[];
  const routesGrouped: Record<
    string,
    {
      routeKind: RouteKind;
      material: string;
      diameter: number;
      count: number;
      totalLengthMeters: number;
    }
  > = {};

  routes.forEach((route) => {
    const meta = ROUTE_KINDS_META[route.routeKind];
    const material = route.material || meta?.defaultMaterial || 'معياري';
    const diameter = route.diameter || meta?.defaultDiameter || 20;
    const groupKey = `${route.routeKind}_${material}_${diameter}`;

    const realLength =
      route.lengthCalculated ||
      calculateRoutePixelLength(route.points) / pixelsPerMeter;

    if (!routesGrouped[groupKey]) {
      routesGrouped[groupKey] = {
        routeKind: route.routeKind,
        material,
        diameter,
        count: 0,
        totalLengthMeters: 0,
      };
    }

    routesGrouped[groupKey].count += 1;
    routesGrouped[groupKey].totalLengthMeters += realLength;
  });

  const routesSummaryList = Object.values(routesGrouped);

  // 3. ملخص الجدران
  const walls = allObjects.filter((o) => o.type === 'wall') as WallObject[];
  const totalWallLengthMeters =
    walls.reduce((sum, w) => sum + SnapEngine.distance(w.start, w.end), 0) /
    pixelsPerMeter;

  // إجمالي أطوال المسارات كلها
  const totalAllRoutesLengthMeters = routesSummaryList.reduce(
    (sum, r) => sum + r.totalLengthMeters,
    0
  );

  // تصدير جدول الكميات كـ CSV مع UTF-8 BOM للدعم الكامل للغة العربية
  const handleExportCSV = () => {
    const bom = '\uFEFF';
    let csv = `${bom}جدول حصر الكميات والرموز الهندسية (BOQ) - مشروع ${projectMeta.name}\n`;
    csv += `التاريخ,${new Date().toLocaleDateString('ar-EG')}\n`;
    csv += `مقياس الرسم,${pixelsPerMeter.toFixed(2)} بكسل لكل متر\n\n`;

    // قسم الرموز
    csv += `--- جدول الرموز الهندسية (Symbols Schedule) ---\n`;
    csv += `الرقم,اسم الرمز,الرمز الإنجليزي,التخصص,الطبقة,العدد,تسميات توضيحية\n`;
    symbolSummaryList.forEach((s, idx) => {
      const catName = s.categoryMeta?.name || 'عام';
      const layerNames = Array.from(s.layers).join(' | ');
      const labels = Array.from(s.labels).join(' | ');
      csv += `${idx + 1},"${s.def?.name || s.kind}","${s.def?.nameEn || ''}","${catName}","${layerNames}",${s.count},"${labels}"\n`;
    });

    // قسم المسارات
    csv += `\n--- جدول أطوال المسارات والكابلات والأنابيب (Routes & Piping BOQ) ---\n`;
    csv += `الرقم,نوع المسار,المواصفة / المادة,المقاس / القطر,عدد الخطوط,إجمالي الطول الحقيقي (متر)\n`;
    routesSummaryList.forEach((r, idx) => {
      const meta = ROUTE_KINDS_META[r.routeKind];
      csv += `${idx + 1},"${meta?.name || r.routeKind}","${r.material}","${r.diameter} مم",${r.count},${r.totalLengthMeters.toFixed(2)}\n`;
    });

    // قسم الملخص العام
    csv += `\n--- الملخص العام للمشروع ---\n`;
    csv += `إجمالي عدد الجدران,${walls.length}\n`;
    csv += `إجمالي أطوال الجدران بالمتر,${totalWallLengthMeters.toFixed(2)} م\n`;
    csv += `إجمالي عدد الرموز الهندسية,${symbols.length}\n`;
    csv += `إجمالي أطوال شبكات ومسارات الكهروميكانيك,${totalAllRoutesLengthMeters.toFixed(2)} م\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `BOQ_${projectMeta.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyClipboard = async () => {
    let text = `جدول حصر الكميات والرموز - مشروع: ${projectMeta.name}\n\n`;
    text += `الرموز الهندسية:\n`;
    symbolSummaryList.forEach((s) => {
      text += `• ${s.def?.name || s.kind}: ${s.count} قطعة\n`;
    });
    text += `\nأطوال المسارات والأنابيب:\n`;
    routesSummaryList.forEach((r) => {
      const meta = ROUTE_KINDS_META[r.routeKind];
      text += `• ${meta?.name || r.routeKind} (${r.material} - ${r.diameter}مم): ${r.totalLengthMeters.toFixed(2)} متر (${r.count} خط)\n`;
    });
    text += `\nإجمالي أطوال المسارات: ${totalAllRoutesLengthMeters.toFixed(2)} م\n`;

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  const getRouteKindBadge = (kind: RouteKind) => {
    const meta = ROUTE_KINDS_META[kind];
    let icon = <GitBranch size={13} />;
    if (kind === 'electrical') icon = <Zap size={13} />;
    if (kind === 'water') icon = <Droplet size={13} />;
    if (kind === 'hvac') icon = <Wind size={13} />;
    if (kind === 'fire') icon = <Flame size={13} />;

    return (
      <span
        className="px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1.5 w-fit"
        style={{
          backgroundColor: `${meta?.defaultColor || '#888'}20`,
          color: meta?.defaultColor || '#fff',
        }}
      >
        {icon}
        <span>{meta?.name || kind}</span>
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs select-none p-4">
      <div className="w-full max-w-4xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-neutral-200 animate-in fade-in zoom-in-95 duration-150">
        {/* رأس النافذة */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <TableProperties size={22} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <span>جدول الرموز وحصر الكميات التلقائي (Schedule & BOQ)</span>
                <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full font-mono-cad">
                  حصر فوري
                </span>
              </h3>
              <p className="text-xs text-neutral-400">
                حصر دقيق وتلقائي لجميع الرموز وأطوال الأنابيب والكابلات بالمتر الحقيقي
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyClipboard}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 border border-neutral-700"
              title="نسخ الجدول كنص"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copied ? 'تم النسخ!' : 'نسخ النص'}</span>
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm shadow-emerald-600/30"
              title="تصدير جدول الكميات كملف Excel / CSV"
            >
              <Download size={14} />
              <span>تصدير Excel (CSV)</span>
            </button>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white transition-colors ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* كروت المؤشرات السريعة (KPIs) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-5 bg-neutral-950/40 border-b border-neutral-800/80">
          <div className="bg-neutral-900/80 p-3.5 rounded-xl border border-neutral-800 flex flex-col">
            <span className="text-xs text-neutral-400 font-medium">إجمالي الرموز (Symbols)</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-bold font-mono-cad text-amber-400">{symbols.length}</span>
              <span className="text-xs text-neutral-400">قطعة ({symbolSummaryList.length} أنواع)</span>
            </div>
          </div>

          <div className="bg-neutral-900/80 p-3.5 rounded-xl border border-neutral-800 flex flex-col">
            <span className="text-xs text-neutral-400 font-medium">أطوال المسارات (Routes)</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-bold font-mono-cad text-sky-400">
                {totalAllRoutesLengthMeters.toFixed(1)}
              </span>
              <span className="text-xs text-neutral-400">متر ({routes.length} خط)</span>
            </div>
          </div>

          <div className="bg-neutral-900/80 p-3.5 rounded-xl border border-neutral-800 flex flex-col">
            <span className="text-xs text-neutral-400 font-medium">مجموع الجدران (Walls)</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-bold font-mono-cad text-neutral-200">
                {totalWallLengthMeters.toFixed(1)}
              </span>
              <span className="text-xs text-neutral-400">متر ({walls.length} جدار)</span>
            </div>
          </div>

          <div className="bg-neutral-900/80 p-3.5 rounded-xl border border-neutral-800 flex flex-col">
            <span className="text-xs text-neutral-400 font-medium">مقياس المعايرة (Scale)</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-bold font-mono-cad text-emerald-400">
                {pixelsPerMeter.toFixed(0)}
              </span>
              <span className="text-xs text-neutral-400">px / متر</span>
            </div>
          </div>
        </div>

        {/* تبويبات التصفح */}
        <div className="px-6 py-2.5 border-b border-neutral-800 bg-neutral-900/60 flex items-center gap-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === 'all'
                ? 'bg-neutral-800 text-white border border-neutral-700'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            عرض الكل
          </button>
          <button
            onClick={() => setActiveTab('symbols')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'symbols'
                ? 'bg-neutral-800 text-white border border-neutral-700'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <Zap size={15} className="text-amber-400" />
            <span>جدول الرموز ({symbolSummaryList.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('routes')}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'routes'
                ? 'bg-neutral-800 text-white border border-neutral-700'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            <GitBranch size={15} className="text-sky-400" />
            <span>حصر المسارات والأنابيب ({routesSummaryList.length})</span>
          </button>
        </div>

        {/* محتوى الجداول التفاعلية */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6">
          {/* 1. جدول الرموز الهندسية */}
          {(activeTab === 'all' || activeTab === 'symbols') && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span>جدول الرموز الهندسية المعيارية (Symbols Legend)</span>
                </h4>
                <span className="text-xs text-neutral-300 font-mono-cad font-semibold bg-neutral-800/80 px-2.5 py-0.5 rounded-md border border-neutral-700">
                  إجمالي القطع: {symbols.length}
                </span>
              </div>

              {symbolSummaryList.length > 0 ? (
                <div className="overflow-x-auto border border-neutral-800 rounded-xl bg-neutral-950/40">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-neutral-900/90 text-neutral-300 font-bold border-b border-neutral-800 text-xs">
                      <tr>
                        <th className="py-3 px-3.5">الرمز</th>
                        <th className="py-3 px-3.5">اسم الرمز</th>
                        <th className="py-3 px-3.5">المصطلح الإنجليزي</th>
                        <th className="py-3 px-3.5">التخصص</th>
                        <th className="py-3 px-3.5">الطبقة</th>
                        <th className="py-3 px-3.5 text-center">الكمية</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60">
                      {symbolSummaryList.map((sym, idx) => (
                        <tr key={idx} className="hover:bg-neutral-800/30 transition-colors">
                          <td className="py-3 px-3.5">
                            <div
                              className="w-9 h-9 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center p-1"
                              style={{ color: sym.categoryMeta?.color || '#f59e0b' }}
                              dangerouslySetInnerHTML={{ __html: sym.def?.svgPreview || '' }}
                            />
                          </td>
                          <td className="py-3 px-3.5 font-bold text-white text-sm">
                            {sym.def?.name || sym.kind}
                          </td>
                          <td className="py-3 px-3.5 font-mono-cad text-neutral-400 text-xs">
                            {sym.def?.nameEn || '-'}
                          </td>
                          <td className="py-3 px-3.5">
                            {sym.categoryMeta && (
                              <span
                                className="px-2.5 py-1 rounded text-xs font-semibold"
                                style={{
                                  backgroundColor: `${sym.categoryMeta.color}15`,
                                  color: sym.categoryMeta.color,
                                }}
                              >
                                {sym.categoryMeta.name}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-neutral-300 text-xs">
                            {Array.from(sym.layers).join(', ') || '-'}
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            <span className="font-mono-cad font-bold text-sm text-amber-400 bg-amber-950/40 px-2.5 py-1 rounded border border-amber-800/60">
                              {sym.count}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-neutral-500 bg-neutral-950/40 rounded-xl border border-neutral-800">
                  <p className="text-sm">لم يتم إدراج رموز هندسية في المخطط بعد.</p>
                </div>
              )}
            </div>
          )}

          {/* 2. جدول أطوال المسارات والأنابيب والكابلات */}
          {(activeTab === 'all' || activeTab === 'routes') && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                  <span>حصر أطوال شبكات الكابلات والمواسير (Routes & Piping BOQ)</span>
                </h4>
                <span className="text-xs text-neutral-300 font-mono-cad font-semibold bg-neutral-800/80 px-2.5 py-0.5 rounded-md border border-neutral-700">
                  إجمالي الطول: {totalAllRoutesLengthMeters.toFixed(2)} م
                </span>
              </div>

              {routesSummaryList.length > 0 ? (
                <div className="overflow-x-auto border border-neutral-800 rounded-xl bg-neutral-950/40">
                  <table className="w-full text-right text-sm">
                    <thead className="bg-neutral-900/90 text-neutral-300 font-bold border-b border-neutral-800 text-xs">
                      <tr>
                        <th className="py-3 px-3.5">نوع الشبكة</th>
                        <th className="py-3 px-3.5">المواصفة / المادة</th>
                        <th className="py-3 px-3.5">القطر / المقاس</th>
                        <th className="py-3 px-3.5 text-center">عدد الخطوط</th>
                        <th className="py-3 px-3.5 text-left">إجمالي الطول الحقيقي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-800/60">
                      {routesSummaryList.map((r, idx) => (
                        <tr key={idx} className="hover:bg-neutral-800/30 transition-colors">
                          <td className="py-3 px-3.5">{getRouteKindBadge(r.routeKind)}</td>
                          <td className="py-3 px-3.5 font-semibold text-neutral-100">{r.material}</td>
                          <td className="py-3 px-3.5 font-mono-cad text-neutral-200 font-medium">
                            {r.diameter} مم
                          </td>
                          <td className="py-3 px-3.5 text-center font-mono-cad text-neutral-300 font-bold">
                            {r.count}
                          </td>
                          <td className="py-3 px-3.5 text-left">
                            <span className="font-mono-cad font-bold text-sm text-sky-400 bg-sky-950/40 px-3 py-1 rounded border border-sky-800/60">
                              {r.totalLengthMeters.toFixed(2)} م
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-neutral-500 bg-neutral-950/40 rounded-xl border border-neutral-800">
                  <p className="text-sm">
                    لا توجد مسارات مرسومة حالياً. استخدم أداة "مسار / كابل" لرسم شبكات الكهروميكانيك.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* تذييل النافذة */}
        <div className="px-6 py-3.5 border-t border-neutral-800 bg-neutral-950/80 flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>الأطوال محسوبة هندسياً بالمتر الحقيقي بناءً على مقياس رسم المخطط.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-medium transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
