/**
 * @file CommandBar.tsx
 * @description شريط الأوامر السفلي (بنمط AutoCAD):
 * - يعرض تلميحاً حياً لما تنتظره الأداة الحالية (النقطة الأولى، النقطة التالية...)
 * - يقبل إدخال الإحداثيات بدقة: x,y (مطلق) · @dx,dy (نسبي) · @طول<زاوية (قطبي) · طول فقط
 * - يلتقط تلقائياً الأرقام و@ عند الكتابة أثناء أي أداة رسم.
 * (أثناء رسم الجدار يتولى WallLengthHud نفس الدور ويقبل نفس الصيغ)
 */

import React, { useEffect, useRef, useState } from 'react';
import { Terminal, CornerDownLeft } from 'lucide-react';
import type { CadEngine, ToolMode } from '../engine/renderer.ts';
import { useLiveStatus } from '../engine/liveStatus.ts';

interface CommandBarProps {
  engine: CadEngine | null;
  currentTool: ToolMode;
  hidden?: boolean;
}

const POINT_TOOLS: ToolMode[] = ['wall', 'dimension', 'measure', 'route', 'area', 'symbol', 'door', 'window', 'text', 'calibrate', 'edit'];

const TOOL_NAMES: Partial<Record<ToolMode, string>> = {
  wall: 'جدار',
  dimension: 'بُعد',
  measure: 'قياس',
  route: 'مسار',
  area: 'مساحة',
  symbol: 'رمز',
  door: 'باب',
  window: 'نافذة',
  text: 'ملاحظة',
  calibrate: 'معايرة',
  edit: 'تحرير',
};

function promptFor(tool: ToolMode, hasOrigin: boolean): string {
  switch (tool) {
    case 'wall':
      return hasOrigin ? 'النقطة التالية للجدار' : 'نقطة بداية الجدار';
    case 'dimension':
    case 'measure':
    case 'calibrate':
      return hasOrigin ? 'النقطة الثانية' : 'النقطة الأولى';
    case 'route':
      return hasOrigin ? 'النقطة التالية للمسار (Enter لإنهاء المسار)' : 'نقطة بداية المسار';
    case 'area':
      return hasOrigin ? 'الرأس التالي للمضلع (Enter لإغلاقه)' : 'الرأس الأول للمضلع';
    case 'door':
    case 'window':
      return 'نقطة على الجدار';
    default:
      return 'موضع الإدراج';
  }
}

export const CommandBar: React.FC<CommandBarProps> = ({ engine, currentTool, hidden }) => {
  const live = useLiveStatus(); // لإعادة التصيير مع تغيّر حالة الأداة (بداية/نهاية الرسم)
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const active = !hidden && POINT_TOOLS.includes(currentTool);

  // التقاط الأرقام و@ تلقائياً عند الكتابة فوق اللوحة
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || el?.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^[0-9.@\-]$/.test(e.key)) {
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  useEffect(() => {
    setError(null);
  }, [currentTool]);

  if (!active) return null;
  void live;
  const hasOrigin = Boolean(engine?.getDrawingOrigin());

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!engine) return;
    if (!value.trim()) {
      // Enter بدون قيمة: إنهاء الأمر الجاري (المسار/المضلع) كما في AutoCAD
      engine.completeCurrentCommand();
      setError(null);
      return;
    }
    const err = engine.isEditAwaitingValue() ? engine.applyEditValue(value) : engine.applyPointInput(value);
    setError(err);
    if (!err) {
      setValue('');
      // نعيد التركيز للوحة حتى تعمل اختصارات الأدوات؛ الكتابة التالية للأرقام تعيده تلقائياً
      inputRef.current?.blur();
    }
  };

  return (
    <form
      onSubmit={submit}
      className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-[var(--cad-panel-bg)]/95 border border-[var(--cad-border)] rounded-xl shadow-lg px-2.5 py-1.5 backdrop-blur-md text-xs"
      dir="rtl"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          setValue('');
          setError(null);
          inputRef.current?.blur();
        }
      }}
    >
      <Terminal size={14} className="text-sky-400 shrink-0" />
      <span className="text-sky-300 font-semibold whitespace-nowrap">{TOOL_NAMES[currentTool] || currentTool}:</span>
      <span className="text-[var(--cad-text-secondary,#a3a3a3)] whitespace-nowrap hidden sm:inline">
        {currentTool === 'edit' && engine ? engine.getEditPrompt() : promptFor(currentTool, hasOrigin)}
      </span>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        dir="ltr"
        inputMode="decimal"
        placeholder={
          currentTool === 'edit' && engine?.isEditAwaitingValue()
            ? 'قيمة'
            : hasOrigin
              ? '@3<0  أو  @2,1  أو  3.5'
              : 'x,y  مثل 4,2.5'
        }
        className="w-40 bg-neutral-950/80 border border-neutral-700 focus:border-sky-400 rounded-lg px-2 py-1 font-mono-cad text-white outline-none text-center"
        title="بالمتر: x,y مطلق · @dx,dy نسبي · @طول<زاوية قطبي (0° يمين، 90° للأسفل) · طول فقط باتجاه المؤشر"
        aria-label="إدخال الإحداثيات"
      />
      <button type="submit" className="h-7 w-7 rounded-lg bg-sky-600 hover:bg-sky-500 text-white flex items-center justify-center" title="تطبيق (Enter)">
        <CornerDownLeft size={13} />
      </button>
      {error && <span className="text-rose-400 font-medium max-w-56">{error}</span>}
    </form>
  );
};
