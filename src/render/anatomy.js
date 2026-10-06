import * as THREE from 'three';
import { PANELS } from '../data/anatomy.js';

// Car anatomy, drawn (data/anatomy.js has the panels; core/sim/damage.js says how battered each is). Any car, either
// provider: carvePanels takes the car's body shell (its biggest painted, dentable mesh) and cuts it with a few planes
// into a bonnet, a boot and two doors, each its own mesh on a hinge at its edge, and what's left stays as the shell
// (with a dark tub inside, so a missing panel shows a hole, not the sky). Both detail levels are cut the same way, so
// dents, dirt and the near/far swap all carry on working. Nothing is authored per car: a new car gets panels for free.
const EPS = 1e-5;
/** Cut geometry `geo` (positions relative to `off`) along `planes` ([axis 0|1|2, value]) and sort the pieces with
 *  cell(x, y, z) -> name: { name: BufferGeometry }. Every attribute is carried over, split edges interpolated. */
export function cutGeometry(geo, off, planes, cell) {
  const g = geo.index ? geo.toNonIndexed() : geo, names = Object.keys(g.attributes), sz = names.map(n => g.attributes[n].itemSize), S = sz.reduce((a, b) => a + b, 0), n = g.attributes.position.count;
  const vert = i => { const v = new Float32Array(S); let o = 0; names.forEach((nm, a) => { const A = g.attributes[nm].array; for (let k = 0; k < sz[a]; k++) v[o++] = A[i * sz[a] + k]; }); return v; };
  const lerp = (a, b, t) => { const v = new Float32Array(S); for (let k = 0; k < S; k++) v[k] = a[k] + (b[k] - a[k]) * t; return v; };
  let tris = []; for (let i = 0; i < n; i += 3) tris.push([vert(i), vert(i + 1), vert(i + 2)]);
  for (const [ax, val] of planes) {
    const out = [], v = val - off[ax];
    for (const t of tris) {
      const d = t.map(p => p[ax] - v), s = d.map(x => x > EPS ? 1 : x < -EPS ? -1 : 0);
      if (!(s.includes(1) && s.includes(-1))) { out.push(t); continue; }
      const z = s.indexOf(0);
      if (z >= 0) {                                                                  // one corner on the plane: two triangles
        const [a, b, c] = [t[z], t[(z + 1) % 3], t[(z + 2) % 3]], db = d[(z + 1) % 3], dc = d[(z + 2) % 3], bc = lerp(b, c, db / (db - dc));
        out.push([a, b, bc], [a, bc, c]); continue;
      }
      const lone = s.findIndex((x, i) => x !== s[(i + 1) % 3] && x !== s[(i + 2) % 3]);   // the corner alone on its side
      const [a, b, c] = [t[lone], t[(lone + 1) % 3], t[(lone + 2) % 3]], da = d[lone], db = d[(lone + 1) % 3], dc = d[(lone + 2) % 3];
      const ab = lerp(a, b, da / (da - db)), ac = lerp(a, c, da / (da - dc));
      out.push([a, ab, ac], [ab, b, c], [ab, c, ac]);                                // same winding as the original
    }
    tris = out;
  }
  const groups = {};
  for (const t of tris) { const k = cell((t[0][0] + t[1][0] + t[2][0]) / 3 + off[0], (t[0][1] + t[1][1] + t[2][1]) / 3 + off[1], (t[0][2] + t[1][2] + t[2][2]) / 3 + off[2]); (groups[k] = groups[k] || []).push(t); }
  const res = {};
  for (const [k, list] of Object.entries(groups)) {
    const ng = new THREE.BufferGeometry();
    names.forEach((nm, a) => {
      const arr = new Float32Array(list.length * 3 * sz[a]); let o = 0, base = sz.slice(0, a).reduce((x, y) => x + y, 0);
      for (const t of list) for (const p of t) for (let q = 0; q < sz[a]; q++) arr[o++] = p[base + q];
      ng.setAttribute(nm, new THREE.BufferAttribute(arr, sz[a]));
    });
    const N = ng.attributes.normal; if (N) for (let i = 0; i < N.count; i++) { const x = N.getX(i), y = N.getY(i), z = N.getZ(i), l = Math.hypot(x, y, z) || 1; N.setXYZ(i, x / l, y / l, z / l); }
    ng.userData = { ...geo.userData }; if (geo.userData.n0) ng.userData.n0 = Float32Array.from(ng.attributes.normal.array);
    res[k] = ng;
  }
  return res;
}
const bboxOf = (m, g) => { g.computeBoundingBox(); return g.boundingBox.clone().translate(m.position); };
/** Cut car body `out` (from buildCarModel; K the kit) into its panels. Returns { id: mesh } (empty when the car has no
 *  shell big enough to cut, e.g. a kart: its damage shows the old way). Each panel mesh sits at its hinge with
 *  userData.hinge = { axis: 'x'|'y', open: the angle it swings open to }, and joins the dentable list. */
