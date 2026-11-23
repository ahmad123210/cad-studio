/**
 * @file OnboardingTour.tsx
 * @description جولة تعريفية قصيرة لأول تشغيل (المرحلة 19): تُظلل كل جزء من الواجهة مع شرح مختصر.
 * تظهر مرة واحدة (تُحفظ في التخزين المحلي) ويمكن إعادتها من بحث الأوامر Ctrl+K أو نافذة المساعدة.
 * لا تظهر تلقائياً في المتصفحات الآلية (navigator.webdriver) حتى لا تعترض الاختبارات.
 */

import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';

export const TOUR_DONE_KEY = 'cad_tour_done';

interface Step {
  target: string | null;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    target: null,
    title: 'أهلاً بك في مخططاتي',
    body: 'جولة سريعة من ست خطوات تعرّفك بأهم أجزاء البرنامج. يمكنك تخطيها الآن وإعادتها لاحقاً من بحث الأوامر (Ctrl+K).',
  },
  {
    target: '[data-tour="tools"]',
    title: 'أدوات الرسم',
    body: 'الجدران والأبواب والنوافذ والأبعاد والأشكال والرموز والمسارات. لكل أداة مفتاح مختصر يظهر عند مرور المؤشر.',
  },
  {
    target: '[data-tour="command-bar"]',
    title: 'شريط الأوامر',
    body: 'اكتب اسم أي أمر (جدار، نقل، مرآة، trim…) أو إحداثيات بالمتر مثل 4,2.5 أو ‎@3<90. اضغط / للتركيز وEnter لتكرار آخر أمر.',
  },
  {
    target: '[data-tour="properties"]',
    title: 'لوحة المعلومات والخصائص',
    body: 'ملخص المشروع، وعند تحديد عنصر تظهر خصائصه هنا (السماكة، الارتفاع، الطبقة، الدائرة الكهربائية…).',
  },
  {
    target: '[data-tour="boq"]',
    title: 'الكميات والطباعة',
    body: 'جدول الكميات يُحسب من المخطط مباشرة مع الأسعار والتصدير إلى Excel، والطباعة بمقياس حقيقي وخرطوشة كاملة.',
  },
  {
    target: '[data-testid="lang-toggle"]',
    title: 'اللغة والسمة',
    body: 'بدّل الواجهة بين العربية والإنجليزية، وبين السمة الداكنة والفاتحة من هنا.',
  },
  {
    target: null,
    title: 'ابحث عن أي شيء بـ Ctrl+K',
    body: 'كل الأوامر والنوافذ في مكان واحد: اضغط Ctrl+K واكتب ما تريد. ولبداية سريعة جرّب «مشروع جديد» واختر قالب شقة أو فيلا أو محل.',
  },
];

export function shouldAutoStartTour(): boolean {
  try {
    if (localStorage.getItem(TOUR_DONE_KEY)) return false;
  } catch {
    return false;
  }
  return !(typeof navigator !== 'undefined' && navigator.webdriver);
}

export const OnboardingTour: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (shouldAutoStartTour()) {
      const id = setTimeout(() => setOpen(true), 900);
      return () => clearTimeout(id);
    }
  }, []);

  useEffect(() => {
    const start = () => {
      setI(0);
      setOpen(true);
    };
    window.addEventListener('cad:start-tour', start);
    return () => window.removeEventListener('cad:start-tour', start);
  }, []);

  const finish = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(TOUR_DONE_KEY, '1');
    } catch {
      /* تجاهل */
    }
  }, []);

  const step = STEPS[i];

  const measure = useCallback(() => {
    if (!step?.target) return setRect(null);
    const el = document.querySelector(step.target);
    const r = el?.getBoundingClientRect();
    setRect(r && r.width > 0 && r.height > 0 ? r : null);
  }, [step]);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
      else if (e.key === 'ArrowLeft' || e.key === 'Enter') setI((x) => (x < STEPS.length - 1 ? x + 1 : x));
      else if (e.key === 'ArrowRight') setI((x) => Math.max(0, x - 1));
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, finish]);

  if (!open || !step) return null;

  const pad = 6;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cardW = 340;
  let cardStyle: React.CSSProperties = { left: vw / 2 - cardW / 2, top: vh / 2 - 110 };
  if (rect) {
    const spaceBelow = vh - rect.bottom;
    const top = spaceBelow > 220 ? rect.bottom + 14 : Math.max(12, rect.top - 214);
    let left = rect.left + rect.width / 2 - cardW / 2;
    if (rect.width < 120 && rect.left < 200) left = rect.right + 14; // شريط جانبي ضيق: البطاقة بجانبه
    else if (rect.width < 120 && rect.right > vw - 200) left = rect.left - cardW - 14;
    const midTop = rect.height > 300 ? Math.min(vh - 230, Math.max(12, rect.top + 80)) : top;
    cardStyle = { left: Math.min(vw - cardW - 12, Math.max(12, left)), top: rect.height > 300 ? midTop : top };
  }
  const last = i === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[80]" data-testid="onboarding-tour">
      {rect ? (
        <div
          className="absolute rounded-xl border-2 border-sky-400 pointer-events-none transition-all duration-200"
          style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)' }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/60" />
      )}
      <div className="absolute rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl p-4" style={{ ...cardStyle, width: cardW }} role="dialog" aria-label={step.title}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-sky-300" data-testid="tour-title">
            {step.title}
          </h3>
          <span className="text-[10px] font-mono text-neutral-500">
            {i + 1} / {STEPS.length}
          </span>
        </div>
        <p className="text-xs leading-6 text-neutral-300">{step.body}</p>
        <div className="flex items-center justify-between mt-4">
          <button onClick={finish} className="text-[11px] text-neutral-400 hover:text-neutral-200" data-testid="tour-skip">
            تخطي الجولة
          </button>
          <div className="flex gap-2">
            {i > 0 && (
              <button onClick={() => setI(i - 1)} className="px-3 py-1.5 text-xs rounded-md border border-neutral-700 text-neutral-300 hover:bg-neutral-800">
                السابق
              </button>
            )}
            <button
              onClick={() => (last ? finish() : setI(i + 1))}
              className="px-3 py-1.5 text-xs rounded-md bg-sky-600 hover:bg-sky-500 text-white font-bold"
              data-testid="tour-next"
            >
              {last ? 'ابدأ العمل' : 'التالي'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
