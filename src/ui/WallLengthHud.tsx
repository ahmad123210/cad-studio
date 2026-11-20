/**
 * @file src/ui/WallLengthHud.tsx
 * @description نافذة إدخال الطول المباشر للجدار بالمتر أثناء الرسم (Dynamic Input HUD).
 * تتيح للمستخدم تحديد طول الجدار بالمتر كتابةً باليد مع الضغط على Enter أو النقر على "تطبيق".
 */

import React, { useState, useEffect, useRef } from 'react';
import { Ruler, Check, X } from 'lucide-react';

interface WallLengthHudProps {
  currentLengthMeters: number;
  currentAngleDegrees: number;
  onCommitLength: (meters: number) => void;
  onCancel: () => void;
}

export const WallLengthHud: React.FC<WallLengthHudProps> = ({
  currentLengthMeters,
  currentAngleDegrees,
  onCommitLength,
  onCancel,
}) => {
  const [inputValue, setInputValue] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // تحديث القيمة الافتراضية إذا لم يقم المستخدم بالكتابة بعد
  useEffect(() => {
    if (!inputValue) {
      // لا نجبر القيمة حتى يتمكن من الكتابة بحرية
    }
  }, [currentLengthMeters]);

  // استماع لضغطات الأرقام من لوحة المفاتيح
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // إذا كان المفتاح رقمي أو نقطة ولم يكن الحقل مفعلاً، قم بتركيزه
      if (/^[0-9.]$/.test(e.key) && document.activeElement !== inputRef.current) {
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const val = parseFloat(inputValue);
    if (!isNaN(val) && val > 0) {
      onCommitLength(val);
      setInputValue('');
    } else if (currentLengthMeters > 0) {
      onCommitLength(currentLengthMeters);
      setInputValue('');
    }
  };

  return (
    <div
      className="fixed bottom-12 left-1/2 -translate-x-1/2 z-40 bg-neutral-900/95 border border-sky-500/80 rounded-2xl shadow-2xl p-2.5 flex items-center gap-3 backdrop-blur-md text-white select-none animate-in fade-in slide-in-from-bottom-2"
      dir="rtl"
    >
      <div className="flex items-center gap-2 pl-2 border-l border-neutral-700">
        <div className="w-8 h-8 rounded-xl bg-sky-600/20 border border-sky-500/40 flex items-center justify-center text-sky-400">
          <Ruler size={16} />
        </div>
        <div className="flex flex-col">
          <span className="text-[11px] text-neutral-400 font-medium">رسم الجدار النشط:</span>
          <span className="text-xs font-bold font-mono-cad text-sky-300">
            {currentLengthMeters.toFixed(2)} م • {Math.round(currentAngleDegrees)}°
          </span>
        </div>
      </div>

      {/* نموذج كتابة الطول يدوياً بالمتر */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <label className="text-xs text-neutral-300 font-semibold whitespace-nowrap">
          تحديد الطول يدوياً:
        </label>
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="number"
            step="0.05"
            min="0.1"
            max="1000"
            placeholder={currentLengthMeters > 0 ? currentLengthMeters.toFixed(2) : 'الطول بالمتر'}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="w-28 bg-neutral-950 border border-neutral-700 focus:border-sky-400 rounded-xl px-2.5 py-1.5 text-sm font-mono-cad text-white outline-none font-bold text-center pl-7"
            autoFocus
          />
          <span className="absolute left-2.5 text-xs text-neutral-400 font-medium pointer-events-none">
            م
          </span>
        </div>

        <button
          type="submit"
          className="h-8 px-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1 transition-colors cursor-pointer shadow-sm shadow-sky-600/30"
          title="تطبيق الطول ورسم الجدار (Enter)"
        >
          <Check size={14} />
          <span>تطبيق</span>
        </button>

        <button
          type="button"
          onClick={onCancel}
          className="h-8 px-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-colors cursor-pointer text-xs"
          title="إلغاء رسم الجدار (Esc)"
        >
          <X size={14} />
        </button>
      </form>
    </div>
  );
};
