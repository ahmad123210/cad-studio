import { test, expect } from '@playwright/test';
import { openFresh, savedObjects, emptyProject, byId } from './helpers';

const wall = (id: string, sx: number, sy: number, ex: number, ey: number) => ({ id, type: 'wall', layerId: 'arch', start: { x: sx, y: sy }, end: { x: ex, y: ey }, thickness: 20 });
const sym = (id: string, kind: string, x: number, y: number, layerId = 'elec') => ({ id, type: 'symbol', layerId, symbolKind: kind, x, y, rotation: 0 });
const selectedCount = async (page: import('@playwright/test').Page) =>
  page.evaluate(() => {
    // زر «حذف كافة العناصر المحددة (N)» يظهر في لوحة التحديد المتعدد فقط
    const t = document.body.textContent || '';
    const m = t.match(/حذف كافة العناصر المحددة \((\d+)\)/);
    return m ? Number(m[1]) : -1;
  });

test('Ctrl+click adds to the selection, Shift+click selects all similar items', async ({ page }) => {
  const { W } = await openFresh(page, {
    ...emptyProject(),
    objects: [wall('a', -200, -100, 0, -100), wall('b', -200, 100, 0, 100), sym('s1', 'socket_single', 150, -100), sym('s2', 'socket_single', 150, 0), sym('s3', 'socket_single', 150, 100), sym('l1', 'light_ceiling', 250, 0)],
  });
  // Ctrl: جدار + مقبس
  await page.mouse.click(...W(-100, -100));
  await page.keyboard.down('Control');
  await page.mouse.click(...W(150, -100));
  await page.keyboard.up('Control');
  await expect.poll(() => selectedCount(page)).toBe(2);
  // Ctrl على عنصر محدد يزيله
  await page.keyboard.down('Control');
  await page.mouse.click(...W(150, -100));
  await page.keyboard.up('Control');
  await expect.poll(() => selectedCount(page)).toBe(-1);

  // Shift: كل المقابس المتشابهة (3) دون الإنارة
  await page.keyboard.down('Shift');
  await page.mouse.click(...W(150, 0));
  await page.keyboard.up('Shift');
  await expect.poll(() => selectedCount(page)).toBe(3);
});

test('group several items into one, drag them together, then ungroup', async ({ page }) => {
  const { W } = await openFresh(page, { ...emptyProject(), objects: [wall('a', -200, 0, 0, 0), wall('b', 0, 0, 0, 150), sym('s1', 'socket_single', 200, 0)] });
  await page.mouse.click(...W(-100, 0));
  await page.keyboard.down('Control');
  await page.mouse.click(...W(0, 100));
  await page.keyboard.up('Control');
  await page.keyboard.press('Control+g');
  let o = byId(await savedObjects(page));
  expect(o.a.groupId).toBeTruthy();
  expect(o.b.groupId).toBe(o.a.groupId);
  expect(o.s1.groupId).toBeFalsy();

  // نقرة واحدة على عضو تحدد المجموعة كلها، والسحب ينقلها معاً
  await page.mouse.click(...W(-100, 0));
  await expect.poll(() => selectedCount(page)).toBe(2);
  await page.mouse.move(...W(-100, 0));
  await page.mouse.down();
  await page.mouse.move(...W(-60, 20), { steps: 6 });
  await page.mouse.move(...W(-50, 50), { steps: 6 });
  await page.mouse.up();
  o = byId(await savedObjects(page));
  // الإزاحة نفسها للجدارين (تحركا كعنصر واحد)
  expect(o.a.start.x + 200).toBe(o.b.start.x);
  expect(o.a.start.y).toBe(o.b.start.y);
  expect(o.a.start.x).not.toBe(-200);

  // فك التجميع من القائمة اليمنى
  await page.mouse.click(...W(o.b.start.x + 0, o.b.start.y + 100), { button: 'right' });
  await page.getByTestId('ctx-ungroup').click();
  o = byId(await savedObjects(page));
  expect(o.a.groupId ?? null).toBeNull();
  expect(o.b.groupId ?? null).toBeNull();
  // التراجع يعيد التجميع
  await page.keyboard.press('Control+z');
  o = byId(await savedObjects(page));
  expect(o.a.groupId).toBeTruthy();
});

