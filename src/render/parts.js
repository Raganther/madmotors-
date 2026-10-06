import * as THREE from 'three';
import { flat, mergeAll } from './geometry.js';
import { PART_MAX } from '../data/parts.js';

// Upgrade parts, drawn (data/parts.js has the slots; def.build says what's fitted). Nothing is authored per car: the
// anchors come from the body itself, so every car of either provider takes every part. A height profile of the body
// (its top and half-width every 20 cm along it) gives where the bonnet, the boot, the roof, the nose and the sides
// are; a part on the bonnet, the boot or a door rides on that panel (render/anatomy.js), so it swings open and flies
// off with it. Pieces are merged per material and per panel: a fully built car costs a handful of extra draws.
const STEEL = 0x5C636E, BAND = 0.2, _up = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();
/** The body's shape along its length: top(z) and half(z) (the highest point and the widest at that z), and its box. */
export function bodyProfile(body, skip) {
  const box = new THREE.Box3(), bins = new Map(), v = new THREE.Vector3();
  body.updateMatrixWorld(true);
  for (const m of body.children) {
    if (!m.isMesh || !m.visible || skip.has(m) || !m.userData.home) continue;
    const p = m.geometry.attributes.position, M = new THREE.Matrix4().copy(body.matrixWorld).invert().multiply(m.matrixWorld);
    for (let k = 0; k < p.count; k++) {
      v.fromBufferAttribute(p, k).applyMatrix4(M); box.expandByPoint(v);
      const b = Math.round(v.z / BAND), e = bins.get(b) || { top: -1e9, half: 0 }; e.top = Math.max(e.top, v.y); e.half = Math.max(e.half, Math.abs(v.x)); bins.set(b, e);
    }
  }
  const near = z => { const b = Math.round(z / BAND); for (let d = 0; d < 6; d++) for (const s of [b - d, b + d]) if (bins.has(s)) return bins.get(s); return { top: box.max.y, half: box.max.x }; };
  return { box, top: z => near(z).top, half: z => near(z).half };
}
/** Fit build b's parts to car body `body` (K the kit from render/carmodels.js, out its parts, panels from anatomy.js).
 *  Returns { lift, soft }: how far the suspension raises the body and how much more it travels (render/vehicles.js). */
