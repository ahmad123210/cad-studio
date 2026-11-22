/**
 * @file structure.ts (render)
 * @description رسم العناصر الإنشائية: الأعمدة (مستطيلة/دائرية مع تهشير) والدرج (الدرجات وسهم الصعود
 * وعددها)، مع السحب والتحديد، ومقبضي تمطيط للدرج المحدد يعيدان حساب عدد الدرجات أثناء السحب.
 */
import Konva from 'konva';
import type { ColumnObject, StairObject, Point } from '../../model/types.ts';
import { stairsGeometry } from '../../model/stairs.ts';
import type { CadEngine } from '../renderer.ts';

const SEL = '#38bdf8';

/** أحداث التحديد والسحب المشتركة (نفس سلوك الرموز والملاحظات) */
function bindSelectDrag(engine: CadEngine, group: Konva.Group, id: string, isLocked: boolean, onMove: (dx: number, dy: number) => void): void {
  group.on('mouseenter', () => {
    if (engine.toolMode === 'select' && !isLocked) engine.stage.container().style.cursor = engine.isObjectSelected(id) ? 'move' : 'pointer';
  });
  group.on('mouseleave', () => engine.updateCursor());
  group.on('mousedown touchstart', (e) => {
    if (e.evt && (e.evt as MouseEvent).button !== 0 && !(e.evt as TouchEvent).touches) return;
    if (engine.toolMode !== 'select' || engine.selectionSubMode === 'box') return;
    e.cancelBubble = true;
    if (!engine.selectedObjectIds.includes(id)) {
      if ((e.evt as MouseEvent)?.shiftKey || engine.selectionSubMode === 'multi') engine.toggleObjectSelection(id);
      else engine.selectObject(id);
    }
  });
  group.on('click tap', (e) => {
    if (e.evt && (e.evt as MouseEvent).button !== 0 && !(e.evt as TouchEvent).touches) return;
    if (engine.toolMode !== 'select' || engine.selectionSubMode === 'box') return;
    e.cancelBubble = true;
    if (engine.wasGroupDragged) return;
    if ((e.evt as MouseEvent).shiftKey || engine.selectionSubMode === 'multi') engine.toggleObjectSelection(id);
    else engine.selectObject(id);
  });
  const sx = group.x();
  const sy = group.y();
  group.on('dragstart', (e) => {
    e.cancelBubble = true;
    engine.wasGroupDragged = true;
    engine.onGroupDragStart(id);
  });
  group.on('dragmove', (e) => {
    e.cancelBubble = true;
    engine.onGroupDragMove(id, { x: group.x(), y: group.y() });
  });
  group.on('dragend', (e) => {
    e.cancelBubble = true;
    if (engine.onGroupDragEnd(id, { x: group.x(), y: group.y() })) {
      engine.render();
      return;
    }
    const zoom = engine.camera.getState().zoom;
    const dx = (group.x() - sx) / zoom;
    const dy = (group.y() - sy) / zoom;
    group.position({ x: sx, y: sy });
    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) onMove(dx, dy);
    setTimeout(() => {
      engine.wasGroupDragged = false;
    }, 120);
    engine.render();
  });
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export function renderColumnImpl(this: CadEngine, col: ColumnObject, isLocked: boolean, layerColor: string, layerOpacity: number): void {
  const zoom = this.camera.getState().zoom;
  const s = this.camera.worldToScreen({ x: col.x, y: col.y });
  const sel = this.isObjectSelected(col.id);
  const isDark = this.theme === 'dark';
  const stroke = sel ? SEL : col.color || (isDark ? layerColor : '#0f172a');
  const w = Math.max(3, col.width * zoom);
  const d = Math.max(3, col.depth * zoom);
  const group = new Konva.Group({ id: col.id, name: 'column', x: s.x, y: s.y, rotation: col.rotation || 0, opacity: layerOpacity, draggable: !isLocked && this.toolMode === 'select' });
  const fill = isDark ? 'rgba(148,163,184,0.35)' : 'rgba(15,23,42,0.18)';
  if (col.shape === 'round') {
    group.add(new Konva.Circle({ id: col.id, radius: w / 2, fill, stroke, strokeWidth: sel ? 2 : 1.4 }));
    group.add(new Konva.Line({ points: [-w * 0.35, -w * 0.35, w * 0.35, w * 0.35], stroke, strokeWidth: 0.8, listening: false }));
    group.add(new Konva.Line({ points: [-w * 0.35, w * 0.35, w * 0.35, -w * 0.35], stroke, strokeWidth: 0.8, listening: false }));
  } else {
    group.add(new Konva.Rect({ id: col.id, x: -w / 2, y: -d / 2, width: w, height: d, fill, stroke, strokeWidth: sel ? 2 : 1.4 }));
    // تهشير قطري (رمز الخرسانة في المسقط)
    group.add(new Konva.Line({ points: [-w / 2, -d / 2, w / 2, d / 2], stroke, strokeWidth: 0.8, listening: false }));
    group.add(new Konva.Line({ points: [-w / 2, d / 2, w / 2, -d / 2], stroke, strokeWidth: 0.8, listening: false }));
  }
  if (sel) {
    const r = Math.max(w, d) / 2 + 5;
    group.add(new Konva.Rect({ x: -r, y: -r, width: r * 2, height: r * 2, stroke: SEL, dash: [4, 3], strokeWidth: 1, listening: false }));
  }
  bindSelectDrag(this, group, col.id, isLocked, (dx, dy) => this.model.updateObject(col.id, { x: r2(col.x + dx), y: r2(col.y + dy) }));
  this.objectsLayer.add(group);
}

