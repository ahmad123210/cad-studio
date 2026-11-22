/**
 * @file project.ts
 * @description إدارة نموذج بيانات المشروع (Project Model).
 * مسؤول حصراً عن بنية البيانات، الطبقات، العناصر، التعديل والتراجع، وحفظ/استرجاع المشروع.
 * غير مرتبط بأي كود واجهة مستخدم أو مكتبة رسم (Canvas / Konva).
 */

import {
  ProjectData,
  ProjectMeta,
  Layer,
  ProjectObject,
  WallObject,
  DoorObject,
  WindowObject,
  DimensionObject,
  SymbolObject,
  RouteObject,
  TextObject,
  LineObject,
  BatchCommand,
  BackgroundImageData,
  Command,
  Point,
  UpdateObjectCommand,
} from './types.ts';
import { CommandManager } from './history.ts';
import { TransformSpec, transformUpdates } from './transforms.ts';
import type { EditPlan } from './trimExtend.ts';
import { CURRENT_SCHEMA_VERSION, migrateProjectData } from './schema.ts';
import { sanitizeQuantitySettings } from './quantitySettings.ts';
import type { QuantitySettings } from './types.ts';
import { idbSaveProject, idbLoadProject, idbAddBackup, idbListBackups, idbGetBackup, BackupEntry } from './storage.ts';

function getObjectTypeName(type: string): string {
  switch (type) {
    case 'wall':
      return 'جدار';
    case 'door':
      return 'باب';
    case 'window':
      return 'نافذة';
    case 'dimension':
      return 'بُعد قياس';
    case 'symbol':
      return 'رمز هندسي';
    case 'route':
      return 'مسار / كابل';
    case 'text':
      return 'ملاحظة نصية';
    case 'line':
      return 'خط';
    case 'room':
      return 'غرفة';
    default:
      return type;
  }
}

export const DEFAULT_LAYER_IDS = ['arch', 'elec', 'plumb', 'hvac', 'fire'];

export const DEFAULT_LAYERS: Layer[] = [
  { id: 'arch', name: 'المعماري (Architectural)', visible: true, locked: false, color: '#f3f4f6', isDefault: true },
  { id: 'elec', name: 'الكهرباء (Electrical)', visible: true, locked: false, color: '#f59e0b', isDefault: true },
  { id: 'plumb', name: 'السباكة (Plumbing)', visible: true, locked: false, color: '#3b82f6', isDefault: true },
  { id: 'hvac', name: 'التكييف (HVAC)', visible: true, locked: false, color: '#10b981', isDefault: true },
  { id: 'fire', name: 'إطفاء الحريق (Fire Fighting)', visible: true, locked: false, color: '#ef4444', isDefault: true },
];

export const STORAGE_PREFIX = 'cad_project_';
export const CURRENT_PROJECT_KEY = 'cad_active_project_id';

export type ModelChangeListener = (data: ProjectData) => void;

export class ProjectModel {
  private meta: ProjectMeta;
  private layers: Layer[];
  private objects: ProjectObject[];
  private activeLayerId: string;
  private history: CommandManager;
  private listeners: Set<ModelChangeListener> = new Set();
  private projectId: string;
  private backgroundImage: BackgroundImageData | null = null;
  private sheets: import('./types.ts').ProjectSheet[] = [];
  private activeSheetId: string = 'sheet_1';

  constructor(id: string = 'proj_default', name: string = 'فيلا سكنية 01') {
    this.projectId = id;
    this.meta = {
      name,
      unit: 'meter',
      scale: 50, // 50 بكسل = 1 متر افتراضياً
      createdAt: new Date().toISOString().split('T')[0],
    };
    this.layers = JSON.parse(JSON.stringify(DEFAULT_LAYERS));
    this.objects = [];
    this.activeLayerId = 'arch';
    this.history = new CommandManager();
    this.sheets = [
      {
        id: 'sheet_1',
        name: 'لوحة 1 - المخطط العام',
        objects: [],
        backgroundImage: null,
        createdAt: new Date().toISOString().split('T')[0],
      },
    ];
    this.activeSheetId = 'sheet_1';
  }

  public getBackgroundImage(): BackgroundImageData | null {
    return this.backgroundImage;
  }

  public setBackgroundImage(img: BackgroundImageData | null): void {
    this.backgroundImage = img;
    this.notify();
  }

  public updateBackgroundImage(updates: Partial<BackgroundImageData>): void {
    if (this.backgroundImage) {
      this.backgroundImage = { ...this.backgroundImage, ...updates };
      this.notify();
    }
  }

  public getProjectId(): string {
    return this.projectId;
  }

  /** إعدادات الكميات وقائمة الأسعار (على مستوى المشروع) */
  private quantities: QuantitySettings = sanitizeQuantitySettings(undefined);

  public getQuantitySettings(): QuantitySettings {
    return { ...this.quantities, prices: { ...this.quantities.prices } };
  }

  /** تحديث الإعدادات/الأسعار. لا تدخل في سجل التراجع (مثل إعدادات العرض) لكنها تُعلّم المشروع كمعدّل */
  public setQuantitySettings(patch: Partial<QuantitySettings>): void {
    this.quantities = sanitizeQuantitySettings({ ...this.quantities, ...patch });
    this.notify();
  }

  private printSettings: import('./types.ts').PrintSettings = {};

  public getPrintSettings(): import('./types.ts').PrintSettings {
    return JSON.parse(JSON.stringify(this.printSettings));
  }

  /** يحفظ إعدادات الطباعة (لا تدخل في سجل التراجع). لا يُعلِّم المشروع كمعدّل إن لم يتغير شيء */
  public setPrintSettings(next: import('./types.ts').PrintSettings): void {
    if (JSON.stringify(next) === JSON.stringify(this.printSettings)) return;
    this.printSettings = JSON.parse(JSON.stringify(next));
    this.notify();
  }