export function carvePanels(K, out, def, body, tubColor) {
  const vol = b => (b.max.x - b.min.x) * (b.max.y - b.min.y) * (b.max.z - b.min.z);
  const cand = K.dentable.filter(m => m !== out.cabin && m.parent === body && m.userData.home && m.userData.home.color === def.color && !m.rotation.x && !m.rotation.y && !m.rotation.z);
  if (!cand.length) return {};
  const shell = cand.map(m => [m, bboxOf(m, (m.userData.lod || [m.geometry])[0])]).sort((a, b) => vol(b[1]) - vol(a[1]))[0], m = shell[0], B = shell[1];
  const L = B.max.z - B.min.z, H = B.max.y - B.min.y, Wd = B.max.x - B.min.x;
  if (L < 2.2 || Wd < 1.2 || H < 0.25) return {};
  const zf = B.max.z - 0.3 * L, zr = B.min.z + 0.24 * L, yb = B.min.y + 0.45 * H, yt = B.max.y - 0.12 * H, xd = 0.3 * Wd, df = zf - 0.05 * L, dr = zr + 0.05 * L;
  const planes = [[2, zf], [2, zr], [1, yb], [1, yt], [0, xd], [0, -xd], [2, df], [2, dr]];
  const cell = (x, y, z) => z > zf && y > yb ? 'bonnet' : z < zr && y > yb ? 'boot' : z < df && z > dr && y < yt && Math.abs(x) > xd ? (x > 0 ? 'doorL' : 'doorR') : 'shell';
  const levels = (m.userData.lod || [m.geometry]).map(g => cutGeometry(g, m.position.toArray(), planes, cell));
  const pick = (lv, k) => lv[k] || new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
  const copy = g => Float32Array.from(g.attributes.position.array), panels = {};
  for (const p of PANELS) {
    const geos = levels.map(lv => lv[p.id]); if (geos.some(g => !g || g.attributes.position.count < 6)) continue;
    const b = bboxOf(m, geos[0]);
    // the hinge: the bonnet's back edge, the boot's front edge (both on top), each door's front edge (outside)
    const hinge = p.id === 'bonnet' ? [0, b.max.y, b.min.z] : p.id === 'boot' ? [0, b.max.y, b.max.z] : [p.id === 'doorL' ? b.max.x : b.min.x, (b.min.y + b.max.y) / 2, b.max.z];
    const shift = new THREE.Vector3(m.position.x - hinge[0], m.position.y - hinge[1], m.position.z - hinge[2]);
    const lods = geos.map(g => g.translate(shift.x, shift.y, shift.z));
    const pm = new THREE.Mesh(lods[m.userData.lod && K.lod.on ? 1 : 0], m.material); pm.castShadow = true; pm.position.set(...hinge); body.add(pm);
    if (m.userData.lod) { pm.userData.lod = lods; K.lod.swap.push(pm); pm.userData.origs = lods.map(copy); }
    pm.userData.orig = copy(pm.geometry);
    pm.userData.home = { p: pm.position.clone(), r: pm.rotation.clone(), dims: [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z], color: def.color };
    pm.userData.hinge = { axis: p.id === 'bonnet' || p.id === 'boot' ? 'x' : 'y', open: { bonnet: -1.0, boot: 0.9, doorL: -1.0, doorR: 1.0 }[p.id] };
    pm.name = p.id; K.dentable.push(pm); panels[p.id] = pm;
  }
  if (!Object.keys(panels).length) return {};
  // the tub inside: the shell's own far shape, shrunk a little and dark (a convex shell keeps it out of sight)
  const tub = (m.userData.lod || [m.geometry])[0].clone(), c = B.getCenter(new THREE.Vector3()).sub(m.position);
  tub.translate(-c.x, -c.y, -c.z).scale(0.9, 0.86, 0.94).translate(c.x, c.y, c.z); tub.deleteAttribute('color');
  K.part(tub, tubColor, m.position.x, m.position.y, m.position.z, [Wd, H, L]);
  // what's left of the shell, both levels (its undented copy too)
  const rest = levels.map(lv => pick(lv, 'shell'));
  if (m.userData.lod) { m.userData.lod = rest; m.userData.origs = rest.map(copy); m.geometry = rest[K.lod.on ? 1 : 0]; } else m.geometry = rest[0];
  m.userData.orig = copy(m.geometry);
  return panels;
}
// ---------- the steps, played ----------
// how far each step swings a panel on its hinge (a share of its open angle), and how it rides once open
const STEP_SWING = [0.12, 1, 1];
/** Panel `id` of car vis v reached step s (0 bend, 1 open, 2 off): set where it swings to; 'off' is the caller's (it
 *  throws the panel with flingPiece). */
export function panelStep(v, id, s) {
  const pm = v.panels && v.panels[id]; if (!pm || !pm.visible) return false;
  v.pstep = v.pstep || {}; if ((v.pstep[id] ?? -1) >= s) return false;
  v.pstep[id] = s; if (s < 2) pm.userData.want = pm.userData.hinge.open * STEP_SWING[s];
  return true;
}
/** Ease each panel to its angle; an open one flaps with the car's motion. extra(id) adds a swing (door bashing). */
export function updatePanels(v, c, dt, now, extra) {
  if (!v.panels) return;
  for (const [id, pm] of Object.entries(v.panels)) {
    if (!pm.visible) continue;
    const H = pm.userData.hinge, open = (v.pstep && v.pstep[id]) === 1, sp = Math.min(1, Math.hypot(c.vx || 0, c.vz || 0) / 30);
    let tgt = (pm.userData.want || 0) + (open ? Math.sin(now * 9 + id.length) * 0.12 * (0.3 + sp) : 0);
    const x = extra ? extra(id) : 0; if (x && Math.abs(x) > Math.abs(tgt)) tgt = x;
    pm.userData.a = (pm.userData.a || 0) + (tgt - (pm.userData.a || 0)) * Math.min(1, dt * (x ? 22 : 9));
    pm.rotation.copy(pm.userData.home.r); pm.rotation[H.axis] += pm.userData.a;
  }
}
/** Put every panel back on its hinge, shut (a repair or a respawn). */
export function repairPanels(v) {
  if (!v.panels) return;
  for (const pm of Object.values(v.panels)) { const h = pm.userData.home; pm.position.copy(h.p); pm.rotation.copy(h.r); pm.visible = true; pm.userData.want = 0; pm.userData.a = 0; }
  v.pstep = {};
}
