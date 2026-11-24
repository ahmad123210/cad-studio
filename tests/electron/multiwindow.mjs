/**
 * اختبار نسخة سطح المكتب متعددة النوافذ (المرحلة 20) — يشغّل Electron الحقيقي عبر Playwright.
 * التشغيل: npx vite build && xvfb-run -a node tests/electron/multiwindow.mjs
 */
import { _electron as electron } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cad-mw-'));
const proj = (name) =>
  JSON.stringify({
    schemaVersion: 2,
    project: { name, unit: 'meter', scale: 50, createdAt: '2026-11-24' },
    layers: [{ id: 'arch', name: 'arch', visible: true, locked: false, color: '#fff' }],
    objects: [{ id: 'w1', type: 'wall', layerId: 'arch', start: { x: 0, y: 0 }, end: { x: 200, y: 0 }, thickness: 10 }],
  });
const A = path.join(tmp, 'a.cadproj');
const B = path.join(tmp, 'b.cadproj');
fs.writeFileSync(A, proj('مشروع أ'));
fs.writeFileSync(B, proj('مشروع ب'));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const app = await electron.launch({
  args: ['--no-sandbox', 'electron/main.cjs', A],
  env: { ...process.env, ELECTRON_DISABLE_SANDBOX: '1' },
});
const windowsInfo = () =>
  app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows().map((w) => ({ q: w.webContents.getURL().split('?')[1] || 'main', title: w.getTitle() }))
  );
const headerHas = (page, text) => page.evaluate((t) => (document.querySelector('header')?.textContent || '').includes(t), text);

try {
  const w1 = await app.firstWindow();
  await w1.waitForLoadState('domcontentloaded');
  await wait(2500);
  let info = await windowsInfo();
  assert.equal(info.length, 1);
  assert.match(info[0].title, /a\.cadproj/);
  assert.ok(await headerHas(w1, 'مشروع أ'), 'الملف المفتوح بالنقر المزدوج يظهر في النافذة الأولى');

  // نقر مزدوج على ملف آخر والبرنامج مفتوح ← نافذة ثانية مستقلة
  await app.evaluate(({ app }, f) => app.emit('second-instance', {}, ['CAD Studio.exe', f]), B);
  await wait(3500);
  info = await windowsInfo();
  assert.equal(info.length, 2);
  const w2 = app.windows().find((w) => w.url().includes('window=2'));
  assert.ok(w2, 'النافذة الثانية تحمل رقمها');
  assert.ok(await headerHas(w2, 'مشروع ب'));
  assert.ok(await headerHas(w1, 'مشروع أ'), 'النافذة الأولى لم تتغير');

  // فتح ملف مفتوح أصلاً ينشّط نافذته ولا يكررها
  await app.evaluate(({ app }, f) => app.emit('second-instance', {}, ['x', f]), A);
  await wait(1200);
  assert.equal((await windowsInfo()).length, 2);

  // «نافذة جديدة» من القائمة ← مشروع فارغ ثالث
  await app.evaluate(({ Menu }) => Menu.getApplicationMenu().items[0].submenu.items.find((i) => i.label === 'نافذة جديدة').click());
  await wait(2500);
  info = await windowsInfo();
  assert.equal(info.length, 3);
  assert.ok(info.some((i) => i.q === 'window=3' && /غير محفوظ/.test(i.title)));

  // حماية: نافذة لا تكتب فوق ملف مفتوح في نافذة أخرى
  const guard = await w2.evaluate((p) => window.electronAPI.saveProjectDirect({ project: { name: 'x' } }, p), A);
  assert.equal(guard.success, false);
  assert.equal(guard.error, 'FILE_OPEN_IN_OTHER_WINDOW');
  assert.equal(JSON.parse(fs.readFileSync(A, 'utf-8')).project.name, 'مشروع أ');

  // النوافذ الإضافية لا تغيّر «آخر مشروع» الذي تستعيده النافذة الرئيسية
  await w2.evaluate(() => {
    localStorage.setItem('probe', '1');
  });
  const active = await w1.evaluate(() => localStorage.getItem('cad_active_project_id'));
  assert.notEqual(active, 'proj_window_2');
  console.log('multi-window: OK', info);
} finally {
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.destroy())).catch(() => {});
  await app.close().catch(() => {});
  fs.rmSync(tmp, { recursive: true, force: true });
}
