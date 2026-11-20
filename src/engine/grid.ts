/**
 * @file grid.ts
 * @description حسابات الشبكة الهندسية، التحويلات الرياضية، وتنسيق القياسات والمساحات الحقيقية (المرحلة 3).
 */

import { Point, UnitType } from '../model/types.ts';
import { Camera } from './camera.ts';
import { SnapEngine } from './snap.ts';

export class GridUtils {
  /**
   * تنسيق الطول من بكسل إلى وحدة العالم الحقيقية (متر، سم، مم)
   * scale: عدد البكسلات لكل متر (pixelsPerMeter)
   */
  public static formatLength(
    pixelDistance: number,
    pixelsPerMeter: number = 50,
    unit: UnitType = 'meter'
  ): string {
    const safeScale = pixelsPerMeter > 0 ? pixelsPerMeter : 50;
    const meters = pixelDistance / safeScale;

    switch (unit) {
      case 'meter':
        return `${meters.toFixed(2)} م`;
      case 'cm':
        return `${(meters * 100).toFixed(1)} سم`;
      case 'mm':
        return `${Math.round(meters * 1000)} مم`;
      default:
        return `${meters.toFixed(2)} م`;
    }
  }

  /**
   * حساب مساحة مضلع مغلق باستخدام صيغة رباط الحذاء (Shoelace Formula / Gauss's Area Formula)
   */
  public static calculatePolygonArea(points: Point[]): number {
    const n = points.length;
    if (n < 3) return 0;

    let area = 0;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }

    return Math.abs(area) / 2;
  }

  /**
   * حساب محيط مضلع مغلق (Perimeter)
   */
  public static calculatePolygonPerimeter(points: Point[]): number {
    const n = points.length;
    if (n < 2) return 0;

    let perimeter = 0;
    for (let i = 0; i < n; i++) {
      const next = points[(i + 1) % n];
      perimeter += SnapEngine.distance(points[i], next);
    }

    return perimeter;
  }

  /**
   * تنسيق المساحة الحقيقية بالمتر المربع (م²) أو السنتمتر المربع
   */
  public static formatArea(
    pixelArea: number,
    pixelsPerMeter: number = 50,
    unit: UnitType = 'meter'
  ): string {
    const safeScale = pixelsPerMeter > 0 ? pixelsPerMeter : 50;
    const squareMeters = pixelArea / (safeScale * safeScale);

    switch (unit) {
      case 'meter':
        return `${squareMeters.toFixed(2)} م²`;
      case 'cm':
        return `${(squareMeters * 10000).toFixed(1)} سم²`;
      case 'mm':
        return `${Math.round(squareMeters * 1000000)} مم²`;
      default:
        return `${squareMeters.toFixed(2)} م²`;
    }
  }

  /**
   * حساب مقياس الرسم (pixelsPerMeter) بناءً على مسافة بالبكسل وطول حقيقي مقاس بالمتر
   */
  public static calculateScaleFromMeasurement(
    pixelDistance: number,
    realLengthInMeters: number
  ): number {
    if (realLengthInMeters <= 0 || pixelDistance <= 0) return 50;
    return pixelDistance / realLengthInMeters;
  }

  /**
   * حساب نطاق خطوط الشبكة المرئية على الشاشة بالاعتماد على الكاميرا
   */
  public static getVisibleGridBounds(
    camera: Camera,
    viewportWidth: number,
    viewportHeight: number,
    gridSize: number
  ) {
    const topLeft = camera.screenToWorld({ x: 0, y: 0 });
    const bottomRight = camera.screenToWorld({ x: viewportWidth, y: viewportHeight });

    const startX = Math.floor(topLeft.x / gridSize) * gridSize;
    const endX = Math.ceil(bottomRight.x / gridSize) * gridSize;
    const startY = Math.floor(topLeft.y / gridSize) * gridSize;
    const endY = Math.ceil(bottomRight.y / gridSize) * gridSize;

    return { startX, endX, startY, endY };
  }
}
