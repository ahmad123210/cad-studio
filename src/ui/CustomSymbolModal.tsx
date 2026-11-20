/**
 * @file CustomSymbolModal.tsx
 * @description استوديو تصميم وإدارة الرموز الهندسية المخصصة (Custom Symbol Studio) - المرحلة 7.
 * يتيح للمهندس تصميم رمز هندسي جديد، واختيار أشكاله المتجهة، أيقوناته، نقاط التوصيل،
 * وخاصية الالتصاق الذكي بالجدران، مع معاينة حية فورية.
 */

import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Save,
  Plus,
  Trash2,
  Check,
  Zap,
  Droplets,
  Wind,
  Flame,
  Layers,
} from 'lucide-react';
import { SymbolCategory } from '../symbols/types.ts';
import {
  CustomSymbolConfig,
  SymbolShapeType,
  SymbolIconType,
  TerminalPosition,
  saveCustomSymbol,
  deleteCustomSymbol,
  getStoredCustomSymbols,
  generateSvgPreview,
} from '../symbols/customSymbols.ts';

interface CustomSymbolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSymbolCreated?: (symbolId: string) => void;
}

export const CustomSymbolModal: React.FC<CustomSymbolModalProps> = ({
  isOpen,
  onClose,
  onSymbolCreated,
}) => {
  const [symbolsList, setSymbolsList] = useState<CustomSymbolConfig[]>(() =>
    getStoredCustomSymbols()
  );

  // حالة الرمز الجاري تصميمه
  const [name, setName] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [category, setCategory] = useState<SymbolCategory>('elec');
  const [description, setDescription] = useState('');
  const [shape, setShape] = useState<SymbolShapeType>('circle');
  const [iconType, setIconType] = useState<SymbolIconType>('text');
  const [iconText, setIconText] = useState('DB');
  const [primaryColor, setPrimaryColor] = useState('#f59e0b');
  const [fillColor, setFillColor] = useState('transparent');
  const [width, setWidth] = useState(26);
  const [height, setHeight] = useState(26);
  const [wallMountable, setWallMountable] = useState(true);
  const [terminals, setTerminals] = useState<TerminalPosition[]>(['top', 'bottom']);

  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentPreviewConfig: CustomSymbolConfig = {
    id: 'preview_temp',
    name: name || 'رمز مخصص',
    nameEn: nameEn || 'Custom Symbol',
    category,
    defaultLayerId: category,
    description,
    shape,
    iconType,
    iconText: iconText.toUpperCase(),
    primaryColor,
    fillColor,
    width,
    height,
    wallMountable,
    terminals,
    createdAt: Date.now(),
  };

  const previewSvg = generateSvgPreview(currentPreviewConfig);

  const handleToggleTerminal = (pos: TerminalPosition) => {
    setTerminals((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
    );
  };

  const handleSave = () => {
    if (!name.trim()) {
      setErrorMsg('يرجى إدخال اسم الرمز باللغة العربية.');
      return;
    }

    const newId = `custom_${Date.now()}_${nameEn ? nameEn.toLowerCase().replace(/\s+/g, '_') : 'sym'}`;
    const newConfig: CustomSymbolConfig = {
      ...currentPreviewConfig,
      id: newId,
      name: name.trim(),
      nameEn: nameEn.trim() || name.trim(),
      createdAt: Date.now(),
    };

    saveCustomSymbol(newConfig);
    setSymbolsList(getStoredCustomSymbols());
    setErrorMsg(null);

    if (onSymbolCreated) {
      onSymbolCreated(newId);
    }

    // إعادة تعيين النموذج
    setName('');
    setNameEn('');
    setDescription('');
    setActiveTab('manage');
  };

  const handleDelete = (id: string) => {
    deleteCustomSymbol(id);
    setSymbolsList(getStoredCustomSymbols());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs select-none p-4">
      <div className="w-full max-w-3xl bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-neutral-200 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh]">
        {/* رأس النافذة */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Sparkles size={22} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <span>استوديو الرموز الهندسية المخصصة (Custom Symbols)</span>
                <span className="text-[10px] bg-purple-950 text-purple-400 border border-purple-800 px-2 py-0.5 rounded-full font-mono-cad">
                  مكتبة متجهة
                </span>
              </h3>
              <p className="text-xs text-neutral-400">
                صمم رموزاً كهروميكانيكية ومعمارية متجهة مع نقاط توصيل والتصاق بالجدران
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* التبويبات */}
        <div className="px-6 pt-3 border-b border-neutral-800 bg-neutral-900/80 flex items-center gap-3">
          <button
            onClick={() => setActiveTab('create')}
            className={`pb-3 text-xs font-semibold flex items-center gap-2 transition-colors border-b-2 ${
              activeTab === 'create'
                ? 'text-purple-400 border-purple-500'
                : 'text-neutral-400 border-transparent hover:text-neutral-200'
            }`}
          >
            <Plus size={15} />
            <span>تصميم رمز جديد</span>
          </button>

          <button
            onClick={() => setActiveTab('manage')}
            className={`pb-3 text-xs font-semibold flex items-center gap-2 transition-colors border-b-2 ${
              activeTab === 'manage'
                ? 'text-purple-400 border-purple-500'
                : 'text-neutral-400 border-transparent hover:text-neutral-200'
            }`}
          >
            <Layers size={15} />
            <span>الرموز المحفوظة ({symbolsList.length})</span>
          </button>
        </div>

        {/* محتوى النافذة */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'create' ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* قسم الإعدادات (8 أعمدة) */}
              <div className="md:col-span-8 space-y-4">
                {/* الاسم والتصنيف */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-neutral-300 block mb-1">
                      اسم الرمز (بالعربية) *
                    </label>
                    <input
                      type="text"
                      placeholder="مثال: لوحة طاقة شمسية، كاميرا مراقبة..."
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-neutral-300 block mb-1">
                      الاسم بالإنجليزية (Engineering Name)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Solar Inverter, CCTV Dome..."
                      value={nameEn}
                      onChange={(e) => setNameEn(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* تخصص الرمز */}
                <div>
                  <label className="text-xs font-medium text-neutral-300 block mb-1.5">
                    التخصص الهندسي (Category)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {[
                      { id: 'elec', label: 'كهرباء', icon: <Zap size={14} className="text-amber-400" /> },
                      { id: 'plumb', label: 'سباكة', icon: <Droplets size={14} className="text-sky-400" /> },
                      { id: 'hvac', label: 'تكييف', icon: <Wind size={14} className="text-emerald-400" /> },
                      { id: 'fire', label: 'إطفاء', icon: <Flame size={14} className="text-rose-400" /> },
                      { id: 'custom', label: 'عام/مخصص', icon: <Sparkles size={14} className="text-purple-400" /> },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setCategory(cat.id as SymbolCategory);
                          if (cat.id === 'elec') setPrimaryColor('#f59e0b');
                          else if (cat.id === 'plumb') setPrimaryColor('#3b82f6');
                          else if (cat.id === 'hvac') setPrimaryColor('#10b981');
                          else if (cat.id === 'fire') setPrimaryColor('#ef4444');
                          else setPrimaryColor('#8b5cf6');
                        }}
                        className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border text-xs transition-colors ${
                          category === cat.id
                            ? 'bg-purple-950/60 border-purple-500 text-white font-bold'
                            : 'bg-neutral-950/40 border-neutral-800 text-neutral-400 hover:bg-neutral-800/40'
                        }`}
                      >
                        {cat.icon}
                        <span>{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* شكل الرمز الخارجي */}
                <div>
                  <label className="text-xs font-medium text-neutral-300 block mb-1.5">
                    الشكل الهندسي الأساسي (Base Shape)
                  </label>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                    {[
                      { id: 'circle', label: 'دائرة' },
                      { id: 'square', label: 'مربع' },
                      { id: 'rect', label: 'مستطيل' },
                      { id: 'triangle', label: 'مثلث' },
                      { id: 'diamond', label: 'معين' },
                      { id: 'hexagon', label: 'مسدس' },
                      { id: 'cross', label: 'صليب' },
                      { id: 'pin', label: 'دبوس' },
                    ].map((sh) => (
                      <button
                        key={sh.id}
                        type="button"
                        onClick={() => setShape(sh.id as SymbolShapeType)}
                        className={`p-2 rounded-lg border text-xs text-center transition-colors ${
                          shape === sh.id
                            ? 'bg-purple-900/50 border-purple-500 text-purple-300 font-bold'
                            : 'bg-neutral-950/40 border-neutral-800 text-neutral-400 hover:bg-neutral-800/40'
                        }`}
                      >
                        {sh.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* المحتوى الداخلي: أيقونة أو رمز نصي */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-neutral-300 block mb-1">
                      الرمز الداخلي (Icon / Glyph)
                    </label>
                    <select
                      value={iconType}
                      onChange={(e) => setIconType(e.target.value as SymbolIconType)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 outline-none focus:border-purple-500"
                    >
                      <option value="text">نص مخصص (حروف/أرقام)</option>
                      <option value="bolt">صاعقة كهرباء (Bolt)</option>
                      <option value="bulb">مصباح إنارة (Bulb)</option>
                      <option value="droplet">قطرة ماء (Water Droplet)</option>
                      <option value="fan">مروحة تكييف (Fan)</option>
                      <option value="flame">لهب حريق (Flame)</option>
                    </select>
                  </div>

                  {iconType === 'text' && (
                    <div>
                      <label className="text-xs font-medium text-neutral-300 block mb-1">
                        نص الرمز (حروف أو أرقام مخصصة)
                      </label>
                      <input
                        type="text"
                        maxLength={16}
                        placeholder="DB, AC, FAN, SMOKE..."
                        value={iconText}
                        onChange={(e) => setIconText(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200 font-mono-cad text-center focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  )}
                </div>

                {/* الألوان والمقاس */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-neutral-300 block mb-1">
                      لون الإطار (Stroke Color)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-8 h-8 rounded border border-neutral-700 bg-neutral-950 cursor-pointer"
                      />
                      <input
                        type="text"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs font-mono-cad text-neutral-300"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-neutral-300 block mb-1">
                      العرض بوحدة الرسم (Width)
                    </label>
                    <input
                      type="number"
                      min={16}
                      max={80}
                      value={width}
                      onChange={(e) => setWidth(parseInt(e.target.value, 10) || 24)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 font-mono-cad text-center"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-neutral-300 block mb-1">
                      الارتفاع (Height)
                    </label>
                    <input
                      type="number"
                      min={16}
                      max={80}
                      value={height}
                      onChange={(e) => setHeight(parseInt(e.target.value, 10) || 24)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-xs text-neutral-200 font-mono-cad text-center"
                    />
                  </div>
                </div>

                {/* نقاط التوصيل والالتصاق بالجدار */}
                <div className="bg-neutral-950/60 p-3.5 rounded-xl border border-neutral-800 space-y-2.5">
                  <span className="text-xs font-semibold text-neutral-200 block">
                    الخصائص التنفيذية ونقاط التوصيل (Terminals)
                  </span>

                  <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wallMountable}
                      onChange={(e) => setWallMountable(e.target.checked)}
                      className="rounded text-purple-500"
                    />
                    <span>
                      التصاق تلقائي بالجدار (Wall Snap) — مثل المفاتيح والبرايز ووحدات الحائط
                    </span>
                  </label>

                  <div className="pt-2 border-t border-neutral-800">
                    <span className="text-[11px] text-neutral-400 block mb-1.5">
                      نقاط ربط المسارات والكابلات (Terminals):
                    </span>
                    <div className="flex items-center gap-2">
                      {(['top', 'bottom', 'left', 'right'] as TerminalPosition[]).map((pos) => {
                        const isChecked = terminals.includes(pos);
                        return (
                          <button
                            key={pos}
                            type="button"
                            onClick={() => handleToggleTerminal(pos)}
                            className={`px-3 py-1 rounded-md text-xs border transition-colors ${
                              isChecked
                                ? 'bg-purple-950 border-purple-500 text-purple-300 font-medium'
                                : 'bg-neutral-900 border-neutral-800 text-neutral-500'
                            }`}
                          >
                            {pos === 'top' && 'أعلى (Top)'}
                            {pos === 'bottom' && 'أسفل (Bottom)'}
                            {pos === 'left' && 'يسار (Left)'}
                            {pos === 'right' && 'يمين (Right)'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {errorMsg && (
                  <div className="text-xs text-rose-400 bg-rose-950/40 p-2.5 rounded-lg border border-rose-800">
                    {errorMsg}
                  </div>
                )}
              </div>

              {/* قسم المعاينة الحية (4 أعمدة) */}
              <div className="md:col-span-4 flex flex-col items-center justify-between bg-neutral-950/60 p-5 rounded-2xl border border-neutral-800">
                <div className="w-full text-center">
                  <span className="text-xs font-semibold text-neutral-400 block mb-3 uppercase tracking-wider">
                    المعاينة الحية للمصغر
                  </span>

                  {/* صندوق المعاينة */}
                  <div className="w-36 h-36 mx-auto rounded-2xl bg-neutral-900 border-2 border-dashed border-neutral-700 flex items-center justify-center p-4 relative shadow-inner">
                    <div
                      className="w-20 h-20 flex items-center justify-center transition-transform hover:scale-110"
                      dangerouslySetInnerHTML={{ __html: previewSvg }}
                    />
                    {wallMountable && (
                      <span className="absolute bottom-2 left-2 text-[9px] bg-sky-950 text-sky-400 border border-sky-800 px-1.5 py-0.5 rounded">
                        Wall Snap
                      </span>
                    )}
                  </div>

                  <div className="mt-4 text-center">
                    <h4 className="font-bold text-sm text-white">{name || 'اسم الرمز'}</h4>
                    <span className="text-[11px] text-neutral-400 font-mono-cad block">
                      {nameEn || 'Symbol Name'}
                    </span>
                    <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700">
                      {width} × {height} px
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSave}
                  className="w-full mt-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Save size={15} />
                  <span>حفظ الرمز في المكتبة</span>
                </button>
              </div>
            </div>
          ) : (
            /* قسم إدارة الرموز المحفوظة */
            <div className="space-y-4">
              {symbolsList.length === 0 ? (
                <div className="text-center py-12 text-neutral-500 text-xs">
                  لا توجد رموز مخصصة حتى الآن. انقر على "تصميم رمز جديد" لإنشاء أول رمز خاص بك!
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {symbolsList.map((sym) => {
                    const svg = generateSvgPreview(sym);
                    return (
                      <div
                        key={sym.id}
                        className="bg-neutral-950/60 border border-neutral-800 rounded-xl p-3 flex items-center justify-between group hover:border-neutral-700 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center p-1.5"
                            dangerouslySetInnerHTML={{ __html: svg }}
                          />
                          <div>
                            <h5 className="font-semibold text-xs text-white">{sym.name}</h5>
                            <span className="text-[10px] text-neutral-400 font-mono-cad block">
                              {sym.nameEn}
                            </span>
                            <span className="text-[9px] text-purple-400 bg-purple-950/50 px-1.5 py-0.2 rounded border border-purple-800/40">
                              {sym.category}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDelete(sym.id)}
                          className="w-7 h-7 rounded-lg hover:bg-rose-950/50 text-neutral-500 hover:text-rose-400 flex items-center justify-center transition-colors"
                          title="حذف الرمز من المكتبة"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* تذييل النافذة */}
        <div className="px-6 py-3.5 border-t border-neutral-800 bg-neutral-950/70 flex items-center justify-between">
          <span className="text-xs text-neutral-400">
            تُحفظ الرموز المخصصة تلقائياً في المتصفح وتظهر في مكتبة الرموز (MEP Catalog)
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
