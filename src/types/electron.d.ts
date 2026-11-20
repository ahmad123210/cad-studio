/**
 * @file src/types/electron.d.ts
 * @description تعريف واجهات التكامل مع Electron في بيئة سطح المكتب
 */

export interface ElectronAPI {
  isElectron: boolean;
  platform: string;
  // حفظ المشروع عبر نافذة ويندوز الأصلية (المرحلة 4)
  saveProject: (
    projectData: unknown,
    options?: { title?: string; defaultPath?: string }
  ) => Promise<{ canceled: boolean; success?: boolean; filePath?: string; error?: string }>;
  // حفظ تلقائي مباشر بالمسار الأخير
  saveProjectDirect: (
    projectData: unknown,
    targetPath?: string
  ) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  // الحصول على آخر مسار محفوظ
  getLastSavedPath: () => Promise<string | null>;
  // إبلاغ العملية الرئيسية بوجود تعديلات غير محفوظة
  setUnsavedChanges: (hasUnsaved: boolean) => void;
  // الاستماع لطلب الحفظ عند محاولة إغلاق التطبيق
  onTriggerSaveAndClose: (callback: () => void) => () => void;
  // الرد على طلب الحفظ قبل الإغلاق
  responseSaveAndClose: (result: { success: boolean; error?: string }) => void;
  // إغلاق النافذة
  closeWindow: (options?: { force?: boolean }) => Promise<void>;
  // حفظ الملفات العامة
  saveFile: (options: {
    title?: string;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
    content: string | Uint8Array;
  }) => Promise<{ canceled: boolean; filePath?: string; error?: string }>;
  // فتح الملفات
  openFile: (options?: {
    title?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }) => Promise<{ canceled: boolean; filePath?: string; content?: string; error?: string }>;
  getVersion: () => Promise<string>;
  onMenuAction: (callback: (action: string) => void) => () => void;
  onFileOpened: (callback: (data: { filePath: string; content: string }) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
