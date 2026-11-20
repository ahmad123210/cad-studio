import { test, expect } from '@playwright/test';
import { openFresh, savedObjects, byId, commandBarLabel } from './helpers';

test('move via context menu with typed displacement', async ({ page }) => {
  const { W } = await openFresh(page);
  await page.mouse.click(...W(-150, -30));
  await page.mouse.click(...W(-150, -30), { button: 'right' });
  await page.getByText('نقل بنقطة أساس', { exact: true }).click();
  await page.mouse.click(...W(-150, -100));
  await page.keyboard.type('@0,1');
  await page.keyboard.press('Enter');
  const w = byId(await savedObjects(page)).wall_west;
  expect(w.start.y).toBe(150); // wall_west: (-150,100)→(-150,-100) نُقل 1م (50px) للأسفل
});

test('command bar: typed command, Enter repeats, mirror with points', async ({ page }) => {
  const { W } = await openFresh(page);
  await page.mouse.click(...W(600, -300));
  await page.keyboard.press('/');
  await page.keyboard.type('جدار');
  await page.keyboard.press('Enter');
  expect(await commandBarLabel(page)).toBe('جدار:');
  await page.keyboard.press('Escape');
  await page.keyboard.press('Enter');
  expect(await commandBarLabel(page)).toBe('جدار:');
  await page.keyboard.press('Escape');
  const before = (await savedObjects(page)).filter((o) => o.type === 'wall').length;
  await page.mouse.click(...W(-120, 100));
  await page.keyboard.press('/');
  await page.keyboard.type('mi');
  await page.keyboard.press('Enter');
  await page.keyboard.type('0,5');
  await page.keyboard.press('Enter');
  await page.keyboard.type('@1,0');
  await page.keyboard.press('Enter');
  const after = (await savedObjects(page)).filter((o) => o.type === 'wall').length;
  expect(after).toBe(before + 1);
});

test('offset creates a parallel wall on the clicked side', async ({ page }) => {
  const { W } = await openFresh(page);
  await page.mouse.click(...W(150, 30));
  await page.mouse.click(...W(150, 30), { button: 'right' });
  await page.getByText('إزاحة متوازية للجدار', { exact: true }).click();
  await page.keyboard.type('0.5');
  await page.keyboard.press('Enter');
  await page.mouse.click(...W(100, 30));
  const walls = (await savedObjects(page)).filter((o) => o.type === 'wall');
  expect(walls.some((w) => w.start.x === 125 && w.end.x === 125)).toBe(true);
});
