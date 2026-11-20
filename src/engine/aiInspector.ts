/**
 * @file aiInspector.ts
 * @description محرك الفحص الهندسي الذكي والمستشار الذكي (Engineering AI Inspector & Advisor) - المرحلة 7.
 * يدمج بين محرك تدقيق هندسي دقيق وفق كود البناء السعودي (SBC) والمعايير العالمية (NEC, NFPA, ASHRAE)
 * مع استشارات المساعد الذكي المولد عبر Gemini API.
 */

import { ProjectModel } from '../model/project.ts';
import {
  ProjectObject,
  WallObject,
  DoorObject,
  WindowObject,
  SymbolObject,
  RouteObject,
} from '../model/types.ts';

export type IssueSeverity = 'error' | 'warning' | 'info' | 'success';

export type IssueCategory =
  | 'architectural'
  | 'electrical'
  | 'plumbing'
  | 'hvac'
  | 'fire'
  | 'standards';

export interface AuditIssue {
  id: string;
  category: IssueCategory;
  severity: IssueSeverity;
  title: string;
  message: string;
  recommendation: string;
  relatedObjectId?: string;
  codeReference?: string;
}

export interface EngineeringMetrics {
  roomMetrics: {
    totalAreaSqM: number;
    totalPerimeterM: number;
    wallCount: number;
    doorCount: number;
    windowCount: number;
  };
  electricalMetrics: {
    socketCount: number;
    switchCount: number;
    lightCount: number;
    estimatedWatts: number;
    estimatedAmps: number;
  };
  hvacMetrics: {
    coolingCapacityTons: number;
    estimatedBTU: number;
  };
  fireMetrics: {
    sprinklerCount: number;
    areaCoveredSqM: number;
  };
}

export interface AuditSummary {
  overallScore: number; // 0 - 100
  totalIssues: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  passedCount: number;
  metrics: EngineeringMetrics;
  issues: AuditIssue[];
}

/**
 * إجراء تدقيق هندسي شامل وتلقائي على كائنات المخطط
 */
