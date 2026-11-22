/**
 * @file schema.ts
 * @description إصدار صيغة ملف المشروع، والترحيل من الإصدارات القديمة، والتحقق من صحة البيانات عند الفتح والاستيراد.
 *
 * الإصدارات:
 *  - 1 (أو بلا رقم): ملفات ما قبل نوفمبر 2026 (قد تحتوي wall.rotation، وقد تفتقد sheets)
 *  - 2: الحالي — schemaVersion إلزامي، لوحات بمقياسها، عنصر الخطوط الحرة 'line'
 *
 * المبدأ: لا نرفض الملف بسبب عنصر تالف؛ نصلحه إن أمكن أو نتجاهله، ونعيد قائمة تحذيرات مفهومة للمستخدم.
 */

import { sanitizeQuantitySettings } from './quantitySettings.ts';
import type { ProjectData, ProjectObject, ProjectSheet, Layer, Point, UnitType } from './types.ts';

export const CURRENT_SCHEMA_VERSION = 2;

export interface MigrationReport {
  fromVersion: number;
  warnings: string[];
}

const OBJECT_TYPES = new Set(['wall', 'door', 'window', 'dimension', 'symbol', 'route', 'text', 'line', 'room', 'column', 'stairs']);
const UNITS: UnitType[] = ['meter', 'cm', 'mm'];

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPt = (p: unknown): p is Point => !!p && typeof p === 'object' && isNum((p as Point).x) && isNum((p as Point).y);

function sanitizeObjects(
  list: unknown,
  layerIds: Set<string>,
  fallbackLayer: string,
  counters: Record<string, number>
): ProjectObject[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: ProjectObject[] = [];
  const bump = (k: string) => (counters[k] = (counters[k] || 0) + 1);

  for (const raw of list) {
    if (!raw || typeof raw !== 'object') {
      bump('invalid');
      continue;
    }
    const o = { ...(raw as Record<string, unknown>) };
    if (typeof o.type !== 'string' || !OBJECT_TYPES.has(o.type)) {
      bump('unknownType');
      continue;
    }
    if (typeof o.id !== 'string' || !o.id) {
      o.id = `${o.type}_${Math.random().toString(36).substring(2, 9)}`;
      bump('fixedId');
    }
    if (seen.has(o.id as string)) {
      o.id = `${o.type}_${Math.random().toString(36).substring(2, 9)}`;
      bump('duplicateId');
    }
    if (typeof o.layerId !== 'string' || !layerIds.has(o.layerId)) {
      o.layerId = fallbackLayer;
      bump('fixedLayer');
    }
    let ok = true;
    switch (o.type) {
      case 'wall':
        ok = isPt(o.start) && isPt(o.end);
        if (!isNum(o.thickness) || (o.thickness as number) <= 0) o.thickness = 20;
        delete o.rotation; // حقل قديم غير مستخدم (أُزيل في الإصدار 2)
        if (o.height !== undefined && (!isNum(o.height) || (o.height as number) <= 0)) delete o.height;
        if (o.wallKind !== undefined && o.wallKind !== 'fence' && o.wallKind !== 'building') delete o.wallKind;
        break;
      case 'dimension':
        ok = isPt(o.start) && isPt(o.end);
        if (!isNum(o.measuredLength) && ok) {
          const s = o.start as Point, e = o.end as Point;
          o.measuredLength = Math.hypot(e.x - s.x, e.y - s.y);
        }
        break;
      case 'door':
      case 'window':
        ok = typeof o.wallId === 'string' && isNum(o.width) && (o.width as number) > 0;
        o.position = isNum(o.position) ? Math.min(1, Math.max(0, o.position as number)) : 0.5;
        if (o.type === 'door' && typeof o.openDirection !== 'string') o.openDirection = 'inward_right';
        break;
      case 'symbol':
        ok = isNum(o.x) && isNum(o.y) && typeof o.symbolKind === 'string';
        if (!isNum(o.rotation)) o.rotation = 0;
        break;
      case 'text':
        ok = isNum(o.x) && isNum(o.y);
        if (typeof o.text !== 'string') o.text = String(o.text ?? '');
        if (!isNum(o.fontSize) || (o.fontSize as number) <= 0) o.fontSize = 16;
        if (!isNum(o.rotation)) o.rotation = 0;
        if (typeof o.color !== 'string') o.color = '#38bdf8';
        break;
      case 'route':
        ok = Array.isArray(o.points) && (o.points as unknown[]).every(isPt) && (o.points as unknown[]).length >= 1;
        if (!isNum(o.lengthCalculated)) o.lengthCalculated = 0;
        if (typeof o.routeKind !== 'string') o.routeKind = 'electrical';
        break;
      case 'column':
        ok = isNum(o.x) && isNum(o.y);
        if (!isNum(o.width) || (o.width as number) <= 0) o.width = 15;
        if (!isNum(o.depth) || (o.depth as number) <= 0) o.depth = o.width;
        if (!isNum(o.rotation)) o.rotation = 0;
        break;
      case 'stairs':
        ok = isPt(o.start) && isPt(o.end);
        if (!isNum(o.width) || (o.width as number) <= 0) o.width = 60;
        break;
      case 'room':
        ok = isNum(o.x) && isNum(o.y);
        if (typeof o.name !== 'string') o.name = String(o.name ?? 'غرفة');
        break;
      case 'line':
        ok = Array.isArray(o.points) && (o.points as unknown[]).every(isPt) && (o.points as unknown[]).length >= 2;
        break;
    }
    if (!ok) {
      bump('badGeometry');
      continue;
    }
    seen.add(o.id as string);
    out.push(o as unknown as ProjectObject);
  }

  // أبواب ونوافذ يتيمة (جدارها غير موجود) — لا تُرسم وتُفسد جدول الكميات
  const wallIds = new Set(out.filter((o) => o.type === 'wall').map((o) => o.id));
  const cleaned = out.filter((o) => {
    if ((o.type === 'door' || o.type === 'window') && !wallIds.has((o as { wallId: string }).wallId)) {
      bump('orphanOpening');
      return false;
    }
    return true;
  });
  return cleaned;
}

