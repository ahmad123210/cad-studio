/**
 * @file BackgroundImageModal.tsx
 * @description نافذة إدارة واستيراد صورة المخطط المرجعية في الخلفية (المرحلة 2).
 * تتيح تحميل صورة مخطط حقيقي (Blueprint / Floor Plan Scan) لتتبع الجدران فوقها بدقة.
 */

import React, { useRef } from 'react';
import { Image as ImageIcon, Eye, EyeOff, Lock, Unlock, Trash2, X, Upload } from 'lucide-react';
import { ProjectModel } from '../model/project.ts';
import { BackgroundImageData } from '../model/types.ts';

interface BackgroundImageModalProps {
  model: ProjectModel;
  isOpen: boolean;
  onClose: () => void;
}

export const BackgroundImageModal: React.FC<BackgroundImageModalProps> = ({
  model,
  isOpen,
  onClose,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  if (!isOpen) return null;

  const bg = model.getBackgroundImage();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        // حجم افتراضي معقول
        const maxInitialDim = 1000;
        let width = img.width;
        let height = img.height;
        if (width > maxInitialDim || height > maxInitialDim) {
          const ratio = Math.min(maxInitialDim / width, maxInitialDim / height);
          width *= ratio;
          height *= ratio;
        }

        const newBg: BackgroundImageData = {
          dataUrl,
          x: -width / 2,
          y: -height / 2,
          width,
          height,
          opacity: 0.5,
          visible: true,
          locked: false,
        };

        model.setBackgroundImage(newBg);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleOpacityChange = (val: number) => {
    model.updateBackgroundImage({ opacity: val });
  };

  const handleToggleVisible = () => {
    if (bg) {
      model.updateBackgroundImage({ visible: !bg.visible });
    }
  };

  const handleToggleLock = () => {
    if (bg) {
      model.updateBackgroundImage({ locked: !bg.locked });
    }
  };

  const handleDelete = () => {
    model.setBackgroundImage(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col text-neutral-200 animate-in fade-in zoom-in-95 duration-150">
        {/* رأس النافذة */}
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/70">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-600/20 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <ImageIcon size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">صورة المخطط المرجعية (خلفية)</h3>
              <p className="text-[11px] text-neutral-400">
                استورد صورة مخطط كروكي أو PDF لتحويلها إلى جدران مرسومة
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
          {bg ? (
            <div className="flex flex-col gap-4">
              {/* معاينة مصغرة للصورة */}
              <div className="relative h-40 bg-neutral-950 rounded-lg border border-neutral-800 overflow-hidden flex items-center justify-center">
                <img
                  src={bg.dataUrl}
                  alt="مخطط الخلفية"
                  className="max-h-full max-w-full object-contain"
                  style={{ opacity: bg.opacity }}
                />
                <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-neutral-900/80 px-2 py-1 rounded border border-neutral-700 text-[10px] text-neutral-300">
                  <span>الأبعاد: {Math.round(bg.width)} × {Math.round(bg.height)} px</span>
                </div>
              </div>

              {/* عناصر التحكم بالشفافية */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-neutral-300">درجة الشفافية (Opacity):</span>
                  <span className="font-mono-cad text-sky-400 font-bold">
                    {Math.round(bg.opacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="1.0"
                  step="0.05"
                  value={bg.opacity}
                  onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
                  className="w-full accent-teal-500 cursor-pointer"
                />
              </div>

              {/* أزرار الإظهار والقفل */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleToggleVisible}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg border transition-colors ${
                    bg.visible
                      ? 'bg-neutral-800 border-neutral-700 text-neutral-200 hover:bg-neutral-700'
                      : 'bg-neutral-950 border-neutral-800 text-neutral-500'
                  }`}
                >
                  {bg.visible ? <Eye size={15} className="text-teal-400" /> : <EyeOff size={15} />}
                  <span>{bg.visible ? 'الخلفية ظاهرة' : 'الخلفية مخفية'}</span>
                </button>

                <button
                  onClick={handleToggleLock}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg border transition-colors ${
                    bg.locked
                      ? 'bg-amber-950/40 border-amber-800 text-amber-300'
                      : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                  }`}
                >
                  {bg.locked ? <Lock size={15} /> : <Unlock size={15} />}
                  <span>{bg.locked ? 'مقفل (ثابت)' : 'قابل للتحريك'}</span>
                </button>
              </div>

              {/* استبدال أو حذف الصورة */}
              <div className="flex items-center gap-2 pt-2 border-t border-neutral-800">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg border border-neutral-700 transition-colors"
                >
                  <Upload size={14} className="text-sky-400" />
                  <span>استبدال الصورة</span>
                </button>

                <button
                  onClick={handleDelete}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 rounded-lg border border-rose-500/40 transition-colors"
                  title="حذف صورة الخلفية"
                >
                  <Trash2 size={15} />
                  <span>حذف</span>
                </button>
              </div>
            </div>
          ) : (
            /* في حال عدم وجود صورة بعد */
            <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-neutral-700 rounded-xl bg-neutral-950/40 text-center gap-3">
              <div className="w-12 h-12 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                <Upload size={22} />
              </div>
              <div>
                <h4 className="font-bold text-neutral-200 text-sm">استيراد صورة مخطط أو كروكي</h4>
                <p className="text-[11px] text-neutral-400 mt-1 max-w-xs leading-relaxed">
                  ارفع صورة المخطط (PNG أو JPG) لتظهر كخلفية شفافة يمكنك رسم وتتبع الجدران والأبواب والنوافذ فوقها مباشرة.
                </p>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="mt-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold shadow-md transition-colors flex items-center gap-2"
              >
                <Upload size={14} />
                <span>اختر ملف صورة من جهازك</span>
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={handleFileUpload}
            className="hidden"
          />
        </div>

        {/* تذييل */}
        <div className="px-5 py-3 border-t border-neutral-800 bg-neutral-950/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-medium transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