  public getMeta(): ProjectMeta {
    return { ...this.meta };
  }

  public setMeta(meta: Partial<ProjectMeta>): void {
    this.meta = { ...this.meta, ...meta };
    this.notify();
  }

  public getLayers(): Layer[] {
    return [...this.layers];
  }

  public getActiveLayerId(): string {
    return this.activeLayerId;
  }

  public setActiveLayerId(layerId: string): void {
    const layer = this.layers.find((l) => l.id === layerId);
    if (layer) {
      this.activeLayerId = layerId;
      this.notify();
    }
  }

  public setLayerVisibility(layerId: string, visible: boolean): void {
    const layer = this.layers.find((l) => l.id === layerId);
    if (layer) {
      layer.visible = visible;
      this.notify();
    }
  }

  public setLayerLock(layerId: string, locked: boolean): void {
    const layer = this.layers.find((l) => l.id === layerId);
    if (layer) {
      layer.locked = locked;
      this.notify();
    }
  }

  public setLayerOpacity(layerId: string, opacity: number): void {
    const layer = this.layers.find((l) => l.id === layerId);
    if (layer) {
      layer.opacity = Math.max(0.05, Math.min(1, opacity));
      this.notify();
    }
  }

  public setLayerColor(layerId: string, color: string): void {
    const layer = this.layers.find((l) => l.id === layerId);
    if (layer) {
      layer.color = color;
      this.notify();
    }
  }

  public updateLayer(layerId: string, updates: Partial<Layer>): void {
    const layer = this.layers.find((l) => l.id === layerId);
    if (layer) {
      // قيود: لا يمكن إعادة تسمية الطبقات الافتراضية
      if (updates.name && (layer.isDefault || DEFAULT_LAYER_IDS.includes(layerId))) {
        delete updates.name;
      }
      Object.assign(layer, updates);
      this.notify();
    }
  }

  public addLayer(layerData: {
    id?: string;
    name: string;
    color: string;
    visible?: boolean;
    locked?: boolean;
    opacity?: number;
  }): Layer {
    const id = layerData.id || 'layer_' + Math.random().toString(36).substring(2, 8);
    const newLayer: Layer = {
      id,
      name: layerData.name,
      color: layerData.color,
      visible: layerData.visible ?? true,
      locked: layerData.locked ?? false,
      opacity: layerData.opacity ?? 1,
      isDefault: false,
    };
    this.layers.push(newLayer);
    this.notify();
    return newLayer;
  }

  public deleteLayer(layerId: string): boolean {
    if (this.layers.length <= 1) return false;
    // قيود: لا يمكن حذف الطبقات الافتراضية
    if (DEFAULT_LAYER_IDS.includes(layerId)) {
      return false;
    }
    const index = this.layers.findIndex((l) => l.id === layerId);
    if (index === -1) return false;
    if (this.layers[index].isDefault) {
      return false;
    }

    this.layers.splice(index, 1);
    if (this.activeLayerId === layerId) {
      this.activeLayerId = this.layers[0].id;
    }
    // إعادة تعيين كائنات الطبقة المحذوفة إلى الطبقة النشطة الأولى
    this.objects.forEach((obj) => {
      if (obj.layerId === layerId) {
        obj.layerId = this.activeLayerId;
      }
    });
    this.notify();
    return true;
  }

  public reorderLayers(fromIndex: number, toIndex: number): void {
    if (
      fromIndex < 0 ||
      fromIndex >= this.layers.length ||
      toIndex < 0 ||
      toIndex >= this.layers.length ||
      fromIndex === toIndex
    ) {
      return;
    }
    const [moved] = this.layers.splice(fromIndex, 1);
    this.layers.splice(toIndex, 0, moved);
    this.notify();
  }

  public getObjects(): ProjectObject[] {
    return [...this.objects];
  }

  public getObjectById(id: string): ProjectObject | undefined {
    return this.objects.find((obj) => obj.id === id);
  }

  /**
   * إضافة عنصر جديد إلى المشروع
   */
  public addObject(obj: ProjectObject, recordHistory: boolean = true): void {
    this.objects.push(obj);
    if (recordHistory) {
      this.history.push({
        type: 'add',
        object: JSON.parse(JSON.stringify(obj)),
        timestamp: Date.now(),
        description: `إضافة ${getObjectTypeName(obj.type)}`,
      });
    }
    this.notify();
  }

  /**
   * حذف عنصر من المشروع (مع حذف الأبواب والنوافذ المرتبطة تلقائياً إذا كان جداراً)
   */
  public deleteObject(id: string, recordHistory: boolean = true): ProjectObject | undefined {
    const index = this.objects.findIndex((obj) => obj.id === id);
    if (index === -1) return undefined;

    const removed = this.objects[index];
    // مواضع العناصر الأصلية لاستعادة ترتيب الرسم (z-order) عند التراجع
    const originalOrder = this.objects.map((o) => o.id);
    const originalIndexOf = (oid: string) => originalOrder.indexOf(oid);

    // إذا كان العنصر جداراً، نجد أي أبواب أو نوافذ مرتبطة به
    const attachedObjects = removed.type === 'wall'
      ? this.objects.filter((o) => (o.type === 'door' || o.type === 'window') && (o as DoorObject | WindowObject).wallId === id)
      : [];

    // حذف الأبواب والنوافذ التابعة
    if (attachedObjects.length > 0) {
      this.objects = this.objects.filter(
        (o) => !((o.type === 'door' || o.type === 'window') && (o as DoorObject | WindowObject).wallId === id)
      );
    }

    // حذف العنصر الأساسي
    const newIdx = this.objects.findIndex((obj) => obj.id === id);
    if (newIdx !== -1) {
      this.objects.splice(newIdx, 1);
    }

    if (recordHistory) {
      if (attachedObjects.length > 0) {
        // حزمة أوامر لحذف الجدار وعناصره المرتبطة ليتم استرجاعها معاً عند التراجع
        const deleteCommands = [
          {
            type: 'delete' as const,
            object: JSON.parse(JSON.stringify(removed)),
            timestamp: Date.now(),
            index: originalIndexOf(removed.id),
          },
          ...attachedObjects.map((att) => ({
            type: 'delete' as const,
            object: JSON.parse(JSON.stringify(att)),
            timestamp: Date.now(),
            index: originalIndexOf(att.id),
          })),
        ];
        this.history.push({
          type: 'batch',
          commands: deleteCommands,
          timestamp: Date.now(),
          description: `حذف جدار مع ${attachedObjects.length} ملحقات`,
        });
      } else {
        this.history.push({
          type: 'delete',
          object: JSON.parse(JSON.stringify(removed)),
          timestamp: Date.now(),
          index,
          description: `حذف ${getObjectTypeName(removed.type)}`,
        });
      }
    }

    this.notify();
    return removed;
  }

