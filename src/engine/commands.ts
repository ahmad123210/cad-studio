/**
 * @file commands.ts
 * @description سجل الأوامر الموحد (بنمط AutoCAD):
 * - أسماء مستعارة عربية وإنجليزية تُكتب في شريط الأوامر (مثل: جدار / wall / w، نقل / move / m)
 * - مفاتيح افتراضية قابلة للتخصيص للأوامر ذات المفتاح الواحد
 * - تذكّر آخر أمر لتكراره بـ Enter
 */

import type { CadEngine, ToolMode, EditCommandKind } from './renderer.ts';
import { getLastUsedSettings, updateLastUsedSettings } from '../model/lastUsedSettings.ts';
import type { AlignMode } from '../model/align.ts';

export interface CadCommand {
  id: string;
  label: string;
  /** أسماء تُكتب في شريط الأوامر (بدون حساسية لحالة الأحرف) */
  aliases: string[];
  /** المفاتيح الافتراضية (KeyboardEvent.code) — تُستبدل إن خصصها المستخدم */
  defaultCodes: string[];
  /** هل يمكن تخصيص مفتاحه؟ */
  remappable: boolean;
  run: (engine: CadEngine) => string | null;
}

const tool = (mode: ToolMode) => (engine: CadEngine) => {
  if (mode === 'select') {
    engine.cancelDrawing();
  }
  engine.setToolMode(mode);
  return null;
};
const edit = (kind: EditCommandKind) => (engine: CadEngine) => engine.startEditCommand(kind);
const align = (mode: AlignMode) => (engine: CadEngine) => engine.alignSelection(mode);

