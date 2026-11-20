/**
 * @file electrical.ts
 * @description مكتبة الرموز الكهربائية (Electrical Symbols Library)
 * تشمل جميع الرموز المطلوبة في الدستور التقني (16 رمزا تنفيذيا معياريا)
 */

import Konva from 'konva';
import { SymbolDefinition } from './types.ts';

export const ELECTRICAL_SYMBOLS: SymbolDefinition[] = [
  // 1. مفتاح مفرد
  {
    id: 'switch_single',
    name: 'مفتاح إنارة مفرد',
    nameEn: 'Single Switch',
    category: 'elec',
    defaultLayerId: 'elec',
    description: 'مفتاح تشغيل إنارة بنقطة تحكم واحدة جداري',
    wallMountable: true,
    defaultWidth: 16,
    defaultHeight: 16,
    svgPreview: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="16" cy="16" r="6"/><line x1="16" y1="10" x2="24" y2="4"/><line x1="24" y1="4" x2="28" y2="4"/></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Circle({
          x: 0,
          y: 0,
          radius: 7,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
        })
      );
      group.add(
        new Konva.Line({
          points: [0, -7, 10, -15, 15, -15],
          stroke: strokeColor,
          strokeWidth: 2,
          lineCap: 'round',
        })
      );
    },
  },

  // 2. مفتاح مزدوج
  {
    id: 'switch_double',
    name: 'مفتاح إنارة مزدوج',
    nameEn: 'Double Switch',
    category: 'elec',
    defaultLayerId: 'elec',
    description: 'مفتاح تحكم إنارة بخطين منفصلين (Two-gang)',
    wallMountable: true,
    defaultWidth: 18,
    defaultHeight: 18,
    svgPreview: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="16" cy="16" r="6"/><line x1="16" y1="10" x2="23" y2="3"/><line x1="23" y1="3" x2="27" y2="3"/><line x1="20" y1="6" x2="24" y2="10"/></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Circle({
          x: 0,
          y: 0,
          radius: 7,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
        })
      );
      group.add(
        new Konva.Line({
          points: [0, -7, 9, -15, 14, -15],
          stroke: strokeColor,
          strokeWidth: 2,
          lineCap: 'round',
        })
      );
      group.add(
        new Konva.Line({
          points: [5, -11, 10, -7],
          stroke: strokeColor,
          strokeWidth: 2,
          lineCap: 'round',
        })
      );
    },
  },

  // 3. بريزة مفردة
  {
    id: 'socket_single',
    name: 'مقبس كهربائي (بريزة)',
    nameEn: 'Single Socket',
    category: 'elec',
    defaultLayerId: 'elec',
    description: 'مقبس تيار كهربائي مفرد جداري 13A / 16A',
    wallMountable: true,
    defaultWidth: 18,
    defaultHeight: 18,
    svgPreview: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16 A10 10 0 0 1 26 16"/><line x1="6" y1="16" x2="26" y2="16"/><line x1="16" y1="6" x2="16" y2="0"/></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
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
      group.add(
        new Konva.Line({
          points: [-10, 0, 10, 0],
          stroke: strokeColor,
          strokeWidth: 2,
        })
      );
      group.add(
        new Konva.Line({
          points: [0, -10, 0, -14],
          stroke: strokeColor,
          strokeWidth: 2,
        })
      );
    },
  },

  // 4. بريزة مزدوجة
  {
    id: 'socket_double',
    name: 'بريزة كهرباء مزدوجة',
    nameEn: 'Double Socket',
    category: 'elec',
    defaultLayerId: 'elec',
    description: 'مقبس تيار كهربائي ثنائي 2-Gang جداري',
    wallMountable: true,
    defaultWidth: 22,
    defaultHeight: 18,
    svgPreview: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16 A9 9 0 0 1 20 16"/><path d="M12 16 A9 9 0 0 1 28 16"/><line x1="4" y1="16" x2="28" y2="16"/><line x1="12" y1="7" x2="12" y2="2"/><line x1="20" y1="7" x2="20" y2="2"/></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Arc({
          x: -4,
          y: 0,
          innerRadius: 0,
          outerRadius: 9,
          angle: 180,
          rotation: 180,
          stroke: strokeColor,
          strokeWidth: 2,
        })
      );
      group.add(
        new Konva.Arc({
          x: 4,
          y: 0,
          innerRadius: 0,
          outerRadius: 9,
          angle: 180,
          rotation: 180,
          stroke: strokeColor,
          strokeWidth: 2,
        })
      );
      group.add(
        new Konva.Line({
          points: [-13, 0, 13, 0],
          stroke: strokeColor,
          strokeWidth: 2,
        })
      );
      group.add(
        new Konva.Line({
          points: [-4, -9, -4, -13],
          stroke: strokeColor,
          strokeWidth: 2,
        })
      );
      group.add(
        new Konva.Line({
          points: [4, -9, 4, -13],
          stroke: strokeColor,
          strokeWidth: 2,
        })
      );
    },
  },

  // 5. بريزة أرضية
  {
    id: 'socket_floor',
    name: 'بريزة أرضية (Floor Box)',
    nameEn: 'Floor Socket Box',
    category: 'elec',
    defaultLayerId: 'elec',
    description: 'مقبس كهربائي معزول مخصص للأرضيات الخرسانية',
    wallMountable: false,
    defaultWidth: 20,
    defaultHeight: 20,
    svgPreview: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="6" width="20" height="20"/><path d="M10 20 A6 6 0 0 1 22 20"/><line x1="10" y1="20" x2="22" y2="20"/></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Rect({
          x: -10,
          y: -10,
          width: 20,
          height: 20,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
        })
      );
      group.add(
        new Konva.Arc({
          x: 0,
          y: 2,
          innerRadius: 0,
          outerRadius: 6,
          angle: 180,
          rotation: 180,
          stroke: strokeColor,
          strokeWidth: 1.5,
        })
      );
      group.add(
        new Konva.Line({
          points: [-6, 2, 6, 2],
          stroke: strokeColor,
          strokeWidth: 1.5,
        })
      );
    },
  },

  // 6. نقطة إنارة سقفية
  {
    id: 'light_ceiling',
    name: 'نقطة إنارة سقفية',
    nameEn: 'Ceiling Light Outlet',
    category: 'elec',
    defaultLayerId: 'elec',
    description: 'مخرج إنارة سقفية أساسي (رمز X القياسي)',
    wallMountable: false,
    defaultWidth: 20,
    defaultHeight: 20,
    svgPreview: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><circle cx="16" cy="16" r="10"/><line x1="9" y1="9" x2="23" y2="23"/><line x1="23" y1="9" x2="9" y2="23"/></svg>`,
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
        new Konva.Line({
          points: [-6.3, -6.3, 6.3, 6.3],
          stroke: strokeColor,
          strokeWidth: 2,
        })
      );
      group.add(
        new Konva.Line({
          points: [6.3, -6.3, -6.3, 6.3],
          stroke: strokeColor,
          strokeWidth: 2,
        })
      );
    },
  },

  // 7. سبوت لايت
  {
    id: 'spotlight',
    name: 'سبوت لايت (Spotlight)',
    nameEn: 'Recessed Downlight',
    category: 'elec',
    defaultLayerId: 'elec',
    description: 'وحدة إنارة غائرة بالجبس بورد موجهة',
    wallMountable: false,
    defaultWidth: 16,
    defaultHeight: 16,
    svgPreview: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><circle cx="16" cy="16" r="10"/><circle cx="16" cy="16" r="4" fill="currentColor"/></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Circle({
          x: 0,
          y: 0,
          radius: 8,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
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

  // 8. إنارة طوارئ
  {
    id: 'light_emergency',
    name: 'إنارة طوارئ (Emergency Light)',
    nameEn: 'Emergency Exit Light',
    category: 'elec',
    defaultLayerId: 'elec',
    description: 'وحدة إضاءة طوارئ مزودة ببطارية داخلية',
    wallMountable: true,
    defaultWidth: 22,
    defaultHeight: 14,
    svgPreview: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="8" width="24" height="16" rx="2"/><text x="16" y="20" font-size="10" text-anchor="middle" font-weight="bold" fill="currentColor">E</text></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Rect({
          x: -12,
          y: -7,
          width: 24,
          height: 14,
          stroke: strokeColor,
          strokeWidth: 2,
          cornerRadius: 2,
          fill: '#1e293b',
        })
      );
      group.add(
        new Konva.Text({
          x: -4,
          y: -5,
          text: 'E',
          fontSize: 10,
          fontFamily: 'monospace',
          fontStyle: 'bold',
          fill: strokeColor,
        })
      );
    },
  },

  // 9. لوحة DB (Distribution Board)
  {
    id: 'panel_db',
    name: 'لوحة توزيع كهرباء (DB)',
    nameEn: 'Distribution Board Panel',
    category: 'elec',
    defaultLayerId: 'elec',
    description: 'لوحة قواطع رئيسية أو فرعية لتوزيع الأحمال',
    wallMountable: true,
    defaultWidth: 28,
    defaultHeight: 14,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><rect x="4" y="8" width="24" height="16"/><line x1="4" y1="8" x2="28" y2="24"/><path d="M4 8 L28 8 L28 24 Z" fill="currentColor" fill-opacity="0.3"/></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Rect({
          x: -14,
          y: -12,
          width: 28,
          height: 12,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
        })
      );
      group.add(
        new Konva.Line({
          points: [-14, -12, 14, 0],
          stroke: strokeColor,
          strokeWidth: 1.5,
        })
      );
      group.add(
        new Konva.Line({
          points: [-14, -12, 14, -12, 14, 0],
          closed: true,
          fill: strokeColor,
          opacity: 0.5,
        })
      );
    },
  },

  // 10. قاطع كهربائي
  {
    id: 'circuit_breaker',
    name: 'قاطع تيار (Circuit Breaker)',
    nameEn: 'Isolator / Circuit Breaker',
    category: 'elec',
    defaultLayerId: 'elec',
    description: 'قاطع فصل وتحكم للأجهزة الكهربائية الكبيرة',
    wallMountable: true,
    defaultWidth: 18,
    defaultHeight: 18,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><circle cx="10" cy="16" r="3"/><circle cx="22" cy="16" r="3"/><line x1="12" y1="14" x2="20" y2="8"/></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(new Konva.Circle({ x: -6, y: 0, radius: 3, stroke: strokeColor, strokeWidth: 1.5 }));
      group.add(new Konva.Circle({ x: 6, y: 0, radius: 3, stroke: strokeColor, strokeWidth: 1.5 }));
      group.add(new Konva.Line({ points: [-4, -2, 4, -8], stroke: strokeColor, strokeWidth: 2, lineCap: 'round' }));
    },
  },

  // 11. مروحة سقف
  {
    id: 'fan_ceiling',
    name: 'مروحة سقفية',
    nameEn: 'Ceiling Fan',
    category: 'elec',
    defaultLayerId: 'elec',
    description: 'مروحة تهوية سقفية مع ريش التوزيع',
    wallMountable: false,
    defaultWidth: 24,
    defaultHeight: 24,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><circle cx="16" cy="16" r="4"/><path d="M16 12 C16 4 22 4 22 8 C22 12 16 12 16 12 Z"/><path d="M13 18 C6 22 4 16 8 14 C12 12 13 18 13 18 Z"/><path d="M19 18 C26 22 28 16 24 14 C20 12 19 18 19 18 Z"/></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(new Konva.Circle({ x: 0, y: 0, radius: 4, stroke: strokeColor, strokeWidth: 2, fill: strokeColor }));
      for (let i = 0; i < 3; i++) {
        const rad = (i * 120 * Math.PI) / 180;
        const ex = Math.cos(rad) * 11;
        const ey = Math.sin(rad) * 11;
        group.add(new Konva.Line({ points: [0, 0, ex, ey], stroke: strokeColor, strokeWidth: 2.5, lineCap: 'round' }));
      }
    },
  },

  // 12. حساس حركة (PIR)
  {
    id: 'sensor_motion',
    name: 'حساس حركة (PIR Sensor)',
    nameEn: 'Motion Detector Sensor',
    category: 'elec',
    defaultLayerId: 'elec',
    description: 'كاشف حركة بالأشعة تحت الحمراء للإنارة أو الإنذار',
    wallMountable: true,
    defaultWidth: 18,
    defaultHeight: 18,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><polygon points="16,6 26,24 6,24"/><circle cx="16" cy="17" r="3" fill="currentColor"/></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Line({
          points: [0, -9, 8, 7, -8, 7],
          closed: true,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
        })
      );
      group.add(new Konva.Circle({ x: 0, y: 1, radius: 2.5, fill: strokeColor }));
    },
  },

  // 13. جرس
  {
    id: 'doorbell',
    name: 'جرس كهربائي (Doorbell)',
    nameEn: 'Doorbell Push Button / Chime',
    category: 'elec',
    defaultLayerId: 'elec',
    description: 'ضاغط أو نغمة جرس تنبيه عند المدخل',
    wallMountable: true,
    defaultWidth: 16,
    defaultHeight: 16,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><path d="M10 20 C10 12 22 12 22 20 Z"/><line x1="8" y1="20" x2="24" y2="20"/><circle cx="16" cy="23" r="1.5" fill="currentColor"/></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Arc({
          x: 0,
          y: 0,
          innerRadius: 0,
          outerRadius: 8,
          angle: 180,
          rotation: 180,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
        })
      );
      group.add(new Konva.Line({ points: [-8, 0, 8, 0], stroke: strokeColor, strokeWidth: 2 }));
      group.add(new Konva.Circle({ x: 0, y: -4, radius: 2, fill: strokeColor }));
    },
  },

  // 14. كاميرا مراقبة (CCTV)
  {
    id: 'camera_cctv',
    name: 'كاميرا مراقبة (CCTV)',
    nameEn: 'Surveillance Camera',
    category: 'elec',
    defaultLayerId: 'elec',
    description: 'كاميرا أمنية مراقبة داخلية أو خارجية جدارية',
    wallMountable: true,
    defaultWidth: 20,
    defaultHeight: 16,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><rect x="4" y="10" width="16" height="12" rx="2"/><polygon points="20,13 28,9 28,23 20,19" fill="currentColor" fill-opacity="0.3"/></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Rect({
          x: -10,
          y: -5,
          width: 13,
          height: 10,
          stroke: strokeColor,
          strokeWidth: 2,
          cornerRadius: 2,
          fill: '#1e293b',
        })
      );
      group.add(
        new Konva.Line({
          points: [3, -3, 10, -7, 10, 7, 3, 3],
          closed: true,
          stroke: strokeColor,
          strokeWidth: 1.5,
          fill: strokeColor,
          opacity: 0.3,
        })
      );
    },
  },

  // 15. نقطة شبكة (Data RJ45)
  {
    id: 'data_rj45',
    name: 'مخرج شبكة إنترنت (Data RJ45)',
    nameEn: 'Network Data Outlet',
    category: 'elec',
    defaultLayerId: 'elec',
    description: 'مأخذ شبكة معلومات Cat6/Cat6A جداري',
    wallMountable: true,
    defaultWidth: 18,
    defaultHeight: 18,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><polygon points="16,6 26,24 6,24"/><text x="16" y="21" font-size="9" text-anchor="middle" font-weight="bold" fill="currentColor">D</text></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Line({
          points: [0, -15, 8, 0, -8, 0],
          closed: true,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
        })
      );
      group.add(
        new Konva.Text({
          x: -4,
          y: -8,
          text: 'D',
          fontSize: 9,
          fontFamily: 'monospace',
          fontStyle: 'bold',
          fill: strokeColor,
        })
      );
    },
  },

  // 16. نقطة هاتف
  {
    id: 'telephone',
    name: 'مخرج هاتف (Telephone)',
    nameEn: 'Telephone Outlet RJ11',
    category: 'elec',
    defaultLayerId: 'elec',
    description: 'مأخذ خط اتصال هاتفي جداري',
    wallMountable: true,
    defaultWidth: 18,
    defaultHeight: 18,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><polygon points="16,6 26,24 6,24"/><text x="16" y="21" font-size="9" text-anchor="middle" font-weight="bold" fill="currentColor">T</text></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Line({
          points: [0, -15, 8, 0, -8, 0],
          closed: true,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
        })
      );
      group.add(
        new Konva.Text({
          x: -4,
          y: -8,
          text: 'T',
          fontSize: 9,
          fontFamily: 'monospace',
          fontStyle: 'bold',
          fill: strokeColor,
        })
      );
    },
  },

  // 17. مفتاح إنارة 3 خط اتجاه واحد 10A
  {
    id: 'switch_3gang_1way',
    name: 'مفتاح إنارة 3 خط اتجاه واحد 10A',
    nameEn: '3-Gangs Lighting Switch, One Way 10A',
    category: 'elec',
    defaultLayerId: 'elec',
    description: 'مفتاح إنارة جداري 3 خطوط تشغيل اتجاه واحد 10 أمبير',
    wallMountable: true,
    defaultWidth: 18,
    defaultHeight: 18,
    svgPreview: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="20" r="5"/><line x1="12" y1="15" x2="24" y2="3"/><line x1="14" y1="11" x2="18" y2="15"/><line x1="17.5" y1="7.5" x2="21.5" y2="11.5"/><line x1="21" y1="4" x2="25" y2="8"/></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Circle({
          x: 0,
          y: 0,
          radius: 6.5,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
        })
      );
      group.add(
        new Konva.Line({
          points: [0, -6.5, 12, -18],
          stroke: strokeColor,
          strokeWidth: 2,
          lineCap: 'round',
        })
      );
      // ثلاثة خطوط تفرع متوازية تمثل 3 Gangs
      group.add(new Konva.Line({ points: [2, -9, 6, -5], stroke: strokeColor, strokeWidth: 1.8, lineCap: 'round' }));
      group.add(new Konva.Line({ points: [5.5, -12.5, 9.5, -8.5], stroke: strokeColor, strokeWidth: 1.8, lineCap: 'round' }));
      group.add(new Konva.Line({ points: [9, -16, 13, -12], stroke: strokeColor, strokeWidth: 1.8, lineCap: 'round' }));
    },
  },

  // 18. مفتاح إنارة مفرد اتجاهين طرف سلم 10A
  {
    id: 'switch_1gang_2way',
    name: 'مفتاح إنارة مفرد اتجاهين (طرف سلم) 10A',
    nameEn: '1-Gang Lighting Switch, Two Ways 10A',
    category: 'elec',
    defaultLayerId: 'elec',
    description: 'مفتاح إنارة مفرد اتجاهين طرف سلم 10 أمبير (Two Ways)',
    wallMountable: true,
    defaultWidth: 18,
    defaultHeight: 18,
    svgPreview: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="20" r="5"/><line x1="12" y1="15" x2="20" y2="7"/><line x1="20" y1="7" x2="26" y2="13"/></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Circle({
          x: 0,
          y: 0,
          radius: 6.5,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
        })
      );
      // ذراع مع رأس معكوف باتجاهين (Two-ways hook)
      group.add(
        new Konva.Line({
          points: [0, -6.5, 9, -15.5, 15, -10],
          stroke: strokeColor,
          strokeWidth: 2,
          lineCap: 'round',
          lineJoin: 'miter',
        })
      );
    },
  },

  // 19. مفتاح إنارة خطين اتجاهين طرف سلم 10A
  {
    id: 'switch_2gang_2way',
    name: 'مفتاح إنارة خطين اتجاهين (طرف سلم) 10A',
    nameEn: '2-Gangs Lighting Switch, Two Ways 10A',
    category: 'elec',
    defaultLayerId: 'elec',
    description: 'مفتاح إنارة خطين اتجاهين طرف سلم 10 أمبير (2-Gangs 2-Ways)',
    wallMountable: true,
    defaultWidth: 20,
    defaultHeight: 20,
    svgPreview: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="20" r="5"/><line x1="12" y1="15" x2="20" y2="7"/><line x1="20" y1="7" x2="26" y2="13"/><line x1="16" y1="11" x2="22" y2="17"/></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Circle({
          x: 0,
          y: 0,
          radius: 6.5,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
        })
      );
      // خط الذراع الرئيسي المعكوف
      group.add(
        new Konva.Line({
          points: [0, -6.5, 9, -15.5, 15, -10],
          stroke: strokeColor,
          strokeWidth: 2,
          lineCap: 'round',
          lineJoin: 'miter',
        })
      );
      // خط فرعي معكوف موازٍ للخط الأول (Gang ثاني اتجاهين)
      group.add(
        new Konva.Line({
          points: [5, -11.5, 11, -6],
          stroke: strokeColor,
          strokeWidth: 2,
          lineCap: 'round',
        })
      );
    },
  },

  // 20. مفتاح إنارة وسط سلم صليبي (Intermediate Switch)
  {
    id: 'switch_intermediate',
    name: 'مفتاح إنارة وسط سلم (صليبي)',
    nameEn: 'Intermediate Lighting Switch',
    category: 'elec',
    defaultLayerId: 'elec',
    description: 'مفتاح إنارة وسطي صليبي للتحكم من أكثر من نقطتين (Intermediate Switch)',
    wallMountable: true,
    defaultWidth: 22,
    defaultHeight: 22,
    svgPreview: `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="16" cy="16" r="5"/><line x1="12.5" y1="12.5" x2="6" y2="6"/><line x1="6" y1="6" x2="6" y2="12"/><line x1="19.5" y1="12.5" x2="26" y2="6"/><line x1="26" y1="6" x2="20" y2="6"/><line x1="12.5" y1="19.5" x2="6" y2="26"/><line x1="6" y1="26" x2="12" y2="26"/><line x1="19.5" y1="19.5" x2="26" y2="26"/><line x1="26" y1="26" x2="26" y2="20"/></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Circle({
          x: 0,
          y: 0,
          radius: 6,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
        })
      );
      // الأذرع الأربعة المعكوفة الصليبية
      group.add(new Konva.Line({ points: [-4.2, -4.2, -11, -11, -11, -5], stroke: strokeColor, strokeWidth: 1.8, lineCap: 'round' }));
      group.add(new Konva.Line({ points: [4.2, -4.2, 11, -11, 5, -11], stroke: strokeColor, strokeWidth: 1.8, lineCap: 'round' }));
      group.add(new Konva.Line({ points: [-4.2, 4.2, -11, 11, -5, 11], stroke: strokeColor, strokeWidth: 1.8, lineCap: 'round' }));
      group.add(new Konva.Line({ points: [4.2, 4.2, 11, 11, 11, 5], stroke: strokeColor, strokeWidth: 1.8, lineCap: 'round' }));
    },
  },

  // 21. مقبس 13A أحادي الطور 3 شعب بمفتاح مثبت بالسقف
  {
    id: 'socket_13a_ceiling',
    name: 'مقبس 13A أحادي الطور مثبت بالسقف',
    nameEn: '13A 1-Phase 3-Pin Switched Socket Ceiling Mounted',
    category: 'elec',
    defaultLayerId: 'elec',
    description: 'مأخذ تيار كهربائي 13A أحادي الطور 3 شعب بمفتاح تحكم مثبت بالسقف',
    wallMountable: false,
    defaultWidth: 22,
    defaultHeight: 22,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><circle cx="16" cy="18" r="9"/><line x1="7" y1="18" x2="25" y2="18"/><line x1="16" y1="9" x2="16" y2="3"/><line x1="12" y1="3" x2="20" y2="3"/></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Circle({
          x: 0,
          y: 2,
          radius: 9,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
        })
      );
      // خط القطر الأفقي (نصف دائرة مأخذ مدمج)
      group.add(
        new Konva.Line({
          points: [-9, 2, 9, 2],
          stroke: strokeColor,
          strokeWidth: 2,
        })
      );
      // ساق التثبيت السقفي العلوية مع العارضة الأفقية
      group.add(
        new Konva.Line({
          points: [0, -7, 0, -13],
          stroke: strokeColor,
          strokeWidth: 2,
        })
      );
      group.add(
        new Konva.Line({
          points: [-4, -13, 4, -13],
          stroke: strokeColor,
          strokeWidth: 2,
          lineCap: 'round',
        })
      );
    },
  },

  // 22. مروحة شفط (Exhaust Fan)
  {
    id: 'exhaust_fan',
    name: 'مروحة شفط (Exhaust Fan)',
    nameEn: 'Exhaust Fan',
    category: 'elec',
    defaultLayerId: 'elec',
    description: 'مروحة شفط هواء كهربائية جدارية أو سقفية للتهوية',
    wallMountable: true,
    defaultWidth: 24,
    defaultHeight: 24,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><rect x="5" y="5" width="22" height="22" rx="1"/><circle cx="16" cy="16" r="8"/><line x1="16" y1="8" x2="16" y2="24"/><line x1="8" y1="16" x2="24" y2="16"/></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      // الإطار المربع الخارجي
      group.add(
        new Konva.Rect({
          x: -11,
          y: -11,
          width: 22,
          height: 22,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
        })
      );
      // الدائرة الداخلية ومروحة الدفع
      group.add(
        new Konva.Circle({
          x: 0,
          y: 0,
          radius: 8,
          stroke: strokeColor,
          strokeWidth: 1.5,
        })
      );
      group.add(new Konva.Line({ points: [0, -8, 0, 8], stroke: strokeColor, strokeWidth: 1.8 }));
      group.add(new Konva.Line({ points: [-8, 0, 8, 0], stroke: strokeColor, strokeWidth: 1.8 }));
    },
  },

  // 23. جهاز تسجيل فيديو رقمي (DVR)
  {
    id: 'dvr_unit',
    name: 'جهاز تسجيل فيديو رقمي (DVR)',
    nameEn: 'Digital Video Recorder (DVR)',
    category: 'elec',
    defaultLayerId: 'elec',
    description: 'وحدة تسجيل وتخزين كاميرات المراقبة الرقمية (DVR/NVR)',
    wallMountable: false,
    defaultWidth: 32,
    defaultHeight: 18,
    svgPreview: `<svg viewBox="0 0 32 20" stroke="currentColor" stroke-width="2" fill="none"><rect x="2" y="2" width="28" height="16" rx="2"/><text x="16" y="13.5" font-size="7.5" text-anchor="middle" font-weight="bold" fill="currentColor" font-family="monospace">DVR</text></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      group.add(
        new Konva.Rect({
          x: -15,
          y: -9,
          width: 30,
          height: 18,
          cornerRadius: 2,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
        })
      );
      group.add(
        new Konva.Text({
          x: -15,
          y: -6,
          width: 30,
          text: 'DVR',
          fontSize: 9.5,
          fontFamily: 'monospace',
          fontStyle: 'bold',
          fill: strokeColor,
          align: 'center',
        })
      );
    },
  },

  // 24. شاشة مراقبة / عرض (Monitor)
  {
    id: 'cctv_monitor',
    name: 'شاشة مراقبة / عرض (Monitor)',
    nameEn: 'Monitor',
    category: 'elec',
    defaultLayerId: 'elec',
    description: 'شاشة عرض لكاميرات المراقبة والأنظمة الأمنية',
    wallMountable: false,
    defaultWidth: 26,
    defaultHeight: 24,
    svgPreview: `<svg viewBox="0 0 32 32" stroke="currentColor" stroke-width="2" fill="none"><rect x="4" y="5" width="24" height="16" rx="2"/><rect x="7" y="8" width="18" height="10" stroke-width="1"/><line x1="16" y1="21" x2="16" y2="26"/><line x1="10" y1="26" x2="22" y2="26"/></svg>`,
    renderKonva: (group, { color, isSelected }) => {
      const strokeColor = isSelected ? '#38bdf8' : color;
      // هيكل الشاشة الخارجي
      group.add(
        new Konva.Rect({
          x: -12,
          y: -11,
          width: 24,
          height: 16,
          cornerRadius: 2,
          stroke: strokeColor,
          strokeWidth: 2,
          fill: '#1e293b',
        })
      );
      // إطار الشاشة الداخلي
      group.add(
        new Konva.Rect({
          x: -9,
          y: -8,
          width: 18,
          height: 10,
          stroke: strokeColor,
          strokeWidth: 1,
        })
      );
      // عنق وقاعدة الشاشة
      group.add(new Konva.Line({ points: [0, 5, 0, 10], stroke: strokeColor, strokeWidth: 2 }));
      group.add(new Konva.Line({ points: [-6, 10, 6, 10], stroke: strokeColor, strokeWidth: 2.5, lineCap: 'round' }));
    },
  },
];
