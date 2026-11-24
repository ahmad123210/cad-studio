/**
 * @file saveFile.ts
 * @description حفظ الملفات المصدَّرة مع اختيار مكان الحفظ (المرحلة 20):
 *  - نسخة ويندوز: نافذة «حفظ باسم» الأصلية في ويندوز (عبر Electron).
 *  - المتصفحات الحديثة (Chrome/Edge): نافذة حفظ النظام عبر File System Access API.
 *  - غير ذلك: تنزيل عادي إلى مجلد التنزيلات (السلوك السابق).
 */

export interface SaveType {
  /** وصف نوع الملف في نافذة الحفظ */
  description: string;
  mime: string;
  extensions: string[];
}

export type SaveResult = 'saved' | 'canceled' | 'downloaded';

export const FILE_TYPES = {
  pdf: { description: 'PDF', mime: 'application/pdf', extensions: ['pdf'] },
  png: { description: 'PNG', mime: 'image/png', extensions: ['png'] },
  jpg: { description: 'JPEG', mime: 'image/jpeg', extensions: ['jpg', 'jpeg'] },
  xlsx: { description: 'Excel', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extensions: ['xlsx'] },
  csv: { description: 'CSV', mime: 'text/csv', extensions: ['csv'] },
  dxf: { description: 'AutoCAD DXF', mime: 'application/dxf', extensions: ['dxf'] },
  svg: { description: 'SVG', mime: 'image/svg+xml', extensions: ['svg'] },
  ifc: { description: 'IFC', mime: 'application/x-step', extensions: ['ifc'] },
  project: { description: 'CAD Studio', mime: 'application/json', extensions: ['cadproj', 'json'] },
  json: { description: 'JSON', mime: 'application/json', extensions: ['json'] },
} satisfies Record<string, SaveType>;

type PickerWindow = Window & {
  showSaveFilePicker?: (opts: {
    suggestedName?: string;
    types?: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<FileSystemFileHandle>;
};

export function supportsSavePicker(): boolean {
  return typeof window !== 'undefined' && typeof (window as PickerWindow).showSaveFilePicker === 'function';
}

/** اسم ملف آمن على ويندوز */
export function safeFileName(name: string, fallback = 'project'): string {
  const clean = String(name || '').replace(/[\\/:*?"<>|]/g, '_').trim();
  return clean || fallback;
}

function anchorDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** يكتب في مقبض ملف (File System Access) */
export async function writeToHandle(handle: FileSystemFileHandle, data: Blob | string): Promise<void> {
  const writable = await (handle as FileSystemFileHandle & { createWritable: () => Promise<FileSystemWritableFileStream> }).createWritable();
  await writable.write(data);
  await writable.close();
}

/** يطلب من المستخدم مكان الحفظ ويعيد المقبض (المتصفح فقط)، أو null عند الإلغاء/عدم الدعم */
export async function pickSaveHandle(suggestedName: string, type: SaveType): Promise<FileSystemFileHandle | null | 'unsupported'> {
  if (!supportsSavePicker()) return 'unsupported';
  try {
    return await (window as PickerWindow).showSaveFilePicker!({
      suggestedName,
      types: [{ description: type.description, accept: { [type.mime]: type.extensions.map((e) => `.${e}`) } }],
    });
  } catch (err) {
    if ((err as DOMException)?.name === 'AbortError') return null;
    // انتهاء صلاحية تفاعل المستخدم أو منع أمني: نرجع للتنزيل العادي
    return 'unsupported';
  }
}

/**
 * يحفظ بيانات في ملف يختار المستخدم مكانه.
 * يعيد 'saved' عند الكتابة، 'canceled' إن ألغى المستخدم، 'downloaded' عند التنزيل العادي.
 */
export async function saveFileAs(data: Blob | string, suggestedName: string, type: SaveType): Promise<SaveResult> {
  const blob = typeof data === 'string' ? new Blob([data], { type: `${type.mime};charset=utf-8` }) : data;

  // 1) ويندوز (Electron): نافذة الحفظ الأصلية
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined;
  if (api?.saveFile) {
    try {
      const content = typeof data === 'string' ? data : new Uint8Array(await blob.arrayBuffer());
      const res = await api.saveFile({
        title: suggestedName,
        defaultPath: suggestedName,
        filters: [
          { name: type.description, extensions: type.extensions },
          { name: 'All Files', extensions: ['*'] },
        ],
        content,
      });
      if (res?.canceled) return 'canceled';
      if (res?.error) throw new Error(res.error);
      return 'saved';
    } catch (err) {
      console.warn('Native save failed, falling back to download:', err);
    }
  }

  // 2) المتصفح: نافذة حفظ النظام
  const handle = await pickSaveHandle(suggestedName, type);
  if (handle === null) return 'canceled';
  if (handle !== 'unsupported') {
    try {
      await writeToHandle(handle, blob);
      return 'saved';
    } catch (err) {
      console.warn('Save picker write failed, falling back to download:', err);
    }
  }

  // 3) تنزيل عادي
  anchorDownload(blob, suggestedName);
  return 'downloaded';
}
