/**
 * @file windowContext.ts
 * @description سياق النافذة في نسخة سطح المكتب متعددة النوافذ (المرحلة 20).
 * النافذة الرئيسية بلا معامل وتستعيد آخر جلسة. النوافذ الإضافية تُفتح بـ ?window=N
 * فتبدأ بمشروع فارغ، وتحفظ نسختها المحلية تحت معرّف خاص بها، ولا تمس «آخر مشروع» ولا «آخر مسار حفظ»
 * الخاصين بالنافذة الرئيسية (التخزين المحلي مشترك بين النوافذ).
 */

function readSlot(): string | null {
  try {
    const v = new URLSearchParams(window.location.search).get('window');
    return v && /^\d{1,3}$/.test(v) && v !== '1' ? v : null;
  } catch {
    return null;
  }
}

export const WINDOW_SLOT: string | null = typeof window === 'undefined' ? null : readSlot();
export const IS_SECONDARY_WINDOW = WINDOW_SLOT !== null;
/** معرّف المشروع المحلي لهذه النافذة */
export const WINDOW_PROJECT_ID = IS_SECONDARY_WINDOW ? `proj_window_${WINDOW_SLOT}` : 'proj_default';
