/**
 * @file server/aiAssistant.ts
 * @description مسارات المساعد الهندسي الذكي على الخادم (المرحلة 19).
 * مفتاح Gemini يبقى في متغيرات بيئة الخادم فقط (GEMINI_API_KEY) ولا يصل للتطبيق أبداً.
 * التطبيق (المتصفح أو نسخة ويندوز) يرسل ملخص المخطط والسؤال، والخادم يستدعي النموذج ويعيد النص.
 *
 * متغيرات البيئة:
 *  - GEMINI_API_KEY   مفتاح Gemini (إلزامي لتفعيل المساعد عبر الخادم)
 *  - GEMINI_MODEL     اسم النموذج (افتراضياً gemini-3.8-flash)
 *  - AI_ACCESS_TOKEN  رمز وصول اختياري يُطلب من التطبيق (يُنصح به عند نشر الخادم للعموم)
 *  - AI_ALLOWED_ORIGINS  مصادر CORS المسموحة مفصولة بفواصل (افتراضياً * لتعمل نسخة سطح المكتب)
 *  - AI_RATE_LIMIT    أقصى عدد طلبات لكل عنوان IP خلال 10 دقائق (افتراضياً 30)
 */

import type { Express, Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'node:crypto';

export interface AiEnv {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  AI_ACCESS_TOKEN?: string;
  AI_ALLOWED_ORIGINS?: string;
  AI_RATE_LIMIT?: string;
}

/** الدالة التي تستدعي النموذج فعلياً (تُستبدل في الاختبارات) */
export type GenerateFn = (args: { apiKey: string; model: string; prompt: string; system: string }) => Promise<string>;

export const DEFAULT_MODEL = 'gemini-3.8-flash';
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PROMPT = 2000;
const MAX_ISSUES = 8;

const SYSTEM_AR =
  'أنت مستشار هندسي خبير ومساعد تصميم للمهندسين المعماريين ومهندسي الكهروميكانيك (MEP) بالميدان. أجب باللغة العربية باحترافية تامة.';
const SYSTEM_EN =
  'You are an expert engineering consultant and design assistant for architects and MEP engineers. Answer in English, professionally and precisely.';

const clip = (v: unknown, n: number) => String(v ?? '').slice(0, n);
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function tokensMatch(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** يبني نص الطلب من ملخص المخطط مع تقليم الحقول (لا تُرسل عناصر المخطط الخام) */
export function buildPrompt(body: Record<string, any>, lang: 'ar' | 'en'): string {
  const m = body?.metrics ?? {};
  const issues = (Array.isArray(body?.issues) ? body.issues : []).slice(0, MAX_ISSUES).map((i: any) => ({
    severity: clip(i?.severity, 16),
    title: clip(i?.title, 160),
    message: clip(i?.message, 400),
    codeReference: clip(i?.codeReference, 80),
  }));
  const q = clip(body?.userPrompt, MAX_PROMPT) || (lang === 'en' ? 'Provide a full engineering review and an action plan for the plan' : 'قدم تدقيقاً هندسياً شاملاً وخطة عمل تنفيذية للمخطط');
  const r = m.roomMetrics ?? {};
  const e = m.electricalMetrics ?? {};
  const h = m.hvacMetrics ?? {};
  if (lang === 'en') {
    return `You are a professional consulting engineer reviewing drawings per the Saudi Building Code (SBC) and international standards (NEC, NFPA, ASHRAE).
Project: "${clip(body?.projectName, 120) || 'Engineering plan'}"
Current engineering score: ${num(body?.score)} / 100
Estimated area: ${num(r.totalAreaSqM)} m², perimeter: ${num(r.totalPerimeterM)} m
Walls: ${num(r.wallCount)}, doors: ${num(r.doorCount)}, windows: ${num(r.windowCount)}
Devices: ${num(e.socketCount)} sockets, ${num(e.switchCount)} switches, ${num(e.lightCount)} lights
Estimated electrical load: ${num(e.estimatedWatts)} W (${num(e.estimatedAmps)} A)
Estimated cooling load: ${num(h.coolingCapacityTons)} TR (${num(h.estimatedBTU)} BTU)
Observed issues:
${JSON.stringify(issues, null, 2)}

User request:
"${q}"

Give a precise, well-structured answer in English with headings, bullets and short tables where useful, citing code clauses and standard sizes for pipes, cable sections and protective devices. Results are advisory.`;
  }
  return `أنت مهندس استشاري محترف وخبير في تدقيق المخططات الهندسية والتنفيذية وفق كود البناء السعودي (SBC) والمعايير العالمية (NEC, NFPA, ASHRAE).
المشروع: "${clip(body?.projectName, 120) || 'مخطط هندسي'}"
التقييم الهندسي الحالي: ${num(body?.score)} من 100
المساحة المقدرة: ${num(r.totalAreaSqM)} م²
المحيط: ${num(r.totalPerimeterM)} م
عدد الجدران: ${num(r.wallCount)}، الأبواب: ${num(r.doorCount)}، النوافذ: ${num(r.windowCount)}
التجهيزات: ${num(e.socketCount)} برايز، ${num(e.switchCount)} مفاتيح، ${num(e.lightCount)} إنارة
الحمل الكهربائي التقديري: ${num(e.estimatedWatts)} واط (${num(e.estimatedAmps)} أمبير)
الحمل التبريدي التقديري: ${num(h.coolingCapacityTons)} طن تبريد (${num(h.estimatedBTU)} BTU)
الملاحظات المرصودة:
${JSON.stringify(issues, null, 2)}

سؤال أو طلب المستخدم الهندسي:
"${q}"

قدم إجابة مهنية دقيقة ومفصلة باللغة العربية، منسقة بنقاط وعناوين واضحة وجداول موجزة إن لزم، مع الإشارة إلى أرقام الكود الهندسي والمواصفات المعيارية للأقطار ومقاطع الأسلاك وأجهزة الحماية. النتائج استرشادية.`;
}

/** محدد معدل بسيط في الذاكرة لكل عنوان IP */
export function createRateLimiter(limit: number, windowMs = WINDOW_MS, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  return (key: string): { ok: boolean; retryAfterSec: number } => {
    const t = now();
    const list = (hits.get(key) ?? []).filter((x) => t - x < windowMs);
    if (list.length >= limit) {
      hits.set(key, list);
      return { ok: false, retryAfterSec: Math.ceil((windowMs - (t - list[0])) / 1000) };
    }
    list.push(t);
    hits.set(key, list);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((x) => t - x < windowMs)) hits.delete(k);
    return { ok: true, retryAfterSec: 0 };
  };
}

export const geminiGenerate: GenerateFn = async ({ apiKey, model, prompt, system }) => {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({ model, contents: prompt, config: { systemInstruction: system } });
  return response.text || '';
};

export function registerAiRoutes(app: Express, env: AiEnv = process.env as AiEnv, generate: GenerateFn = geminiGenerate): void {
  const allowed = (env.AI_ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim()).filter(Boolean);
  const limit = Math.max(1, parseInt(env.AI_RATE_LIMIT || '30', 10) || 30);
  const rateLimit = createRateLimiter(limit);
  const model = env.GEMINI_MODEL || DEFAULT_MODEL;

  // CORS لمسارات المساعد فقط: نسخة ويندوز تعمل من file:// (المصدر "null") وتحتاجه
  const cors = (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (allowed.includes('*')) res.setHeader('Access-Control-Allow-Origin', '*');
    else if (origin && allowed.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CAD-Access-Token');
    res.setHeader('Access-Control-Max-Age', '600');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  };
  app.use(['/api/ai-assistant', '/api/ai-status'], cors);

  const authorized = (req: Request) => {
    if (!env.AI_ACCESS_TOKEN) return true;
    const given = String(req.headers['x-cad-access-token'] ?? '');
    return given.length > 0 && tokensMatch(given, env.AI_ACCESS_TOKEN);
  };

  // حالة المساعد دون كشف أي سر
  app.get('/api/ai-status', (req: Request, res: Response) => {
    res.status(200).json({
      available: Boolean(env.GEMINI_API_KEY),
      model,
      tokenRequired: Boolean(env.AI_ACCESS_TOKEN),
      authorized: authorized(req),
    });
  });

  app.post('/api/ai-assistant', async (req: Request, res: Response) => {
    if (!authorized(req)) {
      res.status(401).json({ advice: null, fallbackReason: 'BAD_TOKEN' });
      return;
    }
    const rl = rateLimit(req.ip || req.socket.remoteAddress || 'unknown');
    if (!rl.ok) {
      res.setHeader('Retry-After', String(rl.retryAfterSec));
      res.status(429).json({ advice: null, fallbackReason: 'RATE_LIMIT', retryAfterSec: rl.retryAfterSec });
      return;
    }
    if (!env.GEMINI_API_KEY) {
      res.status(200).json({ advice: null, fallbackReason: 'NO_API_KEY' });
      return;
    }
    const lang = req.body?.lang === 'en' ? 'en' : 'ar';
    try {
      const advice = await generate({
        apiKey: env.GEMINI_API_KEY,
        model,
        prompt: buildPrompt(req.body ?? {}, lang),
        system: lang === 'en' ? SYSTEM_EN : SYSTEM_AR,
      });
      res.status(200).json({ advice: advice || null, model, fallbackReason: advice ? undefined : 'EMPTY' });
    } catch (error: any) {
      console.error('Error in /api/ai-assistant:', error?.message || error);
      // لا نعيد تفاصيل الخطأ الداخلية (قد تحتوي معلومات عن المفتاح أو الحساب)
      res.status(200).json({ advice: null, fallbackReason: 'MODEL_ERROR' });
    }
  });
}