test('furniture goes to the automatic furniture layer; old projects are migrated', async ({ page }) => {
  // مشروع قديم: سرير على الطبقة المعمارية ولا توجد طبقة أثاث
  await openFresh(page, { ...emptyProject(), objects: [sym('bed', 'furn_bed_double', 0, 0, 'arch'), sym('sk', 'socket_single', 100, 0)] });
  await page.keyboard.press('Control+s');
  await page.waitForTimeout(300);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('cad_project_proj_default')!));
  expect(saved.layers.map((l: { id: string }) => l.id)).toEqual(['arch', 'furn']);
  const o = byId(saved.objects);
  expect(o.bed.layerId).toBe('furn');
  expect(o.sk.layerId).toBe('arch'); // غير الأثاث لا يُنقل
  await page.getByRole('button', { name: /الطبقات/ }).first().click();
  await expect(page.getByText(/الأثاث والعفش \(Furniture\)\s*افتراضية/).first()).toBeVisible();
});

test('measuring shows only length and angle; extra drawing labels are hidden by default', async ({ page }) => {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { __texts: string[] }).__texts = seen;
    const orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (t: string, x: number, y: number, m?: number) {
      seen.push(String(t));
      return m === undefined ? orig.call(this, t, x, y) : orig.call(this, t, x, y, m);
    };
  });
  const { W } = await openFresh(page, { ...emptyProject(), objects: [] });
  const texts = () => page.evaluate(() => (window as unknown as { __texts: string[] }).__texts.splice(0));
  await page.keyboard.press('8');
  await page.mouse.click(...W(0, 0));
  await texts();
  await page.mouse.move(...W(150, 0), { steps: 3 });
  await page.waitForTimeout(200);
  const t = (await texts()).filter((x) => /م|°/.test(x));
  expect(t.some((x) => x.includes('°') && x.includes('م'))).toBe(true);
  expect(t.some((x) => /ΔX|ΔY|قياس|📏/.test(x))).toBe(false);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');

  // وضع رمز: لا يظهر اسمه بجانب المؤشر
  await page.keyboard.press('s');
  await page.mouse.move(...W(100, 100), { steps: 3 });
  await page.waitForTimeout(200);
  const symTexts = await texts();
  expect(symTexts.some((x) => x.includes('مقبس') || x.includes('إنارة'))).toBe(false);
});

test('browser: exports and Save As open the system save dialog; Ctrl+S then writes to the chosen file', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __keepSavePicker: boolean; __saved: { name: string; size: number; head: string; text: string }[]; showSaveFilePicker: unknown };
    w.__keepSavePicker = true;
    w.__saved = [];
    w.showSaveFilePicker = async (opts: { suggestedName: string }) => ({
      name: opts.suggestedName,
      createWritable: async () => {
        const chunks: (Blob | string)[] = [];
        return {
          write: async (d: Blob | string) => void chunks.push(d),
          close: async () => {
            const blob = new Blob(chunks);
            const buf = new Uint8Array(await blob.arrayBuffer());
            w.__saved.push({ name: opts.suggestedName, size: buf.length, head: String.fromCharCode(buf[0], buf[1]), text: buf.length < 200000 ? await blob.text() : '' });
          },
        };
      },
    });
  });
  await openFresh(page, { ...emptyProject(), objects: [wall('a', -200, 0, 200, 0), wall('b', 200, 0, 200, 200), wall('c', 200, 200, -200, 200), wall('d', -200, 200, -200, 0)] });
  const saved = () => page.evaluate(() => (window as unknown as { __saved: { name: string; size: number; head: string; text: string }[] }).__saved);

  // Excel الكميات من نافذة التصدير: ملف xlsx حقيقي (يبدأ بـ PK) لا CSV
  await page.keyboard.press('Control+p');
  await page.getByTestId('export-boq-xlsx').click();
  await expect.poll(async () => (await saved()).length).toBe(1);
  const x = (await saved())[0];
  expect(x.name).toMatch(/\.xlsx$/);
  expect(x.head).toBe('PK');
  await page.keyboard.press('Escape');

  // حفظ باسم: ملف .cadproj في المكان المختار، ثم Ctrl+S يكتب فيه مجدداً
  await page.mouse.click(5, 5);
  await page.keyboard.press('Control+Shift+s');
  await expect.poll(async () => (await saved()).length).toBe(2);
  expect((await saved())[1].name).toMatch(/\.cadproj$/);
  expect(JSON.parse((await saved())[1].text).objects).toHaveLength(4);
  await expect(page.getByText(/\.cadproj/).first()).toBeVisible();
  await page.keyboard.press('Control+s');
  await expect.poll(async () => (await saved()).length).toBe(3);
});
