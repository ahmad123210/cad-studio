/**
 * @file fire.ts
 * @description مكتبة رموز مكافحة الحريق والسلامة (Fire Fighting Symbols Library)
 * تشمل جميع الرموز المطلوبة بالدستور التقني (5 رموز معيارية)
 */

import Konva from 'konva';
import { SymbolDefinition } from './types.ts';

export const FIRE_SYMBOLS: SymbolDefinition[] = [
  // 1. رشاش حريق (Fire Sprinkler)
  {
    id: 'fire_sprinkler',
    name: 'رشاش حريق (Sprinkler)',
    nameEn: 'Pendant / Upright Fire Sprinkler',
    category: 'fire',
    defaultLayerId: 'fire',
    description: 'رأس رشاش إطفاء مائي تلقائي في السقف',
    wallMountable: false,
    defaultWidth: 20,
    defaultHeight: 20,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><circle cx="16" cy="14" r="6"/><polygon points="16,2 18,8 14,8" fill="currentColor"/><line x1="8" y1="24" x2="24" y2="24"/><line x1="12" y1="20" x2="20" y2="20"/><line x1="16" y1="14" x2="16" y2="28"/></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Circle({
          x: 0,
          y: -2,
          radius: 6,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
        })
      );
      group.add(
        new Konva.Line({
          points: [0, -10, 3, -6, -3, -6],
          closed: true,
          fill: strokeColor,
        })
      );
      group.add(new Konva.Line({ points: [0, 4, 0, 10], stroke: strokeColor, strokeWidth: 2 }));
      group.add(new Konva.Line({ points: [-7, 10, 7, 10], stroke: strokeColor, strokeWidth: 2.5 }));
      group.add(new Konva.Line({ points: [-4, 7, 4, 7], stroke: strokeColor, strokeWidth: 1.5 }));
    },
  },

  // 2. بكرة خرطوم حريق (Fire Hose Reel)
  {
    id: 'fire_hose_reel',
    name: 'بكرة خرطوم إطفاء (Hose Reel)',
    nameEn: 'Fire Hose Reel (FHR)',
    category: 'fire',
    defaultLayerId: 'fire',
    description: 'بكرة خرطوم مياه مطاطي جدارية للطوارئ',
    wallMountable: true,
    defaultWidth: 24,
    defaultHeight: 24,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><circle cx="16" cy="16" r="11"/><circle cx="16" cy="16" r="6"/><line x1="16" y1="5" x2="16" y2="27"/><line x1="5" y1="16" x2="27" y2="16"/></svg>`,
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
        new Konva.Circle({
          x: 0,
          y: 0,
          radius: 5,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: strokeColor,
        })
      );
      group.add(new Konva.Line({ points: [-11, 0, 11, 0], stroke: strokeColor, strokeWidth: 1.5 }));
      group.add(new Konva.Line({ points: [0, -11, 0, 11], stroke: strokeColor, strokeWidth: 1.5 }));
    },
  },

  // 3. كابينة حريق (Fire Cabinet)
  {
    id: 'fire_cabinet',
    name: 'صندوق كابينة حريق (Cabinet)',
    nameEn: 'Fire Hose Cabinet (FHC)',
    category: 'fire',
    defaultLayerId: 'fire',
    description: 'صندوق معدني غائر أو بارز مع خرطوم وطفاية',
    wallMountable: true,
    defaultWidth: 30,
    defaultHeight: 18,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><rect x="3" y="6" width="26" height="20" rx="1"/><circle cx="13" cy="16" r="5"/><line x1="22" y1="11" x2="22" y2="21"/><text x="13" y="19" font-size="7" text-anchor="middle" font-weight="bold" fill="currentColor">F</text></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Rect({
          x: -15,
          y: -9,
          width: 30,
          height: 18,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
        })
      );
      group.add(
        new Konva.Circle({
          x: -4,
          y: 0,
          radius: 6,
          stroke: strokeColor,
          strokeWidth: 1.5,
        })
      );
      group.add(
        new Konva.Text({
          x: -8,
          y: -4,
          text: 'F',
          fontSize: 8,
          fontFamily: 'monospace',
          fontStyle: 'bold',
          fill: strokeColor,
        })
      );
      // رمز طفاية الحريق بجانب البكرة
      group.add(
        new Konva.Rect({
          x: 6,
          y: -5,
          width: 5,
          height: 10,
          stroke: strokeColor,
          strokeWidth: 1.5,
          cornerRadius: 1,
          fill: strokeColor,
          opacity: 0.8,
        })
      );
    },
  },

  // 4. صمام إطفاء (Fire Valve)
  {
    id: 'fire_valve',
    name: 'صمام إطفاء حريق (Landing Valve)',
    nameEn: 'Fire Landing / Zone Valve',
    category: 'fire',
    defaultLayerId: 'fire',
    description: 'محبس تغذية شبكة الإطفاء أو صمام منطقة',
    wallMountable: true,
    defaultWidth: 22,
    defaultHeight: 18,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><polygon points="6,12 6,24 16,18" fill="currentColor"/><polygon points="26,12 26,24 16,18" fill="currentColor"/><circle cx="16" cy="8" r="3" fill="currentColor"/></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Line({
          points: [-10, -5, -10, 7, 0, 1],
          closed: true,
          fill: strokeColor,
          stroke: strokeColor,
          strokeWidth: 1.5,
        })
      );
      group.add(
        new Konva.Line({
          points: [10, -5, 10, 7, 0, 1],
          closed: true,
          fill: strokeColor,
          stroke: strokeColor,
          strokeWidth: 1.5,
        })
      );
      group.add(new Konva.Line({ points: [0, 1, 0, -8], stroke: strokeColor, strokeWidth: 2 }));
      group.add(new Konva.Circle({ x: 0, y: -9, radius: 3.5, stroke: strokeColor, strokeWidth: 1.5, fill: strokeColor }));
    },
  },

  // 5. مضخة حريق (Fire Pump)
  {
    id: 'fire_pump',
    name: 'مضخة إطفاء حريق (Fire Pump)',
    nameEn: 'Main Fire Fighting Pump',
    category: 'fire',
    defaultLayerId: 'fire',
    description: 'مضخة رئيسية ديزل أو كهرباء لضغط شبكة الإطفاء',
    wallMountable: false,
    defaultWidth: 28,
    defaultHeight: 28,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><circle cx="16" cy="16" r="11"/><polygon points="16,8 24,22 8,22" fill="currentColor"/><text x="16" y="21" font-size="7" text-anchor="middle" font-weight="bold" fill="#000">FP</text></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Circle({
          x: 0,
          y: 0,
          radius: 13,
          stroke: strokeColor,
          strokeWidth: 2.5,
          fill: '#1e293b',
        })
      );
      group.add(
        new Konva.Line({
          points: [0, -9, 9, 7, -9, 7],
          closed: true,
          fill: strokeColor,
        })
      );
      group.add(
        new Konva.Text({
          x: -6,
          y: -2,
          text: 'FP',
          fontSize: 8,
          fontFamily: 'monospace',
          fontStyle: 'bold',
          fill: '#1e293b',
        })
      );
    },
  },

  // 6. كاشف دخان بصري (Smoke Detector)
  {
    id: 'fire_smoke_detector',
    name: 'كاشف دخان بصري (Smoke Detector)',
    nameEn: 'Fire Alarm Smoke Detector Optical Type',
    category: 'fire',
    defaultLayerId: 'fire',
    description: 'كاشف دخان بصري ضوئي لنظام إنذار الحريق المبكر في السقف',
    wallMountable: false,
    defaultWidth: 22,
    defaultHeight: 22,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><circle cx="16" cy="16" r="11"/><text x="16" y="21" font-size="14" text-anchor="middle" font-weight="bold" fill="currentColor" font-family="sans-serif">S</text></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Circle({
          x: 0,
          y: 0,
          radius: 10,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
        })
      );
      group.add(
        new Konva.Text({
          x: -10,
          y: -7,
          width: 20,
          text: 'S',
          fontSize: 13,
          fontFamily: 'sans-serif',
          fontStyle: 'bold',
          fill: strokeColor,
          align: 'center',
        })
      );
    },
  },

  // 7. كاشف حرارة (Heat Detector)
  {
    id: 'fire_heat_detector',
    name: 'كاشف حرارة (Heat Detector)',
    nameEn: 'Fire Alarm Heat Detector Optical Type',
    category: 'fire',
    defaultLayerId: 'fire',
    description: 'كاشف حراري لنظام الإنذار المبكر من الحريق',
    wallMountable: false,
    defaultWidth: 22,
    defaultHeight: 22,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><circle cx="16" cy="16" r="11"/><text x="16" y="21" font-size="14" text-anchor="middle" font-weight="bold" fill="currentColor" font-family="sans-serif">H</text></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Circle({
          x: 0,
          y: 0,
          radius: 10,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
        })
      );
      group.add(
        new Konva.Text({
          x: -10,
          y: -7,
          width: 20,
          text: 'H',
          fontSize: 13,
          fontFamily: 'sans-serif',
          fontStyle: 'bold',
          fill: strokeColor,
          align: 'center',
        })
      );
    },
  },

  // 8. محطة سحب يدوية / كاسر إنذار (Pull Station)
  {
    id: 'fire_pull_station',
    name: 'محطة سحب يدوية / كاسر إنذار (Pull Station)',
    nameEn: 'Pull Station Unit',
    category: 'fire',
    defaultLayerId: 'fire',
    description: 'كاسر زجاج ومحطة سحب يدوية جدارية لإطلاق إنذار الحريق',
    wallMountable: true,
    defaultWidth: 22,
    defaultHeight: 22,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><rect x="5" y="5" width="22" height="22" rx="2"/><text x="16" y="22" font-size="15" text-anchor="middle" font-weight="bold" fill="currentColor" font-family="sans-serif">B</text></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Rect({
          x: -10,
          y: -10,
          width: 20,
          height: 20,
          cornerRadius: 2,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
        })
      );
      group.add(
        new Konva.Text({
          x: -10,
          y: -7,
          width: 20,
          text: 'B',
          fontSize: 13,
          fontFamily: 'sans-serif',
          fontStyle: 'bold',
          fill: strokeColor,
          align: 'center',
        })
      );
    },
  },

  // 9. جرس إنذار حريق داخلي (Indoor Bell)
  {
    id: 'fire_indoor_bell',
    name: 'جرس إنذار حريق داخلي (Indoor Bell)',
    nameEn: 'Indoor Bell',
    category: 'fire',
    defaultLayerId: 'fire',
    description: 'جرس إنذار حريق صوتي مسموع داخلي جداري (Alarm Bell)',
    wallMountable: true,
    defaultWidth: 24,
    defaultHeight: 22,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><path d="M6 18 A10 10 0 0 1 26 18 Z"/><line x1="4" y1="18" x2="28" y2="18"/><path d="M12 18 L12 25 L20 25 L20 18"/></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      // قبة الجرس النصف دائرية
      group.add(
        new Konva.Arc({
          x: 0,
          y: 0,
          innerRadius: 0,
          outerRadius: 10,
          angle: 180,
          rotation: 180,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
        })
      );
      // قاعدة التثبيت السفلية
      group.add(
        new Konva.Line({
          points: [-12, 0, 12, 0],
          stroke: strokeColor,
          strokeWidth: 2,
          lineCap: 'round',
        })
      );
      // مطرقة الجرس
      group.add(
        new Konva.Line({
          points: [-4, 0, -4, -6, 4, -6, 4, 0],
          stroke: strokeColor,
          strokeWidth: 1.8,
        })
      );
    },
  },
];
