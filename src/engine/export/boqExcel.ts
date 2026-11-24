import { localizeWorkbook } from '../../i18n/workbook.ts';
/**
 * @file boqExcel.ts
 * @description تصدير جدول الكميات إلى Excel (.xlsx) مع بقاء المعادلات:
 *  - «جدول الكميات»: الإجمالي = الكمية × سعر الوحدة (فارغ إن لم يُدخل سعر)، مجموع لكل قسم، والمجموع الكلي
 *  - «الغرف»، «الأبواب والشبابيك» (مساحة الفتحة بمعادلة)، «السور» (صافي الوجه والوجهين والحجم بمعادلات)
 * يُحمَّل كسولاً (exceljs كبيرة) عند الضغط على زر Excel فقط.
 */

import { saveFileAs, safeFileName, FILE_TYPES } from '../../utils/saveFile.ts';
import ExcelJS from 'exceljs';
import type { QuantityReport, BoqSection } from '../../model/quantities.ts';
import { BOQ_SECTION_TITLES, lineTotal } from '../../model/quantities.ts';

const NUM = '#,##0.00';
const NUM3 = '#,##0.000';
const INT = '0';
const GREEN = 'FF0F766E';
const HEAD_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
const SEC_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6F4EA' } };
const TOTAL_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
const thin: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
};

