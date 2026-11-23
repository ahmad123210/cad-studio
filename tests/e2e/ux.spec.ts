import { test, expect } from '@playwright/test';
import { openFresh } from './helpers';

test('English UI: toggles direction and texts, persists after reload, restores Arabic', async ({ page }) => {
  await openFresh(page);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.getByTestId('lang-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByText('Project info panel').first()).toBeVisible();
  await expect(page.locator('input[aria-label="Command bar"]')).toBeVisible();

  // يبقى مترجماً بعد إعادة التحميل، وتُترجم النوافذ التي تُفتح لاحقاً
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await page.getByTestId('open-mep').click();
  await expect(page.getByTestId('mep-disclaimer')).toContainText('advisory');
  await page.getByTestId('mep-modal').locator('button:has(svg.lucide-x)').first().click();

  // الرجوع للعربية يعيد النصوص الأصلية دون إعادة تحميل
  await page.getByTestId('lang-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByText('لوحة معلومات المشروع').first()).toBeVisible();
  await expect(page.locator('input[aria-label="شريط الأوامر"]')).toBeVisible();
});

test('light theme recolours the interface panels, not only the canvas', async ({ page }) => {
  await openFresh(page);
  const header = page.locator('header').first();
  const bg = () => header.evaluate((el) => getComputedStyle(el).backgroundColor);
  const lum = (c: string) => {
    const m = c.match(/[\d.]+/g)!.map(Number);
    return c.startsWith('oklch') ? m[0] * (m[0] <= 1 ? 255 : 2.55) : (m[0] + m[1] + m[2]) / 3;
  };
  const dark = lum(await bg());
  await page.getByTestId('theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  // الألوان تنتقل بحركة قصيرة؛ ننتظر استقرارها
  await expect.poll(async () => lum(await bg()), { timeout: 3000 }).toBeGreaterThan(200);
  expect(dark).toBeLessThan(80);
  // لوحة جانبية بخلفية neutral-900 تصبح فاتحة
  const panel = page.locator('.bg-neutral-900').first();
  await expect.poll(async () => lum(await panel.evaluate((el) => getComputedStyle(el).backgroundColor)), { timeout: 3000 }).toBeGreaterThan(200);
});
