import { describe, it, expect } from 'vitest';
import { mmPerWorldPx, fitStandardScale, fitsAtScale, niceScaleBar } from '../../src/engine/print/printLayout.ts';

describe('print scale math', () => {
  it('1:100 at 50 px/m → 1 m = 10 mm = 50 px', () => {
    expect(mmPerWorldPx(100, 50) * 50).toBeCloseTo(10);
    expect(mmPerWorldPx(50, 50) * 50).toBeCloseTo(20);
  });

  it('picks the most detailed standard scale that fits', () => {
    // مبنى 20م × 12م (50 بكسل/م) على مساحة 380×220 مم: 1:50 ← 400مم (لا يتسع)، 1:75 ← 266مم ✓
    expect(fitStandardScale(1000, 600, 380, 220, 50)).toBe(75);
    expect(fitsAtScale(1000, 600, 380, 220, 50, 50)).toBe(false);
    expect(fitsAtScale(1000, 600, 380, 220, 100, 50)).toBe(true);
    // تفصيلة صغيرة 1م × 1م على نفس المساحة ← 1:5
    expect(fitStandardScale(50, 50, 380, 220, 50)).toBe(5);
  });

  it('scale bar segments are nice numbers within the max length', () => {
    const b = niceScaleBar(100, 80); // 1م = 10مم ← 4 قطع × 2م = 80مم
    expect(b.segmentMeters).toBe(2);
    expect(b.segmentMm).toBeCloseTo(20);
    expect(niceScaleBar(20, 60).segmentMeters).toBe(0.25); // 1م = 50مم
  });
});