  /**
   * مسح جميع كائنات المشروع (تفريغ الكانفس)
   */
  public clearAllObjects(recordHistory: boolean = false): void {
    if (recordHistory && this.objects.length > 0) {
      this.history.push({
        type: 'batch',
        commands: this.objects.map((obj, i) => ({
          type: 'delete' as const,
          object: JSON.parse(JSON.stringify(obj)),
          timestamp: Date.now(),
          index: i,
        })),
        timestamp: Date.now(),
        description: 'مسح جميع عناصر المخطط',
      });
    }
    this.objects = [];
    this.notify();
  }

  /**
   * تحديث خصائص عنصر مع دعم التراجع الجزئي
   */
  public updateObject(
    id: string,
    updates: Partial<ProjectObject>,
    recordHistory: boolean = true
  ): boolean {
    const target = this.objects.find((obj) => obj.id === id);
    if (!target) return false;

    const beforeState: Partial<ProjectObject> = {};
    const afterState: Partial<ProjectObject> = {};

    const targetRecord = target as unknown as Record<string, unknown>;
    const updatesRecord = updates as unknown as Record<string, unknown>;

    for (const key of Object.keys(updates) as (keyof ProjectObject)[]) {
      const prevVal = targetRecord[key];
      (beforeState as unknown as Record<string, unknown>)[key] =
        prevVal === undefined ? undefined : JSON.parse(JSON.stringify(prevVal));

      const nextVal = updatesRecord[key];
      (afterState as unknown as Record<string, unknown>)[key] =
        nextVal === undefined ? undefined : JSON.parse(JSON.stringify(nextVal));

      if (nextVal === undefined) {
        delete targetRecord[key];
      } else {
        targetRecord[key] = nextVal;
      }
    }

    if (recordHistory) {
      this.history.push({
        type: 'update',
        objectId: id,
        before: beforeState,
        after: afterState,
        timestamp: Date.now(),
        description: `تعديل خصائص ${target.type === 'wall' ? 'جدار' : target.type}`,
      });
    }

    this.notify();
    return true;
  }

  /**
   * حذف مجموعة من العناصر دفعة واحدة (Bulk Delete)
   */
  public deleteObjects(ids: string[]): void {
    if (!ids || ids.length === 0) return;
    // Set بدلاً من includes داخل filter (كان O(n×m) عند حذف آلاف العناصر)
    const idSet = new Set(ids);
    // إصلاح: حذف الجدران جماعياً كان يترك أبواباً ونوافذ "يتيمة" مرتبطة بجدار غير موجود
    // (لا تُرسم لكنها تبقى في البيانات وتُحسب في جدول الكميات BOQ). نحذفها معها كما يفعل deleteObject.
    for (const o of this.objects) {
      if ((o.type === 'door' || o.type === 'window') && idSet.has((o as DoorObject | WindowObject).wallId)) {
        const host = this.objects.find((w) => w.id === (o as DoorObject | WindowObject).wallId);
        if (host && host.type === 'wall') idSet.add(o.id);
      }
    }
    const toDelete: { obj: ProjectObject; index: number }[] = [];
    this.objects.forEach((o, i) => {
      if (idSet.has(o.id)) toDelete.push({ obj: o, index: i });
    });
    if (toDelete.length === 0) return;

    this.history.push({
      type: 'batch',
      commands: toDelete.map(({ obj, index }) => ({
        type: 'delete' as const,
        object: JSON.parse(JSON.stringify(obj)),
        timestamp: Date.now(),
        index,
      })),
      timestamp: Date.now(),
      description: `حذف ${toDelete.length} عناصر محددة`,
    });

    this.objects = this.objects.filter((o) => !idSet.has(o.id));
    this.notify();
  }

  /**
   * تطبيق تحويل هندسي (تدوير/مرآة/تحجيم/نقل) على مجموعة عناصر كخطوة تراجع واحدة.
   * الأبواب والنوافذ تتبع جدرانها تلقائياً (موضعها نسبي على الجدار).
   */
  public applyTransform(ids: string[], spec: TransformSpec, description: string): void {
    const idSet = new Set(ids);
    const wallIds = new Set(
      this.objects.filter((o) => o.type === 'wall' && idSet.has(o.id)).map((o) => o.id)
    );
    const commands: UpdateObjectCommand[] = [];
    for (const obj of this.objects) {
      if (!idSet.has(obj.id)) continue;
      const after = transformUpdates(obj, spec, wallIds);
      if (!after || Object.keys(after).length === 0) continue;
      const rec = obj as unknown as Record<string, unknown>;
      const before: Record<string, unknown> = {};
      for (const k of Object.keys(after)) {
        before[k] = rec[k] === undefined ? undefined : JSON.parse(JSON.stringify(rec[k]));
      }
      Object.assign(obj, JSON.parse(JSON.stringify(after)));
      commands.push({
        type: 'update',
        objectId: obj.id,
        before: before as Partial<ProjectObject>,
        after: JSON.parse(JSON.stringify(after)),
        timestamp: Date.now(),
      });
    }
    if (commands.length === 0) return;
    this.history.push({ type: 'batch', commands, timestamp: Date.now(), description });
    this.notify();
  }

