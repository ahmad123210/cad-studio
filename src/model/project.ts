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
  BackgroundImageData,
  Command,
  Point,
  UpdateObjectCommand,
} from './types.ts';
import { CommandManager } from './history.ts';

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
          },
          ...attachedObjects.map((att) => ({
            type: 'delete' as const,
            object: JSON.parse(JSON.stringify(att)),
            timestamp: Date.now(),
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
        commands: this.objects.map((obj) => ({
          type: 'delete' as const,
          object: JSON.parse(JSON.stringify(obj)),
          timestamp: Date.now(),
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
    const toDelete = this.objects.filter((o) => idSet.has(o.id));
    if (toDelete.length === 0) return;

    this.history.push({
      type: 'batch',
      commands: toDelete.map((obj) => ({
        type: 'delete' as const,
        object: JSON.parse(JSON.stringify(obj)),
        timestamp: Date.now(),
      })),
      timestamp: Date.now(),
      description: `حذف ${toDelete.length} عناصر محددة`,
    });

    this.objects = this.objects.filter((o) => !idSet.has(o.id));
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
      } else if (obj.type === 'text') {
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
        this.objects.push(JSON.parse(JSON.stringify(cmd.object)));
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
        // تطبيق عكس الأوامر بالترتيب العكسي
        for (let i = cmd.commands.length - 1; i >= 0; i--) {
          this.applyCommandInverse(cmd.commands[i]);
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
    this.history.clear();
    this.notify();
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
    };
  }

  public loadFromJSON(data: ProjectData): void {
    if (!data || !data.project) {
      throw new Error('صيغة مشروع غير صالحة');
    }
    this.meta = { ...data.project };
    this.layers = JSON.parse(JSON.stringify(data.layers || DEFAULT_LAYERS));
    this.backgroundImage = data.backgroundImage || null;
    this.activeLayerId = this.layers[0]?.id || 'arch';
    this.history.clear();

    if (data.sheets && data.sheets.length > 0) {
      this.sheets = JSON.parse(JSON.stringify(data.sheets));
      this.activeSheetId = data.activeSheetId || this.sheets[0].id;
      const current = this.sheets.find((s) => s.id === this.activeSheetId) || this.sheets[0];
      this.activeSheetId = current.id;
      this.objects = JSON.parse(JSON.stringify(current.objects || []));
      this.backgroundImage = current.backgroundImage
        ? JSON.parse(JSON.stringify(current.backgroundImage))
        : null;
    } else {
      this.objects = data.objects || [];
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
    }

    this.notify();
  }

  /**
   * الحفظ في ذاكرة المتصفح. يُرجع false إذا فشل (غالباً تجاوز حد ~5MB بسبب صورة الخلفية).
   * سابقاً كان الخطأ QuotaExceededError يُرمى دون معالجة فيظهر المشروع "محفوظاً" وهو غير محفوظ.
   */
  public saveToLocalStorage(): boolean {
    try {
      const data = this.toJSON();
      localStorage.setItem(STORAGE_PREFIX + this.projectId, JSON.stringify(data));
      localStorage.setItem(CURRENT_PROJECT_KEY, this.projectId);
      return true;
    } catch (err) {
      console.error('saveToLocalStorage failed (storage quota?):', err);
      return false;
    }
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

  private notify(): void {
    const data = this.getLiveSnapshot();
    this.listeners.forEach((listener) => listener(data));
  }
}
