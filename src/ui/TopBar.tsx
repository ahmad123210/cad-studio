/**
 * @file TopBar.tsx
 * @description شريط التحكم العلوي للمشروع.
 * يحتوي على اسم المشروع، أزرار الحفظ، التراجع، الإعادة، وتصدير/استيراد ملفات JSON.
 */

import React, { useRef, useState } from 'react';
import {
  Save,
  Undo2,
  Redo2,
  Download,
  Upload,
  FolderPlus,
  HelpCircle,
  CheckCircle2,
  Layers,
  Zap,
  FileSpreadsheet,
  PanelRightClose,
  PanelRightOpen,
  Sun,
  Moon,
  Settings,
  ChevronDown,
  Ruler,
} from 'lucide-react';
import { ProjectModel } from '../model/project.ts';
import { getLang, setLang, type UiLang } from '../i18n/index.ts';
import { ProjectData, UnitType } from '../model/types.ts';

interface TopBarProps {
  model: ProjectModel;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onSaveAs?: () => void;
  onNewProject: () => void;
  onOpenLayers: () => void;
  onOpenSymbols?: () => void;
  onOpenScheduleBOQ?: () => void;
  onOpenHelp: () => void;
  onOpenSettings?: () => void;
  isPropertiesPanelVisible?: boolean;
  onTogglePropertiesPanel?: () => void;
  isSaved: boolean;
  lastSavedPath?: string | null;
  autoSaveActive?: boolean;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  showWallLengths?: boolean;
  onToggleWallLengths?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  model,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  onSaveAs,
  onNewProject,
  onOpenLayers,
  onOpenSymbols,
  onOpenScheduleBOQ,
  onOpenHelp,
  onOpenSettings,
  isPropertiesPanelVisible = true,
  onTogglePropertiesPanel,
  isSaved,
  lastSavedPath,
  autoSaveActive,
  theme,
  onToggleTheme,
  showWallLengths = true,
  onToggleWallLengths,
}) => {
  const meta = model.getMeta();
  const [isEditingName, setIsEditingName] = useState(false);
  const [uiLang, setUiLang] = useState<UiLang>(getLang());
  // تتبع تغيّر اللغة من مصادر أخرى (بحث الأوامر Ctrl+K)
  React.useEffect(() => {
    const sync = () => setUiLang(getLang());
    window.addEventListener('cad:lang', sync);
    return () => window.removeEventListener('cad:lang', sync);
  }, []);
  const [projectName, setProjectName] = useState(meta.name);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNameBlur = () => {
    setIsEditingName(false);
    if (projectName.trim()) {
      model.setMeta({ name: projectName.trim() });
    } else {
      setProjectName(meta.name);
    }
  };

  const handleUnitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    model.setMeta({ unit: e.target.value as UnitType });
  };

  // تصدير المشروع كملف JSON
  const handleExportJSON = () => {
    const data = model.toJSON();
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${meta.name || 'project'}_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // استيراد مشروع من ملف JSON
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string) as ProjectData;
        if (!parsed.project || !parsed.layers) {
          alert('الملف المحدد ليس ملف مخطط هندسي صالح.');
          return;
        }
        // الترحيل والتحقق: العناصر التالفة تُصلح أو تُهمل مع تقرير بدلاً من كسر المشروع
        const warnings = model.loadFromJSON(parsed);
        setProjectName(parsed.project.name || 'مشروع مستورد');
        if (warnings.length) alert('فُتح الملف مع ملاحظات:\n' + warnings.join('\n'));
      } catch (err) {
        alert('حدث خطأ أثناء قراءة ملف JSON: ' + (err as Error).message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <header className="h-14 bg-[var(--cad-panel-header)] border-b border-[var(--cad-border)] px-4 flex items-center justify-between text-[var(--cad-text-primary)] select-none z-20 transition-colors">
      {/* القسم الأيمن: تعديل اسم المشروع وحالة الحفظ */}
      <div className="flex items-center gap-3">
        {/* تعديل اسم المشروع */}
        <div className="flex items-center gap-2">
          {isEditingName ? (
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={(e) => e.key === 'Enter' && handleNameBlur()}
              autoFocus
              className="bg-[var(--cad-input-bg)] text-sm px-2 py-1 rounded text-[var(--cad-text-primary)] border border-sky-500 outline-none w-48 font-medium"
            />
          ) : (
            <button
              onClick={() => setIsEditingName(true)}
              className="text-sm font-semibold text-[var(--cad-text-primary)] hover:text-sky-400 px-2 py-1 rounded hover:bg-[var(--cad-surface-hover)] transition-colors flex items-center gap-1"
              title="انقر لتعديل اسم المشروع"
            >
              {meta.name ? <span data-no-i18n>{meta.name}</span> : <span>مشروع بدون اسم</span>}
              <span className="text-xs text-[var(--cad-text-muted)]">✏️</span>
            </button>
          )}

          {/* حالة الحفظ */}
          <div
            className="flex items-center gap-1.5 text-[11px] text-[var(--cad-text-secondary)] bg-[var(--cad-panel-bg)] px-2.5 py-0.5 rounded-full border border-[var(--cad-border)]"
            title={lastSavedPath ? `مسار الملف: ${lastSavedPath}` : 'محفوظ محلياً'}
          >
            {isSaved ? (
              <>
                <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                <span className="text-emerald-400 font-medium truncate max-w-[140px]">
                  {lastSavedPath ? lastSavedPath.split(/[\\/]/).pop() : 'محفوظ'}
                </span>
                {autoSaveActive && (
                  <span
                    className="text-[9px] bg-sky-500/15 text-sky-400 border border-sky-500/30 px-1 py-0.2 rounded font-mono-cad"
                    title="الحفظ التلقائي نشط"
                  >
                    تلقائي
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
                <span className="text-amber-300">تعديلات غير محفوظة</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* القسم الأوسط: أدوات التحكم الأساسية فقط (حفظ، تراجع، إعادة) */}
      <div className="flex items-center gap-1 bg-[var(--cad-panel-bg)] p-1 rounded-lg border border-[var(--cad-border)] shadow-xs">
        {/* زر الحفظ وزر حفظ باسم لويندوز */}
        <div className="flex items-center">
          <button
            onClick={onSave}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium ${
              onSaveAs ? 'rounded-r-md' : 'rounded-md'
            } bg-[var(--cad-surface-hover)] hover:bg-[var(--cad-surface-active)] text-[var(--cad-text-primary)] transition-colors shadow-xs`}
            title="حفظ المشروع (Ctrl+S) - يفتح نافذة ويندوز للحفظ أو يحفظ بالمسار الأخير"
          >
            <Save size={14} className="text-sky-400" />
            <span>حفظ</span>
          </button>
          {onSaveAs && (
            <button
              onClick={onSaveAs}
              className="px-1.5 py-1.5 text-xs rounded-l-md bg-[var(--cad-surface-hover)] hover:bg-[var(--cad-surface-active)] text-[var(--cad-text-secondary)] hover:text-[var(--cad-text-primary)] border-r border-[var(--cad-border)] transition-colors"
              title="حفظ المشروع باسم جديد على ويندوز (Ctrl+Shift+S)"
            >
              <ChevronDown size={13} />
            </button>
          )}
        </div>

        <div className="h-4 w-px bg-[var(--cad-border)] mx-0.5" />

        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md transition-colors ${
            canUndo
              ? 'hover:bg-[var(--cad-surface-hover)] text-[var(--cad-text-primary)] cursor-pointer'
              : 'text-[var(--cad-text-muted)] cursor-not-allowed opacity-50'
          }`}
          title="تراجع (Ctrl+Z)"
        >
          <Undo2 size={15} />
          <span className="hidden sm:inline">تراجع</span>
        </button>

        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-md transition-colors ${
            canRedo
              ? 'hover:bg-[var(--cad-surface-hover)] text-[var(--cad-text-primary)] cursor-pointer'
              : 'text-[var(--cad-text-muted)] cursor-not-allowed opacity-50'
          }`}
          title="إعادة (Ctrl+Y)"
        >
          <Redo2 size={15} />
          <span className="hidden sm:inline">إعادة</span>
        </button>
      </div>

      {/* القسم الأيسر: الإعدادات، المظهر، الملفات، والمساعدة */}
      <div className="flex items-center gap-2">
        {/* اختيار وحدة القياس */}
        <div className="flex items-center gap-1 text-xs text-[var(--cad-text-secondary)]">
          <label htmlFor="unit-select" className="text-[11px]">الوحدة:</label>
          <select
            id="unit-select"
            value={meta.unit}
            onChange={handleUnitChange}
            className="bg-[var(--cad-input-bg)] border border-[var(--cad-border)] text-[var(--cad-text-primary)] rounded px-2 py-1 text-xs outline-none cursor-pointer hover:border-sky-500 transition-colors"
          >
            <option value="meter">متر (m)</option>
            <option value="cm">سنتيمتر (cm)</option>
            <option value="mm">مليمتر (mm)</option>
          </select>
        </div>

        <div className="h-5 w-px bg-[var(--cad-border)]" />

        <button
          onClick={handleExportJSON}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md bg-[var(--cad-panel-bg)] hover:bg-[var(--cad-surface-hover)] text-[var(--cad-text-primary)] border border-[var(--cad-border)] transition-colors"
          title="تصدير المشروع كملف JSON"
        >
          <Download size={14} className="text-emerald-400" />
          <span className="hidden md:inline">تصدير JSON</span>
        </button>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md bg-[var(--cad-panel-bg)] hover:bg-[var(--cad-surface-hover)] text-[var(--cad-text-primary)] border border-[var(--cad-border)] transition-colors"
          title="استيراد مشروع من ملف JSON"
        >
          <Upload size={14} className="text-sky-400" />
          <span className="hidden md:inline">استيراد JSON</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.cadproj,.cad,application/json"
          onChange={handleImportJSON}
          className="hidden"
        />

        <button
          onClick={onNewProject}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md bg-[var(--cad-panel-bg)] hover:bg-[var(--cad-surface-hover)] text-[var(--cad-text-primary)] border border-[var(--cad-border)] transition-colors"
          title="بدء مشروع جديد فارغ"
        >
          <FolderPlus size={14} className="text-amber-400" />
          <span className="hidden lg:inline">مشروع جديد</span>
        </button>

        <button
          onClick={onOpenLayers}
          className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-md bg-[var(--cad-panel-bg)] hover:bg-[var(--cad-surface-hover)] text-[var(--cad-text-primary)] border border-[var(--cad-border)] transition-colors"
          title="إدارة الطبقات (Layers)"
        >
          <Layers size={15} className="text-indigo-400" />
          <span className="hidden xl:inline">الطبقات</span>
        </button>

        {onOpenSymbols && (
          <button
            onClick={onOpenSymbols}
            className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-md bg-[var(--cad-panel-bg)] hover:bg-[var(--cad-surface-hover)] text-amber-400 border border-[var(--cad-border)] transition-colors"
            title="مكتبة الرموز الهندسية (MEP Symbols)"
          >
            <Zap size={14} className="text-amber-400" />
            <span className="hidden xl:inline">مكتبة الرموز</span>
          </button>
        )}

        {onOpenScheduleBOQ && (
          <button
            data-tour="boq"
            onClick={onOpenScheduleBOQ}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-xs transition-colors font-medium"
            title="جدول الرموز وحصر الكميات التلقائي (Automatic Legend & BOQ)"
          >
            <FileSpreadsheet size={15} className="text-emerald-400" />
            <span className="hidden md:inline">جدول الكميات</span>
          </button>
        )}

        {onToggleWallLengths && (
          <button
            onClick={onToggleWallLengths}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border transition-all ${
              showWallLengths
                ? 'bg-sky-500/10 text-sky-400 border-sky-500/40 shadow-xs font-semibold'
                : 'bg-[var(--cad-panel-bg)] text-[var(--cad-text-muted)] border-[var(--cad-border)] hover:bg-[var(--cad-surface-hover)] hover:text-[var(--cad-text-primary)]'
            }`}
            title={showWallLengths ? 'إخفاء أطوال الجدران على المخطط' : 'إظهار أطوال الجدران على المخطط'}
          >
            <Ruler size={15} />
            <span className="hidden lg:inline">أطوال الجدران</span>
          </button>
        )}

        {onTogglePropertiesPanel && (
          <button
            onClick={onTogglePropertiesPanel}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border transition-all ${
              isPropertiesPanelVisible
                ? 'bg-[var(--cad-surface-hover)] text-sky-400 border-[var(--cad-border)] hover:text-sky-300'
                : 'bg-sky-500/10 text-sky-400 border-sky-500/40 shadow-xs'
            }`}
            title={isPropertiesPanelVisible ? 'إخفاء لوحة معلومات المشروع والخصائص' : 'إظهار لوحة معلومات المشروع والخصائص'}
          >
            {isPropertiesPanelVisible ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
            <span className="hidden xl:inline">لوحة المعلومات</span>
          </button>
        )}

        {/* تبديل لغة الواجهة عربي/إنجليزي (المرحلة 19) */}
        <button
          data-testid="lang-toggle"
          data-no-i18n
          onClick={() => {
            const next = uiLang === 'en' ? 'ar' : 'en';
            void setLang(next).then(() => setUiLang(next));
          }}
          className="px-2 py-1.5 rounded-md bg-[var(--cad-panel-bg)] hover:bg-[var(--cad-surface-hover)] border border-[var(--cad-border)] text-[var(--cad-text-primary)] transition-colors shadow-xs text-[11px] font-bold min-w-[34px]"
          title={uiLang === 'en' ? 'التبديل إلى العربية' : 'Switch to English'}
        >
          {uiLang === 'en' ? 'ع' : 'EN'}
        </button>

        {/* مفتاح تبديل الوضع الداكن والنهاري (المرحلة 3) */}
        <button
          data-testid="theme-toggle"
          onClick={onToggleTheme}
          className="p-1.5 rounded-md bg-[var(--cad-panel-bg)] hover:bg-[var(--cad-surface-hover)] border border-[var(--cad-border)] text-[var(--cad-text-primary)] transition-colors shadow-xs"
          title={theme === 'dark' ? 'التبديل إلى الوضع النهاري (Light Mode)' : 'التبديل إلى الوضع الداكن (Dark Mode)'}
        >
          {theme === 'dark' ? (
            <Sun size={16} className="text-amber-400" />
          ) : (
            <Moon size={16} className="text-sky-500" />
          )}
        </button>

        {/* زر إعدادات التطبيق والحفظ التلقائي (المرحلة 4) */}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-md bg-[var(--cad-panel-bg)] hover:bg-[var(--cad-surface-hover)] border border-[var(--cad-border)] text-[var(--cad-text-primary)] transition-colors shadow-xs"
            title="إعدادات التطبيق والحفظ التلقائي وملفات ويندوز"
          >
            <Settings size={16} className="text-sky-400" />
          </button>
        )}

        <button
          onClick={onOpenHelp}
          className="p-1.5 rounded-md hover:bg-[var(--cad-surface-hover)] text-[var(--cad-text-secondary)] hover:text-[var(--cad-text-primary)] transition-colors"
          title="دليل الاختصارات والمساعدة"
        >
          <HelpCircle size={18} />
        </button>
      </div>
    </header>
  );
};
