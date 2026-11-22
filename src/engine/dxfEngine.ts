/**
 * @file dxfEngine.ts
 * @description محرك تصدير واستيراد ملفات AutoCAD DXF القياسية والمعيارية 100%.
 * يدعم التصدير بصيغة AutoCAD R12 (AC1009) القياسية العالمية الأكثر توافقاً مع جميع نسخ أوتوكاد
 * (من R12 حتى AutoCAD 2026، وبرامج وتطبيقات الهاتف ومتصفحات الويب الرسمية Autodesk Viewer و DWG FastView).
 * كما يدعم التصدير بصيغة AutoCAD 2000+ (AC1015) مع كامل المقابض (Handles)، جداول البلوكات (BLOCK_RECORD)،
 * وقسم الكائنات (OBJECTS) والقواميس الجذرية.
 * يدعم تصدير الجدران بسماكتها، الأبواب وأقواس الفتح، النوافذ، الرموز، والفرش والأجهزة المنزلية الجديدة، والمسارات، والأبعاد.
 * كما يدعم استيراد وقراءة ملفات DXF الخارجية بمختلف أنواع الكيانات (LINES, POLYLINES, ARCS, CIRCLES, TEXT).
 */

import { ProjectModel } from '../model/project.ts';
import {
  ProjectObject,
  WallObject,
  DoorObject,
  WindowObject,
  SymbolObject,
  RouteObject,
  DimensionObject,
  TextObject,
  LineObject,
  RoomObject,
  Layer,
  Point,
} from '../model/types.ts';
import { getSymbolById } from '../symbols/registry.ts';
import { buildRoomGraph, findRoomAt, type RoomGraph } from '../model/rooms.ts';

export interface DxfExportOptions {
  version?: 'R12' | 'AC1015'; // R12 = AC1009 (Universal Compatibility), AC1015 = AutoCAD 2000+
  units?: 'meters' | 'mm' | 'cm'; // default meters
  exportWallsAsDoubleLines?: boolean;
  includeDimensions?: boolean;
  includeSymbols?: boolean;
  includeRoutes?: boolean;
  selectedLayerIds?: string[];
}

// تعريفات القراءة نُقلت إلى dxfImport.ts (قارئ واعٍ بالأقسام والكتل والأقواس)
export type { DxfParseResult } from './dxfImport.ts';
export { parseDxfString, convertDxfToProjectData, aciToHex } from './dxfImport.ts';

/**
 * خريطة أسماء وأكواد طبقات CAD القياسية (AIA / ISO CAD Standards)
 * تضمن عدم وجود فراغات أو أقواس أو رموز غير صالحة تتسبب في رفض أوتوكاد للملف
 */
export const STANDARD_CAD_LAYERS: Record<string, { code: string; defaultAci: number }> = {
  arch: { code: 'A-WALL', defaultAci: 7 }, // أبيض / رمادي
  elec: { code: 'E-POWR', defaultAci: 2 }, // أصفر
  plumb: { code: 'P-SANR', defaultAci: 5 }, // أزرق
  hvac: { code: 'M-HVAC', defaultAci: 3 }, // أخضر
  fire: { code: 'F-PROT', defaultAci: 1 }, // أحمر
  furniture: { code: 'A-FURN', defaultAci: 30 }, // برتقالي / بني للفرش والأجهزة
  custom: { code: 'A-GENR', defaultAci: 4 }, // سماوي
};

/**
 * تنظيف وتأمين اسم الطبقة ليكون اسم معرف صالحاً 100% في AutoCAD
 * (أوتوكاد يمنع الأقواس والفراغات وعلامات الترقيم في أسماء الطبقات)
 */
