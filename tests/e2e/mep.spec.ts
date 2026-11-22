import { test, expect } from '@playwright/test';
import { openFresh, savedObjects, emptyProject, byId } from './helpers';

const sym = (id: string, kind: string, x: number, y: number) => ({ id, type: 'symbol', layerId: 'arch', symbolKind: kind, x, y, rotation: 0 });
const wall = (id: string, sx: number, sy: number, ex: number, ey: number) => ({ id, type: 'wall', layerId: 'arch', start: { x: sx, y: sy }, end: { x: ex, y: ey }, thickness: 20 });

test('MEP window: auto circuits, panel schedule, custom load, plumbing totals and clashes', async ({ page }) => {
  const objects = [
    sym('db', 'panel_db', -300, -200),
    ...Array.from({ length: 6 }, (_, i) => sym(`l${i}`, 'light_ceiling', -250 + i * 80, -100)),
    ...Array.from({ length: 4 }, (_, i) => sym(`s${i}`, 'socket_single', -250 + i * 80, 100)),
    sym('ac', 'hvac_split_ac', 200, 0),
    sym('wc', 'furn_toilet_wc', 300, 200),
    sym('bs', 'furn_washbasin', 340, 200),
    wall('w', -400, 0, 400, 0),
    { id: 'd', type: 'door', layerId: 'arch', wallId: 'w', position: 0.25, width: 45, openDirection: 'inward_right' },
    { id: 'r', type: 'route', layerId: 'arch', routeKind: 'electrical', points: [{ x: -200, y: -50 }, { x: -200, y: 50 }], lengthCalculated: 0 },
  ];
  const { W } = await openFresh(page, { ...emptyProject(), objects });
  await page.getByTestId('open-mep').click();
  const modal = page.getByTestId('mep-modal');
  await expect(modal.getByTestId('mep-disclaimer')).toBeVisible();
  await modal.getByTestId('mep-auto').click();
  const sched = modal.getByTestId('panel-schedule');
  await expect(sched.locator('tbody tr')).toHaveCount(3); // إنارة، مقابس، مكيف
  await expect(sched.locator('tr[data-circuit="L1"]')).toContainText('240'); // 6 × 40 واط
  await expect(sched.locator('tr[data-circuit="P1"]')).toContainText('1800');
  await expect(modal.getByTestId('mep-summary')).toContainText('2.84'); // 240 + 4×200 + 1800 واط

  await modal.getByRole('button', { name: /المياه والصرف/ }).click();
  await expect(modal.getByTestId('plumb-summary')).toContainText('110 مم');
  await modal.getByRole('button', { name: /التعارضات/ }).click();
  await expect(modal.getByTestId('clashes-table')).toContainText('يعبر فتحة باب');
  await modal.getByLabel('إغلاق').click();

  // حمل مخصص للمكيف من خصائص الرمز
  await page.mouse.click(...W(200, 0));
  await expect(page.getByTestId('circuit-fields')).toBeVisible();
  await page.getByTestId('load-input').fill('2400');
  await page.getByTestId('load-input').press('Enter');
  const o = byId(await savedObjects(page));
  expect(o.ac.loadW).toBe(2400);
  expect(o.ac.circuitId).toBeTruthy();
  const raw = JSON.parse((await page.evaluate(() => localStorage.getItem('cad_project_proj_default')))!);
  expect(raw.mep.circuits.map((c: any) => c.name)).toEqual(['L1', 'S1', 'P1']);
});