/**
 * ترحيل وتحقق: يقبل بيانات خام (من ملف JSON أو التخزين) ويعيد مشروعاً سليماً بالإصدار الحالي.
 * يرمي خطأً فقط إذا لم يكن الملف مشروعاً أصلاً.
 */
export function migrateProjectData(raw: unknown, defaultLayers: Layer[]): { data: ProjectData; report: MigrationReport } {
  if (!raw || typeof raw !== 'object' || !(raw as ProjectData).project || typeof (raw as ProjectData).project !== 'object') {
    throw new Error('صيغة مشروع غير صالحة: لا يحتوي الملف على بيانات المشروع (project)');
  }
  const src = raw as ProjectData & { schemaVersion?: number };
  const fromVersion = isNum(src.schemaVersion) ? src.schemaVersion : 1;
  if (fromVersion > CURRENT_SCHEMA_VERSION) {
    // ملف من إصدار أحدث: نحاول فتحه بأفضل ما يمكن مع تنبيه
  }
  const warnings: string[] = [];
  const counters: Record<string, number> = {};

  const p = src.project as unknown as Record<string, unknown>;
  const project = {
    name: typeof p.name === 'string' && p.name.trim() ? p.name : 'مشروع',
    unit: UNITS.includes(p.unit as UnitType) ? (p.unit as UnitType) : 'meter',
    scale: isNum(p.scale) && (p.scale as number) > 0 ? (p.scale as number) : 50,
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString().split('T')[0],
  };

  // الطبقات
  let layers: Layer[] = Array.isArray(src.layers)
    ? (src.layers as unknown[]).filter((l): l is Layer => !!l && typeof l === 'object' && typeof (l as Layer).id === 'string')
    : [];
  const layerSeen = new Set<string>();
  layers = layers
    .filter((l) => (layerSeen.has(l.id) ? false : (layerSeen.add(l.id), true)))
    .map((l) => ({
      ...l,
      name: typeof l.name === 'string' ? l.name : l.id,
      visible: l.visible !== false,
      locked: Boolean(l.locked),
      color: typeof l.color === 'string' ? l.color : '#94a3b8',
    }));
  if (layers.length === 0) {
    layers = JSON.parse(JSON.stringify(defaultLayers));
    warnings.push('لم تُعثر على طبقات صالحة؛ استُخدمت الطبقات الافتراضية.');
  }
  const layerIds = new Set(layers.map((l) => l.id));
  const fallbackLayer = layerIds.has('arch') ? 'arch' : layers[0].id;

  // اللوحات والعناصر
  let sheets: ProjectSheet[] = [];
  if (Array.isArray(src.sheets) && src.sheets.length > 0) {
    const sheetSeen = new Set<string>();
    sheets = (src.sheets as ProjectSheet[])
      .filter((s) => s && typeof s === 'object')
      .map((s, idx) => {
        let id = typeof s.id === 'string' && s.id ? s.id : `sheet_${idx + 1}`;
        if (sheetSeen.has(id)) id = `${id}_${idx}`;
        sheetSeen.add(id);
        return {
          id,
          name: typeof s.name === 'string' && s.name ? s.name : `لوحة ${idx + 1}`,
          objects: sanitizeObjects(s.objects, layerIds, fallbackLayer, counters),
          backgroundImage: s.backgroundImage ?? null,
          scale: isNum(s.scale) && (s.scale as number) > 0 ? s.scale : undefined,
          createdAt: s.createdAt,
        };
      });
  }
  const objects = sanitizeObjects(src.objects, layerIds, fallbackLayer, counters);
  if (sheets.length === 0) {
    sheets = [
      {
        id: 'sheet_1',
        name: 'لوحة 1 - المخطط العام',
        objects,
        backgroundImage: src.backgroundImage ?? null,
        scale: project.scale,
        createdAt: project.createdAt,
      },
    ];
  }
  const activeSheetId = sheets.some((s) => s.id === src.activeSheetId) ? (src.activeSheetId as string) : sheets[0].id;

  const labels: Record<string, string> = {
    invalid: 'عناصر غير صالحة أُهملت',
    unknownType: 'عناصر من نوع غير معروف أُهملت',
    badGeometry: 'عناصر بإحداثيات تالفة أُهملت',
    orphanOpening: 'أبواب/نوافذ بلا جدار أُزيلت',
    duplicateId: 'معرّفات مكررة أُعيد توليدها',
    fixedId: 'عناصر بلا معرّف أُعطيت معرّفاً',
    fixedLayer: 'عناصر بطبقة غير موجودة نُقلت للطبقة الافتراضية',
  };
  for (const [k, v] of Object.entries(counters)) {
    // عند وجود لوحات تتكرر نسخة اللوحة النشطة في objects؛ الأعداد تقريبية لكنها توضح المشكلة
    warnings.push(`${labels[k] || k}: ${v}`);
  }
  if (fromVersion > CURRENT_SCHEMA_VERSION) {
    warnings.unshift(`الملف من إصدار أحدث (${fromVersion}) من البرنامج (${CURRENT_SCHEMA_VERSION}); قد لا تظهر بعض الميزات.`);
  }

  const data: ProjectData = {
    project,
    layers,
    objects,
    backgroundImage: src.backgroundImage ?? null,
    sheets,
    activeSheetId,
    quantities: sanitizeQuantitySettings(src.quantities),
    printSettings: src.printSettings && typeof src.printSettings === 'object' && !Array.isArray(src.printSettings) ? src.printSettings : {},
    schemaVersion: CURRENT_SCHEMA_VERSION,
  };
  return { data, report: { fromVersion, warnings } };
}
