/**
 * @file ScheduleBOQModal.tsx
 * @description نافذة جدول الكميات: شاملة وبسيطة.
 *  - تبويب «جدول الكميات»: كل البنود مجمّعة حسب القسم مع سعر الوحدة والإجمالي (فارغان حتى يُدخل السعر)
 *  - تبويبات صغيرة للتفاصيل: الغرف، الأبواب والشبابيك، السور، جدول الرموز (مفتاح الرموز بأيقوناتها)
 *  - سطر إعدادات واحد: الارتفاعات الافتراضية ونسبة احتياط النزول العمودي وإظهار رموز D/W على المخطط
 * الحسابات كلها في model/quantities.ts (دالة صرفة مختبرة).
 */

import React, { useMemo, useState, useSyncExternalStore } from 'react';
import { X, Download, Copy, Check, TableProperties, LayoutGrid, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { ProjectModel } from '../model/project.ts';
import type { SymbolObject, QuantitySettings } from '../model/types.ts';
import { getSymbolById, CATEGORIES_META } from '../symbols/registry.ts';
import { ROUTE_KINDS_META } from '../symbols/routes.ts';
import { computeQuantities, lineTotal, BOQ_SECTION_TITLES, type BoqLine, type BoqSection, type QuantityReport } from '../model/quantities.ts';

interface ScheduleBOQModalProps {
  model: ProjectModel;
  isOpen: boolean;
  onClose: () => void;
  /** كشف الغرف في المحرك (يعيد عدد البطاقات المضافة) */
  onDetectRooms?: () => number;
  /** تصدير Excel بالمعادلات (يُحمَّل كسولاً) */
  onExportExcel?: (report: QuantityReport) => void;
}

type TabType = 'boq' | 'rooms' | 'openings' | 'fence' | 'symbols';

const fmt = (v: number, d = 2) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtQty = (l: BoqLine) => (l.unit === 'عدد' ? String(l.qty) : fmt(l.qty, l.unit === 'م³' ? 3 : 2));

/** اشتراك بإصدار النموذج لإعادة الحساب عند أي تعديل */
function useModelVersion(model: ProjectModel) {
  return useSyncExternalStore(
    (cb) => model.subscribe(() => cb()),
    () => model.getVersion()
  );
}

export function buildQuantityReport(model: ProjectModel): QuantityReport {
  return computeQuantities(model.getObjects(), {
    pixelsPerMeter: model.getMeta().scale || 50,
    settings: model.getQuantitySettings(),
    symbolName: (k) => getSymbolById(k)?.name || k,
    routeMeta: (k) => ROUTE_KINDS_META[k],
  });
}

const NumberSetting: React.FC<{ label: string; value: number; unit: string; step?: number; onCommit: (v: number) => void; testId?: string }> = ({ label, value, unit, step = 0.05, onCommit, testId }) => (
  <label className="flex items-center gap-1.5 text-xs text-neutral-300">
    <span>{label}</span>
    <input
      type="number"
      step={step}
      min={0}
      data-testid={testId}
      key={value}
      defaultValue={value}
      onBlur={(e) => {
        const v = parseFloat(e.target.value);
        if (Number.isFinite(v) && v >= 0 && v !== value) onCommit(v);
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className="w-16 bg-neutral-800 border border-neutral-700 rounded px-1.5 py-0.5 font-mono-cad text-center text-neutral-100 outline-none focus:border-emerald-500"
    />
    <span className="text-neutral-500">{unit}</span>
  </label>
);

const PriceInput: React.FC<{ line: BoqLine; price: number | undefined; onCommit: (v: number | undefined) => void }> = ({ line, price, onCommit }) => (
  <input
    type="number"
    min={0}
    step="any"
    inputMode="decimal"
    aria-label={`سعر الوحدة: ${line.name}`}
    key={`${line.key}:${price ?? ''}`}
    defaultValue={price ?? ''}
    onBlur={(e) => {
      const raw = e.target.value.trim();
      const v = raw === '' ? undefined : parseFloat(raw);
      if (v !== undefined && (!Number.isFinite(v) || v < 0)) return;
      if (v !== price) onCommit(v);
    }}
    onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    className="w-24 bg-transparent border border-neutral-700/70 hover:border-neutral-600 rounded px-1.5 py-0.5 font-mono-cad text-center text-neutral-100 outline-none focus:border-emerald-500 focus:bg-neutral-800"
  />
);

export const ScheduleBOQModal: React.FC<ScheduleBOQModalProps> = ({ model, isOpen, onClose, onDetectRooms, onExportExcel }) => {
  const [activeTab, setActiveTab] = useState<TabType>('boq');
  const [copied, setCopied] = useState(false);
  const version = useModelVersion(model);

  const report = useMemo(
    () => (isOpen ? buildQuantityReport(model) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOpen, version]
  );

  if (!isOpen || !report) return null;

  const settings = model.getQuantitySettings();
  const projectMeta = model.getMeta();
  const setSettings = (patch: Partial<QuantitySettings>) => model.setQuantitySettings(patch);
  const setPrice = (key: string, v: number | undefined) => {
    const prices = { ...settings.prices };
    if (v === undefined) delete prices[key];
    else prices[key] = v;
    setSettings({ prices });
  };

  const sections = (Object.keys(BOQ_SECTION_TITLES) as BoqSection[]).filter((s) => report.lines.some((l) => l.section === s));
  const grandTotal = report.lines.reduce((a, l) => a + (lineTotal(l, settings.prices) ?? 0), 0);
  const anyPrice = report.lines.some((l) => lineTotal(l, settings.prices) !== null);

  // مفتاح الرموز بأيقوناتها (الجدول السابق)
  const symbols = model.getObjects().filter((o) => o.type === 'symbol') as SymbolObject[];
  const legend = Object.values(
    symbols.reduce<Record<string, { kind: string; count: number }>>((acc, s) => {
      acc[s.symbolKind] = acc[s.symbolKind] || { kind: s.symbolKind, count: 0 };
      acc[s.symbolKind].count++;
      return acc;
    }, {})
  ).map((x) => ({ ...x, def: getSymbolById(x.kind) }));

  // ─── تصدير CSV ونسخ النص (بنفس محتوى الجدول) ───
  const handleExportCSV = () => {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    let csv = `﻿جدول الكميات - مشروع ${projectMeta.name}\nالتاريخ,${new Date().toLocaleDateString('ar-EG')}\n\n`;
    csv += 'الرقم,البند,الوحدة,الكمية,سعر الوحدة,الإجمالي,ملاحظة\n';
    let n = 0;
    for (const sec of sections) {
      csv += `${esc(BOQ_SECTION_TITLES[sec])}\n`;
      for (const l of report.lines.filter((x) => x.section === sec)) {
        const p = settings.prices[l.key];
        const t = lineTotal(l, settings.prices);
        csv += [++n, esc(l.name), esc(l.unit), l.qty, p ?? '', t ?? '', esc(l.note || '')].join(',') + '\n';
      }
    }
    if (anyPrice) csv += `,,,,${esc('المجموع')},${grandTotal.toFixed(2)}\n`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BOQ_${projectMeta.name.replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyClipboard = async () => {
    let text = `جدول الكميات - مشروع: ${projectMeta.name}\n`;
    for (const sec of sections) {
      text += `\n${BOQ_SECTION_TITLES[sec]}:\n`;
      for (const l of report.lines.filter((x) => x.section === sec)) text += `• ${l.name}: ${fmtQty(l)} ${l.unit}\n`;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* المتصفح رفض الوصول للحافظة */
    }
  };

  const tabs: { id: TabType; label: string; count?: number; show: boolean }[] = [
    { id: 'boq', label: 'جدول الكميات', show: true },
    { id: 'rooms', label: 'الغرف', count: report.rooms.length, show: true },
    { id: 'openings', label: 'الأبواب والشبابيك', count: report.openings.length, show: true },
    { id: 'fence', label: 'السور', count: report.fence.length, show: report.fence.length > 0 },
    { id: 'symbols', label: 'مفتاح الرموز', count: legend.length, show: true },
  ];

  const th = 'py-2 px-3 font-semibold';
  const td = 'py-2 px-3';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs select-none p-4" data-testid="boq-modal">
      <div className="w-full max-w-5xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-neutral-200 animate-in fade-in zoom-in-95 duration-150">
        {/* الرأس */}
        <div className="px-5 py-3.5 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <TableProperties size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">جدول الكميات</h3>
              <p className="text-[11px] text-neutral-400">
                {projectMeta.name} · مساحة الغرف {fmt(report.totals.floorArea)} م² · {report.totals.roomCount} غرفة
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCopyClipboard} className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-xs flex items-center gap-1.5 border border-neutral-700" title="نسخ الجدول كنص">
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copied ? 'تم النسخ!' : 'نسخ النص'}</span>
            </button>
            <button onClick={handleExportCSV} className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-xs flex items-center gap-1.5 border border-neutral-700" title="تصدير CSV">
              <Download size={14} />
              <span>CSV</span>
            </button>
            {onExportExcel && (
              <button
                data-testid="boq-export-excel"
                onClick={() => onExportExcel(report)}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5"
                title="تصدير Excel مع المعادلات"
              >
                <FileSpreadsheet size={14} />
                <span>Excel</span>
              </button>
            )}
            <button onClick={onClose} aria-label="إغلاق" className="w-8 h-8 rounded-lg hover:bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white ml-1">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* سطر الإعدادات */}
        <div className="px-5 py-2.5 border-b border-neutral-800 bg-neutral-950/40 flex flex-wrap items-center gap-x-5 gap-y-2">
          <NumberSetting testId="qs-wall-height" label="ارتفاع الجدران" unit="م" value={settings.wallHeight} onCommit={(v) => v > 0 && setSettings({ wallHeight: v })} />
          <NumberSetting label="ارتفاع الأبواب" unit="م" value={settings.doorHeight} onCommit={(v) => v > 0 && setSettings({ doorHeight: v })} />
          {report.fence.length > 0 && <NumberSetting label="ارتفاع السور" unit="م" value={settings.fenceHeight} onCommit={(v) => v > 0 && setSettings({ fenceHeight: v })} />}
          <NumberSetting label="احتياط النزول العمودي" unit="%" step={1} value={settings.routeAllowancePct} onCommit={(v) => setSettings({ routeAllowancePct: v })} />
          <label className="flex items-center gap-1.5 text-xs text-neutral-300 cursor-pointer">
            <input type="checkbox" data-testid="qs-opening-tags" checked={Boolean(settings.showOpeningTags)} onChange={(e) => setSettings({ showOpeningTags: e.target.checked })} className="accent-emerald-500" />
            <span>إظهار رموز D/W على المخطط</span>
          </label>
        </div>

        {/* التبويبات */}
        <div className="px-5 pt-2 border-b border-neutral-800 flex items-center gap-1 overflow-x-auto">
          {tabs.filter((t) => t.show).map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-t-lg border-b-2 whitespace-nowrap ${activeTab === t.id ? 'border-emerald-400 text-white bg-neutral-800/60' : 'border-transparent text-neutral-400 hover:text-white'}`}
            >
              {t.label}
              {t.count !== undefined && <span className="mr-1 text-neutral-500 font-mono-cad">({t.count})</span>}
            </button>
          ))}
        </div>

        <div className="p-5 overflow-y-auto flex-1 flex flex-col gap-4">
          {report.warnings.length > 0 && activeTab !== 'symbols' && (
            <div className="flex items-start gap-2 text-xs text-amber-200 bg-amber-950/30 border border-amber-800/50 rounded-lg px-3 py-2">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <div className="flex-1">{report.warnings.map((w) => <div key={w}>{w}</div>)}</div>
              {onDetectRooms && report.totals.unlabeledRooms > 0 && (
                <button onClick={() => onDetectRooms()} className="shrink-0 px-2.5 py-1 rounded-md bg-amber-600/30 hover:bg-amber-600/50 text-amber-100 flex items-center gap-1">
                  <LayoutGrid size={13} /> كشف الغرف
                </button>
              )}
            </div>
          )}

          {activeTab === 'boq' &&
            (report.lines.length === 0 ? (
              <div className="py-10 text-center text-neutral-500 text-sm">لا توجد عناصر للحصر بعد. ارسم الجدران والفتحات والرموز والمسارات.</div>
            ) : (
              <div className="overflow-x-auto border border-neutral-800 rounded-xl">
                <table className="w-full text-right text-sm" data-testid="boq-table">
                  <thead className="bg-neutral-900 text-neutral-400 text-xs border-b border-neutral-800">
                    <tr>
                      <th className={`${th} w-10 text-center`}>#</th>
                      <th className={th}>البند</th>
                      <th className={`${th} w-16 text-center`}>الوحدة</th>
                      <th className={`${th} w-24 text-center`}>الكمية</th>
                      <th className={`${th} w-28 text-center`}>سعر الوحدة</th>
                      <th className={`${th} w-28 text-center`}>الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let n = 0;
                      return sections.map((sec) => (
                        <React.Fragment key={sec}>
                          <tr className="bg-neutral-950/70">
                            <td colSpan={6} className="py-1.5 px-3 text-xs font-bold text-emerald-300">{BOQ_SECTION_TITLES[sec]}</td>
                          </tr>
                          {report.lines
                            .filter((l) => l.section === sec)
                            .map((l) => {
                              const total = lineTotal(l, settings.prices);
                              return (
                                <tr key={l.key} className="border-t border-neutral-800/60 hover:bg-neutral-800/25" data-boq-key={l.key}>
                                  <td className={`${td} text-center text-neutral-500 font-mono-cad text-xs`}>{++n}</td>
                                  <td className={td}>
                                    <div className="text-neutral-100">{l.name}</div>
                                    {l.note && <div className="text-[10px] text-neutral-500">{l.note}</div>}
                                  </td>
                                  <td className={`${td} text-center text-neutral-400 text-xs`}>{l.unit}</td>
                                  <td className={`${td} text-center font-mono-cad font-bold text-sky-300`} data-testid="boq-qty">{fmtQty(l)}</td>
                                  <td className={`${td} text-center`}>
                                    <PriceInput line={l} price={settings.prices[l.key]} onCommit={(v) => setPrice(l.key, v)} />
                                  </td>
                                  <td className={`${td} text-center font-mono-cad text-emerald-300`} data-testid="boq-total">{total === null ? '' : fmt(total)}</td>
                                </tr>
                              );
                            })}
                        </React.Fragment>
                      ));
                    })()}
                  </tbody>
                  {anyPrice && (
                    <tfoot>
                      <tr className="border-t-2 border-neutral-700 bg-neutral-950/70">
                        <td colSpan={5} className="py-2 px-3 font-bold text-left text-neutral-300">المجموع</td>
                        <td className="py-2 px-3 text-center font-mono-cad font-bold text-emerald-300" data-testid="boq-grand-total">{fmt(grandTotal)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            ))}

          {activeTab === 'rooms' && (
            <div className="flex flex-col gap-3">
              {onDetectRooms && (
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span>تُحسب المساحات من الوجه الداخلي للجدران. عدّل الاسم ونوع الأرضية من لوحة خصائص الغرفة.</span>
                  <button onClick={() => onDetectRooms()} className="px-2.5 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 flex items-center gap-1">
                    <LayoutGrid size={13} /> كشف الغرف
                  </button>
                </div>
              )}
              {report.rooms.length === 0 ? (
                <div className="py-8 text-center text-neutral-500 text-sm">لا توجد غرف مغلقة.</div>
              ) : (
                <table className="w-full text-right text-sm border border-neutral-800 rounded-xl overflow-hidden">
                  <thead className="bg-neutral-900 text-neutral-400 text-xs">
                    <tr>
                      <th className={th}>الغرفة</th>
                      <th className={th}>الأرضية</th>
                      <th className={`${th} text-center`}>المساحة (م²)</th>
                      <th className={`${th} text-center`}>المحيط (م)</th>
                      <th className={`${th} text-center`}>لياسة الجدران (م²)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rooms.map((r, i) => (
                      <tr key={r.id ?? i} className="border-t border-neutral-800/60">
                        <td className={`${td} ${r.id ? 'text-neutral-100' : 'text-amber-300'}`}>{r.name}</td>
                        <td className={`${td} text-neutral-300`}>{r.floorType || '—'}</td>
                        <td className={`${td} text-center font-mono-cad text-emerald-300`}>{fmt(r.area)}</td>
                        <td className={`${td} text-center font-mono-cad`}>{fmt(r.perimeter)}</td>
                        <td className={`${td} text-center font-mono-cad`}>{fmt(r.wallFinish)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'openings' &&
            (report.openings.length === 0 ? (
              <div className="py-8 text-center text-neutral-500 text-sm">لا توجد أبواب أو شبابيك.</div>
            ) : (
              <table className="w-full text-right text-sm border border-neutral-800 rounded-xl overflow-hidden" data-testid="openings-table">
                <thead className="bg-neutral-900 text-neutral-400 text-xs">
                  <tr>
                    <th className={`${th} text-center`}>الرمز</th>
                    <th className={th}>النوع</th>
                    <th className={`${th} text-center`}>العرض (سم)</th>
                    <th className={`${th} text-center`}>الارتفاع (سم)</th>
                    <th className={`${th} text-center`}>الجلسة (سم)</th>
                    <th className={`${th} text-center`}>العدد</th>
                  </tr>
                </thead>
                <tbody>
                  {report.openings.map((t) => (
                    <tr key={t.code} className="border-t border-neutral-800/60">
                      <td className={`${td} text-center font-mono-cad font-bold ${t.kind === 'door' ? 'text-amber-300' : 'text-teal-300'}`}>{t.code}</td>
                      <td className={td}>{t.kind === 'door' ? 'باب' : 'شباك'}</td>
                      <td className={`${td} text-center font-mono-cad`}>{t.widthCm}</td>
                      <td className={`${td} text-center font-mono-cad`}>{t.heightCm}</td>
                      <td className={`${td} text-center font-mono-cad`}>{t.sillCm ?? '—'}</td>
                      <td className={`${td} text-center font-mono-cad font-bold`}>{t.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}

          {activeTab === 'fence' && (
            <table className="w-full text-right text-sm border border-neutral-800 rounded-xl overflow-hidden" data-testid="fence-table">
              <thead className="bg-neutral-900 text-neutral-400 text-xs">
                <tr>
                  <th className={th}>الضلع</th>
                  <th className={`${th} text-center`}>الطول (م)</th>
                  <th className={`${th} text-center`}>الارتفاع (م)</th>
                  <th className={`${th} text-center`}>السماكة (م)</th>
                  <th className={`${th} text-center`}>البوابات (م²)</th>
                  <th className={`${th} text-center`}>صافي الوجه (م²)</th>
                  <th className={`${th} text-center`}>لياسة/دهان وجهين (م²)</th>
                  <th className={`${th} text-center`}>البناء (م³)</th>
                </tr>
              </thead>
              <tbody>
                {report.fence.map((f) => (
                  <tr key={f.id} className="border-t border-neutral-800/60">
                    <td className={td}>{f.label}</td>
                    <td className={`${td} text-center font-mono-cad`}>{fmt(f.length)}</td>
                    <td className={`${td} text-center font-mono-cad`}>{fmt(f.height)}</td>
                    <td className={`${td} text-center font-mono-cad`}>{fmt(f.thickness)}</td>
                    <td className={`${td} text-center font-mono-cad`}>{fmt(f.openings)}</td>
                    <td className={`${td} text-center font-mono-cad`}>{fmt(f.netFace)}</td>
                    <td className={`${td} text-center font-mono-cad text-sky-300`}>{fmt(2 * f.netFace)}</td>
                    <td className={`${td} text-center font-mono-cad`}>{fmt(f.volume, 3)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-neutral-700 bg-neutral-950/70 font-bold">
                  <td className={td}>المجموع</td>
                  <td className={`${td} text-center font-mono-cad`}>{fmt(report.fence.reduce((a, f) => a + f.length, 0))}</td>
                  <td colSpan={2} />
                  <td className={`${td} text-center font-mono-cad`}>{fmt(report.fence.reduce((a, f) => a + f.openings, 0))}</td>
                  <td className={`${td} text-center font-mono-cad`}>{fmt(report.fence.reduce((a, f) => a + f.netFace, 0))}</td>
                  <td className={`${td} text-center font-mono-cad text-sky-300`}>{fmt(2 * report.fence.reduce((a, f) => a + f.netFace, 0))}</td>
                  <td className={`${td} text-center font-mono-cad`}>{fmt(report.fence.reduce((a, f) => a + f.volume, 0), 3)}</td>
                </tr>
              </tfoot>
            </table>
          )}

          {activeTab === 'symbols' &&
            (legend.length === 0 ? (
              <div className="py-8 text-center text-neutral-500 text-sm">لم تُدرج رموز في المخطط بعد.</div>
            ) : (
              <table className="w-full text-right text-sm border border-neutral-800 rounded-xl overflow-hidden">
                <thead className="bg-neutral-900 text-neutral-400 text-xs">
                  <tr>
                    <th className={th}>الرمز</th>
                    <th className={th}>الاسم</th>
                    <th className={th}>التخصص</th>
                    <th className={`${th} text-center`}>العدد</th>
                  </tr>
                </thead>
                <tbody>
                  {legend.map((s) => {
                    const cat = s.def ? CATEGORIES_META[s.def.category] : null;
                    return (
                      <tr key={s.kind} className="border-t border-neutral-800/60">
                        <td className={td}>
                          <div className="w-9 h-9 rounded-lg bg-neutral-950 border border-neutral-800 flex items-center justify-center p-1" style={{ color: cat?.color || '#f59e0b' }} dangerouslySetInnerHTML={{ __html: s.def?.svgPreview || '' }} />
                        </td>
                        <td className={td}>
                          <div className="text-neutral-100">{s.def?.name || s.kind}</div>
                          <div className="text-[10px] text-neutral-500 font-mono-cad">{s.def?.nameEn}</div>
                        </td>
                        <td className={td}>{cat && <span className="text-xs" style={{ color: cat.color }}>{cat.name}</span>}</td>
                        <td className={`${td} text-center font-mono-cad font-bold text-amber-300`}>{s.count}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ))}
        </div>

        <div className="px-5 py-2.5 border-t border-neutral-800 bg-neutral-950/80 text-[11px] text-neutral-500 flex items-center justify-between">
          <span>الكميات محسوبة من المخطط مباشرة (المقياس {Math.round(projectMeta.scale || 50)} بكسل/م) وتتحدث مع كل تعديل. الأسعار تُحفظ مع المشروع.</span>
          <button onClick={onClose} className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs">إغلاق</button>
        </div>
      </div>
    </div>
  );
};
