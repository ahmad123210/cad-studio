/**
 * @file ifcExport.ts
 * @description تصدير IFC2X3 مبسّط لبرامج BIM (Revit، ArchiCAD، BIMvision، Solibri...):
 *  - مشروع ← موقع ← مبنى ← طابق
 *  - الجدران IfcWallStandardCase بسماكتها وارتفاعها (مقطع مستطيل مبثوق) مع طبقة مادة
 *  - الأبواب والنوافذ: فتحة IfcOpeningElement تقطع الجدار + IfcDoor/IfcWindow يملؤها بأبعاده
 *  - الأعمدة IfcColumn، والغرف IfcSpace بمضلعها الصافي واسمها
 * المحاور: X = x/ppm، Y = -y/ppm (محور Y في البرنامج للأسفل)، والارتفاعات بالمتر.
 */
import type { ProjectObject, WallObject, DoorObject, WindowObject, ColumnObject, RoomObject, QuantitySettings } from '../../model/types.ts';
import { buildRoomGraph, findRoomAt } from '../../model/rooms.ts';

const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';

/** معرف IFC عالمي (22 خانة بترميز IFC base64) */
export function ifcGuid(rand: () => number = Math.random): string {
  let n = 0n;
  for (let i = 0; i < 16; i++) n = (n << 8n) | BigInt(Math.floor(rand() * 256) & 255);
  let s = '';
  for (let i = 0; i < 22; i++) {
    s = CHARS[Number(n % 64n)] + s;
    n /= 64n;
  }
  return s;
}

/** نص STEP: الأحرف غير ASCII بصيغة \X2\XXXX\X0\ */
export function ifcStr(t: string): string {
  let out = '';
  for (const ch of t) {
    const c = ch.codePointAt(0)!;
    if (ch === "'") out += "''";
    else if (ch === '\\') out += '\\\\';
    else if (c >= 0x20 && c < 0x7f) out += ch;
    else out += `\\X2\\${c.toString(16).toUpperCase().padStart(4, '0')}\\X0\\`;
  }
  return `'${out}'`;
}

/** رقم حقيقي بصيغة STEP (يجب أن يحتوي نقطة عشرية) */
const R = (v: number) => {
  const s = (Math.round(v * 1e6) / 1e6).toString();
  return s.includes('.') || s.includes('e') ? s : `${s}.`;
};

export interface IfcOptions {
  projectName: string;
  pixelsPerMeter: number;
  quantities: QuantitySettings;
  /** مولد عشوائي (للاختبارات) */
  rand?: () => number;
  /** تاريخ الملف (للاختبارات) */
  timestamp?: string;
}

