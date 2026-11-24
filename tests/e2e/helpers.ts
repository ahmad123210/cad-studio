import { Page, expect } from '@playwright/test';

/** يفتح التطبيق بمشروع العينة الافتراضي (ذاكرة نظيفة) ويعيد دالة تحويل إحداثيات العالم إلى الشاشة */
export async function openFresh(page: Page, project?: unknown) {
  // نافذة حفظ النظام (File System Access) تفتح حواراً أصلياً لا يمكن أتمتته: الاختبارات تتبع مسار التنزيل
  await page.addInitScript(() => {
    if (!(window as unknown as { __keepSavePicker?: boolean }).__keepSavePicker) Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true, writable: true });
  });
  await page.goto('/');
  await page.evaluate((p) => {
    localStorage.clear();
    indexedDB.deleteDatabase('cad-studio-db');
    if (p) {
      localStorage.setItem('cad_project_proj_default', JSON.stringify(p));
      localStorage.setItem('cad_active_project_id', 'proj_default');
    }
  }, project ?? null);
  await page.reload();
  const canvas = page.locator('main canvas').first();
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(800);
  const box = (await canvas.boundingBox())!;
  const ox = box.x + box.width / 2;
  const oy = box.y + box.height / 2;
  // الكاميرا الابتدائية: تكبير 100% والأصل في منتصف اللوحة
  const W = (x: number, y: number) => [ox + x, oy + y] as const;
  return { W, box };
}

/** يحفظ (Ctrl+S) ثم يقرأ عناصر المشروع من التخزين المحلي */
export async function savedObjects(page: Page): Promise<any[]> {
  await page.mouse.move(2, 2);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+s');
  await page.waitForTimeout(300);
  const raw = await page.evaluate(() => localStorage.getItem('cad_project_proj_default'));
  return raw ? JSON.parse(raw).objects : [];
}

export const byId = (list: any[]) => Object.fromEntries(list.map((o) => [o.id, o]));

export async function commandBarLabel(page: Page) {
  return (await page.locator('form:has(input[aria-label="شريط الأوامر"])').first().innerText()).split('\n')[0];
}

export function emptyProject() {
  return {
    project: { name: 'اختبار', unit: 'meter', scale: 50, createdAt: '2026-01-01' },
    layers: [{ id: 'arch', name: 'arch', visible: true, locked: false, color: '#f3f4f6', isDefault: true }],
    objects: [],
    backgroundImage: null,
  };
}

/** مشروع كبير: غرف متكررة (4 جدران + باب لكل غرفة) */
export function gridProject(rooms: number) {
  const objects: any[] = [];
  const side = Math.ceil(Math.sqrt(rooms));
  let k = 0;
  for (let i = 0; i < side; i++)
    for (let j = 0; j < side; j++) {
      const x = i * 320, y = j * 220;
      const pts = [[x, y], [x + 300, y], [x + 300, y + 200], [x, y + 200]];
      const ids: string[] = [];
      for (let s = 0; s < 4; s++) {
        const a = pts[s], b = pts[(s + 1) % 4];
        const id = 'w' + k++;
        ids.push(id);
        objects.push({ id, type: 'wall', layerId: 'arch', start: { x: a[0], y: a[1] }, end: { x: b[0], y: b[1] }, thickness: 20 });
      }
      objects.push({ id: 'd' + k, type: 'door', layerId: 'arch', wallId: ids[2], position: 0.5, width: 45, openDirection: 'inward_right' });
    }
  return { ...emptyProject(), objects };
}