/** رسم درج (يُستخدم أيضاً للمعاينة الحية أثناء الرسم والتمطيط) */
export function drawStairsShapes(engine: CadEngine, target: Konva.Container, st: StairObject, color: string, opts: { selected?: boolean; preview?: boolean; listening?: boolean }): void {
  const ppm = engine.model.getMeta().scale || 50;
  const g = stairsGeometry(st, ppm);
  const toS = (p: Point) => engine.camera.worldToScreen(p);
  const flat = (pts: Point[]) => pts.flatMap((p) => {
    const s = toS(p);
    return [s.x, s.y];
  });
  const sw = opts.selected ? 2 : 1.3;
  const isDark = engine.theme === 'dark';
  target.add(
    new Konva.Line({
      id: opts.preview ? undefined : st.id,
      points: flat(g.outline),
      closed: true,
      fill: opts.preview ? undefined : isDark ? 'rgba(15,23,42,0.35)' : 'rgba(255,255,255,0.6)',
      stroke: color,
      strokeWidth: sw,
      dash: opts.preview ? [6, 4] : undefined,
      listening: opts.listening ?? false,
    })
  );
  for (const [a, b] of g.steps) target.add(new Konva.Line({ points: flat([a, b]), stroke: color, strokeWidth: 1, opacity: 0.9, listening: false }));
  // سهم الصعود على المحور + عدد الدرجات
  const a = toS(st.start);
  const b = toS(st.end);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  if (len > 20) {
    const ux = (b.x - a.x) / len;
    const uy = (b.y - a.y) / len;
    const p0 = { x: a.x + ux * Math.min(12, len * 0.1), y: a.y + uy * Math.min(12, len * 0.1) };
    const p1 = { x: b.x - ux * Math.min(10, len * 0.08), y: b.y - uy * Math.min(10, len * 0.08) };
    target.add(new Konva.Arrow({ points: [p0.x, p0.y, p1.x, p1.y], stroke: color, fill: color, strokeWidth: 1.2, pointerLength: 7, pointerWidth: 6, listening: false }));
    target.add(new Konva.Circle({ x: p0.x, y: p0.y, radius: 2.5, fill: color, listening: false }));
    const zoom = engine.camera.getState().zoom;
    const fs = Math.max(8, Math.min(14, Math.round(11 * zoom)));
    const label = new Konva.Text({ text: `صعود · ${g.treads} درجة`, fontSize: fs, fontFamily: 'Cairo, sans-serif', fill: color, listening: false });
    const nx = -uy;
    const ny = ux;
    const off = (st.width * zoom) / 2 + fs * 0.9;
    const mx = (a.x + b.x) / 2 + nx * off;
    const my = (a.y + b.y) / 2 + ny * off;
    label.position({ x: mx - label.width() / 2, y: my - label.height() / 2 });
    target.add(label);
  }
}

export function renderStairsImpl(this: CadEngine, st: StairObject, isLocked: boolean, layerColor: string, layerOpacity: number): void {
  const sel = this.isObjectSelected(st.id);
  const isDark = this.theme === 'dark';
  const color = sel ? SEL : st.color || (isDark ? layerColor : '#0f172a');
  const group = new Konva.Group({ id: st.id, name: 'stairs', opacity: layerOpacity, draggable: !isLocked && this.toolMode === 'select' });
  drawStairsShapes(this, group, st, color, { selected: sel, listening: true });
  bindSelectDrag(this, group, st.id, isLocked, (dx, dy) =>
    this.model.updateObject(st.id, { start: { x: r2(st.start.x + dx), y: r2(st.start.y + dy) }, end: { x: r2(st.end.x + dx), y: r2(st.end.y + dy) } })
  );
  this.objectsLayer.add(group);

  // مقبضا التمطيط: سحب أي طرف يغيّر طول الدرج وعدد درجاته (معاينة حية في طبقة التفاعل)
  if (sel && !isLocked && this.toolMode === 'select' && this.selectedObjectIds.length <= 1) {
    for (const end of ['start', 'end'] as const) {
      const p = this.camera.worldToScreen(st[end]);
      const h = new Konva.Circle({ x: p.x, y: p.y, radius: 6, fill: '#0ea5e9', stroke: '#ffffff', strokeWidth: 1.5, draggable: true, name: 'stairs-handle' });
      h.on('mouseenter', () => (this.stage.container().style.cursor = 'grab'));
      h.on('mouseleave', () => this.updateCursor());
      h.on('mousedown touchstart', (e) => {
        e.cancelBubble = true;
      });
      const worldAt = () => {
        const w = this.camera.screenToWorld({ x: h.x(), y: h.y() });
        return { x: r2(w.x), y: r2(w.y) };
      };
      h.on('dragmove', (e) => {
        e.cancelBubble = true;
        const ghost: StairObject = { ...st, [end]: worldAt() };
        this.interactionLayer.destroyChildren();
        drawStairsShapes(this, this.interactionLayer, ghost, SEL, { preview: true });
        this.interactionLayer.batchDraw();
      });
      h.on('dragend', (e) => {
        e.cancelBubble = true;
        const np = worldAt();
        const other = st[end === 'start' ? 'end' : 'start'];
        if (Math.hypot(np.x - other.x, np.y - other.y) > 5) this.model.updateObject(st.id, { [end]: np });
        this.interactionLayer.destroyChildren();
        this.render();
      });
      this.objectsLayer.add(h);
    }
  }
}