export const COMMANDS: CadCommand[] = [
  { id: 'select', label: 'تحديد', aliases: ['select', 'تحديد', 'v'], defaultCodes: ['KeyV', 'Digit1'], remappable: true, run: tool('select') },
  { id: 'wall', label: 'جدار', aliases: ['wall', 'جدار', 'w'], defaultCodes: ['KeyW', 'Digit4'], remappable: true, run: tool('wall') },
  { id: 'door', label: 'باب', aliases: ['door', 'باب', 'd'], defaultCodes: ['KeyD', 'Digit5'], remappable: true, run: tool('door') },
  { id: 'window', label: 'نافذة', aliases: ['window', 'win', 'نافذة', 'n'], defaultCodes: ['KeyN', 'Digit6'], remappable: true, run: tool('window') },
  { id: 'dimension', label: 'بُعد', aliases: ['dim', 'dimension', 'بعد', 'أبعاد'], defaultCodes: ['KeyM', 'Digit7'], remappable: true, run: tool('dimension') },
  { id: 'measure', label: 'قياس مسافة', aliases: ['dist', 'measure', 'قياس'], defaultCodes: ['Digit8'], remappable: true, run: tool('measure') },
  { id: 'route', label: 'مسار', aliases: ['route', 'مسار', 'r'], defaultCodes: ['KeyR', 'Digit9'], remappable: true, run: tool('route') },
  { id: 'area', label: 'مساحة', aliases: ['area', 'مساحة', 'a'], defaultCodes: ['KeyA', 'Digit0'], remappable: true, run: tool('area') },
  { id: 'symbol', label: 'رمز', aliases: ['symbol', 'رمز', 's'], defaultCodes: ['KeyS'], remappable: true, run: tool('symbol') },
  { id: 'text', label: 'ملاحظة نصية', aliases: ['text', 'نص', 'ملاحظة', 't'], defaultCodes: ['KeyT'], remappable: true, run: tool('text') },
  { id: 'pan', label: 'تحريك اللوحة', aliases: ['pan', 'تحريك', 'h'], defaultCodes: ['KeyH'], remappable: true, run: tool('pan') },
  { id: 'calibrate', label: 'معايرة', aliases: ['cal', 'calibrate', 'معايرة'], defaultCodes: [], remappable: true, run: tool('calibrate') },
  { id: 'move', label: 'نقل', aliases: ['move', 'm', 'نقل'], defaultCodes: [], remappable: true, run: edit('move') },
  { id: 'copy', label: 'نسخ متعدد', aliases: ['copy', 'co', 'cp', 'نسخ'], defaultCodes: [], remappable: true, run: edit('copy') },
  { id: 'rotate', label: 'تدوير', aliases: ['rotate', 'ro', 'تدوير'], defaultCodes: [], remappable: true, run: edit('rotate') },
  { id: 'scale', label: 'تحجيم', aliases: ['scale', 'sc', 'تحجيم'], defaultCodes: [], remappable: true, run: edit('scale') },
  { id: 'mirror', label: 'مرآة', aliases: ['mirror', 'mi', 'مرآة', 'مراة'], defaultCodes: [], remappable: true, run: edit('mirror') },
  { id: 'array', label: 'مصفوفة', aliases: ['array', 'ar', 'مصفوفة'], defaultCodes: [], remappable: true, run: edit('array') },
  { id: 'offset', label: 'إزاحة متوازية', aliases: ['offset', 'o', 'إزاحة', 'ازاحة'], defaultCodes: [], remappable: true, run: edit('offset') },
  { id: 'trim', label: 'قص', aliases: ['trim', 'tr', 'قص'], defaultCodes: [], remappable: true, run: edit('trim') },
  { id: 'extend', label: 'تمديد', aliases: ['extend', 'ex', 'تمديد'], defaultCodes: [], remappable: true, run: edit('extend') },
  { id: 'arraypolar', label: 'مصفوفة دائرية', aliases: ['arraypolar', 'polar', 'ap', 'مصفوفة دائرية', 'دائرية'], defaultCodes: [], remappable: true, run: edit('arraypolar') },
  { id: 'rect', label: 'مستطيل', aliases: ['rect', 'rectangle', 'rec', 'مستطيل'], defaultCodes: [], remappable: true, run: edit('rect') },
  { id: 'circle', label: 'دائرة', aliases: ['circle', 'c', 'ci', 'دائرة'], defaultCodes: [], remappable: true, run: edit('circle') },
  { id: 'arc', label: 'قوس', aliases: ['arc', 'قوس'], defaultCodes: [], remappable: true, run: edit('arc') },
  { id: 'column', label: 'عمود', aliases: ['column', 'col', 'عمود', 'أعمدة'], defaultCodes: [], remappable: true, run: edit('column') },
  { id: 'stairs', label: 'درج', aliases: ['stairs', 'stair', 'st', 'درج'], defaultCodes: [], remappable: true, run: edit('stairs') },
  { id: 'polygon', label: 'مضلع منتظم', aliases: ['polygon', 'pol', 'مضلع'], defaultCodes: [], remappable: true, run: edit('polygon') },
  { id: 'fillet', label: 'وصل ركن', aliases: ['fillet', 'f', 'وصل', 'وصل ركن'], defaultCodes: [], remappable: true, run: edit('fillet') },
  { id: 'chamfer', label: 'شطف ركن', aliases: ['chamfer', 'cha', 'شطف'], defaultCodes: [], remappable: true, run: edit('chamfer') },
  { id: 'break', label: 'كسر', aliases: ['break', 'br', 'كسر'], defaultCodes: [], remappable: true, run: edit('break') },
  { id: 'join', label: 'دمج', aliases: ['join', 'j', 'دمج'], defaultCodes: [], remappable: true, run: edit('join') },
  { id: 'stretch', label: 'تمطيط', aliases: ['stretch', 'str', 'تمطيط', 'مط'], defaultCodes: [], remappable: true, run: edit('stretch') },
  { id: 'dimchain', label: 'أبعاد متسلسلة', aliases: ['dimchain', 'dch', 'dimcontinue', 'أبعاد متسلسلة', 'ابعاد متسلسلة'], defaultCodes: [], remappable: true, run: edit('dimchain') },
  {
    id: 'blocks',
    label: 'مكتبة الكتل',
    aliases: ['blocks', 'block', 'insert', 'i', 'كتل', 'كتلة', 'إدراج'],
    defaultCodes: [],
    remappable: true,
    run: () => {
      window.dispatchEvent(new Event('cad:open-blocks'));
      return null;
    },
  },
  {
    id: 'rooms',
    label: 'كشف الغرف',
    aliases: ['rooms', 'room', 'غرف', 'الغرف', 'كشف الغرف'],
    defaultCodes: [],
    remappable: true,
    run: (engine) => (engine.detectRooms() > 0 ? null : 'لم تُعثر على غرف مغلقة جديدة'),
  },
  { id: 'alignLeft', label: 'محاذاة لليسار', aliases: ['alignleft', 'all', 'محاذاة يسار'], defaultCodes: [], remappable: true, run: align('left') },
  { id: 'alignRight', label: 'محاذاة لليمين', aliases: ['alignright', 'alr', 'محاذاة يمين'], defaultCodes: [], remappable: true, run: align('right') },
  { id: 'alignTop', label: 'محاذاة للأعلى', aliases: ['aligntop', 'alt', 'محاذاة أعلى', 'محاذاة اعلى'], defaultCodes: [], remappable: true, run: align('top') },
  { id: 'alignBottom', label: 'محاذاة للأسفل', aliases: ['alignbottom', 'alb', 'محاذاة أسفل', 'محاذاة اسفل'], defaultCodes: [], remappable: true, run: align('bottom') },
  { id: 'alignCenterX', label: 'توسيط أفقي', aliases: ['aligncenterx', 'alcx', 'توسيط أفقي', 'توسيط افقي'], defaultCodes: [], remappable: true, run: align('centerX') },
  { id: 'alignCenterY', label: 'توسيط رأسي', aliases: ['aligncentery', 'alcy', 'توسيط رأسي', 'توسيط راسي'], defaultCodes: [], remappable: true, run: align('centerY') },
  { id: 'distributeH', label: 'توزيع أفقي', aliases: ['distributeh', 'dih', 'توزيع أفقي', 'توزيع افقي'], defaultCodes: [], remappable: true, run: align('distributeH') },
  { id: 'distributeV', label: 'توزيع رأسي', aliases: ['distributev', 'div', 'توزيع رأسي', 'توزيع راسي'], defaultCodes: [], remappable: true, run: align('distributeV') },
  {
    id: 'erase',
    label: 'حذف المحدد',
    aliases: ['erase', 'e', 'delete', 'del', 'حذف'],
    defaultCodes: [],
    remappable: false,
    run: (engine) => {
      const ids = engine.getSelectedObjectIds();
      if (ids.length === 0) return 'لا يوجد تحديد';
      engine.model.deleteObjects(ids);
      engine.deselectAll();
      return null;
    },
  },
  { id: 'undo', label: 'تراجع', aliases: ['undo', 'u', 'تراجع'], defaultCodes: [], remappable: false, run: (e) => (e.model.undo() ? null : 'لا يوجد ما يُتراجع عنه') },
  { id: 'redo', label: 'إعادة', aliases: ['redo', 'إعادة', 'اعادة'], defaultCodes: [], remappable: false, run: (e) => (e.model.redo() ? null : 'لا يوجد ما يُعاد') },
  { id: 'zoomExtents', label: 'ملاءمة العرض', aliases: ['zoom', 'z', 'ze', 'ملاءمة', 'ملائمة'], defaultCodes: [], remappable: true, run: (e) => (e.zoomToFit(), null) },
  { id: 'ortho', label: 'تبديل التعامد', aliases: ['ortho', 'تعامد'], defaultCodes: ['F8'], remappable: false, run: (e) => (e.toggleOrthoMode(), null) },
];

