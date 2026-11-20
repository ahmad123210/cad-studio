/**
 * @file AboutModal.tsx
 * @description واجهة المعلومات الشاملة والتوثيق: نبذة عن التطبيق، جدول الاختصارات الهندسية، ومعلومات المطور.
 */

import React, { useState } from 'react';
import {
  X,
  Info,
  Keyboard,
  User,
  Mail,
  Copy,
  Check,
  ExternalLink,
  ShieldCheck,
  FileCode2,
  Cpu,
  Layers,
  Sparkles,
  Award,
} from 'lucide-react';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'about' | 'shortcuts' | 'developer';
}

export const AboutModal: React.FC<AboutModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'about',
}) => {
  const [activeTab, setActiveTab] = useState<'about' | 'shortcuts' | 'developer'>(defaultTab);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyEmail = () => {
    navigator.clipboard.writeText('knatoura@gmail.com');
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs select-none animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-neutral-200 max-h-[88vh]">
        {/* رأس النافذة */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-sky-950/50">
              <Info size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">معلومات النظام الهندسي</h3>
              <p className="text-xs text-neutral-400">
                منصة CAD المتكاملة للمخططات المعمارية والكهروميكانيكية (MEP)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* أزرار التبويبات */}
        <div className="flex border-b border-neutral-800 bg-neutral-950/40 px-6 gap-2">
          <button
            onClick={() => setActiveTab('about')}
            className={`py-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'about'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Info size={15} />
            <span>نبذة عن التطبيق</span>
          </button>
          <button
            onClick={() => setActiveTab('shortcuts')}
            className={`py-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'shortcuts'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Keyboard size={15} />
            <span>جدول الاختصارات</span>
          </button>
          <button
            onClick={() => setActiveTab('developer')}
            className={`py-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'developer'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <User size={15} />
            <span>معلومات المطور</span>
          </button>
        </div>

        {/* محتوى التبويبات */}
        <div className="p-6 overflow-y-auto text-xs space-y-4">
          {/* تبويب 1: نبذة عن التطبيق */}
          {activeTab === 'about' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-gradient-to-br from-sky-950/40 via-neutral-900 to-indigo-950/30 p-4 rounded-xl border border-sky-800/40 leading-relaxed">
                <h4 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                  <Sparkles size={16} className="text-sky-400" />
                  منظومة CAD الهندسية الشاملة
                </h4>
                <p className="text-neutral-300 text-xs leading-6">
                  برنامج تصميم وهندسة متقدم مبني بأحدث تقنيات الويب العالمية، يُمكّن المهندسين
                  والمصممين من رسم المخططات المعمارية والكهروميكانيكية (MEP) بدقة تنفيذية متناهية
                  تتوافق مع المعايير والأكواد الهندسية الرسمية.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-neutral-950/60 p-3.5 rounded-xl border border-neutral-800 space-y-2">
                  <div className="flex items-center gap-2 text-sky-400 font-bold">
                    <ShieldCheck size={16} />
                    <span>المعايير والأكواد الهندسية المعتمدة</span>
                  </div>
                  <ul className="space-y-1.5 text-neutral-300 text-[11px] list-disc list-inside">
                    <li>كود البناء السعودي (SBC 401) للتمديدات الكهربائية والمعمارية.</li>
                    <li>كود الحريق والسلامة العالمي (NFPA 13) لتغطية مرشات الحريق.</li>
                    <li>الكود الكهربائي الوطني (NEC) لتباعد الأباريز والمفاتيح.</li>
                  </ul>
                </div>

                <div className="bg-neutral-950/60 p-3.5 rounded-xl border border-neutral-800 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <FileCode2 size={16} />
                    <span>محرك تصدير واستيراد AutoCAD DXF</span>
                  </div>
                  <ul className="space-y-1.5 text-neutral-300 text-[11px] list-disc list-inside">
                    <li>تصدير المخطط إلى ملفات DXF متوافقة 100% مع أوتوكاد AC1015 و R12.</li>
                    <li>استيراد ملفات AutoCAD DXF وتحويل الخطوط إلى جدران ومسارات ذكية.</li>
                    <li>توزيع العناصر على طبقات أوتوكاد معيارية تلقائياً.</li>
                  </ul>
                </div>

                <div className="bg-neutral-950/60 p-3.5 rounded-xl border border-neutral-800 space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-bold">
                    <Cpu size={16} />
                    <span>استوديو الرموز وجداول الكميات (BOQ)</span>
                  </div>
                  <ul className="space-y-1.5 text-neutral-300 text-[11px] list-disc list-inside">
                    <li>حصر كميات آلي فوري (Bill of Quantities) لجميع عناصر المشروع.</li>
                    <li>جدول رموز هندسية تفصيلي (Legend) يصنف كهرباء وسباكة وتكييف وحريق.</li>
                    <li>استوديو تصميم وحفظ الرموز الهندسية المخصصة واستيراد SVG.</li>
                  </ul>
                </div>

                <div className="bg-neutral-950/60 p-3.5 rounded-xl border border-neutral-800 space-y-2">
                  <div className="flex items-center gap-2 text-indigo-400 font-bold">
                    <Layers size={16} />
                    <span>المساعد الهندسي الذكي (AI Inspector)</span>
                  </div>
                  <ul className="space-y-1.5 text-neutral-300 text-[11px] list-disc list-inside">
                    <li>تدقيق ذكي للأخطاء الهندسية وتداخل المسارات وتوزيع الإنارة.</li>
                    <li>حساب أحمال التكييف والقدرة الكهربائية التقديرية بالواط.</li>
                    <li>فحص تباعد نقاط التغذية وقرب المفاتيح من فتحات الأبواب.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* تبويب 2: جدول الاختصارات */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="space-y-2">
                <h4 className="font-bold text-neutral-300 text-xs border-b border-neutral-800 pb-1 flex items-center justify-between">
                  <span className="text-sky-400 font-bold">أدوات الرسم والتصميم الأساسية</span>
                  <span className="text-[10px] text-neutral-500 font-mono-cad">Drawing Tools</span>
                </h4>
                <div className="grid grid-cols-2 gap-2 text-neutral-300">
                  <div className="flex items-center justify-between bg-neutral-950/50 p-2 rounded-lg border border-neutral-800">
                    <span>أداة رسم الجدار (Wall)</span>
                    <kbd className="bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700 font-mono-cad text-sky-400 font-bold">W</kbd>
                  </div>
                  <div className="flex items-center justify-between bg-neutral-950/50 p-2 rounded-lg border border-neutral-800">
                    <span>أداة إدراج الباب (Door)</span>
                    <kbd className="bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700 font-mono-cad text-amber-400 font-bold">D</kbd>
                  </div>
                  <div className="flex items-center justify-between bg-neutral-950/50 p-2 rounded-lg border border-neutral-800">
                    <span>أداة إدراج النافذة (Window)</span>
                    <kbd className="bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700 font-mono-cad text-teal-400 font-bold">N</kbd>
                  </div>
                  <div className="flex items-center justify-between bg-neutral-950/50 p-2 rounded-lg border border-neutral-800">
                    <span>إدراج الرموز الهندسية (Symbol)</span>
                    <kbd className="bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700 font-mono-cad text-amber-400 font-bold">S</kbd>
                  </div>
                  <div className="flex items-center justify-between bg-neutral-950/50 p-2 rounded-lg border border-neutral-800">
                    <span>رسم المسارات والكابلات (Route)</span>
                    <kbd className="bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700 font-mono-cad text-emerald-400 font-bold">R</kbd>
                  </div>
                  <div className="flex items-center justify-between bg-neutral-950/50 p-2 rounded-lg border border-neutral-800">
                    <span>أداة الأبعاد الهندسية (Dimension)</span>
                    <kbd className="bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700 font-mono-cad text-indigo-400 font-bold">M</kbd>
                  </div>
                  <div className="flex items-center justify-between bg-neutral-950/50 p-2 rounded-lg border border-neutral-800">
                    <span>شريط القياس السريع (Tape)</span>
                    <kbd className="bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700 font-mono-cad text-amber-400 font-bold">T</kbd>
                  </div>
                  <div className="flex items-center justify-between bg-neutral-950/50 p-2 rounded-lg border border-neutral-800">
                    <span>أداة قياس المساحة والمحيط (Area)</span>
                    <kbd className="bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700 font-mono-cad text-emerald-400 font-bold">A</kbd>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-neutral-300 text-xs border-b border-neutral-800 pb-1 flex items-center justify-between">
                  <span className="text-indigo-400 font-bold">أدوات التحديد والتحريك والتنقل</span>
                  <span className="text-[10px] text-neutral-500 font-mono-cad">Selection & Navigation</span>
                </h4>
                <div className="grid grid-cols-2 gap-2 text-neutral-300">
                  <div className="flex items-center justify-between bg-neutral-950/50 p-2 rounded-lg border border-neutral-800">
                    <span>أداة التحديد والتحريك (Select)</span>
                    <kbd className="bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700 font-mono-cad text-sky-400 font-bold">V</kbd>
                  </div>
                  <div className="flex items-center justify-between bg-neutral-950/50 p-2 rounded-lg border border-neutral-800">
                    <span>تحديد الكل في المشروع</span>
                    <kbd className="bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700 font-mono-cad text-sky-400 font-bold">Ctrl + A</kbd>
                  </div>
                  <div className="flex items-center justify-between bg-neutral-950/50 p-2 rounded-lg border border-neutral-800">
                    <span>تحديد بمربع إحاطة (Marquee Box)</span>
                    <span className="text-[11px] text-neutral-400">سحب مستطيل بالفأرة</span>
                  </div>
                  <div className="flex items-center justify-between bg-neutral-950/50 p-2 rounded-lg border border-neutral-800">
                    <span>تحديد متعدد تراكمي</span>
                    <kbd className="bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700 font-mono-cad text-sky-400 font-bold">Shift + نقر</kbd>
                  </div>
                  <div className="flex items-center justify-between bg-neutral-950/50 p-2 rounded-lg border border-neutral-800">
                    <span>تحريك اللوحة (Pan Tool)</span>
                    <kbd className="bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700 font-mono-cad text-sky-400 font-bold">Space + سحب</kbd>
                  </div>
                  <div className="flex items-center justify-between bg-neutral-950/50 p-2 rounded-lg border border-neutral-800">
                    <span>تكبير / تصغير الكانفس (Zoom)</span>
                    <span className="text-[11px] text-neutral-400 font-mono-cad">عجلة الفأرة (Wheel)</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-neutral-300 text-xs border-b border-neutral-800 pb-1 flex items-center justify-between">
                  <span className="text-emerald-400 font-bold">الأوامر السريعة والتحكم</span>
                  <span className="text-[10px] text-neutral-500 font-mono-cad">Quick Actions</span>
                </h4>
                <div className="grid grid-cols-2 gap-2 text-neutral-300">
                  <div className="flex items-center justify-between bg-neutral-950/50 p-2 rounded-lg border border-neutral-800">
                    <span>قفل الزوايا المتعامدة (Ortho)</span>
                    <kbd className="bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700 font-mono-cad text-emerald-400 font-bold">Shift (أثناء الرسم)</kbd>
                  </div>
                  <div className="flex items-center justify-between bg-neutral-950/50 p-2 rounded-lg border border-neutral-800">
                    <span>إنهاء رسم المسار أو المضلع</span>
                    <kbd className="bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700 font-mono-cad text-emerald-400 font-bold">Enter أو نقر مزدوج</kbd>
                  </div>
                  <div className="flex items-center justify-between bg-neutral-950/50 p-2 rounded-lg border border-neutral-800">
                    <span>حذف العناصر المحددة</span>
                    <kbd className="bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700 font-mono-cad text-rose-400 font-bold">Delete / Backspace</kbd>
                  </div>
                  <div className="flex items-center justify-between bg-neutral-950/50 p-2 rounded-lg border border-neutral-800">
                    <span>إلغاء الأمر الحالي أو التحديد</span>
                    <kbd className="bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700 font-mono-cad text-neutral-300 font-bold">Esc</kbd>
                  </div>
                  <div className="flex items-center justify-between bg-neutral-950/50 p-2 rounded-lg border border-neutral-800">
                    <span>تراجع عن الإجراء (Undo)</span>
                    <kbd className="bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700 font-mono-cad text-sky-400 font-bold">Ctrl + Z</kbd>
                  </div>
                  <div className="flex items-center justify-between bg-neutral-950/50 p-2 rounded-lg border border-neutral-800">
                    <span>إعادة الإجراء (Redo)</span>
                    <kbd className="bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700 font-mono-cad text-sky-400 font-bold">Ctrl + Y</kbd>
                  </div>
                  <div className="flex items-center justify-between bg-neutral-950/50 p-2 rounded-lg border border-neutral-800">
                    <span>تصدير المخطط وطباعة PDF</span>
                    <kbd className="bg-neutral-800 px-2 py-0.5 rounded border border-neutral-700 font-mono-cad text-sky-400 font-bold">Ctrl + P</kbd>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* تبويب 3: معلومات المطور */}
          {activeTab === 'developer' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div className="bg-gradient-to-r from-neutral-950 via-neutral-900 to-sky-950/50 p-5 rounded-2xl border border-sky-800/40 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-xl shadow-sky-950/60 shrink-0 border border-white/20">
                    <User size={32} />
                  </div>
                  <div className="space-y-1.5 text-center sm:text-right flex-1">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                      <Award size={12} />
                      <span>المطور والمؤسس الهندسي</span>
                    </div>
                    <h3 className="text-lg font-extrabold text-white">
                      أحمد الناطور
                      <span className="text-xs text-neutral-400 font-normal mr-2 font-mono-cad">
                        (Ahmed Al-Natour)
                      </span>
                    </h3>
                    <p className="text-neutral-300 text-xs leading-relaxed">
                      مهندس ومطور نظم برمجية هندسية، متخصص في بناء حلول الرسم الحاسوبي (CAD Engines)
                      وأتمتة مخططات كود البناء السعودي وحصر الكميات الذكي.
                    </p>
                  </div>
                </div>
              </div>

              {/* بطاقة البريد الإلكتروني والتواصل */}
              <div className="bg-neutral-950/80 p-4 rounded-xl border border-neutral-800 space-y-3">
                <span className="text-xs font-bold text-neutral-200 block">
                  معلومات الاتصال والدعم الفني:
                </span>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-neutral-900 p-3 rounded-lg border border-neutral-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-sky-950/80 border border-sky-800/50 flex items-center justify-center text-sky-400">
                      <Mail size={16} />
                    </div>
                    <div>
                      <span className="text-[10px] text-neutral-400 block">البريد الإلكتروني المعتمد</span>
                      <span className="font-mono-cad text-sm font-bold text-sky-300 select-all">
                        knatoura@gmail.com
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyEmail}
                      className="flex-1 sm:flex-none px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border border-neutral-700 transition-colors"
                      title="نسخ البريد الإلكتروني إلى الحافظة"
                    >
                      {copied ? (
                        <>
                          <Check size={14} className="text-emerald-400" />
                          <span className="text-emerald-400">تم النسخ ✓</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>نسخ البريد</span>
                        </>
                      )}
                    </button>

                    <a
                      href="mailto:knatoura@gmail.com?subject=استفسار%20حول%20تطبيق%20المخططات%20الهندسية"
                      className="flex-1 sm:flex-none px-3.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-sky-950/40 transition-colors"
                    >
                      <ExternalLink size={13} />
                      <span>مراسلة مباشرة</span>
                    </a>
                  </div>
                </div>

                <div className="bg-neutral-900/50 p-3 rounded-lg border border-neutral-800 text-[11px] text-neutral-400 leading-relaxed">
                  💡 لأي استفسارات تقنية، مقترحات تطويرية، أو طلب ميزات إضافية في الإصدارات القادمة،
                  يسعدنا تواصلكم عبر البريد الإلكتروني المباشر.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* تذييل النافذة */}
        <div className="px-6 py-3 border-t border-neutral-800 bg-neutral-950/90 flex items-center justify-between">
          <span className="text-[11px] text-neutral-400 font-mono-cad">
            النسخة 2.5 (AutoCAD DXF & MEP Integrated)
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white font-medium text-xs rounded-lg transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
