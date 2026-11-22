import { test, expect } from '@playwright/test';
import { openFresh, savedObjects, emptyProject } from './helpers';

const wall = (id: string, sx: number, sy: number, ex: number, ey: number, extra = {}) => ({ id, type: 'wall', layerId: 'arch', start: { x: sx, y: sy }, end: { x: ex, y: ey }, thickness: 20, ...extra });
// شقة صغيرة: 12م × 8م مقسومة بجدار فاصل إلى غرفتين (المقياس 50 بكسل/م)
const plan = () => [
  wall('a', -300, -200, 300, -200), wall('b', 300, -200, 300, 200), wall('c', 300, 200, -300, 200), wall('d', -300, 200, -300, -200),
  wall('p', 0, -200, 0, 200, { thickness: 10 }),
];

test('detect rooms adds labels with net area; label follows walls; rename + floor type', async ({ page }) => {
  const { W } = await openFresh(page, { ...emptyProject(), objects: plan() });
  await page.getByTestId('detect-rooms').click();
  let rooms = (await savedObjects(page)).filter((o) => o.type === 'room');
  expect(rooms).toHaveLength(2);

  // صافي الغرفة اليسرى: (300-10-5)×(400-20) بكسل = 5.7م × 7.6م = 43.32 م²
  const left = rooms.find((r) => r.x < 0)!;
  await page.mouse.click(...W(left.x, left.y));
  await expect(page.getByTestId('room-metrics')).toContainText('43.32 م²');

  await page.getByPlaceholder('مثال: صالة، غرفة نوم 1، مطبخ').fill('صالة');
  await page.getByPlaceholder('مثال: صالة، غرفة نوم 1، مطبخ').press('Enter');
  await page.getByTestId('room-floor-type').fill('بورسلان');
  await page.getByTestId('room-floor-type').press('Enter');
  rooms = (await savedObjects(page)).filter((o) => o.type === 'room');
  const named = rooms.find((r) => r.x < 0)!;
  expect(named.name).toBe('صالة');
  expect(named.floorType).toBe('بورسلان');

  // تشغيل الكشف مرة أخرى لا يكرر البطاقات
  await page.getByTestId('detect-rooms').click();
  await page.keyboard.press('Escape');
  expect((await savedObjects(page)).filter((o) => o.type === 'room')).toHaveLength(2);
});

test('fence walls and open rooms are not detected; rooms command via command bar', async ({ page }) => {
  const fence = [wall('f1', -500, -400, 500, -400, { wallKind: 'fence' }), wall('f2', 500, -400, 500, 400, { wallKind: 'fence' }), wall('f3', 500, 400, -500, 400, { wallKind: 'fence' }), wall('f4', -500, 400, -500, -400, { wallKind: 'fence' })];
  await openFresh(page, { ...emptyProject(), objects: [...plan(), ...fence] });
  await page.keyboard.press('/');
  await page.keyboard.type('rooms');
  await page.keyboard.press('Enter');
  expect((await savedObjects(page)).filter((o) => o.type === 'room')).toHaveLength(2);
});
