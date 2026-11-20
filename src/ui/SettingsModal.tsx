/**
 * @file SettingsModal.tsx
 * @description نافذة إعدادات التطبيق وخيارات الحفظ التلقائي وملفات ويندوز (المرحلة 4)
 */

import React, { useState, useEffect } from 'react';
import { BackupsPanel } from './BackupsPanel.tsx';
import {
  X,
  Settings,
  Save,
  Clock,
  HardDrive,
  FolderOpen,
  CheckCircle2,
  AlertTriangle,
  Monitor,
  Grid,
  Sun,
  Moon,
  Ruler,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';
import {
  LastUsedSettings,
  getLastUsedSettings,
  updateLastUsedSettings,
  GridDensity,
  ThemeMode,
} from '../model/lastUsedSettings.ts';
import { ProjectModel } from '../model/project.ts';
import { UnitType } from '../model/types.ts';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  model: ProjectModel;
  onSaveAs: () => Promise<void>;
  onTriggerAutoSaveNow?: () => void;
  onThemeChange?: (theme: ThemeMode) => void;
  onGridDensityChange?: (density: GridDensity) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  model,
  onSaveAs,
  onTriggerAutoSaveNow,
  onThemeChange,
  onGridDensityChange,
}) => {
  const [settings, setSettings] = useState<LastUsedSettings>(getLastUsedSettings());
  const [electronVersion, setElectronVersion] = useState<string>('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const isElectron = Boolean(window.electronAPI?.isElectron);

  useEffect(() => {
    if (isOpen) {
      const current = getLastUsedSettings();
      setSettings(current);
      if (window.electronAPI?.getVersion) {
        window.electronAPI.getVersion().then((v) => setElectronVersion(v)).catch(() => {});
      }
      if (window.electronAPI?.getLastSavedPath) {
        window.electronAPI.getLastSavedPath().then((p) => {
          if (p && p !== current.lastSavedPath) {
            const updated = updateLastUsedSettings({ lastSavedPath: p });
            setSettings(updated);
          }
        });
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleAutoSave = (enabled: boolean) => {
    const updated = updateLastUsedSettings({ autoSaveEnabled: enabled });
    setSettings(updated);
    showNotice(enabled ? 'تم تفعيل الحفظ التلقائي' : 'تم تعطيل الحفظ التلقائي');
  };

  const handleIntervalChange = (minutes: number) => {
    const val = Math.max(1, Math.min(60, Math.round(minutes)));
    const updated = updateLastUsedSettings({ autoSaveIntervalMinutes: val });
    setSettings(updated);
    showNotice(`تم ضبط الحفظ التلقائي كل ${val} دقائق`);
  };

  const handleGridDensity = (density: GridDensity) => {
    const updated = updateLastUsedSettings({ gridDensity: density });
    setSettings(updated);
    onGridDensityChange?.(density);
  };

  const handleTheme = (theme: ThemeMode) => {
    const updated = updateLastUsedSettings({ themeMode: theme });
    setSettings(updated);
    onThemeChange?.(theme);
  };

  const handleUnit = (unit: UnitType) => {
    model.setMeta({ unit });
    setSettings({ ...settings });
  };

  const showNotice = (msg: string) => {
    setSaveSuccessMsg(msg);
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  const currentUnit = model.getMeta().unit || 'meter';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-2xl bg-[var(--cad-panel-bg)] border border-[var(--cad-border)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* رأس النافذة */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--cad-border)] bg-[var(--cad-panel-header)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/30 text-sky-400 flex items-center justify-center font-bold">
              <Settings size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--cad-text-primary)]">
                إعدادات التطبيق والحفظ
              </h2>
              <p className="text-xs text-[var(--cad-text-muted)]">
                إدارة الحفظ التلقائي، ملفات ويندوز، ودقة مساحة العمل
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--cad-text-muted)] hover:text-[var(--cad-text-primary)] hover:bg-[var(--cad-surface-hover)] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* محتوى الإعدادات */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-[var(--cad-text-primary)]">
          {saveSuccessMsg && (
            <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {/* 1. قسم الحفظ والملفات (خاص بـ Windows / Electron) - المرحلة 4 */}
          <div className="bg-[var(--cad-surface-bg)] border border-[var(--cad-border)] rounded-xl p-4.5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--cad-border)]">
              <div className="flex items-center gap-2">
                <HardDrive size={18} className="text-sky-400" />
                <span className="font-bold text-sm">الحفظ التلقائي وملفات المشروع</span>
              </div>
              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono-cad">
                {isElectron ? 'Windows Electron' : 'Web Storage'}
              </span>
            </div>

            {/* تفعيل الحفظ التلقائي */}
            <div className="flex items-center justify-between">
              <div>
                <label className="font-semibold text-xs text-[var(--cad-text-primary)] block cursor-pointer">
                  تفعيل الحفظ التلقائي الدوري (Auto-Save)
                </label>
                <p className="text-[11px] text-[var(--cad-text-muted)] mt-0.5">
                  حفظ التعديلات تلقائياً في نفس ملف المشروع دون مقاطعة عملك
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoSaveEnabled}
                  onChange={(e) => handleToggleAutoSave(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-[var(--cad-input-bg)] border border-[var(--cad-border)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
              </label>
            </div>

            {/* إعداد الفترة الزمنية */}
            <div
              className={`pt-2 transition-opacity ${
                settings.autoSaveEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-[var(--cad-text-secondary)]">
                  <Clock size={15} className="text-amber-400 shrink-0" />
                  <span>حفظ تلقائي كل:</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={settings.autoSaveIntervalMinutes}
                      onChange={(e) => handleIntervalChange(Number(e.target.value))}
                      className="w-16 px-2 py-1 text-center bg-[var(--cad-input-bg)] border border-[var(--cad-border)] rounded text-xs font-mono-cad font-bold text-[var(--cad-text-primary)] focus:border-sky-500 outline-none"
                    />
                    <span className="font-medium">دقائق</span>
                  </div>
                </div>

                {/* أزرار سريعة لاختيار المدة */}
                <div className="flex items-center gap-1">
                  {[1, 2, 5, 10, 15].map((m) => (
                    <button
                      key={m}
                      onClick={() => handleIntervalChange(m)}
                      className={`px-2 py-1 text-[11px] rounded font-mono-cad border transition-colors ${
                        settings.autoSaveIntervalMinutes === m
                          ? 'bg-sky-600 text-white border-sky-500 font-bold'
                          : 'bg-[var(--cad-panel-bg)] text-[var(--cad-text-muted)] border-[var(--cad-border)] hover:bg-[var(--cad-surface-hover)] hover:text-[var(--cad-text-primary)]'
                      }`}
                    >
                      {m}د
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* بطاقة مسار آخر ملف تم الحفظ فيه */}
            <div className="p-3 bg-[var(--cad-panel-bg)] border border-[var(--cad-border)] rounded-lg space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[var(--cad-text-secondary)] flex items-center gap-1.5">
                  <FolderOpen size={14} className="text-amber-400" />
                  مسار الملف الحالي على القرص (lastSavedPath):
                </span>
                {settings.lastSavedPath ? (
                  <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-medium">
                    متصل بالملف
                  </span>
                ) : (
                  <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-medium">
                    لم يُحفظ كملف بعد
                  </span>
                )}
              </div>

              <div className="font-mono-cad text-xs bg-[var(--cad-input-bg)] border border-[var(--cad-border)] px-2.5 py-1.5 rounded text-[var(--cad-text-primary)] truncate dir-ltr text-left">
                {settings.lastSavedPath || 'لم يتم حفظ الملف على القرص بعد (يتم الحفظ في الذاكرة المؤقتة)'}
              </div>

              <div className="flex items-center justify-between pt-1">
                <p className="text-[11px] text-[var(--cad-text-muted)]">
                  {settings.lastSavedPath
                    ? 'سيتم الحفظ التلقائي في هذا الملف مباشرة على جهازك.'
                    : 'احفظ المشروع باسم لتحديد مجلد الملف على ويندوز لأول مرة.'}
                </p>
                <button
                  onClick={async () => {
                    await onSaveAs();
                    const updated = getLastUsedSettings();
                    setSettings(updated);
                  }}
                  className="px-3 py-1 bg-sky-600 hover:bg-sky-500 text-white rounded-md text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-colors shrink-0"
                >
                  <Save size={13} />
                  <span>{settings.lastSavedPath ? 'حفظ باسم جديد...' : 'حفظ باسم على ويندوز'}</span>
                </button>
              </div>
            </div>
          </div>

          <BackupsPanel model={model} />

          {/* 2. قسم دقة الشبكة ومقياس الرسم */}
          <div className="bg-[var(--cad-surface-bg)] border border-[var(--cad-border)] rounded-xl p-4.5 space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-[var(--cad-border)]">
              <Grid size={16} className="text-emerald-400" />
              <span className="font-bold text-sm">دقة الشبكة والالتقاط (Grid Density)</span>
            </div>

            <p className="text-xs text-[var(--cad-text-muted)]">
              تحديد المسافة بين نقاط الشبكة وقوة الالتصاق أثناء رسم الجدران والأبعاد
            </p>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => handleGridDensity('fine')}
                className={`p-2.5 rounded-lg border text-center transition-all ${
                  settings.gridDensity === 'fine'
                    ? 'bg-emerald-600/15 border-emerald-500 text-emerald-300 font-bold'
                    : 'bg-[var(--cad-panel-bg)] border-[var(--cad-border)] text-[var(--cad-text-secondary)] hover:bg-[var(--cad-surface-hover)]'
                }`}
              >
                <div className="text-xs font-bold">دقيق جداً</div>
                <div className="text-[10px] text-[var(--cad-text-muted)] font-mono-cad mt-0.5">10cm / snap 6px</div>
              </button>

              <button
                onClick={() => handleGridDensity('medium')}
                className={`p-2.5 rounded-lg border text-center transition-all ${
                  settings.gridDensity === 'medium'
                    ? 'bg-emerald-600/15 border-emerald-500 text-emerald-300 font-bold'
                    : 'bg-[var(--cad-panel-bg)] border-[var(--cad-border)] text-[var(--cad-text-secondary)] hover:bg-[var(--cad-surface-hover)]'
                }`}
              >
                <div className="text-xs font-bold">متوسط (افتراضي)</div>
                <div className="text-[10px] text-[var(--cad-text-muted)] font-mono-cad mt-0.5">25cm / snap 8px</div>
              </button>

              <button
                onClick={() => handleGridDensity('coarse')}
                className={`p-2.5 rounded-lg border text-center transition-all ${
                  settings.gridDensity === 'coarse'
                    ? 'bg-emerald-600/15 border-emerald-500 text-emerald-300 font-bold'
                    : 'bg-[var(--cad-panel-bg)] border-[var(--cad-border)] text-[var(--cad-text-secondary)] hover:bg-[var(--cad-surface-hover)]'
                }`}
              >
                <div className="text-xs font-bold">خشن وسريع</div>
                <div className="text-[10px] text-[var(--cad-text-muted)] font-mono-cad mt-0.5">50cm / snap 12px</div>
              </button>
            </div>
          </div>

          {/* 3. المظهر ووحدة القياس */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* المظهر */}
            <div className="bg-[var(--cad-surface-bg)] border border-[var(--cad-border)] rounded-xl p-4 space-y-2">
              <span className="font-bold text-xs flex items-center gap-1.5 text-[var(--cad-text-primary)]">
                {settings.themeMode === 'dark' ? <Moon size={15} className="text-sky-400" /> : <Sun size={15} className="text-amber-400" />}
                مظهر الواجهة (Theme)
              </span>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => handleTheme('dark')}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                    settings.themeMode === 'dark'
                      ? 'bg-neutral-800 text-white border-sky-500'
                      : 'bg-[var(--cad-panel-bg)] text-[var(--cad-text-muted)] border-[var(--cad-border)] hover:bg-[var(--cad-surface-hover)]'
                  }`}
                >
                  <Moon size={14} className="text-sky-400" />
                  <span>داكن (مريح)</span>
                </button>
                <button
                  onClick={() => handleTheme('light')}
                  className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                    settings.themeMode === 'light'
                      ? 'bg-neutral-100 text-neutral-900 border-sky-500'
                      : 'bg-[var(--cad-panel-bg)] text-[var(--cad-text-muted)] border-[var(--cad-border)] hover:bg-[var(--cad-surface-hover)]'
                  }`}
                >
                  <Sun size={14} className="text-amber-500" />
                  <span>نهاري (فاتح)</span>
                </button>
              </div>
            </div>

            {/* وحدة القياس */}
            <div className="bg-[var(--cad-surface-bg)] border border-[var(--cad-border)] rounded-xl p-4 space-y-2">
              <span className="font-bold text-xs flex items-center gap-1.5 text-[var(--cad-text-primary)]">
                <Ruler size={15} className="text-teal-400" />
                وحدة القياس للمشروع
              </span>
              <select
                value={currentUnit}
                onChange={(e) => handleUnit(e.target.value as UnitType)}
                className="w-full mt-1 bg-[var(--cad-input-bg)] border border-[var(--cad-border)] text-[var(--cad-text-primary)] rounded-lg px-3 py-2 text-xs outline-none focus:border-sky-500"
              >
                <option value="meter">متر (Meter - m)</option>
                <option value="cm">سنتيمتر (Centimeter - cm)</option>
                <option value="mm">مليمتر (Millimeter - mm)</option>
              </select>
            </div>
          </div>

          {/* 4. خيارات العرض الهندسي (إظهار/إخفاء أطوال الجدران) */}
          <div className="bg-[var(--cad-surface-bg)] border border-[var(--cad-border)] rounded-xl p-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="font-bold text-xs flex items-center gap-1.5 text-[var(--cad-text-primary)]">
                <Ruler size={15} className="text-sky-400" />
                عرض أطوال الجدران على المخطط (Wall Dimensions)
              </span>
              <p className="text-[11px] text-[var(--cad-text-muted)]">
                إظهار شارات أطوال الجدران بالمتر موازية للجدران لتسهيل القراءة الهندسية
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const nextVal = settings.showWallLengths === false ? true : false;
                setSettings(updateLastUsedSettings({ showWallLengths: nextVal }));
              }}
              className={`py-1.5 px-3 rounded-lg border text-xs font-semibold transition-colors ${
                settings.showWallLengths !== false
                  ? 'bg-sky-600/20 text-sky-400 border-sky-500/50'
                  : 'bg-[var(--cad-panel-bg)] text-[var(--cad-text-muted)] border-[var(--cad-border)] hover:bg-[var(--cad-surface-hover)]'
              }`}
            >
              {settings.showWallLengths !== false ? 'مُفعّل (ظاهر) ✓' : 'مُعطّل (مخفي)'}
            </button>
          </div>
        </div>

        {/* تذييل النافذة */}
        <div className="px-6 py-3.5 border-t border-[var(--cad-border)] bg-[var(--cad-panel-header)] flex items-center justify-between">
          <div className="text-[11px] text-[var(--cad-text-muted)] flex items-center gap-1.5">
            <Monitor size={13} />
            <span>
              {isElectron
                ? `بيئة تشغيل سطح المكتب Electron ${electronVersion ? `(v${electronVersion})` : ''}`
                : 'يعمل عبر متصفح الويب الحديث'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold transition-colors shadow-xs"
          >
            إغلاق وحفظ الإعدادات
          </button>
        </div>
      </div>
    </div>
  );
};