const byId = new Map(COMMANDS.map((c) => [c.id, c]));

export function getCommand(id: string): CadCommand | undefined {
  return byId.get(id);
}

/** البحث عن أمر بالاسم المكتوب (مطابقة تامة لاسم مستعار أو للتسمية العربية) */
export function findCommand(text: string): CadCommand | undefined {
  const t = text.trim().toLowerCase();
  if (!t) return undefined;
  return COMMANDS.find((c) => c.aliases.includes(t) || c.label === t);
}

/** اقتراحات أثناء الكتابة */
export function suggestCommands(text: string, limit = 6): CadCommand[] {
  const t = text.trim().toLowerCase();
  if (!t) return [];
  return COMMANDS.filter((c) => c.aliases.some((a) => a.startsWith(t)) || c.label.includes(t)).slice(0, limit);
}

let lastCommandId: string | null = null;

export function setLastCommand(id: string | null): void {
  if (id && byId.has(id) && !['undo', 'redo', 'erase', 'select'].includes(id)) lastCommandId = id;
}

export function getLastCommand(): CadCommand | undefined {
  return lastCommandId ? byId.get(lastCommandId) : undefined;
}

export function runCommand(engine: CadEngine, id: string): string | null {
  const cmd = byId.get(id);
  if (!cmd) return 'أمر غير معروف';
  const err = cmd.run(engine);
  if (!err) setLastCommand(id);
  return err;
}

// ─── الاختصارات المخصصة ───

export function getCustomShortcuts(): Record<string, string> {
  return { ...(getLastUsedSettings().customShortcuts || {}) };
}

export function setCustomShortcuts(map: Record<string, string>): void {
  updateLastUsedSettings({ customShortcuts: map });
}

/** المفاتيح الفعلية للأمر (المخصص إن وُجد وإلا الافتراضي) */
export function effectiveCodes(id: string, custom = getCustomShortcuts()): string[] {
  const c = byId.get(id);
  if (!c) return [];
  return custom[id] ? [custom[id]] : c.defaultCodes;
}

/** مفاتيح محجوزة لا يمكن تخصيصها */
export const RESERVED_CODES = new Set(['Escape', 'Space', 'Enter', 'NumpadEnter', 'Tab', 'Delete', 'Backspace', 'F8', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight', 'Slash', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyQ', 'KeyF']);

/** عرض اسم المفتاح للمستخدم (KeyW ← W، Digit4 ← 4) */
export function codeLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}

/**
 * معالجة المفاتيح المخصصة قبل جدول المفاتيح الافتراضي في المحرك.
 * يعيد true إذا عولج المفتاح (أو حُجب لأن أمره خُصص لمفتاح آخر).
 */
export function handleCustomShortcut(engine: CadEngine, code: string): boolean {
  const custom = getCustomShortcuts();
  const ids = Object.keys(custom);
  if (ids.length === 0) return false;
  for (const id of ids) {
    if (custom[id] === code) {
      runCommand(engine, id);
      return true;
    }
  }
  // مفتاح افتراضي لأمر أُعيد تخصيصه: نحجبه حتى لا يبقى الأمر على مفتاحين
  for (const id of ids) {
    if (byId.get(id)?.defaultCodes.includes(code)) return true;
  }
  return false;
}
