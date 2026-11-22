import { test, expect } from '@playwright/test';
import { openFresh, savedObjects, emptyProject } from './helpers';

async function cmd(page: import('@playwright/test').Page, text: string) {
  await page.keyboard.press('/');
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}

test('rectangle, circle, polygon and arc commands create linework (clicks and typed values)', async ({ page }) => {
  const { W } = await openFresh(page, emptyProject());
  // مستطيل: ركن بالنقر ثم الأبعاد بالمتر (المقياس 50 بكسل/م)
  await cmd(page, 'rec');
  await page.mouse.click(...W(-300, -200));
  await cmd(page, '4,2');
  // دائرة: مركز بالإحداثيات ونصف قطر بالمتر
  await cmd(page, 'c');
  await cmd(page, '2,2');
  await cmd(page, '1');
  // مضلع خماسي
  await cmd(page, 'pol');
  await cmd(page, '5');
  await cmd(page, '-4,2');
  await cmd(page, '1');
  // قوس بثلاث نقرات
  await cmd(page, 'arc');
  await page.mouse.click(...W(100, -200));
  await page.mouse.click(...W(150, -250));
  await page.mouse.click(...W(200, -200));

  const lines = (await savedObjects(page)).filter((o) => o.type === 'line');
  expect(lines).toHaveLength(4);
  const [rect, circle, poly, arc] = lines;
  expect(rect.closed).toBe(true);
  expect(rect.points).toHaveLength(4);
  const xs = rect.points.map((p: any) => p.x);
  const ys = rect.points.map((p: any) => p.y);
  expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(200, 0);
  expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(100, 0);

  expect(circle.points.length).toBe(72);
  circle.points.forEach((p: any) => expect(Math.hypot(p.x - 100, p.y - 100)).toBeCloseTo(50, 3));

  expect(poly.points).toHaveLength(5);
  expect(arc.closed).toBeFalsy();
  expect(arc.points.length).toBeGreaterThan(8);
});

test('shapes toolbar menu starts a shape command', async ({ page }) => {
  const { W } = await openFresh(page, emptyProject());
  await page.getByTestId('shapes-button').click();
  await page.getByTestId('shapes-menu').getByText('دائرة').click();
  await page.mouse.click(...W(0, 0));
  await page.mouse.click(...W(60, 0));
  const lines = (await savedObjects(page)).filter((o) => o.type === 'line');
  expect(lines).toHaveLength(1);
});