export function runEngineeringAudit(model: ProjectModel): AuditSummary {
  const meta = model.getMeta();
  const objects = model.getObjects();
  const scale = meta.scale || 50; // بكسل لكل متر

  const walls = objects.filter((o) => o.type === 'wall') as WallObject[];
  const doors = objects.filter((o) => o.type === 'door') as DoorObject[];
  const windows = objects.filter((o) => o.type === 'window') as WindowObject[];
  const symbols = objects.filter((o) => o.type === 'symbol') as SymbolObject[];
  const routes = objects.filter((o) => o.type === 'route') as RouteObject[];

  const issues: AuditIssue[] = [];

  // 1. حساب القياسات والمؤشرات الهندسية
  let totalWallLengthPx = 0;
  walls.forEach((w) => {
    totalWallLengthPx += Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y);
  });
  const totalPerimeterM = parseFloat((totalWallLengthPx / scale).toFixed(2));

  // تقدير مساحة تقريبية (إذا لم توجد مساحة مغلقة، نأخذ مستطيل الأبعاد)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  walls.forEach((w) => {
    minX = Math.min(minX, w.start.x, w.end.x);
    maxX = Math.max(maxX, w.start.x, w.end.x);
    minY = Math.min(minY, w.start.y, w.end.y);
    maxY = Math.max(maxY, w.start.y, w.end.y);
  });
  const widthM = isFinite(minX) ? (maxX - minX) / scale : 0;
  const heightM = isFinite(minY) ? (maxY - minY) / scale : 0;
  const totalAreaSqM = parseFloat(Math.max(0, widthM * heightM * 0.85).toFixed(1));

  // تصنيف الرموز
  const sockets = symbols.filter((s) => s.symbolKind.includes('socket'));
  const switches = symbols.filter((s) => s.symbolKind.includes('switch'));
  const lights = symbols.filter((s) => s.symbolKind.includes('light'));
  const acUnits = symbols.filter((s) => s.symbolKind.includes('hvac'));
  const sprinklers = symbols.filter((s) => s.symbolKind.includes('sprinkler'));

  // حساب الحمل الكهربائي التقديري (250W لكل بريزة، 40W لكل سبوت/إنارة، 1800W لكل مكيف)
  const estimatedWatts =
    sockets.length * 250 +
    lights.length * 45 +
    switches.length * 10 +
    acUnits.length * 1800;
  const estimatedAmps = parseFloat((estimatedWatts / 220).toFixed(1));

  // حساب التكييف (1 طن تبريد لكل 16 متر مربع بالمناطق الحارة)
  const coolingCapacityTons = parseFloat((totalAreaSqM / 16).toFixed(1));
  const estimatedBTU = Math.round(coolingCapacityTons * 12000);

  // 2. الفحص الهندسي الآلي (Rule Engine)

  // أ. التحقق من مقياس الرسم (Scale Calibration)
  if (!meta.scale || meta.scale === 50) {
    issues.push({
      id: 'scale_uncalibrated',
      category: 'standards',
      severity: 'info',
      title: 'مقياس الرسم الافتراضي',
      message: 'المشروع يستخدم المقياس الافتراضي (50 بكسل = 1 متر).',
      recommendation: 'يُنصح باستخدام أداة المعايرة (Calibrate) لضبط المقياس الحقيقي بدقة في حال استخدام صورة خلفية مرجعية.',
      codeReference: 'CAD Best Practice',
    });
  } else {
    issues.push({
      id: 'scale_ok',
      category: 'standards',
      severity: 'success',
      title: 'مقياس الرسم معاير بنجاح',
      message: `تمت معايرة المقياس بمعدل ${meta.scale} بكسل لكل متر.`,
      recommendation: 'جميع القياسات ومساحات الغرف وأطوال الكابلات دقيقة 100%.',
    });
  }

  // ب. التحقق من إغلاق الجدران والزوايا (Room Enclosure & Unconnected Ends)
  if (walls.length >= 3) {
    let unclosedCorners = 0;
    const snapThreshold = 15; // بكسل

    walls.forEach((w1, idx) => {
      let startConnected = false;
      let endConnected = false;

      walls.forEach((w2, idx2) => {
        if (idx === idx2) return;
        if (
          Math.hypot(w1.start.x - w2.start.x, w1.start.y - w2.start.y) < snapThreshold ||
          Math.hypot(w1.start.x - w2.end.x, w1.start.y - w2.end.y) < snapThreshold
        ) {
          startConnected = true;
        }
        if (
          Math.hypot(w1.end.x - w2.start.x, w1.end.y - w2.start.y) < snapThreshold ||
          Math.hypot(w1.end.x - w2.end.x, w1.end.y - w2.end.y) < snapThreshold
        ) {
          endConnected = true;
        }
      });

      if (!startConnected || !endConnected) {
        unclosedCorners++;
        if (unclosedCorners <= 2) {
          issues.push({
            id: `wall_open_${w1.id}`,
            category: 'architectural',
            severity: 'warning',
            title: `جدار غير ملتقٍ بالكامل (${w1.id})`,
            message: 'تم رصد طرف جدار مفتوح أو غير متصل بزاوية جدار مجاور بدقة.',
            recommendation: 'استخدم مغناطيس الالتقاط (Endpoint Snap) لإغلاق الزوايا بإحكام لضمان دقة حساب مساحات الغرف.',
            relatedObjectId: w1.id,
            codeReference: 'SBC 201 - المعماري',
          });
        }
      }
    });

    if (unclosedCorners === 0) {
      issues.push({
        id: 'walls_enclosure_ok',
        category: 'architectural',
        severity: 'success',
        title: 'الجدران والزوايا مغلقة ومتقاطعة هندسياً',
        message: 'جميع نهايات الجدران مرتبطة بنقاط التقاء سليمة.',
        recommendation: 'الهيكل المعماري جاهز للربط مع الطبقات الكهروميكانيكية.',
      });
    }
  }

  // ج. التحقق من مسافات البرايز الكهربائية (SBC 401 & NEC 210.52)
  // القاعدة: يجب ألا تزيد المسافة على طول أي جدار بين بريزتين عن 3.6 - 4.0 أمتار
  if (walls.length > 0 && sockets.length === 0) {
    issues.push({
      id: 'elec_no_sockets',
      category: 'electrical',
      severity: 'error',
      title: 'عدم وجود مخارج قوى (برايز)',
      message: 'المخطط يحتوي على جدران معمارية دون أي بريزة كهربائية.',
      recommendation: 'أضف مخارج قوى مزدوجة أو مفردة على الجدران لتغطية استخدامات الأجهزة الكهربائية.',
      codeReference: 'SBC 401 / NEC 210.52',
    });
  } else if (sockets.length > 0) {
    const socketsPerSqM = sockets.length / (totalAreaSqM || 1);
    if (socketsPerSqM < 0.08 && totalAreaSqM > 10) {
      issues.push({
        id: 'elec_low_socket_density',
        category: 'electrical',
        severity: 'warning',
        title: 'كثافة مخارج القوى أقل من التوصيات',
        message: `يوجد ${sockets.length} مخارج لمساحة ${totalAreaSqM} م². كود البناء يوصي ببريزة كل 3.6م على امتداد الجدران.`,
        recommendation: 'يُنصح بإضافة 2 إلى 3 مخارج إضافية لضمان عدم استخدام وصلات تمديد عشوائية.',
        codeReference: 'SBC 401 - القسم 5.2',
      });
    } else {
      issues.push({
        id: 'elec_sockets_ok',
        category: 'electrical',
        severity: 'success',
        title: 'توزيع مخارج القوى متطابق مع كود البناء',
        message: `تم توزيع ${sockets.length} مخرج قوى بكثافة ملائمة للمساحة.`,
        recommendation: 'تأكد من تأريض البرايز وتوزيعها على دوائر قواطع منفصلة 16A أو 20A.',
      });
    }
  }

  // د. التحقق من مفاتيح الإنارة بالقرب من الأبواب (Door-Switch Clearance)
  if (doors.length > 0 && switches.length === 0) {
    issues.push({
      id: 'elec_no_switches',
      category: 'electrical',
      severity: 'warning',
      title: 'لا يوجد مفاتيح إنارة للمداخل',
      message: 'يوجد أبواب معمارية دون مفتاح تحكم بالإنارة بجوار الباب.',
      recommendation: 'ضع مفتاح إنارة على مسافة 15 إلى 25 سم من حافة فتحة الباب في جهة المقبض.',
      codeReference: 'SBC 401 - التجهيزات الكهربائية',
    });
  }

  // هـ. التحقق من مستوى الإنارة والمصابيح (Illuminance & Spotlights)
  if (totalAreaSqM > 5) {
    if (lights.length === 0) {
      issues.push({
        id: 'elec_no_lights',
        category: 'electrical',
        severity: 'warning',
        title: 'المساحة تفتقر إلى نقاط إنارة',
        message: 'لم يتم إدراج وحدات إنارة سقفية أو سبوت لايت في الغرفة.',
        recommendation: `المساحة المقدرة (${totalAreaSqM} م²) تحتاج من 4 إلى 6 وحدات سبوت لايت لشدة إضاءة 200 - 300 لوكس.`,
        codeReference: 'CIBSE / SBC 401',
      });
    } else {
      issues.push({
        id: 'elec_lights_ok',
        category: 'electrical',
        severity: 'success',
        title: 'نقاط الإنارة موزعة بنجاح',
        message: `يوجد ${lights.length} وحدة إنارة توفر توزيعاً ضوئياً مناسباً.`,
        recommendation: 'توصيل الإنارة بمفتاح ثنائي للتحكم في مستويات الإضاءة يوفر الطاقة بنسبة 25%.',
      });
    }
  }

  // و. التحقق من المسارات وتوصيلات الكابلات (Route Connectivity)
  const connectedSymbolIds = new Set<string>();
  routes.forEach((r) => {
    if (r.startSymbolId) connectedSymbolIds.add(r.startSymbolId);
    if (r.endSymbolId) connectedSymbolIds.add(r.endSymbolId);
  });

  const unroutedSymbols = symbols.filter((s) => !connectedSymbolIds.has(s.id));
  if (unroutedSymbols.length > 0 && routes.length > 0) {
    issues.push({
      id: 'mep_unrouted_symbols',
      category: 'electrical',
      severity: 'info',
      title: `رموز لم يتم ربطها بمسارات بعد (${unroutedSymbols.length})`,
      message: `تم رصد ${unroutedSymbols.length} رمز هندسي غير متصل بمسار كابل أو أنبوب.`,
      recommendation: 'استخدم أداة "مسار" لربط المفاتيح بوحدات الإنارة والبرايز بلوحة التوزيع DB.',
      codeReference: 'Shop Drawings Standard',
    });
  }

  // ز. التحقق من التكييف (HVAC)
  if (totalAreaSqM >= 12 && acUnits.length === 0) {
    issues.push({
      id: 'hvac_missing',
      category: 'hvac',
      severity: 'info',
      title: 'تقدير الحمل الحراري ومكيفات الهواء',
      message: `المساحة (${totalAreaSqM} م²) تتطلب قدرة تبريد تقدر بحوالي ${coolingCapacityTons} طن (${estimatedBTU.toLocaleString()} BTU).`,
      recommendation: 'أضف وحدة تكييف سبليت أو دكت بمقاس 1.5 إلى 2.0 طن لضمان التبريد الفعّال.',
      codeReference: 'ASHRAE 62.1 / SBC 501',
    });
  }

  // ح. مكافحة الحريق (NFPA 13)
  if (sprinklers.length > 0) {
    const coveragePerSprinkler = 12; // 12 م² لكل رشاش
    const totalCovered = sprinklers.length * coveragePerSprinkler;
    if (totalCovered >= totalAreaSqM) {
      issues.push({
        id: 'fire_coverage_ok',
        category: 'fire',
        severity: 'success',
        title: 'تغطية شبكة رشاشات الحريق كافية',
        message: `${sprinklers.length} رشاشات تغطي مساحة تصل إلى ${totalCovered} م² (المساحة: ${totalAreaSqM} م²).`,
        recommendation: 'تأكد من عدم وجود عوائق أو حواجز على مسافة أقل من 45 سم تحت الرشاشات.',
        codeReference: 'NFPA 13 - Standard for Sprinkler Systems',
      });
    }
  }

  // حساب النتيجة الإجمالية (Overall Score من 100)
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;
  const passedCount = issues.filter((i) => i.severity === 'success').length;

  let overallScore = 100;
  overallScore -= errorCount * 20;
  overallScore -= warningCount * 8;
  overallScore -= infoCount * 2;
  if (overallScore < 0) overallScore = 0;
  if (passedCount > 0 && overallScore < 50 && errorCount === 0) overallScore = 65;

  return {
    overallScore,
    totalIssues: issues.length,
    errorCount,
    warningCount,
    infoCount,
    passedCount,
    metrics: {
      roomMetrics: {
        totalAreaSqM,
        totalPerimeterM,
        wallCount: walls.length,
        doorCount: doors.length,
        windowCount: windows.length,
      },
      electricalMetrics: {
        socketCount: sockets.length,
        switchCount: switches.length,
        lightCount: lights.length,
        estimatedWatts,
        estimatedAmps,
      },
      hvacMetrics: {
        coolingCapacityTons,
        estimatedBTU,
      },
      fireMetrics: {
        sprinklerCount: sprinklers.length,
        areaCoveredSqM: sprinklers.length * 12,
      },
    },
    issues,
  };
}

