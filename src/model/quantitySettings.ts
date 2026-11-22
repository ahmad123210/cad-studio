/**
 * @file quantitySettings.ts
 * @description القيم الافتراضية لإعدادات الكميات والتحقق منها عند فتح الملفات.
 */
import type { QuantitySettings } from './types.ts';

export const DEFAULT_QUANTITY_SETTINGS: QuantitySettings = {
  wallHeight: 3.0,
  fenceHeight: 2.0,
  doorHeight: 2.1,
  routeAllowancePct: 10,
  prices: {},
  showOpeningTags: false,
};

const pos = (v: unknown, d: number, max = 100) => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= max ? v : d);

export function sanitizeQuantitySettings(raw: unknown): QuantitySettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<QuantitySettings>;
  const prices: Record<string, number> = {};
  if (r.prices && typeof r.prices === 'object') {
    for (const [k, v] of Object.entries(r.prices)) {
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) prices[k] = v;
    }
  }
  const pct = r.routeAllowancePct;
  return {
    wallHeight: pos(r.wallHeight, DEFAULT_QUANTITY_SETTINGS.wallHeight),
    fenceHeight: pos(r.fenceHeight, DEFAULT_QUANTITY_SETTINGS.fenceHeight),
    doorHeight: pos(r.doorHeight, DEFAULT_QUANTITY_SETTINGS.doorHeight),
    routeAllowancePct: typeof pct === 'number' && Number.isFinite(pct) && pct >= 0 && pct <= 200 ? pct : DEFAULT_QUANTITY_SETTINGS.routeAllowancePct,
    prices,
    showOpeningTags: Boolean(r.showOpeningTags),
  };
}
