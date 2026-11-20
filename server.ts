/**
 * @file server.ts
 * @description خادم التطبيق المتكامل (Full-Stack Express + Vite)
 * يوفر مسارات API للمساعد الهندسي الذكي (/api/ai-assistant) باستخدام Gemini API،
 * ويدمج Vite middlewares أثناء التطوير، والملفات الثابتة في الإنتاج.
 */

import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '10mb' }));

// مسار فحص صحة الخادم (Health Checks)
app.get('/healthz', (_req: Request, res: Response): void => {
  res.status(200).send('OK');
});
app.get('/api/health', (_req: Request, res: Response): void => {
  res.status(200).json({ status: 'ok' });
});

/**
 * مسار المساعد الهندسي الذكي (Engineering AI Assistant)
 * يستقبل بيانات المخطط ونتائج الفحص الهندسي ويستشير Gemini 3.8 Flash
 */
app.post('/api/ai-assistant', async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectName, metrics, score, issues, userPrompt } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(200).json({
        advice: null,
        fallbackReason: 'NO_API_KEY',
      });
      return;
    }

    const ai = new GoogleGenAI({});

    const promptText = `
أنت مهندس استشاري محترف وخبير في تدقيق المخططات الهندسية والتنفيذية وفق كود البناء السعودي (SBC) والمعايير العالمية (NEC, NFPA, ASHRAE).
المشروع: "${projectName || 'مخطط هندسي'}"
التقييم الهندسي الحالي: ${score} من 100
المساحة المقدرة: ${metrics?.roomMetrics?.totalAreaSqM || 0} م²
المحيط: ${metrics?.roomMetrics?.totalPerimeterM || 0} م
عدد الجدران: ${metrics?.roomMetrics?.wallCount || 0}، الأبواب: ${metrics?.roomMetrics?.doorCount || 0}، النوافذ: ${metrics?.roomMetrics?.windowCount || 0}
التجهيزات: ${metrics?.electricalMetrics?.socketCount || 0} برايز، ${metrics?.electricalMetrics?.switchCount || 0} مفاتيح، ${metrics?.electricalMetrics?.lightCount || 0} إنارة
الحمل الكهربائي التقديري: ${metrics?.electricalMetrics?.estimatedWatts || 0} واط (${metrics?.electricalMetrics?.estimatedAmps || 0} أمبير)
الحمل التبريدي التقديري: ${metrics?.hvacMetrics?.coolingCapacityTons || 0} طن تبريد (${metrics?.hvacMetrics?.estimatedBTU || 0} BTU)
الملاحظات المرصودة:
${JSON.stringify(issues?.slice(0, 8) || [], null, 2)}

سؤال أو طلب المستخدم الهندسي:
"${userPrompt || 'قدم تدقيقاً هندسياً شاملاً وخطة عمل تنفيذية للمخطط'}"

قدم إجابة مهنية دقيقة ومفصلة باللغة العربية، منسقة بنقاط وعناوين واضحة وجداول موجزة إن لزم، مع الإشارة إلى أرقام الكود الهندسي والمواصفات المعيارية للأقطار ومقاطع الأسلاك وأجهزة الحماية.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: promptText,
      config: {
        systemInstruction:
          'أنت مستشار هندسي خبير ومساعد تصميم للمهندسين المعماريين ومهندسي الكهروميكانيك (MEP) بالميدان. أجب باللغة العربية باحترافية تامة.',
      },
    });

    const advice = response.text || 'لم يتم استلام نص من النموذج.';
    res.status(200).json({ advice });
  } catch (error: any) {
    console.error('Error in /api/ai-assistant:', error);
    res.status(200).json({
      advice: null,
      error: error?.message || 'Server error calling Gemini',
    });
  }
});

/**
 * دمج Vite في وضع التطوير أو تقديم ملفات dist في الإنتاج
 */
async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';
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