  /**
   * تطبيق خطة تعديل مركبة (تحديثات + إضافات + حذف) كخطوة تراجع واحدة — للقص والتمديد.
   */
  public applyEdits(plan: EditPlan, description: string): void {
    const commands: BatchCommand['commands'] = [];
    for (const u of plan.updates) {
      const obj = this.objects.find((o) => o.id === u.id);
      if (!obj) continue;
      const rec = obj as unknown as Record<string, unknown>;
      const before: Record<string, unknown> = {};
      for (const k of Object.keys(u.after)) before[k] = rec[k] === undefined ? undefined : JSON.parse(JSON.stringify(rec[k]));
      for (const [k, v] of Object.entries(u.after)) {
        if (v === undefined) delete rec[k];
        else rec[k] = JSON.parse(JSON.stringify(v));
      }
      commands.push({ type: 'update', objectId: u.id, before: before as Partial<ProjectObject>, after: JSON.parse(JSON.stringify(u.after)), timestamp: Date.now() });
    }
    for (const id of plan.deletes) {
      const index = this.objects.findIndex((o) => o.id === id);
      if (index === -1) continue;
      const [removed] = this.objects.splice(index, 1);
      commands.push({ type: 'delete', object: JSON.parse(JSON.stringify(removed)), timestamp: Date.now(), index });
    }
    for (const add of plan.adds) {
      this.objects.push(add);
      commands.push({ type: 'add', object: JSON.parse(JSON.stringify(add)), timestamp: Date.now() });
    }
    if (commands.length === 0) return;
    this.history.push({ type: 'batch', commands, timestamp: Date.now(), description });
    this.notify();
  }

  /**
   * إضافة مجموعة عناصر دفعة واحدة كخطوة تراجع واحدة وإشعار واحد (للصق والتكرار)
   */
  public addObjects(objs: ProjectObject[], description?: string): void {
    if (!objs || objs.length === 0) return;
    this.objects.push(...objs);
    this.history.push({
      type: 'batch',
      commands: objs.map((obj) => ({
        type: 'add' as const,
        object: JSON.parse(JSON.stringify(obj)),
        timestamp: Date.now(),
      })),
      timestamp: Date.now(),
      description: description || `إضافة ${objs.length} عناصر`,
    });
    this.notify();
  }

  /**
   * تحديث مجموعة من العناصر دفعة واحدة مع دعم التراجع في خطوة واحدة (Bulk Update)
   */
  public updateObjects(
    ids: string[],
    updates: Partial<ProjectObject>,
    recordHistory: boolean = true
  ): void {
    if (!ids || ids.length === 0) return;
    const commands: UpdateObjectCommand[] = [];

    ids.forEach((id) => {
      const target = this.objects.find((obj) => obj.id === id);
      if (!target) return;

      const beforeState: Partial<ProjectObject> = {};
      const afterState: Partial<ProjectObject> = {};
      const targetRecord = target as unknown as Record<string, unknown>;
      const updatesRecord = updates as unknown as Record<string, unknown>;

      for (const key of Object.keys(updates) as (keyof ProjectObject)[]) {
        if (updatesRecord[key] !== undefined) {
          const prevVal = targetRecord[key];
          (beforeState as unknown as Record<string, unknown>)[key] =
            prevVal === undefined ? undefined : JSON.parse(JSON.stringify(prevVal));
          const nextVal = updatesRecord[key];
          (afterState as unknown as Record<string, unknown>)[key] =
            nextVal === undefined ? undefined : JSON.parse(JSON.stringify(nextVal));
          targetRecord[key] = nextVal;
        }
      }

      if (recordHistory) {
        commands.push({
          type: 'update',
          objectId: id,
          before: beforeState,
          after: afterState,
          timestamp: Date.now(),
        });
      }
    });

    if (recordHistory && commands.length > 0) {
      this.history.push({
        type: 'batch',
        commands,
        timestamp: Date.now(),
        description: `تعديل خصائص ${commands.length} عناصر`,
      });
    }

    this.notify();
  }

