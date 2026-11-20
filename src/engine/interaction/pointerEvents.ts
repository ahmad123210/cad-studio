/**
 * @file pointerEvents.ts
 * @description أحداث الفأرة واللمس ومعالجة حركة المؤشر
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

export function bindEventsImpl(this: CadEngine): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    this.stage.on('wheel', (e) => {
      e.evt.preventDefault();
      const pointer = this.stage.getPointerPosition();
      if (!pointer) return;

      // تكبير متناسب مع مقدار العجلة: عجلة الفأرة التقليدية (±100) تعطي نفس الخطوة السابقة 1.08،
      // بينما لوحات اللمس (Trackpad) ترسل قيماً صغيرة متتابعة فيصبح التكبير ناعماً بدل القفزات.
      let dy = e.evt.deltaY;
      if (e.evt.deltaMode === 1) dy *= 33; // وضع الأسطر (Firefox)
      else if (e.evt.deltaMode === 2) dy *= 800; // وضع الصفحات
      dy = Math.max(-300, Math.min(300, dy));
      const sensitivity = e.evt.ctrlKey ? 0.003 : 0.00077; // ctrlKey = إيماءة القرص على لوحة اللمس
      const factor = Math.exp(-dy * sensitivity);
      if (!isFinite(factor) || factor === 1) return;
      this.camera.zoomAtScreenPoint(factor, pointer);
      this.onViewTransformChanged();
    });

    // دعم اللمس: منع إيماءات المتصفح الافتراضية (تمرير/تكبير الصفحة) فوق لوحة الرسم
    this.container.style.touchAction = 'none';

    // قبل أي نقرة بالفأرة أثناء وضع اللقطة المؤقتة: نعيد البناء الدقيق فوراً حتى تصيب النقرة العناصر الحقيقية
    this.containerPointerDownCapture = (ev: Event) => {
      const pe = ev as PointerEvent;
      if (pe.pointerType === 'touch') return; // اللمس: لا نقطع سلسلة إيماءات القرص المتتالية
      this.flushGesture();
    };
    this.container.addEventListener('pointerdown', this.containerPointerDownCapture, true);

    this.stage.on('mousedown touchstart', (e) => {
      // بداية إيماءة القرص/التحريك بإصبعين (Pinch Zoom & Two-Finger Pan)
      const touches = (e.evt as TouchEvent).touches;
      if (touches && touches.length >= 2) {
        this.beginPinch(touches);
        return;
      }
      if (this.pinchState) return;
      if (touches && touches.length === 1) {
        this.touchStartSnapshot = {
          time: Date.now(),
          wasDrawingWall: this.isDrawingWall,
          routeLen: this.routePoints.length,
          areaLen: this.areaPoints.length,
          undoCount: this.model.getHistory().getPushCount(),
          selectedIds: this.selectedObjectIds,
        };
      }

      // التحريك بالزر الأوسط أو بمفتاح المسافة
      if (e.evt.button === 1 || this.isSpacePressed || this.toolMode === 'pan') {
        const pointer = this.stage.getPointerPosition();
        if (pointer) {
          this.isPanning = true;
          this.panStartPos = { x: pointer.x, y: pointer.y };
          this.updateCursor();
        }
        return;
      }

      if (e.evt.button !== 0 && !e.evt.touches) return;

      const pointer = this.stage.getPointerPosition();
      if (!pointer) return;
      this.isPointerMovePending = false;

      const worldRaw = this.camera.screenToWorld(pointer);
      const snap = SnapEngine.findSnapPoint(
        worldRaw,
        this.model.getObjects(),
        this.getEffectiveSnapOptions(),
        this.toolMode === 'select' ? (this.selectedObjectId || undefined) : undefined
      );
      const activeWorldPoint = snap.point;

      // 1. رسم جدار
      if (this.toolMode === 'wall') {
        if (!this.isDrawingWall) {
          this.isDrawingWall = true;
          this.wallStartPoint = activeWorldPoint;
          this.callbacks.onWallDrawingStateChange?.(this.getWallDrawingState());
          this.renderInteractionLayer();
        } else if (this.wallStartPoint) {
          const polar = SnapEngine.getPolarAngleSnap(
            this.wallStartPoint,
            activeWorldPoint,
            [0, 45, 90, 135, 180, 225, 270, 315, 360],
            e.evt.shiftKey || this.isShiftKeyPressed ? 25 : 5.0
          );
          const isObjectSnap = snap.snapped && snap.type !== 'grid';
          const endPoint = (!isObjectSnap && polar.isSnapped) || e.evt.shiftKey || this.isShiftKeyPressed
            ? polar.point
            : activeWorldPoint;

          const dist = SnapEngine.distance(this.wallStartPoint, endPoint);
          if (dist > 5) {
            const currentSettings = getLastUsedSettings();
            const newWall: WallObject = {
              id: 'wall_' + Math.random().toString(36).substring(2, 9),
              type: 'wall',
              layerId: this.model.getLayers().some((l) => l.id === 'arch') ? 'arch' : this.model.getActiveLayerId(),
              start: { ...this.wallStartPoint },
              end: { ...endPoint },
              thickness: currentSettings.wallThickness,
            };
            this.model.addObject(newWall);
            this.wallStartPoint = { ...endPoint };
            this.callbacks.onWallDrawingStateChange?.(this.getWallDrawingState());
          }
          this.render();
        }
        return;
      }

      // 2. إدراج باب
      if (this.toolMode === 'door') {
        const currentSettings = getLastUsedSettings();
        const doorWidth = currentSettings.doorWidth || this.defaultDoorWidth;
        const wallSnap = SnapEngine.findWallProjection(
          worldRaw,
          this.model.getObjects(),
          45,
          doorWidth
        );
        if (wallSnap) {
          const newDoor: DoorObject = {
            id: 'door_' + Math.random().toString(36).substring(2, 9),
            type: 'door',
            layerId: wallSnap.wall.layerId,
            wallId: wallSnap.wall.id,
            position: wallSnap.position,
            width: doorWidth,
            openDirection: currentSettings.doorDirection || this.defaultDoorDirection,
          };
          this.model.addObject(newDoor);
          this.selectObject(newDoor.id);
          this.render();
        }
        return;
      }

      // 3. إدراج نافذة
      if (this.toolMode === 'window') {
        const currentSettings = getLastUsedSettings();
        const winWidth = currentSettings.windowWidth || this.defaultWindowWidth;
        const wallSnap = SnapEngine.findWallProjection(
          worldRaw,
          this.model.getObjects(),
          45,
          winWidth
        );
        if (wallSnap) {
          const newWindow: WindowObject = {
            id: 'win_' + Math.random().toString(36).substring(2, 9),
            type: 'window',
            layerId: wallSnap.wall.layerId,
            wallId: wallSnap.wall.id,
            position: wallSnap.position,
            width: winWidth,
            height: currentSettings.windowHeight ?? 1.2,
            sillHeight: currentSettings.windowSillHeight ?? 0.9,
          };
          this.model.addObject(newWindow);
          this.selectObject(newWindow.id);
          this.render();
        }
        return;
      }

      // 3.5 إدراج رمز هندسي (Symbol Tool - المرحلة 4)
      if (this.toolMode === 'symbol') {
        const symbolDef = getSymbolById(this.activeSymbolKind);
        const wallSnap = SnapEngine.findSymbolWallSnap(
          worldRaw,
          this.model.getObjects(),
          35,
          true
        );

        let finalPoint = activeWorldPoint;
        let rotation = 0;
        let wallId: string | undefined = undefined;
        let wallPosition: number | undefined = undefined;
        let wallSide: 1 | -1 | undefined = undefined;

        if (wallSnap) {
          finalPoint = wallSnap.snappedPoint;
          rotation = Math.round(wallSnap.angle);
          wallId = wallSnap.wall.id;
          wallPosition = wallSnap.position;
          wallSide = wallSnap.wallSide;
        }

        const lastSymConfig = getLastUsedSymbolConfig(this.activeSymbolKind);
        const newSymbol: SymbolObject = {
          id: 'sym_' + Math.random().toString(36).substring(2, 9),
          type: 'symbol',
          symbolKind: this.activeSymbolKind,
          layerId: symbolDef?.defaultLayerId || this.model.getActiveLayerId(),
          x: finalPoint.x,
          y: finalPoint.y,
          rotation: wallSnap ? rotation : (lastSymConfig.rotation || 0),
          wallId,
          wallPosition,
          wallSide,
          scale: lastSymConfig.scale || 1,
          color: lastSymConfig.color,
        };

        this.model.addObject(newSymbol);
        this.selectObject(newSymbol.id);
        this.render();
        return;
      }

      // 3.6 أداة رسم المسارات والكابلات (Route Tool - المرحلة 5)
      if (this.toolMode === 'route') {
        const symbolSnap = SnapEngine.findSymbolSnap(worldRaw, this.model.getObjects(), 25);
        let clickPoint = activeWorldPoint;
        if (symbolSnap) {
          clickPoint = symbolSnap.point;
        }

        // إذا كان مفتاح Shift مضغوطاً، قفل متعامد (Ortho)
        if (e.evt.shiftKey && this.routePoints.length > 0) {
          const lastPt = this.routePoints[this.routePoints.length - 1];
          clickPoint = SnapEngine.getOrthoPoint(lastPt, clickPoint);
        }

        if (this.routePoints.length === 0) {
          this.isDrawingRoute = true;
          this.routeStartSymbolId = symbolSnap?.symbol.id;
          this.routePoints = [clickPoint];
          this.notifyRouteUpdate();
          this.renderInteractionLayer(e.evt.shiftKey);
        } else {
          const lastPt = this.routePoints[this.routePoints.length - 1];
          const distToLast = SnapEngine.distance(lastPt, clickPoint);

          // إذا نقر المستخدم في نفس النقطة تقريباً، إنهِ المسار
          if (distToLast < 10) {
            this.finishRoute();
            return;
          }

          this.routePoints.push(clickPoint);
          this.notifyRouteUpdate();

          // إذا نقر على رمز هندسي وعدد النقاط نقطتان فأكثر، ينهي المسار تلقائياً ويربطه
          if (symbolSnap && this.routePoints.length >= 2) {
            this.finishRoute();
            return;
          }

          this.renderInteractionLayer(e.evt.shiftKey);
        }
        return;
      }

      // 3.7 أداة إدراج ملاحظة وتلميح نصي (Text Note Tool)
      if (this.toolMode === 'text') {
        const isDark = this.theme === 'dark';
        const settings = getLastUsedSettings();
        const initialFontSize = settings.textFontSize || 16;
        const initialColor = settings.textColor || (isDark ? '#38bdf8' : '#0284c7');
        const initialFontWeight = settings.textFontWeight || 'normal';
        const initialAlign = settings.textAlign || 'right';

        const newText: TextObject = {
          id: 'text_' + Math.random().toString(36).substring(2, 9),
          type: 'text',
          layerId: this.model.getActiveLayerId(),
          text: 'ملاحظة وتلميح هندسي',
          x: Math.round(activeWorldPoint.x),
          y: Math.round(activeWorldPoint.y),
          fontSize: initialFontSize,
          color: initialColor,
          rotation: 0,
          backgroundColor: isDark ? '#0f172a' : '#f8fafc',
          backgroundOpacity: 0.9,
          borderColor: initialColor,
          padding: 6,
          fontWeight: initialFontWeight,
          align: initialAlign,
        };
        this.model.addObject(newText);
        this.selectObject(newText.id);
        this.setToolMode('select');
        this.render();
        return;
      }

      // 4. أداة رسم الأبعاد الهندسية (Dimension Tool - المرحلة 3)
      if (this.toolMode === 'dimension') {
        if (!this.isDrawingDimension) {
          this.isDrawingDimension = true;
          this.dimensionStartPoint = activeWorldPoint;
          this.renderInteractionLayer();
        } else if (this.dimensionStartPoint) {
          const polar = SnapEngine.getPolarAngleSnap(
            this.dimensionStartPoint,
            activeWorldPoint,
            [0, 45, 90, 135, 180, 225, 270, 315, 360],
            e.evt.shiftKey || this.isShiftKeyPressed ? 25 : 5.0
          );
          const isObjectSnap = snap.snapped && snap.type !== 'grid';
          const endPoint = (!isObjectSnap && polar.isSnapped) || e.evt.shiftKey || this.isShiftKeyPressed
            ? polar.point
            : activeWorldPoint;
          const dist = SnapEngine.distance(this.dimensionStartPoint, endPoint);
          if (dist > 5) {
            const currentSettings = getLastUsedSettings();
            const newDim: DimensionObject = {
              id: 'dim_' + Math.random().toString(36).substring(2, 9),
              type: 'dimension',
              layerId: this.model.getActiveLayerId(),
              start: { ...this.dimensionStartPoint },
              end: { ...endPoint },
              measuredLength: dist,
              offset: currentSettings.dimensionOffset || 20,
            };
            this.model.addObject(newDim);
            this.selectObject(newDim.id);
          }
          this.isDrawingDimension = false;
          this.dimensionStartPoint = null;
          this.render();
        }
        return;
      }

      // 5. شريط القياس السريع المؤقت (Measure Tape Tool - المرحلة 3)
      if (this.toolMode === 'measure') {
        if (!this.isMeasuring) {
          this.isMeasuring = true;
          this.measureStartPoint = activeWorldPoint;
          this.renderInteractionLayer();
        } else {
          // النقر للمرة الثانية يثبت النتيجة أو يلغيها
          this.isMeasuring = false;
          this.measureStartPoint = null;
          this.renderInteractionLayer();
        }
        return;
      }

      // 6. أداة قياس المساحة والمحيط (Area Tool - المرحلة 3)
      if (this.toolMode === 'area') {
        // إذا كان هناك 3 نقاط على الأقل ونقر المستخدم قرب النقطة الأولى، يغلق المضلع
        if (this.areaPoints.length >= 3) {
          const firstPt = this.areaPoints[0];
          const distToFirst = SnapEngine.distance(activeWorldPoint, firstPt);
          if (distToFirst < 20) {
            this.closeAreaPolygon();
            return;
          }
        }

        let ptToAdd = activeWorldPoint;
        if (this.areaPoints.length > 0) {
          const lastPt = this.areaPoints[this.areaPoints.length - 1];
          const polar = SnapEngine.getPolarAngleSnap(
            lastPt,
            activeWorldPoint,
            [0, 45, 90, 135, 180, 225, 270, 315, 360],
            e.evt?.shiftKey || this.isShiftKeyPressed ? 25 : 5.0
          );
          const isObjectSnap = snap.snapped && snap.type !== 'grid';
          if ((!isObjectSnap && polar.isSnapped) || e.evt?.shiftKey || this.isShiftKeyPressed) {
            ptToAdd = polar.point;
          }
        }

        this.areaPoints.push(ptToAdd);
        const pixelArea = GridUtils.calculatePolygonArea(this.areaPoints);
        const pixelPerimeter = GridUtils.calculatePolygonPerimeter(this.areaPoints);
        this.callbacks.onAreaUpdate?.(pixelArea, pixelPerimeter, this.areaPoints.length);
        this.renderInteractionLayer();
        return;
      }

      // 7. أداة المعايرة (Calibration Tool - أسلوب SketchUp بالمتر المباشر)
      if (this.toolMode === 'calibrate') {
        if (!this.isCalibrating) {
          this.isCalibrating = true;
          this.calibrateStartPoint = activeWorldPoint;
          this.activeCalibrationLine = null;
          this.renderInteractionLayer();
        } else if (this.calibrateStartPoint) {
          let endPoint = activeWorldPoint;
          const polar = SnapEngine.getPolarAngleSnap(
            this.calibrateStartPoint,
            endPoint,
            [0, 45, 90, 135, 180, 225, 270, 315, 360],
            e.evt?.shiftKey || this.isShiftKeyPressed ? 25 : 5.0
          );
          const isObjectSnap = snap.snapped && snap.type !== 'grid';
          if ((!isObjectSnap && polar.isSnapped) || e.evt?.shiftKey || this.isShiftKeyPressed) {
            endPoint = polar.point;
          }
          const dist = SnapEngine.distance(this.calibrateStartPoint, endPoint);
          if (dist > 10) {
            this.finishCalibration(this.calibrateStartPoint, endPoint);
          } else {
            this.isCalibrating = false;
            this.calibrateStartPoint = null;
            this.renderInteractionLayer();
          }
        }
        return;
      }

      // 8. أداة التحديد (Selection & Marquee Box Tool)
      if (this.toolMode === 'select') {
        if (this.selectionSubMode === 'box') {
          this.isMarqueeSelecting = true;
          this.marqueeStartPoint = worldRaw;
          return;
        }

        const isBackgroundTarget =
          e.target === this.stage ||
          e.target.getLayer() === this.backgroundLayer ||
          e.target.getLayer() === this.gridLayer;

        if (isBackgroundTarget) {
          // فحص ذكي: هل النقر قريب من أي عنصر (ضمن 14 بكسل) لتفادي فشل النقر في الشبكة الدقيقة؟
          let nearbyObjId: string | null = null;
          const all = this.model.getObjects();
          for (const obj of all) {
            if (obj.type === 'wall') {
              const w = obj as WallObject;
              const d = SnapEngine.pointToSegmentDistance(worldRaw, w.start, w.end);
              if (d <= (w.thickness / 2 + 14)) {
                nearbyObjId = w.id;
                break;
              }
            } else if (obj.type === 'symbol') {
              const s = obj as SymbolObject;
              if (SnapEngine.distance(worldRaw, { x: s.x, y: s.y }) <= 25) {
                nearbyObjId = s.id;
                break;
              }
            } else if (obj.type === 'route') {
              const r = obj as RouteObject;
              for (let i = 0; i < r.points.length - 1; i++) {
                if (SnapEngine.pointToSegmentDistance(worldRaw, r.points[i], r.points[i + 1]) <= 14) {
                  nearbyObjId = r.id;
                  break;
                }
              }
              if (nearbyObjId) break;
            } else if (obj.type === 'text') {
              const t = obj as TextObject;
              if (SnapEngine.distance(worldRaw, { x: t.x, y: t.y }) <= 30) {
                nearbyObjId = t.id;
                break;
              }
            } else if (obj.type === 'dimension') {
              const dim = obj as DimensionObject;
              if (SnapEngine.pointToSegmentDistance(worldRaw, dim.start, dim.end) <= 14) {
                nearbyObjId = dim.id;
                break;
              }
            }
          }

          if (nearbyObjId) {
            if (e.evt?.shiftKey || this.selectionSubMode === 'multi') {
              this.toggleObjectSelection(nearbyObjId);
            } else {
              this.selectObject(nearbyObjId);
            }
          } else {
            this.isMarqueeSelecting = true;
            this.marqueeStartPoint = worldRaw;
          }
        }
      }
    });

    // النقر المزدوج لإغلاق مضلع المساحة أو إنهاء رسم المسار
    this.stage.on('dblclick', () => {
      if (this.toolMode === 'area' && this.areaPoints.length >= 3) {
        this.closeAreaPolygon();
      } else if (this.toolMode === 'route' && this.isDrawingRoute && this.routePoints.length >= 2) {
        this.finishRoute();
      }
    });

    this.stage.on('mousemove touchmove', (e) => {
      // إيماءة القرص بإصبعين لها الأولوية على أي أداة
      const touches = (e.evt as TouchEvent).touches;
      if (touches && touches.length >= 2) {
        e.evt.preventDefault();
        if (!this.pinchState) this.beginPinch(touches);
        else this.updatePinch(touches);
        return;
      }
      if (this.pinchState) return;

      const pointer = this.stage.getPointerPosition();
      if (!pointer) return;

      if (this.isPanning) {
        const dx = pointer.x - this.panStartPos.x;
        const dy = pointer.y - this.panStartPos.y;
        this.camera.panBy(dx, dy);
        this.panStartPos = { x: pointer.x, y: pointer.y };

        // المخططات الكبيرة: تحريك لقطة نقطية واحدة بدلاً من إعادة رسم آلاف العُقد في كل إطار
        if (this.shouldUseFastGesture()) {
          this.beginGesture();
          this.scheduleGestureFrame();
          return;
        }

        // تحريك طبقات الكانفس مباشرة بأداء فائق 60/144 FPS دون إعادة بناء شجرة العناصر
        this.backgroundLayer.x(this.backgroundLayer.x() + dx);
        this.backgroundLayer.y(this.backgroundLayer.y() + dy);
        this.gridLayer.x(this.gridLayer.x() + dx);
        this.gridLayer.y(this.gridLayer.y() + dy);
        this.objectsLayer.x(this.objectsLayer.x() + dx);
        this.objectsLayer.y(this.objectsLayer.y() + dy);
        this.interactionLayer.x(this.interactionLayer.x() + dx);
        this.interactionLayer.y(this.interactionLayer.y() + dy);
        this.stage.batchDraw();
        return;
      }

      this.pendingPointerPos = pointer;
      this.pendingShiftKey = Boolean(e.evt?.shiftKey || this.isShiftKeyPressed);

      if (!this.isPointerMovePending) {
        this.isPointerMovePending = true;
        requestAnimationFrame(() => {
          this.isPointerMovePending = false;
          if (this.pendingPointerPos) {
            this.processPointerMove(this.pendingPointerPos, this.pendingShiftKey);
          }
        });
      }
    });

    const handleMouseUp = (ev?: Event) => {
      // نهاية إيماءة القرص: عند بقاء أقل من إصبعين
      if (this.pinchState) {
        const remaining = (ev as TouchEvent | undefined)?.touches?.length ?? 0;
        if (remaining < 2) {
          this.pinchState = null;
          this.onViewTransformChanged(true);
        }
        return;
      }
      if (this.isPanning) {
        this.isPanning = false;
        this.updateCursor();
        // تصفير إزاحات طبقات الكانفس وإعادة الرسم الدقيق الثابت
        this.backgroundLayer.position({ x: 0, y: 0 });
        this.gridLayer.position({ x: 0, y: 0 });
        this.objectsLayer.position({ x: 0, y: 0 });
        this.interactionLayer.position({ x: 0, y: 0 });
        this.onViewTransformChanged(true);
      }

      // إنهاء خط المعايرة فور رفع زر الفأرة (SketchUp Drag-to-Measure)
      if (this.toolMode === 'calibrate' && this.isCalibrating && this.calibrateStartPoint) {
        const pointer = this.stage.getPointerPosition();
        if (pointer) {
          const worldRaw = this.camera.screenToWorld(pointer);
          const snap = SnapEngine.findSnapPoint(worldRaw, this.model.getObjects(), this.getEffectiveSnapOptions());
          let endPoint = snap.point;
          const polar = SnapEngine.getPolarAngleSnap(
            this.calibrateStartPoint,
            endPoint,
            [0, 45, 90, 135, 180, 225, 270, 315, 360],
            this.isShiftKeyPressed ? 25 : 5.0
          );
          const isObjectSnap = snap.snapped && snap.type !== 'grid';
          if ((!isObjectSnap && polar.isSnapped) || this.isShiftKeyPressed) {
            endPoint = polar.point;
          }
          const dist = SnapEngine.distance(this.calibrateStartPoint, endPoint);
          if (dist > 15) {
            this.finishCalibration(this.calibrateStartPoint, endPoint);
          }
        }
      }

      if (this.isMarqueeSelecting && this.marqueeStartPoint) {
        const pointer = this.stage.getPointerPosition();
        const p1 = this.marqueeStartPoint;
        const p2 = pointer ? this.camera.screenToWorld(pointer) : this.currentSnapResult.point;
        const minX = Math.min(p1.x, p2.x);
        const maxX = Math.max(p1.x, p2.x);
        const minY = Math.min(p1.y, p2.y);
        const maxY = Math.max(p1.y, p2.y);

        this.isMarqueeSelecting = false;
        this.marqueeStartPoint = null;

        if (maxX - minX > 5 || maxY - minY > 5) {
          const box: BoxRect = { minX, minY, maxX, maxY };
          const all = this.model.getObjects();
          const selected = all.filter((obj) => isObjectInBox(obj, box, all));
          if (this.selectionSubMode === 'multi' || this.isShiftKeyPressed) {
            const combined = Array.from(
              new Set([...this.selectedObjectIds, ...selected.map((o) => o.id)])
            );
            this.selectObjects(combined);
          } else {
            this.selectObjects(selected.map((o) => o.id));
          }
        } else {
          if (this.selectionSubMode !== 'multi' && !this.isShiftKeyPressed && !this.wasGroupDragged) {
            this.selectObject(null);
          }
        }
        this.renderInteractionLayer();
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchend', handleMouseUp);
    window.addEventListener('touchcancel', handleMouseUp);
    this.windowMouseUpHandler = handleMouseUp;
  }

export function processPointerMoveImpl(this: CadEngine, pointer: Point, shiftKey: boolean): void {
    const worldRaw = this.camera.screenToWorld(pointer);
    this.currentSnapResult = SnapEngine.findSnapPoint(
      worldRaw,
      this.model.getObjects(),
      this.getEffectiveSnapOptions(),
      this.toolMode === 'select' ? (this.selectedObjectId || undefined) : undefined
    );

    // فحص الالتقاط بالجدار عند تفعيل أداة الباب أو النافذة أو الرمز الهندسي
    const activeSettings = getLastUsedSettings();
    if (this.toolMode === 'door') {
      this.currentWallSnap = SnapEngine.findWallProjection(
        worldRaw,
        this.model.getObjects(),
        45,
        activeSettings.doorWidth || this.defaultDoorWidth
      );
      this.currentSymbolWallSnap = null;
    } else if (this.toolMode === 'window') {
      this.currentWallSnap = SnapEngine.findWallProjection(
        worldRaw,
        this.model.getObjects(),
        45,
        activeSettings.windowWidth || this.defaultWindowWidth
      );
      this.currentSymbolWallSnap = null;
    } else if (this.toolMode === 'symbol') {
      this.currentSymbolWallSnap = SnapEngine.findSymbolWallSnap(
        worldRaw,
        this.model.getObjects(),
        35,
        true
      );
      this.currentWallSnap = null;
    } else {
      this.currentWallSnap = null;
      this.currentSymbolWallSnap = null;
    }

    this.callbacks.onCursorMove(this.currentSnapResult.point, this.currentSnapResult);
    if (this.isDrawingWall && this.wallStartPoint) {
      this.callbacks.onWallDrawingStateChange?.(this.getWallDrawingState());
    }

    const hasActiveTransient =
      (this.isDrawingWall && this.wallStartPoint) ||
      (this.isDrawingDimension && this.dimensionStartPoint) ||
      (this.isMeasuring && this.measureStartPoint) ||
      (this.isCalibrating && this.calibrateStartPoint) ||
      (this.toolMode === 'area' && this.areaPoints.length > 0) ||
      this.toolMode === 'route' ||
      (this.isMarqueeSelecting && this.marqueeStartPoint) ||
      this.toolMode === 'door' ||
      this.toolMode === 'window' ||
      this.toolMode === 'symbol';

    if (hasActiveTransient) {
      this.renderInteractionLayer(shiftKey);
    } else {
      this.renderSnapIndicatorOnly();
    }
  }
