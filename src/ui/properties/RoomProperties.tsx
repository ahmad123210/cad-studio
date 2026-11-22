/**
 * @file RoomProperties.tsx
 * @description لوحة خصائص الغرفة: الاسم ونوع الأرضية، والمساحة والمحيط الصافيان المحسوبان من الجدران.
 */

import React, { useMemo } from 'react';
import { Trash2, PanelRightClose, LayoutGrid, AlertTriangle } from 'lucide-react';
import type { RoomObject, WallObject } from '../../model/types.ts';
import { buildRoomGraph, findRoomAt } from '../../model/rooms.ts';
import { LabelInput } from './inputs.tsx';
import type { PanelContext } from './context.ts';

/** اقتراحات شائعة لأنواع الأرضيات (حقل حر يقبل أي قيمة) */
export const FLOOR_TYPE_SUGGESTIONS = ['بلاط سيراميك', 'بورسلان', 'رخام', 'جرانيت', 'باركيه', 'بلاط موزاييك', 'إيبوكسي', 'بلاط خارجي (انترلوك)'];

export const RoomProperties: React.FC<PanelContext> = (ctx) => {
  const { model, selectedObject, pixelsPerMeter, handleDelete, onToggleVisible, onClearSelection } = ctx;
  const room = selectedObject as RoomObject;
  const version = model.getVersion();
  const face = useMemo(() => {
    const walls = model.getObjects().filter((o) => o.type === 'wall') as WallObject[];
    return findRoomAt(buildRoomGraph(walls), { x: room.x, y: room.y });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, room.x, room.y]);
  const ppm = pixelsPerMeter || 50;
  const area = face ? face.netArea / (ppm * ppm) : 0;
  const perim = face ? face.netPerimeter / ppm : 0;

  return (
    <aside className="w-72 bg-neutral-900 border-r border-neutral-800 flex flex-col text-neutral-200 select-none z-10 overflow-y-auto">
      <div className="p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
            <LayoutGrid size={16} className="text-emerald-400" />
            خصائص الغرفة
          </h2>
          <div className="flex items-center gap-1">
            {onToggleVisible && (
              <button onClick={onToggleVisible} className="text-xs text-neutral-400 hover:text-white px-1.5 py-1 rounded hover:bg-neutral-800" title="إخفاء لوحة الخصائص">
                <PanelRightClose size={15} />
              </button>
            )}
            <button onClick={onClearSelection} className="text-xs text-neutral-400 hover:text-white px-2 py-1 rounded hover:bg-neutral-800">
              ✕
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-neutral-300">اسم الغرفة:</label>
          <LabelInput
            placeholder="مثال: صالة، غرفة نوم 1، مطبخ"
            value={room.name || ''}
            onSave={(val, recordHistory = true) => model.updateObject(room.id, { name: val || 'غرفة' }, recordHistory)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-neutral-300">نوع الأرضية:</label>
          <input
            list="floor-type-suggestions"
            data-testid="room-floor-type"
            defaultValue={room.floorType || ''}
            key={room.id + (room.floorType || '')}
            placeholder="اختر أو اكتب..."
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v !== (room.floorType || '')) model.updateObject(room.id, { floorType: v || undefined });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            }}
            className="bg-neutral-800 border border-neutral-700 rounded-md px-2.5 py-1.5 text-xs text-neutral-100 outline-none focus:border-emerald-500"
          />
          <datalist id="floor-type-suggestions">
            {FLOOR_TYPE_SUGGESTIONS.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </div>

        {face ? (
          <div className="bg-neutral-950/60 p-3 rounded-lg border border-neutral-800 flex flex-col gap-1.5 text-xs" data-testid="room-metrics">
            <div className="flex justify-between">
              <span className="text-neutral-400">المساحة الصافية:</span>
              <span className="font-mono-cad text-emerald-300 font-bold">{area.toFixed(2)} م²</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">المحيط الصافي:</span>
              <span className="font-mono-cad text-sky-300 font-bold">{perim.toFixed(2)} م</span>
            </div>
            <p className="text-[10px] text-neutral-500 leading-relaxed pt-1">
              تُحسب من الوجه الداخلي للجدران وتتحدث تلقائياً عند تعديلها. اسحب البطاقة لنقلها داخل الغرفة.
            </p>
          </div>
        ) : (
          <div className="bg-amber-950/40 p-3 rounded-lg border border-amber-800/60 flex gap-2 text-xs text-amber-200">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>البطاقة ليست داخل غرفة مغلقة. تأكد أن الجدران المحيطة متصلة، أو اسحب البطاقة إلى داخل الغرفة.</span>
          </div>
        )}

        <div className="pt-2 border-t border-neutral-800">
          <button
            onClick={handleDelete}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 rounded-md border border-rose-500/40 transition-colors"
          >
            <Trash2 size={14} />
            <span>حذف بطاقة الغرفة</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
