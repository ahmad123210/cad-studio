/**
 * @file electron/main.cjs
 * @description Electron Main Process for CAD Studio Windows Application
 * مُصمم ليعمل بسلاسة على بيئات ويندوز، ومُحسّن لاستهلاك الموارد والأجهزة الاقتصادية
 *
 * المرحلة 20: تعدد النوافذ — كل نافذة مشروع مستقل بحالته (مسار الحفظ، التعديلات غير المحفوظة).
 *  - «نافذة جديدة» (Ctrl+Shift+N) تفتح مشروعاً فارغاً بجانب الحالي.
 *  - فتح ملف من القائمة/الملفات الأخيرة: في النافذة الحالية إن لم تكن فيها تعديلات، وإلا في نافذة جديدة.
 *  - النقر المزدوج على ملف والبرنامج مفتوح: يُفتح في نافذة جديدة (أو تُنشَّط نافذته إن كان مفتوحاً).
 */

const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const desk = require('./desktopUtils.cjs');

// التحديث التلقائي من صفحة الإصدارات على GitHub (المرحلة 19). اختياري: إن غابت الحزمة يعمل البرنامج بدونه.
let autoUpdater = null;
try {
  autoUpdater = require('electron-updater').autoUpdater;
} catch {
  autoUpdater = null;
}

// لغة الحوارات والقوائم الأصلية — تتبع لغة الواجهة (ترسلها الواجهة عند الإقلاع والتبديل)
let uiLang = 'ar';
const S = () => desk.STRINGS[uiLang] || desk.STRINGS.ar;
const L = (ar, en) => (uiLang === 'en' ? en : ar);

// تعطيل التحذيرات غير الضرورية لتسريع الأداء
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

// تحسينات أداء الرسوميات والذاكرة خصيصاً للمعالجات الاقتصادية
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('disable-software-rasterizer', 'false');

// ───────────── حالة النوافذ ─────────────
/**
 * @typedef {Object} WinCtx
 * @property {BrowserWindow} win
 * @property {number} slot        1 = النافذة الرئيسية (تستعيد آخر جلسة)، 2.. نوافذ إضافية
 * @property {string|null} lastSavedPath
 * @property {boolean} hasUnsavedChanges
 * @property {boolean} forceClose
 * @property {string|null} pendingOpenPath
 * @property {boolean} freshEmpty  نافذة إضافية فارغة لم يُعمل فيها بعد (يُفتح فيها الملف التالي)
 */
/** @type {Map<number, WinCtx>} مفتاحها webContents.id */
const windows = new Map();
let isQuitting = false;
// ملف طُلب فتحه قبل جاهزية التطبيق (نقر مزدوج على ملف .cadproj)
let startupOpenPath = desk.findProjectArg(process.argv, fs.existsSync);

const ctxFromSender = (sender) => windows.get(sender.id) || null;
function activeCtx() {
  const focused = BrowserWindow.getFocusedWindow();
  if (focused && windows.has(focused.webContents.id)) return windows.get(focused.webContents.id);
  let last = null;
  for (const c of windows.values()) last = c;
  return last;
}
const sendToActive = (channel, ...args) => activeCtx()?.win.webContents.send(channel, ...args);
const anyWindow = () => activeCtx()?.win || null;

function freeSlot() {
  const used = new Set([...windows.values()].map((c) => c.slot));
  let s = 1;
  while (used.has(s)) s++;
  return s;
}

const samePath = (a, b) => Boolean(a && b) && (process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);
const ctxForPath = (p) => [...windows.values()].find((c) => samePath(c.lastSavedPath, p)) || null;

function updateWindowTitle(ctx) {
  if (!ctx || ctx.win.isDestroyed()) return;
  const name = ctx.lastSavedPath ? path.basename(ctx.lastSavedPath) : L('مشروع غير محفوظ', 'Unsaved project');
  ctx.win.setTitle(`${ctx.hasUnsavedChanges ? '● ' : ''}${name} — CAD Studio`);
}

