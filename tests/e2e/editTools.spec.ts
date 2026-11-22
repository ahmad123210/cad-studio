import { test, expect } from '@playwright/test';
import { openFresh, savedObjects, emptyProject, byId } from './helpers';

const wall = (id: string, sx: number, sy: number, ex: number, ey: number, extra = {}) => ({ id, type: 'wall', layerId: 'arch', start: { x: sx, y: sy }, end: { x: ex, y: ey }, thickness: 20, ...extra });
async function cmd(page: import('@playwright/test').Page, text: string) {
  await page.keyboard.press('/');
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}

test('fillet joins two walls at the corner; chamfer adds a diagonal wall', async ({ page }) => {
  const { W } = await openFresh(page, { ...emptyProject(), objects: [wall('a', -200, 0, 0, 0), wall('b', 60, 40, 60, 200), wall('c', -200, -100, 0, -100), wall('e', 100, -300, 100, -150)] });
  await cmd(page, 'f');
  await page.mouse.click(...W(-150, 0));
  await page.mouse.click(...W(60, 150));
  await cmd(page, 'cha');
  await cmd(page, '0.5');
  await page.mouse.click(...W(-150, -100));
  await page.mouse.click(...W(100, -200));
  await page.keyboard.press('Escape');
  const o = byId(await savedObjects(page));
  expect(o.a.end).toEqual({ x: 60, y: 0 });
  expect(o.b.start).toEqual({ x: 60, y: 0 });
  expect(o.c.end).toEqual({ x: 75, y: -100 }); // 0.5م = 25 بكسل قبل الركن (100,-100)
  const diag = Object.values(o).find((w: any) => w.type === 'wall' && !['a', 'b', 'c', 'e'].includes(w.id)) as any;
  expect(diag.start).toEqual({ x: 75, y: -100 });
  expect(diag.end).toEqual({ x: 100, y: -125 });
});

test('chain dimensions for a wall with a door; join via context menu; copy/paste properties', async ({ page }) => {
  const objects = [
    wall('a', -200, 0, 0, 0, { thickness: 30, height: 4 }),
    wall('b', 0, 0, 200, 0, { thickness: 30 }),
    { id: 'd', type: 'door', layerId: 'arch', wallId: 'b', position: 0.5, width: 45, openDirection: 'inward_right' },
    wall('z', -200, 150, 200, 150),
  ];
  const { W } = await openFresh(page, { ...emptyProject(), objects });
  await cmd(page, 'dch');
  await page.mouse.click(...W(100, 20));
  await page.keyboard.press('Escape');
  let objs = await savedObjects(page);
  const dims = objs.filter((x) => x.type === 'dimension').map((x) => Math.round(x.measuredLength)).sort((p, q) => p - q);
  expect(dims).toEqual([45, 78, 78, 200]); // (200-45)/2 = 77.5

  // نسخ خصائص الجدار a ولصقها على z
  await page.mouse.click(...W(-100, 0), { button: 'right' });
  await page.getByTestId('ctx-copy-props').click();
  await page.mouse.click(...W(0, 150));
  await page.mouse.click(...W(0, 150), { button: 'right' });
  await page.getByTestId('ctx-paste-props').click();
  objs = await savedObjects(page);
  expect(byId(objs).z).toMatchObject({ thickness: 30, height: 4 });

  // دمج a و b (على استقامة واحدة ومتلامسان) — الباب يبقى في مكانه
  await page.mouse.click(...W(-100, 0));
  await page.keyboard.down('Shift');
  await page.mouse.click(...W(150, 0));
  await page.keyboard.up('Shift');
  await page.mouse.click(...W(150, 0), { button: 'right' });
  await page.getByTestId('ctx-more-edit').getByText('دمج المحدد').click();
  objs = await savedObjects(page);
  const o = byId(objs);
  expect(o.b).toBeUndefined();
  expect(o.a.end).toEqual({ x: 200, y: 0 });
  expect(o.d.wallId).toBe('a');
  expect(o.d.position).toBeCloseTo(0.75, 5);
});

test('stretch moves only the vertices inside the window', async ({ page }) => {
  const { W } = await openFresh(page, { ...emptyProject(), objects: [wall('a', -200, 0, 0, 0), wall('b', 0, 0, 0, 150)] });
  await cmd(page, 'str');
  await page.mouse.click(...W(-30, -30));
  await page.mouse.click(...W(30, 30));
  await page.mouse.click(...W(0, 0));
  await cmd(page, '@1,0');
  const o = byId(await savedObjects(page));
  expect(o.a).toMatchObject({ start: { x: -200, y: 0 }, end: { x: 50, y: 0 } });
  expect(o.b).toMatchObject({ start: { x: 50, y: 0 }, end: { x: 0, y: 150 } });
});
