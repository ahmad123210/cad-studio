/**
 * @file keyboard.ts
 * @description اختصارات لوحة المفاتيح الخاصة بالمحرك
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

export function handleKeyDownImpl(this: CadEngine, e: KeyboardEvent): void {
    if (e.key === 'Shift') {
      this.isShiftKeyPressed = true;
    }
    // حماية حقول الإدخال النصية والتسميات التوضيحية
    const activeTag = document.activeElement?.tagName.toLowerCase();
    if (
      activeTag === 'input' ||
      activeTag === 'textarea' ||
      (document.activeElement as HTMLElement)?.isContentEditable
    ) {
      return;
    }

    // ملاحظة: Ctrl+A و Delete/Backspace تُعالَج في App.tsx فقط (أُزيل الازدواج من هنا)
    if ((e.ctrlKey || e.metaKey) && (e.code === 'KeyA' || e.key.toLowerCase() === 'a' || e.key === 'ش')) {
      return;
    }

    const code = e.code;
    const key = e.key.toLowerCase();
    const isCtrlOrMeta = e.ctrlKey || e.metaKey;
    const hasModifier = isCtrlOrMeta || e.altKey;

    if (code === 'Space' && !this.isSpacePressed) {
      this.isSpacePressed = true;
      this.updateCursor();
    } else if (code === 'Escape') {
      this.cancelDrawing();
      this.deselectAll();
      this.setToolMode('select');
      this.setSelectionSubMode('single');
    } else if (!hasModifier && (code === 'KeyV' || key === 'v' || code === 'Digit1' || key === '1' || key === 'ر')) {
      // أداة التحديد القياسي: إذا كان التحديد مفعلاً، الضغط المتكرر على V يتنقل بين أنماط التحديد
      if (this.toolMode !== 'select') {
        this.setToolMode('select');
        this.setSelectionSubMode('single');
      } else if (code === 'Digit1' || key === '1') {
        this.setSelectionSubMode('single');
      } else {
        const nextSub = this.selectionSubMode === 'single' ? 'box' : this.selectionSubMode === 'box' ? 'multi' : 'single';
        this.setSelectionSubMode(nextSub);
      }
    } else if (!hasModifier && (code === 'KeyB' || key === 'b' || code === 'Digit2' || key === '2' || key === 'لا')) {
      // أداة التحديد بمربع الإحاطة (Box Selection)
      this.setToolMode('select');
      this.setSelectionSubMode('box');
    } else if (!hasModifier && (code === 'KeyQ' || key === 'q' || code === 'Digit3' || key === '3' || key === 'ض')) {
      // أداة التحديد المتعدد التراكمي (Multi Selection)
      this.setToolMode('select');
      this.setSelectionSubMode('multi');
    } else if (!hasModifier && (code === 'KeyW' || key === 'w' || code === 'Digit4' || key === '4' || key === 'ص')) {
      // أداة رسم الجدران (Wall Tool)
      this.setToolMode('wall');
    } else if (!hasModifier && (code === 'KeyD' || key === 'd' || code === 'Digit5' || key === '5' || key === 'ي')) {
      // أداة إدراج الأبواب (Door Tool)
      this.setToolMode('door');
    } else if (!hasModifier && (code === 'KeyN' || key === 'n' || code === 'Digit6' || key === '6' || key === 'ى')) {
      // أداة إدراج النوافذ (Window Tool)
      this.setToolMode('window');
    } else if (!hasModifier && (code === 'KeyM' || key === 'm' || code === 'Digit7' || key === '7' || key === 'ة')) {
      // أداة الأبعاد الهندسية (Dimension Tool)
      this.setToolMode('dimension');
    } else if (!hasModifier && (code === 'Digit8' || key === '8')) {
      // أداة شريط القياس السريع (Measure Tape)
      this.setToolMode('measure');
    } else if (!hasModifier && (code === 'KeyR' || key === 'r' || code === 'Digit9' || key === '9' || key === 'ق')) {
      // أداة المسارات الكهروميكانيكية (Route Tool)
      this.setToolMode('route');
    } else if (!hasModifier && (code === 'KeyA' || key === 'a' || code === 'Digit0' || key === '0' || key === 'ش')) {
      // أداة قياس المساحة والمحيط (Area Tool)
      this.setToolMode('area');
    } else if (!hasModifier && (code === 'KeyS' || key === 's' || key === 'س')) {
      // مكتبة الرموز الهندسية (Symbol Tool)
      this.setToolMode('symbol');
    } else if (!hasModifier && (code === 'KeyT' || key === 't' || key === 'ف')) {
      // أداة النصوص التوضيحية (Text Tool)
      this.setToolMode('text');
    } else if (!hasModifier && (code === 'KeyF' || key === 'f' || key === 'ب')) {
      // عكس اتجاه الرمز المحدد بمقدار 180 درجة (Flip Symbol)
      const selected = this.selectedObjectIds
        .map((id) => this.model.getObjectById(id))
        .filter((o): o is NonNullable<typeof o> => o !== null);
      const symbolObj = selected.find((o) => o.type === 'symbol');
      if (symbolObj && symbolObj.type === 'symbol') {
        const newRot = ((symbolObj.rotation + 180) % 360 + 360) % 360;
        this.model.updateObject(symbolObj.id, { rotation: newRot });
        this.render();
      }
    } else if (!hasModifier && (code === 'KeyH' || key === 'h' || key === 'ا')) {
      // أداة التحريك اليدوي (Pan Tool)
      this.setToolMode('pan');
    } else if (e.code === 'Enter') {
      if (this.toolMode === 'route' && this.isDrawingRoute && this.routePoints.length >= 2) {
        this.finishRoute();
      } else if (this.toolMode === 'area' && this.areaPoints.length >= 3) {
        this.closeAreaPolygon();
      }
    }
  }

export function handleKeyUpImpl(this: CadEngine, e: KeyboardEvent): void {
    if (e.key === 'Shift') {
      this.isShiftKeyPressed = false;
    }
    if (e.code === 'Space') {
      this.isSpacePressed = false;
      this.updateCursor();
    }
  }
