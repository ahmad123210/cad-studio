import type ExcelJS from 'exceljs';
import { getLang, t } from './index.ts';

const AR_RE = /[؀-ۿ]/;

/**
 * ملفات Excel تُبنى بالعربية؛ في الواجهة الإنجليزية تُترجم أسماء الأوراق والنصوص
 * والنصوص الحرفية داخل المعادلات (مثل معايير SUMIF) بنفس القاموس فتبقى المعادلات صحيحة،
 * ويُعاد اتجاه الأوراق إلى اليسار→اليمين.
 */
export function localizeWorkbook(wb: ExcelJS.Workbook): void {
  if (getLang() !== 'en') return;
  // أسماء الأوراق أولاً، ثم تُصحَّح الإشارات إليها داخل المعادلات ('الغرف'!C5 ← 'Rooms'!C5)
  const renamed = new Map<string, string>();
  wb.eachSheet((ws) => {
    if (AR_RE.test(ws.name)) {
      const next = t(ws.name).replace(/[\\/?*[\]:']/g, '-').slice(0, 31);
      renamed.set(ws.name, next);
      ws.name = next;
    }
  });
  const tq = (f: string) => {
    let out = f;
    for (const [from, to] of renamed) out = out.split(`'${from}'!`).join(`'${to}'!`);
    return out.replace(/"([^"]*[؀-ۿ][^"]*)"/g, (_m, x: string) => `"${t(x)}"`);
  };
  wb.eachSheet((ws) => {
    ws.views = (ws.views || []).map((v) => ({ ...v, rightToLeft: false }));
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell) => {
        const v = cell.value as unknown;
        if (typeof v === 'string') {
          if (AR_RE.test(v)) cell.value = t(v);
        } else if (v && typeof v === 'object' && 'formula' in (v as object)) {
          const fv = v as { formula: string; result?: unknown };
          if (AR_RE.test(fv.formula)) cell.value = { ...fv, formula: tq(fv.formula) } as ExcelJS.CellFormulaValue;
          // ملاحظة: المعادلة تُترجم كاملة، والنتيجة المخزنة تُعاد حسابها عند فتح الملف
        }
        const al = cell.alignment;
        if (al && (al.horizontal === 'right' || al.readingOrder === 'rtl')) {
          cell.alignment = { ...al, horizontal: al.horizontal === 'right' ? 'left' : al.horizontal, readingOrder: 'ltr' };
        }
      });
    });
  });
}

/** ترجمة ملف CSV نصي حقلاً بحقل. */
export function localizeCsv(csv: string): string {
  if (getLang() !== 'en') return csv;
  const bom = csv.startsWith('\uFEFF') ? '\uFEFF' : '';
  return bom + csv
    .replace(/^\uFEFF/, '')
    .split('\n')
    .map((line) => line.split(',').map((f) => (AR_RE.test(f) ? (f.startsWith('"') && f.endsWith('"') ? `"${t(f.slice(1, -1))}"` : t(f)) : f)).join(','))
    .join('\n');
}
