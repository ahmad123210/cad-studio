import { test, expect } from '@playwright/test';
import { openFresh, emptyProject } from './helpers';

const wall = (id: string, sx: number, sy: number, ex: number, ey: number, extra = {}) => ({ id, type: 'wall', layerId: 'arch', start: { x: sx, y: sy }, end: { x: ex, y: ey }, thickness: 20, ...extra });
// غرفة 12م × 8م محاورياً (المقياس 50) ← صافي 11.6 × 7.6 = 88.16 م²
const objects = [
  wall('a', -300, -200, 300, -200), wall('b', 300, -200, 300, 200), wall('c', 300, 200, -300, 200), wall('d', -300, 200, -300, -200),
  { id: 'w1', type: 'window', layerId: 'arch', wallId: 'a', position: 0.5, width: 60 },
  { id: 'r1', type: 'room', layerId: 'arch', x: 0, y: 0, name: 'صالة', floorType: 'رخام' },
];

async function saved(page: import('@playwright/test').Page) {
  await page.keyboard.press('Control+s');
  await page.waitForTimeout(300);
  return JSON.parse((await page.evaluate(() => localStorage.getItem('cad_project_proj_default')))!);
}

test('quantities window: computed lines, empty price/total until a unit price is entered, saved with the project', async ({ page }) => {
  await openFresh(page, { ...emptyProject(), objects });
  await page.getByText('جدول الكميات', { exact: false }).first().click();
  const modal = page.getByTestId('boq-modal');
  await expect(modal).toBeVisible();

  const row = (key: string) => modal.locator(`tr[data-boq-key="${key}"]`);
  await expect(row('floor:رخام').getByTestId('boq-qty')).toHaveText('88.16');
  // لياسة داخلية: 2×(11.6+7.6)×3 − شباك 1.2×1.2
  await expect(row('plaster:interior').getByTestId('boq-qty')).toHaveText('113.76');
  await expect(row('floor:رخام').getByTestId('boq-total')).toHaveText('');
  await expect(modal.getByTestId('boq-grand-total')).toHaveCount(0);

  await modal.getByLabel('سعر الوحدة: أرضيات رخام').fill('20');
  await modal.getByLabel('سعر الوحدة: أرضيات رخام').press('Enter');
  await expect(row('floor:رخام').getByTestId('boq-total')).toHaveText('1,763.20');
  await expect(modal.getByTestId('boq-grand-total')).toHaveText('1,763.20');

  // تغيير ارتفاع الجدران يعيد الحساب فوراً
  await modal.getByTestId('qs-wall-height').fill('3.5');
  await modal.getByTestId('qs-wall-height').press('Enter');
  await expect(row('plaster:interior').getByTestId('boq-qty')).toHaveText('132.96');

  await modal.getByTestId('qs-opening-tags').check();
  await modal.getByRole('button', { name: /الأبواب والشبابيك/ }).click();
  await expect(modal.getByTestId('openings-table')).toContainText('W1');

  await modal.getByLabel('إغلاق').click();
  const data = await saved(page);
  expect(data.quantities.prices['floor:رخام']).toBe(20);
  expect(data.quantities.wallHeight).toBe(3.5);
  expect(data.quantities.showOpeningTags).toBe(true);
});

test('fence tab shows per-segment detail', async ({ page }) => {
  const fence = [wall('f1', -400, -300, 400, -300, { wallKind: 'fence' }), wall('f2', 400, -300, 400, 300, { wallKind: 'fence', height: 3 })];
  await openFresh(page, { ...emptyProject(), objects: [...objects, ...fence] });
  await page.getByText('جدول الكميات', { exact: false }).first().click();
  const modal = page.getByTestId('boq-modal');
  await modal.getByRole('button', { name: /السور/ }).click();
  const t = modal.getByTestId('fence-table');
  await expect(t.locator('tbody tr')).toHaveCount(2);
  // الضلع الأول 16م × 2م (افتراضي) = 32 م² للوجه، والثاني 12م × 3م = 36
  await expect(t.locator('tbody tr').nth(0)).toContainText('32.00');
  await expect(t.locator('tbody tr').nth(1)).toContainText('36.00');
  await expect(t.locator('tfoot')).toContainText('136.00');
});
