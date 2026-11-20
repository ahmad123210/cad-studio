import { test, expect } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { openFresh, gridProject } from './helpers';
import { SAMPLE_DXF } from '../fixtures/sampleDxf';

test('a project too big for localStorage saves to IndexedDB and reloads', async ({ page }) => {
  await openFresh(page);
  const file = path.join(os.tmpdir(), 'cad-big.json');
  const big = gridProject(8100); // ≈40k objects, ≈5 MB
  big.project.name = 'كبير';
  fs.writeFileSync(file, JSON.stringify(big));
  page.on('dialog', (d) => d.accept());
  await page.locator('input[type="file"][accept*="json"]').first().setInputFiles(file);
  await page.waitForTimeout(1500);
  await page.mouse.click(5, 300);
  await page.keyboard.press('Control+s');
  await page.waitForTimeout(2500);
  await page.reload();
  await expect(page.getByText('كبير').first()).toBeVisible({ timeout: 15000 });
  const n = await page.evaluate(
    () =>
      new Promise<number>((r) => {
        const q = indexedDB.open('cad-studio-db');
        q.onsuccess = () => {
          const t = q.result.transaction('projects').objectStore('projects').get('proj_default');
          t.onsuccess = () => r(t.result ? t.result.data.sheets[0].objects.length : 0);
        };
      })
  );
  expect(n).toBe(40500);
});

test('DXF import via the dialog creates walls, linework and text', async ({ page }) => {
  await openFresh(page);
  const file = path.join(os.tmpdir(), 'sample.dxf');
  fs.writeFileSync(file, SAMPLE_DXF);
  page.on('dialog', (d) => d.accept());
  await page.locator('button:has-text("DXF")').first().click();
  await page.locator('button', { hasText: 'استيراد ملف DXF خارجي' }).click();
  await page.locator('input[type="file"][accept*="dxf"]').first().setInputFiles(file);
  await expect(page.getByText('الكتل / الإدراجات')).toBeVisible();
  await page.locator('button', { hasText: 'استيراد إلى المخطط' }).first().click();
  await page.keyboard.press('Control+s');
  await page.waitForTimeout(400);
  const objs = await page.evaluate(() => JSON.parse(localStorage.getItem('cad_project_proj_default')!).objects);
  const c: Record<string, number> = {};
  objs.forEach((o: any) => (c[o.type] = (c[o.type] || 0) + 1));
  expect(c).toEqual({ wall: 2, line: 8, text: 1 });
});
