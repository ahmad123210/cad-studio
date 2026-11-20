/**
 * @file types.ts
 * @description تعريف أنواع البيانات الصرفة لنموذج المشروع الهندسي (Model Layer).
 * هذا الملف مستقل تماماً عن أي منطق رسم أو مكتبة واجهة أو محرك كانفس.
 */

export interface Point {
  x: number;
  y: number;
}

export type UnitType = 'meter' | 'cm' | 'mm';

export interface ProjectMeta {
  name: string;
  unit: UnitType;
  /**
   * scale: عدد البكسلات لكل متر (pixelsPerMeter)، يُحدد لاحقاً بالمعايرة.
   * القيمة الافتراضية 50 بكسل = 1 متر.
   */
  scale: number | null;
  createdAt: string;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  color: string;
  opacity?: number;
  isDefault?: boolean; // قفل الطبقة الافتراضية لمنع حذفها أو إعادة تسميتها
}

/**
 * الأنواع المدعومة للعناصر الهندسية وفقاً للدستور التقني
 */
export type ObjectType =
  | 'wall'
  | 'door'
  | 'window'
  | 'column'
  | 'symbol'
  | 'route'
  | 'dimension'
  | 'text';

export interface BaseObject {
  id: string;
  type: ObjectType;
  layerId: string;
  label?: string; // تسمية توضيحية اختيارية للعنصر
  color?: string; // لون مخصص اختياري للعنصر
  locked?: boolean; // قفل العنصر لمنع تحريكه أو تعديله بالخطأ
}

/**
 * عنصر الجدار (Wall)
 * start & end: إحداثيات حقيقية بوحدة العالم (World Coordinates)
 * thickness: سماكة الجدار بوحدة العالم (افتراضياً 20 بكسل = 0.20م أو 20سم)
 * rotation: زاوية دوران الجدار بالدرجات
 */
export interface WallObject extends BaseObject {
  type: 'wall';
  start: Point;
  end: Point;
  thickness: number;
  rotation: number;
}

/**
 * اتجاه فتح الباب
 * inward: للداخل (نحو الطرف الموجب للمتجه العمودي)
 * outward: للخارج
 * right / left: مفصلة الباب ومسار الدوران
 */
export type DoorOpenDirection =
  | 'inward_right'
  | 'inward_left'
  | 'outward_right'
  | 'outward_left';

/**
 * عنصر الباب (Door) — مرتبط بجدار معين
 * wallId: معرف الجدار الحاضن للباب
 * position: نسبة الموقع على طول الجدار (من 0 إلى 1)
 * width: عرض فتحة الباب بوحدة العالم (مثلاً 45px = 0.90م)
 */
export interface DoorObject extends BaseObject {
  type: 'door';
  wallId: string;
  position: number;
  width: number;
  openDirection: DoorOpenDirection;
}

/**
 * عنصر النافذة (Window) — مرتبط بجدار معين
 * wallId: معرف الجدار الحاضن للنافذة
 * position: نسبة الموقع على طول الجدار (من 0 إلى 1)
 * width: عرض فتحة النافذة بوحدة العالم (مثلاً 60px = 1.20م)
 * height: ارتفاع النافذة (اختياري)
 * sillHeight: ارتفاع جلسة النافذة عن الأرض (اختياري)
 */
export interface WindowObject extends BaseObject {
  type: 'window';
  wallId: string;
  position: number;
  width: number;
  height?: number;
  sillHeight?: number;
}

/**
 * بيانات صورة المخطط المرجعية في الخلفية (Background Image)
 */
export interface BackgroundImageData {
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
}

/**
 * عنصر البعد / القياس الهندسي المرسوم (Dimension)
 * start: نقطة بداية القياس
 * end: نقطة نهاية القياس
 * measuredLength: الطول بالبكسل
 * displayText: نص الطول المعروض (اختياري، إن وجد تخصيص)
 * offset: إزاحة خط البعد عن العنصر المقاس
 */
export interface DimensionObject extends BaseObject {
  type: 'dimension';
  start: Point;
  end: Point;
  measuredLength: number;
  displayText?: string;
  offset?: number;
}

/**
 * عنصر الرمز الهندسي (Symbol Object - المرحلة 4)
 * يمثل رمزا هندسيا تنفيذيا حقيقيا (كهرباء، سباكة، تكييف، إطفاء حريق)
 * يحمل بيانات الموقع، الدوران، الربط بالجدار (Wall Snap)، ومعرف الرمز.
 */
