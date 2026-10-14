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
// the colours of the insides an open bonnet or boot shows: a mid-grey lining (was black: it read as a hole), the engine
// in metal with red rocker covers, a chrome air filter, a dark radiator, yellow caps, rusty headers, the boot's carpet,
// the spare and a toolbox
const BAY = { lining: 0x4A4F58, block: 0x8D939C, cover: 0xC8352A, chrome: 0xD3D7DD, radiator: 0x23262D, battery: 0x1E1E22, hose: 0x2B2F3A, carpet: 0x5C5650, tyre: 0x1E1E22, toolbox: 0xD7261E, cap: 0xE8B020, header: 0x8A4E2E };
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
  if (m.material.side !== THREE.DoubleSide) { m.material = m.material.clone(); m.material.side = THREE.DoubleSide; for (const pm of Object.values(panels)) pm.material = m.material; }   // an open lid shows its underside, not the trim on its far face
  // the tub inside: the shell's own far shape, shrunk a little and dark (a convex shell keeps it out of sight)
  const tub = (m.userData.lod || [m.geometry])[0].clone(), c = B.getCenter(new THREE.Vector3()).sub(m.position);
  tub.translate(-c.x, -c.y, -c.z).scale(0.9, 0.86, 0.94).translate(c.x, c.y, c.z); tub.deleteAttribute('color');
  // open-topped where the bonnet and the boot are (else its lid hides the bay): only what's below the cut line stays there
  const open = cutGeometry(tub, m.position.toArray(), [[2, zf], [2, zr], [1, yb]], (x, y, z) => y > yb && ((panels.bonnet && z > zf) || (panels.boot && z < zr)) ? 'lid' : 'tub').tub;
  const lin = K.part(open || tub, BAY.lining, m.position.x, m.position.y, m.position.z, [Wd, H, L]); lin.material = lin.material.clone(); lin.material.side = THREE.DoubleSide;   // seen from inside
  // the trim on the lids (stripes, a scoop, a boot spoiler that isn't the wing) rides with them: anything small whose
  // middle is over the lid and that sits on top of it moves onto the lid's hinge, so it opens with it
  const fixed = new Set([m, out.cabin, out.bumper, out.wing, ...(out.struts || []), ...(out.heads || []), ...(out.tails || []), ...K.dentable, ...Object.values(panels)]);
  for (const [id, pm] of Object.entries(panels)) {
    if (id !== 'bonnet' && id !== 'boot') continue;
    const lb = bboxOf(pm, pm.geometry); lb.expandByScalar(0.06);
    for (const o of [...body.children]) {
      if (!o.isMesh || fixed.has(o) || o.material.isMeshBasicMaterial || !o.userData.home) continue;
      const ob = bboxOf(o, o.geometry);
      const cx2 = (ob.min.x + ob.max.x) / 2, over = ob.max.z > lb.min.z && ob.min.z < lb.max.z;
      if (!over || cx2 < lb.min.x || cx2 > lb.max.x || ob.min.y < lb.min.y - 0.05 || ob.max.x - ob.min.x > lb.max.x - lb.min.x + 0.1) continue;
      // a stripe that runs on past the lid's hinge edge is cut there: the lid's piece opens with it, the rest stays put
      const hz = id === 'bonnet' ? lb.min.z : lb.max.z, onLid = z => id === 'bonnet' ? z > hz : z < hz;
      if (!onLid(ob.min.z) || !onLid(ob.max.z)) {
        const geos = o.userData.lod || [o.geometry], cuts = geos.map(g => cutGeometry(g, o.position.toArray(), [[2, hz]], (x, y, z) => onLid(z) ? 'lid' : 'stay'));
        if (cuts.some(c => !c.lid || !c.stay)) continue;
        const lid = new THREE.Mesh(cuts[0].lid, o.material); lid.position.copy(o.position); lid.rotation.copy(o.rotation); lid.castShadow = o.castShadow; body.add(lid);
        if (o.userData.lod) { o.userData.lod = cuts.map(c => c.stay); lid.userData.lod = cuts.map(c => c.lid); K.lod.swap.push(lid); o.geometry = o.userData.lod[K.lod.on ? 1 : 0]; lid.geometry = lid.userData.lod[K.lod.on ? 1 : 0]; } else o.geometry = cuts[0].stay;
        lid.userData.home = { ...o.userData.home }; pm.attach(lid);
      } else pm.attach(o);
    }
  }
  // what an open bonnet or boot shows: an engine and a boot, sized from the shell (below the panel's lowest cut, so
  // they stay hidden while it's shut)
  const top = yb + 0.5 * (B.max.y - yb), cx = (B.min.x + B.max.x) / 2;
  // a V engine: the block low in the middle, a cylinder head and a red rocker cover on each bank (leaning out), the
  // intake plenum between them under a big chrome air filter, the belt drive on the front, rusty exhaust headers down
  // each side, the radiator and its fan, strut towers, the bulkhead with the brake servo and reservoirs, the battery
  const tilt = (m, a) => { m.rotation.z = a; m.userData.home.r.copy(m.rotation); return m; };
  const cylZ = (r, l, c, x, y, z) => K.part(d => new THREE.CylinderGeometry(r, r, l, d ? 18 : 8).rotateX(Math.PI / 2), c, x, y, z, [r * 2, r * 2, l]);
  const cylY = (r, l, c, x, y, z) => K.part(d => new THREE.CylinderGeometry(r, r, l, d ? 18 : 8), c, x, y, z, [r * 2, l, r * 2]);
  if (panels.bonnet) {
    const z0 = zf + 0.08, z1 = B.max.z - 0.32, zl = z1 - z0, zm = (z0 + z1) / 2, w = Wd * 0.5, bh = Math.max(0.14, top - yb), ez = zm - zl * 0.08, el = zl * 0.72;
    if (zl > 0.25) {
      K.box(w * 0.62, bh * 0.55, el, BAY.block, cx, yb + bh * 0.28, ez);                                     // the block
      for (const sd of [-1, 1]) {
        tilt(K.box(w * 0.34, bh * 0.36, el * 0.92, BAY.block, cx + sd * w * 0.3, yb + bh * 0.7, ez), -sd * 0.45);     // a cylinder head
        tilt(K.box(w * 0.3, 0.07, el * 0.86, BAY.cover, cx + sd * w * 0.36, yb + bh * 0.92, ez), -sd * 0.45);          // its rocker cover
        K.box(0.07, bh * 0.5, el * 0.7, BAY.header, cx + sd * w * 0.56, yb + bh * 0.35, ez);                  // exhaust headers
        cylY(Math.min(0.13, Wd * 0.06), bh * 0.8, BAY.block, cx + sd * Wd * 0.4, yb + bh * 0.45, z0 + zl * 0.08);   // strut tower
        cylY(Math.min(0.09, Wd * 0.045), 0.04, BAY.chrome, cx + sd * Wd * 0.4, yb + bh * 0.87, z0 + zl * 0.08);
        for (let r = 0; r < 3; r++) K.box(0.05, 0.05, 0.12, BAY.hose, cx + sd * w * 0.15, yb + bh * 0.95, ez - el * 0.3 + r * el * 0.3);   // intake runners
      }
      K.box(w * 0.26, bh * 0.22, el * 0.7, BAY.block, cx, yb + bh * 0.98, ez);                               // the plenum
      cylY(Math.min(0.24, w * 0.4), 0.09, BAY.chrome, cx, yb + bh * 1.12, ez - el * 0.05);                   // the air filter
      cylY(Math.min(0.08, w * 0.12), 0.04, BAY.radiator, cx, yb + bh * 1.18, ez - el * 0.05);                 // its wing nut
      K.box(0.05, 0.05, 0.05, BAY.cap, cx + w * 0.36, yb + bh * 1.0, ez + el * 0.25);                        // the oil filler cap
      K.box(0.04, 0.08, 0.04, BAY.cap, cx - w * 0.5, yb + bh * 0.95, ez - el * 0.15);                        // the dipstick
      const fz = ez + el / 2 + 0.05;                                                                          // the belt drive, on the front
      cylZ(Math.min(0.11, w * 0.18), 0.05, BAY.radiator, cx, yb + bh * 0.32, fz);                            // crank pulley
      cylZ(Math.min(0.07, w * 0.12), 0.05, BAY.chrome, cx + w * 0.32, yb + bh * 0.62, fz);                   // alternator
      cylZ(Math.min(0.07, w * 0.12), 0.05, BAY.radiator, cx - w * 0.3, yb + bh * 0.6, fz);                   // water pump
      tilt(K.box(0.03, bh * 0.38, 0.03, BAY.hose, cx + w * 0.16, yb + bh * 0.47, fz + 0.01), -0.7); tilt(K.box(0.03, bh * 0.36, 0.03, BAY.hose, cx - w * 0.15, yb + bh * 0.46, fz + 0.01), 0.75);   // the belt
      K.box(Wd * 0.62, bh * 0.9, 0.06, BAY.radiator, cx, yb + bh * 0.45, z1 + 0.18);                         // the radiator
      cylZ(Math.min(bh * 0.4, Wd * 0.22), 0.04, BAY.hose, cx, yb + bh * 0.45, z1 + 0.1);                     // its fan
      for (const sd of [-1, 1]) K.box(0.06, 0.06, Math.max(0.1, z1 + 0.1 - fz), BAY.hose, cx + sd * w * 0.2, yb + bh * (sd > 0 ? 0.8 : 0.2), (fz + z1 + 0.1) / 2);   // top and bottom hoses
      K.box(Wd * 0.8, bh * 0.85, 0.05, BAY.lining, cx, yb + bh * 0.42, z0 + 0.03);                           // the bulkhead
      cylZ(Math.min(0.12, Wd * 0.07), 0.12, BAY.block, cx - Wd * 0.22, yb + bh * 0.6, z0 + 0.1);             // brake servo
      K.box(0.08, 0.08, 0.06, BAY.cap, cx - Wd * 0.22, yb + bh * 0.85, z0 + 0.12);                           // and its reservoir
      K.box(0.22, 0.16, 0.18, BAY.battery, cx - Wd * 0.33, yb + 0.08, zm + zl * 0.2);                        // the battery
      K.box(0.04, 0.04, 0.04, BAY.cover, cx - Wd * 0.33 + 0.07, yb + 0.18, zm + zl * 0.2);                   // + terminal
      K.box(0.04, 0.04, 0.04, BAY.radiator, cx - Wd * 0.33 - 0.07, yb + 0.18, zm + zl * 0.2);                // - terminal
      K.box(0.12, 0.14, 0.1, BAY.chrome, cx + Wd * 0.33, yb + 0.1, zm + zl * 0.25);                          // the coolant bottle
      K.box(0.04, 0.03, 0.04, BAY.cap, cx + Wd * 0.33, yb + 0.18, zm + zl * 0.25);
    }
  }
  if (panels.boot) {
    const z1 = zr - 0.08, z0 = B.min.z + 0.28, zl = z1 - z0, zm = (z0 + z1) / 2;
    if (zl > 0.25) {
      K.box(Wd * 0.78, 0.04, zl, BAY.carpet, cx, yb + 0.02, zm);                                              // the boot floor
      K.part(d => new THREE.CylinderGeometry(Math.min(0.3, zl * 0.4), Math.min(0.3, zl * 0.4), 0.16, d ? 24 : 10), BAY.tyre, cx - Wd * 0.16, yb + 0.12, zm, [0.6, 0.16, 0.6]);   // the spare, lying flat
      cylY(Math.min(0.1, zl * 0.15), 0.17, BAY.chrome, cx - Wd * 0.16, yb + 0.13, zm);                        // its hub
      K.box(0.32, 0.16, 0.2, BAY.toolbox, cx + Wd * 0.22, yb + 0.12, zm);                                     // a toolbox
      K.box(0.3, 0.04, 0.05, BAY.chrome, cx + Wd * 0.22, yb + 0.22, zm);                                      // its handle
      K.box(0.1, 0.06, Math.min(0.4, zl * 0.6), BAY.block, cx + Wd * 0.3, yb + 0.06, zm - zl * 0.05);        // the jack
      tilt(K.box(0.36, 0.02, 0.06, BAY.cover, cx, yb + 0.06, z0 + 0.06), 0);                                  // a warning triangle, folded
    }
  }
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
