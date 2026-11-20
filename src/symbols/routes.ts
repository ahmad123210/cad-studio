/**
 * @file routes.ts
 * @description تعريفات وخصائص المسارات الكهروميكانيكية (MEP Routes Configuration - المرحلة 5).
 * تشمل مواصفات كابلات الكهرباء، مواسير المياه والصرف، دكتات التكييف، وشبكات إطفاء الحريق.
 */

import { RouteKind, Point } from '../model/types.ts';
import { SnapEngine } from '../engine/snap.ts';

export interface RouteMeta {
  kind: RouteKind;
  name: string;
  nameEn: string;
  defaultLayerId: string;
  defaultColor: string;
  defaultMaterial: string;
  defaultDiameter: number;
  diameterUnit: string;
  presetMaterials: string[];
  presetSizes: number[];
  defaultStrokeWidth: number;
  dashPattern?: number[];
  iconName: string;
}

export const ROUTE_KINDS_META: Record<RouteKind, RouteMeta> = {
  electrical: {
    kind: 'electrical',
    name: 'كابل / مسار كهرباء',
    nameEn: 'Electrical Conduit / Cable',
    defaultLayerId: 'elec',
    defaultColor: '#f59e0b',
    defaultMaterial: 'PVC Conduit / XLPE Copper',
    defaultDiameter: 20,
    diameterUnit: 'mm',
    presetMaterials: [
      'PVC Conduit (مواسير بي في سي)',
      'XLPE Copper Cable (كابل نحاس مسلح)',
      'GI Metal Conduit (مواسير حديد مجلفن)',
      'Cable Tray (حامل كابلات معدني)',
      'Flexible Conduit (جرجور مرن)',
    ],
    presetSizes: [16, 20, 25, 32, 50],
    defaultStrokeWidth: 2.5,
    iconName: 'Zap',
  },
  water: {
    kind: 'water',
    name: 'تغذية مياه (Water Supply)',
    nameEn: 'Domestic Water Supply',
    defaultLayerId: 'plumb',
    defaultColor: '#3b82f6',
    defaultMaterial: 'PPR Pipe (بولي بروبيلين أخضر)',
    defaultDiameter: 25,
    diameterUnit: 'mm',
    presetMaterials: [
      'PPR Pipe (بولي بروبيلين أخضر)',
      'PEX Pipe (بولي إيثيلين شبكي)',
      'Copper Tube (مواسير نحاس)',
      'CPVC Pipe (سي بي في سي)',
      'Galvanized Iron (حديد مجلفن)',
    ],
    presetSizes: [20, 25, 32, 40, 50],
    defaultStrokeWidth: 2.5,
    iconName: 'Droplet',
  },
  drainage: {
    kind: 'drainage',
    name: 'صرف صحي ومطر (Drainage)',
    nameEn: 'Sanitary / Storm Drainage',
    defaultLayerId: 'plumb',
    defaultColor: '#8b5cf6',
    defaultMaterial: 'UPVC Drainage Pipe (يو بي في سي)',
    defaultDiameter: 110,
    diameterUnit: 'mm',
    presetMaterials: [
      'UPVC Drainage Pipe Class 4 (صرف ثقيل)',
      'Cast Iron Pipe (حديد زهر)',
      'HDPE Pipe (بولي إيثيلين عالي الكثافة)',
    ],
    presetSizes: [50, 75, 110, 160],
    defaultStrokeWidth: 3,
    dashPattern: [8, 4],
    iconName: 'Droplets',
  },
  hvac: {
    kind: 'hvac',
    name: 'تكييف ودكتات (HVAC Duct / Pipe)',
    nameEn: 'HVAC Duct & Refrigerant',
    defaultLayerId: 'hvac',
    defaultColor: '#10b981',
    defaultMaterial: 'Galvanized Sheet Duct (دكت صاج مجلفن)',
    defaultDiameter: 32,
    diameterUnit: 'mm',
    presetMaterials: [
      'Galvanized Sheet Duct (دكت صاج مجلفن)',
      'Copper Refrigerant Pipe (مواسير تبريد نحاس معزولة)',
      'Chilled Water Steel Pipe (مواسير مياه مثلجة عازلة)',
      'Flexible Duct (دكت مرن معزول)',
    ],
    presetSizes: [20, 25, 32, 50, 100],
    defaultStrokeWidth: 3.5,
    iconName: 'Wind',
  },
  fire: {
    kind: 'fire',
    name: 'شبكة إطفاء حريق (Fire Pipeline)',
    nameEn: 'Fire Fighting Pipeline',
    defaultLayerId: 'fire',
    defaultColor: '#ef4444',
    defaultMaterial: 'Black Steel Sch 40 (أنابيب حديد أسود)',
    defaultDiameter: 50,
    diameterUnit: 'mm',
    presetMaterials: [
      'Black Steel Sch 40 (أنابيب حديد أسود غير ملحومة)',
      'Galvanized Fire Pipe (حديد مجلفن للحريق)',
      'Ductile Iron Pipe (حديد دكتايل مدفون)',
    ],
    presetSizes: [25, 32, 40, 50, 65, 80, 100],
    defaultStrokeWidth: 3,
    dashPattern: [10, 3, 3, 3],
    iconName: 'Flame',
  },
};

/**
 * حساب الطول الإجمالي للمسار بالبكسل
 */
export function calculateRoutePixelLength(points: Point[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += SnapEngine.distance(points[i], points[i + 1]);
  }
  return total;
}

/**
 * حساب أطوال جميع مقاطع المسار بالبكسل
 */
export function calculateSegmentLengths(points: Point[]): number[] {
  const lengths: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    lengths.push(SnapEngine.distance(points[i], points[i + 1]));
  }
  return lengths;
}
