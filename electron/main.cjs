/**
 * @file electron/main.cjs
 * @description Electron Main Process for CAD Studio Windows Application
 * مُصمم ليعمل بسلاسة على بيئات ويندوز، ومُحسّن لاستهلاك الموارد والأجهزة الاقتصادية
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

// ملف مشروع طُلب فتحه قبل جاهزية النافذة (نقر مزدوج على ملف .cadproj)
let pendingOpenPath = null;

// تعطيل التحذيرات غير الضرورية لتسريع الأداء
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

// تحسينات أداء الرسوميات والذاكرة خصيصاً للمعالجات الاقتصادية
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('disable-software-rasterizer', 'false');

let mainWindow = null;

// نسخة واحدة من البرنامج: النقر المزدوج على ملف آخر يفتحه في النافذة الحالية بدلاً من نافذة جديدة
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    const p = desk.findProjectArg(argv, fs.existsSync);
    if (p) openProjectPath(p);
  });
}
pendingOpenPath = desk.findProjectArg(process.argv, fs.existsSync);
// macOS: فتح ملف من Finder
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (mainWindow) openProjectPath(filePath);
  else pendingOpenPath = filePath;
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
  mainWindow?.webContents.send('recent-changed');
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

/** يفتح ملف مشروع من القرص في النافذة (مع سؤال عند وجود تعديلات غير محفوظة) */
async function openProjectPath(filePath) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    pendingOpenPath = filePath;
    return;
  }
  if (!fs.existsSync(filePath)) {
    recentFiles = desk.removeRecent(recentFiles, filePath);
    persistRecent();
    await dialog.showMessageBox(mainWindow, { type: 'warning', title: S().missingTitle, message: S().missing(filePath), buttons: [S().ok] });
    return;
  }
  if (hasUnsavedChanges) {
    const choice = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      title: S().openTitle,
      message: S().openUnsaved(path.basename(filePath)),
      buttons: [S().openAnyway, S().cancel],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
    });
    if (choice.response !== 0) return;
  }
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    lastSavedPath = filePath;
    hasUnsavedChanges = false;
    mainWindow.webContents.send('file-opened', { filePath, content });
    addRecentFile(filePath);
  } catch (err) {
    dialog.showErrorBox(S().readErrorTitle, S().readError(err.message));
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
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

  // إعداد القائمة العربية للتطبيق
  setupNativeMenu();

  // تحديد مسار التشغيل: تطوير محلي أم حزمة الإنتاج
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  const devUrl = 'http://localhost:3000';
  const prodPath = path.join(__dirname, '..', 'dist', 'index.html');

  if (isDev && process.env.LOAD_DEV_SERVER === 'true') {
    mainWindow.loadURL(devUrl).catch(() => {
      // إذا فشل الاتصال بخادم التطوير، تحميل حزمة dist مباشرة
      if (fs.existsSync(prodPath)) {
        mainWindow.loadFile(prodPath);
      }
    });
  } else {
    if (fs.existsSync(prodPath)) {
      mainWindow.loadFile(prodPath);
    } else {
      mainWindow.loadURL(devUrl);
    }
  }

  // إظهار النافذة بسلاسة عند اكتمال الجاهزية
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // ملف طُلب فتحه بالنقر المزدوج: يُرسل بعد تحميل الواجهة واستماعها للحدث
  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingOpenPath) {
      const p = pendingOpenPath;
      pendingOpenPath = null;
      setTimeout(() => openProjectPath(p), 400);
    }
  });

  // منع اختصارات فتح أدوات المطور (F12 / Ctrl+Shift+I)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key.toLowerCase() === 'i')) {
      event.preventDefault();
    }
  });

  // فتح الروابط الخارجية في المتصفح الافتراضي بدلاً من نافذة التطبيق
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // مراقبة حدث إغلاق النافذة وسؤال المستخدم عند وجود تعديلات غير محفوظة (المرحلة 4)
  mainWindow.on('close', async (e) => {
    if (forceClose) return;

    if (hasUnsavedChanges) {
      e.preventDefault();
      await promptUnsavedChangesBeforeClose();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function setupNativeMenu() {
  const template = [
    {
      label: L('ملف', 'File'),
      submenu: [
        {
          label: L('مشروع جديد', 'New project'),
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow?.webContents.send('menu-action', 'new-project');
          },
        },
        {
          label: L('فتح ملف مشروع (.cadproj / .json)...', 'Open project file (.cadproj / .json)...'),
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            if (!mainWindow) return;
            const result = await dialog.showOpenDialog(mainWindow, {
              title: L('فتح ملف مشروع هندسي', 'Open engineering project'),
              filters: [
                { name: 'CAD Project Files', extensions: ['cadproj', 'json', 'cad'] },
                { name: 'All Files', extensions: ['*'] },
              ],
              properties: ['openFile'],
            });
            if (!result.canceled && result.filePaths.length > 0) {
              await openProjectPath(result.filePaths[0]);
            }
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
          click: () => {
            mainWindow?.webContents.send('menu-action', 'save-project');
          },
        },
        {
          label: L('حفظ المشروع باسم...', 'Save project as...'),
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            mainWindow?.webContents.send('menu-action', 'save-project-as');
          },
        },
        { type: 'separator' },
        {
          label: L('تصدير صورة عالية الدقة (PNG)...', 'Export high-resolution image (PNG)...'),
          click: () => {
            mainWindow?.webContents.send('menu-action', 'export-png');
          },
        },
        {
          label: L('تصدير تقرير هندسي (PDF)...', 'Export engineering report (PDF)...'),
          click: () => {
            mainWindow?.webContents.send('menu-action', 'export-pdf');
          },
        },
        {
          label: L('تصدير مخطط أوتوكاد (DXF)...', 'Export AutoCAD drawing (DXF)...'),
          click: () => {
            mainWindow?.webContents.send('menu-action', 'export-dxf');
          },
        },
        { type: 'separator' },
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
          click: () => mainWindow?.webContents.send('menu-action', 'undo'),
        },
        {
          label: L('إعادة', 'Redo'),
          accelerator: 'CmdOrCtrl+Y',
          click: () => mainWindow?.webContents.send('menu-action', 'redo'),
        },
        { type: 'separator' },
        {
          label: L('تحديد الكل', 'Select all'),
          accelerator: 'CmdOrCtrl+A',
          click: () => mainWindow?.webContents.send('menu-action', 'select-all'),
        },
        {
          label: L('حذف المحدد', 'Delete selected'),
          accelerator: 'Delete',
          click: () => mainWindow?.webContents.send('menu-action', 'delete-selected'),
        },
      ],
    },
    {
      label: L('عرض', 'View'),
      submenu: [
        { label: L('إعادة ضبط العرض', 'Reset view'), accelerator: 'CmdOrCtrl+0', click: () => mainWindow?.webContents.send('menu-action', 'reset-zoom') },
        { label: L('تكبير (+)', 'Zoom in (+)'), accelerator: 'CmdOrCtrl+=', click: () => mainWindow?.webContents.send('menu-action', 'zoom-in') },
        { label: L('تصغير (-)', 'Zoom out (-)'), accelerator: 'CmdOrCtrl+-', click: () => mainWindow?.webContents.send('menu-action', 'zoom-out') },
        { type: 'separator' },
        { role: 'reload', label: L('تحديث الشاشة', 'Reload') },
        { role: 'togglefullscreen', label: L('ملء الشاشة', 'Full screen') },
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
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'حول CAD Studio Desktop',
              message: 'نظام التصميم الهندسي الذكي (CAD Studio)',
              detail: 'تطبيق سطح المكتب المتكامل للتصميم والتدقيق الهندسي المعماري والكهروميكانيكي (MEP).\nيعمل بنظام Electron على ويندوز ولينكس.',
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// معالجات IPC للتواصل الآمن مع واجهة المستخدم
let lastSavedPath = null;
let hasUnsavedChanges = false;
let forceClose = false;
let isQuitting = false;

// نافذة حوار قبل الإغلاق في حال وجود تعديلات غير محفوظة (المرحلة 4)
async function promptUnsavedChangesBeforeClose() {
  if (!mainWindow || mainWindow.isDestroyed() || !hasUnsavedChanges || forceClose) {
    return true; // مسموح بالإغلاق
  }

  const choice = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['حفظ', 'تجاهل', 'إلغاء'],
    defaultId: 0,
    cancelId: 2,
    title: 'تعديلات غير محفوظة',
    message: 'يحتوي المشروع على تعديلات غير محفوظة. هل تريد حفظ المشروع قبل الإغلاق؟',
    detail: 'إذا اخترت "تجاهل"، فستفقد كل التعديلات الأخيرة التي لم يتم حفظها.',
    noLink: true,
  });

  if (choice.response === 0) {
    // خيار 1: حفظ المشروع ثم إغلاق
    mainWindow.webContents.send('trigger-save-and-close');
    return false; // ننتظر استجابة الحفظ قبل الإغلاق الفعلي
  } else if (choice.response === 1) {
    // خيار 2: تجاهل التعديلات والإغلاق فوراً
    forceClose = true;
    mainWindow.close();
    return true;
  } else {
    // خيار 3: إلغاء الخروج والبقاء داخل التطبيق
    isQuitting = false;
    return false;
  }
}

// 1. فتح نافذة حفظ ويندوز الحقيقية وكتابة ملف المشروع على القرص (المرحلة 4)
ipcMain.handle('save-project', async (_event, projectData, options = {}) => {
  if (!mainWindow) return { canceled: true };

  const defaultFileName = desk.defaultProjectFileName(projectData?.project?.name);

  let defaultPath = options.defaultPath || lastSavedPath;
  if (!defaultPath) {
    try {
      defaultPath = path.join(app.getPath('documents'), defaultFileName);
    } catch {
      defaultPath = defaultFileName;
    }
  }

  const res = await dialog.showSaveDialog(mainWindow, {
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
      const jsonContent = typeof projectData === 'string'
        ? projectData
        : JSON.stringify(projectData, null, 2);
      fs.writeFileSync(res.filePath, jsonContent, 'utf-8');
      lastSavedPath = res.filePath;
      hasUnsavedChanges = false;
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
ipcMain.handle('save-project-direct', async (_event, projectData, targetPath) => {
  const savePath = targetPath || lastSavedPath;
  if (!savePath) {
    return { success: false, error: 'No target path available for direct save' };
  }
  try {
    const jsonContent = typeof projectData === 'string'
      ? projectData
      : JSON.stringify(projectData, null, 2);
    fs.writeFileSync(savePath, jsonContent, 'utf-8');
    lastSavedPath = savePath;
    hasUnsavedChanges = false;
    return { success: true, filePath: savePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// الحصول على آخر مسار محفوظ
ipcMain.handle('get-last-saved-path', () => lastSavedPath);

// تحديث حالة التعديلات غير المحفوظة
ipcMain.on('set-unsaved-changes', (_event, value) => {
  hasUnsavedChanges = Boolean(value);
});

// استجابة واجهة المستخدم بعد إتمام حفظ الملف عند طلب الإغلاق
ipcMain.on('response-save-and-close', (_event, result) => {
  if (result && result.success) {
    hasUnsavedChanges = false;
    forceClose = true;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.close();
    }
  }
});

// إغلاق النافذة برمجياً
ipcMain.handle('window:close', (_event, options) => {
  if (options && options.force) forceClose = true;
  mainWindow?.close();
});

ipcMain.handle('dialog:saveFile', async (_event, options) => {
  if (!mainWindow) return { canceled: true };
  const res = await dialog.showSaveDialog(mainWindow, {
    title: options.title || 'حفظ الملف',
    defaultPath: options.defaultPath || 'project.json',
    filters: options.filters || [{ name: 'All Files', extensions: ['*'] }],
  });

  if (!res.canceled && res.filePath && options.content) {
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

ipcMain.handle('dialog:openFile', async (_event, options) => {
  if (!mainWindow) return { canceled: true };
  const res = await dialog.showOpenDialog(mainWindow, {
    title: options.title || 'فتح ملف',
    filters: options.filters || [{ name: 'All Files', extensions: ['*'] }],
    properties: ['openFile'],
  });

  if (!res.canceled && res.filePaths.length > 0) {
    const filePath = res.filePaths[0];
    try {
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
ipcMain.handle('recent:open', (_event, filePath) => {
  if (typeof filePath === 'string' && recentFiles.includes(filePath)) return openProjectPath(filePath);
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
    if (!mainWindow) return;
    const r = await dialog.showMessageBox(mainWindow, {
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
    if (manualCheck && mainWindow) dialog.showMessageBox(mainWindow, { type: 'info', title: S().updateTitle, message: S().upToDate(info?.version || app.getVersion()), buttons: [S().ok] });
    manualCheck = false;
  });
  autoUpdater.on('download-progress', (p) => {
    mainWindow?.setProgressBar(Math.max(0, Math.min(1, (p.percent || 0) / 100)));
  });
  autoUpdater.on('update-downloaded', async (info) => {
    mainWindow?.setProgressBar(-1);
    if (!mainWindow) return;
    const r = await dialog.showMessageBox(mainWindow, {
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
    mainWindow?.setProgressBar(-1);
    if (manualCheck && mainWindow) dialog.showMessageBox(mainWindow, { type: 'warning', title: S().updateTitle, message: S().updateError(err?.message || String(err)), buttons: [S().ok] });
    manualCheck = false;
  });
}

function checkForUpdates(manual) {
  if (isPortable || !app.isPackaged || !autoUpdater) {
    if (manual && mainWindow) {
      const msg = isPortable ? S().portableNote : S().upToDate(app.getVersion());
      dialog.showMessageBox(mainWindow, { type: 'info', title: S().updateTitle, message: msg, buttons: [S().ok] });
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
  createWindow();
  // فحص صامت للتحديثات بعد الإقلاع بقليل
  setTimeout(() => checkForUpdates(false), 8000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', async (e) => {
  if (forceClose) return;

  if (hasUnsavedChanges && mainWindow && !mainWindow.isDestroyed()) {
    e.preventDefault();
    isQuitting = true;
    const canClose = await promptUnsavedChangesBeforeClose();
    if (canClose && forceClose) {
      app.quit();
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
