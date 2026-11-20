/**
 * @file SymbolsCatalogModal.tsx
 * @description نافذة مكتبة الرموز الهندسية الشاملة (Symbols Library Catalog).
 * تدعم تصفح وتصنيف والبحث عن كافة الرموز (كهرباء، سباكة، تكييف، إطفاء حريق)،
 * مع عرض رسومات SVG المصغرة والتفاصيل الهندسية.
 */

import React, { useState } from 'react';
import {
  X,
  Search,
  Zap,
  Droplets,
  Wind,
  Flame,
  Magnet,
  Check,
  Layers as LayersIcon,
  Sparkles,
  Plus,
  Armchair,
} from 'lucide-react';
import { SymbolCategory, SymbolDefinition } from '../symbols/types.ts';
import { ALL_SYMBOLS, CATEGORIES_META, searchSymbols } from '../symbols/registry.ts';

interface SymbolsCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSymbolKind: string;
  onSelectSymbol: (symbol: SymbolDefinition) => void;
  onOpenCustomSymbolModal?: () => void;
}

export const SymbolsCatalogModal: React.FC<SymbolsCatalogModalProps> = ({
  isOpen,
  onClose,
  activeSymbolKind,
  onSelectSymbol,
  onOpenCustomSymbolModal,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<SymbolCategory | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredSymbols = ALL_SYMBOLS.filter((sym) => {
    if (selectedCategory !== 'all' && sym.category !== selectedCategory) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      sym.name.toLowerCase().includes(q) ||
      sym.nameEn.toLowerCase().includes(q) ||
      sym.description.toLowerCase().includes(q)
    );
  });

  const getCategoryIcon = (cat: SymbolCategory) => {
    switch (cat) {
      case 'elec':
        return <Zap size={16} className="text-amber-400" />;
      case 'plumb':
        return <Droplets size={16} className="text-sky-400" />;
      case 'hvac':
        return <Wind size={16} className="text-emerald-400" />;
      case 'fire':
        return <Flame size={16} className="text-rose-400" />;
      case 'furniture':
        return <Armchair size={16} className="text-purple-400" />;
      case 'custom':
        return <Sparkles size={16} className="text-purple-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs select-none p-4">
      <div className="w-full max-w-4xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-neutral-200 animate-in fade-in zoom-in-95 duration-150">
        {/* رأس النافذة */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Zap size={22} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <span>مكتبة الرموز الهندسية والفرش المعماري والأجهزة</span>
                <span className="text-[10px] bg-sky-950 text-sky-400 border border-sky-800 px-2 py-0.5 rounded-full font-mono-cad">
                  معايير عالمية
                </span>
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* شريط البحث وتصنيفات التخصصات */}
        <div className="px-6 py-3 border-b border-neutral-800 bg-neutral-900 flex flex-col md:flex-row items-center justify-between gap-3">
          {/* تبويبات الأقسام */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                selectedCategory === 'all'
                  ? 'bg-neutral-800 text-white border border-neutral-700 shadow-xs'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
              }`}
            >
              <span>الكل ({ALL_SYMBOLS.length})</span>
            </button>

            {(Object.keys(CATEGORIES_META) as SymbolCategory[]).map((catKey) => {
              const meta = CATEGORIES_META[catKey];
              const count = ALL_SYMBOLS.filter((s) => s.category === catKey).length;
              const isSelected = selectedCategory === catKey;

              return (
                <button
                  key={catKey}
                  onClick={() => setSelectedCategory(catKey)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                    isSelected
                      ? 'bg-neutral-800 text-white border border-neutral-700 shadow-xs'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                  }`}
                >
                  {getCategoryIcon(catKey)}
                  <span>{meta.name}</span>
                  <span className="text-[10px] text-neutral-400 font-mono-cad">({count})</span>
                </button>
              );
            })}
          </div>

          {/* شريط الإجراءات: إنشاء رمز مخصص وحقل البحث */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            {onOpenCustomSymbolModal && (
              <button
                onClick={() => {
                  onClose();
                  onOpenCustomSymbolModal();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-sm transition-colors whitespace-nowrap"
                title="تصميم وإضافة رمز هندسي مخصص جديد"
              >
                <Plus size={14} />
                <span>إنشاء رمز مخصص</span>
              </button>
            )}

            {/* حقل البحث */}
            <div className="relative w-full md:w-56">
              <Search className="absolute right-3 top-2.5 text-neutral-500" size={15} />
              <input
                type="text"
                placeholder="بحث عن رمز..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pr-9 pl-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        </div>

        {/* شبكة بطاقات الرموز */}
        <div className="p-6 overflow-y-auto flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 bg-neutral-950/40">
          {filteredSymbols.map((sym) => {
            const isCurrent = sym.id === activeSymbolKind;
            const catMeta = CATEGORIES_META[sym.category];

            return (
              <div
                key={sym.id}
                onClick={() => {
                  onSelectSymbol(sym);
                  onClose();
                }}
                className={`group relative p-3 rounded-xl border flex flex-col justify-between transition-all cursor-pointer select-none ${
                  isCurrent
                    ? 'bg-neutral-800/90 border-sky-500 ring-2 ring-sky-500/30 shadow-lg'
                    : 'bg-neutral-900/80 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/50'
                }`}
              >
                {/* شارة النشط أو علامة الصح */}
                {isCurrent && (
                  <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-sky-500 text-neutral-950 flex items-center justify-center font-bold">
                    <Check size={12} strokeWidth={3} />
                  </div>
                )}

                {/* معاينة الرمز الهندسي */}
                <div className="flex flex-col items-center justify-center py-2 mb-2">
                  <div
                    className="w-14 h-14 rounded-xl bg-neutral-950/80 border border-neutral-800/80 flex items-center justify-center text-neutral-200 group-hover:scale-110 transition-transform p-2"
                    style={{ color: catMeta.color }}
                    dangerouslySetInnerHTML={{ __html: sym.svgPreview }}
                  />
                </div>

                {/* معلومات الرمز */}
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <h4 className="font-bold text-base text-white" title={sym.name}>
                      {sym.name}
                    </h4>
                  </div>

                  <p className="text-xs text-neutral-400 font-mono-cad truncate mb-2" title={sym.nameEn}>
                    {sym.nameEn}
                  </p>

                  {/* نص التوضيح الهندسي للرمز بحجم خط أكبر وأوضح ومريح للقراءة */}
                  <div className="bg-neutral-950/70 p-2.5 rounded-lg border border-neutral-800/80 mb-2.5">
                    <p className="text-sm text-neutral-200 leading-relaxed font-medium" title={sym.description}>
                      {sym.description}
                    </p>
                  </div>

                  {/* شارات الخصائص */}
                  <div className="flex items-center justify-between pt-2 border-t border-neutral-800/80 text-xs">
                    <span
                      className="px-2 py-0.5 rounded font-medium flex items-center gap-1.5"
                      style={{
                        backgroundColor: `${catMeta.color}20`,
                        color: catMeta.color,
                      }}
                    >
                      <LayersIcon size={13} />
                      {catMeta.name}
                    </span>

                    {sym.wallMountable ? (
                      <span className="text-sky-400 font-semibold flex items-center gap-1" title="يلتصق بالجدار تلقائياً">
                        <Magnet size={13} />
                        جداري
                      </span>
                    ) : (
                      <span className="text-neutral-400 font-medium">حر / سقف</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredSymbols.length === 0 && (
            <div className="col-span-full py-16 text-center text-neutral-500">
              <Search className="mx-auto mb-2 opacity-30" size={32} />
              <p className="text-sm font-medium">لم يتم العثور على رموز مطابقة لـ "{searchQuery}"</p>
              <p className="text-xs text-neutral-400 mt-1">جرب البحث بكلمات أخرى أو اختر قسماً مختلفاً</p>
            </div>
          )}
        </div>

        {/* تذييل النافذة */}
        <div className="px-6 py-3.5 border-t border-neutral-800 bg-neutral-950/80 flex items-center justify-end text-xs text-neutral-400">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-xs font-medium transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