// نسخة واحدة من البرنامج تدير كل النوافذ
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const p = desk.findProjectArg(argv, fs.existsSync);
    if (p) {
      openProjectPath(p, { preferNewWindow: true });
      return;
    }
    const w = anyWindow();
    if (w) {
      if (w.isMinimized()) w.restore();
      w.focus();
    } else {
      createWindow();
    }
  });
}
// macOS: فتح ملف من Finder
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (app.isReady()) openProjectPath(filePath, { preferNewWindow: true });
  else startupOpenPath = filePath;
});

// ───────────── الملفات الأخيرة ─────────────
const recentStorePath = () => path.join(app.getPath('userData'), 'recent-files.json');
let recentFiles = [];
function loadRecentFiles() {
  try {
    recentFiles = desk.parseRecent(fs.readFileSync(recentStorePath(), 'utf-8'));
  } catch {
    recentFiles = [];
  }
}
function persistRecent() {
  try {
    fs.writeFileSync(recentStorePath(), JSON.stringify(recentFiles, null, 2), 'utf-8');
  } catch {
    /* مجلد بيانات المستخدم غير قابل للكتابة: تبقى القائمة في الذاكرة */
  }
  setupNativeMenu();
  for (const c of windows.values()) c.win.webContents.send('recent-changed');
}
function addRecentFile(filePath) {
  if (!filePath) return;
  recentFiles = desk.pushRecent(recentFiles, filePath);
  try {
    app.addRecentDocument(filePath); // قائمة الانتقال السريع في شريط مهام ويندوز
  } catch {
    /* غير مدعوم */
  }
  persistRecent();
}

/**
 * يفتح ملف مشروع من القرص.
 * - إن كان مفتوحاً في نافذة: تُنشَّط تلك النافذة.
 * - preferNewWindow (نقر مزدوج): نافذة جديدة، إلا إن كانت النافذة الحالية إضافية فارغة.
 * - غير ذلك: النافذة المستهدفة إن لم تكن فيها تعديلات غير محفوظة، وإلا نافذة جديدة (لا يضيع عمل).
 */
async function openProjectPath(filePath, opts = {}) {
  if (!fs.existsSync(filePath)) {
    recentFiles = desk.removeRecent(recentFiles, filePath);
    persistRecent();
    const w = anyWindow();
    const box = { type: 'warning', title: S().missingTitle, message: S().missing(filePath), buttons: [S().ok] };
    if (w) await dialog.showMessageBox(w, box);
    else await dialog.showMessageBox(box);
    return;
  }
  const already = ctxForPath(filePath);
  if (already) {
    if (already.win.isMinimized()) already.win.restore();
    already.win.focus();
    return;
  }
  const target = opts.target || activeCtx();
  const reuseEmpty = target && target.freshEmpty && !target.hasUnsavedChanges;
  if (!target || target.hasUnsavedChanges || (opts.preferNewWindow && !reuseEmpty)) {
    createWindow({ openPath: filePath });
    return;
  }
  sendFileToWindow(target, filePath);
}

function sendFileToWindow(ctx, filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    ctx.lastSavedPath = filePath;
    ctx.hasUnsavedChanges = false;
    ctx.freshEmpty = false;
    ctx.win.webContents.send('file-opened', { filePath, content });
    updateWindowTitle(ctx);
    addRecentFile(filePath);
    if (ctx.win.isMinimized()) ctx.win.restore();
    ctx.win.focus();
  } catch (err) {
    dialog.showErrorBox(S().readErrorTitle, S().readError(err.message));
  }
}

