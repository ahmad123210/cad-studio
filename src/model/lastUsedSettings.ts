/**
 * @file src/model/lastUsedSettings.ts
 * @description إدارة وحفظ آخر إعدادات مستخدمة (Last Used Settings)
 * تحفظ في الذاكرة وتخزن تلقائياً في localStorage لضمان استمرارية تجربة المستخدم
 */

import { DoorOpenDirection } from './types.ts';

export type GridDensity = 'fine' | 'medium' | 'coarse';
export type ThemeMode = 'dark' | 'light';

export interface LastUsedSettings {
  wallThickness: number; // بكسل (افتراضياً 20 = 20سم عند مقياس 1م = 100سم)
  doorWidth: number; // بكسل (افتراضياً 45 = 90سم)
  doorDirection: DoorOpenDirection; // افتراضياً 'inward_right'
  windowWidth: number; // بكسل (افتراضياً 60 = 120سم)
  windowHeight: number; // متر (افتراضياً 1.2م)
  windowSillHeight: number; // متر (افتراضياً 0.9م)
  dimensionOffset: number; // بكسل (افتراضياً 20)
  gridDensity: GridDensity; // دقة الشبكة: دقيق، متوسط، خشن
  themeMode: ThemeMode; // الوضع الداكن أو النهاري
  autoSaveEnabled: boolean; // تفعيل الحفظ التلقائي (المرحلة 4)
  autoSaveIntervalMinutes: number; // الفترة الزمنية بالدقائق (افتراضياً 5 دقائق)
  lastSavedPath: string | null; // آخر مسار ملف تم الحفظ فيه على ويندوز
  textFontSize: number; // حجم خط الملاحظات والتلميحات (افتراضياً 16)
  textColor: string; // لون خط الملاحظات (افتراضياً #38bdf8)
  textFontWeight: 'normal' | 'bold'; // سماكة خط الملاحظة
  textAlign: 'right' | 'center' | 'left'; // محاذاة النص
  showWallLengths: boolean; // إظهار أو إخفاء أطوال الجدران بالمخطط
  symbolScale: number; // مقياس حجم الرموز الموحد (افتراضياً 1.0)
  symbolColor: string; // اللون الافتراضي للرمز (افتراضياً '#f59e0b')
  symbolKindSettings: Record<string, { scale: number; color?: string; rotation?: number }>; // الاحتفاظ بآخر حجم وتنسيق لكل نوع رمز
  /** اختصارات مخصصة: معرف الأمر ← KeyboardEvent.code (مثل KeyL). الغائب = الافتراضي */
  customShortcuts?: Record<string, string>;
}

const STORAGE_KEY = 'cad_studio_last_used_settings';

const DEFAULT_SETTINGS: LastUsedSettings = {
  wallThickness: 20,
  doorWidth: 45,
  doorDirection: 'inward_right',
  windowWidth: 60,
  windowHeight: 1.2,
  windowSillHeight: 0.9,
  dimensionOffset: 20,
  gridDensity: 'medium',
  themeMode: 'dark',
  autoSaveEnabled: false,
  autoSaveIntervalMinutes: 5,
  lastSavedPath: null,
  textFontSize: 16,
  textColor: '#38bdf8',
  textFontWeight: 'normal',
  textAlign: 'right',
  showWallLengths: true,
  symbolScale: 1.0,
  symbolColor: '#f59e0b',
  symbolKindSettings: {},
};

/**
 * حساب إعدادات الشبكة بناءً على مستوى الدقة ومقياس الرسم
 */
export function getGridOptionsForDensity(
  density: GridDensity,
  scale: number = 50
): { gridSize: number; snapRadius: number; stepMeters: number; label: string } {
  const safeScale = scale > 0 ? scale : 50;

  if (density === 'fine') {
    const stepMeters = 0.10; // 10 cm
    const gridSize = Math.max(5, Math.round(safeScale * stepMeters * 10) / 10);
    return { gridSize, snapRadius: 6, stepMeters, label: 'دقيق (10cm)' };
  } else if (density === 'coarse') {
    const stepMeters = 0.50; // 50 cm
    const gridSize = Math.max(15, Math.round(safeScale * stepMeters * 10) / 10);
    return { gridSize, snapRadius: 12, stepMeters, label: 'خشن (50cm)' };
  } else {
    // medium (default)
    const stepMeters = 0.25; // 25 cm
    const gridSize = Math.max(8, Math.round(safeScale * stepMeters * 10) / 10);
    return { gridSize, snapRadius: 8, stepMeters, label: 'متوسط (25cm)' };
  }
}

let cachedSettings: LastUsedSettings | null = null;

