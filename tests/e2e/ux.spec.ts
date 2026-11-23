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

test('Ctrl+K palette: Arabic search with hamza folding runs commands and opens windows', async ({ page }) => {
  await openFresh(page);
  await page.keyboard.press('Control+k');
  await expect(page.getByTestId('command-palette')).toBeVisible();
  // «اطوال» بدون همزة تجد «إظهار / إخفاء أطوال الجدران»، و«كميات» تجد جدول الكميات
  await page.getByTestId('palette-input').fill('كميات');
  await expect(page.getByTestId('palette-results').locator('button').first()).toContainText('جدول الكميات');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('command-palette')).toBeHidden();
  await expect(page.getByRole('heading', { name: 'جدول الكميات', level: 3 })).toBeVisible();
  await page.keyboard.press('Escape');

  // اسم إنجليزي مختصر لأمر رسم: rect يبدأ أمر المستطيل في شريط الأوامر
  await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
  await page.keyboard.press('Control+k');
  await page.getByTestId('palette-input').fill('rect');
  await page.keyboard.press('Enter');
  await expect(page.locator('form[data-tour="command-bar"]')).toContainText('مستطيل');
  await page.keyboard.press('Escape');

  // عند فتحه دون كتابة تظهر «المستخدمة مؤخراً»
  await page.keyboard.press('Control+k');
  await expect(page.getByTestId('palette-results')).toContainText('المستخدمة مؤخراً');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('command-palette')).toBeHidden();

  // مكتبة الرموز احتفظت باختصار: Ctrl+Shift+K
  await page.keyboard.press('Control+Shift+k');
  await expect(page.getByPlaceholder('بحث عن رمز...')).toBeVisible();
});

test('new project from the villa template is ready for quantities', async ({ page }) => {
  await openFresh(page);
  await page.getByRole('button', { name: /مشروع\s*جديد/ }).first().click();
  await expect(page.getByTestId('templates-modal')).toBeVisible();
  await page.getByTestId('template-villa').click();
  await page.getByRole('button', { name: 'تأكيد' }).click();
  await page.keyboard.press('Control+s');
  const read = () => page.evaluate(() => JSON.parse(localStorage.getItem('cad_project_proj_default') || '{}').objects || []);
  await expect.poll(async () => (await read()).filter((o: any) => o.type === 'room').length).toBe(9);
  const objs = await read();
  expect(objs.filter((o: any) => o.type === 'room')).toHaveLength(9);
  expect(objs.filter((o: any) => o.type === 'wall' && o.wallKind === 'fence')).toHaveLength(4);
  await page.locator('[data-tour="boq"]').click();
  await expect(page.getByText('بناء السور').first()).toBeVisible();
  await expect(page.getByText(/بلا بطاقة/)).toHaveCount(0);
});

test('onboarding tour walks through the steps and remembers completion', async ({ page }) => {
  await openFresh(page);
  // في المتصفح الآلي لا تبدأ تلقائياً؛ تُفتح من نافذة المساعدة
  await expect(page.getByTestId('onboarding-tour')).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event('cad:start-tour')));
  await expect(page.getByTestId('tour-title')).toHaveText('أهلاً بك في مخططاتي');
  for (let i = 0; i < 6; i++) await page.getByTestId('tour-next').click();
  await expect(page.getByTestId('tour-title')).toContainText('Ctrl+K');
  await page.getByTestId('tour-next').click();
  await expect(page.getByTestId('onboarding-tour')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('cad_tour_done'))).toBe('1');
});

test('desktop: recent files appear in New project and Ctrl+K, and open through the bridge', async ({ page }) => {
  await page.addInitScript(() => {
    const noop = () => () => {};
    (window as any).__opened = [];
    (window as any).electronAPI = {
      isElectron: true,
      platform: 'win32',
      saveProject: async () => ({ canceled: true }),
      saveProjectDirect: async () => ({ success: true }),
      getLastSavedPath: async () => null,
      setUnsavedChanges: () => {},
      onTriggerSaveAndClose: noop,
      responseSaveAndClose: () => {},
      closeWindow: async () => {},
      saveFile: async () => ({ canceled: true }),
      openFile: async () => ({ canceled: true }),
      getVersion: async () => '1.2.0',
      onMenuAction: noop,
      onFileOpened: noop,
      getRecentFiles: async () => [
        { path: 'D:\\plans\\villa.cadproj', name: 'villa.cadproj', exists: true },
        { path: 'D:\\old\\gone.cadproj', name: 'gone.cadproj', exists: false },
      ],
      openRecentFile: async (p: string) => (window as any).__opened.push(p),
      onRecentChanged: noop,
      setUiLang: (l: string) => ((window as any).__lang = l),
      checkForUpdates: async () => {},
    };
  });
  await openFresh(page);
  expect(await page.evaluate(() => (window as any).__lang)).toBe('ar');
  await page.getByRole('button', { name: /مشروع\s*جديد/ }).first().click();
  const recent = page.getByTestId('recent-files');
  await expect(recent).toContainText('villa.cadproj');
  await expect(recent.getByRole('button', { name: /gone\.cadproj/ })).toBeDisabled();
  await recent.getByRole('button', { name: /villa\.cadproj/ }).click();
  await expect(page.getByTestId('templates-modal')).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__opened)).toEqual(['D:\\plans\\villa.cadproj']);

  await page.keyboard.press('Control+k');
  await page.getByTestId('palette-input').fill('villa');
  await expect(page.getByTestId('palette-results')).toContainText('فتح ملف حديث: villa.cadproj');
  await page.getByTestId('palette-input').fill('تحديث');
  await expect(page.getByTestId('palette-results')).toContainText('التحقق من التحديثات');
  await page.keyboard.press('Escape');

  // تبديل اللغة يُبلغ العملية الرئيسية لتترجم القوائم والحوارات الأصلية
  await page.getByTestId('lang-toggle').click();
  await expect.poll(() => page.evaluate(() => (window as any).__lang)).toBe('en');
});