  /**
   * تحريك مجموعة من العناصر دفعة واحدة بإزاحة متجهة (Group Move / Delta Shift)
   */
  public moveObjects(ids: string[], delta: Point, recordHistory: boolean = true): void {
    if (!ids || ids.length === 0 || (delta.x === 0 && delta.y === 0)) return;
    // تقريب لإزالة ضجيج الفاصلة العائمة الناتج عن تحويل الشاشة/الزوم (39.99999999 ← 40)
    const r6 = (v: number) => Math.round(v * 1e6) / 1e6;
    const commands: UpdateObjectCommand[] = [];

    ids.forEach((id) => {
      const obj = this.objects.find((o) => o.id === id);
      if (!obj) return;

      const beforeState: Partial<ProjectObject> = {};
      const afterState: Partial<ProjectObject> = {};

      if (obj.type === 'wall') {
        const wall = obj as WallObject;
        (beforeState as any)['start'] = { ...wall.start };
        (beforeState as any)['end'] = { ...wall.end };
        wall.start = { x: r6(wall.start.x + delta.x), y: r6(wall.start.y + delta.y) };
        wall.end = { x: r6(wall.end.x + delta.x), y: r6(wall.end.y + delta.y) };
        (afterState as any)['start'] = { ...wall.start };
        (afterState as any)['end'] = { ...wall.end };
      } else if (obj.type === 'symbol') {
        const sym = obj as SymbolObject;
        (beforeState as any)['x'] = sym.x;
        (beforeState as any)['y'] = sym.y;
        sym.x = r6(sym.x + delta.x);
        sym.y = r6(sym.y + delta.y);
        (afterState as any)['x'] = sym.x;
        (afterState as any)['y'] = sym.y;
      } else if (obj.type === 'dimension') {
        const dim = obj as DimensionObject;
        (beforeState as any)['start'] = { ...dim.start };
        (beforeState as any)['end'] = { ...dim.end };
        dim.start = { x: r6(dim.start.x + delta.x), y: r6(dim.start.y + delta.y) };
        dim.end = { x: r6(dim.end.x + delta.x), y: r6(dim.end.y + delta.y) };
        (afterState as any)['start'] = { ...dim.start };
        (afterState as any)['end'] = { ...dim.end };
      } else if (obj.type === 'route') {
        const route = obj as RouteObject;
        (beforeState as any)['points'] = route.points.map((p) => ({ ...p }));
        route.points = route.points.map((p) => ({ x: r6(p.x + delta.x), y: r6(p.y + delta.y) }));
        (afterState as any)['points'] = route.points.map((p) => ({ ...p }));
      } else if (obj.type === 'line') {
        const ln = obj as LineObject;
        (beforeState as any)['points'] = ln.points.map((p) => ({ ...p }));
        ln.points = ln.points.map((p) => ({ x: r6(p.x + delta.x), y: r6(p.y + delta.y) }));
        (afterState as any)['points'] = ln.points.map((p) => ({ ...p }));
      } else if (obj.type === 'text' || obj.type === 'room') {
        const txt = obj as TextObject;
        (beforeState as any)['x'] = txt.x;
        (beforeState as any)['y'] = txt.y;
        txt.x = r6(txt.x + delta.x);
        txt.y = r6(txt.y + delta.y);
        (afterState as any)['x'] = txt.x;
        (afterState as any)['y'] = txt.y;
      } else if (obj.type === 'door' || obj.type === 'window') {
        // إذا كان الجدار الحاضن للباب أو النافذة غير محدد بالتحريك، نزح موقع العنصر على طول الجدار
        const item = obj as DoorObject | WindowObject;
        if (!ids.includes(item.wallId)) {
          const parentWall = this.objects.find((o) => o.id === item.wallId) as WallObject | undefined;
          if (parentWall) {
            const wdx = parentWall.end.x - parentWall.start.x;
            const wdy = parentWall.end.y - parentWall.start.y;
            const wallLenSq = wdx * wdx + wdy * wdy;
            if (wallLenSq > 0) {
              const projFraction = (delta.x * wdx + delta.y * wdy) / wallLenSq;
              const prevPos = item.position;
              const newPos = Math.max(0.05, Math.min(0.95, prevPos + projFraction));
              (beforeState as any)['position'] = prevPos;
              item.position = newPos;
              (afterState as any)['position'] = newPos;
            }
          }
        }
      }

      if (recordHistory && Object.keys(beforeState).length > 0) {
        commands.push({
          type: 'update',
          objectId: id,
          before: beforeState,
          after: afterState,
          timestamp: Date.now(),
        });
      }
    });

    if (recordHistory && commands.length > 0) {
      this.history.push({
        type: 'batch',
        commands,
        timestamp: Date.now(),
        description: `تحريك ${commands.length} عناصر معاً`,
      });
    }

    this.notify();
  }

  /**
   * تنفيذ التراجع (Undo)
   */
  public undo(): boolean {
    const cmd = this.history.popUndo();
    if (!cmd) return false;

    this.applyCommandInverse(cmd);
    this.notify();
    return true;
  }

  /**
   * تنفيذ الإعادة (Redo)
   */
  public redo(): boolean {
    const cmd = this.history.popRedo();
    if (!cmd) return false;

    this.applyCommandDirect(cmd);
    this.notify();
    return true;
  }

  private applyCommandInverse(cmd: Command): void {
    switch (cmd.type) {
      case 'add': {
        const idx = this.objects.findIndex((o) => o.id === cmd.object.id);
        if (idx !== -1) this.objects.splice(idx, 1);
        break;
      }
      case 'delete': {
        const restored = JSON.parse(JSON.stringify(cmd.object));
        if (typeof cmd.index === 'number' && cmd.index >= 0) {
          // إعادة العنصر لموضعه الأصلي في ترتيب الرسم بدلاً من آخر القائمة
          this.objects.splice(Math.min(cmd.index, this.objects.length), 0, restored);
        } else {
          this.objects.push(restored);
        }
        break;
      }
      case 'update': {
        const obj = this.objects.find((o) => o.id === cmd.objectId);
        if (obj) {
          const rec = obj as unknown as Record<string, unknown>;
          for (const [k, v] of Object.entries(cmd.before)) {
            if (v === undefined) {
              delete rec[k];
            } else {
              rec[k] = JSON.parse(JSON.stringify(v));
            }
          }
        }
        break;
      }
      case 'batch': {
        const allIndexedDeletes =
          cmd.commands.length > 0 &&
          cmd.commands.every((c) => c.type === 'delete' && typeof c.index === 'number');
        if (allIndexedDeletes) {
          // حذف جماعي: الاستعادة بترتيب المواضع تصاعدياً تعيد القائمة الأصلية تماماً
          const sorted = [...cmd.commands].sort(
            (a, b) => ((a as { index?: number }).index ?? 0) - ((b as { index?: number }).index ?? 0)
          );
          for (const c of sorted) this.applyCommandInverse(c);
        } else {
          // تطبيق عكس الأوامر بالترتيب العكسي
          for (let i = cmd.commands.length - 1; i >= 0; i--) {
            this.applyCommandInverse(cmd.commands[i]);
          }
        }
        break;
      }
    }
  }