export function getLastUsedSettings(): LastUsedSettings {
  if (cachedSettings) {
    return { ...cachedSettings };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      cachedSettings = {
        wallThickness: typeof parsed.wallThickness === 'number' ? parsed.wallThickness : DEFAULT_SETTINGS.wallThickness,
        doorWidth: typeof parsed.doorWidth === 'number' ? parsed.doorWidth : DEFAULT_SETTINGS.doorWidth,
        doorDirection: parsed.doorDirection || DEFAULT_SETTINGS.doorDirection,
        windowWidth: typeof parsed.windowWidth === 'number' ? parsed.windowWidth : DEFAULT_SETTINGS.windowWidth,
        windowHeight: typeof parsed.windowHeight === 'number' ? parsed.windowHeight : DEFAULT_SETTINGS.windowHeight,
        windowSillHeight: typeof parsed.windowSillHeight === 'number' ? parsed.windowSillHeight : DEFAULT_SETTINGS.windowSillHeight,
        dimensionOffset: typeof parsed.dimensionOffset === 'number' ? parsed.dimensionOffset : DEFAULT_SETTINGS.dimensionOffset,
        gridDensity: (parsed.gridDensity === 'fine' || parsed.gridDensity === 'coarse' || parsed.gridDensity === 'medium')
          ? parsed.gridDensity
          : DEFAULT_SETTINGS.gridDensity,
        themeMode: (parsed.themeMode === 'light' || parsed.themeMode === 'dark')
          ? parsed.themeMode
          : DEFAULT_SETTINGS.themeMode,
        autoSaveEnabled: typeof parsed.autoSaveEnabled === 'boolean' ? parsed.autoSaveEnabled : DEFAULT_SETTINGS.autoSaveEnabled,
        autoSaveIntervalMinutes: typeof parsed.autoSaveIntervalMinutes === 'number' && parsed.autoSaveIntervalMinutes > 0
          ? parsed.autoSaveIntervalMinutes
          : DEFAULT_SETTINGS.autoSaveIntervalMinutes,
        lastSavedPath: typeof parsed.lastSavedPath === 'string' ? parsed.lastSavedPath : DEFAULT_SETTINGS.lastSavedPath,
        textFontSize: typeof parsed.textFontSize === 'number' && parsed.textFontSize >= 6 && parsed.textFontSize <= 200
          ? parsed.textFontSize
          : DEFAULT_SETTINGS.textFontSize,
        textColor: typeof parsed.textColor === 'string' && parsed.textColor.length > 0
          ? parsed.textColor
          : DEFAULT_SETTINGS.textColor,
        textFontWeight: parsed.textFontWeight === 'bold' ? 'bold' : 'normal',
        textAlign: (parsed.textAlign === 'left' || parsed.textAlign === 'center' || parsed.textAlign === 'right')
          ? parsed.textAlign
          : DEFAULT_SETTINGS.textAlign,
        showWallLengths: typeof parsed.showWallLengths === 'boolean'
          ? parsed.showWallLengths
          : DEFAULT_SETTINGS.showWallLengths,
        symbolScale: typeof parsed.symbolScale === 'number' && parsed.symbolScale > 0
          ? parsed.symbolScale
          : DEFAULT_SETTINGS.symbolScale,
        symbolColor: typeof parsed.symbolColor === 'string' && parsed.symbolColor.length > 0
          ? parsed.symbolColor
          : DEFAULT_SETTINGS.symbolColor,
        symbolKindSettings: typeof parsed.symbolKindSettings === 'object' && parsed.symbolKindSettings !== null
          ? parsed.symbolKindSettings
          : DEFAULT_SETTINGS.symbolKindSettings,
      };
      return { ...cachedSettings };
    }
  } catch (err) {
    console.warn('Could not read last used settings from localStorage:', err);
  }

  cachedSettings = { ...DEFAULT_SETTINGS };
  return { ...cachedSettings };
}

/**
 * استرجاع آخر إعدادات تم استخدامها لرمز معين أو الإعدادات العامة
 */
export function getLastUsedSymbolConfig(kind?: string): { scale: number; color?: string; rotation?: number } {
  const settings = getLastUsedSettings();
  if (kind && settings.symbolKindSettings && settings.symbolKindSettings[kind]) {
    return {
      scale: settings.symbolKindSettings[kind].scale || settings.symbolScale || 1.0,
      color: settings.symbolKindSettings[kind].color || settings.symbolColor,
      rotation: settings.symbolKindSettings[kind].rotation || 0,
    };
  }
  return {
    scale: settings.symbolScale || 1.0,
    color: settings.symbolColor,
    rotation: 0,
  };
}

/**
 * حفظ آخر إعدادات تم استخدامها لرمز معين عند وضعه أو تعديله
 */
export function saveLastUsedSymbolConfig(kind: string, config: { scale?: number; color?: string; rotation?: number }): void {
  const current = getLastUsedSettings();
  const kindSettings = { ...(current.symbolKindSettings || {}) };
  const prevKind = kindSettings[kind] || { scale: current.symbolScale || 1.0, color: current.symbolColor };

  kindSettings[kind] = {
    scale: config.scale !== undefined ? config.scale : prevKind.scale,
    color: config.color !== undefined ? config.color : prevKind.color,
    rotation: config.rotation !== undefined ? config.rotation : prevKind.rotation,
  };

  updateLastUsedSettings({
    symbolScale: config.scale !== undefined ? config.scale : current.symbolScale,
    symbolColor: config.color !== undefined ? config.color : current.symbolColor,
    symbolKindSettings: kindSettings,
  });
}

export function updateLastUsedSettings(updates: Partial<LastUsedSettings>): LastUsedSettings {
  const current = getLastUsedSettings();
  const next: LastUsedSettings = {
    ...current,
    ...updates,
  };

  cachedSettings = next;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn('Could not save last used settings to localStorage:', err);
  }

  return { ...next };
}
