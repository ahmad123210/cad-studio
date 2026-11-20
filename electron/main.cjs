/**
 * @file electron/main.cjs
 * @description Electron Main Process for CAD Studio Windows Application
 * مُصمم ليعمل بسلاسة على بيئات ويندوز، ومُحسّن لاستهلاك الموارد والأجهزة الاقتصادية
 */

const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// تعطيل التحذيرات غير الضرورية لتسريع الأداء
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';

// تحسينات أداء الرسوميات والذاكرة خصيصاً للمعالجات الاقتصادية
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('disable-software-rasterizer', 'false');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: 'نظام التصميم الهندسي الذكي - CAD Studio',
    icon: path.join(__dirname, '..', 'public', 'icon.svg'),
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
      label: 'ملف',
      submenu: [
        {
          label: 'مشروع جديد',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow?.webContents.send('menu-action', 'new-project');
          },
        },
        {
          label: 'فتح ملف مشروع (.json / .cad)...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            if (!mainWindow) return;
            const result = await dialog.showOpenDialog(mainWindow, {
              title: 'فتح ملف مشروع هندسي',
              filters: [
                { name: 'CAD Project Files', extensions: ['json', 'cad'] },
                { name: 'All Files', extensions: ['*'] },
              ],
              properties: ['openFile'],
            });
            if (!result.canceled && result.filePaths.length > 0) {
              const filePath = result.filePaths[0];
              try {
                const content = fs.readFileSync(filePath, 'utf-8');
                lastSavedPath = filePath;
                hasUnsavedChanges = false;
                mainWindow.webContents.send('file-opened', { filePath, content });
              } catch (err) {
                dialog.showErrorBox('خطأ في القراءة', `تعذر فتح الملف: ${err.message}`);
              }
            }
          },
        },
        {
          label: 'حفظ المشروع',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow?.webContents.send('menu-action', 'save-project');
          },
        },
        {
          label: 'حفظ المشروع باسم...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            mainWindow?.webContents.send('menu-action', 'save-project-as');
          },
        },
        { type: 'separator' },
        {
          label: 'تصدير صورة عالية الدقة (PNG)...',
          click: () => {
            mainWindow?.webContents.send('menu-action', 'export-png');
          },
        },
        {
          label: 'تصدير تقرير هندسي (PDF)...',
          click: () => {
            mainWindow?.webContents.send('menu-action', 'export-pdf');
          },
        },
        {
          label: 'تصدير مخطط أوتوكاد (DXF)...',
          click: () => {
            mainWindow?.webContents.send('menu-action', 'export-dxf');
          },
        },
        { type: 'separator' },
        {
          label: 'خروج',
          accelerator: 'Alt+F4',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: 'تعديل',
      submenu: [
        {
          label: 'تراجع',
          accelerator: 'CmdOrCtrl+Z',
          click: () => mainWindow?.webContents.send('menu-action', 'undo'),
        },
        {
          label: 'إعادة',
          accelerator: 'CmdOrCtrl+Y',
          click: () => mainWindow?.webContents.send('menu-action', 'redo'),
        },
        { type: 'separator' },
        {
          label: 'تحديد الكل',
          accelerator: 'CmdOrCtrl+A',
          click: () => mainWindow?.webContents.send('menu-action', 'select-all'),
        },
        {
          label: 'حذف المحدد',
          accelerator: 'Delete',
          click: () => mainWindow?.webContents.send('menu-action', 'delete-selected'),
        },
      ],
    },
    {
      label: 'عرض',
      submenu: [
        { label: 'إعادة ضبط العرض', accelerator: 'CmdOrCtrl+0', click: () => mainWindow?.webContents.send('menu-action', 'reset-zoom') },
        { label: 'تكبير (+)', accelerator: 'CmdOrCtrl+=', click: () => mainWindow?.webContents.send('menu-action', 'zoom-in') },
        { label: 'تصغير (-)', accelerator: 'CmdOrCtrl+-', click: () => mainWindow?.webContents.send('menu-action', 'zoom-out') },
        { type: 'separator' },
        { role: 'reload', label: 'تحديث الشاشة' },
        { role: 'togglefullscreen', label: 'ملء الشاشة' },
      ],
    },
    {
      label: 'مساعدة',
      submenu: [
        {
          label: 'حول البرنامج',
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

  const defaultFileName = (projectData?.project?.name ? `${projectData.project.name}.json` : 'cad-project.json')
    .replace(/[\\/:*?"<>|]/g, '_');

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
      { name: 'ملفات مشاريع كاد (*.json)', extensions: ['json'] },
      { name: 'جميع الملفات (*.*)', extensions: ['*'] },
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

app.whenReady().then(() => {
  createWindow();

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
