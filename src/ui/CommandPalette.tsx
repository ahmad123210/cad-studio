/**
 * @file CommandPalette.tsx
 * @description بحث سريع في كل الأوامر والنوافذ بالاختصار Ctrl+K (المرحلة 19).
 * يجمع أوامر شريط الأوامر (commands.ts) مع إجراءات الواجهة (فتح النوافذ، الحفظ، القوالب…)،
 * ويبحث بالعربية (مع توحيد الهمزات والتاء المربوطة) وبالإنجليزية وبالأسماء المختصرة.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, CornerDownLeft, Command as CommandIcon } from 'lucide-react';
import type { CadEngine } from '../engine/renderer.ts';
import { COMMANDS, codeLabel, effectiveCodes, runCommand } from '../engine/commands.ts';
import { t } from '../i18n/index.ts';

export interface PaletteAction {
  id: string;
  label: string;
  keywords?: string[];
  hint?: string;
  run: () => void;
}

interface Item {
  id: string;
  label: string;
  group: string;
  keys: string[];
  hint?: string;
  exec: () => string | null | void;
}

const RECENT_KEY = 'cad_palette_recent';

/** توحيد الكتابة العربية للبحث: أإآ→ا، ة→ه، ى→ي، وحذف التشكيل */
export function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .trim();
}

/** درجة المطابقة: تامة > بداية > احتواء > حروف متتابعة؛ 0 = لا تطابق */
export function matchScore(query: string, haystacks: string[]): number {
  const q = normalizeSearch(query);
  if (!q) return 1;
  let best = 0;
  for (const raw of haystacks) {
    const h = normalizeSearch(raw);
    if (!h) continue;
    if (h === q) best = Math.max(best, 100);
    else if (h.startsWith(q)) best = Math.max(best, 80);
    else if (h.split(/\s+/).some((w) => w.startsWith(q))) best = Math.max(best, 65);
    else if (h.includes(q)) best = Math.max(best, 50);
    else {
      let i = 0;
      for (const ch of h) if (ch === q[i]) i++;
      if (i === q.length && q.length >= 2) best = Math.max(best, 20);
    }
  }
  return best;
}

function readRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
  } catch {
    return [];
  }
}

interface Props {
  engine: CadEngine | null;
  actions: PaletteAction[];
}

export const CommandPalette: React.FC<Props> = ({ engine, actions }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Ctrl+K / Cmd+K من أي مكان (حتى داخل حقول الإدخال)، وحدث cad:open-palette من الأوامر
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.code === 'KeyK' || e.key.toLowerCase() === 'k')) {
        e.preventDefault();
        e.stopPropagation();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('cad:open-palette', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('cad:open-palette', onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const items = useMemo<Item[]>(() => {
    const cmdItems: Item[] = COMMANDS.map((c) => ({
      id: `cmd:${c.id}`,
      label: c.label,
      group: 'أوامر الرسم والتحرير',
      keys: [c.label, c.id, ...c.aliases, t(c.label)],
      hint: [effectiveCodes(c.id).map(codeLabel).join(' / '), c.aliases.find((a) => /^[a-z]+$/.test(a))].filter(Boolean).join(' · '),
      exec: () => (engine ? runCommand(engine, c.id) : null),
    }));
    const actItems: Item[] = actions.map((a) => ({
      id: `act:${a.id}`,
      label: a.label,
      group: 'النوافذ والإجراءات',
      keys: [a.label, a.id, ...(a.keywords ?? []), t(a.label)],
      hint: a.hint,
      exec: a.run,
    }));
    return [...actItems, ...cmdItems];
  }, [actions, engine]);

  const results = useMemo(() => {
    if (!query.trim()) {
      const recent = readRecent();
      const rec = recent.map((id) => items.find((i) => i.id === id)).filter(Boolean) as Item[];
      const rest = items.filter((i) => !recent.includes(i.id));
      return [...rec.map((i) => ({ ...i, group: 'المستخدمة مؤخراً' })), ...rest];
    }
    return items
      .map((i) => ({ i, s: matchScore(query, i.keys) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.i)
      .slice(0, 40);
  }, [items, query]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const execute = (item: Item | undefined) => {
    if (!item) return;
    setOpen(false);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify([item.id, ...readRecent().filter((x) => x !== item.id)].slice(0, 6)));
    } catch {
      /* تجاهل */
    }
    const err = item.exec();
    if (typeof err === 'string' && err) setToast(err);
  };

  if (!open) {
    return toast ? (
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] px-4 py-2 rounded-lg bg-rose-950/95 border border-rose-700 text-rose-200 text-xs shadow-xl" data-testid="palette-toast">
        {toast}
      </div>
    ) : null;
  }

  let lastGroup = '';
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[12vh] bg-black/50 backdrop-blur-[2px]" onMouseDown={() => setOpen(false)} data-testid="command-palette">
      <div className="w-[560px] max-w-[92vw] rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-800">
          <Search size={16} className="text-neutral-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(results.length - 1, a + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                execute(results[active]);
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setOpen(false);
              }
              e.stopPropagation();
            }}
            placeholder="ابحث عن أمر أو نافذة… (جدار، طباعة، كميات، trim)"
            className="flex-1 bg-transparent outline-none text-sm text-neutral-100 placeholder:text-neutral-500"
            data-testid="palette-input"
          />
          <kbd className="text-[10px] font-mono text-neutral-500 border border-neutral-700 rounded px-1.5 py-0.5">Esc</kbd>
        </div>
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-1" data-testid="palette-results">
          {results.length === 0 && <div className="px-4 py-6 text-center text-sm text-neutral-500">لا توجد نتائج مطابقة</div>}
          {results.map((item, idx) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <React.Fragment key={item.id + idx}>
                {header && <div className="px-4 pt-2 pb-1 text-[10px] font-bold text-neutral-500">{header}</div>}
                <button
                  data-index={idx}
                  data-testid={`palette-item-${item.id}`}
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => execute(item)}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-2 text-sm text-right ${idx === active ? 'bg-sky-600/20 text-sky-100' : 'text-neutral-200 hover:bg-neutral-800'}`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <CommandIcon size={13} className="text-neutral-500 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    {item.hint && <span className="text-[10px] font-mono text-neutral-500" data-no-i18n>{item.hint}</span>}
                    {idx === active && <CornerDownLeft size={12} className="text-sky-400" />}
                  </span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
        <div className="px-4 py-2 border-t border-neutral-800 text-[10px] text-neutral-500 flex gap-3">
          <span>↑ ↓ للتنقل</span>
          <span>Enter للتنفيذ</span>
          <span>Ctrl+K للفتح والإغلاق</span>
        </div>
      </div>
    </div>
  );
};
