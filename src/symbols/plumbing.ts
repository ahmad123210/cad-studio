/**
 * @file plumbing.ts
 * @description مكتبة رموز السباكة والصحي (Plumbing Symbols Library)
 * تشمل جميع الرموز المطلوبة بالدستور التقني (11 رمزا معماريا وتنفيذيا)
 */

import Konva from 'konva';
import { SymbolDefinition } from './types.ts';

export const PLUMBING_SYMBOLS: SymbolDefinition[] = [
  // 1. مغسلة
  {
    id: 'plumb_sink',
    name: 'مغسلة حوض (Washbasin)',
    nameEn: 'Washbasin / Sink',
    category: 'plumb',
    defaultLayerId: 'plumb',
    description: 'حوض غسيل أيدي جداري مع خلاط مياه',
    wallMountable: true,
    defaultWidth: 26,
    defaultHeight: 20,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><rect x="4" y="6" width="24" height="20" rx="6"/><circle cx="16" cy="16" r="3"/><circle cx="16" cy="8" r="1.5" fill="currentColor"/></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Rect({
          x: -13,
          y: -20,
          width: 26,
          height: 20,
          stroke: strokeColor,
          strokeWidth: 2,
          cornerRadius: 6,
          fill: '#1e293b',
        })
      );
      group.add(
        new Konva.Circle({
          x: 0,
          y: -10,
          radius: 3,
          stroke: strokeColor,
          strokeWidth: 1.5,
        })
      );
      group.add(
        new Konva.Circle({
          x: 0,
          y: -4,
          radius: 1.5,
          fill: strokeColor,
        })
      );
    },
  },

  // 2. مرحاض
  {
    id: 'plumb_wc',
    name: 'مرحاض (Water Closet)',
    nameEn: 'Water Closet (WC)',
    category: 'plumb',
    defaultLayerId: 'plumb',
    description: 'كرسي حمام معلق أو أرضي مع صندوق الطرد',
    wallMountable: true,
    defaultWidth: 20,
    defaultHeight: 30,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><rect x="7" y="4" width="18" height="8" rx="2"/><ellipse cx="16" cy="20" rx="8" ry="10"/></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      // خزان الطرد الملاصق للجدار
      group.add(
        new Konva.Rect({
          x: -9,
          y: -8,
          width: 18,
          height: 8,
          stroke: strokeColor,
          strokeWidth: 2,
          cornerRadius: 2,
          fill: '#1e293b',
        })
      );
      // مقعد التواليت البيضاوي
      group.add(
        new Konva.Ellipse({
          x: 0,
          y: -17,
          radiusX: 8,
          radiusY: 10,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
        })
      );
      group.add(
        new Konva.Ellipse({
          x: 0,
          y: -17,
          radiusX: 5,
          radiusY: 7,
          stroke: strokeColor,
          strokeWidth: 1.5,
        })
      );
    },
  },

  // 3. دش
  {
    id: 'plumb_shower',
    name: 'كابينة دش (Shower)',
    nameEn: 'Shower Tray',
    category: 'plumb',
    defaultLayerId: 'plumb',
    description: 'منطقة استحمام مربعة مع صفاية تصريف',
    wallMountable: false,
    defaultWidth: 32,
    defaultHeight: 32,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><rect x="4" y="4" width="24" height="24"/><line x1="4" y1="4" x2="28" y2="28"/><line x1="28" y1="4" x2="4" y2="28"/><circle cx="16" cy="16" r="3" fill="currentColor"/></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Rect({
          x: -16,
          y: -16,
          width: 32,
          height: 32,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
        })
      );
      group.add(
        new Konva.Line({
          points: [-16, -16, 16, 16],
          stroke: strokeColor,
          strokeWidth: 1,
          opacity: 0.5,
        })
      );
      group.add(
        new Konva.Line({
          points: [16, -16, -16, 16],
          stroke: strokeColor,
          strokeWidth: 1,
          opacity: 0.5,
        })
      );
      group.add(
        new Konva.Circle({
          x: 0,
          y: 0,
          radius: 3.5,
          fill: strokeColor,
        })
      );
    },
  },

  // 4. سخان مياه
  {
    id: 'plumb_water_heater',
    name: 'سخان مياه (Water Heater)',
    nameEn: 'Water Heater Boiler',
    category: 'plumb',
    defaultLayerId: 'plumb',
    description: 'سخان ماء كهربائي أسطواني جداري',
    wallMountable: true,
    defaultWidth: 24,
    defaultHeight: 24,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><circle cx="16" cy="16" r="12"/><text x="16" y="20" font-size="10" text-anchor="middle" font-weight="bold" fill="currentColor">WH</text></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Circle({
          x: 0,
          y: 0,
          radius: 12,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
        })
      );
      group.add(
        new Konva.Text({
          x: -8,
          y: -5,
          text: 'WH',
          fontSize: 10,
          fontFamily: 'monospace',
          fontStyle: 'bold',
          fill: strokeColor,
        })
      );
    },
  },

  // 5. خزان مياه
  {
    id: 'plumb_tank',
    name: 'خزان مياه (Water Tank)',
    nameEn: 'Water Storage Tank',
    category: 'plumb',
    defaultLayerId: 'plumb',
    description: 'خزان مياه علوي أو أرضي لتخزين المياه',
    wallMountable: false,
    defaultWidth: 36,
    defaultHeight: 36,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><circle cx="16" cy="16" r="13"/><circle cx="16" cy="16" r="8" stroke-dasharray="2 2"/></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Circle({
          x: 0,
          y: 0,
          radius: 16,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
        })
      );
      group.add(
        new Konva.Circle({
          x: 0,
          y: 0,
          radius: 10,
          stroke: strokeColor,
          strokeWidth: 1.5,
          dash: [3, 3],
        })
      );
    },
  },

  // 6. مضخة مياه
  {
    id: 'plumb_pump',
    name: 'مضخة مياه (Water Pump)',
    nameEn: 'Booster Water Pump',
    category: 'plumb',
    defaultLayerId: 'plumb',
    description: 'مضخة رفع أو ضغط شبكة المياه',
    wallMountable: false,
    defaultWidth: 24,
    defaultHeight: 24,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><circle cx="16" cy="16" r="10"/><polygon points="16,8 24,20 8,20" fill="currentColor"/></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Circle({
          x: 0,
          y: 0,
          radius: 11,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
        })
      );
      group.add(
        new Konva.Line({
          points: [0, -8, 7, 5, -7, 5],
          closed: true,
          fill: strokeColor,
        })
      );
    },
  },

  // 7. صمام / محبس
  {
    id: 'plumb_valve',
    name: 'صمام عزل (Gate Valve)',
    nameEn: 'Gate / Isolation Valve',
    category: 'plumb',
    defaultLayerId: 'plumb',
    description: 'محبس قفل وتحكم بمسار خطوط المياه',
    wallMountable: false,
    defaultWidth: 22,
    defaultHeight: 14,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><polygon points="6,10 6,22 16,16" fill="currentColor"/><polygon points="26,10 26,22 16,16" fill="currentColor"/></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Line({
          points: [-10, -6, -10, 6, 0, 0],
          closed: true,
          stroke: strokeColor,
          strokeWidth: 1.5,
          fill: strokeColor,
        })
      );
      group.add(
        new Konva.Line({
          points: [10, -6, 10, 6, 0, 0],
          closed: true,
          stroke: strokeColor,
          strokeWidth: 1.5,
          fill: strokeColor,
        })
      );
      group.add(
        new Konva.Line({
          points: [0, 0, 0, -8],
          stroke: strokeColor,
          strokeWidth: 1.5,
        })
      );
      group.add(
        new Konva.Line({
          points: [-4, -8, 4, -8],
          stroke: strokeColor,
          strokeWidth: 2,
        })
      );
    },
  },

  // 8. Check Valve
  {
    id: 'plumb_check_valve',
    name: 'صمام عدم رجوع (Check Valve)',
    nameEn: 'Non-Return Check Valve',
    category: 'plumb',
    defaultLayerId: 'plumb',
    description: 'يسمح بمرور المياه باتجاه واحد ويمنع الارتداد',
    wallMountable: false,
    defaultWidth: 22,
    defaultHeight: 14,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><polygon points="6,10 6,22 16,16" fill="currentColor"/><polygon points="26,10 26,22 16,16"/><line x1="26" y1="10" x2="26" y2="22" stroke-width="3"/></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Line({
          points: [-10, -6, -10, 6, 0, 0],
          closed: true,
          fill: strokeColor,
          stroke: strokeColor,
          strokeWidth: 1.5,
        })
      );
      group.add(
        new Konva.Line({
          points: [10, -6, 10, 6, 0, 0],
          closed: true,
          stroke: strokeColor,
          strokeWidth: 1.5,
        })
      );
      group.add(
        new Konva.Line({
          points: [10, -7, 10, 7],
          stroke: strokeColor,
          strokeWidth: 3,
        })
      );
    },
  },

  // 9. فلتر مياه
  {
    id: 'plumb_filter',
    name: 'فلتر مياه (Water Filter)',
    nameEn: 'Water Filtration Unit',
    category: 'plumb',
    defaultLayerId: 'plumb',
    description: 'وحدة تنقية وترشيح شوائب المياه',
    wallMountable: true,
    defaultWidth: 20,
    defaultHeight: 20,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><polygon points="16,4 28,16 16,28 4,16"/><text x="16" y="20" font-size="10" text-anchor="middle" font-weight="bold" fill="currentColor">F</text></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Line({
          points: [0, -10, 10, 0, 0, 10, -10, 0],
          closed: true,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
        })
      );
      group.add(
        new Konva.Text({
          x: -3,
          y: -5,
          text: 'F',
          fontSize: 10,
          fontFamily: 'monospace',
          fontStyle: 'bold',
          fill: strokeColor,
        })
      );
    },
  },

  // 10. عداد مياه
  {
    id: 'plumb_water_meter',
    name: 'عداد مياه (Water Meter)',
    nameEn: 'Water Flow Meter',
    category: 'plumb',
    defaultLayerId: 'plumb',
    description: 'عداد قياس استهلاك المياه على الخط الرئيسي',
    wallMountable: false,
    defaultWidth: 24,
    defaultHeight: 24,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><circle cx="16" cy="16" r="10"/><circle cx="16" cy="16" r="4"/><text x="16" y="20" font-size="9" text-anchor="middle" font-weight="bold" fill="currentColor">M</text></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Circle({
          x: 0,
          y: 0,
          radius: 11,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
        })
      );
      group.add(
        new Konva.Text({
          x: -4,
          y: -5,
          text: 'M',
          fontSize: 10,
          fontFamily: 'monospace',
          fontStyle: 'bold',
          fill: strokeColor,
        })
      );
      group.add(
        new Konva.Line({
          points: [-14, 0, -11, 0],
          stroke: strokeColor,
          strokeWidth: 2,
        })
      );
      group.add(
        new Konva.Line({
          points: [11, 0, 14, 0],
          stroke: strokeColor,
          strokeWidth: 2,
        })
      );
    },
  },

  // 11. صفاية أرضية (Floor Drain)
  {
    id: 'plumb_floor_drain',
    name: 'صفاية أرضية (Floor Drain)',
    nameEn: 'Floor Drain (FD)',
    category: 'plumb',
    defaultLayerId: 'plumb',
    description: 'بالوعة تصريف مياه أرضية مع حاجز مائي',
    wallMountable: false,
    defaultWidth: 20,
    defaultHeight: 20,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><circle cx="16" cy="16" r="10"/><circle cx="16" cy="16" r="4"/><line x1="6" y1="16" x2="26" y2="16"/><line x1="16" y1="6" x2="16" y2="26"/></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Circle({
          x: 0,
          y: 0,
          radius: 9,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
        })
      );
      group.add(
        new Konva.Circle({
          x: 0,
          y: 0,
          radius: 4,
          stroke: strokeColor,
          strokeWidth: 1.5,
          fill: strokeColor,
        })
      );
      group.add(
        new Konva.Line({
          points: [-9, 0, 9, 0],
          stroke: strokeColor,
          strokeWidth: 1.5,
        })
      );
      group.add(
        new Konva.Line({
          points: [0, -9, 0, 9],
          stroke: strokeColor,
          strokeWidth: 1.5,
        })
      );
    },
  },
];
