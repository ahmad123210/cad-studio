/**
 * @file TemplatesModal.tsx
 * @description اختيار قالب عند إنشاء مشروع جديد (المرحلة 19): فارغ، شقة، فيلا مع سور، محل.
 */

import React from 'react';
import { X, LayoutTemplate, FileClock } from 'lucide-react';
import { PROJECT_TEMPLATES, templatePreview, type ProjectTemplate } from '../model/templates.ts';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onChoose: (id: ProjectTemplate['id']) => void;
  /** آخر الملفات (نسخة سطح المكتب فقط) */
  recentFiles?: Array<{ path: string; name: string; exists: boolean }>;
  onOpenRecent?: (path: string) => void;
}

const Preview: React.FC<{ id: ProjectTemplate['id'] }> = ({ id }) => {
  const { walls, fence } = templatePreview(id);
  const all = [...walls, ...fence];
  if (all.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center text-4xl text-neutral-600" aria-hidden>
        +
      </div>
    );
  }
  const xs = all.flatMap((s) => [s[0], s[2]]);
  const ys = all.flatMap((s) => [s[1], s[3]]);
  const minX = Math.min(...xs) - 1;
  const minY = Math.min(...ys) - 1;
  const w = Math.max(...xs) + 1 - minX;
  const h = Math.max(...ys) + 1 - minY;
  return (
    <svg viewBox={`${minX} ${minY} ${w} ${h}`} className="h-full w-full" aria-hidden>
      {fence.map((s, i) => (
        <line key={`f${i}`} x1={s[0]} y1={s[1]} x2={s[2]} y2={s[3]} stroke="currentColor" strokeWidth={0.2} strokeDasharray="0.6 0.4" className="text-amber-500" />
      ))}
      {walls.map((s, i) => (
        <line key={`w${i}`} x1={s[0]} y1={s[1]} x2={s[2]} y2={s[3]} stroke="currentColor" strokeWidth={i < 4 ? 0.3 : 0.15} strokeLinecap="square" className="text-sky-400" />
      ))}
    </svg>
  );
};

export const TemplatesModal: React.FC<Props> = ({ isOpen, onClose, onChoose, recentFiles, onOpenRecent }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onMouseDown={onClose} data-testid="templates-modal">
      <div className="w-[760px] max-w-full rounded-2xl border border-neutral-700 bg-neutral-900 shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <LayoutTemplate size={18} className="text-sky-400" />
            <h2 className="text-base font-bold text-neutral-100">مشروع جديد — اختر قالباً</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800" aria-label="إغلاق">
            <X size={16} />
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-5">
          {PROJECT_TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              data-testid={`template-${tpl.id}`}
              onClick={() => onChoose(tpl.id)}
              className="group flex flex-col rounded-xl border border-neutral-800 bg-neutral-950 hover:border-sky-500 hover:bg-sky-950/30 transition-colors overflow-hidden text-right"
            >
              <div className="h-28 p-3 bg-neutral-900/60 border-b border-neutral-800">
                <Preview id={tpl.id} />
              </div>
              <div className="p-3">
                <div className="text-sm font-bold text-neutral-100 group-hover:text-sky-300">{tpl.title}</div>
                <div className="text-[11px] leading-5 text-neutral-400 mt-1">{tpl.description}</div>
              </div>
            </button>
          ))}
        </div>
        {recentFiles && recentFiles.length > 0 && onOpenRecent && (
          <div className="px-5 pb-3" data-testid="recent-files">
            <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-300 mb-2">
              <FileClock size={14} className="text-amber-400" />
              أو افتح ملفاً حديثاً
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {recentFiles.slice(0, 6).map((f) => (
                <button
                  key={f.path}
                  disabled={!f.exists}
                  onClick={() => onOpenRecent(f.path)}
                  title={f.path}
                  className="text-right px-3 py-2 rounded-lg border border-neutral-800 bg-neutral-950 hover:border-amber-500/60 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <div className="text-xs text-neutral-100 truncate" data-no-i18n>
                    {f.name}
                  </div>
                  <div className="text-[10px] text-neutral-500 truncate font-mono" dir="ltr" data-no-i18n>
                    {f.path}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="px-5 pb-4 text-[11px] text-neutral-500">
          القوالب جاهزة لكشف الغرف وحصر الكميات مباشرة، وكل عناصرها قابلة للتعديل. يُستبدل المشروع الحالي بعد التأكيد.
        </div>
      </div>
    </div>
  );
};
