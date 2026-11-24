/**
 * @file registry.ts
 * @description السجل المركزي لجميع الرموز الهندسية (MEP Symbols Registry)
 * يجمع أقسام الكهرباء، السباكة، التكييف، ومكافحة الحريق، ويوفر دوال البحث والفرز والوصول.
 */

import { SymbolDefinition, CategoryMeta, SymbolCategory } from './types.ts';
import { ELECTRICAL_SYMBOLS } from './electrical.ts';
import { PLUMBING_SYMBOLS } from './plumbing.ts';
import { HVAC_SYMBOLS } from './hvac.ts';
import { FIRE_SYMBOLS } from './fire.ts';
import { FURNITURE_SYMBOLS } from './furniture.ts';

export const CATEGORIES_META: Record<SymbolCategory, CategoryMeta> = {
  elec: {
    id: 'elec',
    name: 'كهرباء',
    nameEn: 'Electrical',
    defaultLayerId: 'elec',
    color: '#f59e0b',
    iconName: 'Zap',
  },
  plumb: {
    id: 'plumb',
    name: 'سباكة وصحي',
    nameEn: 'Plumbing',
    defaultLayerId: 'plumb',
    color: '#3b82f6',
    iconName: 'Droplet',
  },
  hvac: {
    id: 'hvac',
    name: 'تكييف وتهوية',
    nameEn: 'HVAC',
    defaultLayerId: 'hvac',
    color: '#10b981',
    iconName: 'Wind',
  },
  fire: {
    id: 'fire',
    name: 'إطفاء حريق',
    nameEn: 'Fire Fighting',
    defaultLayerId: 'fire',
    color: '#ef4444',
    iconName: 'Flame',
  },
  furniture: {
    id: 'furniture',
    name: 'فرش وأجهزة',
    nameEn: 'Furniture & Appliances',
    defaultLayerId: 'furn',
    color: '#a855f7',
    iconName: 'Armchair',
  },
  custom: {
    id: 'custom',
    name: 'رموز مخصصة',
    nameEn: 'Custom Symbols',
    defaultLayerId: 'elec',
    color: '#8b5cf6',
    iconName: 'Sparkles',
  },
};

export const ALL_SYMBOLS: SymbolDefinition[] = [
  ...ELECTRICAL_SYMBOLS,
  ...PLUMBING_SYMBOLS,
  ...HVAC_SYMBOLS,
  ...FIRE_SYMBOLS,
  ...FURNITURE_SYMBOLS,
];

const SYMBOLS_BY_ID: Map<string, SymbolDefinition> = new Map();
ALL_SYMBOLS.forEach((sym) => SYMBOLS_BY_ID.set(sym.id, sym));

export function registerCustomSymbol(symbol: SymbolDefinition): void {
  const existingIdx = ALL_SYMBOLS.findIndex((s) => s.id === symbol.id);
  if (existingIdx >= 0) {
    ALL_SYMBOLS[existingIdx] = symbol;
  } else {
    ALL_SYMBOLS.push(symbol);
  }
  SYMBOLS_BY_ID.set(symbol.id, symbol);
}

export function removeCustomSymbol(id: string): void {
  const idx = ALL_SYMBOLS.findIndex((s) => s.id === id);
  if (idx >= 0) {
    ALL_SYMBOLS.splice(idx, 1);
  }
  SYMBOLS_BY_ID.delete(id);
}

export function getSymbolById(id: string): SymbolDefinition | undefined {
  return SYMBOLS_BY_ID.get(id);
}

export function getSymbolsByCategory(category: SymbolCategory): SymbolDefinition[] {
  return ALL_SYMBOLS.filter((sym) => sym.category === category);
}

export function searchSymbols(query: string, category?: SymbolCategory): SymbolDefinition[] {
  const q = query.trim().toLowerCase();
  return ALL_SYMBOLS.filter((sym) => {
    if (category && sym.category !== category) return false;
    if (!q) return true;
    return (
      sym.name.toLowerCase().includes(q) ||
      sym.nameEn.toLowerCase().includes(q) ||
      sym.description.toLowerCase().includes(q) ||
      sym.id.toLowerCase().includes(q)
    );
  });
}
