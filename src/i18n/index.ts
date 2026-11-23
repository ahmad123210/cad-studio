/**
 * طبقة الواجهة الإنجليزية (المرحلة 19).
 *
 * الواجهة مكتوبة بالعربية مباشرة في المكونات، لذا تعمل الترجمة وقت التشغيل:
 *  - مراقب DOM يترجم النصوص والسمات (title / placeholder / aria-label) من قاموس عربي→إنجليزي،
 *    ويحفظ الأصل ليعيده عند الرجوع إلى العربية دون إعادة تحميل.
 *  - رسم Canvas (اللوحة والطباعة) يمرّ عبر fillText/measureText، فيُترجم بنفس القاموس
 *    مع إبقاء القياس والرسم متطابقين.
 *  - الاتجاه يتحول إلى ltr مع الإنجليزية.
 * القاموس يُحمّل عند الطلب فقط، فلا يزيد حجم النسخة العربية.
 * النصوص التي لا توجد في القاموس تبقى كما هي (وتُجمع في window.__i18nMissing للمراجعة).
 */

export type UiLang = 'ar' | 'en';

const STORAGE_KEY = 'cad_ui_lang';
const AR_RE = /[؀-ۿ]/;
const ATTRS = ['title', 'placeholder', 'aria-label'] as const;

let lang: UiLang = readSavedLang();
let exact: Record<string, string> | null = null;
let patterns: Array<{ re: RegExp; en: string }> = [];
const cache = new Map<string, string | null>();
const missing = new Set<string>();

function readSavedLang(): UiLang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'ar';
  } catch {
    return 'ar';
  }
}

export function getLang(): UiLang {
  return lang;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function loadDictionary(): Promise<void> {
  if (exact) return;
  const mod = await import('./en');
  exact = mod.EN_EXACT;
  patterns = mod.EN_PATTERNS.map(([ar, en]) => {
    const parts = ar.split(/\{\d+\}/);
    const body = parts.map(escapeRe).join('([\\s\\S]+?)');
    return { re: new RegExp(`^${body}$`), en };
  });
  cache.clear();
}

/** يترجم نصاً كاملاً (بعد ضم المسافات) أو يعيد null إن لم يوجد. */
function lookup(norm: string): string | null {
  if (!exact) return null;
  const hit = cache.get(norm);
  if (hit !== undefined) return hit;
  let out: string | null = exact[norm] ?? null;
  if (out === null) {
    // نقطتان أو علامة ترقيم في الطرف: «الطبقة:» ← «Layer:»
    const m = norm.match(/^(.*?)([:：.؟?!،,…*]+)$/);
    if (m && exact[m[1]]) out = exact[m[1]] + m[2].replace('؟', '?').replace('،', ',');
  }
  if (out === null) {
    for (const p of patterns) {
      const mm = norm.match(p.re);
      if (mm) {
        out = p.en.replace(/\{(\d+)\}/g, (_, i) => {
          const v = mm[Number(i) + 1] ?? '';
          return AR_RE.test(v) ? lookup(v.trim()) ?? v : v;
        });
        break;
      }
    }
  }
  if (out === null) {
    // نص مركّب بفواصل شائعة: «جدار — باب»
    const sep = norm.match(/\s(—|·|\||•)\s/);
    if (sep) {
      const pieces = norm.split(` ${sep[1]} `);
      const tr = pieces.map((p) => (AR_RE.test(p) ? lookup(p.trim()) : p));
      if (tr.every((x) => x !== null)) out = tr.join(` ${sep[1]} `);
    }
  }
  if (out === null) {
    // وحدات منفردة داخل نص رقمي: «4.00 م (90°)» ← «4.00 m (90°)»
    const units = norm
      .replace(/(^|[\s\d(])م²(?=$|[\s)·,:])/g, '$1m²')
      .replace(/(^|[\s\d(])م³(?=$|[\s)·,:])/g, '$1m³')
      .replace(/(^|[\s\d(])سم(?=$|[\s)·,:])/g, '$1cm')
      .replace(/(^|[\s\d(])مم(?=$|[\s)·,:])/g, '$1mm')
      .replace(/(^|[\s\d(])م(?=$|[\s)·,:])/g, '$1m');
    if (!AR_RE.test(units)) out = units;
  }
  if (out === null) missing.add(norm);
  cache.set(norm, out);
  return out;
}

/** ترجمة نص للاستخدام البرمجي (تعيد النص نفسه بالعربية أو إن لم يُعثر عليه). */
export function t(text: string): string {
  if (lang !== 'en' || !text || !AR_RE.test(text)) return text;
  const lead = text.match(/^\s*/)![0];
  const trail = text.match(/\s*$/)![0];
  const norm = text.trim().replace(/\s+/g, ' ');
  const out = lookup(norm);
  return out === null ? text : lead + out + trail;
}

// ─────────────────────────── ترجمة DOM ───────────────────────────

const origText = new WeakMap<Text, string>();
const shownText = new WeakMap<Text, string>();
const origAttr = new WeakMap<Element, Map<string, string>>();
const shownAttr = new WeakMap<Element, Map<string, string>>();
let observer: MutationObserver | null = null;

function skipped(el: Element | null): boolean {
  if (!el) return true;
  const tag = el.tagName;
  if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA') return true;
  return !!el.closest('[data-no-i18n]');
}

function translateTextNode(node: Text): void {
  const v = node.nodeValue ?? '';
  if (shownText.get(node) === v) return;
  if (!AR_RE.test(v) || skipped(node.parentElement)) return;
  const tr = t(v);
  if (tr === v) return;
  origText.set(node, v);
  shownText.set(node, tr);
  node.nodeValue = tr;
}

function translateAttrs(el: Element): void {
  if (skipped(el)) return;
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (!v || !AR_RE.test(v)) continue;
    if (shownAttr.get(el)?.get(a) === v) continue;
    const tr = t(v);
    if (tr === v) continue;
    if (!origAttr.has(el)) origAttr.set(el, new Map());
    if (!shownAttr.has(el)) shownAttr.set(el, new Map());
    origAttr.get(el)!.set(a, v);
    shownAttr.get(el)!.set(a, tr);
    el.setAttribute(a, tr);
  }
  if (el.getAttribute('dir') === 'rtl') {
    el.setAttribute('data-i18n-dir', 'rtl');
    el.setAttribute('dir', 'ltr');
  }
}

