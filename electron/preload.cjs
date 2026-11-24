/**
 * @file electron/preload.cjs
 * @description Preload Script exposing secure IPC bridge to renderer process
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,

  // حفظ المشروع عبر نافذة حفظ ويندوز الأصلية (المرحلة 4 - متطلب 1)
  saveProject: (projectData, options) => ipcRenderer.invoke('save-project', projectData, options),

  // حفظ المشروع التلقائي أو المباشر في المسار الأخير (المرحلة 4 - متطلب 2)
  saveProjectDirect: (projectData, targetPath) => ipcRenderer.invoke('save-project-direct', projectData, targetPath),

  // استرجاع آخر مسار تم الحفظ فيه على ويندوز
  getLastSavedPath: () => ipcRenderer.invoke('get-last-saved-path'),

  // إبلاغ العملية الرئيسية بوجود تعديلات غير محفوظة (المرحلة 4 - متطلب 3)
  setUnsavedChanges: (hasUnsaved) => ipcRenderer.send('set-unsaved-changes', Boolean(hasUnsaved)),

  // الاستماع لطلب الحفظ عند محاولة إغلاق التطبيق مع تعديلات غير محفوظة
  onTriggerSaveAndClose: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('trigger-save-and-close', handler);
    return () => ipcRenderer.removeListener('trigger-save-and-close', handler);
  },

  // إشعار العملية الرئيسية بإتمام الحفظ تمهيداً للإغلاق
  responseSaveAndClose: (result) => ipcRenderer.send('response-save-and-close', result),

  // إغلاق النافذة
  closeWindow: (options) => ipcRenderer.invoke('window:close', options),

  // حفظ الملفات عبر نافذة النظام الرسمية
  saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),

  // فتح الملفات عبر نافذة النظام الرسمية
  openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),

  // الحصول على إصدار التطبيق
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  // استقبال أحداث شريط القوائم العلوي (Ctrl+S, Ctrl+Z, التصدير، إلخ)
  onMenuAction: (callback) => {
    const handler = (_event, action) => callback(action);
    ipcRenderer.on('menu-action', handler);
    return () => ipcRenderer.removeListener('menu-action', handler);
  },

  // الملفات الأخيرة (المرحلة 19)
  getRecentFiles: () => ipcRenderer.invoke('recent:list'),
  openRecentFile: (filePath) => ipcRenderer.invoke('recent:open', filePath),
  clearRecentFiles: () => ipcRenderer.invoke('recent:clear'),
  onRecentChanged: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('recent-changed', handler);
    return () => ipcRenderer.removeListener('recent-changed', handler);
  },

  // لغة القوائم والحوارات الأصلية تتبع لغة الواجهة
  setUiLang: (lang) => ipcRenderer.send('ui:set-lang', lang),

  // تعدد النوافذ (المرحلة 20)
  newWindow: () => ipcRenderer.invoke('window:new'),
  setCurrentFilePath: (filePath) => ipcRenderer.send('window:set-path', filePath || null),

  // التحقق من التحديثات يدوياً
  checkForUpdates: () => ipcRenderer.invoke('update:check'),

  // استقبال حدث فتح ملف من الخارج
  onFileOpened: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('file-opened', handler);
    return () => ipcRenderer.removeListener('file-opened', handler);
  },
});
