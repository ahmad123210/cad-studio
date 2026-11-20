/**
 * @file customSymbols.ts
 * @description منشئ ومدير الرموز الهندسية المخصصة (Custom Symbol Builder & Manager) - المرحلة 7.
 * يتيح للمهندس تصميم وتخصيص رموز كهروميكانيكية ومعمارية جديدة تماماً، وتحديد أشكالها
 * الهندسية المتجهة، نصوصها وأيقوناتها، نقاط الربط والتوصيل (Terminals)، وخاصية الالتصاق بالجدران (Wall Snap)،
 * مع الحفظ التلقائي في LocalStorage وإمكانية الاستيراد والتصدير.
 */

import Konva from 'konva';
import { SymbolCategory, SymbolDefinition } from './types.ts';
import { ALL_SYMBOLS, registerCustomSymbol, removeCustomSymbol } from './registry.ts';

export type SymbolShapeType =
  | 'circle'
  | 'square'
  | 'rect'
  | 'triangle'
  | 'diamond'
  | 'hexagon'
  | 'cross'
  | 'pin';

export type SymbolIconType =
  | 'text'
  | 'bolt'
  | 'bulb'
  | 'droplet'
  | 'fan'
  | 'flame'
  | 'gauge'
  | 'plug'
  | 'wifi'
  | 'cctv'
  | 'pump'
  | 'solar';

export type TerminalPosition = 'top' | 'bottom' | 'left' | 'right' | 'center';

export interface CustomSymbolConfig {
  id: string;
  name: string;
  nameEn: string;
  category: SymbolCategory;
  defaultLayerId: string;
  description: string;
  shape: SymbolShapeType;
  iconType: SymbolIconType;
  iconText?: string;
  primaryColor: string;
  fillColor?: string;
  width: number;
  height: number;
  wallMountable: boolean;
  terminals: TerminalPosition[];
  createdAt: number;
}

const STORAGE_KEY = 'cad_custom_symbols_library';

/**
 * تحويل كائن التكوين CustomSymbolConfig إلى SymbolDefinition متوافق مع Konva و SVG
 */
