import { test, expect } from '@playwright/test';
import { openFresh, savedObjects, emptyProject } from './helpers';

async function cmd(page: import('@playwright/test').Page, text: string) {
  await page.keyboard.press('/');
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
}

test('columns: repeated placement and size input; properties edit', async ({ page }) => {
  const { W } = await openFresh(page, emptyProject());
  await cmd(page, 'col');
  await cmd(page, '0.4x0.6');
  await page.mouse.click(...W(-100, 0));
  await page.mouse.click(...W(100, 0));
  await page.keyboard.press('Escape');
  const cols = (await savedObjects(page)).filter((o) => o.type === 'column');
  expect(cols).toHaveLength(2);
  expect(cols[0].width).toBeCloseTo(20); // 0.4م × 50
  expect(cols[0].depth).toBeCloseTo(30);

  await page.mouse.click(...W(100, 0));
  await page.getByTestId('column-width').fill('0.5');
  await page.getByTestId('column-width').press('Enter');
  const c2 = (await savedObjects(page)).filter((o) => o.type === 'column').find((c) => c.x > 0);
  expect(c2.width).toBeCloseTo(25);
});

test('stairs: drawn by two points, step count shown, stretched by dragging a handle', async ({ page }) => {
  const { W } = await openFresh(page, emptyProject());
  await cmd(page, 'st');
  await page.mouse.click(...W(-140, 0));
  await page.mouse.click(...W(0, 0)); // 2.8م ← 10 درجات
  let st = (await savedObjects(page)).find((o) => o.type === 'stairs');
  expect(st).toBeTruthy();
  expect(st.width).toBeCloseTo(60);

  await page.mouse.click(...W(-70, 10));
  await expect(page.getByTestId('stairs-metrics')).toContainText('10');

  // تمطيط: سحب مقبض النهاية 2.8م إضافية ← 20 درجة
  await page.mouse.move(...W(0, 0));
  await page.mouse.down();
  await page.mouse.move(...W(70, 0), { steps: 5 });
  await page.mouse.move(...W(140, 0), { steps: 5 });
  await page.mouse.up();
  st = (await savedObjects(page)).find((o) => o.type === 'stairs');
  expect(st.end.x).toBeCloseTo(140, 0);
  await page.mouse.click(...W(0, 10));
  await expect(page.getByTestId('stairs-metrics')).toContainText('20');
});
