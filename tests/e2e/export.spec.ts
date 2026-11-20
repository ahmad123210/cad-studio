import { test, expect } from '@playwright/test';
import { openFresh } from './helpers';

test('lazy export dialog loads and produces a PDF download', async ({ page }) => {
  await openFresh(page);
  await page.keyboard.press('Control+e');
  await expect(page.getByText('تصدير المخطط الهندسي وجداول الكميات', { exact: false })).toBeVisible({ timeout: 15000 });
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    page.locator('button', { hasText: 'PDF' }).filter({ hasNotText: 'CSV' }).last().click(),
  ]);
  // نتحقق من المحتوى الفعلي للملف (توقيع PDF) بدلاً من الاسم الذي يختلف حسب طريقة الحفظ في المتصفح
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c as Buffer);
  const buf = Buffer.concat(chunks);
  expect(buf.subarray(0, 4).toString()).toBe('%PDF');
  expect(buf.length).toBeGreaterThan(10_000);
});

test('fonts are bundled locally (no Google Fonts request)', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) external.push(r.url());
  });
  await openFresh(page);
  // الخطوط تُحمَّل حسب الحاجة (unicode-range)، لذا نطلب تحميلها ثم نتحقق أنها محلية
  const loaded = await page.evaluate(async () => {
    const a = await document.fonts.load('700 16px Cairo', 'مخطط');
    const b = await document.fonts.load('400 16px "JetBrains Mono"', '123');
    return a.length > 0 && b.length > 0;
  });
  expect(loaded).toBe(true);
  expect(external).toEqual([]);
});
