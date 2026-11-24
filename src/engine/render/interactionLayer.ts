/**
 * @file interactionLayer.ts
 * @description طبقة التفاعل اللحظي: معاينات الأدوات، خطوط الزوايا، الشارات ومؤشر الالتقاط
 * (مُستخرج من renderer.ts دون تغيير في السلوك؛ الدوال تُستدعى بسياق المحرك this)
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
import Konva from 'konva';
import {
  Point,
  ProjectObject,
  WallObject,
  DoorObject,
  WindowObject,
  DimensionObject,
  SymbolObject,
  RouteObject,
  RouteKind,
  TextObject,
  DoorOpenDirection,
  BackgroundImageData,
} from '../../model/types.ts';
import { ProjectModel } from '../../model/project.ts';
import { Camera, CameraState } from '../camera.ts';
import {
  SnapEngine,
  SnapResult,
  SnapOptions,
  WallSnapResult,
  SymbolWallSnapResult,
} from '../snap.ts';
import { GridUtils } from '../grid.ts';
import { getSymbolById } from '../../symbols/registry.ts';
import {
  ROUTE_KINDS_META,
  calculateRoutePixelLength,
  calculateSegmentLengths,
} from '../../symbols/routes.ts';
import {
  getLastUsedSettings,
  updateLastUsedSettings,
  GridDensity,
  getGridOptionsForDensity,
  getLastUsedSymbolConfig,
} from '../../model/lastUsedSettings.ts';
import type { CadEngine, ToolMode, SketchUpCalibrationEvent, WallDrawingState, EngineCallbacks } from '../renderer.ts';
import { BoxRect, isObjectInBox, pointInBox, segmentIntersectsBox } from '../geometry/selectionBox.ts';

export function renderInteractionLayerImpl(this: CadEngine, shiftKey: boolean = false): void {
    this.interactionLayer.destroyChildren();
    this.interactionLayer.position({ x: 0, y: 0 });
    this.interactionLayer.scale({ x: 1, y: 1 });

    // معاينة أوامر التحرير (نقل/نسخ/تدوير...)
    if (this.toolMode === 'edit') {
      this.renderEditPreview(shiftKey);
    }

    const zoom = this.camera.getState().zoom;
    const meta = this.model.getMeta();
    const pixelsPerMeter = meta.scale || 50;

    // 1. معاينة رسم الجدار أثناء السحب (مع خط الزاوية الإرشادي وبادج الزاوية المباشر)
    if (this.isDrawingWall && this.wallStartPoint) {
      let endWorld = this.currentSnapResult.point;

      // حساب الالتقاط الزاوي القطبي (0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°)
      const polar = SnapEngine.getPolarAngleSnap(
        this.wallStartPoint,
        endWorld,
        [0, 45, 90, 135, 180, 225, 270, 315, 360],
        shiftKey || this.isShiftKeyPressed ? 25 : 5.0
      );

      const isObjectSnap = this.currentSnapResult.snapped && this.currentSnapResult.type !== 'grid';
      if ((!isObjectSnap && polar.isSnapped) || shiftKey || this.isShiftKeyPressed) {
        endWorld = polar.point;
      }

      // تفعيل خط الزاوية الإرشادي وقوس الزاوية
      this.renderAngleGuideline(
        this.wallStartPoint,
        endWorld,
        polar.angleDegrees,
        polar.isSnapped
      );

      const sScreen = this.camera.worldToScreen(this.wallStartPoint);
      const eScreen = this.camera.worldToScreen(endWorld);
      const currentThickness = getLastUsedSettings().wallThickness || 20;
      const thickness = currentThickness * zoom;

      this.interactionLayer.add(
        new Konva.Line({
          points: [sScreen.x, sScreen.y, eScreen.x, eScreen.y],
          stroke: '#38bdf8',
          strokeWidth: thickness,
          lineCap: 'square',
          opacity: 0.6,
          dash: [8, 4],
        })
      );

      this.interactionLayer.add(
        new Konva.Line({
          points: [sScreen.x, sScreen.y, eScreen.x, eScreen.y],
          stroke: '#0284c7',
          strokeWidth: 1.5,
        })
      );

      const dist = SnapEngine.distance(this.wallStartPoint, endWorld);
      const lengthStr = GridUtils.formatLength(dist, pixelsPerMeter, meta.unit);

      const dx = eScreen.x - sScreen.x;
      const dy = eScreen.y - sScreen.y;
      const wallLen = Math.sqrt(dx * dx + dy * dy);

      let badgeX = (sScreen.x + eScreen.x) / 2;
      let badgeY = (sScreen.y + eScreen.y) / 2 - thickness - 16;

      if (wallLen > 0) {
        let nx = -dy / wallLen;
        let ny = dx / wallLen;
        if (ny > 0.001 || (Math.abs(ny) <= 0.001 && nx > 0)) {
          nx = -nx;
          ny = -ny;
        }
        badgeX = (sScreen.x + eScreen.x) / 2 + nx * (thickness / 2 + 18);
        badgeY = (sScreen.y + eScreen.y) / 2 + ny * (thickness / 2 + 18);
      }

      this.renderFloatingBadge(
        badgeX,
        badgeY,
        `${lengthStr} (${polar.angleDegrees.toFixed(1)}°)`,
        '#0f172a',
        '#38bdf8'
      );
    }

    // 2. معاينة رسم البُعد الهندسي (Dimension Tool مع خط الزاوية الإرشادي)
    if (this.isDrawingDimension && this.dimensionStartPoint) {
      let endWorld = this.currentSnapResult.point;
      const polar = SnapEngine.getPolarAngleSnap(
        this.dimensionStartPoint,
        endWorld,
        [0, 45, 90, 135, 180, 225, 270, 315, 360],
        shiftKey || this.isShiftKeyPressed ? 25 : 5.0
      );

      const isObjectSnap = this.currentSnapResult.snapped && this.currentSnapResult.type !== 'grid';
      if ((!isObjectSnap && polar.isSnapped) || shiftKey || this.isShiftKeyPressed) {
        endWorld = polar.point;
      }

      this.renderAngleGuideline(
        this.dimensionStartPoint,
        endWorld,
        polar.angleDegrees,
        polar.isSnapped
      );

      const sScreen = this.camera.worldToScreen(this.dimensionStartPoint);
      const eScreen = this.camera.worldToScreen(endWorld);

      this.interactionLayer.add(
        new Konva.Line({
          points: [sScreen.x, sScreen.y, eScreen.x, eScreen.y],
          stroke: '#38bdf8',
          strokeWidth: 1.5,
          dash: [4, 4],
        })
      );

      const dist = SnapEngine.distance(this.dimensionStartPoint, endWorld);
      const lengthStr = GridUtils.formatLength(dist, pixelsPerMeter, meta.unit);

      this.renderFloatingBadge(
        (sScreen.x + eScreen.x) / 2,
        (sScreen.y + eScreen.y) / 2 - 20,
        `${lengthStr} (${polar.angleDegrees.toFixed(1)}°)`,
        '#0f172a',
        '#38bdf8'
      );
    }

    // 3. معاينة شريط القياس السريع (Measure Tape مع خط الزاوية الإرشادي)
    if (this.isMeasuring && this.measureStartPoint) {
      let endWorld = this.currentSnapResult.point;
      const polar = SnapEngine.getPolarAngleSnap(
        this.measureStartPoint,
        endWorld,
        [0, 45, 90, 135, 180, 225, 270, 315, 360],
        shiftKey || this.isShiftKeyPressed ? 25 : 5.0
      );

      const isObjectSnap = this.currentSnapResult.snapped && this.currentSnapResult.type !== 'grid';
      if ((!isObjectSnap && polar.isSnapped) || shiftKey || this.isShiftKeyPressed) {
        endWorld = polar.point;
      }

      this.renderAngleGuideline(
        this.measureStartPoint,
        endWorld,
        polar.angleDegrees,
        polar.isSnapped,
        'قياس'
      );

      const sScreen = this.camera.worldToScreen(this.measureStartPoint);
      const eScreen = this.camera.worldToScreen(endWorld);

      this.interactionLayer.add(
        new Konva.Line({
          points: [sScreen.x, sScreen.y, eScreen.x, eScreen.y],
          stroke: '#f59e0b',
          strokeWidth: 2,
          dash: [6, 3],
        })
      );

      const dist = SnapEngine.distance(this.measureStartPoint, endWorld);
      const dx = Math.abs(endWorld.x - this.measureStartPoint.x);
      const dy = Math.abs(endWorld.y - this.measureStartPoint.y);

      const lengthStr = GridUtils.formatLength(dist, pixelsPerMeter, meta.unit);
      const dxStr = GridUtils.formatLength(dx, pixelsPerMeter, meta.unit);
      const dyStr = GridUtils.formatLength(dy, pixelsPerMeter, meta.unit);

      // أداة القياس: الطول والزاوية فقط (المرحلة 20)
      void dxStr;
      void dyStr;
      const label = `${lengthStr}  ∠ ${polar.angleDegrees.toFixed(1)}°`;

      this.renderFloatingBadge(
        (sScreen.x + eScreen.x) / 2,
        (sScreen.y + eScreen.y) / 2 - 25,
        label,
        '#1c1917',
        '#f59e0b'
      );
    }

    // 4. معاينة أداة قياس المساحة والمحيط (Area Polygon Tool مع خط الزاوية الإرشادي)
    if (this.toolMode === 'area' && this.areaPoints.length > 0) {
      const lastPoint = this.areaPoints[this.areaPoints.length - 1];
      let endWorld = this.currentSnapResult.point;
      const polar = SnapEngine.getPolarAngleSnap(
        lastPoint,
        endWorld,
        [0, 45, 90, 135, 180, 225, 270, 315, 360],
        shiftKey || this.isShiftKeyPressed ? 25 : 5.0
      );
      const isObjectSnap = this.currentSnapResult.snapped && this.currentSnapResult.type !== 'grid';
      if ((!isObjectSnap && polar.isSnapped) || shiftKey || this.isShiftKeyPressed) {
        endWorld = polar.point;
      }

      this.renderAngleGuideline(
        lastPoint,
        endWorld,
        polar.angleDegrees,
        polar.isSnapped,
        'مساحة'
      );

      const screenPoints: number[] = [];
      for (const pt of this.areaPoints) {
        const s = this.camera.worldToScreen(pt);
        screenPoints.push(s.x, s.y);
      }

      // إضافة النقطة الحالية للمؤشر
      const curS = this.camera.worldToScreen(endWorld);
      const previewScreenPoints = [...screenPoints, curS.x, curS.y];

      // رسم المضلع المظلل
      if (previewScreenPoints.length >= 6) {
        this.interactionLayer.add(
          new Konva.Line({
            points: previewScreenPoints,
            fill: 'rgba(56, 189, 248, 0.2)',
            stroke: '#38bdf8',
            strokeWidth: 2,
            closed: true,
            dash: [4, 4],
          })
        );
      } else {
        this.interactionLayer.add(
          new Konva.Line({
            points: previewScreenPoints,
            stroke: '#38bdf8',
            strokeWidth: 2,
            dash: [4, 4],
          })
        );
      }

      // علامات رؤوس المضلع
      for (let i = 0; i < screenPoints.length; i += 2) {
        this.interactionLayer.add(
          new Konva.Circle({
            x: screenPoints[i],
            y: screenPoints[i + 1],
            radius: 5,
            fill: '#ffffff',
            stroke: '#0284c7',
            strokeWidth: 2,
          })
        );
      }
    }

    // 5. معاينة أداة المعايرة / المسطرة (Calibration Tool مع خط الزاوية الإرشادي)
    if (this.isCalibrating && this.calibrateStartPoint) {
      let endWorld = this.currentSnapResult.point;
      const polar = SnapEngine.getPolarAngleSnap(
        this.calibrateStartPoint,
        endWorld,
        [0, 45, 90, 135, 180, 225, 270, 315, 360],
        shiftKey || this.isShiftKeyPressed ? 25 : 5.0
      );

      const isObjectSnap = this.currentSnapResult.snapped && this.currentSnapResult.type !== 'grid';
      if ((!isObjectSnap && polar.isSnapped) || shiftKey || this.isShiftKeyPressed) {
        endWorld = polar.point;
      }

      this.renderAngleGuideline(
        this.calibrateStartPoint,
        endWorld,
        polar.angleDegrees,
        polar.isSnapped,
        'مسطرة'
      );

      const sScreen = this.camera.worldToScreen(this.calibrateStartPoint);
      const eScreen = this.camera.worldToScreen(endWorld);

      this.interactionLayer.add(
        new Konva.Line({
          points: [sScreen.x, sScreen.y, eScreen.x, eScreen.y],
          stroke: '#10b981',
          strokeWidth: 2.5,
          dash: [5, 3],
        })
      );

      const dist = SnapEngine.distance(this.calibrateStartPoint, endWorld);
      this.renderFloatingBadge(
        (sScreen.x + eScreen.x) / 2,
        (sScreen.y + eScreen.y) / 2 - 22,
        `🎯 مسطرة المعايرة: ${dist.toFixed(1)} px (${polar.angleDegrees.toFixed(1)}°)`,
        '#064e3b',
        '#10b981'
      );
    }

    // 5.1 عرض خط المعايرة المكتمل النشط (SketchUp Active Calibration Line)
    if (this.activeCalibrationLine) {
      const { p1, p2, dist } = this.activeCalibrationLine;
      const sScreen = this.camera.worldToScreen(p1);
      const eScreen = this.camera.worldToScreen(p2);

      this.interactionLayer.add(
        new Konva.Line({
          points: [sScreen.x, sScreen.y, eScreen.x, eScreen.y],
          stroke: '#10b981',
          strokeWidth: 3,
          dash: [6, 4],
          shadowColor: '#10b981',
          shadowBlur: 6,
          shadowOpacity: 0.6,
        })
      );

      [sScreen, eScreen].forEach((pt) => {
        this.interactionLayer.add(
          new Konva.Circle({
            x: pt.x,
            y: pt.y,
            radius: 6,
            fill: '#10b981',
            stroke: '#ffffff',
            strokeWidth: 2,
          })
        );
      });

      this.renderFloatingBadge(
        (sScreen.x + eScreen.x) / 2,
        Math.min(sScreen.y, eScreen.y) - 20,
        `📏 ${dist.toFixed(1)} px (أدخل الطول بالمتر مباشرة)`,
        '#064e3b',
        '#34d399'
      );
    }

    // 6. معاينة الباب أو النافذة فوق الجدار
    if ((this.toolMode === 'door' || this.toolMode === 'window') && this.currentWallSnap) {
      const snap = this.currentWallSnap;
      const wall = snap.wall;
      const width = this.toolMode === 'door' ? this.defaultDoorWidth : this.defaultWindowWidth;

      const dx = wall.end.x - wall.start.x;
      const dy = wall.end.y - wall.start.y;
      const wallLen = Math.sqrt(dx * dx + dy * dy);
      const ux = dx / wallLen;
      const uy = dy / wallLen;

      const halfW = width / 2;
      const p1 = { x: snap.projectedPoint.x - halfW * ux, y: snap.projectedPoint.y - halfW * uy };
      const p2 = { x: snap.projectedPoint.x + halfW * ux, y: snap.projectedPoint.y + halfW * uy };

      const sP1 = this.camera.worldToScreen(p1);
      const sP2 = this.camera.worldToScreen(p2);
      const screenThickness = Math.max(2, wall.thickness * zoom);

      this.interactionLayer.add(
        new Konva.Line({
          points: [sP1.x, sP1.y, sP2.x, sP2.y],
          stroke: this.toolMode === 'door' ? '#f59e0b' : '#38bdf8',
          strokeWidth: screenThickness + 4,
          opacity: 0.7,
          dash: [4, 4],
        })
      );

      const widthStr = GridUtils.formatLength(width, pixelsPerMeter, meta.unit);
      const label = `${this.toolMode === 'door' ? '🚪 باب' : '🪟 نافذة'} (${widthStr})`;

      if (this.showDrawingLabels) this.renderFloatingBadge(
        (sP1.x + sP2.x) / 2,
        (sP1.y + sP2.y) / 2 - screenThickness - 18,
        label,
        '#0f172a',
        this.toolMode === 'door' ? '#f59e0b' : '#38bdf8'
      );
    }

    // 6.5 معاينة الرمز الهندسي مع الالتقاط الذكي بالجدار (Symbol Tool Preview - المرحلة 4)
    if (this.toolMode === 'symbol') {
      const symDef = getSymbolById(this.activeSymbolKind);
      if (symDef) {
        let previewPoint = this.currentSnapResult.point;
        let previewAngle = 0;
        let isSnappedToWall = false;

        if (this.currentSymbolWallSnap) {
          previewPoint = this.currentSymbolWallSnap.snappedPoint;
          previewAngle = this.currentSymbolWallSnap.angle;
          isSnappedToWall = true;
        }

        const sPos = this.camera.worldToScreen(previewPoint);
        const ghostGroup = new Konva.Group({
          x: sPos.x,
          y: sPos.y,
          rotation: previewAngle,
          scale: { x: zoom, y: zoom },
          opacity: 0.85,
        });

        symDef.renderKonva(ghostGroup, {
          color: isSnappedToWall ? '#38bdf8' : '#f59e0b',
          isSelected: false,
          zoom,
        });

        if (isSnappedToWall) {
          ghostGroup.add(
            new Konva.Circle({
              x: 0,
              y: 0,
              radius: 14,
              stroke: '#38bdf8',
              strokeWidth: 1.5,
              dash: [3, 3],
            })
          );
        }

        this.interactionLayer.add(ghostGroup);

        const badgeLabel = symDef.name;
        if (this.showDrawingLabels) this.renderFloatingBadge(
          sPos.x,
          sPos.y - 24,
          badgeLabel,
          '#0f172a',
          isSnappedToWall ? '#38bdf8' : '#f59e0b'
        );
      }
    }

    // 6.6 معاينة رسم المسار والكابلات بالوقت الفعلي (Real-time Live Route Preview)
    if (this.toolMode === 'route') {
      const meta = ROUTE_KINDS_META[this.activeRouteKind];
      const routeColor = meta?.defaultColor || '#f59e0b';
      const strokeW = Math.max(2, (meta?.defaultStrokeWidth || 2.5) * Math.min(1.4, Math.max(0.7, zoom)));

      let liveDash: number[] | undefined = undefined;
      let liveCap: 'round' | 'square' | 'butt' = 'round';
      if (this.activeRouteLineStyle === 'dashed') {
        liveDash = [14, 8];
        liveCap = 'butt';
      } else if (this.activeRouteLineStyle === 'dotted') {
        liveDash = [2, 10];
        liveCap = 'round';
      }

      if (this.routePoints.length === 0) {
        // معاينة حية قبل النقر الأول لتوضيح إمكانية البدء والارتباط
        const symbolSnap = SnapEngine.findSymbolSnap(this.currentSnapResult.point, this.model.getObjects(), 30);
        const curPt = symbolSnap ? symbolSnap.point : this.currentSnapResult.point;
        const curScreen = this.camera.worldToScreen(curPt);

        this.interactionLayer.add(
          new Konva.Circle({
            x: curScreen.x,
            y: curScreen.y,
            radius: 6,
            fill: symbolSnap ? '#22c55e' : routeColor,
            stroke: '#ffffff',
            strokeWidth: 2,
            opacity: 0.9,
          })
        );

        const hintText = symbolSnap
          ? `التقط بالرمز: ${symbolSnap.symbol.symbolKind} (انقر للبدء)`
          : `⚡ انقر لتحديد بداية مسار ${meta?.name || 'MEP'}`;

        if (this.showDrawingLabels) this.renderFloatingBadge(
          curScreen.x,
          curScreen.y - 22,
          hintText,
          '#0f172a',
          symbolSnap ? '#22c55e' : routeColor
        );
      } else {
        const screenPoints: number[] = [];
        this.routePoints.forEach((p) => {
          const s = this.camera.worldToScreen(p);
          screenPoints.push(s.x, s.y);
        });

        let currentEnd = this.currentSnapResult.point;
        const symbolSnap = SnapEngine.findSymbolSnap(this.currentSnapResult.point, this.model.getObjects(), 30);
        const lastPt = this.routePoints[this.routePoints.length - 1];

        const polar = SnapEngine.getPolarAngleSnap(
          lastPt,
          currentEnd,
          [0, 45, 90, 135, 180, 225, 270, 315, 360],
          shiftKey || this.isShiftKeyPressed ? 25 : 5.0
        );

        if (symbolSnap) {
          currentEnd = symbolSnap.point;
        } else if (polar.isSnapped || shiftKey || this.isShiftKeyPressed) {
          currentEnd = polar.point;
        }

        if (!symbolSnap) {
          this.renderAngleGuideline(lastPt, currentEnd, polar.angleDegrees, polar.isSnapped);
        }

        const curScreen = this.camera.worldToScreen(currentEnd);

        // رسم الخطوط السابقة المسجلة للمسار بنمط الخط المختار
        if (screenPoints.length >= 4) {
          this.interactionLayer.add(
            new Konva.Line({
              points: screenPoints,
              stroke: routeColor,
              strokeWidth: strokeW,
              dash: liveDash,
              lineCap: liveCap,
              lineJoin: 'round',
            })
          );
        }

        // رسم الجزء الحي المتحرك المرتبط بالمؤشر (Rubber-banding)
        const lastScreenPt = {
          x: screenPoints[screenPoints.length - 2],
          y: screenPoints[screenPoints.length - 1],
        };

        this.interactionLayer.add(
          new Konva.Line({
            points: [lastScreenPt.x, lastScreenPt.y, curScreen.x, curScreen.y],
            stroke: routeColor,
            strokeWidth: strokeW,
            dash: liveDash || [6, 4],
            lineCap: liveCap,
            lineJoin: 'round',
            opacity: 0.9,
          })
        );

        // رسم دوائر الرؤوس (Vertices)
        for (let i = 0; i < screenPoints.length; i += 2) {
          this.interactionLayer.add(
            new Konva.Circle({
              x: screenPoints[i],
              y: screenPoints[i + 1],
              radius: 4,
              fill: '#ffffff',
              stroke: routeColor,
              strokeWidth: 2,
            })
          );
        }

        // علامة نقطة المؤشر الحالية
        this.interactionLayer.add(
          new Konva.Circle({
            x: curScreen.x,
            y: curScreen.y,
            radius: 5,
            fill: symbolSnap ? '#22c55e' : routeColor,
            stroke: '#ffffff',
            strokeWidth: 1.5,
          })
        );

        // شارة الأطوال بالوقت الفعلي
        const lastWorldPt = this.routePoints[this.routePoints.length - 1];
        const segmentPx = SnapEngine.distance(lastWorldPt, currentEnd);
        const segmentMeters = (segmentPx / pixelsPerMeter).toFixed(2);

        const allPointsWithCur = [...this.routePoints, currentEnd];
        const totalPx = calculateRoutePixelLength(allPointsWithCur);
        const totalMeters = (totalPx / pixelsPerMeter).toFixed(2);

        let badgeText = this.showDrawingLabels
          ? `⚡ ${meta?.name || 'مسار'}: ${segmentMeters}م (المجموع: ${totalMeters}م)`
          : `${segmentMeters} م (المجموع ${totalMeters} م)`;
        if (symbolSnap && this.showDrawingLabels) {
          badgeText = `متصل بـ: ${symbolSnap.symbol.symbolKind} | المجموع: ${totalMeters}م`;
        }

        this.renderFloatingBadge(
          (lastScreenPt.x + curScreen.x) / 2,
          (lastScreenPt.y + curScreen.y) / 2 - 20,
          badgeText,
          '#0f172a',
          symbolSnap ? '#22c55e' : routeColor
        );
      }
    }

    // 6.7 معاينة مستطيل التحديد بمربع الإحاطة (Marquee Box Selection Preview - المتطلب 5)
    if (this.isMarqueeSelecting && this.marqueeStartPoint) {
      const p1 = this.camera.worldToScreen(this.marqueeStartPoint);
      const p2 = this.camera.worldToScreen(this.currentSnapResult.point);
      const x = Math.min(p1.x, p2.x);
      const y = Math.min(p1.y, p2.y);
      const w = Math.abs(p2.x - p1.x);
      const h = Math.abs(p2.y - p1.y);

      this.interactionLayer.add(
        new Konva.Rect({
          x,
          y,
          width: w,
          height: h,
          fill: 'rgba(56, 189, 248, 0.15)',
          stroke: '#38bdf8',
          strokeWidth: 1.5,
          dash: [6, 4],
        })
      );

      const distW = Math.abs(this.currentSnapResult.point.x - this.marqueeStartPoint.x) / pixelsPerMeter;
      const distH = Math.abs(this.currentSnapResult.point.y - this.marqueeStartPoint.y) / pixelsPerMeter;

      if (this.showDrawingLabels) this.renderFloatingBadge(
        x + w / 2,
        y - 18,
        `🔲 مربع تحديد: ${distW.toFixed(2)}م × ${distH.toFixed(2)}م`,
        '#0f172a',
        '#38bdf8'
      );
    }

    // 7. رسم مؤشر الالتقاط العادي
    this.renderSnapIndicatorShapes();
    this.interactionLayer.batchDraw();
  }

export function renderAngleGuidelineImpl(this: CadEngine, originWorld: Point, targetWorld: Point, angleDegrees: number, isSnapped: boolean, labelExtra?: string): void {
    const sOrigin = this.camera.worldToScreen(originWorld);
    const sTarget = this.camera.worldToScreen(targetWorld);
    const distScreen = Math.hypot(sTarget.x - sOrigin.x, sTarget.y - sOrigin.y);
    if (distScreen < 8) return;

    const rad = (angleDegrees * Math.PI) / 180;
    const dirX = Math.cos(rad);
    const dirY = Math.sin(rad);

    // 1. خط الزاوية الإرشادي الممتد (Polar Guide Ray) عبر الشاشة
    const extLen = 3000;
    const rayStart = {
      x: sOrigin.x - dirX * 150,
      y: sOrigin.y - dirY * 150,
    };
    const rayEnd = {
      x: sOrigin.x + dirX * extLen,
      y: sOrigin.y + dirY * extLen,
    };

    const guideColor = isSnapped ? '#10b981' : '#38bdf8';
    this.interactionLayer.add(
      new Konva.Line({
        points: [rayStart.x, rayStart.y, rayEnd.x, rayEnd.y],
        stroke: guideColor,
        strokeWidth: isSnapped ? 1.5 : 1,
        dash: isSnapped ? [10, 5] : [6, 4],
        opacity: isSnapped ? 0.9 : 0.45,
        listening: false,
      })
    );

    // 2. خط المرجع الأفقي عند نقطة البداية (0° Reference Line)
    if (Math.abs(angleDegrees) > 2 && Math.abs(angleDegrees - 180) > 2 && Math.abs(angleDegrees - 360) > 2) {
      this.interactionLayer.add(
        new Konva.Line({
          points: [sOrigin.x, sOrigin.y, sOrigin.x + Math.min(60, distScreen * 0.7), sOrigin.y],
          stroke: 'rgba(148, 163, 184, 0.4)',
          strokeWidth: 1,
          dash: [3, 3],
          listening: false,
        })
      );

      // قوس الزاوية (Angle Arc)
      const arcRadius = Math.min(26, Math.max(14, distScreen * 0.35));
      this.interactionLayer.add(
        new Konva.Arc({
          x: sOrigin.x,
          y: sOrigin.y,
          innerRadius: arcRadius - 1,
          outerRadius: arcRadius,
          angle: angleDegrees > 180 ? 360 - angleDegrees : angleDegrees,
          rotation: angleDegrees > 180 ? angleDegrees : 0,
          stroke: guideColor,
          strokeWidth: 1.5,
          opacity: 0.8,
          listening: false,
        })
      );
    }

    // 3. بادج قيمة الزاوية
    const badgeText = `${isSnapped ? '⌖ ' : '∠ '}${angleDegrees.toFixed(1)}°${labelExtra ? ' • ' + labelExtra : ''}`;
    const midX = (sOrigin.x + sTarget.x) / 2;
    const midY = (sOrigin.y + sTarget.y) / 2;
    const perpX = -dirY * 20;
    const perpY = dirX * 20;

    // شارة الزاوية المنفصلة تكرر ما في شارة الطول؛ تظهر فقط مع «التسميات أثناء الرسم» (المرحلة 20)
    if (this.showDrawingLabels) this.renderFloatingBadge(
      midX + perpX,
      midY + perpY,
      badgeText,
      isSnapped ? '#064e3b' : '#0f172a',
      isSnapped ? '#34d399' : '#38bdf8'
    );
  }

export function renderFloatingBadgeImpl(this: CadEngine, x: number, y: number, text: string, bgColor: string, borderColor: string): void {
    const badgeGroup = new Konva.Group({ x, y, listening: false });

    const labelText = new Konva.Text({
      text,
      fontSize: 11,
      fontFamily: 'JetBrains Mono',
      fill: '#ffffff',
      padding: 3,
      align: 'center',
    });

    const labelBg = new Konva.Rect({
      width: labelText.width() + 10,
      height: labelText.height() + 4,
      fill: bgColor,
      stroke: borderColor,
      strokeWidth: 1,
      cornerRadius: 4,
      offsetX: (labelText.width() + 10) / 2,
      offsetY: 2,
    });

    labelText.offsetX(labelText.width() / 2);
    badgeGroup.add(labelBg);
    badgeGroup.add(labelText);
    this.interactionLayer.add(badgeGroup);
  }

export function renderSnapIndicatorOnlyImpl(this: CadEngine): void {
    const snapNodes = this.interactionLayer.find('.snap-node');
    snapNodes.forEach((node) => node.destroy());

    this.renderSnapIndicatorShapes();
    this.interactionLayer.batchDraw();
  }

export function renderSnapIndicatorShapesImpl(this: CadEngine): void {
    if (!this.currentSnapResult.snapped) return;

    const screenPos = this.camera.worldToScreen(this.currentSnapResult.point);
    const snapType = this.currentSnapResult.type;

    let color = '#38bdf8';
    if (snapType === 'endpoint') color = '#22c55e';
    if (snapType === 'midpoint') color = '#06b6d4';
    if (snapType === 'grid') color = '#eab308';
    if (snapType === 'intersection') color = '#f472b6';
    if (snapType === 'perpendicular') color = '#a78bfa';
    if (snapType === 'tracking') color = '#4ade80';
    if (snapType === 'input') color = '#f59e0b';

    // خطوط تتبع المحاذاة المنقطة (من النقطة المكتسبة إلى موضع المؤشر)
    if (snapType === 'tracking' && this.currentSnapResult.guides) {
      for (const g of this.currentSnapResult.guides) {
        const a = this.camera.worldToScreen(g.from);
        const b = this.camera.worldToScreen(g.to);
        // نمد الخط قليلاً خلف المؤشر ليبدو كمحور إرشادي
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const ext = 40;
        this.interactionLayer.add(
          new Konva.Line({
            points: [a.x, a.y, b.x + (dx / len) * ext, b.y + (dy / len) * ext],
            stroke: color,
            strokeWidth: 1,
            dash: [3, 4],
            opacity: 0.9,
            name: 'snap-node',
            listening: false,
          })
        );
        this.interactionLayer.add(
          new Konva.Line({
            points: [a.x - 4, a.y, a.x + 4, a.y, a.x, a.y, a.x, a.y - 4, a.x, a.y + 4],
            stroke: color,
            strokeWidth: 1.5,
            name: 'snap-node',
            listening: false,
          })
        );
      }
    }

    // أشكال مميزة لكل نوع التقاط (كما في برامج CAD): مربع للنهاية، مثلث للمنتصف، X للتقاطع، ⊥ للعمودي
    const size = 6;
    const common = { stroke: color, strokeWidth: 2, name: 'snap-node', listening: false } as const;
    let marker: Konva.Shape;
    if (snapType === 'endpoint') {
      marker = new Konva.Rect({ x: screenPos.x - size, y: screenPos.y - size, width: size * 2, height: size * 2, fill: 'rgba(255,255,255,0.15)', ...common });
    } else if (snapType === 'midpoint') {
      marker = new Konva.RegularPolygon({ x: screenPos.x, y: screenPos.y, sides: 3, radius: size + 1, fill: 'rgba(255,255,255,0.15)', ...common });
    } else if (snapType === 'intersection') {
      marker = new Konva.Line({ points: [screenPos.x - size, screenPos.y - size, screenPos.x + size, screenPos.y + size, screenPos.x, screenPos.y, screenPos.x + size, screenPos.y - size, screenPos.x - size, screenPos.y + size], ...common });
    } else if (snapType === 'perpendicular') {
      marker = new Konva.Line({ points: [screenPos.x - size, screenPos.y - size, screenPos.x - size, screenPos.y + size, screenPos.x + size, screenPos.y + size, screenPos.x - size, screenPos.y + size, screenPos.x - size, screenPos.y, screenPos.x, screenPos.y, screenPos.x, screenPos.y + size], ...common });
    } else {
      marker = new Konva.Circle({ x: screenPos.x, y: screenPos.y, radius: 6, fill: 'rgba(255, 255, 255, 0.2)', ...common });
    }
    this.interactionLayer.add(marker);
  }
