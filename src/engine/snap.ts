/**
 * @file snap.ts
 * @description محرك الالتقاط الهندسي (Snap System).
 * يوفر الالتقاط بنقاط الشبكة (Grid)، ونهايات الجدران (Endpoints)، ومنتصف الجدران (Midpoints).
 */

import { Point, ProjectObject, WallObject, SymbolObject, RouteObject } from '../model/types.ts';

export type SnapType = 'endpoint' | 'midpoint' | 'edge' | 'grid' | 'ortho' | 'symbol' | 'route' | 'none';

export interface SnapResult {
  point: Point;
  snapped: boolean;
  type: SnapType;
  targetId?: string;
  label?: string;
}

export interface SnapOptions {
  enableGridSnap: boolean;
  enableObjectSnap: boolean;
  gridSize: number; // بوحدة العالم (افتراضياً 20 بكسل)
  snapRadius: number; // نصف قطر الالتقاط بوحدة العالم (مثلاً 15 بكسل)
}

export interface WallSnapResult {
  wall: WallObject;
  position: number; // من 0 إلى 1
  projectedPoint: Point;
  distance: number;
}

export interface SymbolWallSnapResult {
  wall: WallObject;
  position: number; // من 0 إلى 1
  snappedPoint: Point; // النقطة على وجه الجدار
  angle: number; // زاوية دوران الرمز بمحاذاة الجدار (بالدرجات)
  wallSide: 1 | -1; // جهة الجدار بالنسبة للمؤشر
  distance: number;
}

export interface SymbolSnapResult {
  symbol: SymbolObject;
  point: Point;
  distance: number;
}

