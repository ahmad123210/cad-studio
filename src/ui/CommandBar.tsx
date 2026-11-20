/**
 * @file CommandBar.tsx
 * @description شريط الأوامر السفلي (بنمط AutoCAD):
 * - في وضع التحديد: اكتب اسم أمر بالعربية أو الإنجليزية (جدار، wall، نقل، m، مرآة، mi...) ثم Enter؛
 *   ‏Enter على اللوحة يكرر آخر أمر؛ المفتاح / ينقل التركيز للشريط.
 * - أثناء أوامر الرسم: تلميح حي لما تنتظره الأداة + إدخال الإحداثيات بدقة:
 *   x,y (مطلق) · @dx,dy (نسبي) · @طول<زاوية (قطبي) · طول فقط. Enter فارغ ينهي المسار/المضلع.
 * (أثناء رسم الجدار يتولى WallLengthHud نفس الدور ويقبل نفس الصيغ)
 */

import React, { useEffect, useRef, useState } from 'react';
import { Terminal, CornerDownLeft } from 'lucide-react';
import type { CadEngine, ToolMode } from '../engine/renderer.ts';
import { useLiveStatus } from '../engine/liveStatus.ts';
import { findCommand, getLastCommand, runCommand, setLastCommand, suggestCommands } from '../engine/commands.ts';

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
  select: 'أمر',
  pan: 'أمر',
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

const HAS_LETTERS = /[a-zA-Z؀-ۿ]/;

export const CommandBar: React.FC<CommandBarProps> = ({ engine, currentTool, hidden }) => {
  const live = useLiveStatus(); // لإعادة التصيير مع تغيّر حالة الأداة (بداية/نهاية الرسم)
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pointMode = POINT_TOOLS.includes(currentTool);

  // تذكّر آخر أمر (لتكراره بـ Enter) أياً كانت طريقة تشغيله: زر، اختصار، أو كتابة
  useEffect(() => {
    if (currentTool === 'edit') setLastCommand(engine?.editCmd?.kind ?? null);
    else if (currentTool !== 'select' && currentTool !== 'pan') setLastCommand(currentTool);
    setError(null);
  }, [currentTool, engine]);

  useEffect(() => {
    if (hidden) return;
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || el?.isContentEditable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (document.querySelector('[role="dialog"], .fixed.inset-0')) return; // نافذة منبثقة مفتوحة
      if (e.code === 'Slash' || e.key === '/') {
        e.preventDefault();
        inputRef.current?.focus();
        return;
      }
      if (pointMode && /^[0-9.@\-]$/.test(e.key)) {
        inputRef.current?.focus();
        return;
      }
      if (!pointMode && (e.key === 'Enter' || e.code === 'NumpadEnter') && engine) {
        // Enter على اللوحة: تكرار آخر أمر (كما في AutoCAD)
        const last = getLastCommand();
        if (last) {
          e.preventDefault();
          const err = runCommand(engine, last.id);
          setError(err);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hidden, pointMode, engine]);

  if (hidden) return null;
  void live;
  const hasOrigin = Boolean(engine?.getDrawingOrigin());
  const suggestions = !pointMode || HAS_LETTERS.test(value) ? suggestCommands(value) : [];
  const last = getLastCommand();

  const execCommandText = (text: string): string | null => {
    if (!engine) return null;
    const cmd = findCommand(text);
    if (!cmd) return `أمر غير معروف: ${text}`;
    if (pointMode) engine.cancelDrawing(); // أمر جديد يلغي الأمر الجاري (كما في AutoCAD)
    return runCommand(engine, cmd.id);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!engine) return;
    const text = value.trim();
    let err: string | null = null;
    if (!text) {
      if (pointMode) {
        // Enter بدون قيمة: إنهاء الأمر الجاري (المسار/المضلع) كما في AutoCAD
        engine.completeCurrentCommand();
      } else if (last) {
        err = runCommand(engine, last.id);
      }
    } else if (pointMode && !HAS_LETTERS.test(text)) {
      err = engine.isEditAwaitingValue() ? engine.applyEditValue(text) : engine.applyPointInput(text);
    } else {
      err = execCommandText(text);
    }
    setError(err);
    if (!err) {
      setValue('');
      // نعيد التركيز للوحة حتى تعمل الاختصارات؛ الكتابة التالية تعيده تلقائياً
      inputRef.current?.blur();
    }
  };

  const placeholder = pointMode
    ? currentTool === 'edit' && engine?.isEditAwaitingValue()
      ? 'قيمة'
      : hasOrigin
        ? '@3<0  أو  @2,1  أو  3.5'
        : 'x,y  مثل 4,2.5'
    : last
      ? `اكتب أمراً (/) — Enter يكرر: ${last.label}`
      : 'اكتب أمراً… (/)  مثل: جدار، نقل، مرآة';

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
      {pointMode && (
        <span className="text-[var(--cad-text-secondary,#a3a3a3)] whitespace-nowrap hidden sm:inline">
          {currentTool === 'edit' && engine ? engine.getEditPrompt() : promptFor(currentTool, hasOrigin)}
        </span>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          dir="auto"
          placeholder={placeholder}
          className={`${pointMode ? 'w-40' : focused ? 'w-64' : 'w-56'} bg-neutral-950/80 border border-neutral-700 focus:border-sky-400 rounded-lg px-2 py-1 font-mono-cad text-white outline-none text-center transition-all`}
          title="بالمتر: x,y مطلق · @dx,dy نسبي · @طول<زاوية قطبي (0° يمين، 90° للأسفل) · طول فقط باتجاه المؤشر — أو اكتب اسم أمر"
          aria-label="شريط الأوامر"
        />
        {focused && suggestions.length > 0 && (
          <ul className="absolute bottom-full mb-1 right-0 w-64 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl overflow-hidden">
            {suggestions.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setValue('');
                    setError(execCommandText(c.aliases[0]));
                    inputRef.current?.blur();
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 hover:bg-neutral-800 text-right"
                >
                  <span className="text-neutral-100">{c.label}</span>
                  <span className="font-mono-cad text-[10px] text-neutral-500">{c.aliases.filter((a) => /^[a-z]+$/.test(a)).join(' · ')}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <button type="submit" className="h-7 w-7 rounded-lg bg-sky-600 hover:bg-sky-500 text-white flex items-center justify-center" title="تطبيق (Enter)">
        <CornerDownLeft size={13} />
      </button>
      {error && <span className="text-rose-400 font-medium max-w-56">{error}</span>}
    </form>
  );
};