function translateTree(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const el = root as Element;
  translateAttrs(el);
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n = walker.nextNode();
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) translateTextNode(n as Text);
    else translateAttrs(n as Element);
    n = walker.nextNode();
  }
}

function restoreTree(root: Element): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n: Node | null = root;
  while (n) {
    if (n.nodeType === Node.TEXT_NODE) {
      const tn = n as Text;
      const o = origText.get(tn);
      if (o !== undefined && shownText.get(tn) === tn.nodeValue) tn.nodeValue = o;
      origText.delete(tn);
      shownText.delete(tn);
    } else {
      const el = n as Element;
      const o = origAttr.get(el);
      if (o) {
        for (const [a, v] of o) if (shownAttr.get(el)?.get(a) === el.getAttribute(a)) el.setAttribute(a, v);
        origAttr.delete(el);
        shownAttr.delete(el);
      }
      if (el.getAttribute('data-i18n-dir') === 'rtl') {
        el.setAttribute('dir', 'rtl');
        el.removeAttribute('data-i18n-dir');
      }
    }
    n = walker.nextNode();
  }
}

function startObserver(): void {
  if (observer) return;
  observer = new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === 'characterData') translateTextNode(r.target as Text);
      else if (r.type === 'attributes') translateAttrs(r.target as Element);
      else r.addedNodes.forEach((n) => translateTree(n));
    }
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...ATTRS, 'dir'],
  });
}

// ─────────────────────────── ترجمة Canvas ───────────────────────────

let canvasPatched = false;
function patchCanvas(): void {
  if (canvasPatched || typeof CanvasRenderingContext2D === 'undefined') return;
  canvasPatched = true;
  const proto = CanvasRenderingContext2D.prototype;
  const fill = proto.fillText;
  const stroke = proto.strokeText;
  const measure = proto.measureText;
  proto.fillText = function (text: string, ...rest: [number, number, number?]) {
    return fill.call(this, t(String(text)), ...(rest as [number, number]));
  };
  proto.strokeText = function (text: string, ...rest: [number, number, number?]) {
    return stroke.call(this, t(String(text)), ...(rest as [number, number]));
  };
  proto.measureText = function (text: string) {
    return measure.call(this, t(String(text)));
  };
}

// ─────────────────────────── التبديل ───────────────────────────

function applyDocument(): void {
  const html = document.documentElement;
  html.lang = lang;
  html.dir = lang === 'en' ? 'ltr' : 'rtl';
}

/** يُستدعى مرة عند الإقلاع: يطبق اللغة المحفوظة. */
export async function initI18n(): Promise<void> {
  (window as unknown as { __i18nMissing: Set<string> }).__i18nMissing = missing;
  window.electronAPI?.setUiLang?.(lang);
  if (lang !== 'en') return;
  applyDocument();
  await loadDictionary();
  patchCanvas();
  translateTree(document.body);
  document.title = t(document.title);
  startObserver();
  window.dispatchEvent(new CustomEvent('cad:lang', { detail: lang }));
}

export async function setLang(next: UiLang): Promise<void> {
  if (next === lang) return;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* تخزين غير متاح */
  }
  if (next === 'en') {
    await loadDictionary();
    lang = 'en';
    applyDocument();
    patchCanvas();
    translateTree(document.body);
    startObserver();
  } else {
    lang = 'ar';
    observer?.disconnect();
    observer = null;
    restoreTree(document.body);
    applyDocument();
  }
  cache.clear();
  window.electronAPI?.setUiLang?.(lang);
  window.dispatchEvent(new CustomEvent('cad:lang', { detail: lang }));
}