  private applyCommandDirect(cmd: Command): void {
    switch (cmd.type) {
      case 'add': {
        this.objects.push(JSON.parse(JSON.stringify(cmd.object)));
        break;
      }
      case 'delete': {
        const idx = this.objects.findIndex((o) => o.id === cmd.object.id);
        if (idx !== -1) this.objects.splice(idx, 1);
        break;
      }
      case 'update': {
        const obj = this.objects.find((o) => o.id === cmd.objectId);
        if (obj) {
          const rec = obj as unknown as Record<string, unknown>;
          for (const [k, v] of Object.entries(cmd.after)) {
            if (v === undefined) {
              delete rec[k];
            } else {
              rec[k] = JSON.parse(JSON.stringify(v));
            }
          }
        }
        break;
      }
      case 'batch': {
        for (const subCmd of cmd.commands) {
          this.applyCommandDirect(subCmd);
        }
        break;
      }
    }
  }

  public getHistory(): CommandManager {
    return this.history;
  }

  /**
   * مزامنة الصفحة/اللوحة النشطة الحالية مع حالة الكائنات والصورة في الذاكرة
   */
  private syncCurrentSheetFromActiveState(): void {
    if (!this.sheets || this.sheets.length === 0) {
      this.sheets = [
        {
          id: 'sheet_1',
          name: 'لوحة 1 - المخطط العام',
          objects: JSON.parse(JSON.stringify(this.objects)),
          backgroundImage: this.backgroundImage
            ? JSON.parse(JSON.stringify(this.backgroundImage))
            : null,
          createdAt: new Date().toISOString().split('T')[0],
        },
      ];
      this.activeSheetId = 'sheet_1';
      return;
    }
    const current = this.sheets.find((s) => s.id === this.activeSheetId);
    if (current) {
      // كل لوحة تحفظ مقياسها (قد تختلف معايرة لوحة عن أخرى حسب صورة الخلفية)
      current.scale = this.meta.scale;
      current.objects = JSON.parse(JSON.stringify(this.objects));
      current.backgroundImage = this.backgroundImage
        ? JSON.parse(JSON.stringify(this.backgroundImage))
        : null;
    }
  }

  public getSheets(): import('./types.ts').ProjectSheet[] {
    this.syncCurrentSheetFromActiveState();
    return JSON.parse(JSON.stringify(this.sheets));
  }

  public getActiveSheetId(): string {
    return this.activeSheetId;
  }

  public setActiveSheet(sheetId: string): void {
    if (this.activeSheetId === sheetId) return;
    this.syncCurrentSheetFromActiveState();
    const target = this.sheets.find((s) => s.id === sheetId);
    if (!target) return;
    this.activeSheetId = sheetId;
    this.objects = JSON.parse(JSON.stringify(target.objects || []));
    this.backgroundImage = target.backgroundImage
      ? JSON.parse(JSON.stringify(target.backgroundImage))
      : null;
    if (typeof target.scale === 'number' && target.scale > 0) {
      this.meta = { ...this.meta, scale: target.scale };
    }
    this.history.clear();
    this.notify();
  }

  /**
   * تنفيذ دالة متزامنة كأن لوحة أخرى هي النشطة (للطباعة/التصدير)، ثم إعادة اللوحة الأصلية كما هي.
   * بخلاف setActiveSheet: لا يمسح سجل التراجع ولا يُبلغ المستمعين ولا يُعلِّم المشروع كمعدّل.
   */
  public withSheetTemporarily<T>(sheetId: string, fn: () => T): T {
    if (sheetId === this.activeSheetId) return fn();
    const target = this.sheets.find((s) => s.id === sheetId);
    if (!target) return fn();
    this.syncCurrentSheetFromActiveState();
    const saved = { objects: this.objects, bg: this.backgroundImage, meta: this.meta, active: this.activeSheetId };
    this.objects = target.objects || [];
    this.backgroundImage = target.backgroundImage ?? null;
    if (typeof target.scale === 'number' && target.scale > 0) this.meta = { ...this.meta, scale: target.scale };
    this.activeSheetId = sheetId;
    this.version++;
    try {
      return fn();
    } finally {
      this.objects = saved.objects;
      this.backgroundImage = saved.bg;
      this.meta = saved.meta;
      this.activeSheetId = saved.active;
      this.version++;
    }
  }

  public addSheet(name?: string): string {
    this.syncCurrentSheetFromActiveState();
    const nextNum = this.sheets.length + 1;
    const newId = 'sheet_' + Math.random().toString(36).substring(2, 8);
    const newSheet: import('./types.ts').ProjectSheet = {
      id: newId,
      name: name?.trim() || `لوحة ${nextNum}`,
      objects: [],
      backgroundImage: null,
      scale: this.meta.scale,
      createdAt: new Date().toISOString().split('T')[0],
    };
    this.sheets.push(newSheet);
    this.setActiveSheet(newId);
    return newId;
  }

  public renameSheet(sheetId: string, newName: string): void {
    const s = this.sheets.find((item) => item.id === sheetId);
    if (s && newName.trim()) {
      s.name = newName.trim();
      this.notify();
    }
  }

  public duplicateSheet(sheetId: string): string {
    this.syncCurrentSheetFromActiveState();
    const source = this.sheets.find((s) => s.id === sheetId);
    if (!source) return '';
    const newId = 'sheet_' + Math.random().toString(36).substring(2, 8);
    const clonedObjects = source.objects.map((obj) => {
      const cloned = JSON.parse(JSON.stringify(obj)) as ProjectObject;
      cloned.id = `${obj.type}_${Math.random().toString(36).substring(2, 9)}`;
      return cloned;
    });
    const newSheet: import('./types.ts').ProjectSheet = {
      id: newId,
      name: `${source.name} (نسخة)`,
      objects: clonedObjects,
      backgroundImage: source.backgroundImage
        ? JSON.parse(JSON.stringify(source.backgroundImage))
        : null,
      scale: source.scale,
      createdAt: new Date().toISOString().split('T')[0],
    };
    const sourceIdx = this.sheets.findIndex((s) => s.id === sheetId);
    this.sheets.splice(sourceIdx + 1, 0, newSheet);
    this.setActiveSheet(newId);
    return newId;
  }