export class SnapEngine {
  /**
   * حساب المسافة الإقليدية بين نقطتين
   */
  public static distance(p1: Point, p2: Point): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * حساب أقصر مسافة عمودية بين نقطة وقطعة مستقيمة (Start -> End)
   */
  public static pointToSegmentDistance(p: Point, v: Point, w: Point): number {
    const l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y);
    if (l2 === 0) return this.distance(p, v);
    const t = Math.max(0, Math.min(1, ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2));
    const proj = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
    return this.distance(p, proj);
  }

  /**
   * إسقاط نقطة على قطعة مستقيمة للحصول على أقرب نقطة ونسبة التموضع t والمسافة
   */
  public static projectPointOnSegment(p: Point, v: Point, w: Point): { point: Point; t: number; distance: number } {
    const l2 = (v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y);
    if (l2 === 0) {
      return { point: { ...v }, t: 0, distance: this.distance(p, v) };
    }
    const t = Math.max(0, Math.min(1, ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2));
    const proj = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
    return { point: proj, t, distance: this.distance(p, proj) };
  }

  /**
   * إيجاد أقرب جدار وإسقاط النقطة عليه لربط الأبواب والنوافذ
   */
  public static findWallProjection(
    cursorPos: Point,
    allObjects: ProjectObject[],
    maxDistance: number = 40,
    elementWidth: number = 0
  ): WallSnapResult | null {
    let bestResult: WallSnapResult | null = null;
    let minDistance = maxDistance;

    for (const obj of allObjects) {
      if (obj.type !== 'wall') continue;
      const wall = obj as WallObject;

      const dx = wall.end.x - wall.start.x;
      const dy = wall.end.y - wall.start.y;
      const wallLenSq = dx * dx + dy * dy;
      if (wallLenSq === 0) continue;

      const wallLen = Math.sqrt(wallLenSq);

      // حساب معامل الإسقاط t على القطعة المستقيمة
      const apx = cursorPos.x - wall.start.x;
      const apy = cursorPos.y - wall.start.y;
      const t = (apx * dx + apy * dy) / wallLenSq;

      // ضبط t لضمان عدم خروج الباب أو النافذة عن طرف الجدار
      const margin = elementWidth > 0 && wallLen > elementWidth ? (elementWidth / 2) / wallLen : 0.05;
      const clampedT = Math.max(margin, Math.min(1 - margin, t));

      const projX = wall.start.x + clampedT * dx;
      const projY = wall.start.y + clampedT * dy;
      const dist = this.distance(cursorPos, { x: projX, y: projY });

      // نقبل الالتقاط إذا كان ضمن المسافة القصوى، مع أخذ سماكة الجدار في الحسبان
      const effectiveMaxDist = Math.max(maxDistance, wall.thickness + 15);
      if (dist <= effectiveMaxDist && dist < minDistance) {
        minDistance = dist;
        bestResult = {
          wall,
          position: clampedT,
          projectedPoint: { x: projX, y: projY },
          distance: dist,
        };
      }
    }

    return bestResult;
  }

  /**
   * إيجاد أقرب جدار للالتصاق بالرمز (Wall Snap للرموز الهندسية - المرحلة 4)
   * يحسب جهة الجدار والزاوية والنقطة الدقيقة على سطح الجدار
   */
  public static findSymbolWallSnap(
    cursorPos: Point,
    allObjects: ProjectObject[],
    maxDistance: number = 35,
    offsetToFace: boolean = true
  ): SymbolWallSnapResult | null {
    let bestResult: SymbolWallSnapResult | null = null;
    let minDistance = maxDistance;

    for (const obj of allObjects) {
      if (obj.type !== 'wall') continue;
      const wall = obj as WallObject;

      const dx = wall.end.x - wall.start.x;
      const dy = wall.end.y - wall.start.y;
      const wallLenSq = dx * dx + dy * dy;
      if (wallLenSq === 0) continue;

      const wallLen = Math.sqrt(wallLenSq);
      const ux = dx / wallLen;
      const uy = dy / wallLen;

      // المتجه العمودي على الجدار (Normal)
      const nx = -uy;
      const ny = ux;

      const apx = cursorPos.x - wall.start.x;
      const apy = cursorPos.y - wall.start.y;
      const t = (apx * dx + apy * dy) / wallLenSq;

      // حصر t ضمن طول الجدار
      const clampedT = Math.max(0.02, Math.min(0.98, t));

      const projX = wall.start.x + clampedT * dx;
      const projY = wall.start.y + clampedT * dy;
      const dist = this.distance(cursorPos, { x: projX, y: projY });

      const effectiveMaxDist = Math.max(maxDistance, wall.thickness + 20);
      if (dist <= effectiveMaxDist && dist < minDistance) {
        minDistance = dist;

        // تحديد أي جهة من الجدار يقترب منها المؤشر (Side test)
        const dotNormal = (cursorPos.x - projX) * nx + (cursorPos.y - projY) * ny;
        const wallSide: 1 | -1 = dotNormal >= 0 ? 1 : -1;

        // زاوية الجدار الأساسية
        const baseWallAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
        // توجيه الرمز الهندسي بحيث يستقر ملتصقاً بسطح الجدار الخارجي ويكون وجهه موجهاً تماماً نحو داخل الغرفة/الفراغ
        let symbolAngle = wallSide === 1 ? baseWallAngle + 180 : baseWallAngle;
        symbolAngle = ((symbolAngle % 360) + 360) % 360;

        // إزاحة إلى حافة/طرف الجدار بحيث يستقر الرمز ملتصقاً بسطح الجدار الخارجي دون تداخل ودون أن يظهر مقلوباً
        const offsetDist = offsetToFace ? wall.thickness / 2 : 0;
        const faceX = projX + wallSide * nx * offsetDist;
        const faceY = projY + wallSide * ny * offsetDist;

        bestResult = {
          wall,
          position: clampedT,
          snappedPoint: { x: faceX, y: faceY },
          angle: symbolAngle,
          wallSide,
          distance: dist,
        };
      }
    }

    return bestResult;
  }

  /**
   * إيجاد أقرب رمز هندسي للالتصاق به (Symbol Snap للمسارات - المرحلة 5)
   */
  public static findSymbolSnap(
    cursorPos: Point,
    allObjects: ProjectObject[],
    maxDistance: number = 30
  ): SymbolSnapResult | null {
    let closest: SymbolSnapResult | null = null;
    let minDistance = maxDistance;

    for (const obj of allObjects) {
      if (obj.type !== 'symbol') continue;
      const sym = obj as SymbolObject;
      const dist = this.distance(cursorPos, { x: sym.x, y: sym.y });
      if (dist <= minDistance) {
        minDistance = dist;
        closest = {
          symbol: sym,
          point: { x: sym.x, y: sym.y },
          distance: dist,
        };
      }
    }

    return closest;
  }

  /**
   * حساب النقطة المتعامدة هندسياً (Ortho Angle Lock)
   * تقفل الزاوية على المحور الأفقي أو الرأسي (0°, 90°, 180°, 270°)
   */
  public static getOrthoPoint(startPoint: Point, currentPoint: Point): Point {
    const dx = Math.abs(currentPoint.x - startPoint.x);
    const dy = Math.abs(currentPoint.y - startPoint.y);

    if (dx >= dy) {
      // قفل أفقي (Horizontal)
      return { x: currentPoint.x, y: startPoint.y };
    } else {
      // قفل رأسي (Vertical)
      return { x: startPoint.x, y: currentPoint.y };
    }
  }

  /**
   * البحث عن أقرب نقطة التقاط
   * الأولوية:
   * 1. مراكز الرموز الهندسية (Symbols)
   * 2. نهايات الجدران (Endpoints)
   * 3. نقاط المسارات (Route Vertices)
   * 4. منتصف الجدران (Midpoints)
   * 5. خطوط الشبكة (Grid)
   */
  public static findSnapPoint(
    cursorPos: Point,
    allObjects: ProjectObject[],
    options: SnapOptions,
    ignoreObjectId?: string
  ): SnapResult {
    const { enableGridSnap, enableObjectSnap, gridSize, snapRadius } = options;

    if (enableObjectSnap) {
      // 1. فحص الرموز الهندسية أولاً (Symbol Snap)
      const symbolSnap = this.findSymbolSnap(cursorPos, allObjects, snapRadius + 5);
      if (symbolSnap && symbolSnap.symbol.id !== ignoreObjectId) {
        return {
          point: symbolSnap.point,
          snapped: true,
          type: 'symbol',
          targetId: symbolSnap.symbol.id,
          label: `رمز: ${symbolSnap.symbol.label || symbolSnap.symbol.symbolKind}`,
        };
      }

      let closestEndpoint: { point: Point; dist: number; wallId: string } | null = null;
      let closestMidpoint: { point: Point; dist: number; wallId: string } | null = null;
      let closestRoutePoint: { point: Point; dist: number; routeId: string } | null = null;
      let closestWallEdge: { point: Point; dist: number; wallId: string } | null = null;

      // فحص نهايات ومنتصفات الجدران ورؤوس المسارات وأجسام الجدران
      for (const obj of allObjects) {
        if (obj.id === ignoreObjectId) continue;

        if (obj.type === 'wall') {
          const wall = obj as WallObject;

          // 1. فحص نقطة البداية (Start)
          const distStart = this.distance(cursorPos, wall.start);
          if (distStart <= snapRadius) {
            if (!closestEndpoint || distStart < closestEndpoint.dist) {
              closestEndpoint = { point: { ...wall.start }, dist: distStart, wallId: wall.id };
            }
          }

          // 2. فحص نقطة النهاية (End)
          const distEnd = this.distance(cursorPos, wall.end);
          if (distEnd <= snapRadius) {
            if (!closestEndpoint || distEnd < closestEndpoint.dist) {
              closestEndpoint = { point: { ...wall.end }, dist: distEnd, wallId: wall.id };
            }
          }

          // 3. فحص منتصف الجدار (Midpoint)
          const midPoint: Point = {
            x: (wall.start.x + wall.end.x) / 2,
            y: (wall.start.y + wall.end.y) / 2,
          };
          const distMid = this.distance(cursorPos, midPoint);
          if (distMid <= snapRadius) {
            if (!closestMidpoint || distMid < closestMidpoint.dist) {
              closestMidpoint = { point: midPoint, dist: distMid, wallId: wall.id };
            }
          }

          // 4. فحص الالتصاق بأي نقطة على مسار الجدار (Nearest point on wall segment)
          const proj = this.projectPointOnSegment(cursorPos, wall.start, wall.end);
          const effectiveEdgeDist = Math.max(snapRadius + 8, wall.thickness / 2 + 16);
          if (proj.distance <= effectiveEdgeDist && proj.t >= 0 && proj.t <= 1) {
            if (!closestWallEdge || proj.distance < closestWallEdge.dist) {
              closestWallEdge = { point: proj.point, dist: proj.distance, wallId: wall.id };
            }
          }
        } else if (obj.type === 'route') {
          // فحص رؤوس المسارات القائمة (Route Vertices)
          const route = obj as RouteObject;
          for (let i = 0; i < route.points.length; i++) {
            const pt = route.points[i];
            const distPt = this.distance(cursorPos, pt);
            if (distPt <= snapRadius) {
              if (!closestRoutePoint || distPt < closestRoutePoint.dist) {
                closestRoutePoint = { point: { ...pt }, dist: distPt, routeId: route.id };
              }
            }
          }
        }
      }

      // إذا وُجدت نقطة نهاية، لها الأولوية القصوى
      if (closestEndpoint) {
        return {
          point: closestEndpoint.point,
          snapped: true,
          type: 'endpoint',
          targetId: closestEndpoint.wallId,
          label: 'نهاية جدار',
        };
      }

      // إذا وُجد رأس مسار
      if (closestRoutePoint) {
        return {
          point: closestRoutePoint.point,
          snapped: true,
          type: 'route',
          targetId: closestRoutePoint.routeId,
          label: 'نقطة مسار',
        };
      }

      // إذا وُجد منتصف جدار
      if (closestMidpoint) {
        return {
          point: closestMidpoint.point,
          snapped: true,
          type: 'midpoint',
          targetId: closestMidpoint.wallId,
          label: 'منتصف جدار',
        };
      }

      // إذا وُجدت نقطة على مسار الجدار (تفرع T أو التقاء جدار بآخر)
      if (closestWallEdge) {
        return {
          point: closestWallEdge.point,
          snapped: true,
          type: 'edge',
          targetId: closestWallEdge.wallId,
          label: 'على مسار الجدار',
        };
      }
    }

    // إذا لم يتطابق مع عنصر، والتقاط الشبكة مفعّل
    if (enableGridSnap && gridSize > 0) {
      const snappedX = Math.round(cursorPos.x / gridSize) * gridSize;
      const snappedY = Math.round(cursorPos.y / gridSize) * gridSize;
      const gridDist = this.distance(cursorPos, { x: snappedX, y: snappedY });

      // إذا كان قريباً بدرجة كافية من تقاطع الشبكة بدقة تامة دون قفزات عشوائية
      if (gridDist <= snapRadius) {
        return {
          point: { x: snappedX, y: snappedY },
          snapped: true,
          type: 'grid',
          label: 'شبكة',
        };
      }
    }

    // لم يتم الالتقاط، إرجاع النقطة كما هي
    return {
      point: { ...cursorPos },
      snapped: false,
      type: 'none',
    };
  }

  /**
   * تقييد الزوايا الهندسية (Orthogonal Snap)
   * يقيّد الحركة إلى زوايا 0°, 45°, 90°, 135°, 180°, إلخ
   */
  public static constrainAngle(origin: Point, current: Point, angleStepDegrees: number = 45): Point {
    const dx = current.x - origin.x;
    const dy = current.y - origin.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance === 0) return { ...current };

    const angle = Math.atan2(dy, dx); // بالراديان
    const stepRad = (angleStepDegrees * Math.PI) / 180;
    const snappedAngle = Math.round(angle / stepRad) * stepRad;

    return {
      x: origin.x + distance * Math.cos(snappedAngle),
      y: origin.y + distance * Math.sin(snappedAngle),
    };
  }

  /**
   * الالتقاط الزاوي القطبي (Polar Angle Snapping & Tracking)
   * يفحص هل زاوية الخط قريبة من الزوايا الهندسية الشائعة (0°, 45°, 90°, 135°, 180°, إلخ)
   * ويرجع النقطة الملتقطة بدقة مع الزاوية الإرشادية
   */
  public static getPolarAngleSnap(
    origin: Point,
    current: Point,
    snapAngles: number[] = [0, 45, 90, 135, 180, 225, 270, 315, 360],
    toleranceDegrees: number = 4.0
  ): {
    point: Point;
    rawAngleDegrees: number;
    angleDegrees: number;
    isSnapped: boolean;
    snappedTargetAngle: number | null;
  } {
    const dx = current.x - origin.x;
    const dy = current.y - origin.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 0.001) {
      return {
        point: { ...current },
        rawAngleDegrees: 0,
        angleDegrees: 0,
        isSnapped: false,
        snappedTargetAngle: null,
      };
    }

    let rawAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (rawAngle < 0) rawAngle += 360;

    let bestTargetAngle: number | null = null;
    let minDiff = toleranceDegrees;

    for (const targetAngle of snapAngles) {
      const diff = Math.abs(((rawAngle - targetAngle + 180) % 360) - 180);
      if (diff <= minDiff) {
        minDiff = diff;
        bestTargetAngle = targetAngle % 360;
      }
    }

    if (bestTargetAngle !== null) {
      const rad = (bestTargetAngle * Math.PI) / 180;
      return {
        point: {
          x: origin.x + distance * Math.cos(rad),
          y: origin.y + distance * Math.sin(rad),
        },
        rawAngleDegrees: rawAngle,
        angleDegrees: bestTargetAngle,
        isSnapped: true,
        snappedTargetAngle: bestTargetAngle,
      };
    }

    return {
      point: { ...current },
      rawAngleDegrees: rawAngle,
      angleDegrees: Math.round(rawAngle * 10) / 10,
      isSnapped: false,
      snappedTargetAngle: null,
    };
  }
}
