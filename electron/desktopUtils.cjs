/**
 * @file electron/desktopUtils.cjs
 * @description دوال مساعدة نقية لنسخة سطح المكتب (المرحلة 19) — قابلة للاختبار دون Electron:
 *  - استخراج مسار ملف المشروع من وسائط التشغيل (فتح الملف بالنقر المزدوج)
 *  - قائمة آخر الملفات
 *  - نصوص الحوارات الأصلية بالعربية والإنجليزية
 */

const path = require('path');

/** امتدادات ملفات المشروع: .cadproj هو الامتداد المسجّل في ويندوز؛ .json و.cad تُفتح أيضاً */
const PROJECT_EXTS = ['.cadproj', '.json', '.cad'];
const MAX_RECENT = 10;

function isProjectFile(p) {
  return typeof p === 'string' && PROJECT_EXTS.includes(path.extname(p).toLowerCase());
}

/**
 * أول وسيط تشغيل يشير إلى ملف مشروع موجود.
 * ويندوز يمرر المسار كوسيط عند النقر المزدوج: ["CAD Studio.exe", "C:\\...\\plan.cadproj"]
 * ونتجاهل الخيارات (--flag) ومسار البرنامج نفسه.
 */
function findProjectArg(argv, exists) {
  if (!Array.isArray(argv)) return null;
  for (const raw of argv.slice(1)) {
    if (typeof raw !== 'string' || raw.startsWith('-')) continue;
    const p = raw.replace(/^"|"$/g, '');
    if (isProjectFile(p) && exists(p)) return p;
  }
  return null;
}

const samePath = (a, b, platform = process.platform) =>
  platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;

/** يضيف مساراً إلى رأس القائمة دون تكرار ويقصّها إلى الحد الأقصى */
function pushRecent(list, filePath, platform = process.platform, max = MAX_RECENT) {
  const clean = (Array.isArray(list) ? list : []).filter((p) => typeof p === 'string' && p && !samePath(p, filePath, platform));
  return [filePath, ...clean].slice(0, max);
}

function removeRecent(list, filePath, platform = process.platform) {
  return (Array.isArray(list) ? list : []).filter((p) => !samePath(p, filePath, platform));
}

function parseRecent(text) {
  try {
    const v = JSON.parse(text);
    return Array.isArray(v) ? v.filter((p) => typeof p === 'string').slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

/** اسم الملف الافتراضي عند الحفظ: اسم المشروع بعد إزالة المحارف الممنوعة + .cadproj */
function defaultProjectFileName(projectName) {
  const base = String(projectName || 'cad-project').replace(/[\\/:*?"<>|]/g, '_').trim() || 'cad-project';
  return `${base}.cadproj`;
}

const STRINGS = {
  ar: {
    file: 'ملف',
    recent: 'الملفات الأخيرة',
    noRecent: 'لا توجد ملفات حديثة',
    clearRecent: 'مسح القائمة',
    checkUpdates: 'التحقق من التحديثات…',
    projectFiles: 'مشروع CAD Studio (*.cadproj)',
    jsonFiles: 'ملف مشروع JSON (*.json)',
    allFiles: 'جميع الملفات (*.*)',
    missingTitle: 'الملف غير موجود',
    missing: (p) => `لم يُعثر على الملف:\n${p}\nأُزيل من قائمة الملفات الأخيرة.`,
    openTitle: 'فتح ملف مشروع',
    openUnsaved: (name) => `يحتوي المشروع الحالي على تعديلات غير محفوظة.\nفتح «${name}» سيستبدلها.`,
    openAnyway: 'فتح وتجاهل التعديلات',
    cancel: 'إلغاء',
    readErrorTitle: 'خطأ في القراءة',
    readError: (m) => `تعذر فتح الملف: ${m}`,
    updateTitle: 'تحديث البرنامج',
    updateAvailable: (v) => `يتوفر إصدار جديد (${v}). هل تريد تنزيله الآن؟ سيُثبَّت عند إعادة التشغيل.`,
    download: 'تنزيل',
    later: 'لاحقاً',
    updateReady: (v) => `تم تنزيل الإصدار ${v}. أعد تشغيل البرنامج لتثبيته الآن، أو سيُثبَّت تلقائياً عند الإغلاق.`,
    restart: 'إعادة التشغيل الآن',
    onQuit: 'عند الإغلاق',
    upToDate: (v) => `أنت تستخدم أحدث إصدار (${v}).`,
    updateError: (m) => `تعذر التحقق من التحديثات: ${m}`,
    portableNote: 'النسخة المحمولة لا تُحدَّث تلقائياً؛ نزّل الإصدار الأحدث من صفحة الإصدارات.',
    ok: 'حسناً',
  },
  en: {
    file: 'File',
    recent: 'Recent files',
    noRecent: 'No recent files',
    clearRecent: 'Clear list',
    checkUpdates: 'Check for updates…',
    projectFiles: 'CAD Studio project (*.cadproj)',
    jsonFiles: 'JSON project file (*.json)',
    allFiles: 'All files (*.*)',
    missingTitle: 'File not found',
    missing: (p) => `The file could not be found:\n${p}\nIt was removed from the recent files list.`,
    openTitle: 'Open project file',
    openUnsaved: (name) => `The current project has unsaved changes.\nOpening "${name}" will replace them.`,
    openAnyway: 'Open and discard changes',
    cancel: 'Cancel',
    readErrorTitle: 'Read error',
    readError: (m) => `Couldn't open the file: ${m}`,
    updateTitle: 'Software update',
    updateAvailable: (v) => `A new version (${v}) is available. Download it now? It will be installed on restart.`,
    download: 'Download',
    later: 'Later',
    updateReady: (v) => `Version ${v} has been downloaded. Restart now to install it, or it will be installed automatically when you quit.`,
    restart: 'Restart now',
    onQuit: 'On quit',
    upToDate: (v) => `You're using the latest version (${v}).`,
    updateError: (m) => `Couldn't check for updates: ${m}`,
    portableNote: "The portable edition doesn't update automatically; download the latest version from the releases page.",
    ok: 'OK',
  },
};

module.exports = {
  PROJECT_EXTS,
  MAX_RECENT,
  isProjectFile,
  findProjectArg,
  pushRecent,
  removeRecent,
  parseRecent,
  defaultProjectFileName,
  STRINGS,
};
