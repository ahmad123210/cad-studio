import { test, expect } from '@playwright/test';
import { openFresh, emptyProject } from './helpers';

const wall = (id: string, sx: number, sy: number, ex: number, ey: number) => ({ id, type: 'wall', layerId: 'arch', start: { x: sx, y: sy }, end: { x: ex, y: ey }, thickness: 20 });
// مبنى 18م × 14م (المقياس 50 بكسل/م)
const objects = [wall('a', -450, -350, 450, -350), wall('b', 450, -350, 450, 350), wall('c', 450, 350, -450, 350), wall('d', -450, 350, -450, -350)];

test('print dialog: real scale auto-fit, warning when it does not fit, settings saved with the project', async ({ page }) => {
  await openFresh(page, { ...emptyProject(), objects });
  await page.keyboard.press('Control+e');
  const info = page.getByTestId('print-scale-info');
  await expect(info).toContainText(/يُطبع بمقياس 1:(125|150)/, { timeout: 15000 }); // A4 أفقي: أقرب مقياس معياري يتسع

  await page.getByTestId('print-scale').selectOption('50');
  await expect(info).toContainText('لا يتسع');
  await page.getByTestId('print-scale').selectOption('100');
  await page.getByTestId('paper-format').selectOption('a3');
  await expect(info).toContainText('يُطبع بمقياس 1:100');

  await page.getByTestId('north-angle').fill('30');
  await page.getByTestId('line-weights').locator('summary').click();
  await page.getByTestId('line-weights').locator('select').first().selectOption('0.5');
  await page.locator('button:has(svg.lucide-x)').first().click(); // إغلاق النافذة يحفظ الإعدادات

  await page.keyboard.press('Control+s');
  await page.waitForTimeout(300);
  const data = JSON.parse((await page.evaluate(() => localStorage.getItem('cad_project_proj_default')))!);
  expect(data.printSettings).toMatchObject({ paperFormat: 'a3', printScale: 100, northAngle: 30, lineWeights: { arch: 0.5 } });

  // إعادة الفتح تستعيد الإعدادات
  await page.keyboard.press('Control+e');
  await expect(page.getByTestId('print-scale')).toHaveValue('100');
  await expect(page.getByTestId('north-angle')).toHaveValue('30');
});
