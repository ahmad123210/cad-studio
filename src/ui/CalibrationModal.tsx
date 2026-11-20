/**
 * @file CalibrationModal.tsx
 * @description نافذة معايرة مقياس الرسم الحقيقي (Scale Calibration) — المرحلة 3.
 * تتيح للمستخدم إدخال الطول الحقيقي لخط تم رسمه على المخطط لحساب pixelsPerMeter تلقائياً،
 * أو اختيار مقاييس رسم هندسية معيارية جاهزة (مثل 1:50, 1:100).
 */

import React, { useState } from 'react';
import { Ruler, Check, X, Sparkles, Compass } from 'lucide-react';
import { ProjectModel } from '../model/project.ts';
import { GridUtils } from '../engine/grid.ts';

interface CalibrationModalProps {
  model: ProjectModel;
  isOpen: boolean;
  onClose: () => void;
  measuredPixelDistance?: number | null;
}

export const CalibrationModal: React.FC<CalibrationModalProps> = ({
  model,
  isOpen,
  onClose,
  measuredPixelDistance,
}) => {
  const meta = model.getMeta();
  const currentScale = meta.scale || 50;

  // الطول المقاس بالبكسل (من الخط المرسوم أو قيمة افتراضية للمعايرة اليدوية)
  const [pixelDistance, setPixelDistance] = useState<number>(
    measuredPixelDistance && measuredPixelDistance > 0 ? measuredPixelDistance : 100
  );
  // الطول الحقيقي بالمتر
  const [realMeters, setRealMeters] = useState<string>(
    measuredPixelDistance && measuredPixelDistance > 0
      ? (measuredPixelDistance / currentScale).toFixed(2)
      : '2.00'
  );

  if (!isOpen) return null;

  const parsedMeters = parseFloat(realMeters);
  const calculatedPixelsPerMeter =
    parsedMeters > 0 && pixelDistance > 0
      ? GridUtils.calculateScaleFromMeasurement(pixelDistance, parsedMeters)
      : currentScale;

  const handleApply = () => {
    if (calculatedPixelsPerMeter > 0 && isFinite(calculatedPixelsPerMeter)) {
      model.setMeta({ scale: Math.round(calculatedPixelsPerMeter * 100) / 100 });
      onClose();
    }
  };

  const handlePresetScale = (ppm: number) => {
    model.setMeta({ scale: ppm });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-xs select-none">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col text-neutral-200 animate-in fade-in zoom-in-95 duration-150">
        {/* رأس النافذة */}
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/70">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Ruler size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">معايرة مقياس الرسم (Scale Calibration)</h3>
              <p className="text-[11px] text-neutral-400">
                ضبط نسبة البكسل إلى المتر الحقيقي لحساب كل الأبعاد بدقة
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* محتوى النافذة */}
        <div className="p-5 flex flex-col gap-4 text-xs">
          {/* بطاقة الشرح والمعايرة */}
          <div className="bg-neutral-950/60 p-3 rounded-lg border border-neutral-800 flex flex-col gap-2.5">
            <div className="flex items-center justify-between text-neutral-300">
              <span>المسافة المقاسة بالبكسل:</span>
              <span className="font-mono-cad text-sky-400 font-bold bg-neutral-900 px-2 py-0.5 rounded border border-neutral-700">
                {pixelDistance.toFixed(1)} px
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-neutral-300 font-semibold">
                أدخل الطول الحقيقي المقابل بالمتر:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.05"
                  min="0.1"
                  max="1000"
                  value={realMeters}
                  onChange={(e) => setRealMeters(e.target.value)}
                  placeholder="مثال: 4.50"
                  className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-sm font-mono-cad text-white outline-none focus:border-emerald-500"
                />
                <span className="text-neutral-400 font-medium text-sm">متر</span>
              </div>
            </div>

            {/* نتيجة الحساب */}
            <div className="pt-2 border-t border-neutral-800 flex items-center justify-between">
              <span className="text-neutral-400">مقياس الرسم الناتج:</span>
              <div className="flex items-center gap-1.5 font-mono-cad font-bold text-emerald-400 text-sm">
                <span>1 متر = {calculatedPixelsPerMeter.toFixed(1)} px</span>
              </div>
            </div>
          </div>

          {/* مقاييس هندسية سريعة شائعة */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold text-neutral-400">
              أو اختر مقياس رسم معياري سريع:
            </span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'دقيق جداً (1م = 100px)', scale: 100 },
                { label: 'افتراضي (1م = 50px)', scale: 50 },
                { label: 'مخطط واسع (1م = 25px)', scale: 25 },
              ].map((item) => (
                <button
                  key={item.scale}
                  onClick={() => handlePresetScale(item.scale)}
                  className={`py-2 px-2 rounded-lg border text-center transition-colors ${
                    Math.round(currentScale) === item.scale
                      ? 'bg-emerald-950/50 border-emerald-500/60 text-emerald-300 font-bold'
                      : 'bg-neutral-800/80 border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                  }`}
                >
                  <div className="font-mono-cad text-xs">{item.scale} px/m</div>
                  <div className="text-[9px] text-neutral-400 mt-0.5">{item.label}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* تذييل النافذة */}
        <div className="px-5 py-3 border-t border-neutral-800 bg-neutral-950/80 flex items-center justify-between text-xs">
          <span className="text-neutral-500 text-[11px]">
            المقياس الحالي: {currentScale} px/م
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-medium transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={handleApply}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-md transition-colors flex items-center gap-1.5"
            >
              <Check size={14} />
              <span>تطبيق المعايرة</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
