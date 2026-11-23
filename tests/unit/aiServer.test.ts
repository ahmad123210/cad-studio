import { describe, it, expect, afterEach } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { registerAiRoutes, buildPrompt, createRateLimiter, type GenerateFn } from '../../server/aiAssistant.ts';

let server: Server | null = null;
afterEach(() => {
  server?.close();
  server = null;
});

async function start(env: Record<string, string>, generate: GenerateFn) {
  const app = express();
  app.use(express.json());
  registerAiRoutes(app, env, generate);
  server = app.listen(0);
  await new Promise((r) => server!.once('listening', r));
  return `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
}

const body = { projectName: 'فيلا', score: 80, metrics: { roomMetrics: { totalAreaSqM: 120 } }, issues: [], userPrompt: 'ما القاطع المناسب؟' };
const post = (base: string, b: unknown, headers: Record<string, string> = {}) =>
  fetch(`${base}/api/ai-assistant`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'null', ...headers }, body: JSON.stringify(b) });

describe('AI assistant server routes (key stays on the server)', () => {
  it('calls the model with the server key and never returns the key; status hides secrets', async () => {
    let seen: Parameters<GenerateFn>[0] | null = null;
    const base = await start({ GEMINI_API_KEY: 'secret-key-123' }, async (a) => {
      seen = a;
      return 'نصيحة هندسية';
    });
    const res = await post(base, body);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    const text = await res.text();
    expect(JSON.parse(text).advice).toBe('نصيحة هندسية');
    expect(text).not.toContain('secret-key-123');
    expect(seen!.apiKey).toBe('secret-key-123');
    expect(seen!.prompt).toContain('ما القاطع المناسب؟');

    const st = await (await fetch(`${base}/api/ai-status`)).json();
    expect(st).toMatchObject({ available: true, tokenRequired: false, authorized: true });
    expect(JSON.stringify(st)).not.toContain('secret');

    const pre = await fetch(`${base}/api/ai-assistant`, { method: 'OPTIONS', headers: { Origin: 'null', 'Access-Control-Request-Method': 'POST' } });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('access-control-allow-headers')).toContain('X-CAD-Access-Token');
  });

  it('reports NO_API_KEY without a key, and hides model errors', async () => {
    const base = await start({}, async () => 'x');
    expect(await (await post(base, body)).json()).toMatchObject({ advice: null, fallbackReason: 'NO_API_KEY' });
    server!.close();
    const base2 = await start({ GEMINI_API_KEY: 'k' }, async () => {
      throw new Error('quota exceeded for project 123 key k');
    });
    const r = await (await post(base2, body)).json();
    expect(r).toEqual({ advice: null, fallbackReason: 'MODEL_ERROR' });
  });

  it('enforces the optional access token and the per-IP rate limit', async () => {
    const base = await start({ GEMINI_API_KEY: 'k', AI_ACCESS_TOKEN: 'team-token', AI_RATE_LIMIT: '2' }, async () => 'ok');
    expect((await post(base, body)).status).toBe(401);
    expect((await post(base, body, { 'X-CAD-Access-Token': 'wrong' })).status).toBe(401);
    const st = await (await fetch(`${base}/api/ai-status`, { headers: { 'X-CAD-Access-Token': 'team-token' } })).json();
    expect(st).toMatchObject({ tokenRequired: true, authorized: true });
    expect((await post(base, body, { 'X-CAD-Access-Token': 'team-token' })).status).toBe(200);
    expect((await post(base, body, { 'X-CAD-Access-Token': 'team-token' })).status).toBe(200);
    const limited = await post(base, body, { 'X-CAD-Access-Token': 'team-token' });
    expect(limited.status).toBe(429);
    expect((await limited.json()).fallbackReason).toBe('RATE_LIMIT');
  });

  it('builds a bounded prompt in the requested language', () => {
    const long = 'س'.repeat(5000);
    const issues = Array.from({ length: 20 }, (_, i) => ({ severity: 'error', title: `t${i}`, message: 'm' }));
    const ar = buildPrompt({ ...body, userPrompt: long, issues }, 'ar');
    expect(ar).toContain('كود البناء السعودي');
    expect(ar.length).toBeLessThan(6000);
    expect(ar).not.toContain('t8');
    const en = buildPrompt({ ...body, lang: 'en' }, 'en');
    expect(en).toContain('Saudi Building Code');
  });

  it('rate limiter frees slots after the window', () => {
    let t = 0;
    const rl = createRateLimiter(1, 1000, () => t);
    expect(rl('a').ok).toBe(true);
    expect(rl('a').ok).toBe(false);
    expect(rl('b').ok).toBe(true);
    t = 1001;
    expect(rl('a').ok).toBe(true);
  });
});
