import { test, expect, Page } from '@playwright/test';
import { openFresh, savedObjects, emptyProject } from './helpers';

const status = (page: Page) => page.locator('footer').first().innerText();

test('typed absolute, relative, polar and length input', async ({ page }) => {
  const { W } = await openFresh(page, emptyProject());
  await page.mouse.move(...W(300, 300));
  await page.keyboard.press('w');
  for (const t of ['-4,-2', '@6,0', '@4<90']) {
    await page.keyboard.type(t);
    await page.keyboard.press('Enter');
  }
  const walls = (await savedObjects(page)).map((o) => [o.start, o.end]);
  expect(walls).toEqual([
    [{ x: -200, y: -100 }, { x: 100, y: -100 }],
    [{ x: 100, y: -100 }, { x: 100, y: 100 }],
  ]);
});

test('F8 ortho keeps a skewed click on the axis', async ({ page }) => {
  const { W } = await openFresh(page, emptyProject());
  await page.keyboard.press('F8');
  await expect(page.locator('footer button:has-text("ORTHO")')).toHaveClass(/emerald/);
  await page.keyboard.press('w');
  await page.mouse.click(...W(-300, 200));
  await page.mouse.move(...W(-150, 260));
  await page.mouse.click(...W(-150, 260));
  const [w] = await savedObjects(page);
  expect(w.end.y).toBe(w.start.y);
});

test('intersection, perpendicular and tracking snaps are reported', async ({ page }) => {
  const { W } = await openFresh(page, emptyProject());
  await page.keyboard.press('w');
  for (const t of ['-4,-2', '@6,0']) {
    await page.keyboard.type(t);
    await page.keyboard.press('Enter');
  }
  await page.keyboard.press('Escape');
  await page.keyboard.press('w');
  for (const t of ['-1,-4', '@0,3']) {
    await page.keyboard.type(t);
    await page.keyboard.press('Enter');
  }
  await page.keyboard.press('Escape');
  await page.keyboard.press('w');
  await page.mouse.move(...W(-46, -96));
  await expect.poll(() => status(page)).toContain('تقاطع');
  await page.mouse.click(...W(-150, 60));
  await page.mouse.move(...W(-147, -96));
  await expect.poll(() => status(page)).toContain('عمودي');
  await page.keyboard.press('Escape');
  await page.keyboard.press('w');
  await page.mouse.move(...W(100, -100));
  await page.mouse.move(...W(320, -97));
  await expect.poll(() => status(page)).toContain('محاذاة');
});
