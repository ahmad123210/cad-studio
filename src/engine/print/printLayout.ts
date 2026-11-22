/**
 * @file printLayout.ts
 * @description حسابات الطباعة بمقياس حقيقي (دوال صرفة):
 * عند المقياس 1:S يقابل المترُ الواحد في الواقع (1000 / S) مم على الورق،
 * والمتر = ppm بكسل في إحداثيات العالم، فيكون: مم على الورق = بكسل عالم × (1000 / S) / ppm.
 */

/** المقاييس المعيارية المتاحة للطباعة */
export const STANDARD_SCALES = [1, 2, 5, 10, 20, 25, 50, 75, 100, 125, 150, 200, 250, 300, 500, 750, 1000, 1250, 1500, 2000, 2500, 5000];

/** مم على الورق لكل بكسل عالم */
export function mmPerWorldPx(scale: number, ppm: number): number {
  return 1000 / scale / (ppm > 0 ? ppm : 50);
}

/**
 * أكبر مقياس معياري (أكثر تفصيلاً) يتسع فيه المحتوى داخل المساحة المتاحة.
 * contentW/H بإحداثيات العالم، areaW/H بالمم.
 */
export function fitStandardScale(contentW: number, contentH: number, areaWmm: number, areaHmm: number, ppm: number): number {
  for (const s of STANDARD_SCALES) {
    const k = mmPerWorldPx(s, ppm);
    if (contentW * k <= areaWmm + 1e-6 && contentH * k <= areaHmm + 1e-6) return s;
  }
  return STANDARD_SCALES[STANDARD_SCALES.length - 1];
}

/** هل يتسع المحتوى بهذا المقياس؟ */
export function fitsAtScale(contentW: number, contentH: number, areaWmm: number, areaHmm: number, scale: number, ppm: number): boolean {
  const k = mmPerWorldPx(scale, ppm);
  return contentW * k <= areaWmm + 1e-6 && contentH * k <= areaHmm + 1e-6;
}

/**
 * مسطرة مقياس بأطوال «جميلة»: يختار طول القطعة بالمتر بحيث يكون طول المسطرة الكلي ≤ maxMm
 * ويعيد عدد القطع وطول القطعة بالمم.
 */
export function niceScaleBar(scale: number, maxMm: number, segments = 4): { segmentMeters: number; segmentMm: number; segments: number } {
  const mmPerMeter = 1000 / scale;
  const candidates = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
  let best = candidates[0];
  for (const c of candidates) {
    if (c * mmPerMeter * segments <= maxMm) best = c;
  }
  return { segmentMeters: best, segmentMm: best * mmPerMeter, segments };
}

export const formatScale = (s: number) => `1:${s}`;
