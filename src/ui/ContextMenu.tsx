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
  Move,
  FlipHorizontal2,
  Scaling,
  Grid3x3,
  Copy as CopyIcon,
  RotateCcw,
  SeparatorVertical,
  MoveHorizontal,
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyCenter,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyCenter,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  Boxes,
  Pipette,
  Paintbrush,
} from 'lucide-react';
import type { EditCommandKind } from '../engine/renderer.ts';
import { ALIGN_LABELS, type AlignMode } from '../model/align.ts';

const ALIGN_BUTTONS: { mode: AlignMode; Icon: React.ComponentType<{ size?: number; className?: string }>; minCount: number }[] = [
  { mode: 'left', Icon: AlignHorizontalJustifyStart, minCount: 2 },
  { mode: 'centerX', Icon: AlignHorizontalJustifyCenter, minCount: 2 },
  { mode: 'right', Icon: AlignHorizontalJustifyEnd, minCount: 2 },
  { mode: 'top', Icon: AlignVerticalJustifyStart, minCount: 2 },
  { mode: 'centerY', Icon: AlignVerticalJustifyCenter, minCount: 2 },
  { mode: 'bottom', Icon: AlignVerticalJustifyEnd, minCount: 2 },
  { mode: 'distributeH', Icon: AlignHorizontalDistributeCenter, minCount: 3 },
  { mode: 'distributeV', Icon: AlignVerticalDistributeCenter, minCount: 3 },
];

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
  /** بدء أمر تحرير بنقطة أساس على التحديد */
  onEditCommand?: (kind: EditCommandKind) => void;
  /** محاذاة/توزيع التحديد المتعدد */
  onAlign?: (mode: AlignMode) => void;
  /** فتح مكتبة الكتل (لحفظ التحديد ككتلة) */
  onOpenBlocks?: () => void;
  /** نسخ خصائص العنصر المنقور / لصقها على المحدد */
  onCopyProps?: () => void;
  onPasteProps?: () => void;
  canPasteProps?: boolean;
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
  onEditCommand,
  onAlign,
  onOpenBlocks,
  onCopyProps,
  onPasteProps,
  canPasteProps,
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
  const menuHeight = targetObject || selectedCount > 0 ? (onEditCommand ? (onAlign && selectedCount >= 2 ? 800 : 750) : 360) : 220;
  const x = Math.min(position.x, window.innerWidth - menuWidth - 10);
  const y = Math.min(position.y, window.innerHeight - menuHeight - 10);

  const hasSelection = targetObject !== null || selectedCount > 0;
  // التدوير السريع متاح الآن للجدران والمسارات والأبعاد أيضاً (حول مركز التحديد)
  const canRotate =
    selectedCount > 1 ||
    targetObject?.type === 'symbol' ||
    targetObject?.type === 'text' ||
    targetObject?.type === 'wall' ||
    targetObject?.type === 'route' ||
    targetObject?.type === 'dimension';
  const isSymbolLike = targetObject?.type === 'symbol' || targetObject?.type === 'text';
  const hasWall = targetObject?.type === 'wall' || selectedCount > 1;
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
                  <span>{isSymbolLike ? 'عكس اتجاه الرمز (180°)' : 'تدوير 180°'}</span>
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

          {onEditCommand && (
            <>
              <div className="px-2 pt-1.5 pb-0.5 text-[10px] font-bold text-neutral-500 border-t border-neutral-800 mt-0.5">
                أوامر التحرير الدقيق
              </div>
              <button
                onClick={() => {
                  onEditCommand('move');
                  onClose();
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-right cursor-pointer"
              >
                <Move size={14} className="text-sky-400" />
                <span>نقل بنقطة أساس</span>
              </button>
              <button
                onClick={() => {
                  onEditCommand('copy');
                  onClose();
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-right cursor-pointer"
              >
                <CopyIcon size={14} className="text-sky-400" />
                <span>نسخ متعدد بنقطة أساس</span>
              </button>
              <button
                onClick={() => {
                  onEditCommand('rotate');
                  onClose();
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-right cursor-pointer"
              >
                <RotateCcw size={14} className="text-amber-400" />
                <span>تدوير بزاوية</span>
              </button>
              <button
                onClick={() => {
                  onEditCommand('scale');
                  onClose();
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-right cursor-pointer"
              >
                <Scaling size={14} className="text-amber-400" />
                <span>تحجيم</span>
              </button>
              <button
                onClick={() => {
                  onEditCommand('mirror');
                  onClose();
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-right cursor-pointer"
              >
                <FlipHorizontal2 size={14} className="text-violet-400" />
                <span>مرآة (انعكاس)</span>
              </button>
              <button
                onClick={() => {
                  onEditCommand('array');
                  onClose();
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-right cursor-pointer"
              >
                <Grid3x3 size={14} className="text-emerald-400" />
                <span>مصفوفة صفوف × أعمدة</span>
              </button>
              <button
                onClick={() => {
                  onEditCommand('arraypolar');
                  onClose();
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-right cursor-pointer"
              >
                <Grid3x3 size={14} className="text-emerald-400" />
                <span>مصفوفة دائرية</span>
              </button>
              <button
                onClick={() => {
                  onEditCommand('trim');
                  onClose();
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-right cursor-pointer"
              >
                <Scissors size={14} className="text-rose-400" />
                <span>قص (Trim)</span>
              </button>
              <button
                onClick={() => {
                  onEditCommand('extend');
                  onClose();
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-right cursor-pointer"
              >
                <MoveHorizontal size={14} className="text-rose-400" />
                <span>تمديد (Extend)</span>
              </button>
              {onOpenBlocks && hasSelection && (
                <button
                  data-testid="ctx-save-block"
                  onClick={() => {
                    onOpenBlocks();
                    onClose();
                  }}
                  className="w-full px-3 py-2 text-right text-xs flex items-center gap-2 hover:bg-neutral-800 text-neutral-200"
                >
                  <Boxes size={14} className="text-sky-400" />
                  <span>حفظ التحديد ككتلة...</span>
                </button>
              )}
              {onAlign && selectedCount >= 2 && (
                <div className="px-2.5 py-1.5" data-testid="align-toolbar">
                  <div className="text-[10px] text-neutral-500 mb-1">محاذاة وتوزيع</div>
                  <div className="flex items-center gap-1 flex-wrap" dir="ltr">
                    {ALIGN_BUTTONS.map(({ mode, Icon, minCount }) => (
                      <button
                        key={mode}
                        title={ALIGN_LABELS[mode]}
                        aria-label={ALIGN_LABELS[mode]}
                        disabled={selectedCount < minCount}
                        onClick={() => {
                          onAlign(mode);
                          onClose();
                        }}
                        className="p-1.5 rounded-md hover:bg-neutral-800 text-amber-400 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Icon size={15} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {hasWall && (
                <button
                  onClick={() => {
                    onEditCommand('offset');
                    onClose();
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-right cursor-pointer"
                >
                  <SeparatorVertical size={14} className="text-emerald-400" />
                  <span>إزاحة متوازية للجدار</span>
                </button>
              )}
              {/* أدوات تحرير إضافية: وصل/شطف/كسر/دمج/تمطيط/أبعاد متسلسلة */}
              <div className="grid grid-cols-2 gap-0.5" data-testid="ctx-more-edit">
                {(
                  [
                    ['fillet', 'وصل ركن', targetObject?.type === 'wall'],
                    ['chamfer', 'شطف ركن', targetObject?.type === 'wall'],
                    ['break', 'كسر', targetObject?.type === 'wall' || targetObject?.type === 'line' || targetObject?.type === 'route'],
                    ['join', 'دمج المحدد', selectedCount >= 2],
                    ['stretch', 'تمطيط', true],
                    ['dimchain', 'أبعاد الجدار', targetObject?.type === 'wall'],
                  ] as const
                )
                  .filter(([, , show]) => show)
                  .map(([kind, label]) => (
                    <button
                      key={kind}
                      onClick={() => {
                        onEditCommand(kind);
                        onClose();
                      }}
                      className="px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-right cursor-pointer text-neutral-200"
                    >
                      {label}
                    </button>
                  ))}
              </div>
            </>
          )}

          {/* نسخ الخصائص ولصقها */}
          {targetObject && onCopyProps && (
            <div className="grid grid-cols-2 gap-0.5 border-t border-neutral-800 pt-1 mt-1">
              <button
                data-testid="ctx-copy-props"
                onClick={() => {
                  onCopyProps();
                  onClose();
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-right cursor-pointer"
              >
                <Pipette size={13} className="text-amber-400" />
                <span>نسخ الخصائص</span>
              </button>
              <button
                data-testid="ctx-paste-props"
                disabled={!canPasteProps}
                onClick={() => {
                  onPasteProps?.();
                  onClose();
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 text-right cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
                title={selectedCount > 1 ? 'على كل العناصر المحددة' : 'على هذا العنصر'}
              >
                <Paintbrush size={13} className="text-amber-400" />
                <span>لصق الخصائص</span>
              </button>
            </div>
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
