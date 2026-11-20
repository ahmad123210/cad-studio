/**
 * @file hvac.ts
 * @description مكتبة رموز التكييف والتهوية (HVAC Symbols Library)
 * تشمل جميع الرموز المطلوبة بالدستور التقني (5 رموز معمارية وميكانيكية)
 */

import Konva from 'konva';
import { SymbolDefinition } from './types.ts';

export const HVAC_SYMBOLS: SymbolDefinition[] = [
  // 1. مكيف سبليت (Split AC)
  {
    id: 'hvac_split_ac',
    name: 'مكيف سبليت (Split AC)',
    nameEn: 'Indoor Wall Split Unit',
    category: 'hvac',
    defaultLayerId: 'hvac',
    description: 'وحدة تكييف داخلية جدارية مع موزع الهواء',
    wallMountable: true,
    defaultWidth: 40,
    defaultHeight: 14,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><rect x="2" y="8" width="28" height="16" rx="2"/><line x1="6" y1="20" x2="26" y2="20"/><text x="16" y="16" font-size="7" text-anchor="middle" font-weight="bold" fill="currentColor">AC</text></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Rect({
          x: -20,
          y: -14,
          width: 40,
          height: 14,
          stroke: strokeColor,
          strokeWidth: 2,
          cornerRadius: 2,
          fill: '#1e293b',
        })
      );
      // شفرة توزيع الهواء الأمامية الموجهة للغرفة
      group.add(
        new Konva.Line({
          points: [-16, -4, 16, -4],
          stroke: strokeColor,
          strokeWidth: 2,
        })
      );
      group.add(
        new Konva.Text({
          x: -7,
          y: -11,
          text: 'AC',
          fontSize: 8,
          fontFamily: 'monospace',
          fontStyle: 'bold',
          fill: strokeColor,
        })
      );
    },
  },

  // 2. وحدة FCU (Fan Coil Unit)
  {
    id: 'hvac_fcu',
    name: 'وحدة FCU (Fan Coil Unit)',
    nameEn: 'Ceiling Concealed FCU',
    category: 'hvac',
    defaultLayerId: 'hvac',
    description: 'وحدة تكييف مدمجة داخل السقف المستعار',
    wallMountable: false,
    defaultWidth: 36,
    defaultHeight: 24,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="6" width="26" height="20"/><line x1="3" y1="6" x2="29" y2="26"/><line x1="29" y1="6" x2="3" y2="26"/><text x="16" y="18" font-size="7" text-anchor="middle" font-weight="bold" fill="currentColor">FCU</text></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Rect({
          x: -18,
          y: -12,
          width: 36,
          height: 24,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
        })
      );
      group.add(
        new Konva.Line({
          points: [-18, -12, 18, 12],
          stroke: strokeColor,
          strokeWidth: 1,
          opacity: 0.6,
        })
      );
      group.add(
        new Konva.Line({
          points: [18, -12, -18, 12],
          stroke: strokeColor,
          strokeWidth: 1,
          opacity: 0.6,
        })
      );
      group.add(
        new Konva.Text({
          x: -10,
          y: -4,
          text: 'FCU',
          fontSize: 9,
          fontFamily: 'monospace',
          fontStyle: 'bold',
          fill: strokeColor,
        })
      );
    },
  },

  // 3. وحدة AHU (Air Handling Unit)
  {
    id: 'hvac_ahu',
    name: 'وحدة مناولة هواء (AHU)',
    nameEn: 'Air Handling Unit (AHU)',
    category: 'hvac',
    defaultLayerId: 'hvac',
    description: 'وحدة معالجة وتكييف الهواء المركزي الكبيرة',
    wallMountable: false,
    defaultWidth: 46,
    defaultHeight: 28,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><rect x="2" y="6" width="28" height="20"/><line x1="16" y1="6" x2="16" y2="26"/><circle cx="9" cy="16" r="4"/><text x="23" y="19" font-size="7" text-anchor="middle" font-weight="bold" fill="currentColor">AHU</text></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Rect({
          x: -23,
          y: -14,
          width: 46,
          height: 28,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
        })
      );
      group.add(
        new Konva.Line({
          points: [0, -14, 0, 14],
          stroke: strokeColor,
          strokeWidth: 1.5,
        })
      );
      group.add(
        new Konva.Circle({
          x: -11,
          y: 0,
          radius: 6,
          stroke: strokeColor,
          strokeWidth: 1.5,
        })
      );
      group.add(
        new Konva.Text({
          x: 4,
          y: -4,
          text: 'AHU',
          fontSize: 9,
          fontFamily: 'monospace',
          fontStyle: 'bold',
          fill: strokeColor,
        })
      );
    },
  },

  // 4. مخرج هواء / ناشر (Supply Diffuser)
  {
    id: 'hvac_diffuser',
    name: 'مخرج هواء ناشر (Diffuser)',
    nameEn: 'Square Ceiling Air Diffuser',
    category: 'hvac',
    defaultLayerId: 'hvac',
    description: 'ناشر تزويد هواء مكيف سقف 60x60 سم',
    wallMountable: false,
    defaultWidth: 24,
    defaultHeight: 24,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><rect x="4" y="4" width="24" height="24"/><rect x="8" y="8" width="16" height="16"/><line x1="4" y1="4" x2="12" y2="12"/><line x1="28" y1="4" x2="20" y2="12"/><line x1="4" y1="28" x2="12" y2="20"/><line x1="28" y1="28" x2="20" y2="20"/></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Rect({
          x: -12,
          y: -12,
          width: 24,
          height: 24,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
        })
      );
      group.add(
        new Konva.Rect({
          x: -6,
          y: -6,
          width: 12,
          height: 12,
          stroke: strokeColor,
          strokeWidth: 1.5,
        })
      );
      group.add(new Konva.Line({ points: [-12, -12, -6, -6], stroke: strokeColor, strokeWidth: 1.5 }));
      group.add(new Konva.Line({ points: [12, -12, 6, -6], stroke: strokeColor, strokeWidth: 1.5 }));
      group.add(new Konva.Line({ points: [-12, 12, -6, 6], stroke: strokeColor, strokeWidth: 1.5 }));
      group.add(new Konva.Line({ points: [12, 12, 6, 6], stroke: strokeColor, strokeWidth: 1.5 }));
    },
  },

  // 5. شواية سحب / إرجاع (Return Grille)
  {
    id: 'hvac_grille',
    name: 'شواية سحب هواء (Return Grille)',
    nameEn: 'Return Air Grille',
    category: 'hvac',
    defaultLayerId: 'hvac',
    description: 'جريل سحب هواء راجع سقفية أو جدارية',
    wallMountable: true,
    defaultWidth: 28,
    defaultHeight: 18,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><rect x="4" y="8" width="24" height="16"/><line x1="4" y1="12" x2="28" y2="12"/><line x1="4" y1="16" x2="28" y2="16"/><line x1="4" y1="20" x2="28" y2="20"/></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Rect({
          x: -14,
          y: -9,
          width: 28,
          height: 18,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
        })
      );
      group.add(new Konva.Line({ points: [-14, -4, 14, -4], stroke: strokeColor, strokeWidth: 1.5 }));
      group.add(new Konva.Line({ points: [-14, 0, 14, 0], stroke: strokeColor, strokeWidth: 1.5 }));
      group.add(new Konva.Line({ points: [-14, 4, 14, 4], stroke: strokeColor, strokeWidth: 1.5 }));
    },
  },
];