function createWindow(opts = {}) {
  const slot = freeSlot();
  const offset = (windows.size % 6) * 28;
  const win = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    ...(windows.size > 0 ? { x: 80 + offset, y: 60 + offset } : {}),
    title: 'نظام التصميم الهندسي الذكي - CAD Studio',
    // ويندوز لا يدعم SVG كأيقونة نافذة، ومجلد public غير مضمّن في الحزمة: نستخدم PNG المنسوخ إلى dist
    icon: path.join(__dirname, '..', 'dist', 'icon-256.png'),
    backgroundColor: '#0f172a',
    autoHideMenuBar: false,
    show: false, // لا تظهر النافذة حتى تصبح جاهزة تماماً لمنع الوميض
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      devTools: false, // إزالة وتعطيل أدوات المطور من قائمة العرض وواجهة المستخدم
      backgroundThrottling: false, // يحافظ على ثبات رسومات الكانفس
    },
  });
  /** @type {WinCtx} */
  const ctx = {
    win,
    slot,
    lastSavedPath: null,
    hasUnsavedChanges: false,
    forceClose: false,
    pendingOpenPath: opts.openPath || null,
    freshEmpty: slot !== 1 && !opts.openPath,
  };
  const wcId = win.webContents.id;
  windows.set(wcId, ctx);

  // إعداد القائمة العربية للتطبيق
  setupNativeMenu();

  // النافذة الرئيسية (slot 1) تستعيد آخر جلسة؛ الإضافية تحمل رقمها لتحفظ نسختها المحلية منفصلة
  const query = slot === 1 ? undefined : { window: String(slot) };

  // تحديد مسار التشغيل: تطوير محلي أم حزمة الإنتاج
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const devUrl = 'http://localhost:3000' + (query ? `/?window=${slot}` : '');
  const prodPath = path.join(__dirname, '..', 'dist', 'index.html');

  if (isDev && process.env.LOAD_DEV_SERVER === 'true') {
    win.loadURL(devUrl).catch(() => {
      if (fs.existsSync(prodPath)) win.loadFile(prodPath, { query });
    });
  } else if (fs.existsSync(prodPath)) {
    win.loadFile(prodPath, { query });
  } else {
    win.loadURL(devUrl);
  }

  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

  // عنوان النافذة يُدار هنا (اسم الملف + علامة التعديل) لا من عنوان الصفحة
  win.on('page-title-updated', (e) => e.preventDefault());
  updateWindowTitle(ctx);
  win.on('focus', () => setupNativeMenu());

  // ملف طُلب فتحه: يُرسل بعد تحميل الواجهة واستماعها للحدث
  win.webContents.on('did-finish-load', () => {
    if (ctx.pendingOpenPath) {
      const p = ctx.pendingOpenPath;
      ctx.pendingOpenPath = null;
      setTimeout(() => sendFileToWindow(ctx, p), 400);
    }
  });

  // منع اختصارات فتح أدوات المطور (F12 / Ctrl+Shift+I)
  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      event.preventDefault();
    }
  });

  // فتح الروابط الخارجية في المتصفح الافتراضي بدلاً من نافذة التطبيق
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // سؤال المستخدم عند إغلاق نافذة فيها تعديلات غير محفوظة (المرحلة 4)
  win.on('close', async (e) => {
    if (ctx.forceClose || !ctx.hasUnsavedChanges) return;
    e.preventDefault();
    await promptUnsavedChangesBeforeClose(ctx);
  });

  win.on('closed', () => {
    windows.delete(wcId);
    setupNativeMenu();
  });
  return ctx;
}