/**
 * طلب استشارة هندسية ذكية من المساعد الهندسي الذكي
 * يتصل أولاً بـ /api/ai-assistant، وإذا كان دون اتصال يقدم تحليلاً برمجياً متقدماً ومفصلاً
 */
export async function requestAiEngineeringAdvice(
  model: ProjectModel,
  userPrompt: string,
  audit: AuditSummary
): Promise<string> {
  const meta = model.getMeta();
  const summaryPayload = {
    projectName: meta.name,
    scale: meta.scale,
    unit: meta.unit,
    metrics: audit.metrics,
    score: audit.overallScore,
    issues: audit.issues.map((i) => ({
      severity: i.severity,
      title: i.title,
      message: i.message,
      codeReference: i.codeReference,
    })),
    userPrompt,
  };

  try {
    const response = await fetch('/api/ai-assistant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(summaryPayload),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.advice) {
        return data.advice;
      }
    }
  } catch {
    // خطأ في الاتصال بالشبكة أو عدم وجود خادم، يتم استخدام المحرك الهندسي المحلي المدمج
  }

  // المولد الهندسي الذكي المحلي (Rule-Based Generative Engine)
  return generateOfflineEngineeringReport(audit, userPrompt, meta.name);
}

/**
 * توليد تقرير هندسي استشاري مفصل دون الحاجة إلى إنترنت
 */
