import { test, expect } from '@playwright/test';
import { openFresh, savedObjects, emptyProject } from './helpers';

const wall = (id: string, sx: number, sy: number, ex: number, ey: number) => ({ id, type: 'wall', layerId: 'arch', start: { x: sx, y: sy }, end: { x: ex, y: ey }, thickness: 20 });

test('trim and extend walls via the command bar', async ({ page }) => {
  const project = { ...emptyProject(), objects: [wall('a', -150, 0, 150, 0), wall('b1', -50, -100, -50, 100), wall('b2', 50, -100, 50, 100), wall('c', -150, 150, -80, 150), wall('d', 100, 120, 100, 220)] };
  const { W } = await openFresh(page, project);
  await page.keyboard.press('/');
  await page.keyboard.type('trim');
  await page.keyboard.press('Enter');
  await page.mouse.click(...W(0, 0)); // الجزء الأوسط من a بين b1 وb2
  await page.keyboard.press('Escape');
  await page.keyboard.press('/');
  await page.keyboard.type('تمديد');
  await page.keyboard.press('Enter');
  await page.mouse.click(...W(-85, 150)); // طرف c الأيمن ← حتى الجدار d عند x=100
  const objs = await savedObjects(page);
  const walls = objs.filter((o) => o.type === 'wall');
  expect(walls).toHaveLength(6);
  expect(walls.find((w) => w.id === 'a').end).toEqual({ x: -50, y: 0 });
  expect(walls.some((w) => w.start.x === 50 && w.end.x === 150 && w.start.y === 0)).toBe(true);
  expect(walls.find((w) => w.id === 'c').end).toEqual({ x: 100, y: 150 });
});

test('polar array of a selected symbol', async ({ page }) => {
  const sym = { id: 's', type: 'symbol', layerId: 'arch', symbolKind: 'light_ceiling', x: 100, y: 0, rotation: 0, scale: 1 };
  const { W } = await openFresh(page, { ...emptyProject(), objects: [sym] });
  await page.mouse.click(...W(100, 0));
  await page.keyboard.press('/');
  await page.keyboard.type('polar');
  await page.keyboard.press('Enter');
  await page.keyboard.type('0,0');
  await page.keyboard.press('Enter');
  await page.keyboard.type('4,360');
  await page.keyboard.press('Enter');
  const syms = (await savedObjects(page)).filter((o) => o.type === 'symbol');
  expect(syms).toHaveLength(4);
  const pts = syms.map((s) => [Math.round(s.x), Math.round(s.y)]).sort();
  expect(pts).toEqual([[-100, 0], [0, -100], [0, 100], [100, 0]].sort());
});
