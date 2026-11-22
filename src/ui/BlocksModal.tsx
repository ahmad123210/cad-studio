/**
 * @file BlocksModal.tsx
 * @description مكتبة الكتل: كتل جاهزة (مطبخ، حمام، غرفة نوم، صالة، سفرة) وكتل المشروع المحفوظة،
 * مع حفظ التحديد الحالي ككتلة جديدة. الضغط على كتلة يبدأ الإدراج على اللوحة.
 */
import React, { useMemo, useState, useSyncExternalStore } from 'react';
import Konva from 'konva';
import { X, Boxes, Trash2, Save } from 'lucide-react';
import type { ProjectModel } from '../model/project.ts';
import type { CadEngine } from '../engine/renderer.ts';
import type { Point } from '../model/types.ts';
import { builtinBlocks, makeBlock, type BlockDef } from '../model/blocks.ts';
import { withHostedObjects } from '../model/transforms.ts';
import { drawObjectsGhost } from '../engine/tools/blockCommands.ts';

interface BlocksModalProps {
  model: ProjectModel;
  engine: CadEngine | null;
  isOpen: boolean;
  onClose: () => void;
}

/** صورة مصغرة للكتلة (Konva خارج الشاشة) */
function thumbnail(block: BlockDef, size = 120): string {
  const objs = block.objects;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const inc = (p: Point, pad = 0) => {
    minX = Math.min(minX, p.x - pad);
    minY = Math.min(minY, p.y - pad);
    maxX = Math.max(maxX, p.x + pad);
    maxY = Math.max(maxY, p.y + pad);
  };
  for (const o of objs) {
    const a = o as unknown as { start?: Point; end?: Point; points?: Point[]; x?: number; y?: number };
    if (a.start && a.end) {
      inc(a.start);
      inc(a.end);
    } else if (a.points) a.points.forEach((p) => inc(p));
    else if (typeof a.x === 'number' && typeof a.y === 'number') inc({ x: a.x, y: a.y }, 30);
  }
  if (!isFinite(minX)) return '';
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const k = (size * 0.84) / Math.max(w, h);
  const ox = (size - w * k) / 2 - minX * k;
  const oy = (size - h * k) / 2 - minY * k;
  const stage = new Konva.Stage({ container: document.createElement('div'), width: size, height: size });
  const layer = new Konva.Layer();
  stage.add(layer);
  drawObjectsGhost(layer, objs, (p) => ({ x: p.x * k + ox, y: p.y * k + oy }), k, '#cbd5e1');
  layer.draw();
  const url = stage.toDataURL({ pixelRatio: 2 });
  stage.destroy();
  return url;
}

export const BlocksModal: React.FC<BlocksModalProps> = ({ model, engine, isOpen, onClose }) => {
  const [name, setName] = useState('');
  const version = useSyncExternalStore((cb) => model.subscribe(() => cb()), () => model.getVersion());
  const ppm = model.getMeta().scale || 50;
  const builtins = useMemo(() => (isOpen ? builtinBlocks(ppm) : []), [isOpen, ppm]);
  const projectBlocks = useMemo(
    () => (isOpen ? model.getBlocks() : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOpen, version]
  );
  const thumbs = useMemo(() => {
    const m: Record<string, string> = {};
    if (!isOpen) return m;
    for (const b of [...builtins, ...projectBlocks]) m[b.id] = thumbnail(b);
    return m;
  }, [isOpen, builtins, projectBlocks]);

  if (!isOpen) return null;
  const selectedIds = engine?.getSelectedObjectIds() ?? [];

  const insert = (b: BlockDef) => {
    onClose();
    const err = engine?.startEditCommand('insertblock', { blockId: b.id, rotation: 0 });
    if (err) alert(err);
  };

  const saveSelection = () => {
    if (!selectedIds.length) return;
    const all = model.getObjects();
    const ids = new Set(withHostedObjects(selectedIds, all));
    const objs = all.filter((o) => ids.has(o.id));
    model.addBlock(makeBlock(objs, name || `كتلة ${projectBlocks.length + 1}`));
    setName('');
  };

  const Card: React.FC<{ b: BlockDef; removable?: boolean }> = ({ b, removable }) => (
    <div className="group relative rounded-xl border border-neutral-800 bg-neutral-950/50 hover:border-sky-500/60 transition-colors">
      <button onClick={() => insert(b)} className="w-full p-2 flex flex-col items-center gap-1.5" data-testid={`block-${b.id}`} title="انقر ثم حدد موضع الإدراج على اللوحة">
        {thumbs[b.id] ? <img src={thumbs[b.id]} alt="" className="w-24 h-24 object-contain" /> : <div className="w-24 h-24" />}
        <span className="text-xs text-neutral-200 text-center leading-tight">{b.name}</span>
        <span className="text-[10px] text-neutral-500">{b.objects.length} عنصر</span>
      </button>
      {removable && (
        <button
          onClick={() => model.removeBlock(b.id)}
          className="absolute top-1.5 left-1.5 p-1 rounded-md text-rose-300 bg-neutral-900/90 opacity-0 group-hover:opacity-100"
          title="حذف الكتلة من المشروع"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" data-testid="blocks-modal" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[88vh] overflow-hidden flex flex-col bg-neutral-900 border border-neutral-800 rounded-2xl text-neutral-200" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3.5 border-b border-neutral-800 flex items-center justify-between">
          <h3 className="font-bold text-white flex items-center gap-2">
            <Boxes size={18} className="text-sky-400" /> مكتبة الكتل
          </h3>
          <button onClick={onClose} aria-label="إغلاق" className="w-8 h-8 rounded-lg hover:bg-neutral-800 flex items-center justify-center text-neutral-400">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex flex-col gap-5">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-neutral-950/50 border border-neutral-800">
            <input
              data-testid="block-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={selectedIds.length ? 'اسم الكتلة (مثل: مطبخ شقة نموذجي)' : 'حدد عناصر على المخطط أولاً لحفظها ككتلة'}
              disabled={!selectedIds.length}
              className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-sm outline-none focus:border-sky-500 disabled:opacity-50"
            />
            <button
              data-testid="save-block"
              onClick={saveSelection}
              disabled={!selectedIds.length}
              className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-sm flex items-center gap-1.5 disabled:opacity-40"
            >
              <Save size={14} /> حفظ التحديد ككتلة ({selectedIds.length})
            </button>
          </div>

          {projectBlocks.length > 0 && (
            <section>
              <h4 className="text-xs font-bold text-neutral-400 mb-2">كتل المشروع</h4>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {projectBlocks.map((b) => (
                  <Card key={b.id} b={b} removable />
                ))}
              </div>
            </section>
          )}

          <section>
            <h4 className="text-xs font-bold text-neutral-400 mb-2">كتل جاهزة</h4>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {builtins.map((b) => (
                <Card key={b.id} b={b} />
              ))}
            </div>
          </section>
          <p className="text-[11px] text-neutral-500">
            بعد اختيار الكتلة: انقر على اللوحة لإدراجها (يتكرر حتى Esc)، واكتب زاوية مثل 90 في شريط الأوامر لتدويرها قبل الإدراج. العناصر المُدرجة تبقى قابلة للتعديل بشكل مستقل.
          </p>
        </div>
      </div>
    </div>
  );
};
