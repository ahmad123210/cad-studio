/**
 * @file camera.ts
 * @description إدارة الكاميرا والتحويل بين إحداثيات العالم (World Coordinates) وإحداثيات الشاشة (Screen Coordinates).
 * World: بيانات العناصر الهندسية الحقيقية (الثابتة).
 * Screen: موضع الرسم الفعلي على لوحة الكانفس بعد التحريك (Pan) والتقريب (Zoom).
 */

import { Point } from '../model/types.ts';

export interface CameraState {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export class Camera {
  private zoom: number = 1.0;
  private offsetX: number = 0;
  private offsetY: number = 0;
  private minZoom: number = 0.1;
  private maxZoom: number = 10.0;

  constructor(initialZoom: number = 1.0, initialOffsetX: number = 0, initialOffsetY: number = 0) {
    this.zoom = initialZoom;
    this.offsetX = initialOffsetX;
    this.offsetY = initialOffsetY;
  }

  public getState(): CameraState {
    return {
      zoom: this.zoom,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
    };
  }

  public setState(state: CameraState): void {
    this.zoom = state.zoom;
    this.offsetX = state.offsetX;
    this.offsetY = state.offsetY;
  }

  public setPan(offsetX: number, offsetY: number): void {
    this.offsetX = offsetX;
    this.offsetY = offsetY;
  }

  public panBy(deltaX: number, deltaY: number): void {
    this.offsetX += deltaX;
    this.offsetY += deltaY;
  }

  public setZoom(zoom: number): void {
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
  }

  /**
   * ضبط الكاميرا لتطابق حدود محددة (Bounding Box) مع هامش أمان
   */
  public fitBounds(
    bounds: { minX: number; minY: number; maxX: number; maxY: number },
    viewportWidth: number,
    viewportHeight: number,
    padding: number = 50
  ): void {
    const boxW = Math.max(20, bounds.maxX - bounds.minX);
    const boxH = Math.max(20, bounds.maxY - bounds.minY);
    const availableW = Math.max(50, viewportWidth - padding * 2);
    const availableH = Math.max(50, viewportHeight - padding * 2);

    const zoomX = availableW / boxW;
    const zoomY = availableH / boxH;
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, Math.min(zoomX, zoomY)));

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    this.offsetX = viewportWidth / 2 - centerX * this.zoom;
    this.offsetY = viewportHeight / 2 - centerY * this.zoom;
  }

  /**
   * تقريب أو تبعيد حول نقطة ارتكاز محددة على الشاشة (مثلاً موقع مؤشر الفأرة)
   */
  public zoomAtScreenPoint(scaleFactor: number, screenPoint: Point): void {
    const oldZoom = this.zoom;
    const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, oldZoom * scaleFactor));
    if (newZoom === oldZoom) return;

    // حساب موضع نقطة الارتكاز في إحداثيات العالم
    const worldPoint = this.screenToWorld(screenPoint);

    this.zoom = newZoom;

    // تعديل الإزاحة لتظل نقطة المؤشر تشير إلى نفس موضع العالم
    this.offsetX = screenPoint.x - worldPoint.x * newZoom;
    this.offsetY = screenPoint.y - worldPoint.y * newZoom;
  }

  /**
   * تحويل من إحداثيات العالم إلى إحداثيات الشاشة
   * screenX = worldX * zoom + offsetX
   */
  public worldToScreen(worldPoint: Point): Point {
    return {
      x: worldPoint.x * this.zoom + this.offsetX,
      y: worldPoint.y * this.zoom + this.offsetY,
    };
  }

  /**
   * تحويل من إحداثيات الشاشة إلى إحداثيات العالم
   * worldX = (screenX - offsetX) / zoom
   */
  public screenToWorld(screenPoint: Point): Point {
    return {
      x: (screenPoint.x - this.offsetX) / this.zoom,
      y: (screenPoint.y - this.offsetY) / this.zoom,
    };
  }

  /**
   * إعادة ضبط الكاميرا إلى المركز الافتراضي
   */
  public reset(viewportWidth: number, viewportHeight: number): void {
    this.zoom = 1.0;
    this.offsetX = viewportWidth / 2;
    this.offsetY = viewportHeight / 2;
  }
}
