/**
 * @file server.ts
 * @description خادم التطبيق المتكامل (Full-Stack Express + Vite)
 * يوفر مسارات API للمساعد الهندسي الذكي (/api/ai-assistant، /api/ai-status) باستخدام Gemini API،
 * ويدمج Vite middlewares أثناء التطوير، والملفات الثابتة في الإنتاج.
 */

import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import { registerAiRoutes } from './server/aiAssistant.ts';

// .env.local أولاً (كما في README) ثم .env — الملفان خارج Git
dotenv.config({ path: ['.env.local', '.env'], quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// خلف وكيل (Cloud Run وغيره): لمعرفة عنوان IP الحقيقي في حدّ معدل الطلبات
app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));

// مسار فحص صحة الخادم (Health Checks)
app.get('/healthz', (_req: Request, res: Response): void => {
  res.status(200).send('OK');
});
app.get('/api/health', (_req: Request, res: Response): void => {
  res.status(200).json({ status: 'ok' });
});

/**
 * مسارات المساعد الهندسي الذكي (Engineering AI Assistant): /api/ai-assistant و/api/ai-status
 * المنطق في server/aiAssistant.ts — مفتاح Gemini يبقى هنا على الخادم ولا يصل للتطبيق.
 */
registerAiRoutes(app);

/**
 * دمج Vite في وضع التطوير أو تقديم ملفات dist في الإنتاج
 */
async function startServer() {
  // --production يعمل على كل الأنظمة (Windows/Linux) دون الحاجة لضبط NODE_ENV يدوياً
  const isProduction = process.env.NODE_ENV === 'production' || process.argv.includes('--production');
  const distDir = path.resolve(__dirname, 'dist');
  const indexHtml = path.resolve(distDir, 'index.html');

  if (isProduction && fs.existsSync(indexHtml)) {
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(indexHtml);
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CAD Application server is running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