export function exportIfc(objects: ProjectObject[], opts: IfcOptions): string {
  const ppm = opts.pixelsPerMeter || 50;
  const q = opts.quantities;
  const rand = opts.rand ?? Math.random;
  const lines: string[] = [];
  let id = 0;
  const e = (body: string): string => {
    id++;
    lines.push(`#${id}=${body};`);
    return `#${id}`;
  };
  const guid = () => `'${ifcGuid(rand)}'`;
  const X = (x: number) => x / ppm;
  const Y = (y: number) => -y / ppm;

  // ─── السياق والوحدات ───
  const person = e(`IFCPERSON($,$,'',$,$,$,$,$)`);
  const org = e(`IFCORGANIZATION($,'CAD Studio',$,$,$)`);
  const pando = e(`IFCPERSONANDORGANIZATION(${person},${org},$)`);
  const app = e(`IFCAPPLICATION(${org},'1.1','CAD Studio','cad-studio')`);
  const owner = e(`IFCOWNERHISTORY(${pando},${app},$,.ADDED.,$,$,$,0)`);
  const dirX = e(`IFCDIRECTION((1.,0.,0.))`);
  const dirZ = e(`IFCDIRECTION((0.,0.,1.))`);
  const origin = e(`IFCCARTESIANPOINT((0.,0.,0.))`);
  const worldAxis = e(`IFCAXIS2PLACEMENT3D(${origin},${dirZ},${dirX})`);
  const ctx = e(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,${worldAxis},$)`);
  const uLen = e(`IFCSIUNIT(*,.LENGTHUNIT.,$,.METRE.)`);
  const uArea = e(`IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)`);
  const uVol = e(`IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)`);
  const uAng = e(`IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)`);
  const units = e(`IFCUNITASSIGNMENT((${uLen},${uArea},${uVol},${uAng}))`);
  const project = e(`IFCPROJECT(${guid()},${owner},${ifcStr(opts.projectName || 'Project')},$,$,$,$,(${ctx}),${units})`);

  // ─── الهيكل المكاني ───
  const sitePl = e(`IFCLOCALPLACEMENT($,${worldAxis})`);
  const site = e(`IFCSITE(${guid()},${owner},'Site',$,$,${sitePl},$,$,.ELEMENT.,$,$,$,$,$)`);
  const bldPl = e(`IFCLOCALPLACEMENT(${sitePl},${worldAxis})`);
  const building = e(`IFCBUILDING(${guid()},${owner},${ifcStr(opts.projectName || 'Building')},$,$,${bldPl},$,$,.ELEMENT.,$,$,$)`);
  const stPl = e(`IFCLOCALPLACEMENT(${bldPl},${worldAxis})`);
  const storey = e(`IFCBUILDINGSTOREY(${guid()},${owner},${ifcStr('الطابق الأرضي')},$,$,${stPl},$,$,.ELEMENT.,0.)`);
  e(`IFCRELAGGREGATES(${guid()},${owner},$,$,${project},(${site}))`);
  e(`IFCRELAGGREGATES(${guid()},${owner},$,$,${site},(${building}))`);
  e(`IFCRELAGGREGATES(${guid()},${owner},$,$,${building},(${storey}))`);

  const pt2 = (x: number, y: number) => e(`IFCCARTESIANPOINT((${R(x)},${R(y)}))`);
  const pt3 = (x: number, y: number, z: number) => e(`IFCCARTESIANPOINT((${R(x)},${R(y)},${R(z)}))`);
  const placementAt = (rel: string, x: number, y: number, z: number, ux = 1, uy = 0) => {
    const dir = e(`IFCDIRECTION((${R(ux)},${R(uy)},0.))`);
    const ax = e(`IFCAXIS2PLACEMENT3D(${pt3(x, y, z)},${dirZ},${dir})`);
    return e(`IFCLOCALPLACEMENT(${rel},${ax})`);
  };
  /** جسم مبثوق من مقطع مستطيل (مركزه cx,cy محلياً) */
  const boxBody = (cx: number, cy: number, w: number, d: number, h: number) => {
    const p2 = e(`IFCAXIS2PLACEMENT2D(${pt2(cx, cy)},$)`);
    const prof = e(`IFCRECTANGLEPROFILEDEF(.AREA.,$,${p2},${R(w)},${R(d)})`);
    const solid = e(`IFCEXTRUDEDAREASOLID(${prof},${worldAxis},${dirZ},${R(h)})`);
    const rep = e(`IFCSHAPEREPRESENTATION(${ctx},'Body','SweptSolid',(${solid}))`);
    return e(`IFCPRODUCTDEFINITIONSHAPE($,$,(${rep}))`);
  };

  const contained: string[] = [];
  const walls = objects.filter((o): o is WallObject => o.type === 'wall');
  const wallEnt = new Map<string, { ent: string; pl: string; L: number; T: number; H: number }>();
  const byThickness = new Map<number, string[]>();

  for (const w of walls) {
    const dx = X(w.end.x) - X(w.start.x);
    const dy = Y(w.end.y) - Y(w.start.y);
    const L = Math.hypot(dx, dy);
    if (L < 1e-4) continue;
    const T = w.thickness / ppm;
    const H = w.height ?? (w.wallKind === 'fence' ? q.fenceHeight : q.wallHeight);
    const pl = placementAt(stPl, X(w.start.x), Y(w.start.y), 0, dx / L, dy / L);
    const axisLine = e(`IFCPOLYLINE((${pt2(0, 0)},${pt2(L, 0)}))`);
    const axisRep = e(`IFCSHAPEREPRESENTATION(${ctx},'Axis','Curve2D',(${axisLine}))`);
    const p2 = e(`IFCAXIS2PLACEMENT2D(${pt2(L / 2, 0)},$)`);
    const prof = e(`IFCRECTANGLEPROFILEDEF(.AREA.,$,${p2},${R(L)},${R(T)})`);
    const solid = e(`IFCEXTRUDEDAREASOLID(${prof},${worldAxis},${dirZ},${R(H)})`);
    const bodyRep = e(`IFCSHAPEREPRESENTATION(${ctx},'Body','SweptSolid',(${solid}))`);
    const shape = e(`IFCPRODUCTDEFINITIONSHAPE($,$,(${axisRep},${bodyRep}))`);
    const name = w.wallKind === 'fence' ? 'سور' : w.label || 'جدار';
    const ent = e(`IFCWALLSTANDARDCASE(${guid()},${owner},${ifcStr(name)},$,$,${pl},${shape},$)`);
    wallEnt.set(w.id, { ent, pl, L, T, H });
    contained.push(ent);
    const key = Math.round(T * 1000) / 1000;
    if (!byThickness.has(key)) byThickness.set(key, []);
    byThickness.get(key)!.push(ent);
  }

  // طبقة مادة لكل سماكة (مطلوبة لـ IfcWallStandardCase)
  const mat = e(`IFCMATERIAL(${ifcStr('بناء')})`);
  for (const [T, ents] of byThickness) {
    const layer = e(`IFCMATERIALLAYER(${mat},${R(T)},$)`);
    const set = e(`IFCMATERIALLAYERSET((${layer}),${ifcStr(`جدار ${Math.round(T * 100)} سم`)})`);
    const usage = e(`IFCMATERIALLAYERSETUSAGE(${set},.AXIS2.,.POSITIVE.,${R(-T / 2)})`);
    e(`IFCRELASSOCIATESMATERIAL(${guid()},${owner},$,$,(${ents.join(',')}),${usage})`);
  }

  // ─── الفتحات والأبواب والنوافذ ───
  for (const o of objects) {
    if (o.type !== 'door' && o.type !== 'window') continue;
    const op = o as DoorObject | WindowObject;
    const host = wallEnt.get(op.wallId);
    if (!host) continue;
    const w = op.width / ppm;
    const isDoor = o.type === 'door';
    const h = isDoor ? ((op as DoorObject).height ?? q.doorHeight) : ((op as WindowObject).height ?? 1.2);
    const z0 = isDoor ? 0 : ((op as WindowObject).sillHeight ?? 0.9);
    const x0 = Math.max(0, Math.min(host.L - w, op.position * host.L - w / 2));
    const opPl = placementAt(host.pl, x0, 0, z0);
    const opening = e(`IFCOPENINGELEMENT(${guid()},${owner},'Opening',$,$,${opPl},${boxBody(w / 2, 0, w, host.T + 0.02, h)},$)`);
    e(`IFCRELVOIDSELEMENT(${guid()},${owner},$,$,${host.ent},${opening})`);
    const fillPl = placementAt(opPl, 0, 0, 0);
    const shape = boxBody(w / 2, 0, w, Math.min(0.06, host.T), h);
    const fill = isDoor
      ? e(`IFCDOOR(${guid()},${owner},${ifcStr('باب')},$,$,${fillPl},${shape},$,${R(h)},${R(w)})`)
      : e(`IFCWINDOW(${guid()},${owner},${ifcStr('شباك')},$,$,${fillPl},${shape},$,${R(h)},${R(w)})`);
    e(`IFCRELFILLSELEMENT(${guid()},${owner},$,$,${opening},${fill})`);
    contained.push(fill);
  }

  // ─── الأعمدة ───
  for (const o of objects) {
    if (o.type !== 'column') continue;
    const c = o as ColumnObject;
    const rad = (-(c.rotation || 0) * Math.PI) / 180;
    const pl = placementAt(stPl, X(c.x), Y(c.y), 0, Math.cos(rad), Math.sin(rad));
    let shape: string;
    if (c.shape === 'round') {
      const p2 = e(`IFCAXIS2PLACEMENT2D(${pt2(0, 0)},$)`);
      const prof = e(`IFCCIRCLEPROFILEDEF(.AREA.,$,${p2},${R(c.width / ppm / 2)})`);
      const solid = e(`IFCEXTRUDEDAREASOLID(${prof},${worldAxis},${dirZ},${R(q.wallHeight)})`);
      shape = e(`IFCPRODUCTDEFINITIONSHAPE($,$,(${e(`IFCSHAPEREPRESENTATION(${ctx},'Body','SweptSolid',(${solid}))`)}))`);
    } else shape = boxBody(0, 0, c.width / ppm, c.depth / ppm, q.wallHeight);
    contained.push(e(`IFCCOLUMN(${guid()},${owner},${ifcStr('عمود')},$,$,${pl},${shape},$)`));
  }

  // ─── الغرف كفراغات IfcSpace ───
  const graph = buildRoomGraph(walls);
  const spaces: string[] = [];
  for (const o of objects) {
    if (o.type !== 'room') continue;
    const r = o as RoomObject;
    const face = findRoomAt(graph, { x: r.x, y: r.y });
    if (!face || face.net.length < 3) continue;
    const pts = face.net.map((p) => pt2(X(p.x), Y(p.y)));
    const poly = e(`IFCPOLYLINE((${[...pts, pts[0]].join(',')}))`);
    const prof = e(`IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,${poly})`);
    const solid = e(`IFCEXTRUDEDAREASOLID(${prof},${worldAxis},${dirZ},${R(q.wallHeight)})`);
    const shape = e(`IFCPRODUCTDEFINITIONSHAPE($,$,(${e(`IFCSHAPEREPRESENTATION(${ctx},'Body','SweptSolid',(${solid}))`)}))`);
    const pl = e(`IFCLOCALPLACEMENT(${stPl},${worldAxis})`);
    spaces.push(e(`IFCSPACE(${guid()},${owner},${ifcStr(r.name || 'غرفة')},${r.floorType ? ifcStr(r.floorType) : '$'},$,${pl},${shape},$,.ELEMENT.,.INTERNAL.,$)`));
  }
  if (spaces.length) e(`IFCRELAGGREGATES(${guid()},${owner},$,$,${storey},(${spaces.join(',')}))`);
  if (contained.length) e(`IFCRELCONTAINEDINSPATIALSTRUCTURE(${guid()},${owner},$,$,(${contained.join(',')}),${storey})`);

  const ts = opts.timestamp ?? new Date().toISOString().slice(0, 19);
  const name = (opts.projectName || 'project').replace(/[^A-Za-z0-9_-]/g, '_');
  return [
    'ISO-10303-21;',
    'HEADER;',
    "FILE_DESCRIPTION(('ViewDefinition [CoordinationView]'),'2;1');",
    `FILE_NAME('${name}.ifc','${ts}',(''),(''),'CAD Studio','CAD Studio','');`,
    "FILE_SCHEMA(('IFC2X3'));",
    'ENDSEC;',
    'DATA;',
    ...lines,
    'ENDSEC;',
    'END-ISO-10303-21;',
    '',
  ].join('\n');
}
