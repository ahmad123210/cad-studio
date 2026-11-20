/**
 * @file LayersPanel.tsx
 * @description لوحة إدارة الطبقات الهندسية الكاملة (Full Layers System - المرحلة 4).
 * تتيح:
 * - تفعيل الطبقة النشطة (Active Layer) التي تتلقى العناصر الجديدة
 * - إظهار / إخفاء الطبقات (Visible toggle)
 * - قفل / فتح الطبقات (Locked toggle)
 * - التحكم في شفافية كل طبقة (Opacity slider)
 * - تغيير لون الطبقة (Color picker / presets)
 * - إعادة ترتيب الطبقات (Reorder Up / Down) لتحديد ترتيب الرسم (Z-index)
 * - إضافة طبقات مخصصة جديدة وحذفها
 */

import React, { useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  X,
  Layers as LayersIcon,
  Sliders,
  Palette,
  Edit2,
  Check,
} from 'lucide-react';
import { ProjectModel } from '../model/project.ts';

interface LayersPanelProps {
  model: ProjectModel;
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_COLORS = [
  '#f3f4f6', // رمادي معماري
  '#f59e0b', // كهرماني كهرباء
  '#3b82f6', // أزرق سباكة
  '#10b981', // أخضر تكييف
  '#ef4444', // أحمر إطفاء
  '#8b5cf6', // بنفسجي
  '#ec4899', // وردي
  '#14b8a6', // تيل
];

export const LayersPanel: React.FC<LayersPanelProps> = ({ model, isOpen, onClose }) => {
  const [isAddingLayer, setIsAddingLayer] = useState(false);
  const [newLayerName, setNewLayerName] = useState('');
  const [newLayerColor, setNewLayerColor] = useState('#8b5cf6');
  const [activeColorPickerLayerId, setActiveColorPickerLayerId] = useState<string | null>(null);
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingLayerName, setEditingLayerName] = useState('');

  if (!isOpen) return null;

  const layers = model.getLayers();
  const activeLayerId = model.getActiveLayerId();
  const allObjects = model.getObjects();

  const handleStartRename = (id: string, currentName: string, isDef?: boolean) => {
    if (isDef || ['arch', 'elec', 'plumb', 'hvac', 'fire'].includes(id)) {
      return;
    }
    setEditingLayerId(id);
    setEditingLayerName(currentName);
  };

  const handleSaveRename = (id: string) => {
    if (editingLayerName.trim()) {
      model.updateLayer(id, { name: editingLayerName.trim() });
    }
    setEditingLayerId(null);
  };

  const handleToggleVisible = (id: string, current: boolean) => {
    model.setLayerVisibility(id, !current);
  };

  const handleToggleLock = (id: string, current: boolean) => {
    model.setLayerLock(id, !current);
  };

  const handleSelectActive = (id: string) => {
    model.setActiveLayerId(id);
  };

  const handleOpacityChange = (id: string, val: number) => {
    model.setLayerOpacity(id, val);
  };

  const handleColorChange = (id: string, color: string) => {
    model.setLayerColor(id, color);
    setActiveColorPickerLayerId(null);
  };

  const handleMoveUp = (index: number) => {
    if (index > 0) {
      model.reorderLayers(index, index - 1);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < layers.length - 1) {
      model.reorderLayers(index, index + 1);
    }
  };

