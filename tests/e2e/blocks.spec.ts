import { test, expect } from '@playwright/test';
import { openFresh, savedObjects, emptyProject } from './helpers';

async function cmd(page: import('@playwright/test').Page, text: string) {
  await page.keyboard.press('/');
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}

test('insert a built-in kitchen block (with rotation), save a selection as a project block and reinsert it', async ({ page }) => {
  const { W } = await openFresh(page, emptyProject());
  await cmd(page, 'blocks');
  await expect(page.getByTestId('blocks-modal')).toBeVisible();
  await page.getByTestId('block-builtin_kitchen_l').click();
  await expect(page.getByTestId('blocks-modal')).toHaveCount(0);
  await cmd(page, '90');
  await page.mouse.click(...W(0, 0));
  await page.keyboard.press('Escape');
  let objs = await savedObjects(page);
  expect(objs.filter((o) => o.type === 'line')).toHaveLength(1);
  expect(objs.filter((o) => o.type === 'symbol')).toHaveLength(4);
  // دوران 90°: سطح العمل (3م أفقياً في الأصل) صار رأسياً
  const counter = objs.find((o) => o.type === 'line');
  const xs = counter.points.map((p: any) => p.x);
  const ys = counter.points.map((p: any) => p.y);
  expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(150, 0);
  expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(100, 0);

  // تحديد الكل وحفظه ككتلة
  await page.mouse.click(...W(300, 300));
  await page.keyboard.press('Control+a');
  await cmd(page, 'blocks');
  await page.getByTestId('block-name').fill('مطبخي');
  await page.getByTestId('save-block').click();
  await expect(page.getByText('كتل المشروع')).toBeVisible();
  await page.getByText('مطبخي').click();
  await page.mouse.click(...W(-300, -200));
  await page.keyboard.press('Escape');
  objs = await savedObjects(page);
  expect(objs.filter((o) => o.type === 'symbol')).toHaveLength(8);

  const raw = JSON.parse((await page.evaluate(() => localStorage.getItem('cad_project_proj_default')))!);
  expect(raw.blocks).toHaveLength(1);
  expect(raw.blocks[0].name).toBe('مطبخي');
});
