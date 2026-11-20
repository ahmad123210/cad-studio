/**
 * @file furniture.ts
 * @description مكتبة الرموز والفرش المعماري والأجهزة المنزلية (Architectural Furniture & Appliances)
 * رسومات ثنائية الأبعاد (2D) تخطيطية مبسطة بخطوط خارجية نقية وفق المعايير المعمارية العالمية.
 * القياسات مدروسة بدقة بمقياس الرسم الافتراضي (50 وحدة = 1 متر).
 */

import Konva from 'konva';
import { SymbolDefinition } from './types.ts';

export const FURNITURE_SYMBOLS: SymbolDefinition[] = [
  // ==========================================
  // قسم 1: الأجهزة المنزلية والمطبخ (Kitchen & Appliances)
  // ==========================================

  // 1. ثلاجة (Refrigerator)
  {
    id: 'furn_refrigerator',
    name: 'ثلاجة كهربائية',
    nameEn: 'Refrigerator',
    category: 'furniture',
    defaultLayerId: 'arch',
    description: 'ثلاجة ببابين مع خطوط تخطيطية للمقابض والأبواب (80×75 سم)',
    wallMountable: true,
    defaultWidth: 40,
    defaultHeight: 38,
    svgPreview: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="6" y="4" width="28" height="32" rx="2"/>
      <line x1="6" y1="16" x2="34" y2="16"/>
      <line x1="28" y1="8" x2="28" y2="13"/>
      <line x1="28" y1="19" x2="28" y2="28"/>
    </svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      const w = 40;
      const h = 38;
      // الإطار الخارجي
      group.add(new Konva.Rect({
        x: -w / 2,
        y: -h / 2,
        width: w,
        height: h,
        stroke: strokeColor,
        strokeWidth: 1.8,
        cornerRadius: 2,
      }));
      // فاصل البابين (فريزر وثلاجة)
      group.add(new Konva.Line({
        points: [-w / 2, -h / 2 + 14, w / 2, -h / 2 + 14],
        stroke: strokeColor,
        strokeWidth: 1.2,
      }));
      // المقابض
      group.add(new Konva.Line({
        points: [w / 2 - 6, -h / 2 + 4, w / 2 - 6, -h / 2 + 11],
        stroke: strokeColor,
        strokeWidth: 2,
        lineCap: 'round',
      }));
      group.add(new Konva.Line({
        points: [w / 2 - 6, -h / 2 + 18, w / 2 - 6, -h / 2 + 30],
        stroke: strokeColor,
        strokeWidth: 2,
        lineCap: 'round',
      }));
    },
  },

  // 2. غسالة ملابس (Washing Machine)
  {
    id: 'furn_washing_machine',
    name: 'غسالة ملابس',
    nameEn: 'Washing Machine',
    category: 'furniture',
    defaultLayerId: 'arch',
    description: 'غسالة ملابس أوتوماتيك مع حوض دائري ولوحة تحكم (60×60 سم)',
    wallMountable: true,
    defaultWidth: 30,
    defaultHeight: 30,
    svgPreview: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="5" y="5" width="30" height="30" rx="2"/>
      <circle cx="20" cy="22" r="8"/>
      <circle cx="20" cy="22" r="4" stroke-dasharray="2 2"/>
      <line x1="5" y1="11" x2="35" y2="11"/>
      <circle cx="28" cy="8" r="1.5" fill="currentColor"/>
    </svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      const s = 30;
      // الإطار الخارجي
      group.add(new Konva.Rect({
        x: -s / 2,
        y: -s / 2,
        width: s,
        height: s,
        stroke: strokeColor,
        strokeWidth: 1.8,
        cornerRadius: 2,
      }));
      // شريط لوحة التحكم العلوي
      group.add(new Konva.Line({
        points: [-s / 2, -s / 2 + 6, s / 2, -s / 2 + 6],
        stroke: strokeColor,
        strokeWidth: 1.2,
      }));
      // زر التشغيل
      group.add(new Konva.Circle({
        x: s / 2 - 6,
        y: -s / 2 + 3,
        radius: 1.5,
        fill: strokeColor,
      }));
      // الحوض الدائري الخارجي
      group.add(new Konva.Circle({
        x: 0,
        y: 4,
        radius: 8.5,
        stroke: strokeColor,
        strokeWidth: 1.5,
      }));
      // الحوض الداخلي
      group.add(new Konva.Circle({
        x: 0,
        y: 4,
        radius: 4.5,
        stroke: strokeColor,
        strokeWidth: 1,
        dash: [2, 2],
      }));
    },
  },

  // 3. غسالة صحون (Dishwasher)
  {
    id: 'furn_dishwasher',
    name: 'غسالة صحون',
    nameEn: 'Dishwasher',
    category: 'furniture',
    defaultLayerId: 'arch',
    description: 'غسالة أطباق مدمجة مع مقبض أمامي ولوحة علوية (60×60 سم)',
    wallMountable: true,
    defaultWidth: 30,
    defaultHeight: 30,
    svgPreview: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="5" y="5" width="30" height="30" rx="2"/>
      <line x1="5" y1="12" x2="35" y2="12"/>
      <line x1="12" y1="18" x2="28" y2="18"/>
      <circle cx="10" cy="8.5" r="1.5" fill="currentColor"/>
      <circle cx="15" cy="8.5" r="1.5" fill="currentColor"/>
    </svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      const s = 30;
      group.add(new Konva.Rect({
        x: -s / 2,
        y: -s / 2,
        width: s,
        height: s,
        stroke: strokeColor,
        strokeWidth: 1.8,
        cornerRadius: 2,
      }));
      group.add(new Konva.Line({
        points: [-s / 2, -s / 2 + 7, s / 2, -s / 2 + 7],
        stroke: strokeColor,
        strokeWidth: 1.2,
      }));
      group.add(new Konva.Line({
        points: [-s / 2 + 6, 2, s / 2 - 6, 2],
        stroke: strokeColor,
        strokeWidth: 2,
        lineCap: 'round',
      }));
      group.add(new Konva.Circle({
        x: -s / 2 + 6,
        y: -s / 2 + 3.5,
        radius: 1.2,
        fill: strokeColor,
      }));
      group.add(new Konva.Circle({
        x: -s / 2 + 11,
        y: -s / 2 + 3.5,
        radius: 1.2,
        fill: strokeColor,
      }));
    },
  },

  // 4. موقد غاز / طباخ (Cooking Stove / Gas Range)
  {
    id: 'furn_gas_stove',
    name: 'موقد غاز وطباخ',
    nameEn: 'Gas Stove / Cooktop',
    category: 'furniture',
    defaultLayerId: 'arch',
    description: 'طباخ غاز مع 4 عيون ومقابض تشغيل هندسية (75×60 سم)',
    wallMountable: true,
    defaultWidth: 38,
    defaultHeight: 30,
    svgPreview: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="4" y="6" width="32" height="28" rx="2"/>
      <circle cx="12" cy="16" r="4"/>
      <circle cx="28" cy="16" r="4"/>
      <circle cx="12" cy="26" r="3"/>
      <circle cx="28" cy="26" r="3"/>
      <circle cx="20" cy="21" r="2.5"/>
    </svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      const w = 38;
      const h = 30;
      // الإطار الخارجي
      group.add(new Konva.Rect({
        x: -w / 2,
        y: -h / 2,
        width: w,
        height: h,
        stroke: strokeColor,
        strokeWidth: 1.8,
        cornerRadius: 2,
      }));
      // لوحة التحكم الخلفية
      group.add(new Konva.Line({
        points: [-w / 2, -h / 2 + 5, w / 2, -h / 2 + 5],
        stroke: strokeColor,
        strokeWidth: 1,
      }));
      // العيون الأربعة + المركزية
      const burners = [
        { x: -9, y: -2, r: 4.5 },
        { x: 9, y: -2, r: 4.5 },
        { x: -9, y: 7, r: 3.5 },
        { x: 9, y: 7, r: 3.5 },
        { x: 0, y: 2.5, r: 3 },
      ];
      burners.forEach((b) => {
        group.add(new Konva.Circle({
          x: b.x,
          y: b.y,
          radius: b.r,
          stroke: strokeColor,
          strokeWidth: 1.2,
        }));
        // تقاطع المنتصف للعين
        group.add(new Konva.Line({
          points: [b.x - b.r * 0.6, b.y, b.x + b.r * 0.6, b.y],
          stroke: strokeColor,
          strokeWidth: 0.8,
        }));
        group.add(new Konva.Line({
          points: [b.x, b.y - b.r * 0.6, b.x, b.y + b.r * 0.6],
          stroke: strokeColor,
          strokeWidth: 0.8,
        }));
      });
    },
  },

  // 5. فرن وميكروويف مدمج (Oven / Microwave)
  {
    id: 'furn_oven',
    name: 'فرن وميكروويف مدمج',
    nameEn: 'Oven & Microwave',
    category: 'furniture',
    defaultLayerId: 'arch',
    description: 'وحدة فرن جداري مدمج مع نافذة زجاجية ومقبض (60×60 سم)',
    wallMountable: true,
    defaultWidth: 30,
    defaultHeight: 30,
    svgPreview: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="5" y="5" width="30" height="30" rx="2"/>
      <rect x="9" y="14" width="22" height="16" rx="1"/>
      <line x1="12" y1="9.5" x2="28" y2="9.5"/>
    </svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      const s = 30;
      group.add(new Konva.Rect({
        x: -s / 2,
        y: -s / 2,
        width: s,
        height: s,
        stroke: strokeColor,
        strokeWidth: 1.8,
        cornerRadius: 2,
      }));
      // نافذة الفرن
      group.add(new Konva.Rect({
        x: -s / 2 + 4,
        y: -s / 2 + 10,
        width: s - 8,
        height: s - 14,
        stroke: strokeColor,
        strokeWidth: 1.2,
        cornerRadius: 1,
      }));
      // مقبض الفرن
      group.add(new Konva.Line({
        points: [-s / 2 + 6, -s / 2 + 5, s / 2 - 6, -s / 2 + 5],
        stroke: strokeColor,
        strokeWidth: 2,
        lineCap: 'round',
      }));
    },
  },

  // ==========================================
  // قسم 2: أثاث غرف النوم (Beds & Bedroom)
  // ==========================================

  // 6. سرير مفرد (Single Bed)
  {
    id: 'furn_bed_single',
    name: 'سرير مفرد (Single Bed)',
    nameEn: 'Single Bed',
    category: 'furniture',
    defaultLayerId: 'arch',
    description: 'سرير نوم مفرد مع وسادة ومفرش هندسي تخطيطي (100×200 سم)',
    wallMountable: false,
    defaultWidth: 50,
    defaultHeight: 100,
    svgPreview: `<svg viewBox="0 0 32 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="4" y="2" width="24" height="44" rx="2"/>
      <rect x="8" y="6" width="16" height="8" rx="1"/>
      <line x1="4" y1="20" x2="28" y2="20"/>
    </svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      const w = 50;
      const h = 100;
      // إطار السرير
      group.add(new Konva.Rect({
        x: -w / 2,
        y: -h / 2,
        width: w,
        height: h,
        stroke: strokeColor,
        strokeWidth: 1.8,
        cornerRadius: 3,
      }));
      // لوح الرأس (Headboard)
      group.add(new Konva.Line({
        points: [-w / 2, -h / 2 + 6, w / 2, -h / 2 + 6],
        stroke: strokeColor,
        strokeWidth: 1.5,
      }));
      // الوسادة (Pillow)
      group.add(new Konva.Rect({
        x: -16,
        y: -h / 2 + 9,
        width: 32,
        height: 16,
        stroke: strokeColor,
        strokeWidth: 1.2,
        cornerRadius: 2,
      }));
      // خط طية المفرش / اللحاف (Duvet fold line)
      group.add(new Konva.Line({
        points: [-w / 2, -h / 2 + 38, w / 2, -h / 2 + 38],
        stroke: strokeColor,
        strokeWidth: 1.2,
      }));
      // خط هندسي خفيف لطيّة اللحاف
      group.add(new Konva.Line({
        points: [-w / 2 + 8, -h / 2 + 45, w / 2 - 8, -h / 2 + 45],
        stroke: strokeColor,
        strokeWidth: 0.8,
        dash: [4, 4],
      }));
    },
  },

  // 7. سرير مزدوج كوين (Double / Queen Bed)
  {
    id: 'furn_bed_double',
    name: 'سرير مزدوج (Double Bed)',
    nameEn: 'Double / Queen Bed',
    category: 'furniture',
    defaultLayerId: 'arch',
    description: 'سرير نوم مزدوج مع وسادتين ولوح رأس تخطيطي (160×200 سم)',
    wallMountable: false,
    defaultWidth: 80,
    defaultHeight: 100,
    svgPreview: `<svg viewBox="0 0 40 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="2" width="34" height="44" rx="2"/>
      <rect x="6" y="6" width="12" height="8" rx="1"/>
      <rect x="22" y="6" width="12" height="8" rx="1"/>
      <line x1="3" y1="20" x2="37" y2="20"/>
    </svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      const w = 80;
      const h = 100;
      // إطار السرير
      group.add(new Konva.Rect({
        x: -w / 2,
        y: -h / 2,
        width: w,
        height: h,
        stroke: strokeColor,
        strokeWidth: 2,
        cornerRadius: 3,
      }));
      // رأس السرير
      group.add(new Konva.Line({
        points: [-w / 2, -h / 2 + 7, w / 2, -h / 2 + 7],
        stroke: strokeColor,
        strokeWidth: 1.5,
      }));
      // وسادة 1 (يسار)
      group.add(new Konva.Rect({
        x: -w / 2 + 6,
        y: -h / 2 + 10,
        width: 30,
        height: 18,
        stroke: strokeColor,
        strokeWidth: 1.2,
        cornerRadius: 2,
      }));
      // وسادة 2 (يمين)
      group.add(new Konva.Rect({
        x: w / 2 - 36,
        y: -h / 2 + 10,
        width: 30,
        height: 18,
        stroke: strokeColor,
        strokeWidth: 1.2,
        cornerRadius: 2,
      }));
      // خط اللحاف
      group.add(new Konva.Line({
        points: [-w / 2, -h / 2 + 40, w / 2, -h / 2 + 40],
        stroke: strokeColor,
        strokeWidth: 1.4,
      }));
      group.add(new Konva.Line({
        points: [-w / 2 + 10, -h / 2 + 48, w / 2 - 10, -h / 2 + 48],
        stroke: strokeColor,
        strokeWidth: 0.9,
        dash: [4, 4],
      }));
    },
  },

  // 8. سرير ماستر كينج (King Bed)
  {
    id: 'furn_bed_king',
    name: 'سرير كينج ماستر (King Bed)',
    nameEn: 'King Master Bed',
    category: 'furniture',
    defaultLayerId: 'arch',
    description: 'سرير ماستر كبير فاخر مع وسائد ومسند رأس هندسي (200×200 سم)',
    wallMountable: false,
    defaultWidth: 100,
    defaultHeight: 100,
    svgPreview: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="2" width="42" height="44" rx="2"/>
      <rect x="6" y="6" width="16" height="8" rx="1"/>
      <rect x="26" y="6" width="16" height="8" rx="1"/>
      <line x1="3" y1="20" x2="45" y2="20"/>
    </svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      const s = 100;
      group.add(new Konva.Rect({
        x: -s / 2,
        y: -s / 2,
        width: s,
        height: s,
        stroke: strokeColor,
        strokeWidth: 2,
        cornerRadius: 3,
      }));
      group.add(new Konva.Line({
        points: [-s / 2, -s / 2 + 8, s / 2, -s / 2 + 8],
        stroke: strokeColor,
        strokeWidth: 1.8,
      }));
      // وسائد عريضة
      group.add(new Konva.Rect({
        x: -s / 2 + 8,
        y: -s / 2 + 12,
        width: 38,
        height: 20,
        stroke: strokeColor,
        strokeWidth: 1.2,
        cornerRadius: 2,
      }));
      group.add(new Konva.Rect({
        x: s / 2 - 46,
        y: -s / 2 + 12,
        width: 38,
        height: 20,
        stroke: strokeColor,
        strokeWidth: 1.2,
        cornerRadius: 2,
      }));
      group.add(new Konva.Line({
        points: [-s / 2, -s / 2 + 42, s / 2, -s / 2 + 42],
        stroke: strokeColor,
        strokeWidth: 1.4,
      }));
    },
  },

  // 9. طاولة سرير جانبية / كومودينو (Nightstand)
  {
    id: 'furn_nightstand',
    name: 'طاولة سرير جانبية (كومودينة)',
    nameEn: 'Nightstand / Bedside Table',
    category: 'furniture',
    defaultLayerId: 'arch',
    description: 'طاولة نوم جانبية مربعة مع درج تخطيطي (45×45 سم)',
    wallMountable: true,
    defaultWidth: 22,
    defaultHeight: 22,
    svgPreview: `<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="4" y="4" width="28" height="28" rx="2"/>
      <line x1="4" y1="14" x2="32" y2="14"/>
      <circle cx="18" cy="9" r="1.5" fill="currentColor"/>
    </svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      const s = 22;
      group.add(new Konva.Rect({
        x: -s / 2,
        y: -s / 2,
        width: s,
        height: s,
        stroke: strokeColor,
        strokeWidth: 1.6,
        cornerRadius: 2,
      }));
      group.add(new Konva.Line({
        points: [-s / 2, -s / 2 + 6, s / 2, -s / 2 + 6],
        stroke: strokeColor,
        strokeWidth: 1,
      }));
      group.add(new Konva.Line({
        points: [-4, -s / 2 + 3, 4, -s / 2 + 3],
        stroke: strokeColor,
        strokeWidth: 1.6,
        lineCap: 'round',
      }));
    },
  },

  // 10. خزانة ملابس ودولاب (Wardrobe / Closet)
  {
    id: 'furn_wardrobe',
    name: 'خزانة ملابس (دولاب)',
    nameEn: 'Wardrobe / Closet',
    category: 'furniture',
    defaultLayerId: 'arch',
    description: 'دولاب ملابس جداري بأبواب تخطيطية ومقابض هندسية (180×60 سم)',
    wallMountable: true,
    defaultWidth: 90,
    defaultHeight: 30,
    svgPreview: `<svg viewBox="0 0 48 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="2" width="44" height="20" rx="1"/>
      <line x1="16" y1="2" x2="16" y2="22"/>
      <line x1="32" y1="2" x2="32" y2="22"/>
      <line x1="14" y1="10" x2="14" y2="14"/>
      <line x1="18" y1="10" x2="18" y2="14"/>
      <line x1="30" y1="10" x2="30" y2="14"/>
    </svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      const w = 90;
      const h = 30;
      group.add(new Konva.Rect({
        x: -w / 2,
        y: -h / 2,
        width: w,
        height: h,
        stroke: strokeColor,
        strokeWidth: 1.8,
        cornerRadius: 1,
      }));
      // فواصل الأبواب الثلاثة
      const d1 = -w / 2 + w / 3;
      const d2 = -w / 2 + (2 * w) / 3;
      group.add(new Konva.Line({
        points: [d1, -h / 2, d1, h / 2],
        stroke: strokeColor,
        strokeWidth: 1.2,
      }));
      group.add(new Konva.Line({
        points: [d2, -h / 2, d2, h / 2],
        stroke: strokeColor,
        strokeWidth: 1.2,
      }));
      // مقابض الأبواب
      group.add(new Konva.Line({
        points: [d1 - 3, -4, d1 - 3, 4],
        stroke: strokeColor,
        strokeWidth: 1.8,
        lineCap: 'round',
      }));
      group.add(new Konva.Line({
        points: [d1 + 3, -4, d1 + 3, 4],
        stroke: strokeColor,
        strokeWidth: 1.8,
        lineCap: 'round',
      }));
      group.add(new Konva.Line({
        points: [d2 + 3, -4, d2 + 3, 4],
        stroke: strokeColor,
        strokeWidth: 1.8,
        lineCap: 'round',
      }));
    },
  },

  // ==========================================
  // قسم 3: المعيشة والصالون (Living Room & Sofas)
  // ==========================================

  // 11. مقعد مفرد / كرسي بذراعين (Single Armchair)
  {
    id: 'furn_armchair',
    name: 'كرسي بذراعين (Armchair)',
    nameEn: 'Single Armchair',
    category: 'furniture',
    defaultLayerId: 'arch',
    description: 'مقعد صالون مفرد مريح مع مساند لليدين ووسادة جلوس (80×80 سم)',
    wallMountable: false,
    defaultWidth: 40,
    defaultHeight: 40,
    svgPreview: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="6" y="6" width="28" height="28" rx="4"/>
      <rect x="11" y="11" width="18" height="18" rx="2"/>
      <line x1="6" y1="12" x2="11" y2="12"/>
      <line x1="29" y1="12" x2="34" y2="12"/>
    </svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      const s = 40;
      // الإطار الخارجي
      group.add(new Konva.Rect({
        x: -s / 2,
        y: -s / 2,
        width: s,
        height: s,
        stroke: strokeColor,
        strokeWidth: 1.8,
        cornerRadius: 4,
      }));
      // وسادة الجلوس الداخلية
      group.add(new Konva.Rect({
        x: -s / 2 + 7,
        y: -s / 2 + 8,
        width: s - 14,
        height: s - 14,
        stroke: strokeColor,
        strokeWidth: 1.2,
        cornerRadius: 2,
      }));
      // مسند الظهر العلوي
      group.add(new Konva.Line({
        points: [-s / 2 + 7, -s / 2 + 8, s / 2 - 7, -s / 2 + 8],
        stroke: strokeColor,
        strokeWidth: 1.4,
      }));
    },
  },

  // 12. كنب صالة ثنائي (2-Seater Sofa)
  {
    id: 'furn_sofa_2seat',
    name: 'كنب صالة ثنائي (2-Seater Sofa)',
    nameEn: '2-Seater Sofa',
    category: 'furniture',
    defaultLayerId: 'arch',
    description: 'أريكة صالون لشخصين مع مساند جانبية ومسند ظهر (150×80 سم)',
    wallMountable: false,
    defaultWidth: 75,
    defaultHeight: 40,
    svgPreview: `<svg viewBox="0 0 48 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="4" width="42" height="24" rx="3"/>
      <line x1="24" y1="10" x2="24" y2="28"/>
      <rect x="9" y="10" width="30" height="18" rx="1"/>
    </svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      const w = 75;
      const h = 40;
      // الإطار الخارجي
      group.add(new Konva.Rect({
        x: -w / 2,
        y: -h / 2,
        width: w,
        height: h,
        stroke: strokeColor,
        strokeWidth: 1.8,
        cornerRadius: 4,
      }));
      // مساند الذراعين الجانبية
      group.add(new Konva.Rect({
        x: -w / 2 + 2,
        y: -h / 2 + 2,
        width: 8,
        height: h - 4,
        stroke: strokeColor,
        strokeWidth: 1.2,
        cornerRadius: 2,
      }));
      group.add(new Konva.Rect({
        x: w / 2 - 10,
        y: -h / 2 + 2,
        width: 8,
        height: h - 4,
        stroke: strokeColor,
        strokeWidth: 1.2,
        cornerRadius: 2,
      }));
      // وسائد الجلوس (مقسمة لوسادتين)
      const seatW = (w - 24) / 2;
      group.add(new Konva.Rect({
        x: -w / 2 + 12,
        y: -h / 2 + 9,
        width: seatW,
        height: h - 14,
        stroke: strokeColor,
        strokeWidth: 1.2,
        cornerRadius: 2,
      }));
      group.add(new Konva.Rect({
        x: -w / 2 + 12 + seatW,
        y: -h / 2 + 9,
        width: seatW,
        height: h - 14,
        stroke: strokeColor,
        strokeWidth: 1.2,
        cornerRadius: 2,
      }));
    },
  },

  // 13. كنب صالة ثلاثي (3-Seater Sofa)
  {
    id: 'furn_sofa_3seat',
    name: 'كنب صالة ثلاثي (3-Seater Sofa)',
    nameEn: '3-Seater Sofa',
    category: 'furniture',
    defaultLayerId: 'arch',
    description: 'أريكة صالون كبيرة لثلاثة أشخاص مع مساند ووسائد هندسية (210×85 سم)',
    wallMountable: false,
    defaultWidth: 105,
    defaultHeight: 42,
    svgPreview: `<svg viewBox="0 0 54 28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="3" width="50" height="22" rx="3"/>
      <line x1="19" y1="9" x2="19" y2="25"/>
      <line x1="35" y1="9" x2="35" y2="25"/>
      <line x1="8" y1="9" x2="46" y2="9"/>
    </svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      const w = 105;
      const h = 42;
      group.add(new Konva.Rect({
        x: -w / 2,
        y: -h / 2,
        width: w,
        height: h,
        stroke: strokeColor,
        strokeWidth: 2,
        cornerRadius: 4,
      }));
      // مساند الذراعين
      group.add(new Konva.Rect({
        x: -w / 2 + 2,
        y: -h / 2 + 2,
        width: 10,
        height: h - 4,
        stroke: strokeColor,
        strokeWidth: 1.2,
        cornerRadius: 2,
      }));
      group.add(new Konva.Rect({
        x: w / 2 - 12,
        y: -h / 2 + 2,
        width: 10,
        height: h - 4,
        stroke: strokeColor,
        strokeWidth: 1.2,
        cornerRadius: 2,
      }));
      // وسائد الجلوس الثلاثية
      const seatW = (w - 28) / 3;
      for (let i = 0; i < 3; i++) {
        group.add(new Konva.Rect({
          x: -w / 2 + 14 + i * seatW,
          y: -h / 2 + 10,
          width: seatW,
          height: h - 15,
          stroke: strokeColor,
          strokeWidth: 1.2,
          cornerRadius: 2,
        }));
      }
    },
  },

  // 14. كنب زاوية L (L-Shaped Sectional Sofa)
  {
    id: 'furn_sofa_corner',
    name: 'كنب صالة زاوية (L-Shaped Sectional)',
    nameEn: 'L-Shaped Sectional Sofa',
    category: 'furniture',
    defaultLayerId: 'arch',
    description: 'كنب زاوية ركنية على شكل حرف L مع خطوط وسائد نظيفة (240×180 سم)',
    wallMountable: false,
    defaultWidth: 120,
    defaultHeight: 90,
    svgPreview: `<svg viewBox="0 0 48 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 4h40v16h-22v16h-18z"/>
      <path d="M10 10h28v6h-18v18h-10z"/>
    </svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      const w = 120;
      const h = 90;
      const depth = 38;

      // مسار الإطار الخارجي للحرف L
      group.add(new Konva.Line({
        points: [
          -w / 2, -h / 2,
          w / 2, -h / 2,
          w / 2, -h / 2 + depth,
          -w / 2 + depth, -h / 2 + depth,
          -w / 2 + depth, h / 2,
          -w / 2, h / 2,
        ],
        closed: true,
        stroke: strokeColor,
        strokeWidth: 2,
        lineJoin: 'round',
      }));

      // خطوط وسائد الجلوس الداخلية
      group.add(new Konva.Line({
        points: [-w / 2 + 10, -h / 2 + 10, w / 2 - 10, -h / 2 + 10],
        stroke: strokeColor,
        strokeWidth: 1.2,
      }));
      group.add(new Konva.Line({
        points: [-w / 2 + 10, -h / 2 + 10, -w / 2 + 10, h / 2 - 10],
        stroke: strokeColor,
        strokeWidth: 1.2,
      }));

      // فواصل مقاعد الجلوس
      group.add(new Konva.Line({
        points: [0, -h / 2 + 10, 0, -h / 2 + depth],
        stroke: strokeColor,
        strokeWidth: 1,
      }));
      group.add(new Konva.Line({
        points: [-w / 2 + depth, 10, -w / 2 + 10, 10],
        stroke: strokeColor,
        strokeWidth: 1,
      }));
    },
  },

  // 15. طاولة قهوة صالون (Coffee Table)
  {
    id: 'furn_coffee_table',
    name: 'طاولة قهوة صالون',
    nameEn: 'Coffee Table',
    category: 'furniture',
    defaultLayerId: 'arch',
    description: 'طاولة وسط مستطيلة بتصميم هندسي نظيف لغرف المعيشة (100×50 سم)',
    wallMountable: false,
    defaultWidth: 50,
    defaultHeight: 25,
    svgPreview: `<svg viewBox="0 0 44 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="4" y="4" width="36" height="16" rx="2"/>
      <rect x="8" y="7" width="28" height="10" rx="1" stroke-dasharray="2 2"/>
    </svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      const w = 50;
      const h = 25;
      group.add(new Konva.Rect({
        x: -w / 2,
        y: -h / 2,
        width: w,
        height: h,
        stroke: strokeColor,
        strokeWidth: 1.8,
        cornerRadius: 3,
      }));
      group.add(new Konva.Rect({
        x: -w / 2 + 4,
        y: -h / 2 + 4,
        width: w - 8,
        height: h - 8,
        stroke: strokeColor,
        strokeWidth: 1,
        dash: [3, 3],
        cornerRadius: 2,
      }));
    },
  },

  // 16. طاولة تلفاز ووحدة ترفيه (TV Console / Media Unit)
  {
    id: 'furn_tv_unit',
    name: 'طاولة تلفزيون ووحدة ميديا',
    nameEn: 'TV Unit & Media Console',
    category: 'furniture',
    defaultLayerId: 'arch',
    description: 'طاولة تلفزيون جدارية نحيفة مع رمز تخطيطي للشاشة (160×40 سم)',
    wallMountable: true,
    defaultWidth: 80,
    defaultHeight: 20,
    svgPreview: `<svg viewBox="0 0 48 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="2" width="44" height="16" rx="1"/>
      <line x1="8" y1="10" x2="40" y2="10" stroke-width="3"/>
    </svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      const w = 80;
      const h = 20;
      group.add(new Konva.Rect({
        x: -w / 2,
        y: -h / 2,
        width: w,
        height: h,
        stroke: strokeColor,
        strokeWidth: 1.6,
        cornerRadius: 1,
      }));
      // رمز الشاشة (Screen line)
      group.add(new Konva.Line({
        points: [-w / 2 + 14, 0, w / 2 - 14, 0],
        stroke: strokeColor,
        strokeWidth: 3,
        lineCap: 'round',
      }));
      // قاعدة الشاشة
      group.add(new Konva.Line({
        points: [-6, 4, 6, 4],
        stroke: strokeColor,
        strokeWidth: 1.4,
      }));
    },
  },

  // ==========================================
  // قسم 4: طاولات الطعام والمكاتب (Dining & Workspaces)
  // ==========================================

  // 17. طاولة طعام مع 4 كراسي (Dining Table 4-Seater)
  {
    id: 'furn_dining_4seat',
    name: 'طاولة طعام مع 4 كراسي',
    nameEn: 'Dining Table (4-Seater)',
    category: 'furniture',
    defaultLayerId: 'arch',
    description: 'طاولة طعام مستطيلة مع أربعة كراسي محيطة تخطيطية (120×80 سم)',
    wallMountable: false,
    defaultWidth: 70,
    defaultHeight: 55,
    svgPreview: `<svg viewBox="0 0 44 36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="10" y="8" width="24" height="20" rx="2"/>
      <rect x="14" y="2" width="16" height="4" rx="1"/>
      <rect x="14" y="30" width="16" height="4" rx="1"/>
      <rect x="4" y="12" width="4" height="12" rx="1"/>
      <rect x="36" y="12" width="4" height="12" rx="1"/>
    </svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      const tw = 46;
      const th = 32;
      // الطاولة المركزية
      group.add(new Konva.Rect({
        x: -tw / 2,
        y: -th / 2,
        width: tw,
        height: th,
        stroke: strokeColor,
        strokeWidth: 1.8,
        cornerRadius: 3,
      }));
      // الكرسي العلوي
      group.add(new Konva.Rect({
        x: -10,
        y: -th / 2 - 9,
        width: 20,
        height: 7,
        stroke: strokeColor,
        strokeWidth: 1.2,
        cornerRadius: 1,
      }));
      // الكرسي السفلي
      group.add(new Konva.Rect({
        x: -10,
        y: th / 2 + 2,
        width: 20,
        height: 7,
        stroke: strokeColor,
        strokeWidth: 1.2,
        cornerRadius: 1,
      }));
      // الكرسي الأيسر
      group.add(new Konva.Rect({
        x: -tw / 2 - 9,
        y: -7,
        width: 7,
        height: 14,
        stroke: strokeColor,
        strokeWidth: 1.2,
        cornerRadius: 1,
      }));
      // الكرسي الأيمن
      group.add(new Konva.Rect({
        x: tw / 2 + 2,
        y: -7,
        width: 7,
        height: 14,
        stroke: strokeColor,
        strokeWidth: 1.2,
        cornerRadius: 1,
      }));
    },
  },

  // 18. طاولة طعام عائلية مع 6 كراسي (Dining Table 6-Seater)
  {
    id: 'furn_dining_6seat',
    name: 'طاولة طعام مع 6 كراسي',
    nameEn: 'Dining Table (6-Seater)',
    category: 'furniture',
    defaultLayerId: 'arch',
    description: 'طاولة سفرة عائلية كبيرة مع 6 كراسي هندسية (160×90 سم)',
    wallMountable: false,
    defaultWidth: 90,
    defaultHeight: 60,
    svgPreview: `<svg viewBox="0 0 48 36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="8" y="8" width="32" height="20" rx="2"/>
      <rect x="12" y="2" width="10" height="4" rx="1"/>
      <rect x="26" y="2" width="10" height="4" rx="1"/>
      <rect x="12" y="30" width="10" height="4" rx="1"/>
      <rect x="26" y="30" width="10" height="4" rx="1"/>
      <rect x="2" y="13" width="4" height="10" rx="1"/>
      <rect x="42" y="13" width="4" height="10" rx="1"/>
    </svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      const tw = 65;
      const th = 36;
      // الطاولة المركزية
      group.add(new Konva.Rect({
        x: -tw / 2,
        y: -th / 2,
        width: tw,
        height: th,
        stroke: strokeColor,
        strokeWidth: 2,
        cornerRadius: 3,
      }));
      // كراسي علوية (2)
      group.add(new Konva.Rect({
        x: -22,
        y: -th / 2 - 9,
        width: 18,
        height: 7,
        stroke: strokeColor,
        strokeWidth: 1.2,
        cornerRadius: 1,
      }));
      group.add(new Konva.Rect({
        x: 4,
        y: -th / 2 - 9,
        width: 18,
        height: 7,
        stroke: strokeColor,
        strokeWidth: 1.2,
        cornerRadius: 1,
      }));
      // كراسي سفلية (2)
      group.add(new Konva.Rect({
        x: -22,
        y: th / 2 + 2,
        width: 18,
        height: 7,
        stroke: strokeColor,
        strokeWidth: 1.2,
        cornerRadius: 1,
      }));
      group.add(new Konva.Rect({
        x: 4,
        y: th / 2 + 2,
        width: 18,
        height: 7,
        stroke: strokeColor,
        strokeWidth: 1.2,
        cornerRadius: 1,
      }));
      // كرسي أيسر
      group.add(new Konva.Rect({
        x: -tw / 2 - 9,
        y: -8,
        width: 7,
        height: 16,
        stroke: strokeColor,
        strokeWidth: 1.2,
        cornerRadius: 1,
      }));
      // كرسي أيمن
      group.add(new Konva.Rect({
        x: tw / 2 + 2,
        y: -8,
        width: 7,
        height: 16,
        stroke: strokeColor,
        strokeWidth: 1.2,
        cornerRadius: 1,
      }));
    },
  },

  // 19. مكتب عمل ودراسة مع كرسي (Office Desk & Chair)
  {
    id: 'furn_desk_office',
    name: 'مكتب عمل مع كرسي',
    nameEn: 'Office Desk & Chair',
    category: 'furniture',
    defaultLayerId: 'arch',
    description: 'مكتب دراسة وعمل مع أدراج وكرسي دوار تخطيطي (140×70 سم)',
    wallMountable: true,
    defaultWidth: 70,
    defaultHeight: 50,
    svgPreview: `<svg viewBox="0 0 44 36" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="4" y="4" width="36" height="18" rx="2"/>
      <line x1="28" y1="4" x2="28" y2="22"/>
      <circle cx="16" cy="28" r="5"/>
      <line x1="16" y1="28" x2="16" y2="33"/>
    </svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      const dw = 70;
      const dh = 35;
      // سطح المكتب
      group.add(new Konva.Rect({
        x: -dw / 2,
        y: -dh / 2 - 8,
        width: dw,
        height: dh,
        stroke: strokeColor,
        strokeWidth: 1.8,
        cornerRadius: 2,
      }));
      // وحدة الأدراج الجانبية
      group.add(new Konva.Line({
        points: [dw / 2 - 18, -dh / 2 - 8, dw / 2 - 18, dh / 2 - 8],
        stroke: strokeColor,
        strokeWidth: 1.2,
      }));
      group.add(new Konva.Line({
        points: [dw / 2 - 14, -dh / 2 + 2, dw / 2 - 4, -dh / 2 + 2],
        stroke: strokeColor,
        strokeWidth: 1.4,
      }));
      // الكرسي
      group.add(new Konva.Circle({
        x: -6,
        y: dh / 2 + 4,
        radius: 8,
        stroke: strokeColor,
        strokeWidth: 1.4,
      }));
      // مسند ظهر الكرسي
      group.add(new Konva.Line({
        points: [-13, dh / 2 + 10, 1, dh / 2 + 10],
        stroke: strokeColor,
        strokeWidth: 2,
        lineCap: 'round',
      }));
    },
  },

  // 20. كرسي مفرد (Single Chair)
  {
    id: 'furn_chair_single',
    name: 'كرسي مفرد (Chair)',
    nameEn: 'Single Chair',
    category: 'furniture',
    defaultLayerId: 'arch',
    description: 'كرسي طعام أو مكتب مفرد تخطيطي بمسند ظهر مقوس (45×45 سم)',
    wallMountable: false,
    defaultWidth: 22,
    defaultHeight: 22,
    svgPreview: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="6" y="8" width="20" height="18" rx="2"/>
      <line x1="6" y1="12" x2="26" y2="12"/>
      <line x1="6" y1="8" x2="26" y2="8" stroke-width="3"/>
    </svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      const s = 22;
      group.add(new Konva.Rect({
        x: -s / 2,
        y: -s / 2 + 2,
        width: s,
        height: s - 2,
        stroke: strokeColor,
        strokeWidth: 1.5,
        cornerRadius: 3,
      }));
      // مسند الظهر العلوي
      group.add(new Konva.Line({
        points: [-s / 2, -s / 2 + 2, s / 2, -s / 2 + 2],
        stroke: strokeColor,
        strokeWidth: 2.5,
        lineCap: 'round',
      }));
    },
  },

  // ==========================================
  // قسم 5: الأجهزة والتجهيزات الصحية (Sanitary & Bath)
  // ==========================================

  // 21. مرحاض إفرنجي مع سيفون (Water Closet / Toilet)
  {
    id: 'furn_toilet_wc',
    name: 'مرحاض إفرنجي (Toilet WC)',
    nameEn: 'Water Closet / Toilet',
    category: 'furniture',
    defaultLayerId: 'arch',
    description: 'مرحاض إفرنجي مع صندوق طرد (سيفون) وقاعدة بيضاوية هندسية (40×70 سم)',
    wallMountable: true,
    defaultWidth: 20,
    defaultHeight: 35,
    svgPreview: `<svg viewBox="0 0 32 44" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="4" y="4" width="24" height="10" rx="2"/>
      <ellipse cx="16" cy="27" rx="9" ry="13"/>
      <ellipse cx="16" cy="27" rx="6" ry="9" stroke-dasharray="2 2"/>
    </svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      const tw = 20;
      const th = 35;
      // صندوق الطرد الخلفي (Water Tank)
      group.add(new Konva.Rect({
        x: -tw / 2,
        y: -th / 2,
        width: tw,
        height: 10,
        stroke: strokeColor,
        strokeWidth: 1.8,
        cornerRadius: 2,
      }));
      // زر الطرد
      group.add(new Konva.Circle({
        x: 0,
        y: -th / 2 + 5,
        radius: 1.8,
        stroke: strokeColor,
        strokeWidth: 1,
      }));
      // قاعدة المرحاض البيضاوية (Bowl)
      group.add(new Konva.Ellipse({
        x: 0,
        y: 5,
        radiusX: 8.5,
        radiusY: 12.5,
        stroke: strokeColor,
        strokeWidth: 1.8,
      }));
      // فتحة الصرف الداخلية
      group.add(new Konva.Ellipse({
        x: 0,
        y: 6,
        radiusX: 5,
        radiusY: 8,
        stroke: strokeColor,
        strokeWidth: 1,
        dash: [2, 2],
      }));
    },
  },

  // 22. مغسلة يدين بحوض (Bathroom Vanity / Washbasin)
  {
    id: 'furn_washbasin',
    name: 'مغسلة يدين وحوض (Washbasin)',
    nameEn: 'Washbasin / Vanity',
    category: 'furniture',
    defaultLayerId: 'arch',
    description: 'مغسلة يدين جدارية مع حوض بيضاوي وصنبور ماء هندسي (60×50 سم)',
    wallMountable: true,
    defaultWidth: 30,
    defaultHeight: 25,
    svgPreview: `<svg viewBox="0 0 40 34" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="4" y="4" width="32" height="26" rx="3"/>
      <ellipse cx="20" cy="18" rx="11" ry="8"/>
      <circle cx="20" cy="9" r="1.5" fill="currentColor"/>
    </svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      const w = 30;
      const h = 25;
      group.add(new Konva.Rect({
        x: -w / 2,
        y: -h / 2,
        width: w,
        height: h,
        stroke: strokeColor,
        strokeWidth: 1.8,
        cornerRadius: 3,
      }));
      // حوض المغسلة البيضاوي
      group.add(new Konva.Ellipse({
        x: 0,
        y: 2,
        radiusX: 10,
        radiusY: 7,
        stroke: strokeColor,
        strokeWidth: 1.2,
      }));
      // الصنبور (خلاط المياه)
      group.add(new Konva.Circle({
        x: 0,
        y: -h / 2 + 4,
        radius: 1.5,
        fill: strokeColor,
      }));
      group.add(new Konva.Line({
        points: [0, -h / 2 + 4, 0, -h / 2 + 8],
        stroke: strokeColor,
        strokeWidth: 2,
      }));
    },
  },

  // 23. حوض استحمام بانيو (Bathtub)
  {
    id: 'furn_bathtub',
    name: 'حوض استحمام (بانيو)',
    nameEn: 'Bathtub',
    category: 'furniture',
    defaultLayerId: 'arch',
    description: 'بانيو استحمام مستطيل بحواف مريحة ومصفاة مياه (170×75 سم)',
    wallMountable: true,
    defaultWidth: 85,
    defaultHeight: 38,
    svgPreview: `<svg viewBox="0 0 48 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="2" width="44" height="20" rx="3"/>
      <rect x="6" y="5" width="36" height="14" rx="6"/>
      <circle cx="11" cy="12" r="2"/>
    </svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      const w = 85;
      const h = 38;
      // الإطار الخارجي
      group.add(new Konva.Rect({
        x: -w / 2,
        y: -h / 2,
        width: w,
        height: h,
        stroke: strokeColor,
        strokeWidth: 2,
        cornerRadius: 3,
      }));
      // التجويف الداخلي للبانيو بنهايات مقوسة
      group.add(new Konva.Rect({
        x: -w / 2 + 6,
        y: -h / 2 + 4,
        width: w - 12,
        height: h - 8,
        stroke: strokeColor,
        strokeWidth: 1.3,
        cornerRadius: 12,
      }));
      // فتحة تصريف المياه (Drain)
      group.add(new Konva.Circle({
        x: -w / 2 + 16,
        y: 0,
        radius: 2.5,
        stroke: strokeColor,
        strokeWidth: 1.2,
      }));
    },
  },

  // 24. كابينة استحمام شاور (Shower Enclosure)
  {
    id: 'furn_shower',
    name: 'كابينة استحمام (شاور)',
    nameEn: 'Shower Enclosure',
    category: 'furniture',
    defaultLayerId: 'arch',
    description: 'كابينة شاور زجاجية مربعة مع صفّاية أرضية ومقبض باب (90×90 سم)',
    wallMountable: true,
    defaultWidth: 45,
    defaultHeight: 45,
    svgPreview: `<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="4" y="4" width="32" height="32" rx="2"/>
      <line x1="4" y1="4" x2="36" y2="36" stroke-dasharray="3 3"/>
      <circle cx="20" cy="20" r="3"/>
    </svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      const s = 45;
      group.add(new Konva.Rect({
        x: -s / 2,
        y: -s / 2,
        width: s,
        height: s,
        stroke: strokeColor,
        strokeWidth: 1.8,
        cornerRadius: 2,
      }));
      // صفّاية الشاور في المنتصف
      group.add(new Konva.Circle({
        x: 0,
        y: 0,
        radius: 3.5,
        stroke: strokeColor,
        strokeWidth: 1.2,
      }));
      // خطوط ميل الأرضية المتقطعة
      group.add(new Konva.Line({
        points: [-s / 2 + 3, -s / 2 + 3, -4, -4],
        stroke: strokeColor,
        strokeWidth: 0.8,
        dash: [3, 3],
      }));
      group.add(new Konva.Line({
        points: [s / 2 - 3, -s / 2 + 3, 4, -4],
        stroke: strokeColor,
        strokeWidth: 0.8,
        dash: [3, 3],
      }));
      group.add(new Konva.Line({
        points: [-s / 2 + 3, s / 2 - 3, -4, 4],
        stroke: strokeColor,
        strokeWidth: 0.8,
        dash: [3, 3],
      }));
      group.add(new Konva.Line({
        points: [s / 2 - 3, s / 2 - 3, 4, 4],
        stroke: strokeColor,
        strokeWidth: 0.8,
        dash: [3, 3],
      }));
    },
  },
];