export function getSafeCadLayerName(layerId: string, layerName?: string): string {
  if (STANDARD_CAD_LAYERS[layerId]) {
    return STANDARD_CAD_LAYERS[layerId].code;
  }
  if (!layerName) {
    return `LAYER_${layerId.replace(/[^\w]/g, '').toUpperCase() || 'DEF'}`;
  }
  // إزالة الأقواس والمسافات وعلامات الترقيم
  const clean = layerName
    .replace(/[\(\)\[\]\{\}\/\\:;,\*\?"'<>|=]/g, '_')
    .replace(/\s+/g, '_')
    .trim();
  const safeAscii = clean.replace(/[^\w-]/g, '');
  if (safeAscii.length >= 2) {
    return safeAscii.toUpperCase();
  }
  return `LAYER_${layerId.replace(/[^\w]/g, '').toUpperCase() || 'CUSTOM'}`;
}

/**
 * تحويل لون Hex إلى رقم لون AutoCAD ACI (AutoCAD Color Index 1-255)
 */
export function hexToAciColor(hex: string): number {
  if (!hex) return 7; // white/black default
  const cleanHex = hex.replace('#', '').toLowerCase();
  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;

  if (r > 200 && g < 80 && b < 80) return 1; // Red
  if (r > 200 && g > 200 && b < 80) return 2; // Yellow
  if (r < 80 && g > 180 && b < 80) return 3; // Green
  if (r < 80 && g > 180 && b > 180) return 4; // Cyan
  if (r < 80 && g < 80 && b > 200) return 5; // Blue
  if (r > 180 && g < 80 && b > 180) return 6; // Magenta
  if (r > 220 && g > 120 && b < 50) return 30; // Orange
  if (r < 60 && g < 60 && b < 60) return 8; // Dark Gray
  if (r > 180 && g > 180 && b > 180) return 9; // Light Gray
  if (r > 100 && g < 80 && b > 180) return 160; // Violet/Indigo

  return 7;
}

/**
 * تصدير مشروع المخطط بالكامل إلى نص DXF قياسي متوافق 100% مع أوتوكاد
 */
export function exportProjectToDxf(
  model: ProjectModel,
  options: DxfExportOptions = {}
): string {
  const version = options.version || 'R12';
  const meta = model.getMeta();
  const layers = model.getLayers();
  const objects = model.getObjects();
  const pixelsPerMeter = meta.scale || 50; // افتراضياً 50px = 1 متر

  const unitFactor =
    options.units === 'mm' ? 1000 : options.units === 'cm' ? 100 : 1.0;

  // تحويل إحداثيات كانفس الويب إلى إحداثيات CAD
  // ملاحظة هندسية دقيقة: محور Y في CAD موجب للأعلى، بينما في الويب موجب للأسفل!
  const toDxfX = (x: number): string => {
    return ((x / pixelsPerMeter) * unitFactor).toFixed(4);
  };
  const toDxfY = (y: number): string => {
    return ((-y / pixelsPerMeter) * unitFactor).toFixed(4);
  };
  const toDxfDist = (d: number): string => {
    return ((d / pixelsPerMeter) * unitFactor).toFixed(4);
  };

  const lines: string[] = [];

  // دالة مساعدة لكتابة زوج (Code, Value) بصيغة قياسية بدون مسافات شاذة
  const pushTag = (code: number, val: string | number): void => {
    lines.push(String(code));
    lines.push(String(val));
  };

  let handleCounter = 0x30;
  const nextHandle = (): string => {
    return (handleCounter++).toString(16).toUpperCase();
  };

  // تصفية الطبقات حسب خيارات التصدير
  const filteredObjects = objects.filter((obj) => {
    if (options.selectedLayerIds && !options.selectedLayerIds.includes(obj.layerId)) {
      return false;
    }
    return true;
  });

  // ماب للطبقات المسجلة
  const usedLayerIds = new Set<string>(['arch', 'elec', 'plumb', 'hvac', 'fire']);
  layers.forEach((l) => usedLayerIds.add(l.id));
  filteredObjects.forEach((o) => {
    if (o.layerId) usedLayerIds.add(o.layerId);
  });

  const getLayerName = (layerId: string): string => {
    const l = layers.find((lay) => lay.id === layerId);
    return getSafeCadLayerName(layerId, l?.name);
  };

  // ==========================================
  // 1. قسم HEADER
  // ==========================================
  pushTag(0, 'SECTION');
  pushTag(2, 'HEADER');

  if (version === 'AC1015') {
    pushTag(9, '$ACADVER');
    pushTag(1, 'AC1015'); // AutoCAD 2000+
    pushTag(9, '$HANDSEED');
    pushTag(5, 'FFFF');
  } else {
    pushTag(9, '$ACADVER');
    pushTag(1, 'AC1009'); // AutoCAD Release 12 (Universal)
  }

  // الترميز اللغوي (عربي / UTF-8)
  pushTag(9, '$DWGCODEPAGE');
  pushTag(3, 'ANSI_1256');

  // وحدات الرسم
  pushTag(9, '$INSUNITS');
  pushTag(70, options.units === 'mm' ? 4 : 6); // 6 = Meters, 4 = Millimeters
  pushTag(9, '$MEASUREMENT');
  pushTag(70, 1); // 1 = Metric
  pushTag(9, '$LUNITS');
  pushTag(70, 2); // 2 = Decimal
  pushTag(9, '$DIMSCALE');
  pushTag(40, 1.0);

  pushTag(0, 'ENDSEC'); // نهاية قسم HEADER

  // ==========================================
  // 1.1 قسم CLASSES (خاص بـ AC1015)
  // ==========================================
  if (version === 'AC1015') {
    pushTag(0, 'SECTION');
    pushTag(2, 'CLASSES');
    pushTag(0, 'ENDSEC');
  }

  // ==========================================
  // 2. قسم TABLES (جداول أوتوكاد المعيارية)
  // ==========================================
  pushTag(0, 'SECTION');
  pushTag(2, 'TABLES');

  // 2.1 جدول منافذ الرؤية VPORT (إلزامي في AutoCAD)
  pushTag(0, 'TABLE');
  pushTag(2, 'VPORT');
  if (version === 'AC1015') {
    pushTag(5, '8');
    pushTag(100, 'AcDbSymbolTable');
  }
  pushTag(70, 1);
  pushTag(0, 'VPORT');
  if (version === 'AC1015') {
    pushTag(5, nextHandle());
    pushTag(100, 'AcDbSymbolTableRecord');
    pushTag(100, 'AcDbViewportTableRecord');
  }
  pushTag(2, '*ACTIVE');
  pushTag(70, 0);
  pushTag(10, 0.0);
  pushTag(20, 0.0);
  pushTag(11, 1.0);
  pushTag(21, 1.0);
  pushTag(12, 0.0);
  pushTag(22, 0.0);
  pushTag(40, 50.0);
  pushTag(41, 1.5);
  pushTag(0, 'ENDTAB');

  // 2.2 جدول التطبيقات APPID (إلزامي في AutoCAD)
  pushTag(0, 'TABLE');
  pushTag(2, 'APPID');
  if (version === 'AC1015') {
    pushTag(5, '9');
    pushTag(100, 'AcDbSymbolTable');
  }
  pushTag(70, 1);
  pushTag(0, 'APPID');
  if (version === 'AC1015') {
    pushTag(5, nextHandle());
    pushTag(100, 'AcDbSymbolTableRecord');
    pushTag(100, 'AcDbRegAppTableRecord');
  }
  pushTag(2, 'ACAD');
  pushTag(70, 0);
  pushTag(0, 'ENDTAB');

  // 2.3 جدول أنماط الخطوط LTYPE
  pushTag(0, 'TABLE');
  pushTag(2, 'LTYPE');
  if (version === 'AC1015') {
    pushTag(5, '5');
    pushTag(100, 'AcDbSymbolTable');
  }
  pushTag(70, 3);

  // خط متصل CONTINUOUS
  pushTag(0, 'LTYPE');
  if (version === 'AC1015') {
    pushTag(5, nextHandle());
    pushTag(100, 'AcDbSymbolTableRecord');
    pushTag(100, 'AcDbLinetypeTableRecord');
  }
  pushTag(2, 'CONTINUOUS');
  pushTag(70, 0);
  pushTag(3, 'Solid line');
  pushTag(72, 65);
  pushTag(73, 0);
  pushTag(40, 0.0);

  // خط متقطع DASHED
  pushTag(0, 'LTYPE');
  if (version === 'AC1015') {
    pushTag(5, nextHandle());
    pushTag(100, 'AcDbSymbolTableRecord');
    pushTag(100, 'AcDbLinetypeTableRecord');
  }
  pushTag(2, 'DASHED');
  pushTag(70, 0);
  pushTag(3, 'Dashed __ __');
  pushTag(72, 65);
  pushTag(73, 2);
  pushTag(40, 0.5);
  pushTag(49, 0.3);
  pushTag(49, -0.2);

  // خط مخفي HIDDEN
  pushTag(0, 'LTYPE');
  if (version === 'AC1015') {
    pushTag(5, nextHandle());
    pushTag(100, 'AcDbSymbolTableRecord');
    pushTag(100, 'AcDbLinetypeTableRecord');
  }
  pushTag(2, 'HIDDEN');
  pushTag(70, 0);
  pushTag(3, 'Hidden _ _ _');
  pushTag(72, 65);
  pushTag(73, 2);
  pushTag(40, 0.25);
  pushTag(49, 0.15);
  pushTag(49, -0.1);
  pushTag(0, 'ENDTAB');

  // 2.4 جدول الطبقات LAYER
  const uniqueSafeLayers = new Map<string, { name: string; aciColor: number; locked: boolean }>();
  // الطبقة الصفرية القياسية
  uniqueSafeLayers.set('0', { name: '0', aciColor: 7, locked: false });

  // إضافة الطبقات القياسية والمستخدمة
  usedLayerIds.forEach((id) => {
    const l = layers.find((lay) => lay.id === id);
    const safeName = getSafeCadLayerName(id, l?.name);
    const aci = l?.color ? hexToAciColor(l.color) : STANDARD_CAD_LAYERS[id]?.defaultAci || 7;
    uniqueSafeLayers.set(safeName, {
      name: safeName,
      aciColor: aci,
      locked: l?.locked || false,
    });
  });

  pushTag(0, 'TABLE');
  pushTag(2, 'LAYER');
  if (version === 'AC1015') {
    pushTag(5, '2');
    pushTag(100, 'AcDbSymbolTable');
  }
  pushTag(70, uniqueSafeLayers.size);

  uniqueSafeLayers.forEach((info) => {
    pushTag(0, 'LAYER');
    if (version === 'AC1015') {
      pushTag(5, nextHandle());
      pushTag(100, 'AcDbSymbolTableRecord');
      pushTag(100, 'AcDbLayerTableRecord');
    }
    pushTag(2, info.name);
    pushTag(70, info.locked ? 4 : 0);
    pushTag(62, info.aciColor);
    pushTag(6, 'CONTINUOUS');
  });
  pushTag(0, 'ENDTAB');

  // 2.5 جدول أنماط النصوص STYLE
  pushTag(0, 'TABLE');
  pushTag(2, 'STYLE');
  if (version === 'AC1015') {
    pushTag(5, '3');
    pushTag(100, 'AcDbSymbolTable');
  }
  pushTag(70, 1);
  pushTag(0, 'STYLE');
  if (version === 'AC1015') {
    pushTag(5, nextHandle());
    pushTag(100, 'AcDbSymbolTableRecord');
    pushTag(100, 'AcDbTextStyleTableRecord');
  }
  pushTag(2, 'STANDARD');
  pushTag(70, 0);
  pushTag(40, 0.0);
  pushTag(41, 1.0);
  pushTag(50, 0.0);
  pushTag(71, 0);
  pushTag(42, 0.2);
  pushTag(3, 'txt');
  pushTag(4, '');
  pushTag(0, 'ENDTAB');

  // 2.6 جدول نمط الأبعاد DIMSTYLE
  pushTag(0, 'TABLE');
  pushTag(2, 'DIMSTYLE');
  if (version === 'AC1015') {
    pushTag(5, 'A');
    pushTag(100, 'AcDbSymbolTable');
  }
  pushTag(70, 1);
  pushTag(0, 'DIMSTYLE');
  if (version === 'AC1015') {
    pushTag(5, nextHandle());
    pushTag(100, 'AcDbSymbolTableRecord');
    pushTag(100, 'AcDbDimStyleTableRecord');
  }
  pushTag(2, 'STANDARD');
  pushTag(70, 0);
  pushTag(0, 'ENDTAB');

  // 2.7 جدول BLOCK_RECORD (خاص وإلزامي لـ AC1015)
  if (version === 'AC1015') {
    pushTag(0, 'TABLE');
    pushTag(2, 'BLOCK_RECORD');
    pushTag(5, '1');
    pushTag(100, 'AcDbSymbolTable');
    pushTag(70, 2);

    pushTag(0, 'BLOCK_RECORD');
    pushTag(5, '1F');
    pushTag(100, 'AcDbSymbolTableRecord');
    pushTag(100, 'AcDbBlockTableRecord');
    pushTag(2, '*MODEL_SPACE');

    pushTag(0, 'BLOCK_RECORD');
    pushTag(5, '1B');
    pushTag(100, 'AcDbSymbolTableRecord');
    pushTag(100, 'AcDbBlockTableRecord');
    pushTag(2, '*PAPER_SPACE');
    pushTag(0, 'ENDTAB');
  }

  pushTag(0, 'ENDSEC'); // نهاية قسم TABLES

  // ==========================================
  // 3. قسم BLOCKS (إلزامي في AutoCAD)
  // ==========================================
  pushTag(0, 'SECTION');
  pushTag(2, 'BLOCKS');

  if (version === 'AC1015') {
    // بلوك *MODEL_SPACE
    pushTag(0, 'BLOCK');
    pushTag(5, '21');
    pushTag(100, 'AcDbEntity');
    pushTag(8, '0');
    pushTag(100, 'AcDbBlockBegin');
    pushTag(2, '*MODEL_SPACE');
    pushTag(70, 0);
    pushTag(10, 0.0);
    pushTag(20, 0.0);
    pushTag(30, 0.0);
    pushTag(3, '*MODEL_SPACE');
    pushTag(1, '');
    pushTag(0, 'ENDBLK');
    pushTag(5, '22');
    pushTag(100, 'AcDbEntity');
    pushTag(8, '0');
    pushTag(100, 'AcDbBlockEnd');

    // بلوك *PAPER_SPACE
    pushTag(0, 'BLOCK');
    pushTag(5, '23');
    pushTag(100, 'AcDbEntity');
    pushTag(8, '0');
    pushTag(100, 'AcDbBlockBegin');
    pushTag(2, '*PAPER_SPACE');
    pushTag(70, 0);
    pushTag(10, 0.0);
    pushTag(20, 0.0);
    pushTag(30, 0.0);
    pushTag(3, '*PAPER_SPACE');
    pushTag(1, '');
    pushTag(0, 'ENDBLK');
    pushTag(5, '24');
    pushTag(100, 'AcDbEntity');
    pushTag(8, '0');
    pushTag(100, 'AcDbBlockEnd');
  }

  pushTag(0, 'ENDSEC'); // نهاية قسم BLOCKS

  // ==========================================
  // 4. قسم الكائنات الهندسية ENTITIES
  // ==========================================
  pushTag(0, 'SECTION');
  pushTag(2, 'ENTITIES');

  // دوال مساعدة لكتابة الكائنات الهندسية القياسية
  const writeLine = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    layerName: string,
    color?: number
  ) => {
    pushTag(0, 'LINE');
    if (version === 'AC1015') {
      pushTag(5, nextHandle());
      pushTag(100, 'AcDbEntity');
      pushTag(8, layerName);
      if (color) pushTag(62, color);
      pushTag(100, 'AcDbLine');
    } else {
      pushTag(8, layerName);
      if (color) pushTag(62, color);
    }
    pushTag(10, toDxfX(x1));
    pushTag(20, toDxfY(y1));
    pushTag(30, '0.0');
    pushTag(11, toDxfX(x2));
    pushTag(21, toDxfY(y2));
    pushTag(31, '0.0');
  };

  const writeCircle = (
    cx: number,
    cy: number,
    radiusMeters: number,
    layerName: string,
    color?: number
  ) => {
    pushTag(0, 'CIRCLE');
    if (version === 'AC1015') {
      pushTag(5, nextHandle());
      pushTag(100, 'AcDbEntity');
      pushTag(8, layerName);
      if (color) pushTag(62, color);
      pushTag(100, 'AcDbCircle');
    } else {
      pushTag(8, layerName);
      if (color) pushTag(62, color);
    }
    pushTag(10, toDxfX(cx));
    pushTag(20, toDxfY(cy));
    pushTag(30, '0.0');
    pushTag(40, radiusMeters.toFixed(4));
  };

  const writeArc = (
    cx: number,
    cy: number,
    radiusMeters: number,
    startDeg: number,
    endDeg: number,
    layerName: string,
    color?: number
  ) => {
    pushTag(0, 'ARC');
    if (version === 'AC1015') {
      pushTag(5, nextHandle());
      pushTag(100, 'AcDbEntity');
      pushTag(8, layerName);
      if (color) pushTag(62, color);
      pushTag(100, 'AcDbCircle');
      pushTag(100, 'AcDbArc');
    } else {
      pushTag(8, layerName);
      if (color) pushTag(62, color);
    }
    pushTag(10, toDxfX(cx));
    pushTag(20, toDxfY(cy));
    pushTag(30, '0.0');
    pushTag(40, radiusMeters.toFixed(4));
    pushTag(50, startDeg.toFixed(2));
    pushTag(51, endDeg.toFixed(2));
  };

  const writeText = (
    x: number,
    y: number,
    text: string,
    heightMeters: number,
    layerName: string,
    rotationDeg = 0,
    alignCenter = false,
    color?: number
  ) => {
    // تنظيف النص من أسطر جديدة لمنع تدمير بنية DXF
    const safeText = (text || '')
      .replace(/[\r\n\t]+/g, ' ')
      .trim();
    if (!safeText) return;

    pushTag(0, 'TEXT');
    if (version === 'AC1015') {
      pushTag(5, nextHandle());
      pushTag(100, 'AcDbEntity');
      pushTag(8, layerName);
      if (color) pushTag(62, color);
      pushTag(100, 'AcDbText');
    } else {
      pushTag(8, layerName);
      if (color) pushTag(62, color);
    }
    pushTag(10, toDxfX(x));
    pushTag(20, toDxfY(y));
    pushTag(30, '0.0');
    pushTag(40, heightMeters.toFixed(4));
    pushTag(1, safeText);

    if (rotationDeg !== 0) {
      pushTag(50, rotationDeg.toFixed(2));
    }
    if (alignCenter) {
      pushTag(72, 1); // محاذاة أفقية وسط
      pushTag(11, toDxfX(x));
      pushTag(21, toDxfY(y));
      pushTag(31, '0.0');
    }
  };

  const writePolyline = (
    points: Point[],
    closed: boolean,
    layerName: string,
    color?: number
  ) => {
    if (!points || points.length < 2) return;

    if (version === 'AC1015') {
      // LWPOLYLINE مدعومة ومعتمدة في AC1015
      pushTag(0, 'LWPOLYLINE');
      pushTag(5, nextHandle());
      pushTag(100, 'AcDbEntity');
      pushTag(8, layerName);
      if (color) pushTag(62, color);
      pushTag(100, 'AcDbPolyline');
      pushTag(90, points.length);
      pushTag(70, closed ? 1 : 0);
      for (const pt of points) {
        pushTag(10, toDxfX(pt.x));
        pushTag(20, toDxfY(pt.y));
      }
    } else {
      // في AutoCAD R12 (AC1009): نكتب POLYLINE مع كتل VERTEX و SEQEND
      pushTag(0, 'POLYLINE');
      pushTag(8, layerName);
      if (color) pushTag(62, color);
      pushTag(66, 1); // 1 = يتبعه عناصر VERTEX
      pushTag(70, closed ? 1 : 0);
      pushTag(10, '0.0');
      pushTag(20, '0.0');
      pushTag(30, '0.0');

      for (const pt of points) {
        pushTag(0, 'VERTEX');
        pushTag(8, layerName);
        pushTag(10, toDxfX(pt.x));
        pushTag(20, toDxfY(pt.y));
        pushTag(30, '0.0');
      }

      pushTag(0, 'SEQEND');
      pushTag(8, layerName);
    }
  };

  // تفريغ جميع الكائنات داخل قسم ENTITIES
  let roomGraph: RoomGraph | null = null; // يُحسب عند أول بطاقة غرفة فقط (من كل الجدران، حتى المخفية بالفلتر)
  for (const obj of filteredObjects) {
    const layerName = getLayerName(obj.layerId);

    // ================= 1. الجدران (Walls) =================
    if (obj.type === 'wall') {
      const wall = obj as WallObject;
      const x1 = wall.start.x;
      const y1 = wall.start.y;
      const x2 = wall.end.x;
      const y2 = wall.end.y;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy);

      if (len > 0.001) {
        if (options.exportWallsAsDoubleLines !== false) {
          // تصدير الجدار كخطين متوازيين مع إغلاق الأطراف (Real Double Lines)
          const halfThick = (wall.thickness || 20) / 2;
          const nx = (-dy / len) * halfThick;
          const ny = (dx / len) * halfThick;

          // وجه الجدار الأول
          writeLine(x1 + nx, y1 + ny, x2 + nx, y2 + ny, layerName);
          // وجه الجدار المقابل
          writeLine(x1 - nx, y1 - ny, x2 - nx, y2 - ny, layerName);
          // غطاء طرف البداية
          writeLine(x1 + nx, y1 + ny, x1 - nx, y1 - ny, layerName);
          // غطاء طرف النهاية
          writeLine(x2 + nx, y2 + ny, x2 - nx, y2 - ny, layerName);
        } else {
          // خط محور الجدار الأساسي (Centerline)
          writeLine(x1, y1, x2, y2, layerName);
        }
      }
    }

    // ================= 2. الأبواب (Doors) =================
    else if (obj.type === 'door') {
      const door = obj as DoorObject;
      const hostWall = objects.find((o) => o.id === door.wallId) as WallObject | undefined;
      if (hostWall) {
        const hdx = hostWall.end.x - hostWall.start.x;
        const hdy = hostWall.end.y - hostWall.start.y;
        const wLen = Math.hypot(hdx, hdy);

        if (wLen > 0) {
          const wx = hostWall.start.x + hdx * door.position;
          const wy = hostWall.start.y + hdy * door.position;
          const doorWidthMeters = (door.width / pixelsPerMeter) * unitFactor;

          // زاوية الجدار
          const wallAngleRad = Math.atan2(hdy, hdx);
          // زاوية درفة الباب المفتوحة 90 درجة
          const isRight = door.openDirection ? door.openDirection.includes('right') : true;
          const leafAngleRad = wallAngleRad + (isRight ? Math.PI / 2 : -Math.PI / 2);
          const ex = wx + Math.cos(leafAngleRad) * door.width;
          const ey = wy + Math.sin(leafAngleRad) * door.width;

          // درفة الباب
          writeLine(wx, wy, ex, ey, layerName);

          // زاوية البداية والنهاية لقوس فتحة الباب في إحداثيات CAD المعكوسة رأسياً
          // في CAD زاوية المتجه هي -angleRad بالدرجات
          const wallCadDeg = (((-wallAngleRad * 180) / Math.PI) % 360 + 360) % 360;
          const leafCadDeg = (((-leafAngleRad * 180) / Math.PI) % 360 + 360) % 360;

          const startDeg = Math.min(wallCadDeg, leafCadDeg);
          const endDeg = Math.max(wallCadDeg, leafCadDeg);

          writeArc(wx, wy, doorWidthMeters, startDeg, endDeg, layerName);
        }
      }
    }

    // ================= 3. النوافذ (Windows) =================
    else if (obj.type === 'window') {
      const win = obj as WindowObject;
      const hostWall = objects.find((o) => o.id === win.wallId) as WallObject | undefined;
      if (hostWall) {
        const hdx = hostWall.end.x - hostWall.start.x;
        const hdy = hostWall.end.y - hostWall.start.y;
        const wLen = Math.hypot(hdx, hdy);

        if (wLen > 0) {
          const ux = hdx / wLen;
          const uy = hdy / wLen;
          const wx = hostWall.start.x + hdx * win.position;
          const wy = hostWall.start.y + hdy * win.position;
          const halfW = win.width / 2;
          const x1 = wx - ux * halfW;
          const y1 = wy - uy * halfW;
          const x2 = wx + ux * halfW;
          const y2 = wy + uy * halfW;

          const wallThick = hostWall.thickness || 20;
          const nx = (-uy) * (wallThick / 2);
          const ny = (ux) * (wallThick / 2);

          // الإطار الخارجي والداخلي للنافذة ولوح الزجاج الأوسط
          writeLine(x1 + nx, y1 + ny, x2 + nx, y2 + ny, layerName);
          writeLine(x1 - nx, y1 - ny, x2 - nx, y2 - ny, layerName);
          writeLine(x1, y1, x2, y2, layerName, 4); // لون زجاج سماوي
          // أغطية جانبي النافذة
          writeLine(x1 + nx, y1 + ny, x1 - nx, y1 - ny, layerName);
          writeLine(x2 + nx, y2 + ny, x2 - nx, y2 - ny, layerName);
        }
      }
    }

    // ================= 3.5 الخطوط الحرة (Linework / خطوط DXF المستوردة) =================
    else if (obj.type === 'line') {
      const ln = obj as LineObject;
      if (ln.points && ln.points.length >= 2) writePolyline(ln.points, Boolean(ln.closed), layerName);
    }

    // ================= 4. المسارات والكابلات (Routes) =================
    else if (obj.type === 'route' && options.includeRoutes !== false) {
      const route = obj as RouteObject;
      if (route.points && route.points.length >= 2) {
        // كتابة البولاي لاين للمسار
        writePolyline(route.points, false, layerName);

        // كتابة وسم التوصيف إذا وجد
        if (route.label) {
          const midPt = route.points[Math.floor(route.points.length / 2)];
          writeText(midPt.x, midPt.y + 10, route.label, 0.2, layerName, 0, true);
        }
      }
    }

    // ================= 5. الرموز والفرش المعماري والأجهزة (Symbols & Furniture) =================
    else if (obj.type === 'symbol' && options.includeSymbols !== false) {
      const sym = obj as SymbolObject;
      const def = getSymbolById(sym.symbolKind);
      const isFurniture = def?.category === 'furniture';
      const w = (def?.defaultWidth || 30) * (sym.scale || 1);
      const h = (def?.defaultHeight || def?.defaultWidth || 30) * (sym.scale || 1);
      const rotRad = ((sym.rotation || 0) * Math.PI) / 180;
      const cosR = Math.cos(rotRad);
      const sinR = Math.sin(rotRad);

      const radMeters = ((Math.max(w, h) / 2) / pixelsPerMeter) * unitFactor;

      if (isFurniture || (w > 0 && h > 0 && def?.defaultHeight !== undefined)) {
        // رسم مستطيل حدود الفرش / الجهاز وفق زاويته الهندسية الحقيقية (2D Footprint)
        const hw = w / 2;
        const hh = h / 2;

        const corners: Point[] = [
          { x: sym.x + (-hw * cosR - -hh * sinR), y: sym.y + (-hw * sinR + -hh * cosR) },
          { x: sym.x + (hw * cosR - -hh * sinR), y: sym.y + (hw * sinR + -hh * cosR) },
          { x: sym.x + (hw * cosR - hh * sinR), y: sym.y + (hw * sinR + hh * cosR) },
          { x: sym.x + (-hw * cosR - hh * sinR), y: sym.y + (-hw * sinR + hh * cosR) },
        ];

        // 4 خطوط تحدد هيكل قطعة الفرش
        writeLine(corners[0].x, corners[0].y, corners[1].x, corners[1].y, layerName);
        writeLine(corners[1].x, corners[1].y, corners[2].x, corners[2].y, layerName);
        writeLine(corners[2].x, corners[2].y, corners[3].x, corners[3].y, layerName);
        writeLine(corners[3].x, corners[3].y, corners[0].x, corners[0].y, layerName);

        // خط وسطي للتفريق بين الأجهزة أو وسائد السرير
        if (sym.symbolKind.includes('bed') || sym.symbolKind.includes('fridge')) {
          const splitRatio = 0.25;
          const p1 = {
            x: corners[0].x + (corners[3].x - corners[0].x) * splitRatio,
            y: corners[0].y + (corners[3].y - corners[0].y) * splitRatio,
          };
          const p2 = {
            x: corners[1].x + (corners[2].x - corners[1].x) * splitRatio,
            y: corners[1].y + (corners[2].y - corners[1].y) * splitRatio,
          };
          writeLine(p1.x, p1.y, p2.x, p2.y, layerName);
        }

        // كتابة كود الرمز التعريفي في وسط القطعة
        const labelText = sym.label || def?.nameEn?.replace(/[^a-zA-Z0-9_-]/g, '') || sym.symbolKind;
        const textH = Math.max(0.12, radMeters * 0.35);
        writeText(sym.x, sym.y, labelText, textH, layerName, -((sym.rotation || 0) % 360), true);
      } else {
        // الرموز الكهربائية والميكانيكية (دائرة كلاسيكية مع التسمية)
        writeCircle(sym.x, sym.y, radMeters, layerName);

        const labelText = sym.label || def?.nameEn?.replace(/[^a-zA-Z0-9_-]/g, '') || sym.symbolKind;
        const textH = Math.max(0.12, radMeters * 0.6);
        writeText(sym.x, sym.y, labelText, textH, layerName, 0, true);
      }
    }

    // ================= 6. الأبعاد الهندسية (Dimensions) =================
    else if (obj.type === 'dimension' && options.includeDimensions !== false) {
      const dim = obj as DimensionObject;
      const p1 = dim.start;
      const p2 = dim.end;
      const realLenMeters = (dim.measuredLength / pixelsPerMeter).toFixed(2) + 'm';

      // خط البعد الأساسي
      writeLine(p1.x, p1.y, p2.x, p2.y, layerName);

      // خطوط الامتداد عند الطرفين (Ticks)
      const ddx = p2.x - p1.x;
      const ddy = p2.y - p1.y;
      const dlen = Math.hypot(ddx, ddy);
      if (dlen > 0) {
        const tickSize = 10;
        const tx = (-ddy / dlen) * tickSize;
        const ty = (ddx / dlen) * tickSize;
        writeLine(p1.x - tx, p1.y - ty, p1.x + tx, p1.y + ty, layerName);
        writeLine(p2.x - tx, p2.y - ty, p2.x + tx, p2.y + ty, layerName);
      }

      // كتابة قيمة البعد في المنتصف
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const dimText = dim.displayText || realLenMeters;
      writeText(midX, midY, dimText, 0.22, layerName, 0, true);
    }

    // ================= 7.5 بطاقات الغرف: الاسم والمساحة الصافية كنصّين متمركزين =================
    else if (obj.type === 'room') {
      const room = obj as RoomObject;
      if (!roomGraph) roomGraph = buildRoomGraph(objects.filter((o) => o.type === 'wall') as WallObject[]);
      const face = findRoomAt(roomGraph, { x: room.x, y: room.y });
      writeText(room.x, room.y, room.name || 'غرفة', 0.2, layerName, 0, true);
      if (face) {
        const m2 = (face.netArea / (pixelsPerMeter * pixelsPerMeter)).toFixed(2);
        writeText(room.x, room.y + 0.3 * pixelsPerMeter, `${m2} m2`, 0.15, layerName, 0, true);
      }
    }

    // ================= 7. الملاحظات والنصوص (Text Annotations) =================
    else if (obj.type === 'text') {
      const txt = obj as TextObject;
      const textHeight = Math.max(0.15, (txt.fontSize || 16) / pixelsPerMeter);
      const aciColor = hexToAciColor(txt.color || '#38bdf8');
      writeText(
        txt.x,
        txt.y,
        txt.text || 'ملاحظة',
        textHeight,
        layerName,
        txt.rotation || 0,
        false,
        aciColor
      );
    }
  }

  pushTag(0, 'ENDSEC'); // نهاية قسم ENTITIES

  // ==========================================
  // 5. قسم OBJECTS (خاص وإلزامي لـ AC1015)
  // ==========================================
  if (version === 'AC1015') {
    pushTag(0, 'SECTION');
    pushTag(2, 'OBJECTS');
    // القاموس الجذري Root Dictionary
    pushTag(0, 'DICTIONARY');
    pushTag(5, 'C');
    pushTag(100, 'AcDbDictionary');
    pushTag(281, 1);
    pushTag(3, 'ACAD_GROUP');
    pushTag(350, 'D');

    // قاموس المجموعات ACAD_GROUP
    pushTag(0, 'DICTIONARY');
    pushTag(5, 'D');
    pushTag(100, 'AcDbDictionary');
    pushTag(281, 1);

    pushTag(0, 'ENDSEC');
  }

  // ==========================================
  // 6. نهاية الملف EOF
  // ==========================================
  pushTag(0, 'EOF');

  // استخدام نهايات الأسطر القياسية لنظام ويندوز CRLF لضمان فتح الملف في كافة إصدارات AutoCAD
  return lines.join('\r\n') + '\r\n';
}

/**
 * تنزيل ملف DXF مباشرة في متصفح المستخدم
 */
export function downloadDxfFile(model: ProjectModel, options: DxfExportOptions = {}): void {
  const dxfContent = exportProjectToDxf(model, options);
  const blob = new Blob([dxfContent], { type: 'application/dxf;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = (model.getMeta().name || 'engineering_project')
    .replace(/\s+/g, '_')
    .replace(/[^\w\u0621-\u064A_-]/gi, '');
  link.href = url;
  link.download = `${safeName || 'project'}.dxf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

