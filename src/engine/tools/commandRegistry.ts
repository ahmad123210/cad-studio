/**
 * @file commandRegistry.ts
 * @description سجل الأوامر الموسّعة التي تعمل داخل إطار أوامر التحرير (toolMode = 'edit'):
 * أشكال الرسم (مستطيل، دائرة، قوس، مضلع) وأوامر التحرير الإضافية. كل أمر يعرّف:
 * نص التوجيه، ومعالجة النقر، والقيم الرقمية، والمعاينة. التسجيل يتم من وحدات الأوامر نفسها.
 */
import type { Point } from '../../model/types.ts';
import type { CadEngine } from '../renderer.ts';
import type { EditCommandState } from './editCommands.ts';

export interface ExtCommand {
  /** اسم الأمر بالعربية (يظهر في التراجع والتوجيه) */
  name: string;
  /** هل يتطلب تحديداً مسبقاً؟ */
  needsSelection: boolean;
  /** تحقق إضافي عند البدء (يعيد رسالة خطأ أو null) */
  validate?(engine: CadEngine, ids: string[]): string | null;
  /** تنفيذ فوري بلا نقرات (مثل الدمج): يعيد رسالة خطأ أو null */
  runImmediately?(engine: CadEngine, ids: string[]): string | null;
  prompt(engine: CadEngine, c: EditCommandState): string;
  awaitingValue?(engine: CadEngine, c: EditCommandState): boolean;
  /** يعيد true عند انتهاء الأمر */
  click(engine: CadEngine, c: EditCommandState, p: Point, objectSnapped: boolean, shift: boolean, raw?: Point): boolean;
  /** قيمة رقمية: true = انتهى، string = خطأ، null = قُبلت ويستمر */
  value?(engine: CadEngine, c: EditCommandState, text: string): string | null | true;
  preview?(engine: CadEngine, c: EditCommandState, cursor: Point, shift: boolean): void;
}

export const EXT_COMMANDS: Record<string, ExtCommand> = {};

export function registerCommand(kind: string, cmd: ExtCommand): void {
  EXT_COMMANDS[kind] = cmd;
}

/** تحويل نص رقمي (يقبل الفاصلة العربية) إلى قائمة أرقام */
export function parseNumbers(text: string): number[] {
  return text
    .trim()
    .replace(/،/g, ',')
    .replace(/\s+/g, '')
    .split(',')
    .filter((x) => x !== '')
    .map(Number);
}