export function buildSymbolDefinition(config: CustomSymbolConfig): SymbolDefinition {
  const w = config.width || 24;
  const h = config.height || 24;
  const halfW = w / 2;
  const halfH = h / 2;
  const color = config.primaryColor || '#8b5cf6';
  const fill = config.fillColor || 'transparent';

  // توليد كود SVG للمعاينة المصغرة
  const svgPreview = generateSvgPreview(config);

  // دالة رسم Konva الحقيقية للرمز على الكانفس
  const renderKonva = (
    group: Konva.Group,
    params: { color: string; isSelected: boolean; zoom: number }
  ) => {
    const strokeColor = params.isSelected ? '#38bdf8' : color;
    const strokeWidth = params.isSelected ? 2.5 : 1.8;

    // 1. الشكل الأساسي للرمز
    switch (config.shape) {
      case 'circle': {
        group.add(
          new Konva.Circle({
            x: 0,
            y: 0,
            radius: Math.min(halfW, halfH),
            stroke: strokeColor,
            strokeWidth,
            fill,
          })
        );
        break;
      }
      case 'square':
      case 'rect': {
        group.add(
          new Konva.Rect({
            x: -halfW,
            y: -halfH,
            width: w,
            height: h,
            stroke: strokeColor,
            strokeWidth,
            fill,
            cornerRadius: 2,
          })
        );
        break;
      }
      case 'triangle': {
        group.add(
          new Konva.Line({
            points: [0, -halfH, halfW, halfH, -halfW, halfH],
            closed: true,
            stroke: strokeColor,
            strokeWidth,
            fill,
          })
        );
        break;
      }
      case 'diamond': {
        group.add(
          new Konva.Line({
            points: [0, -halfH, halfW, 0, 0, halfH, -halfW, 0],
            closed: true,
            stroke: strokeColor,
            strokeWidth,
            fill,
          })
        );
        break;
      }
      case 'hexagon': {
        const pts: number[] = [];
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3;
          pts.push(halfW * Math.cos(angle), halfH * Math.sin(angle));
        }
        group.add(
          new Konva.Line({
            points: pts,
            closed: true,
            stroke: strokeColor,
            strokeWidth,
            fill,
          })
        );
        break;
      }
      case 'cross': {
        const arm = halfW * 0.4;
        group.add(
          new Konva.Line({
            points: [
              -arm, -halfH, arm, -halfH,
              arm, -arm, halfW, -arm,
              halfW, arm, arm, arm,
              arm, halfH, -arm, halfH,
              -arm, arm, -halfW, arm,
              -halfW, -arm, -arm, -arm,
            ],
            closed: true,
            stroke: strokeColor,
            strokeWidth,
            fill,
          })
        );
        break;
      }
      case 'pin': {
        group.add(
          new Konva.Circle({
            x: 0,
            y: -halfH * 0.3,
            radius: halfW * 0.7,
            stroke: strokeColor,
            strokeWidth,
            fill,
          })
        );
        group.add(
          new Konva.Line({
            points: [-halfW * 0.5, -halfH * 0.1, 0, halfH, halfW * 0.5, -halfH * 0.1],
            stroke: strokeColor,
            strokeWidth,
          })
        );
        break;
      }
    }

    // 2. المحتوى الداخلي (أيقونة أو نص)
    if (config.iconType === 'text' && config.iconText) {
      const txtLen = config.iconText.length;
      const baseFs = halfH * 0.95;
      const scaleFactor = txtLen <= 3 ? 1 : Math.max(0.45, 3.2 / txtLen);
      const calculatedFontSize = Math.max(7, Math.min(14, baseFs * scaleFactor));
      group.add(
        new Konva.Text({
          x: -halfW,
          y: -halfH,
          width: w,
          height: h,
          text: config.iconText,
          fontSize: calculatedFontSize,
          fontFamily: 'Cairo, sans-serif',
          fontStyle: 'bold',
          fill: strokeColor,
          align: 'center',
          verticalAlign: 'middle',
        })
      );
    } else if (config.iconType === 'bolt') {
      group.add(
        new Konva.Line({
          points: [
            halfW * 0.1, -halfH * 0.6,
            -halfW * 0.4, 0,
            0, 0,
            -halfW * 0.1, halfH * 0.6,
            halfW * 0.4, -0.1 * halfH,
            0, -0.1 * halfH,
          ],
          closed: true,
          fill: strokeColor,
        })
      );
    } else if (config.iconType === 'droplet') {
      group.add(
        new Konva.Circle({
          x: 0,
          y: halfH * 0.2,
          radius: halfW * 0.4,
          fill: strokeColor,
        })
      );
      group.add(
        new Konva.Line({
          points: [-halfW * 0.35, halfH * 0.1, 0, -halfH * 0.5, halfW * 0.35, halfH * 0.1],
          closed: true,
          fill: strokeColor,
        })
      );
    } else if (config.iconType === 'fan') {
      for (let i = 0; i < 3; i++) {
        const ang = (i * 2 * Math.PI) / 3;
        group.add(
          new Konva.Circle({
            x: Math.cos(ang) * halfW * 0.4,
            y: Math.sin(ang) * halfH * 0.4,
            radius: halfW * 0.25,
            stroke: strokeColor,
            strokeWidth: 1.2,
          })
        );
      }
    } else if (config.iconType === 'flame') {
      group.add(
        new Konva.Circle({
          x: 0,
          y: halfH * 0.1,
          radius: halfW * 0.35,
          fill: strokeColor,
        })
      );
    } else if (config.iconType === 'bulb') {
      group.add(
        new Konva.Circle({
          x: 0,
          y: -halfH * 0.1,
          radius: halfW * 0.4,
          stroke: strokeColor,
          strokeWidth: 1.2,
        })
      );
      group.add(
        new Konva.Line({
          points: [-halfW * 0.2, halfH * 0.4, halfW * 0.2, halfH * 0.4],
          stroke: strokeColor,
          strokeWidth: 1.5,
        })
      );
    }

    // 3. نقاط الربط والتوصيل (Terminals)
    if (config.terminals && config.terminals.length > 0) {
      config.terminals.forEach((term) => {
        let tx = 0, ty = 0;
        if (term === 'top') ty = -halfH;
        else if (term === 'bottom') ty = halfH;
        else if (term === 'left') tx = -halfW;
        else if (term === 'right') tx = halfW;

        group.add(
          new Konva.Circle({
            x: tx,
            y: ty,
            radius: 2,
            fill: strokeColor,
          })
        );
      });
    }
  };

  return {
    id: config.id,
    name: config.name,
    nameEn: config.nameEn || config.name,
    category: config.category,
    defaultLayerId: config.defaultLayerId || 'elec',
    description: config.description || 'رمز هندسي مخصص',
    wallMountable: config.wallMountable,
    defaultWidth: w,
    defaultHeight: h,
    renderKonva,
    svgPreview,
  };
}

