/**
 * @file AboutInfoModal.tsx
 * @description واجهة المعلومات الشاملة: نبذة عن التطبيق، جدول اختصارات لوحة المفاتيح، ومعلومات المطور.
 * المطور: أحمد الناطور (knatoura@gmail.com)
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
  Code2,
  Cpu,
  Layers,
  Sparkles,
  FileCode2,
  Compass,
  Zap,
  CheckCircle2,
  HelpCircle,
  FileSpreadsheet,
} from 'lucide-react';

interface AboutInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'overview' | 'shortcuts' | 'developer';
}

export const AboutInfoModal: React.FC<AboutInfoModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'overview',
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'shortcuts' | 'developer'>(defaultTab);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [shortcutSearch, setShortcutSearch] = useState('');

  if (!isOpen) return null;

  const developerEmail = 'knatoura@gmail.com';
  const developerName = 'أحمد الناطور';

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(developerEmail);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2500);
  };

  const shortcutsList = [
    { key: 'V', label: 'أداة التحديد والتحريك', desc: 'تحديد العناصر الفردية، المجموعات، وتحريكها على اللوحة', category: 'الرسم والتحرير' },
    { key: 'W', label: 'رسم جدار معماري', desc: 'بدء رسم جدار بسماكة محددة مع التقاط تلقائي للزوايا', category: 'الرسم والتحرير' },
    { key: 'D', label: 'إدراج باب معماري', desc: 'تثبيت باب في الجدار مع التحكم في اتجاه الفتح والمفصلة', category: 'الرسم والتحرير' },
    { key: 'N', label: 'إدراج نافذة معمارية', desc: 'تثبيت فتحة نافذة بالجدار مع ضبط العرض بدقة', category: 'الرسم والتحرير' },
    { key: 'S', label: 'إدراج رمز هندسي MEP', desc: 'اختيار وتثبيت رمز من مكتبة الكهرباء، السباكة، والتكييف', category: 'الرسم والتحرير' },
    { key: 'R', label: 'رسم مسار أو كابل', desc: 'رسم كابلات ومواسير كهروميكانيكية مع حساب فوري للأطوال', category: 'الرسم والتحرير' },
    { key: 'M', label: 'أداة قياس البعد', desc: 'إضافة خط بعد هندسي (Dimension) بين نقطتين', category: 'القياس والحساب' },
    { key: 'T', label: 'شريط القياس السريع', desc: 'قياس المسافة اللحظية بين نقطتين دون تثبيت عنصر', category: 'القياس والحساب' },
    { key: 'A', label: 'حساب المساحة والمحيط', desc: 'تحديد مضلع مغلق لحساب المساحة بالمتر المربع والمحيط', category: 'القياس والحساب' },
    { key: 'Space + سحب', label: 'تحريك اللوحة (Pan)', desc: 'التجول والتحريك السريع لمشهد الرسم بالكامل', category: 'التنقل والعرض' },
    { key: 'عجلة الفأرة', label: 'تكبير وتصغير (Zoom)', desc: 'تكبير وتصغير سلس متمركز حول مؤشر الفأرة', category: 'التنقل والعرض' },
    { key: 'Shift (أثناء الرسم)', label: 'التعامد الصارم (Ortho)', desc: 'قفل زاوية الرسم على المحاور الأفقية والعمودية (90° / 180°)', category: 'الدقة والمساعدة' },
    { key: 'F8', label: 'وضع التعامد الدائم (Ortho)', desc: 'تشغيل/إيقاف تقييد الرسم على 0°/90° دون الحاجة لإبقاء Shift مضغوطاً', category: 'الدقة والمساعدة' },
    { key: 'x,y ثم Enter', label: 'إحداثيات مطلقة', desc: 'أثناء أي أداة رسم: اكتب الإحداثيات بالمتر مثل 4,2.5 لوضع نقطة دقيقة', category: 'الدقة والمساعدة' },
    { key: '@dx,dy ثم Enter', label: 'إحداثيات نسبية', desc: 'إزاحة من آخر نقطة بالمتر، مثل ‎@3,0', category: 'الدقة والمساعدة' },
    { key: '@طول<زاوية ثم Enter', label: 'إحداثيات قطبية', desc: 'طول وزاوية من آخر نقطة، مثل ‎@2.5<90 (0° يمين، 90° للأسفل)', category: 'الدقة والمساعدة' },
    { key: 'التتبع التلقائي', label: 'تتبع المحاذاة والتقاط التقاطع والعمودي', desc: 'مرّر المؤشر على نهاية جدار ثم تحرك أفقياً/رأسياً لتظهر خطوط محاذاة خضراء؛ وتُلتقط التقاطعات والعمودي من نقطة البداية تلقائياً', category: 'الدقة والمساعدة' },
    { key: 'Ctrl + A', label: 'تحديد كافة العناصر', desc: 'تحديد جميع الكائنات الموجودة في اللوحة معاً', category: 'التحديد والمكتبة' },
    { key: 'Delete / Backspace', label: 'حذف العنصر المحدد', desc: 'حذف الجدار، الباب، الرمز، أو المسار المختار', category: 'الرسم والتحرير' },
    { key: 'Ctrl + Z', label: 'تراجع (Undo)', desc: 'التراجع عن آخر إجراء هندسي أو تعديل على المخطط', category: 'الأوامر العامة' },
    { key: 'Ctrl + Y / Ctrl+Shift+Z', label: 'إعادة (Redo)', desc: 'إعادة تطبيق الإجراء المتراجع عنه', category: 'الأوامر العامة' },
    { key: 'Enter / نقر مزدوج', label: 'إنهاء رسم المسار / المساحة', desc: 'تأكيد وحفظ نقاط المسار الحالي أو إغلاق مضلع المساحة', category: 'الرسم والتحرير' },
    { key: 'Esc', label: 'إلغاء الأمر الحالي', desc: 'إلغاء عملية الرسم الحالية أو إلغاء تحديد العنصر', category: 'الأوامر العامة' },
    { key: 'Ctrl + P', label: 'تصدير وطباعة المخطط', desc: 'فتح نافذة إعداد المخطط للطباعة وتصدير PDF عالي الدقة', category: 'التصدير والمشاركة' },
  ];

  const filteredShortcuts = shortcutsList.filter(
    (s) =>
      s.key.toLowerCase().includes(shortcutSearch.toLowerCase()) ||
      s.label.includes(shortcutSearch) ||
      s.desc.includes(shortcutSearch) ||
      s.category.includes(shortcutSearch)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs select-none p-4">
      <div className="w-full max-w-2xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-neutral-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh]">
        {/* رأس النافذة */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-sky-600/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Info size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                دليل النظام ومعلومات المطور
                <span className="text-[10px] bg-sky-950 text-sky-400 border border-sky-800/80 px-2 py-0.5 rounded-full font-mono-cad">
                  الإصدار الاحترافي v7.0
                </span>
              </h3>
              <p className="text-xs text-neutral-400">
                منصة التصميم الهندسي والمعماري والكهروميكانيكي المتكاملة (CAD / BIM Web Studio)
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

        {/* أشرطة التبويب (Tabs) */}
        <div className="flex items-center gap-2 px-6 pt-3 bg-neutral-950/40 border-b border-neutral-800/80">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'overview'
                ? 'border-sky-500 text-sky-400 bg-neutral-900'
                : 'border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850'
            }`}
          >
            <Sparkles size={15} />
            <span>نبذة عن المنصة الهندسية</span>
          </button>

          <button
            onClick={() => setActiveTab('shortcuts')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'shortcuts'
                ? 'border-sky-500 text-sky-400 bg-neutral-900'
                : 'border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850'
            }`}
          >
            <Keyboard size={15} />
            <span>جدول الاختصارات ({shortcutsList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('developer')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'developer'
                ? 'border-sky-500 text-sky-400 bg-neutral-900'
                : 'border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850'
            }`}
          >
            <User size={15} />
            <span>معلومات المطور والاتصال</span>
          </button>
        </div>

        {/* محتوى التبويبات */}
        <div className="p-6 overflow-y-auto text-xs space-y-4 max-h-[62vh]">
          {/* التبويب 1: نبذة عن المنصة */}
          {activeTab === 'overview' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-gradient-to-r from-sky-950/40 via-neutral-900 to-indigo-950/40 p-4 rounded-xl border border-sky-900/40 space-y-2">
                <h4 className="text-sm font-bold text-white flex items-center gap-2">
                  <Cpu size={16} className="text-sky-400" />
                  رؤية النظام التقنية
                </h4>
                <p className="text-neutral-300 leading-relaxed text-xs">
                  تطبيق هندسي متكامل يعمل مباشرة عبر متصفح الويب بمعايير برامج CAD العالمية (مثل AutoCAD و Revit)، مخصص للمهندسين المعماريين، الإنشائيين، ومقاولي الأعمال الكهروميكانيكية (MEP)، مصمم ليقدم تجربة عمل خفيفة وسريعة بدقة ملمترية وحسابات تلقائية.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-neutral-950/50 p-3.5 rounded-xl border border-neutral-800 space-y-1.5">
                  <div className="flex items-center gap-2 text-sky-400 font-bold">
                    <CheckCircle2 size={15} />
                    <span>رسم معماري متقدم (Architectural)</span>
                  </div>
                  <p className="text-neutral-400 text-[11px] leading-relaxed">
                    جدران ديناميكية بسماكات وزوايا قابلة للتحكم، فتحات أبواب معمارية ونوافذ تلتصق آلياً بالجدران مع إمكانية عكس اتجاه الفتح الداخلي والخارجي والمفصلات.
                  </p>
                </div>

                <div className="bg-neutral-950/50 p-3.5 rounded-xl border border-neutral-800 space-y-1.5">
                  <div className="flex items-center gap-2 text-amber-400 font-bold">
                    <Zap size={15} />
                    <span>أنظمة كهروميكانيكية (MEP Systems)</span>
                  </div>
                  <p className="text-neutral-400 text-[11px] leading-relaxed">
                    مكتبة رموز قياسية (إنارة، قوى، سباكة، تكييف، إطفاء حريق) مع رسم المسارات الحية بالوقت الفعلي وأنماط الخطوط (مستمر، متقطع، منقط) وتحديد الأقطار.
                  </p>
                </div>

                <div className="bg-neutral-950/50 p-3.5 rounded-xl border border-neutral-800 space-y-1.5">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <FileSpreadsheet size={15} />
                    <span>حصر الكميات الآلي (Legend & BOQ)</span>
                  </div>
                  <p className="text-neutral-400 text-[11px] leading-relaxed">
                    توليد فوري لجداول حصر الكميات والمواد، أطوال الكابلات والمواسير، وعدد الأجهزة والرموز مع إمكانية التصدير كملف Excel / CSV.
                  </p>
                </div>

                <div className="bg-neutral-950/50 p-3.5 rounded-xl border border-neutral-800 space-y-1.5">
                  <div className="flex items-center gap-2 text-purple-400 font-bold">
                    <FileCode2 size={15} />
                    <span>توافق كامل مع AutoCAD DXF</span>
                  </div>
                  <p className="text-neutral-400 text-[11px] leading-relaxed">
                    تصدير واستيراد مخططات DXF معيارية مطابقة لطبقات وألوان AutoCAD لضمان التكامل مع مكاتب الاستشارات الهندسية والمصممين.
                  </p>
                </div>
              </div>

              {/* مواصفات البيئة */}
              <div className="bg-neutral-950/30 p-3 rounded-xl border border-neutral-800 flex items-center justify-between text-neutral-400 text-[11px]">
                <span className="flex items-center gap-1.5">
                  <Layers size={13} className="text-sky-400" />
                  محرك الرسم: Konva HTML5 Canvas 2D
                </span>
                <span className="font-mono-cad text-neutral-300">
                  نظام الإحداثيات: World Space (Scale 1:50)
                </span>
              </div>
            </div>
          )}

          {/* التبويب 2: جدول الاختصارات */}
          {activeTab === 'shortcuts' && (
            <div className="space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between gap-3">
                <input
                  type="text"
                  placeholder="ابحث عن اختصار أو أداة..."
                  value={shortcutSearch}
                  onChange={(e) => setShortcutSearch(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white placeholder-neutral-500 outline-none focus:border-sky-500"
                />
                <span className="text-[11px] text-neutral-400 shrink-0 font-mono-cad">
                  {filteredShortcuts.length} من {shortcutsList.length}
                </span>
              </div>

              <div className="border border-neutral-800 rounded-xl overflow-hidden bg-neutral-950/60 divide-y divide-neutral-800/80">
                <div className="grid grid-cols-12 px-3 py-2 bg-neutral-950 text-[11px] font-bold text-neutral-400">
                  <div className="col-span-3">المفتاح / الاختصار</div>
                  <div className="col-span-4">الأداة / الإجراء</div>
                  <div className="col-span-5">الوصف الهندسي</div>
                </div>

                <div className="divide-y divide-neutral-800/60 max-h-[46vh] overflow-y-auto">
                  {filteredShortcuts.map((s, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 px-3 py-2.5 items-center hover:bg-neutral-850/50 transition-colors text-neutral-300"
                    >
                      <div className="col-span-3">
                        <kbd className="inline-block bg-neutral-800 border border-neutral-700 text-sky-300 font-mono-cad font-bold px-2 py-0.5 rounded text-[11px] shadow-xs">
                          {s.key}
                        </kbd>
                      </div>
                      <div className="col-span-4 font-semibold text-white text-xs">
                        {s.label}
                      </div>
                      <div className="col-span-5 text-neutral-400 text-[11px]">
                        {s.desc}
                      </div>
                    </div>
                  ))}
                  {filteredShortcuts.length === 0 && (
                    <div className="p-6 text-center text-neutral-500">
                      لا توجد اختصارات تطابق بحثك
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* التبويب 3: معلومات المطور */}
          {activeTab === 'developer' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-gradient-to-br from-neutral-950 via-neutral-900 to-sky-950/30 p-5 rounded-2xl border border-sky-900/50 flex flex-col sm:flex-row items-center gap-5">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 flex items-center justify-center text-white shadow-xl shadow-sky-950/60 shrink-0">
                  <User size={38} />
                </div>
                <div className="space-y-2 text-center sm:text-right flex-1">
                  <div>
                    <h4 className="text-base font-bold text-white flex items-center justify-center sm:justify-start gap-2">
                      <span>{developerName}</span>
                      <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full font-bold">
                        مطور النظام
                      </span>
                    </h4>
                    <p className="text-xs text-sky-400 mt-0.5">
                      مهندس برمجيات ونظم CAD / BIM الهندسية
                    </p>
                  </div>

                  <p className="text-neutral-300 text-xs leading-relaxed">
                    مختص في تطوير حلول البرمجيات الهندسية المتقدمة، معالجة الرسوميات ثنائية وثلاثية الأبعاد عبر الويب، وتطوير أدوات الأتمتة للمخططات المعمارية والكهروميكانيكية وفق أعلى المعايير الهندسية.
                  </p>
                </div>
              </div>

              {/* بطاقة الاتصال والبريد الإلكتروني */}
              <div className="bg-neutral-950/60 p-4 rounded-xl border border-neutral-800 space-y-3">
                <span className="text-xs font-bold text-neutral-300 block">
                  قنوات التواصل المباشر مع المطور:
                </span>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-neutral-900 p-3 rounded-xl border border-neutral-800">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-sky-600/20 text-sky-400 flex items-center justify-center">
                      <Mail size={16} />
                    </div>
                    <div>
                      <span className="text-[11px] text-neutral-400 block">البريد الإلكتروني المعتمد:</span>
                      <a
                        href={`mailto:${developerEmail}?subject=استفسار بخصوص منصة CAD الهندسية`}
                        className="font-mono-cad text-sm font-bold text-sky-400 hover:text-sky-300 hover:underline"
                        dir="ltr"
                      >
                        {developerEmail}
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyEmail}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg border border-neutral-700 transition-colors"
                      title="نسخ عنوان البريد الإلكتروني"
                    >
                      {copiedEmail ? (
                        <>
                          <Check size={14} className="text-emerald-400" />
                          <span className="text-emerald-400 font-bold">تم النسخ ✓</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>نسخ البريد</span>
                        </>
                      )}
                    </button>

                    <a
                      href={`mailto:${developerEmail}?subject=استفسار بخصوص منصة CAD الهندسية`}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg font-bold shadow-md shadow-sky-950/40 transition-colors"
                    >
                      <ExternalLink size={14} />
                      <span>إرسال رسالة</span>
                    </a>
                  </div>
                </div>
              </div>

              {/* ملاحظة حول التطوير المستمر */}
              <div className="p-3 bg-neutral-950/40 rounded-xl border border-neutral-800 text-[11px] text-neutral-400 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                <span>
                  نرحب بجميع المقترحات والملاحظات لتطوير المنصة وإضافة مزايا هندسية جديدة تلبي متطلبات المشاريع العربية.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* تذييل النافذة */}
        <div className="px-6 py-3 border-t border-neutral-800 bg-neutral-950/80 flex items-center justify-between text-neutral-400 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            <span>المنصة جاهزة للعمل — الإصدار الهندسي المتكامل</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-lg text-xs font-semibold transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
