/**
 * @file ShortcutsPanel.tsx
 * @description تخصيص اختصارات لوحة المفاتيح للأدوات وأوامر التحرير.
 * اضغط "تغيير" ثم المفتاح الجديد. المفتاح الافتراضي للأمر يُعطَّل تلقائياً بعد تخصيصه،
 * ويُنبَّه المستخدم عند التعارض مع أمر آخر. تُحفظ في إعدادات المستخدم (localStorage).
 */

import React, { useEffect, useState } from 'react';
import { Keyboard, RotateCcw } from 'lucide-react';
import { COMMANDS, RESERVED_CODES, codeLabel, effectiveCodes, getCustomShortcuts, setCustomShortcuts } from '../engine/commands.ts';

export const ShortcutsPanel: React.FC = () => {
  const [custom, setCustom] = useState<Record<string, string>>(() => getCustomShortcuts());
  const [capturing, setCapturing] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        setCapturing(null);
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey || RESERVED_CODES.has(e.code)) {
        setMessage(`المفتاح ${codeLabel(e.code)} محجوز للبرنامج؛ اختر حرفاً أو رقماً آخر.`);
        return;
      }
      // تعارض مع أمر آخر (بمفتاحه المخصص أو الافتراضي)
      const conflict = COMMANDS.find((c) => c.id !== capturing && effectiveCodes(c.id, custom).includes(e.code));
      const next = { ...custom, [capturing]: e.code };
      setCustom(next);
      setCustomShortcuts(next);
      setMessage(
        conflict
          ? `تم. تنبيه: ${codeLabel(e.code)} كان مفتاح "${conflict.label}"؛ صار الآن لهذا الأمر.`
          : `تم تعيين ${codeLabel(e.code)}.`
      );
      setCapturing(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [capturing, custom]);

  const reset = (id?: string) => {
    const next = { ...custom };
    if (id) delete next[id];
    const final = id ? next : {};
    setCustom(final);
    setCustomShortcuts(final);
    setMessage(id ? 'أُعيد المفتاح الافتراضي.' : 'أُعيدت كل الاختصارات الافتراضية.');
  };

  return (
    <div className="p-3 bg-[var(--cad-panel-bg)] border border-[var(--cad-border)] rounded-lg space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-[var(--cad-text-secondary)] flex items-center gap-1.5">
          <Keyboard size={14} className="text-sky-400" />
          تخصيص اختصارات لوحة المفاتيح
        </span>
        <button onClick={() => reset()} className="flex items-center gap-1 px-2 py-0.5 rounded border border-[var(--cad-border)] hover:bg-[var(--cad-surface-hover)] text-[11px]">
          <RotateCcw size={11} /> الافتراضي للكل
        </button>
      </div>
      {message && <p className="text-[11px] text-amber-300">{message}</p>}
      <ul className="max-h-56 overflow-y-auto divide-y divide-[var(--cad-border)] text-[11px]">
        {COMMANDS.filter((c) => c.remappable).map((c) => {
          const codes = effectiveCodes(c.id, custom);
          return (
            <li key={c.id} className="flex items-center justify-between py-1.5 gap-2">
              <span className="flex-1">{c.label}</span>
              <span className="font-mono-cad text-[10px] text-[var(--cad-text-muted)]">{c.aliases.filter((a) => /^[a-z]+$/.test(a)).join(' · ')}</span>
              <kbd className={`min-w-10 text-center px-1.5 py-0.5 rounded border font-mono-cad ${custom[c.id] ? 'border-sky-500/60 text-sky-300' : 'border-[var(--cad-border)]'}`}>
                {capturing === c.id ? '…' : codes.length ? codes.map(codeLabel).join(' / ') : '—'}
              </kbd>
              <button
                onClick={() => {
                  setMessage('اضغط المفتاح الجديد (Esc للإلغاء)');
                  setCapturing(c.id);
                }}
                className="px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-500 text-white"
              >
                تغيير
              </button>
              {custom[c.id] && (
                <button onClick={() => reset(c.id)} className="px-1.5 py-0.5 rounded border border-[var(--cad-border)] hover:bg-[var(--cad-surface-hover)]" title="المفتاح الافتراضي">
                  ↺
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-[10.5px] text-[var(--cad-text-muted)]">
        يمكن أيضاً كتابة اسم أي أمر في شريط الأوامر أسفل اللوحة (اضغط / للتركيز)، وEnter يكرر آخر أمر.
      </p>
    </div>
  );
};