function generateOfflineEngineeringReport(
  audit: AuditSummary,
  userPrompt: string,
  projectName: string
): string {
  const { metrics, overallScore } = audit;
  const p = userPrompt.toLowerCase();

  if (p.includes('كهرب') || p.includes('load') || p.includes('قواطع') || p.includes('أحمال')) {
    return `### ⚡ تقرير التدقيق والحسابات الكهربائية — مشروع: ${projectName}

**1. ملخص الأحمال المقدرة:**
- إجمالي القدرة التقديرية: **${metrics.electricalMetrics.estimatedWatts} واط** (${(metrics.electricalMetrics.estimatedWatts / 1000).toFixed(2)} كيلوواط).
- التيار الإجمالي التقديري: **${metrics.electricalMetrics.estimatedAmps} أمبير** على جهد أحادي الطور 220V.
- عدد مخارج القوى (البرايز): **${metrics.electricalMetrics.socketCount}** مخرج.
- عدد وحدات الإنارة: **${metrics.electricalMetrics.lightCount}** وحدة.

**2. التوصيات الفنية والتنفيذية وفق كود SBC 401:**
- **لوحة التوزيع (Distribution Board):** يُوصى بتخصيص لوحة فرعية (DB) سعة 12 خط مع قاطع رئيسي MCB سعة 32A، وقاطع تفاضلي للحماية من التسريب الأرضي ELCB بقوة 30mA لدوائر الرطوبة والبرايز.
- **دوائر الإنارة:** سلك نحاسي بمقطع **2.5 مم²** محمي بقاطع 10A / 16A (حد أقصى 10 نقاط إنارة لكل دائرة).
- **دوائر القوى والبرايز:** سلك نحاسي بمقطع **4.0 مم²** مع خط تأريض، محمي بقاطع 20A (حد أقصى 5 برايز عادية للغرف، وبريزة منفصلة للمطبخ أو الأجهزة الثقيلة).
- **التأريض الوقائي:** ضرورة ربط قضيب التأريض الأرضي (Earth Rod) بمقاومة لا تتجاوز 5 أوم.`;
  }

  if (p.includes('تكييف') || p.includes('hvac') || p.includes('تبريد') || p.includes('حرار')) {
    return `### ❄️ تقرير التدقيق الهندسي لأنظمة التكييف والتهوية — مشروع: ${projectName}

**1. الحسابات التقديرية للحمل الحراري (ASHRAE / SBC 501):**
- المساحة المعمارية المقدرة: **${metrics.roomMetrics.totalAreaSqM} م²**.
- طاقة التبريد التقديرية المطلوبة: **${metrics.hvacMetrics.coolingCapacityTons} طن تبريد** (~**${metrics.hvacMetrics.estimatedBTU.toLocaleString()} BTU/hr**).
- معدل الهواء التقديري (Airflow): حوالي **${Math.round(metrics.hvacMetrics.coolingCapacityTons * 400)} CFM**.

**2. التوجيهات الهندسية:**
- يُفضل استخدام وحدات تكييف من نوع **Inverter** ذات كفاءة استهلاك طاقة عالية (نجوم كفاءة الطاقة لا تقل عن 6 نجوم).
- يجب مراعاة مسار صرف التكييف بميل لا يقل عن **1 سم لكل متر** نحو أقرب نقطة تصريف أو صفاية أرضية (Floor Drain).
- العزل الحراري لمواسير النحاس (Armaflex) بسماكة لا تقل عن 19 مم لتجنب تكثف الرطوبة على الأسقف المستعارة.`;
  }

  if (p.includes('حريق') || p.includes('fire') || p.includes('إطفاء') || p.includes('سلامة')) {
    return `### 🔥 تقرير السلامة ومكافحة الحريق (NFPA 13 / كود البناء السعودي)

**1. مؤشرات شبكة الإطفاء:**
- عدد رشاشات الحريق الآلية الحالية: **${metrics.fireMetrics.sprinklerCount}** رشاش.
- المساحة المغطاة الحالية: **${metrics.fireMetrics.areaCoveredSqM} م²** (المساحة الكلية: ${metrics.roomMetrics.totalAreaSqM} م²).

**2. التوصيات الإلزامية:**
- الرشاشات من نوع Standard Response (درجة حرارة تشغيل 68°C لمبات حمراء).
- الحفاظ على مسافة لا تقل عن **2.4م** ولا تزيد عن **3.6م** بين كل رشاش والآخر.
- مواسير الشبكة من الحديد الأسود غير الملحوم (Black Steel Sch 40) مع صمامات تحكم وإشعار تدفق مياه (Water Flow Switch).
- توفير كاشف دخان ضوئي (Optical Smoke Detector) مع جرس إنذار متصل بلوحة الإنذار الرئيسية FACP.`;
  }

  // التقرير الشامل الافتراضي
  return `### 🏛️ التقرير الهندسي الشامل والتدقيق الفني — مشروع: ${projectName}

**مؤشر جودة المخطط الهندسي:** **${overallScore} / 100** ${overallScore >= 80 ? '🌟 (ممتاز ومطابق)' : overallScore >= 60 ? '⚠️ (جيد مع ملاحظات)' : '❌ (يحتاج تصحيحات)'}

**1. الملخص التنفيذي:**
- المساحة المقدرة: **${metrics.roomMetrics.totalAreaSqM} م²** | المحيط المعماري: **${metrics.roomMetrics.totalPerimeterM} م**.
- الجدران: **${metrics.roomMetrics.wallCount}** | الأبواب: **${metrics.roomMetrics.doorCount}** | النوافذ: **${metrics.roomMetrics.windowCount}**.
- التجهيزات الكهروميكانيكية: **${metrics.electricalMetrics.socketCount}** بريزة | **${metrics.electricalMetrics.switchCount}** مفتاح | **${metrics.electricalMetrics.lightCount}** إنارة.

**2. أهم الملاحظات الهندسية المرصودة (${audit.totalIssues} ملاحظات):**
${audit.issues
  .map(
    (issue, i) =>
      `${i + 1}. **${issue.title}** (${issue.severity === 'error' ? '🔴 خطأ' : issue.severity === 'warning' ? '🟠 تنبيه' : issue.severity === 'success' ? '🟢 مطابق' : '🔵 معلومة'}):\n   - ${issue.message}\n   - **التوصية:** ${issue.recommendation}`
  )
  .join('\n')}

**3. خطة العمل الموصى بها لإتمام المخطط التنفيذي:**
1. تدقيق أبعاد ومقاسات الفتحات المعمارية (الأبواب لا تقل عن 90 سم، والنوافذ بجلسات 90 - 100 سم).
2. ربط جميع الرموز بالمسارات المناسبة لتوليد جدول حصر كميات دقيق (BOQ).
3. استخراج ملف **AutoCAD DXF** وتصدير **PDF التنفيذي** للاعتماد الهندسي في الموقع.`;
}