/**
 * توليد كود SVG نقي للمعاينة في القوائم ولوحات الاختيار
 */
export function generateSvgPreview(config: CustomSymbolConfig): string {
  const w = config.width || 24;
  const h = config.height || 24;
  const color = config.primaryColor || '#8b5cf6';
  const fill = config.fillColor && config.fillColor !== 'transparent' ? config.fillColor : 'none';

  let shapeSvg = '';
  const halfW = w / 2;
  const halfH = h / 2;

  switch (config.shape) {
    case 'circle':
      shapeSvg = `<circle cx="12" cy="12" r="10" stroke="${color}" stroke-width="1.8" fill="${fill}" />`;
      break;
    case 'square':
    case 'rect':
      shapeSvg = `<rect x="3" y="3" width="18" height="18" rx="2" stroke="${color}" stroke-width="1.8" fill="${fill}" />`;
      break;
    case 'triangle':
      shapeSvg = `<polygon points="12,2 22,20 2,20" stroke="${color}" stroke-width="1.8" fill="${fill}" />`;
      break;
    case 'diamond':
      shapeSvg = `<polygon points="12,2 22,12 12,22 2,12" stroke="${color}" stroke-width="1.8" fill="${fill}" />`;
      break;
    case 'hexagon':
      shapeSvg = `<polygon points="12,2 21,7 21,17 12,22 3,17 3,7" stroke="${color}" stroke-width="1.8" fill="${fill}" />`;
      break;
    case 'cross':
      shapeSvg = `<path d="M9,2 L15,2 L15,9 L22,9 L22,15 L15,15 L15,22 L9,22 L9,15 L2,15 L2,9 L9,9 Z" stroke="${color}" stroke-width="1.8" fill="${fill}" />`;
      break;
    case 'pin':
      shapeSvg = `<circle cx="12" cy="9" r="6" stroke="${color}" stroke-width="1.8" fill="${fill}" /><path d="M8,12 L12,22 L16,12" stroke="${color}" stroke-width="1.8" fill="none" />`;
      break;
  }

  let innerSvg = '';
  if (config.iconType === 'text' && config.iconText) {
    const txtLen = config.iconText.length;
    const fontSize = txtLen <= 2 ? 10 : txtLen <= 4 ? 8 : txtLen <= 6 ? 6.5 : 5.2;
    const yPos = txtLen <= 4 ? 15.5 : 15;
    innerSvg = `<text x="12" y="${yPos}" font-size="${fontSize}" font-weight="bold" fill="${color}" text-anchor="middle" font-family="sans-serif">${config.iconText}</text>`;
  } else if (config.iconType === 'bolt') {
    innerSvg = `<polygon points="13,5 8,13 12,13 11,19 16,11 12,11" fill="${color}" />`;
  } else if (config.iconType === 'droplet') {
    innerSvg = `<circle cx="12" cy="14" r="4" fill="${color}" /><polygon points="8,13 12,6 16,13" fill="${color}" />`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="w-full h-full">${shapeSvg}${innerSvg}</svg>`;
}

/**
 * استرجاع جميع الرموز المخصصة المحفوظة في LocalStorage
 */
export function getStoredCustomSymbols(): CustomSymbolConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Failed to parse custom symbols from localStorage', err);
    return [];
  }
}

/**
 * حفظ رمز مخصص جديد أو تحديث رمز موجود
 */
export function saveCustomSymbol(config: CustomSymbolConfig): SymbolDefinition {
  const current = getStoredCustomSymbols();
  const existingIdx = current.findIndex((s) => s.id === config.id);

  if (existingIdx >= 0) {
    current[existingIdx] = config;
  } else {
    current.push(config);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));

  const def = buildSymbolDefinition(config);
  registerCustomSymbol(def);
  return def;
}

/**
 * حذف رمز مخصص من التخزين والسجل المركزي
 */
export function deleteCustomSymbol(id: string): void {
  const current = getStoredCustomSymbols().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  removeCustomSymbol(id);
}

/**
 * تحميل وتسجيل جميع الرموز المخصصة عند بدء تشغيل التطبيق
 */
export function initializeCustomSymbols(): void {
  const configs = getStoredCustomSymbols();
  configs.forEach((config) => {
    const def = buildSymbolDefinition(config);
    registerCustomSymbol(def);
  });
}