  public deleteSheet(sheetId: string): boolean {
    if (this.sheets.length <= 1) return false;
    const idx = this.sheets.findIndex((s) => s.id === sheetId);
    if (idx === -1) return false;
    this.sheets.splice(idx, 1);
    if (this.activeSheetId === sheetId) {
      const nextIdx = Math.max(0, idx - 1);
      const nextSheet = this.sheets[nextIdx];
      this.activeSheetId = nextSheet.id;
      this.objects = JSON.parse(JSON.stringify(nextSheet.objects || []));
      this.backgroundImage = nextSheet.backgroundImage
        ? JSON.parse(JSON.stringify(nextSheet.backgroundImage))
        : null;
      if (typeof nextSheet.scale === 'number' && nextSheet.scale > 0) {
        this.meta = { ...this.meta, scale: nextSheet.scale };
      }
      this.history.clear();
    }
    this.notify();
    return true;
  }

  public reorderSheets(fromIndex: number, toIndex: number): void {
    if (
      fromIndex < 0 ||
      fromIndex >= this.sheets.length ||
      toIndex < 0 ||
      toIndex >= this.sheets.length ||
      fromIndex === toIndex
    ) {
      return;
    }
    this.syncCurrentSheetFromActiveState();
    const [moved] = this.sheets.splice(fromIndex, 1);
    this.sheets.splice(toIndex, 0, moved);
    this.notify();
  }

  public toJSON(): ProjectData {
    this.syncCurrentSheetFromActiveState();
    return {
      project: { ...this.meta },
      layers: JSON.parse(JSON.stringify(this.layers)),
      objects: JSON.parse(JSON.stringify(this.objects)),
      backgroundImage: this.backgroundImage
        ? JSON.parse(JSON.stringify(this.backgroundImage))
        : null,
      sheets: JSON.parse(JSON.stringify(this.sheets)),
      activeSheetId: this.activeSheetId,
      quantities: this.getQuantitySettings(),
      printSettings: this.getPrintSettings(),
      schemaVersion: CURRENT_SCHEMA_VERSION,
    };
  }

  /**
   * تحميل مشروع من بيانات خام (ملف/تخزين) بعد الترحيل للإصدار الحالي والتحقق من صحتها.
   * يعيد قائمة تحذيرات (عناصر تالفة أُصلحت أو أُهملت) لعرضها للمستخدم؛ يرمي خطأً إن لم يكن مشروعاً أصلاً.
   */
  public loadFromJSON(input: ProjectData): string[] {
    const { data, report } = migrateProjectData(input, DEFAULT_LAYERS);
    this.meta = { ...data.project };
    this.quantities = sanitizeQuantitySettings(data.quantities);
    this.printSettings = data.printSettings && typeof data.printSettings === 'object' ? JSON.parse(JSON.stringify(data.printSettings)) : {};
    this.layers = JSON.parse(JSON.stringify(data.layers));
    this.activeLayerId = this.layers[0]?.id || 'arch';
    this.history.clear();

    this.sheets = JSON.parse(JSON.stringify(data.sheets || []));
    const current = this.sheets.find((s) => s.id === data.activeSheetId) || this.sheets[0];
    this.activeSheetId = current.id;
    this.objects = JSON.parse(JSON.stringify(current.objects || []));
    this.backgroundImage = current.backgroundImage
      ? JSON.parse(JSON.stringify(current.backgroundImage))
      : null;

    this.notify();
    return report.warnings;
  }

  /**
   * الحفظ في ذاكرة المتصفح. يُرجع false إذا فشل (غالباً تجاوز حد ~5MB بسبب صورة الخلفية).
   * سابقاً كان الخطأ QuotaExceededError يُرمى دون معالجة فيظهر المشروع "محفوظاً" وهو غير محفوظ.
   */
  public saveToLocalStorage(): boolean {
    const data = this.toJSON();
    data.savedAt = new Date().toISOString();
    // نسخة في IndexedDB دائماً (بلا حد حجم) — لا ننتظرها هنا للحفاظ على التوقيع المتزامن
    void idbSaveProject(this.projectId, data).catch(() => undefined);
    try {
      localStorage.setItem(STORAGE_PREFIX + this.projectId, JSON.stringify(data));
      localStorage.setItem(CURRENT_PROJECT_KEY, this.projectId);
      return true;
    } catch (err) {
      console.error('saveToLocalStorage failed (storage quota?):', err);
      this.dropStaleLocalCopy();
      return false;
    }
  }

  /** عند فشل localStorage نزيل نسخته القديمة حتى لا تُحمَّل بدل نسخة IndexedDB الأحدث */
  private dropStaleLocalCopy(): void {
    try {
      localStorage.removeItem(STORAGE_PREFIX + this.projectId);
      localStorage.setItem(CURRENT_PROJECT_KEY, this.projectId);
    } catch {
      // تجاهل
    }
  }

  private lastBackupAt = 0;
  /** أقل فاصل بين نسختين احتياطيتين تلقائيتين */
  private static readonly BACKUP_INTERVAL_MS = 2 * 60 * 1000;

