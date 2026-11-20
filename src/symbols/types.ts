/**
 * @file types.ts
 * @description تعريف البنية المعيارية للرموز الهندسية (Symbols Library Types)
 * متوافقة مع متطلبات الدستور التقني لفصل الرموز في مجلد منفصل لسهولة التوسع.
 */

import Konva from 'konva';

export type SymbolCategory = 'elec' | 'plumb' | 'hvac' | 'fire' | 'furniture' | 'custom';

export interface CategoryMeta {
  id: SymbolCategory;
  name: string;
  nameEn: string;
  defaultLayerId: string;
  color: string;
  iconName: string;
}

export interface SymbolDefinition {
  id: string; // معرف فريد للرمز (مثال: 'socket_single', 'switch_single')
  name: string; // الاسم باللغة العربية
  nameEn: string; // الاسم بالإنجليزية للمصطلحات الهندسية
  category: SymbolCategory;
  defaultLayerId: string; // الطبقة الافتراضية للرمز ('elec', 'plumb', 'hvac', 'fire')
  description: string; // وصف هندسي للاستخدام
  wallMountable: boolean; // هل يلتصق تلقائياً بالجدران (مثل البرايز والمفاتيح)
  defaultWidth: number; // العرض الافتراضي بوحدة العالم
  defaultHeight: number; // الارتفاع الافتراضي بوحدة العالم
  
  /**
   * دالة رسم الرمز على كانفس Konva
   * تأخذ مجموعة Konva.Group لتضيف إليها الأشكال المتجهية للرمز
   */
  renderKonva: (
    group: Konva.Group,
    params: {
      color: string;
      isSelected: boolean;
      zoom: number;
    }
  ) => void;

  /**
   * كود SVG نقي مصغر لعرض الرمز في واجهة المستخدم (القوائم واللوحات)
   */
  svgPreview: string;
}
