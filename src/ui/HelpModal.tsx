/**
 * @file HelpModal.tsx
 * @description نافذة دليل الاستخدام واختصارات لوحة المفاتيح للمرحلة الأولى.
 */

import React from 'react';
import { X, Keyboard, CheckCircle, HelpCircle } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs select-none">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl overflow-hidden flex flex-col text-neutral-200">
        {/* رأس النافذة */}
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/70">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sky-600/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Keyboard size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">دليل الاستخدام واختصارات لوحة المفاتيح</h3>
              <p className="text-[11px] text-neutral-400">تطبيق رسم المخططات الهندسية والمعمارية الاحترافي</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg hover:bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* جدول الاختصارات */}
        <div className="p-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto text-xs">
          {/* ميزات DXF ورموز مخصصة ومساعد AI */}
          <div className="space-y-2">
            <h4 className="font-bold text-neutral-300 text-xs border-b border-purple-800/80 pb-1 flex items-center justify-between">
              <span className="text-purple-300 font-bold">AutoCAD DXF، رموز مخصصة، ومساعد AI</span>
              <span className="text-[10px] bg-purple-950 text-purple-400 px-2 py-0.5 rounded border border-purple-800 font-bold">متقدم</span>
            </h4>
            <div className="grid grid-cols-2 gap-2 text-neutral-300">
              <div className="flex items-center justify-between bg-neutral-950/40 p-2 rounded border border-neutral-800">
                <span>تصدير واستيراد AutoCAD DXF</span>
                <span className="text-[10px] text-sky-400 font-mono-cad font-bold">AutoCAD R12 / 2000+</span>
              </div>
              <div className="flex items-center justify-between bg-neutral-950/40 p-2 rounded border border-neutral-800">
                <span>استوديو الرموز المخصصة</span>
                <span className="text-[10px] text-purple-400 font-medium">تصميم وحفظ رموز MEP</span>
              </div>
              <div className="flex items-center justify-between bg-neutral-950/40 p-2 rounded border border-neutral-800">
                <span>المساعد الهندسي الذكي (AI Inspector)</span>
                <span className="text-[10px] text-emerald-400 font-medium">تدقيق كود البناء السعودي SBC</span>
              </div>
              <div className="flex items-center justify-between bg-neutral-950/40 p-2 rounded border border-neutral-800">
                <span>فحص الأحمال والتكييف والسلامة</span>
                <span className="text-[10px] text-amber-400 font-medium">حساب الواط، الأطنان، NFPA</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="font-bold text-neutral-300 text-xs border-b border-neutral-800 pb-1">
              أدوات الرسم والتنقل الأساسية
            </h4>
            <div className="grid grid-cols-2 gap-2 text-neutral-300">
              <div className="flex items-center justify-between bg-neutral-950/40 p-2 rounded border border-neutral-800">
                <span>أداة رسم الجدار</span>
                <kbd className="bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700 font-mono-cad text-sky-400">W</kbd>
              </div>
              <div className="flex items-center justify-between bg-neutral-950/40 p-2 rounded border border-neutral-800">
                <span>أداة إدراج الباب</span>
                <kbd className="bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700 font-mono-cad text-amber-400">D</kbd>
              </div>
              <div className="flex items-center justify-between bg-neutral-950/40 p-2 rounded border border-neutral-800">
                <span>أداة إدراج النافذة</span>
                <kbd className="bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700 font-mono-cad text-teal-400">N</kbd>
              </div>
              <div className="flex items-center justify-between bg-neutral-950/40 p-2 rounded border border-neutral-800">
                <span>أداة التحديد والتحريك</span>
                <kbd className="bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700 font-mono-cad text-sky-400">V</kbd>
              </div>
              <div className="flex items-center justify-between bg-neutral-950/40 p-2 rounded border border-neutral-800">
                <span>تحريك اللوحة (Pan)</span>
                <kbd className="bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700 font-mono-cad text-sky-400">Space + سحب</kbd>
              </div>
              <div className="flex items-center justify-between bg-neutral-950/40 p-2 rounded border border-neutral-800">
                <span>تكبير / تصغير</span>
                <kbd className="bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700 font-mono-cad text-sky-400">عجلة الفأرة</kbd>
              </div>
            </div>
          </div>

          {/* أدوات القياس والمعايرة */}
          <div className="space-y-2">
            <h4 className="font-bold text-neutral-300 text-xs border-b border-neutral-800 pb-1 flex items-center justify-between">
              <span>أدوات القياس والمساحة والمعايرة</span>
            </h4>
            <div className="grid grid-cols-2 gap-2 text-neutral-300">
              <div className="flex items-center justify-between bg-neutral-950/40 p-2 rounded border border-neutral-800">
                <span>رسم الأبعاد الهندسية (Dimension)</span>
                <kbd className="bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700 font-mono-cad text-indigo-400">M</kbd>
              </div>
              <div className="flex items-center justify-between bg-neutral-950/40 p-2 rounded border border-neutral-800">
                <span>شريط القياس السريع (Measure)</span>
                <kbd className="bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700 font-mono-cad text-amber-400">T</kbd>
              </div>
              <div className="flex items-center justify-between bg-neutral-950/40 p-2 rounded border border-neutral-800">
                <span>قياس المساحة والمحيط (Shoelace)</span>
                <kbd className="bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700 font-mono-cad text-emerald-400">A</kbd>
              </div>
              <div className="flex items-center justify-between bg-neutral-950/40 p-2 rounded border border-neutral-800">
                <span>أداة معايرة مقياس الرسم</span>
                <span className="text-[10px] text-rose-400 font-medium">زر المعايرة 🎯</span>
              </div>
            </div>
          </div>

          {/* التصدير الهندسي وPDF وجداول الكميات */}
          <div className="space-y-2">
            <h4 className="font-bold text-neutral-300 text-xs border-b border-neutral-800 pb-1 flex items-center justify-between">
              <span>التصدير الهندسي وPDF وجدول الكميات</span>
              <span className="text-[10px] bg-sky-950 text-sky-400 px-2 py-0.5 rounded border border-sky-800 font-bold">تصدير احترافي</span>
            </h4>
            <div className="grid grid-cols-2 gap-2 text-neutral-300">
              <div className="flex items-center justify-between bg-neutral-950/40 p-2 rounded border border-neutral-800">
                <span>تصدير المخطط الهندسي كـ PDF</span>
                <kbd className="bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700 font-mono-cad text-sky-400">Ctrl + P</kbd>
              </div>
              <div className="flex items-center justify-between bg-neutral-950/40 p-2 rounded border border-neutral-800">
                <span>مقاسات الورق المعيارية</span>
                <span className="text-[10px] text-sky-300 font-mono-cad">A4, A3, A2, A1, Letter</span>
              </div>
              <div className="flex items-center justify-between bg-neutral-950/40 p-2 rounded border border-neutral-800">
                <span>الخرطوشة المعمارية المعتمدة</span>
                <span className="text-[10px] text-emerald-400 font-medium">بيانات المشروع + الختم الهندسي</span>
              </div>
              <div className="flex items-center justify-between bg-neutral-950/40 p-2 rounded border border-neutral-800">
                <span>صفحة جدول الكميات (BOQ Sheet)</span>
                <span className="text-[10px] text-amber-400 font-medium">ملحقة بالـ PDF تلقائياً</span>
              </div>
              <div className="col-span-2 flex items-center justify-between bg-neutral-950/40 p-2 rounded border border-neutral-800">
                <span>تصدير Excel بمعادلات وصور فائقة الدقة</span>
                <span className="text-[10px] text-neutral-300">دعم 300 DPI + ترميز UTF-8 باللغة العربية</span>
              </div>
            </div>
          </div>

          {/* المسارات الكهروميكانيكية وحصر الكميات */}
          <div className="space-y-2">
            <h4 className="font-bold text-neutral-300 text-xs border-b border-neutral-800 pb-1 flex items-center justify-between">
              <span>المسارات الكهروميكانيكية وحصر الكميات</span>
              <span className="text-[10px] bg-emerald-950 text-emerald-400 px-2 py-0.5 rounded border border-emerald-800 font-bold">MEP</span>
            </h4>
            <div className="grid grid-cols-2 gap-2 text-neutral-300">
              <div className="flex items-center justify-between bg-neutral-950/40 p-2 rounded border border-neutral-800">
                <span>رسم مسار / كابل / أنبوب (Route)</span>
                <kbd className="bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700 font-mono-cad text-amber-400">R</kbd>
              </div>
              <div className="flex items-center justify-between bg-neutral-950/40 p-2 rounded border border-neutral-800">
                <span>إنهاء المسار الهندسي</span>
                <kbd className="bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700 font-mono-cad text-emerald-400">Enter / نـقر مزدوج</kbd>
              </div>
              <div className="flex items-center justify-between bg-neutral-950/40 p-2 rounded border border-neutral-800">
                <span>التوجيه المتعامد (Ortho)</span>
                <kbd className="bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700 font-mono-cad text-sky-400">Shift</kbd>
              </div>
              <div className="flex items-center justify-between bg-neutral-950/40 p-2 rounded border border-neutral-800">
                <span>الربط بالرموز الهندسية</span>
                <span className="text-[10px] text-emerald-400 font-medium">التقاط تلقائي للرمز</span>
              </div>
              <div className="col-span-2 flex items-center justify-between bg-neutral-950/40 p-2 rounded border border-neutral-800">
                <span>جدول الرموز وحصر الكميات التلقائي (Legend & BOQ)</span>
                <span className="text-[10px] text-emerald-300 font-medium">حساب فوري للأطوال + تصدير CSV / Excel 📊</span>
              </div>
            </div>
          </div>

          {/* نظام الطبقات والرموز الهندسية */}
          <div className="space-y-2">
            <h4 className="font-bold text-neutral-300 text-xs border-b border-neutral-800 pb-1 flex items-center justify-between">
              <span>الطبقات ومكتبة الرموز الهندسية</span>
              <span className="text-[10px] text-neutral-400 font-semibold">مكتملة</span>
            </h4>
            <div className="grid grid-cols-2 gap-2 text-neutral-300">
              <div className="flex items-center justify-between bg-neutral-950/40 p-2 rounded border border-neutral-800">
                <span>إدراج رمز هندسي (MEP Symbol)</span>
                <kbd className="bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700 font-mono-cad text-amber-400">S</kbd>
              </div>
              <div className="flex items-center justify-between bg-neutral-950/40 p-2 rounded border border-neutral-800">
                <span>مكتبة الرموز الشاملة (37 رمزاً)</span>
                <span className="text-[10px] text-amber-400 font-medium">زر مكتبة الرموز ⚡</span>
              </div>
              <div className="flex items-center justify-between bg-neutral-950/40 p-2 rounded border border-neutral-800">
                <span>الالتصاق بالجدار (Wall Snap)</span>
                <span className="text-[10px] text-sky-400 font-medium">تلقائي عند الاقتراب</span>
              </div>
              <div className="flex items-center justify-between bg-neutral-950/40 p-2 rounded border border-neutral-800">
                <span>الشفافية والترتيب (Z-Index)</span>
                <span className="text-[10px] text-indigo-400 font-medium">لوحة الطبقات 🗂️</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-neutral-300 text-xs border-b border-neutral-800 pb-1">
              الالتقاط والتحكم بالزوايا
            </h4>
            <div className="grid grid-cols-1 gap-2 text-neutral-300">
              <div className="flex items-center justify-between bg-neutral-950/40 p-2 rounded border border-neutral-800">
                <span>تقييد زوايا الرسم (0°، 45°، 90°)</span>
                <kbd className="bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700 font-mono-cad text-emerald-400">Shift (استمرار الضغط)</kbd>
              </div>
              <div className="flex items-center justify-between bg-neutral-950/40 p-2 rounded border border-neutral-800">
                <span>إغلاق مضلع المساحة / إنهاء القياس</span>
                <span className="font-mono-cad text-emerald-400">نقر مزدوج أو قرب النقطة الأولى</span>
              </div>
              <div className="flex items-center justify-between bg-neutral-950/40 p-2 rounded border border-neutral-800">
                <span>إلغاء الرسم الحالي / إلغاء التحديد</span>
                <kbd className="bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700 font-mono-cad text-amber-400">Esc</kbd>
              </div>
              <div className="flex items-center justify-between bg-neutral-950/40 p-2 rounded border border-neutral-800">
                <span>حذف العنصر المحدد (جدار، باب، نافذة، بُعد)</span>
                <kbd className="bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700 font-mono-cad text-rose-400">Delete / Backspace</kbd>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-neutral-300 text-xs border-b border-neutral-800 pb-1">
              التراجع والإعادة وإدارة المشروع
            </h4>
            <div className="grid grid-cols-2 gap-2 text-neutral-300">
              <div className="flex items-center justify-between bg-neutral-950/40 p-2 rounded border border-neutral-800">
                <span>تراجع (Undo)</span>
                <kbd className="bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700 font-mono-cad">Ctrl + Z</kbd>
              </div>
              <div className="flex items-center justify-between bg-neutral-950/40 p-2 rounded border border-neutral-800">
                <span>إعادة (Redo)</span>
                <kbd className="bg-neutral-800 px-1.5 py-0.5 rounded border border-neutral-700 font-mono-cad">Ctrl + Y</kbd>
              </div>
            </div>
          </div>

          <div className="bg-neutral-950/80 p-3 rounded-lg border border-neutral-800 text-[11px] text-neutral-400 space-y-1">
            <span className="font-bold text-amber-400 block">✨ ميزات الطبقات والرموز الهندسية MEP:</span>
            <p>• <b>مكتبة الرموز الهندسية:</b> 37 رمزاً معمارياً وميكانيكياً وكهربائياً مقسمة حسب التخصص (كهرباء ⚡، سباكة 💧، تكييف ❄️، إطفاء 🔥).</p>
            <p>• <b>الالتصاق المغناطيسي بالجدران (Wall Snap):</b> التواء وتمركز الرموز الجدارية (برايز، مفاتيح، مكيفات، كبائن حريق) على وجه الجدار تلقائياً مع تسجيل wallId.</p>
            <p>• <b>نظام الطبقات المتقدم (Full Layers):</b> تحكم بالشفافية (Opacity)، ألوان مخصصة لكل طبقة، ترتيب طبقات الرسم (Z-Index)، وإضافة طبقات جديدة.</p>
          </div>
        </div>

        {/* تذييل */}
        <div className="px-5 py-3 border-t border-neutral-800 bg-neutral-950/80 flex justify-end gap-2">
          <button
            onClick={() => {
              onClose();
              window.dispatchEvent(new Event('cad:start-tour'));
            }}
            className="px-4 py-1.5 border border-neutral-700 hover:bg-neutral-800 text-neutral-300 rounded-lg text-xs font-semibold transition-colors"
            data-testid="help-start-tour"
          >
            الجولة التعريفية
          </button>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-semibold transition-colors"
          >
            فهمت، عودة للرسم
          </button>
        </div>
      </div>
    </div>
  );
};