function setupNativeMenu() {
  const active = activeCtx();
  const template = [
    {
      label: L('ملف', 'File'),
      submenu: [
        {
          label: L('مشروع جديد', 'New project'),
          accelerator: 'CmdOrCtrl+N',
          click: () => sendToActive('menu-action', 'new-project'),
        },
        {
          label: L('نافذة جديدة', 'New window'),
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => createWindow(),
        },
        {
          label: L('فتح ملف مشروع (.cadproj / .json)...', 'Open project file (.cadproj / .json)...'),
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const ctx = activeCtx();
            const opts = {
              title: L('فتح ملف مشروع هندسي', 'Open engineering project'),
              filters: [
                { name: 'CAD Project Files', extensions: ['cadproj', 'json', 'cad'] },
                { name: 'All Files', extensions: ['*'] },
              ],
              properties: ['openFile', 'multiSelections'],
            };
            const result = ctx ? await dialog.showOpenDialog(ctx.win, opts) : await dialog.showOpenDialog(opts);
            if (result.canceled) return;
            // عدة ملفات دفعة واحدة: الأول في النافذة الحالية (إن أمكن) والبقية في نوافذ جديدة
            result.filePaths.forEach((p, i) => openProjectPath(p, i === 0 ? { target: ctx } : { preferNewWindow: true }));
          },
        },
        {
          label: S().recent,
          submenu: recentFiles.length
            ? [
                ...recentFiles.map((p, i) => ({
                  label: `${i + 1}. ${path.basename(p)}`,
                  toolTip: p,
                  click: () => openProjectPath(p),
                })),
                { type: 'separator' },
                {
                  label: S().clearRecent,
                  click: () => {
                    recentFiles = [];
                    try {
                      app.clearRecentDocuments();
                    } catch {
                      /* غير مدعوم */
                    }
                    persistRecent();
                  },
                },
              ]
            : [{ label: S().noRecent, enabled: false }],
        },
        {
          label: L('حفظ المشروع', 'Save project'),
          accelerator: 'CmdOrCtrl+S',
          click: () => sendToActive('menu-action', 'save-project'),
        },
        {
          label: L('حفظ المشروع باسم...', 'Save project as...'),
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendToActive('menu-action', 'save-project-as'),
        },
        { type: 'separator' },
        {
          label: L('تصدير صورة عالية الدقة (PNG)...', 'Export high-resolution image (PNG)...'),
          click: () => sendToActive('menu-action', 'export-png'),
        },
        {
          label: L('تصدير تقرير هندسي (PDF)...', 'Export engineering report (PDF)...'),
          click: () => sendToActive('menu-action', 'export-pdf'),
        },
        {
          label: L('تصدير مخطط أوتوكاد (DXF)...', 'Export AutoCAD drawing (DXF)...'),
          click: () => sendToActive('menu-action', 'export-dxf'),
        },
        { type: 'separator' },
        {
          label: L('إغلاق النافذة', 'Close window'),
          accelerator: 'CmdOrCtrl+W',
          click: () => activeCtx()?.win.close(),
        },
        {
          label: L('خروج', 'Exit'),
          accelerator: 'Alt+F4',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: L('تعديل', 'Edit'),
      submenu: [
        {
          label: L('تراجع', 'Undo'),
          accelerator: 'CmdOrCtrl+Z',
          click: () => sendToActive('menu-action', 'undo'),
        },
        {
          label: L('إعادة', 'Redo'),
          accelerator: 'CmdOrCtrl+Y',
          click: () => sendToActive('menu-action', 'redo'),
        },
        { type: 'separator' },
        {
          label: L('تحديد الكل', 'Select all'),
          accelerator: 'CmdOrCtrl+A',
          click: () => sendToActive('menu-action', 'select-all'),
        },
        {
          label: L('حذف المحدد', 'Delete selected'),
          accelerator: 'Delete',
          click: () => sendToActive('menu-action', 'delete-selected'),
        },
      ],
    },
    {
      label: L('عرض', 'View'),
      submenu: [
        { label: L('إعادة ضبط العرض', 'Reset view'), accelerator: 'CmdOrCtrl+0', click: () => sendToActive('menu-action', 'reset-zoom') },
        { label: L('تكبير (+)', 'Zoom in (+)'), accelerator: 'CmdOrCtrl+=', click: () => sendToActive('menu-action', 'zoom-in') },
        { label: L('تصغير (-)', 'Zoom out (-)'), accelerator: 'CmdOrCtrl+-', click: () => sendToActive('menu-action', 'zoom-out') },
        { type: 'separator' },
        { role: 'reload', label: L('تحديث الشاشة', 'Reload') },
        { role: 'togglefullscreen', label: L('ملء الشاشة', 'Full screen') },
      ],
    },
    {
      label: L('نافذة', 'Window'),
      submenu: [
        { label: L('نافذة جديدة', 'New window'), click: () => createWindow() },
        { type: 'separator' },
        ...[...windows.values()].map((c) => ({
          label: `${c.hasUnsavedChanges ? '● ' : ''}${c.lastSavedPath ? path.basename(c.lastSavedPath) : L('مشروع غير محفوظ', 'Unsaved project')}`,
          type: 'radio',
          checked: c === active,
          click: () => {
            if (c.win.isMinimized()) c.win.restore();
            c.win.focus();
          },
        })),
      ],
    },
    {
      label: L('مساعدة', 'Help'),
      submenu: [
        {
          label: S().checkUpdates,
          click: () => checkForUpdates(true),
        },
        { type: 'separator' },
        {
          label: L('حول البرنامج', 'About'),
          click: () => {
            const w = anyWindow();
            const box = {
              type: 'info',
              title: 'حول CAD Studio Desktop',
              message: 'نظام التصميم الهندسي الذكي (CAD Studio)',
              detail: 'تطبيق سطح المكتب المتكامل للتصميم والتدقيق الهندسي المعماري والكهروميكانيكي (MEP).\nيعمل بنظام Electron على ويندوز ولينكس.',
            };
            if (w) dialog.showMessageBox(w, box);
            else dialog.showMessageBox(box);
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// نافذة حوار قبل إغلاق نافذة فيها تعديلات غير محفوظة (المرحلة 4)
async function promptUnsavedChangesBeforeClose(ctx) {
  if (!ctx || ctx.win.isDestroyed() || !ctx.hasUnsavedChanges || ctx.forceClose) return true;
  if (ctx.prompting) return false;
  ctx.prompting = true;
  if (ctx.win.isMinimized()) ctx.win.restore();
  ctx.win.focus();
  const name = ctx.lastSavedPath ? ` «${path.basename(ctx.lastSavedPath)}»` : '';
  const choice = await dialog.showMessageBox(ctx.win, {
    type: 'question',
    buttons: ['حفظ', 'تجاهل', 'إلغاء'],
    defaultId: 0,
    cancelId: 2,
    title: 'تعديلات غير محفوظة',
    message: `يحتوي المشروع${name} على تعديلات غير محفوظة. هل تريد حفظ المشروع قبل الإغلاق؟`,
    detail: 'إذا اخترت "تجاهل"، فستفقد كل التعديلات الأخيرة التي لم يتم حفظها.',
    noLink: true,
  });
  ctx.prompting = false;

  if (choice.response === 0) {
    // حفظ المشروع ثم إغلاق (ننتظر استجابة الحفظ من الواجهة)
    ctx.win.webContents.send('trigger-save-and-close');
    return false;
  }
  if (choice.response === 1) {
    ctx.forceClose = true;
    ctx.win.close();
    return true;
  }
  // إلغاء: تبقى النافذة ويُلغى الخروج من البرنامج
  isQuitting = false;
  return false;
}

// 1. فتح نافذة حفظ ويندوز الحقيقية وكتابة ملف المشروع على القرص (المرحلة 4)
ipcMain.handle('save-project', async (event, projectData, options = {}) => {
  const ctx = ctxFromSender(event.sender);
  if (!ctx) return { canceled: true };

  const defaultFileName = desk.defaultProjectFileName(projectData?.project?.name);

  let defaultPath = options.defaultPath || ctx.lastSavedPath;
  if (!defaultPath) {
    try {
      defaultPath = path.join(app.getPath('documents'), defaultFileName);
    } catch {
      defaultPath = defaultFileName;
    }
  }

  const res = await dialog.showSaveDialog(ctx.win, {
    title: options.title || 'حفظ المشروع باسم',
    defaultPath,
    filters: [
      { name: S().projectFiles, extensions: ['cadproj'] },
      { name: S().jsonFiles, extensions: ['json'] },
      { name: S().allFiles, extensions: ['*'] },
    ],
  });

  if (!res.canceled && res.filePath) {
    try {
      const jsonContent = typeof projectData === 'string' ? projectData : JSON.stringify(projectData, null, 2);
      fs.writeFileSync(res.filePath, jsonContent, 'utf-8');
      ctx.lastSavedPath = res.filePath;
      ctx.hasUnsavedChanges = false;
      ctx.freshEmpty = false;
      updateWindowTitle(ctx);
      addRecentFile(res.filePath);
      return { canceled: false, success: true, filePath: res.filePath };
    } catch (err) {
      dialog.showErrorBox('خطأ في حفظ المشروع', `تعذر حفظ الملف: ${err.message}`);
      return { canceled: false, success: false, error: err.message };
    }
  }

  return { canceled: true };
});

// 2. حفظ مباشر وسريع على نفس المسار الأخير (للحفظ التلقائي أو Ctrl+S بعد أول حفظ)
ipcMain.handle('save-project-direct', async (event, projectData, targetPath) => {
  const ctx = ctxFromSender(event.sender);
  const savePath = targetPath || ctx?.lastSavedPath;
  if (!savePath) {
    return { success: false, error: 'No target path available for direct save' };
  }
  // حماية: لا تكتب نافذتان على الملف نفسه
  const owner = ctxForPath(savePath);
  if (owner && ctx && owner !== ctx) {
    return { success: false, error: 'FILE_OPEN_IN_OTHER_WINDOW' };
  }
  try {
    const jsonContent = typeof projectData === 'string' ? projectData : JSON.stringify(projectData, null, 2);
    fs.writeFileSync(savePath, jsonContent, 'utf-8');
    if (ctx) {
      ctx.lastSavedPath = savePath;
      ctx.hasUnsavedChanges = false;
      ctx.freshEmpty = false;
      updateWindowTitle(ctx);
    }
    return { success: true, filePath: savePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// الحصول على آخر مسار محفوظ لهذه النافذة
ipcMain.handle('get-last-saved-path', (event) => ctxFromSender(event.sender)?.lastSavedPath || null);

// تحديث حالة التعديلات غير المحفوظة لهذه النافذة
ipcMain.on('set-unsaved-changes', (event, value) => {
  const ctx = ctxFromSender(event.sender);
  if (!ctx) return;
  const next = Boolean(value);
  if (next !== ctx.hasUnsavedChanges) {
    ctx.hasUnsavedChanges = next;
    if (next) ctx.freshEmpty = false;
    updateWindowTitle(ctx);
    setupNativeMenu();
  }
});

// استجابة واجهة المستخدم بعد إتمام حفظ الملف عند طلب الإغلاق
ipcMain.on('response-save-and-close', (event, result) => {
  const ctx = ctxFromSender(event.sender);
  if (!ctx) return;
  if (result && result.success) {
    ctx.hasUnsavedChanges = false;
    ctx.forceClose = true;
    if (!ctx.win.isDestroyed()) ctx.win.close();
  } else {
    isQuitting = false;
  }
});

// إغلاق النافذة برمجياً
ipcMain.handle('window:close', (event, options) => {
  const ctx = ctxFromSender(event.sender);
  if (!ctx) return;
  if (options && options.force) ctx.forceClose = true;
  ctx.win.close();
});

// الواجهة تبلغ بمسار ملفها (النافذة الرئيسية تستعيده من الإعدادات عند الإقلاع)
ipcMain.on('window:set-path', (event, filePath) => {
  const ctx = ctxFromSender(event.sender);
  if (!ctx) return;
  const p = typeof filePath === 'string' && filePath ? filePath : null;
  const owner = p ? ctxForPath(p) : null;
  if (owner && owner !== ctx) return; // الملف مفتوح في نافذة أخرى
  if (ctx.lastSavedPath !== p) {
    ctx.lastSavedPath = p;
    if (p) ctx.freshEmpty = false;
    updateWindowTitle(ctx);
    setupNativeMenu();
  }
});

// نافذة جديدة من الواجهة (بحث الأوامر)
ipcMain.handle('window:new', () => {
  createWindow();
});

// حفظ ملف (تصدير PDF/Excel/DXF/صور…) عبر نافذة الحفظ في ويندوز لاختيار المكان (المرحلة 20)
ipcMain.handle('dialog:saveFile', async (event, options = {}) => {
  const ctx = ctxFromSender(event.sender);
  let defaultPath = options.defaultPath || 'project.json';
  if (!path.isAbsolute(defaultPath)) {
    let baseDir = ctx?.lastSavedPath ? path.dirname(ctx.lastSavedPath) : null;
    if (!baseDir) {
      try {
        baseDir = app.getPath('documents');
      } catch {
        baseDir = '';
      }
    }
    defaultPath = path.join(baseDir, defaultPath);
  }
  const dlg = {
    title: options.title || 'حفظ الملف',
    defaultPath,
    filters: options.filters || [{ name: 'All Files', extensions: ['*'] }],
  };
  const res = ctx ? await dialog.showSaveDialog(ctx.win, dlg) : await dialog.showSaveDialog(dlg);

  if (!res.canceled && res.filePath && options.content !== undefined) {
    try {
      if (typeof options.content === 'string') {
        fs.writeFileSync(res.filePath, options.content, 'utf-8');
      } else {
        fs.writeFileSync(res.filePath, Buffer.from(options.content));
      }
      return { canceled: false, filePath: res.filePath };
    } catch (err) {
      return { canceled: false, error: err.message };
    }
  }
  return res;
});

ipcMain.handle('dialog:openFile', async (event, options = {}) => {
  const ctx = ctxFromSender(event.sender);
  const dlg = {
    title: options.title || 'فتح ملف',
    filters: options.filters || [{ name: 'All Files', extensions: ['*'] }],
    properties: ['openFile'],
  };
  const res = ctx ? await dialog.showOpenDialog(ctx.win, dlg) : await dialog.showOpenDialog(dlg);
  if (!res.canceled && res.filePaths.length > 0) {
    try {
      const filePath = res.filePaths[0];
      const content = fs.readFileSync(filePath, 'utf-8');
      return { canceled: false, filePath, content };
    } catch (err) {
      return { canceled: false, error: err.message };
    }
  }
  return res;
});

ipcMain.handle('app:getVersion', () => app.getVersion());

// ───────────── الملفات الأخيرة ولغة الواجهة (المرحلة 19) ─────────────
ipcMain.handle('recent:list', () => recentFiles.map((p) => ({ path: p, name: path.basename(p), exists: fs.existsSync(p) })));
ipcMain.handle('recent:open', (event, filePath) => {
  if (typeof filePath === 'string' && recentFiles.includes(filePath)) return openProjectPath(filePath, { target: ctxFromSender(event.sender) });
});
ipcMain.handle('recent:clear', () => {
  recentFiles = [];
  persistRecent();
});
ipcMain.on('ui:set-lang', (_event, lang) => {
  const next = lang === 'en' ? 'en' : 'ar';
  if (next !== uiLang) {
    uiLang = next;
    setupNativeMenu();
    for (const c of windows.values()) updateWindowTitle(c);
  }
});
ipcMain.handle('update:check', () => checkForUpdates(true));

// ───────────── التحديث التلقائي من GitHub Releases ─────────────
// يعمل مع نسخة المثبّت (NSIS) فقط؛ النسخة المحمولة تُبلغ المستخدم بتنزيل الإصدار يدوياً.
const isPortable = Boolean(process.env.PORTABLE_EXECUTABLE_DIR);
let updaterReady = false;
let manualCheck = false;

function setupAutoUpdater() {
  if (!autoUpdater || !app.isPackaged || isPortable || updaterReady) return;
  updaterReady = true;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', async (info) => {
    manualCheck = false;
    const w = anyWindow();
    if (!w) return;
    const r = await dialog.showMessageBox(w, {
      type: 'info',
      title: S().updateTitle,
      message: S().updateAvailable(info.version),
      buttons: [S().download, S().later],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    if (r.response === 0) autoUpdater.downloadUpdate().catch(() => {});
  });
  autoUpdater.on('update-not-available', (info) => {
    const w = anyWindow();
    if (manualCheck && w) dialog.showMessageBox(w, { type: 'info', title: S().updateTitle, message: S().upToDate(info?.version || app.getVersion()), buttons: [S().ok] });
    manualCheck = false;
  });
  autoUpdater.on('download-progress', (p) => {
    anyWindow()?.setProgressBar(Math.max(0, Math.min(1, (p.percent || 0) / 100)));
  });
  autoUpdater.on('update-downloaded', async (info) => {
    const w = anyWindow();
    w?.setProgressBar(-1);
    if (!w) return;
    const r = await dialog.showMessageBox(w, {
      type: 'info',
      title: S().updateTitle,
      message: S().updateReady(info.version),
      buttons: [S().restart, S().onQuit],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    // إعادة التشغيل تمر بحوار «تعديلات غير محفوظة» المعتاد قبل الإغلاق
    if (r.response === 0) setImmediate(() => autoUpdater.quitAndInstall());
  });
  autoUpdater.on('error', (err) => {
    const w = anyWindow();
    w?.setProgressBar(-1);
    if (manualCheck && w) dialog.showMessageBox(w, { type: 'warning', title: S().updateTitle, message: S().updateError(err?.message || String(err)), buttons: [S().ok] });
    manualCheck = false;
  });
}

function checkForUpdates(manual) {
  if (isPortable || !app.isPackaged || !autoUpdater) {
    const w = anyWindow();
    if (manual && w) {
      const msg = isPortable ? S().portableNote : S().upToDate(app.getVersion());
      dialog.showMessageBox(w, { type: 'info', title: S().updateTitle, message: msg, buttons: [S().ok] });
    }
    return;
  }
  setupAutoUpdater();
  manualCheck = Boolean(manual);
  autoUpdater.checkForUpdates().catch(() => {});
}

app.whenReady().then(() => {
  if (!gotSingleInstanceLock) return;
  loadRecentFiles();
  createWindow({ openPath: startupOpenPath });
  startupOpenPath = null;
  // فحص صامت للتحديثات بعد الإقلاع بقليل
  setTimeout(() => checkForUpdates(false), 8000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// الخروج: كل نافذة فيها تعديلات تسأل عن الحفظ (واحدة بعد أخرى)؛ يكتمل الخروج عند إغلاق آخر نافذة
app.on('before-quit', (e) => {
  const dirty = [...windows.values()].filter((c) => c.hasUnsavedChanges && !c.forceClose && !c.win.isDestroyed());
  if (dirty.length === 0) return;
  e.preventDefault();
  if (isQuitting) return;
  isQuitting = true;
  for (const c of [...windows.values()]) if (!c.hasUnsavedChanges) c.win.close();
  (async () => {
    for (const c of dirty) {
      if (!isQuitting) break;
      if (c.win.isDestroyed()) continue;
      await promptUnsavedChangesBeforeClose(c);
      // ننتظر إغلاق النافذة بعد الحفظ أو التجاهل، أو إلغاء الخروج
      await new Promise((resolve) => {
        const t = setInterval(() => {
          if (c.win.isDestroyed() || !isQuitting) {
            clearInterval(t);
            resolve();
          }
        }, 150);
      });
    }
    isQuitting = false;
  })();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