  const handleCreateLayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLayerName.trim()) return;

    model.addLayer({
      name: newLayerName.trim(),
      color: newLayerColor,
      visible: true,
      locked: false,
      opacity: 1,
    });

    setNewLayerName('');
    setIsAddingLayer(false);
  };

  const handleDeleteLayer = (id: string) => {
    model.deleteLayer(id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs select-none p-4">
      <div className="w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-neutral-200 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh]">
        {/* رأس اللوحة */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <LayersIcon size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <span>إدارة الطبقات الهندسية (Layers System)</span>
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

        {/* زر إضافة طبقة جديدة */}
        <div className="px-6 py-3 border-b border-neutral-800/80 bg-neutral-900/60 flex items-center justify-between">
          <span className="text-xs text-neutral-400">
            طبقات المخطط ({layers.length}) • الطبقة النشطة مظللة
          </span>
          {!isAddingLayer ? (
            <button
              onClick={() => setIsAddingLayer(true)}
              className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-sky-400 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 border border-neutral-700"
            >
              <Plus size={14} />
              <span>إضافة طبقة</span>
            </button>
          ) : (
            <button
              onClick={() => setIsAddingLayer(false)}
              className="text-xs text-neutral-400 hover:text-neutral-200"
            >
              إلغاء
            </button>
          )}
        </div>

        {/* نموذج إضافة طبقة جديدة */}
        {isAddingLayer && (
          <form
            onSubmit={handleCreateLayer}
            className="p-4 bg-neutral-950/70 border-b border-neutral-800 flex flex-col gap-3 animate-in fade-in duration-150"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="اسم الطبقة (مثال: شبكة الغاز، كاميرات المراقبة...)"
                value={newLayerName}
                onChange={(e) => setNewLayerName(e.target.value)}
                autoFocus
                className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-sky-500"
              />
              <button
                type="submit"
                disabled={!newLayerName.trim()}
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-lg text-xs font-semibold transition-colors"
              >
                إنشاء
              </button>
            </div>

            {/* اختيار اللون للطبقة الجديدة */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-neutral-400">لون الطبقة:</span>
              <div className="flex items-center gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewLayerColor(c)}
                    className={`w-5 h-5 rounded-full transition-transform ${
                      newLayerColor === c ? 'scale-125 ring-2 ring-white' : 'opacity-70 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </form>
        )}

        {/* قائمة الطبقات */}
        <div className="p-4 flex flex-col gap-2.5 overflow-y-auto flex-1">
          {layers.map((layer, index) => {
            const count = allObjects.filter((o) => o.layerId === layer.id).length;
            const isActive = layer.id === activeLayerId;
            const opacity = layer.opacity ?? 1;
            const isColorPickerOpen = activeColorPickerLayerId === layer.id;

            return (
              <div
                key={layer.id}
                onClick={() => handleSelectActive(layer.id)}
                className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-2.5 ${
                  isActive
                    ? 'bg-neutral-800/90 border-sky-500/70 shadow-md ring-1 ring-sky-500/20'
                    : 'bg-neutral-950/40 border-neutral-800 hover:border-neutral-700'
                }`}
              >
                {/* الصف العلوي: اللون، الاسم، أزرار الترتيب، والإظهار والقفل */}
                <div className="flex items-center justify-between">
                  {/* معلومات الطبقة */}
                  <div className="flex items-center gap-2.5">
                    {/* زر اللون ومبدل الألوان */}
                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() =>
                          setActiveColorPickerLayerId(isColorPickerOpen ? null : layer.id)
                        }
                        className="w-4 h-4 rounded-full ring-2 ring-neutral-700/60 hover:scale-110 transition-transform"
                        style={{ backgroundColor: layer.color }}
                        title="تغيير لون الطبقة"
                      />

                      {/* قائمة منبثقة مصغرة لاختيار اللون */}
                      {isColorPickerOpen && (
                        <div className="absolute top-6 right-0 z-30 bg-neutral-900 border border-neutral-700 p-2 rounded-lg shadow-xl flex items-center gap-1.5 animate-in fade-in zoom-in-95">
                          {PRESET_COLORS.map((c) => (
                            <button
                              key={c}
                              onClick={() => handleColorChange(layer.id, c)}
                              className="w-4 h-4 rounded-full hover:scale-125 transition-transform"
                              style={{ backgroundColor: c }}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {editingLayerId === layer.id ? (
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editingLayerName}
                              onChange={(e) => setEditingLayerName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRename(layer.id);
                                if (e.key === 'Escape') setEditingLayerId(null);
                              }}
                              className="px-2 py-0.5 bg-neutral-900 border border-sky-500 rounded text-xs text-white outline-none w-28"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveRename(layer.id)}
                              className="p-1 rounded bg-sky-600 hover:bg-sky-500 text-white"
                              title="حفظ الاسم"
                            >
                              <Check size={12} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span
                              className={`text-xs font-semibold ${
                                isActive ? 'text-white font-bold' : 'text-neutral-300'
                              }`}
                              onDoubleClick={() => handleStartRename(layer.id, layer.name, layer.isDefault)}
                            >
                              {layer.name}
                            </span>
                            {!layer.isDefault && !['arch', 'elec', 'plumb', 'hvac', 'fire'].includes(layer.id) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartRename(layer.id, layer.name, layer.isDefault);
                                }}
                                className="p-0.5 text-neutral-500 hover:text-sky-400 transition-colors"
                                title="إعادة تسمية الطبقة"
                              >
                                <Edit2 size={11} />
                              </button>
                            )}
                          </>
                        )}
                        {isActive && (
                          <span className="text-[9px] bg-sky-950 text-sky-400 border border-sky-800 px-1.5 py-0.2 rounded font-medium">
                            نشطة
                          </span>
                        )}
                        {(layer.isDefault || ['arch', 'elec', 'plumb', 'hvac', 'fire'].includes(layer.id)) && (
                          <span className="text-[8.5px] bg-neutral-800 text-neutral-400 border border-neutral-700 px-1.5 py-0.2 rounded font-medium" title="طبقة أساسية لا يمكن حذفها أو إعادة تسميتها">
                            افتراضية
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-neutral-400 font-mono-cad">
                        العناصر: {count}
                      </span>
                    </div>
                  </div>

                  {/* أزرار التحكم بالترتيب والإظهار والقفل */}
                  <div
                    className="flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* أزرار الترتيب (Up / Down) */}
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-700 disabled:opacity-20 transition-colors"
                      title="رفع الطبقة للأعلى (Z-Index)"
                    >
                      <ChevronUp size={15} />
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === layers.length - 1}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-700 disabled:opacity-20 transition-colors"
                      title="إنزال الطبقة للأسفل (Z-Index)"
                    >
                      <ChevronDown size={15} />
                    </button>

                    <div className="w-px h-4 bg-neutral-800 mx-1" />

                    {/* زر الإظهار / الإخفاء */}
                    <button
                      onClick={() => handleToggleVisible(layer.id, layer.visible)}
                      className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                        layer.visible
                          ? 'text-neutral-300 hover:bg-neutral-700 hover:text-white'
                          : 'text-neutral-600 bg-neutral-900 hover:text-neutral-400'
                      }`}
                      title={layer.visible ? 'إخفاء الطبقة' : 'إظهار الطبقة'}
                    >
                      {layer.visible ? <Eye size={15} /> : <EyeOff size={15} />}
                    </button>

                    {/* زر القفل / الفتح */}
                    <button
                      onClick={() => handleToggleLock(layer.id, layer.locked)}
                      className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                        layer.locked
                          ? 'text-amber-400 bg-amber-950/40 hover:bg-amber-900/40'
                          : 'text-neutral-500 hover:bg-neutral-700 hover:text-neutral-300'
                      }`}
                      title={layer.locked ? 'الطبقة مقفلة' : 'قفل الطبقة'}
                    >
                      {layer.locked ? <Lock size={14} /> : <Unlock size={14} />}
                    </button>

                    {/* زر حذف الطبقة (متاح فقط للطبقات المخصصة غير الافتراضية) */}
                    {layers.length > 1 && !layer.isDefault && !['arch', 'elec', 'plumb', 'hvac', 'fire'].includes(layer.id) && (
                      <button
                        onClick={() => handleDeleteLayer(layer.id)}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-neutral-600 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
                        title="حذف هذه الطبقة"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                {/* شريط الشفافية (Opacity Slider) */}
                <div
                  className="flex items-center gap-3 pt-1 border-t border-neutral-800/60"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-1 text-[10px] text-neutral-400">
                    <Sliders size={11} />
                    <span>الشفافية:</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    value={Math.round(opacity * 100)}
                    onChange={(e) => handleOpacityChange(layer.id, Number(e.target.value) / 100)}
                    className="flex-1 h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                  />
                  <span className="text-[10px] font-mono-cad text-neutral-400 w-8 text-left">
                    {Math.round(opacity * 100)}%
                  </span>
                </div>
              </div>
            );
          })}
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