function newSheet(wb: ExcelJS.Workbook, name: string, widths: number[]) {
  const ws = wb.addWorksheet(name, { views: [{ rightToLeft: true, state: 'frozen', ySplit: 4 }], pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ws.columns = widths.map((w) => ({ width: w }));
  return ws;
}

function title(ws: ExcelJS.Worksheet, text: string, sub: string, cols: number) {
  ws.mergeCells(1, 1, 1, cols);
  ws.mergeCells(2, 1, 2, cols);
  const t = ws.getCell(1, 1);
  t.value = text;
  t.font = { bold: true, size: 14, name: 'Arial' };
  t.alignment = { horizontal: 'center' };
  const s = ws.getCell(2, 1);
  s.value = sub;
  s.font = { size: 10, color: { argb: 'FF6B7280' }, name: 'Arial' };
  s.alignment = { horizontal: 'center' };
}

function header(ws: ExcelJS.Worksheet, row: number, labels: string[]) {
  const r = ws.getRow(row);
  labels.forEach((l, i) => {
    const c = r.getCell(i + 1);
    c.value = l;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Arial' };
    c.fill = HEAD_FILL;
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = thin;
  });
  r.height = 22;
}

const styleRow = (r: ExcelJS.Row, cols: number, fill?: ExcelJS.Fill, bold = false) => {
  for (let i = 1; i <= cols; i++) {
    const c = r.getCell(i);
    c.border = thin;
    c.font = { name: 'Arial', bold, ...(c.font || {}) };
    if (fill) c.fill = fill;
    if (i > 2) c.alignment = { horizontal: 'center', vertical: 'middle' };
  }
};

const ROOMS_SHEET = 'الغرف';
const OPENINGS_SHEET = 'الأبواب والشبابيك';
const FENCE_SHEET = 'السور';
const INPUT_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };

/**
 * روابط كميات جدول الكميات بأوراق التفصيل (المرحلة 20): تعديل ارتفاع السور أو نوع أرضية غرفة
 * في ورقتها يحدّث الكمية والإجمالي في «جدول الكميات». يُربط البند فقط إن طابقت المعادلة الكمية المحسوبة.
 */
export function boqQuantityLinks(report: QuantityReport): Map<string, string> {
  const links = new Map<string, { formula: string; value: number }>();
  const q = (name: string) => `'${name}'!`;
  if (report.rooms.length) {
    const last = 4 + report.rooms.length;
    const types = new Set(report.rooms.map((r) => r.floorType).filter(Boolean) as string[]);
    for (const t of types) {
      const value = report.rooms.filter((r) => r.floorType === t).reduce((a, r) => a + r.area, 0);
      links.set(`floor:${t}`, { formula: `SUMIF(${q(ROOMS_SHEET)}B5:B${last},"${t.replace(/"/g, '""')}",${q(ROOMS_SHEET)}C5:C${last})`, value });
    }
    links.set('plaster:interior', { formula: `${q(ROOMS_SHEET)}E${last + 1}`, value: report.rooms.reduce((a, r) => a + r.wallFinish, 0) });
  }
  report.openings.forEach((o, i) => {
    const key = o.kind === 'door' ? `door:${o.widthCm}x${o.heightCm}` : `window:${o.widthCm}x${o.heightCm}@${o.sillCm ?? 0}`;
    links.set(key, { formula: `${q(OPENINGS_SHEET)}F${5 + i}`, value: o.count });
  });
  if (report.fence.length) {
    const tot = 5 + report.fence.length;
    links.set('fence:length', { formula: `${q(FENCE_SHEET)}B${tot}`, value: report.fence.reduce((a, f) => a + f.length, 0) });
    links.set('fence:masonry', { formula: `${q(FENCE_SHEET)}H${tot}`, value: report.fence.reduce((a, f) => a + f.volume, 0) });
    const faces = report.fence.reduce((a, f) => a + 2 * f.netFace, 0);
    links.set('fence:plaster', { formula: `${q(FENCE_SHEET)}G${tot}`, value: faces });
    links.set('fence:paint', { formula: `${q(FENCE_SHEET)}G${tot}`, value: faces });
  }
  const out = new Map<string, string>();
  for (const l of report.lines) {
    const k = links.get(l.key);
    if (k && Math.abs(k.value - l.qty) <= 0.011 + Math.abs(l.qty) * 1e-6) out.set(l.key, k.formula);
  }
  return out;
}

export async function buildBoqWorkbook(report: QuantityReport, prices: Record<string, number>, projectName: string): Promise<ExcelJS.Workbook> {
  const links = boqQuantityLinks(report);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CAD Studio';
  // Excel يعيد حساب كل المعادلات عند الفتح (لا يعتمد على النتائج المخزنة)
  wb.calcProperties.fullCalcOnLoad = true;
  wb.created = new Date();
  const date = new Date().toLocaleDateString('ar-EG');

  // ─── 1) جدول الكميات ───
  const ws = newSheet(wb, 'جدول الكميات', [6, 46, 8, 13, 13, 15, 30]);
  title(ws, `جدول الكميات — ${projectName}`, `التاريخ: ${date}`, 7);
  header(ws, 4, ['#', 'البند', 'الوحدة', 'الكمية', 'سعر الوحدة', 'الإجمالي', 'ملاحظة']);
  let row = 5;
  let n = 0;
  const subtotalCells: string[] = [];
  const sections = (Object.keys(BOQ_SECTION_TITLES) as BoqSection[]).filter((s) => report.lines.some((l) => l.section === s));
  for (const sec of sections) {
    ws.mergeCells(row, 1, row, 7);
    const h = ws.getCell(row, 1);
    h.value = BOQ_SECTION_TITLES[sec];
    h.font = { bold: true, color: { argb: GREEN }, name: 'Arial' };
    h.fill = SEC_FILL;
    row++;
    const first = row;
    for (const l of report.lines.filter((x) => x.section === sec)) {
      const r = ws.getRow(row);
      r.getCell(1).value = ++n;
      r.getCell(2).value = l.name;
      r.getCell(3).value = l.unit;
      const link = links.get(l.key);
      // الكمية مرتبطة بورقة التفصيل إن وُجدت (معادلة)، وإلا رقم محسوب من المخطط
      r.getCell(4).value = link ? ({ formula: link, result: l.qty } as ExcelJS.CellFormulaValue) : l.qty;
      r.getCell(4).numFmt = l.unit === 'عدد' ? INT : l.unit === 'م³' ? NUM3 : NUM;
      const p = prices[l.key];
      if (typeof p === 'number') r.getCell(5).value = p;
      r.getCell(5).numFmt = NUM;
      // خلية السعر مدخل المستخدم: لون مميز وتحقق من أنها رقم موجب
      r.getCell(5).dataValidation = { type: 'decimal', operator: 'greaterThanOrEqual', formulae: [0], allowBlank: true, showErrorMessage: true, errorTitle: 'سعر غير صالح', error: 'أدخل رقماً موجباً' };
      r.getCell(5).protection = { locked: false };
      const t = lineTotal(l, prices);
      r.getCell(6).value = (t === null ? { formula: `IF(E${row}="","",D${row}*E${row})` } : { formula: `IF(E${row}="","",D${row}*E${row})`, result: t }) as ExcelJS.CellFormulaValue;
      r.getCell(6).numFmt = NUM;
      r.getCell(7).value = l.note || '';
      styleRow(r, 7);
      r.getCell(5).fill = INPUT_FILL;
      r.getCell(2).alignment = { horizontal: 'right', vertical: 'middle', wrapText: true };
      row++;
    }
    const sub = ws.getRow(row);
    ws.mergeCells(row, 1, row, 5);
    sub.getCell(1).value = `مجموع ${BOQ_SECTION_TITLES[sec]}`;
    sub.getCell(1).alignment = { horizontal: 'left' };
    const secTotal = report.lines.filter((x) => x.section === sec).reduce((a, l) => a + (lineTotal(l, prices) ?? 0), 0);
    // يبقى فارغاً ما دام لا توجد أسعار في القسم
    const sumExpr = `SUM(F${first}:F${row - 1})`;
    sub.getCell(6).value = { formula: `IF(${sumExpr}=0,"",${sumExpr})`, ...(secTotal ? { result: secTotal } : {}) } as ExcelJS.CellFormulaValue;
    sub.getCell(6).numFmt = NUM;
    styleRow(sub, 7, TOTAL_FILL, true);
    subtotalCells.push(`F${row}`);
    row += 2;
  }
  const g = ws.getRow(row);
  ws.mergeCells(row, 1, row, 5);
  g.getCell(1).value = 'المجموع الكلي';
  g.getCell(1).alignment = { horizontal: 'left' };
  const grand = report.lines.reduce((a, l) => a + (lineTotal(l, prices) ?? 0), 0);
  const grandExpr = subtotalCells.length ? `SUM(${subtotalCells.join(',')})` : '0';
  g.getCell(6).value = { formula: `IF(${grandExpr}=0,"",${grandExpr})`, ...(grand ? { result: grand } : {}) } as ExcelJS.CellFormulaValue;
  g.getCell(6).numFmt = NUM;
  styleRow(g, 7, { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } }, true);
  g.height = 22;
  // تكرار صف العناوين عند الطباعة، وملاحظة توضيحية
  ws.pageSetup.printTitlesRow = '4:4';
  const noteRow = row + 2;
  ws.mergeCells(noteRow, 1, noteRow, 7);
  const note = ws.getCell(noteRow, 1);
  note.value = 'أدخل أسعار الوحدات في الخلايا الملونة؛ الإجماليات معادلات تُحسب تلقائياً. الكميات المرتبطة بأوراق الغرف والأبواب والسور تتحدث عند تعديلها هناك.';
  note.font = { italic: true, size: 9, color: { argb: 'FF6B7280' }, name: 'Arial' };
  note.alignment = { wrapText: true, horizontal: 'right' };
  ws.getRow(noteRow).height = 30;

  // ─── 2) الغرف ───
  if (report.rooms.length) {
    const wr = newSheet(wb, ROOMS_SHEET, [26, 20, 14, 14, 18]);
    title(wr, 'جدول الغرف', projectName, 5);
    header(wr, 4, ['الغرفة', 'الأرضية', 'المساحة (م²)', 'المحيط (م)', 'لياسة الجدران (م²)']);
    let r = 5;
    for (const rm of report.rooms) {
      const x = wr.getRow(r++);
      x.values = [rm.name, rm.floorType || '—', rm.area, rm.perimeter, rm.wallFinish];
      [3, 4, 5].forEach((i) => (x.getCell(i).numFmt = NUM));
      styleRow(x, 5);
    }
    const t = wr.getRow(r);
    t.getCell(1).value = 'المجموع';
    t.getCell(3).value = { formula: `SUM(C5:C${r - 1})`, result: report.rooms.reduce((a, x) => a + x.area, 0) } as ExcelJS.CellFormulaValue;
    t.getCell(5).value = { formula: `SUM(E5:E${r - 1})`, result: report.rooms.reduce((a, x) => a + x.wallFinish, 0) } as ExcelJS.CellFormulaValue;
    [3, 5].forEach((i) => (t.getCell(i).numFmt = NUM));
    styleRow(t, 5, TOTAL_FILL, true);
  }

  // ─── 3) الأبواب والشبابيك ───
  if (report.openings.length) {
    const wo = newSheet(wb, OPENINGS_SHEET, [9, 10, 13, 13, 12, 9, 16, 16]);
    title(wo, 'جدول الأبواب والشبابيك', projectName, 8);
    header(wo, 4, ['الرمز', 'النوع', 'العرض (سم)', 'الارتفاع (سم)', 'الجلسة (سم)', 'العدد', 'مساحة الواحد (م²)', 'المساحة الكلية (م²)']);
    let r = 5;
    for (const t of report.openings) {
      const x = wo.getRow(r);
      x.values = [t.code, t.kind === 'door' ? 'باب' : 'شباك', t.widthCm, t.heightCm, t.sillCm ?? '—', t.count];
      const unitArea = (t.widthCm * t.heightCm) / 10000;
      x.getCell(7).value = { formula: `C${r}*D${r}/10000`, result: unitArea } as ExcelJS.CellFormulaValue;
      x.getCell(8).value = { formula: `G${r}*F${r}`, result: unitArea * t.count } as ExcelJS.CellFormulaValue;
      [7, 8].forEach((i) => (x.getCell(i).numFmt = NUM));
      styleRow(x, 8);
      x.getCell(1).font = { bold: true, name: 'Arial', color: { argb: t.kind === 'door' ? 'FFB45309' : 'FF0F766E' } };
      r++;
    }
    const tt = wo.getRow(r);
    tt.getCell(1).value = 'المجموع';
    tt.getCell(6).value = { formula: `SUM(F5:F${r - 1})`, result: report.openings.reduce((a, t) => a + t.count, 0) } as ExcelJS.CellFormulaValue;
    tt.getCell(8).value = { formula: `SUM(H5:H${r - 1})`, result: report.openings.reduce((a, t) => a + (t.widthCm * t.heightCm * t.count) / 10000, 0) } as ExcelJS.CellFormulaValue;
    tt.getCell(8).numFmt = NUM;
    styleRow(tt, 8, TOTAL_FILL, true);
  }

  // ─── 4) السور ───
  if (report.fence.length) {
    const wf = newSheet(wb, FENCE_SHEET, [14, 11, 11, 11, 13, 15, 18, 13]);
    title(wf, 'السور الخارجي — تفصيلي', `${projectName} · عدّل الارتفاع أو الطول وستتحدث الكميات تلقائياً`, 8);
    header(wf, 4, ['الضلع', 'الطول (م)', 'الارتفاع (م)', 'السماكة (م)', 'البوابات (م²)', 'صافي الوجه (م²)', 'لياسة/دهان وجهين (م²)', 'البناء (م³)']);
    let r = 5;
    for (const f of report.fence) {
      const x = wf.getRow(r);
      x.values = [f.label, f.length, f.height, f.thickness, f.openings];
      x.getCell(6).value = { formula: `MAX(0,B${r}*C${r}-E${r})`, result: f.netFace } as ExcelJS.CellFormulaValue;
      x.getCell(7).value = { formula: `2*F${r}`, result: 2 * f.netFace } as ExcelJS.CellFormulaValue;
      x.getCell(8).value = { formula: `F${r}*D${r}`, result: f.volume } as ExcelJS.CellFormulaValue;
      [2, 3, 4, 5, 6, 7].forEach((i) => (x.getCell(i).numFmt = NUM));
      x.getCell(8).numFmt = NUM3;
      styleRow(x, 8);
      r++;
    }
    const tt = wf.getRow(r);
    tt.getCell(1).value = 'المجموع';
    const sum = (col: string, res: number) => ({ formula: `SUM(${col}5:${col}${r - 1})`, result: res }) as ExcelJS.CellFormulaValue;
    tt.getCell(2).value = sum('B', report.fence.reduce((a, f) => a + f.length, 0));
    tt.getCell(5).value = sum('E', report.fence.reduce((a, f) => a + f.openings, 0));
    tt.getCell(6).value = sum('F', report.fence.reduce((a, f) => a + f.netFace, 0));
    tt.getCell(7).value = sum('G', report.fence.reduce((a, f) => a + 2 * f.netFace, 0));
    tt.getCell(8).value = sum('H', report.fence.reduce((a, f) => a + f.volume, 0));
    [2, 5, 6, 7].forEach((i) => (tt.getCell(i).numFmt = NUM));
    tt.getCell(8).numFmt = NUM3;
    styleRow(tt, 8, TOTAL_FILL, true);
  }

  return wb;
}

export async function downloadBoqExcel(report: QuantityReport, prices: Record<string, number>, projectName: string): Promise<void> {
  const wb = await buildBoqWorkbook(report, prices, projectName);
  localizeWorkbook(wb);
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: FILE_TYPES.xlsx.mime });
  await saveFileAs(blob, `BOQ_${safeFileName(projectName).replace(/\s+/g, '_')}.xlsx`, FILE_TYPES.xlsx);
}
