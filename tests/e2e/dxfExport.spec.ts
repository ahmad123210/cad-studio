import { test, expect } from '@playwright/test';
import { openFresh, emptyProject } from './helpers';

const objects = [
  { id: 'w', type: 'wall', layerId: 'arch', start: { x: -200, y: 0 }, end: { x: 200, y: 0 }, thickness: 20 },
  { id: 's1', type: 'symbol', layerId: 'arch', symbolKind: 'socket_single', x: 0, y: -60, rotation: 90 },
  { id: 's2', type: 'symbol', layerId: 'arch', symbolKind: 'socket_single', x: 60, y: -60, rotation: 0, scale: 2 },
  { id: 'b', type: 'symbol', layerId: 'arch', symbolKind: 'furn_bed_double', x: -100, y: 100, rotation: 0 },
  { id: 'r', type: 'route', layerId: 'arch', routeKind: 'drainage', points: [{ x: 0, y: 50 }, { x: 100, y: 50 }], lengthCalculated: 0 },
  { id: 't', type: 'text', layerId: 'arch', text: 'صالة', x: 0, y: 150, fontSize: 16, color: '#fff', rotation: 0 },
];

async function download(page: import('@playwright/test').Page, version: string) {
  await page.getByTestId('open-dxf').click();
  await page.getByTestId('dxf-version').selectOption(version);
  const [d] = await Promise.all([page.waitForEvent('download'), page.getByTestId('dxf-export').click()]);
  const chunks: Buffer[] = [];
  for await (const c of await d.createReadStream()) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString('utf-8');
}

for (const version of ['R12', 'AC1015']) {
  test(`DXF ${version}: symbols as blocks with INSERTs, route linetypes, Arabic text escaped`, async ({ page }) => {
    await openFresh(page, { ...emptyProject(), objects });
    const dxf = await download(page, version);
    const lines = dxf.split(/\r\n/);
    const count = (code: string, value: string) => lines.filter((l, i) => i % 2 === 1 && l === value && lines[i - 1].trim() === code).length;
    expect(count('0', 'BLOCK')).toBeGreaterThanOrEqual(2);
    expect(count('2', 'SYM_SOCKET_SINGLE')).toBeGreaterThanOrEqual(3); // تعريف الكتلة + إدراجان
    expect(count('0', 'INSERT')).toBe(3);
    expect(count('6', 'DASHED')).toBe(1); // خط الصرف
    expect(dxf).toContain('\\U+0635\\U+0627\\U+0644\\U+0629'); // صالة
    expect(dxf).not.toMatch(/[؀-ۿ]/);
  });
}