export function fitParts(K, out, b, body, panels, C) {
  const res = { lift: 0, soft: 1 }; if (!b) return res;
  const lv = id => Math.min(PART_MAX, b[id] || 0);
  const skip = new Set([...(out.heads || []), ...(out.tails || [])]), P = bodyProfile(body, skip), B = P.box;
  if (B.isEmpty()) return res;
  const zF = B.max.z, zR = B.min.z, Lb = zF - zR, cab = out.cabin && new THREE.Box3().setFromObject(out.cabin), cabTop = cab ? cab.max.y : B.max.y;
  const cabC = cab ? cab.getCenter(new THREE.Vector3()) : new THREE.Vector3(0, B.max.y, (zF + zR) / 2), cabS = cab ? cab.getSize(new THREE.Vector3()) : new THREE.Vector3(1, 0.3, 1);
  const groups = new Map();   // (panel, colour) -> geometries in body space
  const put = (geo, c, on = null) => { const k = (on ? on.name : '') + '/' + c; if (!groups.has(k)) groups.set(k, { on, c, geos: [] }); groups.get(k).geos.push(flat(geo)); };
  const box = (w, h, d, c, x, y, z, { on, rx = 0, ry = 0 } = {}) => put(new THREE.BoxGeometry(w, h, d).rotateX(rx).rotateY(ry).translate(x, y, z), c, on);
  const tube = (a, e, r, c, on) => { _d.set(e[0] - a[0], e[1] - a[1], e[2] - a[2]); const l = _d.length(); put(new THREE.CylinderGeometry(r, r, l, 8).applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(_up, _d.normalize()))).translate((a[0] + e[0]) / 2, (a[1] + e[1]) / 2, (a[2] + e[2]) / 2), c, on); };
  const pan = id => panels && panels[id];
  // engine: a scoop on the bonnet, then side pipes, then a supercharger through it
  const E = lv('eng');
  if (E) {
    const z = zF - Lb * 0.2, y = P.top(z), w = Math.min(0.5 + 0.08 * E, P.half(z) * 0.9), on = pan('bonnet');
    if (E < 3) box(w, 0.1 + 0.04 * E, 0.55 + 0.1 * E, C.DARK, 0, y + 0.04 + 0.02 * E, z, { on, rx: -0.08 });
    else { box(0.46, 0.24, 0.5, C.CHROME, 0, y + 0.12, z, { on }); box(0.56, 0.08, 0.22, C.DARK, 0, y + 0.28, z + 0.08, { on }); box(0.2, 0.12, 0.16, C.DARK, 0, y + 0.37, z + 0.08, { on }); }
    if (E >= 2) for (const s of [-1, 1]) { const zp = zF - Lb * 0.55, x = s * (P.half(zp) + 0.05); tube([x, B.min.y + 0.18, zp + 0.5], [x, B.min.y + 0.18, zp - 0.5], 0.06, C.CHROME); }
  }
  // tyres: wider every level (the wheels are scaled across), gravel tyres a touch taller too
  const T = lv('tyr');
  if (T) for (const w of out.wheels || []) { w.scale.x *= 1 + 0.14 * T; if (b.tyrKind === 'gravel') { w.scale.y *= 1.05; w.scale.z *= 1.05; } }
  // suspension: the body lifted on long springs at each wheel, and more travel (vehicles.js squash)
  const S = lv('sus');
  if (S) {
    res.lift = 0.035 * S; res.soft = 1 + 0.25 * S;
    for (const w of out.wheels || []) {
      const p = w.parent.position, x = p.x - Math.sign(p.x || 1) * 0.12, y0 = p.y - res.lift, y1 = Math.max(p.y + 0.32, y0 + 0.3);
      tube([x, y0, p.z], [x, y1, p.z], 0.055, C.ACCENT);
      if (S >= 3) tube([x, y0, p.z - 0.12], [x, y1, p.z - 0.12], 0.03, C.CHROME);
    }
  }
  // armour: steel plates along the sills, then on the doors, then the nose and mesh over the side windows
  const A = lv('arm');
  if (A) {
    const zm = (zF + zR) / 2, len = Lb * 0.62;
    for (const s of [-1, 1]) {
      box(0.05, 0.2, len, STEEL, s * (P.half(zm) + 0.03), B.min.y + 0.14, zm);
      const d = pan(s > 0 ? 'doorL' : 'doorR');   // an open body (a kart, a formula car) has no doors to plate or windows to mesh
      if (A >= 2 && d) { const db = new THREE.Box3().setFromObject(d); box(0.05, 0.3, (db.max.z - db.min.z) * 0.85, STEEL, s * (P.half(zm) + 0.05), B.min.y + (B.max.y - B.min.y) * 0.42, (db.max.z + db.min.z) / 2, { on: d }); }
      if (A >= 3 && d && cab) box(0.03, cabS.y * 0.7, cabS.z * 0.7, C.DARK, s * (cabS.x / 2 + 0.02), cabC.y, cabC.z);
    }
    if (A >= 3) box(P.half(zF) * 1.6, 0.26, 0.06, STEEL, 0, B.min.y + 0.3, zF + 0.03);
  }
  // aero: a lip on the boot, then a wing on struts, then a big wing with end plates and a splitter under the nose
  const AE = lv('aero');
  if (AE) {
    const z = zR + Math.min(0.25, Lb * 0.08), y = P.top(z + 0.1), hw = P.half(z), on = pan('boot');
    if (AE === 1) box(hw * 1.7, 0.05, 0.24, C.ACCENT, 0, y + 0.04, z, { on, rx: 0.2 });
    else {
      const h = AE === 2 ? 0.28 : 0.4, w = hw * (AE === 2 ? 1.75 : 2.05);
      for (const s of [-1, 1]) box(0.05, h, 0.14, C.DARK, s * hw * 0.55, y + h / 2, z, { on });
      box(w, 0.05, 0.36, C.ACCENT, 0, y + h + 0.02, z - 0.04, { on, rx: 0.12 });
      if (AE >= 3) { for (const s of [-1, 1]) box(0.04, 0.24, 0.42, C.DARK, s * w / 2, y + h, z - 0.04, { on }); box(P.half(zF) * 1.9, 0.04, 0.3, C.DARK, 0, B.min.y + 0.06, zF + 0.04); }
    }
  }
  // ram bar: a nudge bar on the nose, then a bull bar, then a plough
  const RM = lv('ram');
  if (RM) {
    const hw = P.half(zF) * 0.9, z = zF + 0.12, y0 = B.min.y + 0.2, c = RM === 1 ? C.CHROME : C.DARK;
    if (RM < 3) {
      tube([-hw, y0 + 0.25, z], [hw, y0 + 0.25, z], 0.05, c);
      for (const s of [-0.5, 0.5]) tube([s * hw, y0, z - 0.1], [s * hw, y0 + 0.3 + 0.15 * (RM - 1), z], 0.045, c);
      if (RM === 2) { tube([-hw * 0.8, y0 + 0.5, z], [hw * 0.8, y0 + 0.5, z], 0.045, c); tube([-hw, y0 + 0.05, z], [hw, y0 + 0.05, z], 0.05, c); }
    } else { box(hw * 2.15, 0.4, 0.08, STEEL, 0, y0 + 0.12, z + 0.12, { rx: -0.5 }); for (const s of [-1, 1]) box(0.06, 0.28, 0.4, C.DARK, s * hw * 0.6, y0 + 0.12, z - 0.08); }
  }
  // roll cage: a hoop over the back of the roof, then bars along it, then a front bar with a lamp pod
  const CG = lv('cage');
  if (CG) {
    const hx = cabS.x / 2 + 0.03, yt = cabTop + 0.06, zb = cabC.z - cabS.z * 0.4, zf = cabC.z + cabS.z * 0.4, yb = Math.max(B.min.y + 0.3, cabC.y - cabS.y * 0.3);
    for (const s of [-1, 1]) tube([s * hx, yb, zb], [s * hx * 0.9, yt, zb], 0.04, C.DARK);
    tube([-hx * 0.9, yt, zb], [hx * 0.9, yt, zb], 0.04, C.DARK);
    if (CG >= 2) for (const s of [-1, 1]) tube([s * hx * 0.9, yt, zb], [s * hx * 0.9, yt, zf], 0.035, C.DARK);
    if (CG >= 3) { tube([-hx * 0.9, yt, zf], [hx * 0.9, yt, zf], 0.04, C.DARK); for (let k = 0; k < 4; k++) box(0.16, 0.13, 0.08, C.LAMP, (k - 1.5) * hx * 0.42, yt + 0.09, zf + 0.02); }
  }
  // one mesh per (panel, colour), on that panel's hinge or on the body (mergeStatic folds those into the car's own)
  body.updateMatrixWorld(true);
  for (const g of groups.values()) {
    const geo = mergeAll(g.geos); geo.computeBoundingBox(); const s = geo.boundingBox.getSize(new THREE.Vector3());
    const m = K.part(geo, g.c, 0, 0, 0, [s.x, s.y, s.z]); m.name = 'part';
    if (g.on) { g.on.attach(m); m.userData.home.p = m.position.clone(); m.userData.home.r = m.rotation.clone(); }
  }
  return res;
}