export interface SymbolObject extends BaseObject {
  type: 'symbol';
  symbolKind: string; // معرف نوع الرمز (مثال: 'socket_single', 'switch_single', 'hvac_split_ac')
  x: number; // إحداثي X بوحدة العالم
  y: number; // إحداثي Y بوحدة العالم
  rotation: number; // زاوية الدوران بالدرجات (0 - 360)
  wallId?: string; // معرف الجدار إذا كان الرمز ملتصقا بجدار (Wall Snap)
  wallPosition?: number; // الموضع النسبي على الجدار (0 إلى 1)
  wallSide?: 1 | -1; // جهة الجدار (داخلي / خارجي)
  scale?: number; // معامل المقياس للرمز (افتراضيا 1)
  color?: string; // لون مخصص للرمز (تجاوز لون الطبقة)
  label?: string; // تسمية توضيحية اختيارية (مثال: 'DB-1', '220V', 'AC-01')
  connections?: string[]; // معرفات المسارات المتصلة بالرمز (للمرحلة 5)
}

/**
 * أنواع المسارات الكهروميكانيكية (Route Kinds - المرحلة 5)
 */
export type RouteKind = 'electrical' | 'water' | 'drainage' | 'hvac' | 'fire';

/**
 * عنصر المسار الهندسي (Route Object - المرحلة 5)
 * يمثل مسار كابل، أنبوب مياه، دكت تكييف، أو خط إطفاء حريق
 * يحمل نقاط المسار المتعددة (Polyline)، وحساب الطول الحقيقي، والمواصفات
 */
export interface RouteObject extends BaseObject {
  type: 'route';
  routeKind: RouteKind;
  points: Point[]; // نقاط المسار المتتابعة بوحدة العالم
  diameter?: number; // القطر بالمليمتر (أو مقاس الدكت)
  material?: string; // مادة التصنيع (PPR, PVC, XLPE Copper, Steel...)
  lengthCalculated: number; // الطول الحقيقي المحسوب بوحدة المشروع (متر)
  label?: string; // توصيف اختياري للخط أو الدائرة الكهربائية
  startSymbolId?: string; // معرف الرمز المتصل به في البداية إن وجد
  endSymbolId?: string; // معرف الرمز المتصل به في النهاية إن وجد
  color?: string; // لون مخصص اختياري (افتراضياً يأخذ لون الطبقة)
  strokeWidth?: number; // عرض خط الرسم
  lineStyle?: 'solid' | 'dashed' | 'dotted'; // نمط الخط
  showLength?: boolean; // إظهار أو إخفاء أطوال المسارات على الرسم (افتراضياً true)
}

/**
 * عنصر الملاحظة والتلميح النصي (Text / Annotation Note Object)
 * يتيح كتابة تلميحات وملاحظات هندسية على المخطط
 * مع إمكانية التحكم الكامل بالحجم واللون والدوران والمحاذاة
 */
export interface TextObject extends BaseObject {
  type: 'text';
  text: string; // نص الملاحظة
  x: number; // إحداثي X بوحدة العالم
  y: number; // إحداثي Y بوحدة العالم
  fontSize: number; // حجم الخط بوحدة العالم (افتراضياً 16)
  color: string; // لون الخط (مثال: '#38bdf8' أو '#ffffff')
  rotation: number; // زاوية الدوران بالدرجات (0 - 360)
  backgroundColor?: string; // لون خلفية البطاقة/الصندوق (اختياري)
  backgroundOpacity?: number; // شفافية الخلفية (0 إلى 1)
  borderColor?: string; // لون إطار البطاقة (اختياري)
  padding?: number; // حشوة الصندوق النصي
  fontWeight?: 'normal' | 'bold'; // سماكة الخط
  align?: 'left' | 'center' | 'right'; // محاذاة النص
}

export type ProjectObject =
  | WallObject
  | DoorObject
  | WindowObject
  | DimensionObject
  | SymbolObject
  | RouteObject
  | TextObject;

export interface ProjectSheet {
  id: string;
  name: string;
  objects: ProjectObject[];
  backgroundImage?: BackgroundImageData | null;
  scale?: number | null;
  createdAt?: string;
}

export interface ProjectData {
  project: ProjectMeta;
  layers: Layer[];
  objects: ProjectObject[];
  backgroundImage?: BackgroundImageData | null;
  sheets?: ProjectSheet[];
  activeSheetId?: string;
}

/**
 * تعريف الأوامر لنظام التراجع والإعادة (Command Pattern)
 */
export type CommandType = 'add' | 'delete' | 'update' | 'batch';

export interface BaseCommand {
  type: CommandType;
  description?: string;
  timestamp: number;
}

export interface AddObjectCommand extends BaseCommand {
  type: 'add';
  object: ProjectObject;
}

export interface DeleteObjectCommand extends BaseCommand {
  type: 'delete';
  object: ProjectObject;
}

export interface UpdateObjectCommand extends BaseCommand {
  type: 'update';
  objectId: string;
  before: Partial<ProjectObject>;
  after: Partial<ProjectObject>;
}

export interface BatchCommand extends BaseCommand {
  type: 'batch';
  commands: (AddObjectCommand | DeleteObjectCommand | UpdateObjectCommand)[];
}

export type Command =
  | AddObjectCommand
  | DeleteObjectCommand
  | UpdateObjectCommand
  | BatchCommand;
