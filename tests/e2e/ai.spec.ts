import { test, expect } from '@playwright/test';
import { openFresh } from './helpers';
import fs from 'node:fs';
import path from 'node:path';

const openChat = async (page: import('@playwright/test').Page) => {
  await page.keyboard.press('Control+k');
  await page.getByTestId('palette-input').fill('المساعد');
  await page.keyboard.press('Enter');
  await page.getByTestId('ai-tab-chat').click();
};
const ask = async (page: import('@playwright/test').Page, q: string) => {
  const input = page.getByPlaceholder('اسأل المساعد الهندسي (مثال: ما هو القاطع المناسب لمكيف 2 طن؟)');
  await input.fill(q);
  await input.press('Enter');
};

test('AI assistant falls back to the local analysis when no server answers', async ({ page }) => {
  await openFresh(page);
  await openChat(page);
  await expect(page.getByTestId('ai-server-status')).toContainText('التحليل المحلي');
  await ask(page, 'ما القاطع المناسب؟ كهرباء');
  await expect(page.getByTestId('ai-source-offline')).toContainText('تحليل محلي');
});

test('AI assistant uses the configured server with an access token; the key never leaves the server', async ({ page }) => {
  const seen: { token?: string; body?: any } = {};
  await page.route('https://ai.example.test/api/ai-status', (r) =>
    r.fulfill({ json: { available: true, model: 'gemini-test', tokenRequired: true, authorized: r.request().headers()['x-cad-access-token'] === 'team' } }),
  );
  await page.route('https://ai.example.test/api/ai-assistant', (r) => {
    seen.token = r.request().headers()['x-cad-access-token'];
    seen.body = r.request().postDataJSON();
    return r.fulfill({ json: { advice: 'رد من الخادم: قاطع 20 أمبير', model: 'gemini-test' } });
  });
  await openFresh(page);
  await openChat(page);
  await page.getByTestId('ai-server-toggle').click();
  await page.getByTestId('ai-server-url').fill('https://ai.example.test/');
  await page.getByTestId('ai-server-token').fill('team');
  await page.getByTestId('ai-server-save').click();
  await expect(page.getByTestId('ai-server-status')).toContainText('gemini-test');

  await ask(page, 'ما القاطع المناسب لمكيف 2 طن؟');
  await expect(page.getByText('رد من الخادم: قاطع 20 أمبير')).toBeVisible();
  await expect(page.getByTestId('ai-source-server')).toContainText('gemini-test');
  expect(seen.token).toBe('team');
  expect(seen.body.userPrompt).toBe('ما القاطع المناسب لمكيف 2 طن؟');
  expect(seen.body.lang).toBe('ar');
  // لا مفتاح في الطلب ولا في الإعداد المحفوظ
  expect(JSON.stringify(seen.body)).not.toMatch(/api[_-]?key/i);
  const stored = await page.evaluate(() => localStorage.getItem('cad_ai_server'));
  expect(JSON.parse(stored!)).toEqual({ url: 'https://ai.example.test/', token: 'team' });
});

test('the built app bundle contains no Gemini key or SDK', async () => {
  // كل ملفات الحزمة (بما فيها التي تُحمَّل عند الطلب) — نفس المجلد الذي يقدمه خادم الاختبار
  const dir = path.resolve('dist/assets');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js'));
  expect(files.length).toBeGreaterThan(3);
  for (const f of files) {
    const t = fs.readFileSync(path.join(dir, f), 'utf-8');
    expect(t, f).not.toContain('generativelanguage.googleapis.com');
    expect(t, f).not.toContain('GoogleGenAI');
    expect(t, f).not.toMatch(/AIza[0-9A-Za-z_-]{30,}/);
  }
});
