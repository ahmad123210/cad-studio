import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildBoqWorkbook } from '../../src/engine/export/boqExcel.ts';
import { computeQuantities } from '../../src/model/quantities.ts';
import { DEFAULT_QUANTITY_SETTINGS } from '../../src/model/quantitySettings.ts';
import type { ProjectObject } from '../../src/model/types.ts';

const W = (id: string, sx: number, sy: number, ex: number, ey: number, extra: Record<string, unknown> = {}) =>
  ({ id, type: 'wall', layerId: 'arch', start: { x: sx, y: sy }, end: { x: ex, y: ey }, thickness: 20, ...extra }) as unknown as ProjectObject;

describe('BOQ Excel export', () => {
  it('writes formulas for totals, subtotals, openings and fence, and round-trips as xlsx', async () => {
    const objs = [
      W('a', 0, 0, 500, 0), W('b', 500, 0, 500, 400), W('c', 500, 400, 0, 400), W('d', 0, 400, 0, 0),
      { id: 'w', type: 'window', layerId: 'arch', wallId: 'a', position: 0.5, width: 120 },
      W('f', -300, -300, 900, -300, { wallKind: 'fence' }),
    ] as unknown as ProjectObject[];
    const report = computeQuantities(objs, { pixelsPerMeter: 100, settings: DEFAULT_QUANTITY_SETTINGS });
    const wb = await buildBoqWorkbook(report, { 'plaster:ceiling': 4 }, 'اختبار');
    const buf = await wb.xlsx.writeBuffer();

    const back = new ExcelJS.Workbook();
    await back.xlsx.load(buf as ArrayBuffer);
    expect(back.worksheets.map((s) => s.name)).toEqual(['جدول الكميات', 'الغرف', 'الأبواب والشبابيك', 'السور']);

    const boq = back.getWorksheet('جدول الكميات')!;
    expect(boq.views[0].rightToLeft).toBe(true);
    let ceilingRow = 0;
    boq.eachRow((row, i) => {
      if (row.getCell(2).value === 'لياسة أسقف') ceilingRow = i;
    });
    expect(ceilingRow).toBeGreaterThan(0);
    const total = boq.getCell(`F${ceilingRow}`).value as ExcelJS.CellFormulaValue;
    expect(total.formula).toBe(`IF(E${ceilingRow}="","",D${ceilingRow}*E${ceilingRow})`);
    expect(total.result).toBeCloseTo(4 * 18.24, 2);
    // بند بلا سعر: خانة السعر فارغة والإجمالي معادلة نتيجتها فارغة
    const interior = ceilingRow - 1;
    expect(boq.getCell(`E${interior}`).value).toBeNull();
    expect((boq.getCell(`F${interior}`).value as ExcelJS.CellFormulaValue).formula).toContain('IF(E');
    expect((boq.getCell(`F${interior}`).value as ExcelJS.CellFormulaValue).result ?? '').toBe('');

    const fence = back.getWorksheet('السور')!;
    expect((fence.getCell('F5').value as ExcelJS.CellFormulaValue).formula).toBe('MAX(0,B5*C5-E5)');
    expect((fence.getCell('H5').value as ExcelJS.CellFormulaValue).formula).toBe('F5*D5');
    const op = back.getWorksheet('الأبواب والشبابيك')!;
    expect(op.getCell('A5').value).toBe('W1');
    expect((op.getCell('H5').value as ExcelJS.CellFormulaValue).formula).toBe('G5*F5');
  });
});
