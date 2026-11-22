/**
 * @file panelExcel.ts
 * @description تصدير جدول لوحة التوزيع إلى Excel (يُحمَّل كسولاً): الدوائر مع الحمل والتيار والقاطع والكابل
 * والطول وهبوط الجهد، والتيار بمعادلة من الحمل، ومجاميع الأطوار بمعادلات SUMIF.
 */
import ExcelJS from 'exceljs';
import type { ProjectModel } from '../../model/project.ts';
import { computeElectrical, CIRCUIT_KIND_NAMES } from '../../model/electrical.ts';

export async function buildPanelWorkbook(model: ProjectModel): Promise<ExcelJS.Workbook> {
  const mep = model.getMep();
  const rep = computeElectrical(model.getObjects(), mep, model.getMeta().scale || 50);
  const s = mep.settings;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('جدول اللوحة', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 5 }] });
  ws.columns = [12, 14, 9, 9, 12, 11, 11, 12, 13, 13, 26].map((width) => ({ width }));
  ws.mergeCells(1, 1, 1, 11);
  ws.getCell(1, 1).value = `جدول لوحة التوزيع — ${model.getMeta().name}`;
  ws.getCell(1, 1).font = { bold: true, size: 14 };
  ws.getCell(1, 1).alignment = { horizontal: 'center' };
  ws.mergeCells(2, 1, 2, 11);
  ws.getCell(2, 1).value = `استرشادي — التغذية ${s.supply === '3P' ? 'ثلاثي الطور 400 فولت' : 'أحادي الطور 230 فولت'}، معامل القدرة ${s.pf}، معامل الطلب ${s.demandFactor}`;
  ws.getCell(2, 1).alignment = { horizontal: 'center' };
  ws.getCell('A3').value = 'الجهد';
  ws.getCell('B3').value = s.voltage;
  ws.getCell('C3').value = 'معامل القدرة';
  ws.getCell('D3').value = s.pf;
  const head = ['الدائرة', 'النوع', 'الطور', 'النقاط', 'الحمل (واط)', 'التيار (أ)', 'القاطع (أ)', 'الكابل (مم²)', 'الطول (م)', 'هبوط الجهد %', 'ملاحظة'];
  const hr = ws.getRow(5);
  head.forEach((h, i) => {
    const c = hr.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } };
    c.alignment = { horizontal: 'center' };
  });
  let r = 6;
  for (const row of rep.rows) {
    const x = ws.getRow(r);
    x.values = [row.circuit.name, CIRCUIT_KIND_NAMES[row.circuit.kind], row.circuit.phase === '3P' ? 'ثلاثي' : row.circuit.phase, row.points, row.loadW];
    x.getCell(6).value = {
      formula: row.circuit.phase === '3P' ? `E${r}/(SQRT(3)*${s.voltage3P}*$D$3)` : `E${r}/($B$3*$D$3)`,
      result: row.ib,
    } as ExcelJS.CellFormulaValue;
    x.getCell(6).numFmt = '0.0';
    x.getCell(7).value = row.breaker;
    x.getCell(8).value = row.cable;
    x.getCell(9).value = row.lengthM ?? '';
    x.getCell(10).value = row.vdPct ?? '';
    x.getCell(11).value = row.note || '';
    r++;
  }
  const t = ws.getRow(r + 1);
  t.getCell(1).value = 'الحمل الموصول';
  t.getCell(5).value = { formula: `SUM(E6:E${r - 1})`, result: rep.summary.connectedW } as ExcelJS.CellFormulaValue;
  t.font = { bold: true };
  const p = ['L1', 'L2', 'L3'];
  p.forEach((ph, i) => {
    const row = ws.getRow(r + 2 + i);
    row.getCell(1).value = `الطور ${ph}`;
    row.getCell(5).value = { formula: `SUMIF(C6:C${r - 1},"${ph}",E6:E${r - 1})+SUMIF(C6:C${r - 1},"ثلاثي",E6:E${r - 1})/3`, result: rep.summary.phaseW[ph as 'L1'] } as ExcelJS.CellFormulaValue;
  });
  const d = ws.getRow(r + 6);
  d.getCell(1).value = 'حمل الطلب';
  d.getCell(5).value = { formula: `E${r + 1}*${s.demandFactor}`, result: rep.summary.demandW } as ExcelJS.CellFormulaValue;
  d.getCell(7).value = `القاطع الرئيسي المقترح: ${rep.summary.mainBreaker} أ`;
  d.font = { bold: true };
  return wb;
}

export async function downloadPanelExcel(model: ProjectModel): Promise<void> {
  const wb = await buildPanelWorkbook(model);
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `Panel_${model.getMeta().name.replace(/\s+/g, '_')}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
