import { test, expect } from '@playwright/test';
import { openFresh, savedObjects, byId } from './helpers';

test('opens saved, selects a wall and shows its properties', async ({ page }) => {
  const { W } = await openFresh(page);
  await expect(page.getByText('محفوظ', { exact: true })).toBeVisible();
  await page.mouse.click(...W(-100, 100));
  await expect(page.getByText('خصائص الجدار')).toBeVisible();
});

test('copy/paste remaps doors to pasted walls and undoes in one step', async ({ page }) => {
  const { W } = await openFresh(page);
  const before = await savedObjects(page);
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  const after = await savedObjects(page);
  const added = after.filter((o) => !before.some((b) => b.id === o.id));
  const walls = new Set(added.filter((o) => o.type === 'wall').map((o) => o.id));
  expect(added.filter((o) => o.type === 'door').every((d) => walls.has(d.wallId))).toBe(true);
  await page.mouse.click(...W(600, -300));
  await page.keyboard.press('Control+z');
  expect((await savedObjects(page)).length).toBe(before.length);
});

test('deleting a wall removes its door; undo restores both', async ({ page }) => {
  const { W } = await openFresh(page);
  await page.mouse.click(...W(-100, 100));
  await page.keyboard.press('Delete');
  let o = byId(await savedObjects(page));
  expect(o.wall_south).toBeUndefined();
  expect(o.door_main).toBeUndefined();
  await page.keyboard.press('Control+z');
  o = byId(await savedObjects(page));
  expect(o.wall_south && o.door_main).toBeTruthy();
});

test('dragging immediately after zooming a large drawing moves the wall', async ({ page }) => {
  const { gridProject } = await import('./helpers');
  const { W } = await openFresh(page, gridProject(750));
  await page.waitForTimeout(1200);
  await page.mouse.move(...W(0, 0));
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -120);
  for (let i = 0; i < 4; i++) await page.mouse.wheel(0, 120);
  await page.mouse.move(...W(150, 0));
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(...W(150, 5 * i));
  await page.mouse.up();
  await page.waitForTimeout(400);
  const w0 = byId(await savedObjects(page)).w0;
  expect(w0.start.y).toBeGreaterThan(30);
});
