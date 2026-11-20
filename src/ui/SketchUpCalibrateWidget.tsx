/**
 * @file SketchUpCalibrateWidget.tsx
 * @description أداة المعايرة المباشرة على طريقة SketchUp — المرحلة 2.
 * تظهر كحقل كتابة عائم ملاصق لخط المعايرة مباشرة، يتيح كتابة الطول بالمتر (مثال: 5.2 أو 5.2m)
 * ويحسب التطبيق pixelsPerMeter تلقائياً وبشكل فوري دون نوافذ منبثقة معقدة.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Check, X, Ruler } from 'lucide-react';

interface SketchUpCalibrateWidgetProps {
  measuredPixelDistance: number;
  screenPosition: { x: number; y: number };
  containerWidth: number;
  containerHeight: number;
  onApply: (realMeters: number) => void;
  onCancel: () => void;
}

export const SketchUpCalibrateWidget: React.FC<SketchUpCalibrateWidgetProps> = ({
  measuredPixelDistance,
  screenPosition,
  containerWidth,
  containerHeight,
  onApply,
  onCancel,
}) => {
  const [inputValue, setInputValue] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // التركيز التلقائي على حقل الإدخال فور ظهوره
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  // معالجة القيمة المدخلة (تدعم 5.2 أو 5.2m أو 5,2 أو 5.2م)
  const parseMeters = (val: string): number | null => {
    const cleaned = val.trim().replace(/[mم\s]/gi, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return isFinite(num) && num > 0 ? num : null;
  };

  const parsedMeters = parseMeters(inputValue);
  const calculatedPpm =
    parsedMeters && parsedMeters > 0
      ? measuredPixelDistance / parsedMeters
      : null;

  const handleConfirm = () => {
    if (parsedMeters && parsedMeters > 0) {
      onApply(parsedMeters);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  // حصر موقع الصندوق داخل حدود مساحة العمل
  const widgetWidth = 260;
  const widgetHeight = 145;
  const posX = Math.max(12, Math.min(containerWidth - widgetWidth - 12, screenPosition.x - widgetWidth / 2));
  const posY = Math.max(12, Math.min(containerHeight - widgetHeight - 12, screenPosition.y - widgetHeight - 12));

  return (
    <div
      style={{ left: `${posX}px`, top: `${posY}px` }}
      className="absolute z-40 w-[260px] bg-neutral-900/95 border-2 border-emerald-500/80 rounded-xl shadow-2xl shadow-black/90 p-3 flex flex-col gap-2.5 backdrop-blur-md animate-in fade-in zoom-in-95 select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* الترويسة */}
      <div className="flex items-center justify-between pb-1.5 border-b border-neutral-800">
        <div className="flex items-center gap-1.5 text-emerald-400">
          <Ruler size={15} />
          <span className="font-bold text-xs text-white">معايرة المقياس (SketchUp)</span>
        </div>
        <button
          onClick={onCancel}
          className="text-neutral-400 hover:text-white p-0.5 rounded transition-colors"
          title="إلغاء المعايرة (Esc)"
        >
          <X size={14} />
        </button>
      </div>

      {/* حقل إدخال الطول بالمتر */}
      <div className="flex flex-col gap-1">
        <label className="text-[11px] text-neutral-300 font-medium">
          أدخل الطول الحقيقي بالمتر:
        </label>
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="مثلاً: 5.2 أو 5.2m"
              className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs font-mono-cad text-emerald-300 placeholder:text-neutral-600 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/50"
            />
          </div>
          <button
            onClick={handleConfirm}
            disabled={!parsedMeters}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
              parsedMeters
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-md shadow-emerald-900/50'
                : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
            }`}
            title="تطبيق المعايرة (Enter)"
          >
            <Check size={14} />
            <span>تطبيق</span>
          </button>
        </div>
      </div>

      {/* شريط الإيضاح اللحظي للنتيجة */}
      <div className="flex items-center justify-between text-[10px] text-neutral-400 bg-neutral-950/70 px-2 py-1 rounded-md border border-neutral-800/80 font-mono-cad">
        <span>المقاس: {measuredPixelDistance.toFixed(1)} px</span>
        <span className="text-emerald-400 font-semibold">
          {calculatedPpm ? `1م = ${calculatedPpm.toFixed(1)} px` : 'أدخل الطول بالمتر'}
        </span>
      </div>
    </div>
  );
};