  /**
   * الحفظ المحلي الموثوق (المتصفح): IndexedDB أولاً (بلا حد حجم) ثم localStorage كنسخة سريعة،
   * مع نسخة احتياطية تلقائية كل دقيقتين على الأقل (تُحفظ آخر 10 نسخ).
   * ينجح إذا نجح أيٌّ من المخزنين.
   */
  public async saveLocal(options: { forceBackup?: boolean } = {}): Promise<{ ok: boolean; indexedDb: boolean; localStorage: boolean }> {
    const data = this.toJSON();
    data.savedAt = new Date().toISOString();
    let idbOk = false;
    let lsOk = false;
    try {
      await idbSaveProject(this.projectId, data);
      idbOk = true;
    } catch (err) {
      console.warn('IndexedDB save failed:', err);
    }
    try {
      localStorage.setItem(STORAGE_PREFIX + this.projectId, JSON.stringify(data));
      localStorage.setItem(CURRENT_PROJECT_KEY, this.projectId);
      lsOk = true;
    } catch {
      if (idbOk) this.dropStaleLocalCopy();
    }
    const now = Date.now();
    if (idbOk && (options.forceBackup || now - this.lastBackupAt >= ProjectModel.BACKUP_INTERVAL_MS)) {
      try {
        await idbAddBackup(this.projectId, data);
        this.lastBackupAt = now;
      } catch (err) {
        console.warn('Backup failed:', err);
      }
    }
    return { ok: idbOk || lsOk, indexedDb: idbOk, localStorage: lsOk };
  }

  /**
   * بعد التحميل المتزامن من localStorage: إن كانت نسخة IndexedDB أحدث (أو localStorage فارغ لأن المشروع
   * تجاوز حجمه) نحمّلها. يعيد true إن حُمِّلت نسخة.
   */
  public async loadNewerFromIndexedDB(): Promise<boolean> {
    const versionAtStart = this.version;
    let localSavedAt = '';
    let id = this.projectId;
    try {
      id = localStorage.getItem(CURRENT_PROJECT_KEY) || this.projectId;
      const raw = localStorage.getItem(STORAGE_PREFIX + id);
      if (raw) localSavedAt = (JSON.parse(raw) as ProjectData).savedAt || '';
      else localSavedAt = '';
    } catch {
      // تجاهل
    }
    try {
      const rec = await idbLoadProject(id);
      if (!rec) return false;
      const lsHasCopy = (() => {
        try {
          return Boolean(localStorage.getItem(STORAGE_PREFIX + id));
        } catch {
          return false;
        }
      })();
      if (lsHasCopy && localSavedAt && rec.savedAt <= localSavedAt) return false;
      // لا نستبدل عمل المستخدم إن بدأ التعديل قبل اكتمال القراءة
      if (this.version !== versionAtStart) return false;
      this.projectId = id;
      this.loadFromJSON(rec.data);
      return true;
    } catch {
      return false;
    }
  }

  public listBackups(): Promise<BackupEntry[]> {
    return idbListBackups(this.projectId);
  }

  /** استعادة نسخة احتياطية (تُحفظ النسخة الحالية أولاً كنسخة احتياطية حتى يمكن التراجع عن الاستعادة) */
  public async restoreBackup(key: number): Promise<string[]> {
    const data = await idbGetBackup(key);
    if (!data) throw new Error('النسخة الاحتياطية غير موجودة');
    await this.saveLocal({ forceBackup: true });
    return this.loadFromJSON(data);
  }

  public loadFromLocalStorage(id?: string): boolean {
    const targetId = id || localStorage.getItem(CURRENT_PROJECT_KEY) || this.projectId;
    const raw = localStorage.getItem(STORAGE_PREFIX + targetId);
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw);
      this.projectId = targetId;
      this.loadFromJSON(parsed);
      return true;
    } catch {
      return false;
    }
  }

  public static listSavedProjects(): { id: string; name: string; updatedAt: string }[] {
    const list: { id: string; name: string; updatedAt: string }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        const id = key.replace(STORAGE_PREFIX, '');
        try {
          const raw = localStorage.getItem(key);
          if (raw) {
            const data = JSON.parse(raw) as ProjectData;
            list.push({
              id,
              name: data.project?.name || id,
              updatedAt: data.project?.createdAt || '',
            });
          }
        } catch {
          // ignore corrupted keys
        }
      }
    }
    return list;
  }

  public subscribe(listener: ModelChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.getLiveSnapshot());
    return () => this.listeners.delete(listener);
  }

  /**
   * لقطة خفيفة للقراءة فقط تُمرَّر للمستمعين عند كل تغيير.
   * سابقاً كان notify() يستدعي toJSON() الذي ينسخ كل العناصر وكل اللوحات وصورة الخلفية (Base64 قد تبلغ عدة MB)
   * عبر JSON.parse(JSON.stringify) — مرتين أو ثلاثاً — مع كل تعديل صغير، وهو أكبر عنق زجاجة في المخططات الكبيرة.
   * لا يوجد مستمع حالي يعدّل البيانات المستلمة، لذا تمرير المراجع آمن. للحفظ/التصدير استخدم toJSON().
   */
  public getLiveSnapshot(): ProjectData {
    return {
      project: this.meta,
      layers: this.layers,
      objects: this.objects,
      backgroundImage: this.backgroundImage,
      sheets: this.sheets,
      activeSheetId: this.activeSheetId,
      quantities: this.quantities,
    };
  }

  /**
   * ملخص اللوحات دون نسخ عناصرها (لشريط اللوحات). الحقول objects فارغة عمداً.
   */
  public getSheetSummaries(): import('./types.ts').ProjectSheet[] {
    return this.sheets.map((s) => ({
      id: s.id,
      name: s.name,
      objects: [],
      backgroundImage: null,
      scale: s.scale,
      createdAt: s.createdAt,
    }));
  }

  /** رقم إصدار يزداد مع كل تغيير (لإبطال الفهارس المؤقتة مثل الفهرس المكاني للالتقاط) */
  private version: number = 0;

  public getVersion(): number {
    return this.version;
  }

  public getObjectCount(): number {
    return this.objects.length;
  }

  private notify(): void {
    this.version++;
    const data = this.getLiveSnapshot();
    this.listeners.forEach((listener) => listener(data));
  }
}
