import { test, expect } from '@playwright/test';
import { openFresh, savedObjects, emptyProject, byId } from './helpers';

const sym = (id: string, x: number, y: number) => ({ id, type: 'symbol', layerId: 'arch', symbolKind: 'light_ceiling', x, y, rotation: 0, scale: 1 });

test('distribute via command bar and align via context menu', async ({ page }) => {
  const { W } = await openFresh(page, { ...emptyProject(), objects: [sym('a', -150, 0), sym('b', -100, 40), sym('c', 150, 80)] });
  await page.mouse.click(...W(0, 300)); // تركيز اللوحة
  await page.keyboard.press('Control+a');
  await page.keyboard.press('/');
  await page.keyboard.type('distributeh');
  await page.keyboard.press('Enter');
  let o = byId(await savedObjects(page));
  expect([o.a.x, o.b.x, o.c.x]).toEqual([-150, 0, 150]);

  await page.mouse.click(...W(0, 300));
  await page.keyboard.press('Control+a'); // savedObjects يضغط Esc فيلغي التحديد
  await page.mouse.click(...W(0, 40), { button: 'right' });
  await expect(page.getByText('عناصر محددة (3)')).toBeVisible();
  const bar = page.getByTestId('align-toolbar');
  await expect(bar).toBeVisible();
  await bar.getByRole('button', { name: 'محاذاة للأعلى' }).click();
  o = byId(await savedObjects(page));
  expect([o.a.y, o.b.y, o.c.y]).toEqual([0, 0, 0]);
});

test('trim a closed polyline opens it', async ({ page }) => {
  const sq = { id: 'sq', type: 'line', layerId: 'arch', closed: true, points: [{ x: -100, y: -100 }, { x: 100, y: -100 }, { x: 100, y: 100 }, { x: -100, y: 100 }] };
  const cut = { id: 'c', type: 'wall', layerId: 'arch', start: { x: 0, y: -200 }, end: { x: 0, y: 200 }, thickness: 10 };
  const { W } = await openFresh(page, { ...emptyProject(), objects: [sq, cut] });
  await page.keyboard.press('/');
  await page.keyboard.type('trim');
  await page.keyboard.press('Enter');
  await page.mouse.click(...W(100, 30)); // الضلع الأيمن
  const l = byId(await savedObjects(page)).sq;
  expect(l.closed).toBe(false);
  expect(l.points).toEqual([{ x: 0, y: 100 }, { x: -100, y: 100 }, { x: -100, y: -100 }, { x: 0, y: -100 }]);
});
