/**
 * @file src/ui/ContextMenu.tsx
 * @description قائمة الخيارات المنبثقة بالزر الأيمن للفأرة (Right-Click CAD Context Menu).
 * تدعم عمليات التحرير، التكرار، الحذف، التدوير، القفل، وتغيير اللوحات والعناصر.
 */

import React, { useEffect, useRef } from 'react';
import { ProjectObject } from '../model/types.ts';
import {
  Copy,
  Scissors,
  ClipboardPaste,
  CopyPlus,
  Trash2,
  Lock,
  Unlock,
  RotateCw,
  Eye,
  Sliders,
  ScanLine,
  Maximize2,
  FilePlus,
} from 'lucide-react';

export interface ContextMenuProps {
  position: { x: number; y: number } | null;
  targetObject: ProjectObject | null;
  selectedCount: number;
  hasClipboard: boolean;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onLockToggle: () => void;
  onRotate?: (deg: number) => void;
  onToggleLength?: () => void;
  onSelectAll: () => void;
  onZoomFit: () => void;
  onOpenProperties: () => void;
  onAddSheet: () => void;
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  position,
  targetObject,
  selectedCount,
  hasClipboard,
  onCopy,
  onCut,
  onPaste,
  onDuplicate,
  onDelete,
  onLockToggle,
  onRotate,
  onToggleLength,
  onSelectAll,
  onZoomFit,
  onOpenProperties,
  onAddSheet,
  onClose,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        // إذا كان النقر بالزر الأيسر خارج القائمة نغلقها
        // أما النقر بالزر الأيمن فيتولى حدث contextmenu فتحها فوراً في الموضع الجديد
        if (e.button === 0) {
          onClose();
        }
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  if (!position) return null;

  // منع خروج القائمة خارج أبعاد الشاشة
  const menuWidth = 210;
  const menuHeight = targetObject || selectedCount > 0 ? 320 : 220;
  const x = Math.min(position.x, window.innerWidth - menuWidth - 10);
  const y = Math.min(position.y, window.innerHeight - menuHeight - 10);

  const hasSelection = targetObject !== null || selectedCount > 0;
  const canRotate = targetObject?.type === 'symbol' || targetObject?.type === 'text';
  const canToggleLength = targetObject?.type === 'wall' || targetObject?.type === 'route';

  return (
    <div
      ref={menuRef}
      style={{ left: x, top: y }}
      className="fixed z-50 w-52 bg-neutral-900/95 border border-neutral-700/80 rounded-xl shadow-2xl p-1.5 flex flex-col gap-0.5 text-xs text-neutral-200 backdrop-blur-md animate-in fade-in zoom-in-95 select-none"
      dir="rtl"
      onContextMenu={(e) => e.preventDefault()}
    >
      {hasSelection ? (
        <>
          <div className="px-2 py-1 text-[10px] font-bold text-neutral-400 border-b border-neutral-800 flex items-center justify-between mb-0.5">
            <span>
              {selectedCount > 1
                ? `عناصر محددة (${selectedCount})`
                : targetObject?.label || (targetObject?.type === 'wall' ? 'جدار' : targetObject?.type === 'symbol' ? 'رمز هندسي' : targetObject?.type === 'route' ? 'مسار كهروميكانيكي' : 'عنصر محدد')}
            </span>
          </div>

          <button
            onClick={() => {
              onDuplicate();
              onClose();
            }}
            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-right cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <CopyPlus size={14} className="text-sky-400" />
              <span>تكرار العنصر</span>
            </div>
            <kbd className="text-[10px] text-neutral-500 font-mono-cad">Ctrl+D</kbd>
          </button>

          <button
            onClick={() => {
              onCopy();
              onClose();
            }}
            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-right cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Copy size={14} className="text-neutral-400" />
              <span>نسخ</span>
            </div>
            <kbd className="text-[10px] text-neutral-500 font-mono-cad">Ctrl+C</kbd>
          </button>

          <button
            onClick={() => {
              onCut();
              onClose();
            }}
            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-right cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Scissors size={14} className="text-neutral-400" />
              <span>قص</span>
            </div>
            <kbd className="text-[10px] text-neutral-500 font-mono-cad">Ctrl+X</kbd>
          </button>

          {canRotate && onRotate && (
            <>
              <button
                onClick={() => {
                  onRotate(180);
                  onClose();
                }}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-right cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <RotateCw size={14} className="text-amber-400" />
                  <span>عكس اتجاه الرمز (180°)</span>
                </div>
                <kbd className="text-[10px] text-neutral-500 font-mono-cad">F</kbd>
              </button>
              <button
                onClick={() => {
                  onRotate(90);
                  onClose();
                }}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-right cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <RotateCw size={14} className="text-amber-400" />
                  <span>تدوير 90°</span>
                </div>
                <kbd className="text-[10px] text-neutral-500 font-mono-cad">R</kbd>
              </button>
            </>
          )}

          {canToggleLength && onToggleLength && (
            <button
              onClick={() => {
                onToggleLength();
                onClose();
              }}
              className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-right cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Eye size={14} className="text-emerald-400" />
                <span>إظهار / إخفاء الطول</span>
              </div>
            </button>
          )}

          <button
            onClick={() => {
              onLockToggle();
              onClose();
            }}
            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-right cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Lock size={14} className="text-amber-400" />
              <span>قفل / فتح العنصر</span>
            </div>
            <kbd className="text-[10px] text-neutral-500 font-mono-cad">L</kbd>
          </button>

          <button
            onClick={() => {
              onOpenProperties();
              onClose();
            }}
            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-right cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Sliders size={14} className="text-sky-400" />
              <span>لوحة الخصائص</span>
            </div>
          </button>

          <div className="h-px bg-neutral-800 my-0.5" />

          <button
            onClick={() => {
              onDelete();
              onClose();
            }}
            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-rose-950/40 text-rose-400 text-right cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Trash2 size={14} />
              <span>حذف</span>
            </div>
            <kbd className="text-[10px] text-rose-400/70 font-mono-cad">Del</kbd>
          </button>
        </>
      ) : (
        <>
          <div className="px-2 py-1 text-[10px] font-bold text-neutral-400 border-b border-neutral-800 flex items-center justify-between mb-0.5">
            <span>خيارات المخطط</span>
          </div>

          <button
            onClick={() => {
              onPaste();
              onClose();
            }}
            disabled={!hasClipboard}
            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 disabled:opacity-40 text-right cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ClipboardPaste size={14} className="text-sky-400" />
              <span>لصق هنا</span>
            </div>
            <kbd className="text-[10px] text-neutral-500 font-mono-cad">Ctrl+V</kbd>
          </button>

          <button
            onClick={() => {
              onSelectAll();
              onClose();
            }}
            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-right cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ScanLine size={14} className="text-neutral-400" />
              <span>تحديد كل العناصر</span>
            </div>
            <kbd className="text-[10px] text-neutral-500 font-mono-cad">Ctrl+A</kbd>
          </button>

          <button
            onClick={() => {
              onZoomFit();
              onClose();
            }}
            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-right cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Maximize2 size={14} className="text-emerald-400" />
              <span>ملاءمة المخطط للشاشة</span>
            </div>
            <kbd className="text-[10px] text-neutral-500 font-mono-cad">Home</kbd>
          </button>

          <div className="h-px bg-neutral-800 my-0.5" />

          <button
            onClick={() => {
              onAddSheet();
              onClose();
            }}
            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-right cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <FilePlus size={14} className="text-amber-400" />
              <span>إضافة صفحة جديدة</span>
            </div>
          </button>
        </>
      )}
    </div>
  );
};
