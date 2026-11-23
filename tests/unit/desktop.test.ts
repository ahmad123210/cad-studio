import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const desk = require('../../electron/desktopUtils.cjs');

describe('desktop helpers (Windows integration)', () => {
  it('finds the project file Windows passes on double-click, ignoring flags and the exe', () => {
    const exists = (p: string) => !p.includes('missing');
    expect(desk.findProjectArg(['C:\\Program Files\\CAD Studio\\CAD Studio.exe', 'D:\\plans\\villa.cadproj'], exists)).toBe('D:\\plans\\villa.cadproj');
    expect(desk.findProjectArg(['app.exe', '--allow-file-access', '"D:\\a b\\shop.JSON"'], exists)).toBe('D:\\a b\\shop.JSON');
    expect(desk.findProjectArg(['app.exe', 'D:\\missing.cadproj'], exists)).toBeNull();
    expect(desk.findProjectArg(['app.exe', 'D:\\drawing.dxf'], exists)).toBeNull();
    expect(desk.findProjectArg(['app.exe'], exists)).toBeNull();
  });

  it('keeps a de-duplicated, capped recent list (case-insensitive on Windows)', () => {
    let list: string[] = [];
    for (let i = 0; i < 12; i++) list = desk.pushRecent(list, `C:\\p\\f${i}.cadproj`, 'win32');
    expect(list).toHaveLength(desk.MAX_RECENT);
    expect(list[0]).toBe('C:\\p\\f11.cadproj');
    list = desk.pushRecent(list, 'c:\\P\\F5.CADPROJ', 'win32');
    expect(list[0]).toBe('c:\\P\\F5.CADPROJ');
    expect(list.filter((p: string) => p.toLowerCase() === 'c:\\p\\f5.cadproj')).toHaveLength(1);
    expect(desk.removeRecent(list, 'C:\\p\\f5.cadproj', 'win32').some((p: string) => p.toLowerCase().endsWith('f5.cadproj'))).toBe(false);
    expect(desk.parseRecent('not json')).toEqual([]);
    expect(desk.parseRecent(JSON.stringify(['a', 3, 'b']))).toEqual(['a', 'b']);
  });

  it('suggests a safe .cadproj file name and has both dialog languages', () => {
    expect(desk.defaultProjectFileName('فيلا: 01/أ')).toBe('فيلا_ 01_أ.cadproj');
    expect(desk.defaultProjectFileName('')).toBe('cad-project.cadproj');
    expect(Object.keys(desk.STRINGS.en).sort()).toEqual(Object.keys(desk.STRINGS.ar).sort());
  });
});
