/**
 * @file src/ui/SheetsBar.tsx
 * @description شريط اللوحات والصفحات المتعددة أسفل المخطط الهندسي (مثل أوراق عمل برنامج Excel).
 * يتيح:
 * - إضافة صفحات / لوحات جديدة للمشروع بنقرة زر (+)
 * - التنقل الفوري بين صفحات المخطط
 * - إعادة تسمية الصفحة بالنقر المزدوج
 * - تكرار صفحة معينة بجميع عناصرها الهندسية
 * - حذف الصفحات مع حماية الصفحة الأخيرة
 */

import React, { useState, useRef, useEffect } from 'react';
import { ProjectModel } from '../model/project.ts';
import { ProjectSheet } from '../model/types.ts';
import { Plus, Copy, Edit2, Trash2, ChevronLeft, ChevronRight, FileSpreadsheet, MoreVertical } from 'lucide-react';

interface SheetsBarProps {
  model: ProjectModel;
  activeSheetId: string;
  onSheetChange: (sheetId: string) => void;
}

export const SheetsBar: React.FC<SheetsBarProps> = ({
  model,
  activeSheetId,
  onSheetChange,
}) => {
  const [sheets, setSheets] = useState<ProjectSheet[]>(() => model.getSheets());
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [contextMenuSheetId, setContextMenuSheetId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // تحديث قائمة اللوحات عند حدوث أي تغيير في الموديل
  useEffect(() => {
    const update = () => {
      setSheets(model.getSheets());
    };
    return model.subscribe(update);
  }, [model]);

  // تركيز حقل التعديل عند تفعيل التسمية
  useEffect(() => {
    if (editingSheetId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingSheetId]);

  // إغلاق القائمة السياقية عند النقر في أي مكان
  useEffect(() => {
    const handleClose = () => {
      setContextMenuSheetId(null);
      setMenuPos(null);
    };
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  const handleStartRename = (sheet: ProjectSheet, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setContextMenuSheetId(null);
    setEditingSheetId(sheet.id);
    setEditingName(sheet.name);
  };

  const handleSaveRename = () => {
    if (editingSheetId && editingName.trim()) {
      model.renameSheet(editingSheetId, editingName.trim());
      setSheets(model.getSheets());
    }
    setEditingSheetId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveRename();
    } else if (e.key === 'Escape') {
      setEditingSheetId(null);
    }
  };

  const handleAddSheet = () => {
    const newId = model.addSheet();
    setSheets(model.getSheets());
    onSheetChange(newId);
    // تمرير شريط التمرير إلى النهاية
    setTimeout(() => {
      if (tabsContainerRef.current) {
        tabsContainerRef.current.scrollLeft = tabsContainerRef.current.scrollWidth;
      }
    }, 50);
  };

  const handleDuplicateSheet = (sheetId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setContextMenuSheetId(null);
    const newId = model.duplicateSheet(sheetId);
    if (newId) {
      setSheets(model.getSheets());
      onSheetChange(newId);
    }
  };

  const handleDeleteSheet = (sheetId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setContextMenuSheetId(null);
    if (sheets.length <= 1) return;
    if (window.confirm('هل أنت متأكد من حذف هذه اللوحة وجميع عناصرها؟')) {
      const success = model.deleteSheet(sheetId);
      if (success) {
        setSheets(model.getSheets());
        onSheetChange(model.getActiveSheetId());
      }
    }
  };

  const handleContextMenu = (sheetId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuSheetId(sheetId);
    setMenuPos({ x: e.clientX, y: e.clientY });
  };

  const scrollLeft = () => {
    if (tabsContainerRef.current) {
      tabsContainerRef.current.scrollBy({ left: -150, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (tabsContainerRef.current) {
      tabsContainerRef.current.scrollBy({ left: 150, behavior: 'smooth' });
    }
  };

  return (
    <div
      className="h-8 bg-neutral-900 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-300 select-none px-2 z-20"
      dir="rtl"
    >
      {/* القسم الأيمن: أزرار التنقل السريع وإضافة صفحة جديدة */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={handleAddSheet}
          className="h-6 px-2.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer text-[11px]"
          title="إضافة صفحة / لوحة جديدة للمشروع (+)"
        >
          <Plus size={13} />
          <span>صفحة جديدة</span>
        </button>

        <div className="h-4 w-px bg-neutral-700 mx-1" />

        <button
          onClick={scrollRight}
          className="w-6 h-6 rounded hover:bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
          title="التمرير لليمين"
        >
          <ChevronRight size={14} />
        </button>
        <button
          onClick={scrollLeft}
          className="w-6 h-6 rounded hover:bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
          title="التمرير لليسار"
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      {/* قسم أوراق العمل واللوحات التفاعلية (تبويبات على طريقة Excel) */}
      <div
        ref={tabsContainerRef}
        className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar mx-2 h-full"
      >
        {sheets.map((sheet, idx) => {
          const isActive = sheet.id === activeSheetId;
          const isEditing = editingSheetId === sheet.id;

          return (
            <div
              key={sheet.id}
              onClick={() => {
                if (!isActive) {
                  model.setActiveSheet(sheet.id);
                  onSheetChange(sheet.id);
                }
              }}
              onDoubleClick={(e) => handleStartRename(sheet, e)}
              onContextMenu={(e) => handleContextMenu(sheet.id, e)}
              className={`h-7 px-3 rounded-t-md flex items-center gap-2 cursor-pointer transition-all border-b-2 text-xs relative shrink-0 group ${
                isActive
                  ? 'bg-neutral-950 text-sky-400 font-bold border-sky-400 shadow-sm'
                  : 'bg-neutral-850 hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 border-transparent'
              }`}
            >
              <FileSpreadsheet size={13} className={isActive ? 'text-sky-400' : 'text-neutral-500'} />

              {isEditing ? (
                <input
                  ref={editInputRef}
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={handleSaveRename}
                  onKeyDown={handleKeyDown}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-neutral-800 text-white px-1.5 py-0.5 rounded outline-none border border-sky-500 font-bold text-xs min-w-[90px]"
                />
              ) : (
                <span className="truncate max-w-[140px]" title={sheet.name}>
                  {sheet.name}
                </span>
              )}

              {/* زر خيارات اللوحة المنسدلة */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setContextMenuSheetId(sheet.id);
                  setMenuPos({ x: rect.right, y: rect.top - 100 });
                }}
                className={`w-4 h-4 rounded flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-700/60 transition-opacity ${
                  isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                }`}
                title="خيارات اللوحة"
              >
                <MoreVertical size={11} />
              </button>
            </div>
          );
        })}
      </div>

      {/* مؤشر عدد الصفحات الإجمالي */}
      <div className="shrink-0 text-[10px] text-neutral-400 font-mono-cad flex items-center gap-1.5 pl-1">
        <span>إجمالي اللوحات:</span>
        <span className="font-bold text-sky-400 bg-neutral-800 px-1.5 py-0.5 rounded">
          {sheets.length}
        </span>
      </div>

      {/* قائمة سياقية لخيارات اللوحة */}
      {contextMenuSheetId && menuPos && (
        <div
          style={{ top: Math.max(10, menuPos.y - 120), right: window.innerWidth - menuPos.x - 20 }}
          className="fixed z-50 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl p-1.5 w-44 flex flex-col gap-0.5 backdrop-blur-md animate-in fade-in zoom-in-95 text-xs text-neutral-200"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              const target = sheets.find((s) => s.id === contextMenuSheetId);
              if (target) handleStartRename(target);
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-right cursor-pointer"
          >
            <Edit2 size={13} className="text-amber-400" />
            <span>إعادة التسمية</span>
          </button>

          <button
            onClick={() => handleDuplicateSheet(contextMenuSheetId)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-right cursor-pointer"
          >
            <Copy size={13} className="text-sky-400" />
            <span>تكرار مع جميع العناصر</span>
          </button>

          {sheets.length > 1 && (
            <>
              <div className="h-px bg-neutral-800 my-0.5" />
              <button
                onClick={() => handleDeleteSheet(contextMenuSheetId)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-rose-950/40 text-rose-400 text-right cursor-pointer"
              >
                <Trash2 size={13} />
                <span>حذف هذه اللوحة</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};
