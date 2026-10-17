import * as THREE from 'three';
import { flat, mergeAll, roundBox } from './geometry.js';
import { numberTex } from './materials.js';
import { bakeAO, carMat, grilleTex, lensTex, treadTex } from './carpaint.js';
import { blenderPack } from './assets/index.js';
import { buildBlenderCar } from './assets/cars.js';
import { carvePanels } from './anatomy.js';
import { fitParts } from './parts.js';
import { familyModel } from './families.js';
import { FAMILY_IDS, chassisOf } from '../data/families.js';

// The racers' bodies, one builder per model (CAR_DEFS[].model). They differ where it shows from the camera, overhead:
// outline, roof and deck. All share the same footprint (the hitbox is the same for everyone), wheels, lights and the
// damage hooks: each builder hands back the parts damage acts on (bumper, wing + struts fall off, heads/tails go
// out, cabin glass cracks, dentable panels dent), and optionally anim(v, c, now) for moving parts (lights, flames).
// buildCarModel then cuts the body shell into a bonnet, a boot and doors on hinges (render/anatomy.js) and fits the
// upgrade parts in def.build (render/parts.js).
// +z is the front, y up, ground at 0. The garage (data/vehicles.js) lists them all.
// number plates: white with a black border and a made-up registration (close-up dressing, K.dress)
let plateM = null;
const plateTex = () => { const c = document.createElement('canvas'); c.width = 128; c.height = 32; const g = c.getContext('2d'); g.fillStyle = '#F4F2E8'; g.fillRect(0, 0, 128, 32); g.strokeStyle = '#111'; g.lineWidth = 3; g.strokeRect(2, 2, 124, 28); g.fillStyle = '#111'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('MAD 38', 64, 17); const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t; };
const DARK = 0x2B2F3A, GLASS = 0x253450, CHROME = 0xD3D7DD, TYRE = 0x1E1E22, LAMP = 0xFFF6C8;
// the Blender palette's names (blender/kit.py PALETTE) as the kit's colours; paint and accent come from the car
export const HD_COL = { glass: GLASS, chrome: CHROME, trim: DARK, tyre: TYRE, hub: 0xC9CCD4, metal: 0x8D939C, white: 0xF4F4F0, red: 0xE0402F, yellow: 0xFFC72C, dark: 0x1C2340, wood: 0x8A5E3B, skin: 0xE0B08A,
  wafer: 0xD9A45A, cream: 0xFFF4DE, pink: 0xF08AB4, choc: 0x8A5230, hose: 0xE8C050, solar: 0x2A3A6A, firered: 0xB81E18, engine: 0x5A5E66 };
// lights a rig switches: each part gets its own unlit material
// the Blender palette's coloured names are painted surfaces, not the dark satin trim a plain colour gets
const HD_KIND = Object.fromEntries(['white', 'red', 'yellow', 'wood', 'skin', 'wafer', 'cream', 'pink', 'choc', 'hose', 'solar', 'firered'].map(k => [k, 'paint']));
const HD_GLOW = { glowred: 0xFF2020, glowblue: 0x2050FF, glowamber: 0xFFA020 };

// Two levels of detail (setCarDetail): the near one, used in every camera, has rounded, smooth-shaded parts (roundBox,
// rounder spheres and cylinders), tyres with shoulders, tread, rims and spokes, grilles and shut lines; the far one is
// the faceted low-poly body, kept for Graphics: Low. Same parts, same materials: damage and dirt act on both.
const sph = (r, w, h, ...a) => d => new THREE.SphereGeometry(r, d ? Math.max(24, w * 2) : w, d ? Math.max(16, h * 2) : h, ...a);
const cyl = (rt, rb, ht, n, turn = g => g) => d => { const g = turn(new THREE.CylinderGeometry(rt, rb, ht, d ? Math.max(28, n * 2) : n)); return d ? g : flat(g); };
function kit(def, root, body) {
  const mats = new Map(), dentable = [], lod = { swap: [], lo: [], hi: [], on: false };
  const kind = c => c === def.color || c === def.accent ? 'paint' : c === GLASS ? 'glass' : c === CHROME ? 'chrome' : c === TYRE ? 'rubber' : 'trim';
  const mat = (c, k = kind(c)) => { const key = c + k; if (!mats.has(key)) mats.set(key, carMat(k, c)); return mats.get(key); };
  const hl = new THREE.MeshBasicMaterial({ color: LAMP, map: lensTex() }), tl = new THREE.MeshBasicMaterial({ color: 0xFF4A3A, map: lensTex() });
  let tyreM = null, grilleM = null;
  // a mesh whose geometry comes in both levels: `geo` is a geometry (one level only) or detail => geometry
  const both = (m, geo, oy) => { if (typeof geo !== 'function') return; m.userData.lod = [m.geometry, bakeAO(geo(true), oy)]; lod.swap.push(m); };
  const K = {
    dentable, lod,
    /** A mesh on the body; `dims` is what flies off when it's knocked loose. */
    part(geo, c, x, y, z, dims) {
      const m = new THREE.Mesh(bakeAO(typeof geo === 'function' ? geo(false) : geo, y), mat(c)); both(m, geo, y);
      m.position.set(x, y, z); m.castShadow = true; body.add(m); m.userData.home = { p: m.position.clone(), r: m.rotation.clone(), dims, color: c }; return m;
    },
    /** A box; seg subdivides it (for dents), shape(x, y, z) -> [x, y, z] bends its corners (wedges, tapers, fastbacks). */
    box(w, h, d, c, x, y, z, { seg, shape, rx = 0 } = {}) {
      const lo = () => {
        const g = seg ? new THREE.BoxGeometry(w, h, d, seg[0], seg[1], seg[2]) : new THREE.BoxGeometry(w, h, d);
        if (shape) { const p = g.attributes.position; for (let k = 0; k < p.count; k++) { const [a, b, e] = shape(p.getX(k), p.getY(k), p.getZ(k)); p.setXYZ(k, a, b, e); } }
        return flat(g);
      };
      const t = Math.min(w, h, d), r = Math.min(0.1, t * 0.3);   // thin trim and stripes stay as they are
      const m = K.part(t < 0.05 ? lo() : dd => dd ? roundBox(w, h, d, r, { seg, shape }) : lo(), c, x, y, z, [w, h, d]); m.rotation.x = rx; m.userData.home.r.copy(m.rotation);
      m.userData.box = { w, h, d, r, shape, tilted: !!rx }; return m;
    },
    panel(...a) {
      const m = K.box(...a), copy = g => Float32Array.from(g.attributes.position.array);
      m.userData.orig = copy(m.geometry); if (m.userData.lod) m.userData.origs = m.userData.lod.map(copy);
      dentable.push(m); return m;
    },
    /** A part from a Blender pack (render/assets): colour c ('lamp' / 'tail' light up; a palette name maps to the kit's
     *  material kinds); far and near geometries (setCarDetail swaps them), placed at its pivot `at`. */
    hd(lo, c, hi, at) {
      const col = HD_COL[c] ?? c, lamp = col === 'lamp' || col === 'tail' || c in HD_GLOW;
      const m = new THREE.Mesh(lamp ? lo : bakeAO(lo.clone(), at ? at[1] : 0), c in HD_GLOW ? new THREE.MeshBasicMaterial({ color: HD_GLOW[c] }) : lamp ? (col === 'lamp' ? hl : tl) : mat(col, HD_KIND[c] || kind(col)));
      if (hi && hi !== lo) { m.userData.lod = [m.geometry, lamp ? hi : bakeAO(hi.clone(), at ? at[1] : 0)]; lod.swap.push(m); }
      if (at) m.position.set(...at); m.castShadow = !lamp; body.add(m); m.userData.hdMat = c; m.userData.home = { p: m.position.clone(), r: m.rotation.clone(), dims: [0.6, 0.2, 0.6], color: col }; return m;
    },
    /** Near detail only (a Blender part with no far version): shown with the close-up bodies, hidden far off. */
    nearOnly(m) { const i = lod.swap.indexOf(m); if (i >= 0) lod.swap.splice(i, 1); m.geometry = m.userData.lod ? m.userData.lod[1] : m.geometry; delete m.userData.lod; lod.hi.push(m); m.visible = lod.on; return m; },
    /** Make a Blender part dentable (keeps its undented positions for both levels). */
    dentHD(m) {
      const copy = g => Float32Array.from(g.attributes.position.array);
      m.userData.orig = copy(m.geometry); if (m.userData.lod) m.userData.origs = m.userData.lod.map(copy);
      if (!dentable.includes(m)) dentable.push(m); return m;
    },
    light(front, w, h, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), front ? hl : tl); m.position.set(x, y, z); body.add(m); return m; },
    lamp(r, x, y, z) { const geo = cyl(r, r, 0.08, 10, g => g.rotateX(Math.PI / 2)), m = new THREE.Mesh(geo(false), hl); both(m, geo, y); m.position.set(x, y, z); body.add(m); return m; },
    number(size, y, z, rx = 0) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshLambertMaterial({ map: numberTex(def.num, '#FFFFFF', '#1C2340'), transparent: true }));
      m.rotation.x = -Math.PI / 2 + rx; m.position.set(0, y, z); body.add(m); return m;
    },
    /** A lamp with its own material, for lights that flash or change (anim). */
    glow(w, h, d, c, x, y, z, parent = body) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: c })); m.position.set(x, y, z); parent.add(m); return m; },
    group(x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); body.add(g); return g; },
    /** A grille on the nose, facing forward (close-up only). */
    grille(w, h, x, y, z) {
      if (!grilleM) grilleM = new THREE.MeshStandardMaterial({ map: grilleTex(), bumpMap: grilleTex(), bumpScale: 0.5, metalness: 0.6, roughness: 0.4, envMapIntensity: 0.8 });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), grilleM); m.position.set(x, y, z); m.visible = false; body.add(m); lod.hi.push(m); return m;
    },
    /** Shut lines where the doors and bonnet meet (close-up only): on the main paint panel, framing the cabin. */
    seams(main, cabin) {
      const B = main && main.userData.box, C = cabin && cabin.userData.box;
      if (!B || B.tilted || !C || C.d < 0.9 || B.d < 2.5) return;
      const M = new THREE.MeshBasicMaterial({ color: 0x0B0C0F }), p = main.position, add = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M); m.position.set(x, y, z); m.visible = false; body.add(m); lod.hi.push(m); };
      const zf = Math.min(cabin.position.z + C.d / 2 - 0.05, p.z + B.d / 2 - 0.5), zr = cabin.position.z - C.d * 0.15, hh = B.h - 2 * B.r - 0.04;
      // only where the panel's shape leaves the sides and the bonnet flat (a wedge or a taper would leave the lines floating)
      const f = B.shape || ((x, y, z) => [x, y, z]), flatAt = (x, y, z, k) => Math.abs(f(x, y, z)[k] - [x, y, z][k]) < 0.005;
      if (![zf, zr].every(z => [-hh / 2, hh / 2].every(y => flatAt(B.w / 2, y, z - p.z, 0) && flatAt(-B.w / 2, y, z - p.z, 0))) || !flatAt(0, B.h / 2, zf + 0.08 - p.z, 1)) return;
      for (const s of [-1, 1]) for (const z of [zf, zr]) add(0.008, hh, 0.014, p.x + s * (B.w / 2 + 0.002), p.y, z);   // door front and back
      add(B.w - 2 * B.r - 0.1, 0.008, 0.014, p.x, p.y + B.h / 2 + 0.002, zf + 0.08);                                  // bonnet
    },
    /** The small stuff a real car has (close-up only), placed from its main paint panel and its cabin: door mirrors in
     *  body colour, door handles, number plates front and back, twin exhaust tips, wipers at the foot of the screen,
     *  an aerial and a fuel cap. Only on a plain closed body (a box shell with a cabin on it): odd shapes keep theirs. */
    dress(main, cabin, color, panels = {}, blender = false) {
      // a mesh's size and middle: a kit box knows its own; anything else (a Blender body) from its geometry's bounds
      const size = m => { if (!m) return null; const u = m.userData.box; if (u) return u.tilted ? null : { w: u.w, h: u.h, d: u.d, c: m.position }; const g = (m.userData.lod || [m.geometry])[0]; g.computeBoundingBox(); const b = g.boundingBox, v = b.getSize(new THREE.Vector3()); return { w: v.x, h: v.y, d: v.z, c: b.getCenter(new THREE.Vector3()).applyEuler(m.rotation).add(m.position) }; };
      const B = size(main), C = size(cabin);
      if (!B || !C || C.d < 0.9 || B.d < 2.5 || C.w > B.w + 0.05) return;
      const p = B.c, q = C.c, yb = p.y - B.h / 2, zF = p.z + B.d / 2, zR = p.z - B.d / 2;
      const add = (geo, c, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, typeof c === 'number' ? mat(c) : c); m.position.set(x, y, z); m.rotation.y = ry; m.visible = lod.on; body.add(m); lod.hi.push(m); return m; };
      if (!plateM) plateM = new THREE.MeshLambertMaterial({ map: plateTex() });
      const cF = q.z + C.d / 2, cY = q.y - C.h / 2;
      for (const s of [-1, 1]) {
        const mx = s * (C.w / 2 + 0.13); if (!blender) {
        add(new THREE.BoxGeometry(0.2, 0.12, 0.08), color, mx, cY + 0.12, cF - 0.18);                     // mirror housing
        add(new THREE.BoxGeometry(0.17, 0.09, 0.012), CHROME, mx, cY + 0.12, cF - 0.225);                 // its glass, facing back
        add(new THREE.BoxGeometry(0.1, 0.04, 0.05), DARK, s * (C.w / 2 + 0.03), cY + 0.1, cF - 0.18);     // its arm
        add(new THREE.BoxGeometry(C.w * 0.36, 0.015, 0.025), DARK, s * C.w * 0.2, cY + 0.025, cF + 0.07, s * 0.12); }   // wiper (a Blender body brings its own mirrors and wipers)
        const h = add(new THREE.BoxGeometry(0.02, 0.035, 0.16), CHROME, s * (B.w / 2 + 0.012), p.y + B.h * 0.18, q.z + C.d * 0.05), door = panels[s > 0 ? 'doorL' : 'doorR'];   // door handle
        if (door) door.attach(h);   // it opens (and flies off) with its door
        add(new THREE.CylinderGeometry(0.045, 0.05, 0.16, 10).rotateX(Math.PI / 2), CHROME, s * Math.min(0.42, B.w * 0.22), yb + 0.1, zR - 0.04);   // exhaust tip
      }
      add(new THREE.PlaneGeometry(0.52, 0.12), plateM, 0, p.y + B.h * 0.08, zR - 0.016, Math.PI);         // rear plate, between the tail lights
      add(new THREE.PlaneGeometry(0.52, 0.12), plateM, 0, p.y - B.h * 0.12, zF + 0.016);               // front plate
      add(new THREE.CylinderGeometry(0.008, 0.012, 0.55, 5), DARK, -C.w * 0.34, q.y + C.h / 2 + 0.27, q.z - C.d * 0.35);   // aerial
      add(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 12).rotateZ(Math.PI / 2), DARK, B.w / 2 + 0.006, p.y + B.h * 0.2, zR + B.d * 0.18);   // fuel cap
    },
    /** Wheels: [x, z, radius, width] each; the front pair steers. knobbly = off-road tread blocks. */
    wheels(list, { knobbly = false, hub = 0xC9CCD4 } = {}) {
      const wheels = [], steer = [];
      for (const [x, z, r, wd] of list) {
        const pivot = new THREE.Group(); pivot.position.set(x, r, z); root.add(pivot);
        const spin = new THREE.Group(); pivot.add(spin);
        const far = new THREE.Group(), near = new THREE.Group(); near.visible = false; spin.add(far, near); lod.lo.push(far); lod.hi.push(near);
        const W = wheelGeos(r, wd, knobbly), t = new THREE.Mesh(W.farTyre, mat(TYRE)); t.castShadow = true; far.add(t);
        far.add(new THREE.Mesh(W.farHub, mat(hub)));
        if (!tyreM) tyreM = new THREE.MeshStandardMaterial({ color: TYRE, vertexColors: true, map: treadTex(TREAD[0], TREAD[1]), bumpMap: treadTex(TREAD[0], TREAD[1]), bumpScale: 0.6, metalness: 0, roughness: 0.92, envMapIntensity: 0.15 });
        for (const [geo, m] of [[W.tyre, tyreM], [W.blocks, mat(TYRE)], [W.rim, mat(DARK)], [W.hub, mat(hub)]]) if (geo) { const o = new THREE.Mesh(geo, m); o.castShadow = m === tyreM; near.add(o); }
        wheels.push(spin); if (z > 0) steer.push(pivot);
      }
      return { wheels, steer, wr: list[0][2] };
    }
  };
  return K;
}
// the lathe's v for the tread face: points 5 to 9 of 15 (see nearWheel)
const TREAD = [5 / 14, 9 / 14];
// A wheel's geometry, both levels, built once per size and shared (a wheel is a few merged meshes, not a dozen: every
// mesh is a draw call, twice over with shadows). Far: a faceted tyre (tread blocks merged in) and a hub. Near: a tyre
// turned from a profile with rounded shoulders, knobbly blocks, a dark rim set into it, and five spokes with a cap.
const wheelCache = new Map(), _wm = new THREE.Matrix4(), _wq = new THREE.Quaternion(), _we = new THREE.Euler(), _wp = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1);
const placed = (g, y, z, a) => g.applyMatrix4(_wm.compose(_wp.set(0, y, z), _wq.setFromEuler(_we.set(-a, 0, 0)), _one));
function wheelGeos(r, wd, knobbly) {
  const key = r + ',' + wd + ',' + knobbly; if (wheelCache.has(key)) return wheelCache.get(key);
  const W = {};
  const farBlocks = knobbly ? Array.from({ length: 8 }, (_, k) => { const a = (k + 0.5) / 8 * Math.PI * 2; return placed(new THREE.BoxGeometry(wd * 0.9, 0.1, 0.16), Math.cos(a) * r, Math.sin(a) * r, a); }) : [];
  W.farTyre = bakeAO(mergeAll([flat(new THREE.CylinderGeometry(r, r, wd, knobbly ? 8 : 10).rotateZ(Math.PI / 2)), ...farBlocks.map(flat)]), r);
  W.farHub = bakeAO(new THREE.CylinderGeometry(r * 0.48, r * 0.48, wd + 0.02, 6).rotateZ(Math.PI / 2), r);
  const h = wd / 2, ri = r * 0.64, q = Math.min(wd * 0.3, r * 0.24), pts = [new THREE.Vector2(ri, -h)];
  for (let k = 0; k <= 4; k++) { const a = -Math.PI / 2 + k / 4 * Math.PI / 2; pts.push(new THREE.Vector2(r - q + Math.cos(a) * q, -h + q + Math.sin(a) * q)); }
  for (let k = 1; k <= 3; k++) pts.push(new THREE.Vector2(r, -h + q + (wd - 2 * q) * k / 4));   // the tread face (TREAD: where it sits in v)
  for (let k = 0; k <= 4; k++) { const a = k / 4 * Math.PI / 2; pts.push(new THREE.Vector2(r - q + Math.cos(a) * q, h - q + Math.sin(a) * q)); }
  pts.push(new THREE.Vector2(ri, h));
  W.tyre = bakeAO(new THREE.LatheGeometry(pts, 28).rotateZ(Math.PI / 2), r);
  W.rim = bakeAO(new THREE.CylinderGeometry(ri, ri, wd * 0.8, 24).rotateZ(Math.PI / 2), r);
  W.hub = bakeAO(mergeAll([new THREE.CylinderGeometry(r * 0.2, r * 0.2, wd * 0.8 + 0.05, 12).rotateZ(Math.PI / 2),
    ...Array.from({ length: 5 }, (_, k) => { const a = k / 5 * Math.PI * 2; return placed(new THREE.BoxGeometry(wd * 0.8 + 0.03, ri * 0.9, r * 0.1), Math.cos(a) * ri * 0.5, Math.sin(a) * ri * 0.5, a); })]), r);
  W.blocks = knobbly ? bakeAO(mergeAll(Array.from({ length: 14 }, (_, k) => { const a = (k + 0.5) / 14 * Math.PI * 2; return placed(roundBox(wd * 0.86, 0.09, r * 0.2, 0.025), Math.cos(a) * (r + 0.01), Math.sin(a) * (r + 0.01), a); })), r) : null;
  wheelCache.set(key, W); return W;
}
/** Swap a car between its far (faceted) and near (rounded) bodies; dirt overlays follow their panel. */
export function setCarDetail(lod, near) {
  if (!lod || lod.on === near) return; lod.on = near;
  for (const m of lod.swap) { const old = m.geometry, g = m.userData.lod[near ? 1 : 0]; m.geometry = g; for (const ch of m.children) if (ch.geometry === old) ch.geometry = g; }
  lod.lo.forEach(o => o.visible = !near); lod.hi.forEach(o => o.visible = near);
}
/** Every geometry of a dentable panel with its undented positions: [[geometry, orig], ...]. */
export const panelGeos = m => m.userData.lod ? m.userData.lod.map((g, i) => [g, m.userData.origs[i]]) : [[m.geometry, m.userData.orig]];
// the classics' Classic bodies: a dark underbody, the painted shell (render/anatomy.js cuts it into panels), a glasshouse
// raked by `cab[5]` with a painted roof on it, and the roof number
function shell(K, def, { len, wid, h = 0.5, y = 0.77, cab }) {
  K.box(wid - 0.04, 0.3, len - 0.04, DARK, 0, 0.44, 0);
  K.panel(wid, h, len, def.color, 0, y, 0, { seg: [3, 2, 6] });
  const [cw, ch, cd, cy, cz, rake = 0.22] = cab;
  const cabin = K.panel(cw, ch, cd, GLASS, 0, cy, cz, { seg: [2, 1, 2], shape: (x, yy, z) => [yy > 0 ? x * 0.88 : x, yy, yy > 0 && z > 0 ? z - rake : z] });
  K.panel(cw - 0.18, 0.08, cd * 0.55, def.color, 0, cy + ch / 2 + 0.02, cz, { seg: [2, 1, 1] });
  K.number(0.6, cy + ch / 2 + 0.07, cz);
  return cabin;
}
const W4 = (x, zf, zr, rf, wf, rr = rf, wr = wf, xr = x) => [[x, zf, rf, wf], [-x, zf, rf, wf], [xr, zr, rr, wr], [-xr, zr, rr, wr]];
const MODELS = {
  // Okafor: a 70s rally hatchback. Short and square, upright glasshouse, four spotlights on the bonnet, stripes, a
  // spare wheel on the roof rack (falls off with the rear spoiler), mud flaps.
  hatch(K, def) {
    K.box(1.96, 0.32, 3.3, DARK, 0, 0.45, 0);
    K.panel(1.9, 0.5, 3.24, def.color, 0, 0.84, 0, { seg: [3, 2, 5] });
    const cabin = K.panel(1.72, 0.58, 1.9, GLASS, 0, 1.38, -0.4, { seg: [2, 1, 2], shape: (x, y, z) => [y > 0 ? x * 0.94 : x, y, y > 0 && z > 0 ? z - 0.12 : z] });
    K.panel(1.66, 0.1, 1.7, def.color, 0, 1.72, -0.45, { seg: [2, 1, 2] });
    for (const s of [-1, 1]) { K.box(0.2, 0.02, 1.2, def.accent, s * 0.32, 1.1, 1.0); K.box(0.2, 0.02, 0.36, def.accent, s * 0.32, 1.1, -1.42); }   // bonnet and tailgate stripes
    K.number(0.72, 1.78, 0.02);
    // roof rack and spare wheel
    for (const s of [-1, 1]) K.box(0.06, 0.06, 1.1, DARK, s * 0.62, 1.8, -0.72);
    const spare = K.part(cyl(0.34, 0.34, 0.2, 10), TYRE, 0, 1.9, -0.8, [0.68, 0.2, 0.68]);
    const bumper = K.box(2.0, 0.3, 0.3, def.accent, 0, 0.6, 1.7);
    const wing = K.box(1.62, 0.07, 0.3, def.accent, 0, 1.76, -1.36, { rx: 0.25 });
    K.box(1.3, 0.12, 0.12, DARK, 0, 1.17, 1.42);                                     // spotlight bar
    K.grille(0.84, 0.2, 0, 0.86, 1.625);
    const heads = [-0.48, -0.16, 0.16, 0.48].map(x => K.lamp(0.14, x, 1.26, 1.5));
    for (const s of [-1, 1]) heads.push(K.light(true, 0.34, 0.2, s * 0.64, 0.88, 1.64));
    const tails = [-1, 1].map(s => K.light(false, 0.36, 0.18, s * 0.66, 0.92, -1.64));
    for (const s of [-1, 1]) K.box(0.36, 0.3, 0.04, TYRE, s * 0.95, 0.34, -1.6);     // mud flaps
    return { bumper, wing, struts: [spare], heads, tails, cabin, ...K.wheels([[0.96, 1.1, 0.42, 0.34], [-0.96, 1.1, 0.42, 0.34], [0.96, -1.1, 0.42, 0.34], [-0.96, -1.1, 0.42, 0.34]]) };
  },
  // Lindqvist: a Group B wedge. Long, low arrowhead body, cockpit well forward, louvred engine cover, side intakes and
  // a big wing on tall stands.
  wedge(K, def) {
    K.box(1.96, 0.26, 3.6, DARK, 0, 0.36, 0);
    const body = (x, y, z) => { const f = Math.max(0, z / 1.8); return [x * (1 - 0.3 * f * f) * (z < -0.6 ? 1.04 : 1), y > 0 ? y - 0.3 * f : y, z]; };
    K.panel(2.0, 0.46, 3.66, def.color, 0, 0.7, 0, { seg: [3, 2, 6], shape: body });
    const cabin = K.panel(1.34, 0.42, 1.4, GLASS, 0, 1.1, 0.2, { seg: [2, 1, 2], shape: (x, y, z) => [y > 0 ? x * 0.78 : x, y, y > 0 ? z * 0.55 - 0.1 : z] });
    K.panel(1.5, 0.2, 1.1, def.color, 0, 1.0, -0.95, { seg: [2, 1, 2], shape: (x, y, z) => [x, y > 0 && z > 0 ? y - 0.06 : y, z] });   // engine cover
    K.number(0.66, 1.115, -0.72);
    for (let k = 0; k < 4; k++) K.box(1.2, 0.03, 0.06, DARK, 0, 1.11, -1.2 - k * 0.1);   // louvres
    for (const s of [-1, 1]) { K.box(0.08, 0.24, 0.7, DARK, s * 1.0, 0.74, -0.4); K.box(0.02, 0.08, 1.9, def.accent, s * 1.005, 0.64, -0.45); }   // intakes, side stripe
    const bumper = K.box(1.36, 0.08, 0.36, def.accent, 0, 0.36, 1.78);                  // front splitter
    const wing = K.box(2.1, 0.08, 0.55, def.accent, 0, 1.52, -1.62);
    const struts = [-1, 1].map(s => K.box(0.08, 0.5, 0.14, DARK, s * 0.56, 1.22, -1.6));
    const heads = [-1, 1].map(s => K.light(true, 0.34, 0.07, s * 0.5, 0.66, 1.72));
    const tails = [-1, 1].map(s => K.light(false, 0.62, 0.12, s * 0.58, 0.8, -1.84));
    return { bumper, wing, struts, heads, tails, cabin, ...K.wheels([[0.98, 1.25, 0.38, 0.3], [-0.98, 1.25, 0.38, 0.3], [1.0, -1.18, 0.42, 0.44], [-1.0, -1.18, 0.42, 0.44]]) };
  },
  // You: a retro muscle fastback. Long bonnet with a scoop, cabin set back into a sloping fastback, twin racing
  // stripes, chrome bumpers, fat rear tyres, ducktail spoiler.
  coupe(K, def) {
    K.box(1.94, 0.3, 3.6, DARK, 0, 0.42, 0);
    K.panel(1.9, 0.44, 3.6, def.color, 0, 0.78, 0, { seg: [3, 2, 6], shape: (x, y, z) => [x, y > 0 && z > 1.5 ? y - 0.06 : y, z] });
    for (const s of [-1, 1]) K.panel(0.14, 0.3, 1.0, def.color, s * 1.0, 0.8, -1.12, { seg: [1, 1, 2] });   // rear arches over the fat tyres
    const cabin = K.panel(1.5, 0.44, 1.3, GLASS, 0, 1.22, -0.5, { seg: [2, 1, 2], shape: (x, y, z) => [y > 0 ? x * 0.88 : x, y, y > 0 ? (z < 0 ? z - 0.02 : z - 0.22) : (z < 0 ? z - 0.4 : z)] });
    K.panel(1.34, 0.08, 0.72, def.color, 0, 1.47, -0.62, { seg: [2, 1, 1] });
    K.number(0.62, 1.52, -0.62);
    K.box(0.44, 0.16, 0.8, def.color, 0, 1.06, 0.78); K.box(0.36, 0.1, 0.04, TYRE, 0, 1.08, 1.19);   // bonnet scoop
    for (const s of [-1, 1]) { K.box(0.2, 0.02, 1.74, def.accent, s * 0.33, 1.005, 0.86); K.box(0.2, 0.02, 0.62, def.accent, s * 0.33, 1.005, -1.44); }   // twin stripes
    const bumper = K.box(1.98, 0.16, 0.18, CHROME, 0, 0.6, 1.84);
    K.box(1.98, 0.14, 0.16, CHROME, 0, 0.6, -1.84);
    const wing = K.box(1.76, 0.08, 0.34, def.color, 0, 1.05, -1.66, { rx: -0.4 });    // ducktail
    for (const s of [-1, 1]) K.box(0.12, 0.12, 0.3, CHROME, s * 0.5, 0.42, -1.86);     // exhausts
    K.grille(0.56, 0.18, 0, 0.8, 1.805);
    const heads = [-0.72, -0.42, 0.42, 0.72].map(x => K.lamp(0.12, x, 0.84, 1.81));
    const tails = [-1, 1].map(s => K.light(false, 0.56, 0.12, s * 0.6, 0.86, -1.81));
    return { bumper, wing, struts: [], heads, tails, cabin, ...K.wheels([[0.94, 1.22, 0.4, 0.3], [-0.94, 1.22, 0.4, 0.3], [1.02, -1.12, 0.46, 0.48], [-1.02, -1.12, 0.46, 0.48]]) };
  },
  // The classics (blender/classics.py draws their Blender bodies): muscle, rally and Le Mans cars.
  // Stallion: a 60s pony fastback. Long bonnet, the roof running down to the tail, a big grille mouth with round lamps
  // in its corners, side scoops, three-bar tail lamps, stripes nose to tail.
  fastback(K, def) {
    K.box(1.92, 0.3, 3.64, DARK, 0, 0.42, 0);
    K.panel(1.94, 0.46, 3.66, def.color, 0, 0.75, 0, { seg: [3, 2, 6], shape: (x, y, z) => [z > 1.5 ? x * 0.92 : x, y > 0 && z > 1.55 ? y - 0.08 : y, z] });
    const cabin = K.panel(1.5, 0.44, 1.9, GLASS, 0, 1.2, -0.62, { seg: [2, 1, 3], shape: (x, y, z) => [y > 0 ? x * 0.88 : x, y > 0 && z < 0 ? y + z * 0.35 : y, y > 0 && z > 0 ? z - 0.3 : z] });
    K.panel(1.3, 0.08, 0.7, def.color, 0, 1.43, -0.42, { seg: [2, 1, 1] });
    K.number(0.6, 1.48, -0.4);
    for (const s of [-1, 1]) { K.box(0.18, 0.02, 1.44, def.accent, s * 0.25, 0.985, 1.1); K.box(0.18, 0.02, 0.34, def.accent, s * 0.25, 0.99, -1.67); K.box(0.06, 0.16, 0.32, DARK, s * 1.0, 0.76, -0.62); }   // stripes, side scoops
    K.box(1.3, 0.24, 0.05, DARK, 0, 0.74, 1.84);                                          // the grille mouth
    const bumper = K.box(1.86, 0.12, 0.14, CHROME, 0, 0.54, 1.87);
    K.box(1.9, 0.12, 0.14, CHROME, 0, 0.54, -1.87);
    const wing = K.box(1.66, 0.05, 0.22, def.color, 0, 1.04, -1.74, { rx: -0.3 });
    for (const s of [-1, 1]) K.box(0.12, 0.12, 0.26, CHROME, s * 0.45, 0.4, -1.86);
    const heads = [-0.56, 0.56].map(x => K.lamp(0.11, x, 0.76, 1.87));
    const tails = [-1, 1].flatMap(s => [0, 1, 2].map(j => K.light(false, 0.08, 0.15, s * (0.36 + 0.13 * j), 0.84, -1.87)));
    return { bumper, wing, struts: [], heads, tails, cabin, ...K.wheels([[0.95, 1.2, 0.41, 0.34], [-0.95, 1.2, 0.41, 0.34], [0.95, -1.15, 0.41, 0.34], [-0.95, -1.15, 0.41, 0.34]]) };
  },
  // Nightbrute: a long late-60s muscle coupe. A full-width black grille with the lamps hidden in it, a bulge down the
  // bonnet, buttress sails beside the rear glass, one tail lamp right across and a band round the tail.
  nightbrute(K, def) {
    K.box(2.0, 0.3, 3.86, DARK, 0, 0.44, 0);
    K.panel(2.04, 0.5, 3.88, def.color, 0, 0.77, 0, { seg: [3, 2, 6] });
    const cabin = K.panel(1.56, 0.42, 1.4, GLASS, 0, 1.22, -0.45, { seg: [2, 1, 2], shape: (x, y, z) => [y > 0 ? x * 0.86 : x, y, y > 0 && z > 0 ? z - 0.25 : z] });
    K.panel(1.34, 0.08, 0.8, def.color, 0, 1.45, -0.5, { seg: [2, 1, 1] });
    K.number(0.62, 1.5, -0.45);
    K.box(0.6, 0.08, 1.3, def.color, 0, 1.04, 0.95);                                     // the bonnet bulge
    for (const s of [-1, 1]) K.box(0.12, 0.08, 0.86, def.color, s * 0.66, 1.2, -1.1, { rx: 0.47 });   // buttress sails
    K.box(1.9, 0.02, 0.2, def.accent, 0, 1.03, -1.65);                                    // the band round the tail
    K.grille(1.76, 0.26, 0, 0.76, 1.93);
    const bumper = K.box(1.94, 0.12, 0.14, CHROME, 0, 0.56, 1.96);
    K.box(1.96, 0.12, 0.14, CHROME, 0, 0.56, -1.96);
    const wing = K.box(1.6, 0.05, 0.18, def.color, 0, 1.06, -1.84, { rx: -0.25 });
    const heads = [-1, 1].map(s => K.light(true, 0.42, 0.05, s * 0.62, 0.8, 1.97));
    const tails = [K.light(false, 1.7, 0.12, 0, 0.86, -1.97)];
    return { bumper, wing, struts: [], heads, tails, cabin, ...K.wheels([[0.97, 1.3, 0.42, 0.34], [-0.97, 1.3, 0.42, 0.34], [1.0, -1.2, 0.44, 0.42], [-1.0, -1.2, 0.44, 0.42]]) };
  },
  // Wasp: a 70s pony coupe. Quad lamps in a recessed grille, a shaker scoop through the bonnet, a ducktail and a
  // hockey-stick stripe down the flanks.
  wasp(K, def) {
    K.box(1.96, 0.3, 3.62, DARK, 0, 0.44, 0);
    K.panel(2.0, 0.5, 3.66, def.color, 0, 0.77, 0, { seg: [3, 2, 6] });
    const cabin = K.panel(1.52, 0.42, 1.5, GLASS, 0, 1.21, -0.5, { seg: [2, 1, 2], shape: (x, y, z) => [y > 0 ? x * 0.86 : x, y, y > 0 && z > 0 ? z - 0.22 : z] });
    K.panel(1.34, 0.08, 0.8, def.color, 0, 1.44, -0.45, { seg: [2, 1, 1] });
    K.number(0.62, 1.49, -0.45);
    const shaker = K.box(0.5, 0.16, 0.6, DARK, 0, 1.08, 0.85);
    for (const s of [-1, 1]) { K.box(0.02, 0.07, 2.4, def.accent, s * 1.02, 0.86, -0.15); K.box(0.02, 0.32, 0.07, def.accent, s * 1.03, 0.76, -1.36); }
    for (const x of [-0.6, -0.2, 0.2, 0.6]) K.box(0.21, 0.02, 0.22, def.accent, x, 1.0, 1.7);   // the band across the nose
    K.box(1.7, 0.3, 0.06, DARK, 0, 0.74, 1.83);
    const bumper = K.box(1.94, 0.12, 0.14, CHROME, 0, 0.52, 1.86);
    K.box(1.94, 0.12, 0.14, CHROME, 0, 0.54, -1.86);
    const wing = K.box(1.72, 0.07, 0.3, def.color, 0, 1.08, -1.72, { rx: 0.35 });
    const heads = [-0.72, -0.48, 0.48, 0.72].map(x => K.lamp(0.1, x, 0.76, 1.87));
    const tails = [-1, 1].map(s => K.light(false, 0.62, 0.14, s * 0.55, 0.84, -1.86));
    return { bumper, wing, struts: [shaker], heads, tails, cabin, ...K.wheels([[0.96, 1.2, 0.41, 0.34], [-0.96, 1.2, 0.41, 0.34], [0.99, -1.14, 0.43, 0.4], [-0.99, -1.14, 0.43, 0.4]]) };
  },
  // Clubman: a 70s rally saloon. A boxy three-box body, black arch flares, two big spotlights, a roof vent, mud flaps.
  clubman(K, def) {
    K.box(1.86, 0.3, 3.5, DARK, 0, 0.44, 0);
    K.panel(1.86, 0.56, 3.56, def.color, 0, 0.77, 0, { seg: [3, 2, 6] });
    const cabin = K.panel(1.62, 0.58, 1.56, GLASS, 0, 1.33, -0.3, { seg: [2, 1, 2], shape: (x, y, z) => [y > 0 ? x * 0.92 : x, y, y > 0 && z > 0 ? z - 0.14 : y > 0 ? z + 0.14 : z] });
    K.panel(1.46, 0.08, 1.0, def.color, 0, 1.63, -0.3, { seg: [2, 1, 1] });
    K.number(0.68, 1.68, -0.35);
    K.box(0.44, 0.08, 0.36, DARK, 0, 1.69, 0.0);                                         // roof vent
    K.box(0.34, 0.02, 1.2, def.accent, 0, 1.06, 1.1); K.box(0.34, 0.02, 0.6, def.accent, 0, 1.06, -1.4);
    for (const s of [-1, 1]) { K.box(0.02, 0.12, 3.0, def.accent, s * 0.935, 0.72, 0); for (const z of [1.18, -1.12]) K.box(0.12, 0.16, 0.95, DARK, s * 0.96, 0.74, z); K.box(0.34, 0.3, 0.04, TYRE, s * 0.9, 0.34, -1.58); }
    K.grille(1.2, 0.2, 0, 0.8, 1.78);
    const bumper = K.box(1.86, 0.14, 0.16, CHROME, 0, 0.54, 1.8);
    K.box(1.86, 0.14, 0.16, CHROME, 0, 0.54, -1.8);
    const wing = K.box(1.5, 0.05, 0.2, def.accent, 0, 1.08, -1.68, { rx: -0.2 });
    const spots = K.box(1.0, 0.08, 0.08, CHROME, 0, 0.6, 1.86);
    const heads = [-0.72, -0.5, 0.5, 0.72].map(x => K.lamp(0.09, x, 0.82, 1.79)).concat([-0.4, 0.4].map(x => K.lamp(0.15, x, 0.66, 1.92)));
    const tails = [-1, 1].map(s => K.light(false, 0.4, 0.14, s * 0.62, 0.86, -1.79));
    return { bumper, wing, struts: [spots], heads, tails, cabin, ...K.wheels([[0.92, 1.18, 0.41, 0.3], [-0.92, 1.18, 0.41, 0.3], [0.92, -1.12, 0.41, 0.3], [-0.92, -1.12, 0.41, 0.3]]) };
  },
  // Quadra: an 80s rally coupe. Angular, box-flared arches, a deep air dam, a lamp pod and a tall wing on the hatch.
  quadra(K, def) {
    K.box(1.94, 0.3, 3.56, DARK, 0, 0.42, 0);
    K.panel(1.94, 0.56, 3.64, def.color, 0, 0.74, 0, { seg: [3, 2, 6] });
    const cabin = K.panel(1.56, 0.52, 1.7, GLASS, 0, 1.26, -0.45, { seg: [2, 1, 2], shape: (x, y, z) => [y > 0 ? x * 0.9 : x, y, y > 0 && z > 0 ? z - 0.2 : y > 0 ? z + 0.3 : z] });
    K.panel(1.4, 0.08, 0.9, def.color, 0, 1.53, -0.4, { seg: [2, 1, 1] });
    K.number(0.66, 1.58, -0.4);
    K.box(0.5, 0.07, 0.34, DARK, 0, 1.6, -0.1);
    for (const s of [-1, 1]) { for (const z of [1.2, -1.16]) K.box(0.16, 0.36, 1.05, def.color, s * 1.02, 0.72, z); K.box(0.12, 0.02, 1.3, def.accent, s * 0.5, 1.0, 1.05); }
    K.grille(1.0, 0.16, 0, 0.82, 1.8); K.box(1.2, 0.18, 0.12, DARK, 0, 1.06, 1.6);
    const bumper = K.box(2.02, 0.3, 0.28, def.accent, 0, 0.5, 1.78);
    K.box(1.96, 0.18, 0.16, DARK, 0, 0.52, -1.82);
    const wing = K.box(1.84, 0.07, 0.42, def.accent, 0, 1.62, -1.62, { rx: -0.12 });
    const struts = [-1, 1].map(s => K.box(0.06, 0.5, 0.14, DARK, s * 0.6, 1.3, -1.56));
    const heads = [-0.42, -0.14, 0.14, 0.42].map(x => K.light(true, 0.24, 0.12, x, 1.06, 1.67)).concat([-1, 1].map(s => K.light(true, 0.34, 0.14, s * 0.66, 0.84, 1.8)));
    const tails = [-1, 1].map(s => K.light(false, 0.5, 0.16, s * 0.6, 0.88, -1.83));
    return { bumper, wing, struts, heads, tails, cabin, ...K.wheels([[1.0, 1.2, 0.42, 0.36], [-1.0, 1.2, 0.42, 0.36], [1.0, -1.16, 0.42, 0.36], [-1.0, -1.16, 0.42, 0.36]]) };
  },
  // Sarthe: a 60s Le Mans racer. Very low, a round nose with covered lamps, humps over the wheels, a louvred engine
  // deck and a stripe down the middle.
  sarthe(K, def) {
    K.box(1.9, 0.24, 3.7, DARK, 0, 0.36, 0);
    K.panel(2.02, 0.42, 3.8, def.color, 0, 0.62, 0, { seg: [3, 2, 7], shape: (x, y, z) => [x * (z > 1.6 ? 0.9 : 1), y > 0 ? y + 0.12 * (Math.exp(-((z - 1.28) ** 2) * 6) + Math.exp(-((z + 1.2) ** 2) * 5)) - (z > 1.6 ? 0.12 : 0) : y, z] });
    const cabin = K.panel(1.4, 0.36, 1.36, GLASS, 0, 0.92, -0.25, { seg: [2, 1, 2], shape: (x, y, z) => [y > 0 ? x * 0.84 : x, y, y > 0 && z > 0 ? z - 0.24 : z] });
    K.panel(1.14, 0.06, 0.5, def.color, 0, 1.09, -0.2, { seg: [2, 1, 1] });
    K.number(0.56, 1.13, -0.2);
    K.box(0.3, 0.02, 1.5, def.accent, 0, 0.86, 1.1); K.box(0.3, 0.02, 0.9, def.accent, 0, 1.0, -1.42);
    for (let k = 0; k < 6; k++) K.box(0.9, 0.03, 0.05, DARK, 0, 0.98 + 0.004 * k, -1.0 - k * 0.11);
    for (const s of [-1, 1]) { K.part(sph(0.2, 10, 6), GLASS, s * 0.6, 0.8, 1.6, [0.9, 0.45, 1.3]); K.box(0.06, 0.14, 0.34, DARK, s * 1.0, 0.66, -0.5); }
    K.box(0.9, 0.12, 0.05, DARK, 0, 0.5, 1.88);
    const bumper = K.box(1.4, 0.06, 0.3, DARK, 0, 0.38, 1.86);
    K.box(1.7, 0.16, 0.08, DARK, 0, 0.5, -1.9);
    const wing = K.box(1.7, 0.05, 0.2, def.color, 0, 0.98, -1.84, { rx: -0.35 });
    const heads = [-0.6, 0.6].map(x => K.lamp(0.1, x, 0.8, 1.72));
    const tails = [-1, 1].map(s => K.light(false, 0.4, 0.1, s * 0.6, 0.66, -1.92));
    return { bumper, wing, struts: [], heads, tails, cabin, ...K.wheels([[0.97, 1.28, 0.38, 0.32], [-0.97, 1.28, 0.38, 0.32], [0.98, -1.2, 0.41, 0.4], [-0.98, -1.2, 0.41, 0.4]]) };
  },
  // The second and third batches of classics (blender/classics.py): their Classic bodies are a shell, a glasshouse and
  // the details that name them.
  bandit(K, def) {
    const cabin = shell(K, def, { len: 3.66, wid: 2.0, cab: [1.52, 0.42, 1.5, 1.21, -0.45] });
    K.box(0.6, 0.1, 0.62, def.color, 0, 1.03, 0.62); K.box(0.5, 0.05, 0.03, DARK, 0, 1.05, 0.31);   // cowl-induction bonnet
    for (const s of [-1, 1]) { K.box(0.26, 0.02, 1.4, def.accent, s * 0.22, 1.01, 1.1); K.box(0.26, 0.02, 0.62, def.accent, s * 0.22, 1.02, -1.5); for (let j = 0; j < 3; j++) K.box(0.04, 0.12, 0.05, DARK, s * 1.0, 0.8, -0.6 - j * 0.09); }
    K.box(1.7, 0.26, 0.06, DARK, 0, 0.74, 1.83);
    const bumper = K.box(1.9, 0.12, 0.14, CHROME, 0, 0.52, 1.86); K.box(1.92, 0.12, 0.14, CHROME, 0, 0.54, -1.86);
    const wing = K.box(1.6, 0.05, 0.2, def.color, 0, 1.06, -1.72, { rx: -0.25 });
    const heads = [-0.66, 0.66].map(x => K.lamp(0.12, x, 0.76, 1.87)), tails = [-1, 1].map(s => K.light(false, 0.5, 0.12, s * 0.5, 0.84, -1.86));
    return { bumper, wing, struts: [], heads, tails, cabin, ...K.wheels(W4(0.96, 1.2, -1.14, 0.41, 0.34, 0.42, 0.38, 0.98)) };
  },
  barra(K, def) {
    const cabin = shell(K, def, { len: 3.6, wid: 2.06, cab: [1.56, 0.42, 1.5, 1.19, -0.45] });
    for (const s of [-1, 1]) { K.box(0.3, 0.1, 0.5, def.color, s * 0.36, 1.02, 0.95); K.box(0.24, 0.06, 0.03, DARK, s * 0.36, 1.04, 1.21); K.box(0.02, 0.22, 1.1, def.accent, s * 1.045, 0.78, -1.0); }
    K.box(1.76, 0.28, 0.06, DARK, 0, 0.72, 1.79); K.box(0.1, 0.28, 0.08, def.color, 0, 0.72, 1.81); K.box(1.8, 0.16, 0.04, DARK, 0, 0.84, -1.81);
    const bumper = K.box(1.98, 0.12, 0.14, CHROME, 0, 0.5, 1.82); K.box(2.0, 0.12, 0.14, CHROME, 0, 0.52, -1.82);
    const wing = K.box(1.5, 0.05, 0.18, def.color, 0, 1.03, -1.68, { rx: -0.2 });
    const heads = [-0.76, -0.52, 0.52, 0.76].map(x => K.lamp(0.1, x, 0.74, 1.82)), tails = [-1, 1].map(s => K.light(false, 0.6, 0.1, s * 0.5, 0.84, -1.83));
    return { bumper, wing, struts: [], heads, tails, cabin, ...K.wheels(W4(0.98, 1.18, -1.12, 0.42, 0.36, 0.44, 0.42, 1.0)) };
  },
  judge(K, def) {
    const cabin = shell(K, def, { len: 3.82, wid: 2.0, cab: [1.52, 0.42, 1.6, 1.21, -0.5] });
    K.box(0.24, 0.3, 0.3, def.color, 0, 0.78, 1.8);                                        // the beak
    for (const s of [-1, 1]) { K.box(0.62, 0.22, 0.05, DARK, s * 0.5, 0.74, 1.84); K.box(0.08, 0.02, 1.7, def.accent, s * 0.75, 1.01, 0.65); K.box(0.08, 0.2, 0.12, def.color, s * 0.7, 1.1, -1.72); }
    K.box(0.7, 0.06, 0.4, DARK, 0, 1.03, 1.0);
    const bumper = K.box(1.9, 0.1, 0.12, def.color, 0, 0.5, 1.86); K.box(1.92, 0.12, 0.14, CHROME, 0, 0.52, -1.9);
    const wing = K.box(1.76, 0.06, 0.3, def.accent, 0, 1.22, -1.72, { rx: -0.15 });
    const heads = [-0.72, -0.48, 0.48, 0.72].map(x => K.lamp(0.09, x, 0.75, 1.88)), tails = [-1, 1].map(s => K.light(false, 0.52, 0.1, s * 0.55, 0.84, -1.9));
    return { bumper, wing, struts: [], heads, tails, cabin, ...K.wheels(W4(0.97, 1.26, -1.18, 0.42, 0.34, 0.44, 0.4, 1.0)) };
  },
  asp(K, def) {
    K.box(1.9, 0.26, 3.36, DARK, 0, 0.42, 0);
    K.panel(2.0, 0.44, 3.44, def.color, 0, 0.66, 0, { seg: [3, 2, 6], shape: (x, y, z) => [x * (Math.abs(z) > 1.4 ? 0.86 : 1), y > 0 ? y + 0.08 * (Math.exp(-((z - 1.12) ** 2) * 5) + Math.exp(-((z + 1.1) ** 2) * 5)) : y, z] });
    K.box(1.2, 0.08, 1.1, DARK, 0, 0.9, -0.3);                                             // the cockpit
    K.box(0.9, 0.3, 0.4, DARK, 0, 1.0, -0.55); K.part(sph(0.17, 8, 6), def.accent, -0.25, 1.3, -0.4, [1, 1, 1]);
    for (const s of [-1, 1]) { K.box(0.2, 0.02, 1.2, def.accent, s * 0.2, 0.93, 1.05); K.box(0.2, 0.02, 0.9, def.accent, s * 0.2, 0.97, -1.25); K.part(cyl(0.07, 0.07, 1.4, 8, g => g.rotateX(Math.PI / 2)), CHROME, s * 1.03, 0.36, -0.05, [1, 1, 1]); }
    const bar = K.box(0.88, 0.5, 0.06, CHROME, 0, 1.13, -0.75);
    const cabin = K.box(1.1, 0.24, 0.04, GLASS, 0, 1.0, 0.32, { rx: 0.45 });
    K.box(0.7, 0.2, 0.05, DARK, 0, 0.6, 1.72);
    const bumper = K.box(1.2, 0.06, 0.08, CHROME, 0, 0.52, 1.76); K.box(1.4, 0.06, 0.08, CHROME, 0, 0.56, -1.74);
    const wing = K.box(1.3, 0.04, 0.16, def.color, 0, 0.9, -1.64, { rx: -0.3 });
    const heads = [-0.6, 0.6].map(x => K.lamp(0.12, x, 0.74, 1.61)), tails = [-1, 1].map(s => K.light(false, 0.2, 0.12, s * 0.55, 0.78, -1.72));
    return { bumper, wing, struts: [bar], heads, tails, cabin, ...K.wheels(W4(0.98, 1.12, -1.1, 0.4, 0.34, 0.43, 0.44, 1.0)) };
  },
  strato(K, def) {
    K.box(1.96, 0.28, 3.28, DARK, 0, 0.4, 0);
    K.panel(2.04, 0.46, 3.32, def.color, 0, 0.66, 0, { seg: [3, 2, 6], shape: (x, y, z) => [x, y > 0 && z > 0.3 ? y - 0.3 * (z - 0.3) / 1.4 : y, z] });
    const cabin = K.panel(1.7, 0.5, 1.6, GLASS, 0, 1.16, -0.2, { seg: [2, 1, 2], shape: (x, y, z) => [y > 0 ? x * 0.9 : x, y, y > 0 && z > 0 ? z - 0.1 : z] });
    K.panel(1.4, 0.08, 0.7, def.color, 0, 1.43, -0.25, { seg: [2, 1, 1] }); K.number(0.6, 1.49, -0.2);
    for (let k = 0; k < 5; k++) K.box(1.1, 0.03, 0.05, DARK, 0, 0.99 + 0.003 * k, -1.08 - k * 0.1);
    for (const s of [-1, 1]) K.box(0.16, 0.02, 1.15, def.accent, s * 0.3, 0.9, 1.0);
    const roofwing = K.box(1.2, 0.05, 0.22, def.accent, 0, 1.44, -0.62, { rx: -0.25 });
    K.box(1.0, 0.2, 0.14, DARK, 0, 0.92, 1.22);
    const bumper = K.box(1.86, 0.1, 0.16, DARK, 0, 0.42, 1.66); K.box(1.8, 0.14, 0.1, DARK, 0, 0.5, -1.66);
    const wing = K.box(1.7, 0.06, 0.24, def.accent, 0, 1.02, -1.6, { rx: -0.3 });
    const heads = [-0.38, -0.13, 0.13, 0.38].map(x => K.lamp(0.1, x, 0.94, 1.3)).concat([-1, 1].map(s => K.light(true, 0.3, 0.08, s * 0.62, 0.72, 1.62)));
    const tails = [-0.62, 0.62].map(x => K.light(false, 0.22, 0.22, x, 0.78, -1.67));
    return { bumper, wing, struts: [roofwing], heads, tails, cabin, ...K.wheels(W4(0.98, 1.06, -1.02, 0.41, 0.36)) };
  },
  pleiades(K, def) {
    const cabin = shell(K, def, { len: 3.6, wid: 1.94, cab: [1.62, 0.54, 1.7, 1.27, -0.35, 0.14] });
    K.box(0.56, 0.12, 0.5, def.color, 0, 1.0, 0.95); K.box(0.46, 0.08, 0.03, DARK, 0, 1.02, 1.21); K.box(0.4, 0.06, 0.3, DARK, 0, 1.58, -0.2);
    for (const s of [-1, 1]) { K.box(0.02, 0.18, 2.6, def.accent, s * 0.97, 0.74, 0); K.box(0.06, 0.36, 0.14, def.color, s * 0.62, 1.2, -1.58); K.box(0.34, 0.3, 0.04, 0xF4F4F0, s * 0.93, 0.34, -1.56); }
    K.grille(0.7, 0.16, 0, 0.8, 1.78);
    const bumper = K.box(1.84, 0.24, 0.2, def.color, 0, 0.5, 1.76); K.box(1.84, 0.18, 0.16, def.color, 0, 0.5, -1.78);
    const wing = K.box(1.66, 0.06, 0.32, def.color, 0, 1.4, -1.6, { rx: -0.12 });
    const heads = [-1, 1].map(s => K.light(true, 0.4, 0.14, s * 0.6, 0.84, 1.8)).concat([-0.55, -0.35, 0.35, 0.55].map(x => K.lamp(0.07, x, 0.5, 1.87)));
    const tails = [-1, 1].map(s => K.light(false, 0.42, 0.14, s * 0.62, 0.88, -1.81));
    return { bumper, wing, struts: [], heads, tails, cabin, ...K.wheels(W4(0.95, 1.18, -1.12, 0.41, 0.34), { hub: def.accent }) };
  },
  cyclone(K, def) {
    const cabin = shell(K, def, { len: 3.64, wid: 1.98, cab: [1.62, 0.54, 1.7, 1.26, -0.35, 0.14] });
    K.box(0.6, 0.04, 0.3, DARK, 0, 1.0, 1.05);
    for (const s of [-1, 1]) { K.box(0.1, 0.02, 1.2, def.accent, s * 0.42, 1.0, 1.15); K.box(0.05, 0.36, 0.3, DARK, s * 0.86, 1.2, -1.62); K.box(0.34, 0.3, 0.04, TYRE, s * 0.94, 0.34, -1.58); }
    K.box(1.6, 0.04, 0.22, DARK, 0, 1.2, -1.66, { rx: -0.2 });
    const bumper = K.box(1.9, 0.3, 0.22, def.color, 0, 0.52, 1.76); for (const x of [-0.6, 0, 0.6]) K.box(0.42, 0.14, 0.04, DARK, x, 0.5, 1.88);
    K.box(1.88, 0.2, 0.16, DARK, 0, 0.5, -1.8);
    const wing = K.box(1.72, 0.05, 0.3, DARK, 0, 1.36, -1.62, { rx: -0.15 });
    const heads = [-1, 1].map(s => K.light(true, 0.4, 0.13, s * 0.62, 0.84, 1.8)), tails = [-1, 1].map(s => K.light(false, 0.42, 0.14, s * 0.62, 0.88, -1.82));
    return { bumper, wing, struts: [], heads, tails, cabin, ...K.wheels(W4(0.96, 1.2, -1.14, 0.41, 0.36)) };
  },
  turin(K, def) {
    K.box(1.96, 0.24, 3.66, DARK, 0, 0.36, 0);
    K.panel(2.06, 0.42, 3.72, def.color, 0, 0.62, 0, { seg: [3, 2, 7], shape: (x, y, z) => [x * (z > 1.6 ? 0.88 : 1), y > 0 ? y + 0.1 * Math.exp(-((z + 1.16) ** 2) * 4) - (z > 1.4 ? 0.12 * (z - 1.4) / 0.46 : 0) : y, z] });
    const cabin = K.panel(1.5, 0.44, 1.4, GLASS, 0, 1.04, -0.2, { seg: [2, 1, 2], shape: (x, y, z) => [y > 0 ? x * 0.86 : x, y, y > 0 && z > 0 ? z - 0.22 : z] });
    K.panel(1.2, 0.06, 0.55, def.color, 0, 1.27, -0.2, { seg: [2, 1, 1] }); K.number(0.56, 1.32, -0.2);
    for (let k = 0; k < 6; k++) K.box(1.0, 0.03, 0.05, DARK, 0, 0.97 + 0.004 * k, -1.0 - k * 0.11);
    for (const x of [-0.36, -0.2, 0.2, 0.36]) { K.box(0.1, 0.02, 1.4, def.accent, x, 0.84, 1.1); K.box(0.1, 0.02, 0.85, def.accent, x, 1.0, -1.4); }
    K.box(1.1, 0.16, 0.12, DARK, 0, 0.84, 1.5);
    const bumper = K.box(1.8, 0.1, 0.2, DARK, 0, 0.38, 1.84); K.box(1.84, 0.14, 0.1, DARK, 0, 0.48, -1.86);
    const wing = K.box(1.8, 0.06, 0.24, def.color, 0, 1.04, -1.8, { rx: -0.3 });
    const heads = [-0.4, -0.13, 0.13, 0.4].map(x => K.lamp(0.09, x, 0.86, 1.57)).concat([-1, 1].map(s => K.light(true, 0.3, 0.08, s * 0.66, 0.66, 1.78)));
    const tails = [-1, 1].map(s => K.light(false, 0.4, 0.12, s * 0.62, 0.82, -1.87));
    return { bumper, wing, struts: [], heads, tails, cabin, ...K.wheels(W4(0.98, 1.28, -1.16, 0.4, 0.34, 0.42, 0.4)) };
  },
  toro(K, def) {
    K.box(1.9, 0.24, 3.76, DARK, 0, 0.36, 0);
    K.panel(2.04, 0.42, 3.84, def.color, 0, 0.6, 0, { seg: [3, 2, 7], shape: (x, y, z) => [x * (z > 1.6 ? 0.86 : 1), y > 0 ? y + 0.08 * (Math.exp(-((z - 1.3) ** 2) * 5) + Math.exp(-((z + 1.16) ** 2) * 4)) - (z > 1.5 ? 0.16 * (z - 1.5) / 0.42 : 0) : y, z] });
    const cabin = K.panel(1.44, 0.36, 1.3, GLASS, 0, 0.96, -0.2, { seg: [2, 1, 2], shape: (x, y, z) => [y > 0 ? x * 0.84 : x, y, y > 0 && z > 0 ? z - 0.24 : z] });
    K.panel(1.16, 0.06, 0.5, def.color, 0, 1.15, -0.2, { seg: [2, 1, 1] }); K.number(0.5, 1.2, -0.2);
    for (let k = 0; k < 7; k++) K.box(0.9, 0.03, 0.04, DARK, 0, 0.93 + 0.004 * k, -0.95 - k * 0.11);
    for (const s of [-1, 1]) { for (let j = 0; j < 4; j++) K.box(0.04, 0.03, 0.18, DARK, s * (0.46 + j * 0.07), 0.82, 1.52); K.box(0.05, 0.12, 0.4, DARK, s * 0.98, 0.7, -0.6); }
    K.box(0.9, 0.08, 0.05, DARK, 0, 0.44, 1.86);
    const bumper = K.box(1.3, 0.05, 0.1, CHROME, 0, 0.46, 1.9); K.box(1.6, 0.05, 0.08, CHROME, 0, 0.5, -1.92);
    const wing = K.box(1.5, 0.04, 0.14, def.color, 0, 0.88, -1.86, { rx: -0.3 });
    const heads = [-0.56, 0.56].map(x => K.lamp(0.1, x, 0.76, 1.6)), tails = [-1, 1].map(s => K.light(false, 0.4, 0.08, s * 0.6, 0.7, -1.93));
    return { bumper, wing, struts: [], heads, tails, cabin, ...K.wheels(W4(0.98, 1.3, -1.16, 0.38, 0.32, 0.41, 0.38)) };
  },
  taurus(K, def) {
    K.box(1.96, 0.24, 3.84, DARK, 0, 0.34, 0);
    K.panel(2.06, 0.46, 3.88, def.color, 0, 0.6, 0, { seg: [3, 2, 6], shape: (x, y, z) => [x, y > 0 && z > -0.2 ? y - 0.3 * (z + 0.2) / 2.14 : y, z] });
    const cabin = K.panel(1.46, 0.38, 1.6, GLASS, 0, 0.94, -0.2, { seg: [2, 1, 2], shape: (x, y, z) => [y > 0 ? x * 0.86 : x, y, y > 0 && z > 0 ? z - 0.45 : z] });
    K.panel(1.18, 0.06, 0.6, def.color, 0, 1.14, -0.35, { seg: [2, 1, 1] }); K.number(0.5, 1.19, -0.3);
    for (const s of [-1, 1]) { K.box(0.32, 0.2, 0.6, def.color, s * 0.7, 1.02, -0.85); K.box(0.26, 0.14, 0.03, DARK, s * 0.7, 1.02, -0.54); K.box(0.04, 0.12, 0.36, DARK, s * 1.0, 0.7, -0.15); K.box(0.1, 0.4, 0.3, def.color, s * 0.55, 1.1, -1.66, { rx: 0.3 }); }
    const bumper = K.box(1.8, 0.06, 0.12, DARK, 0, 0.42, 1.92); K.box(1.9, 0.18, 0.08, DARK, 0, 0.5, -1.95);
    const wing = K.box(1.9, 0.07, 0.42, def.color, 0, 1.32, -1.66, { rx: -0.1 });
    const heads = [-1, 1].map(s => K.light(true, 0.36, 0.06, s * 0.62, 0.6, 1.88)), tails = [-1, 1].map(s => K.light(false, 0.62, 0.14, s * 0.56, 0.72, -1.96));
    return { bumper, wing, struts: [], heads, tails, cabin, ...K.wheels(W4(1.0, 1.28, -1.18, 0.38, 0.34, 0.42, 0.44)) };
  },
  swabia(K, def) {
    K.box(1.8, 0.28, 3.36, DARK, 0, 0.42, 0);
    K.panel(1.9, 0.46, 3.4, def.color, 0, 0.67, 0, { seg: [3, 2, 6], shape: (x, y, z) => [x * (Math.abs(z) > 1.45 ? 0.86 : 1) * (z < -0.8 ? 1.06 : 1), y > 0 ? y + 0.08 * Math.exp(-((z - 1.18) ** 2) * 6) - (z < -1.0 ? 0.1 * (-1.0 - z) / 0.7 : 0) : y, z] });
    const cabin = K.panel(1.46, 0.44, 1.7, GLASS, 0, 1.1, -0.4, { seg: [2, 1, 3], shape: (x, y, z) => [y > 0 ? x * 0.86 : x, y > 0 && z < 0 ? y + z * 0.3 : y, y > 0 && z > 0 ? z - 0.25 : z] });
    K.panel(1.24, 0.06, 0.6, def.color, 0, 1.33, -0.2, { seg: [2, 1, 1] }); K.number(0.55, 1.38, -0.25);
    for (const s of [-1, 1]) { K.box(0.02, 0.1, 2.2, def.accent, s * 0.955, 0.56, 0); K.box(0.34, 0.3, 0.12, def.color, s * 0.62, 0.84, 1.42); }
    K.box(0.6, 0.04, 0.2, DARK, 0, 0.84, -1.42);
    const bumper = K.box(1.6, 0.1, 0.12, CHROME, 0, 0.5, 1.7); K.box(1.7, 0.1, 0.12, CHROME, 0, 0.52, -1.72);
    const wing = K.box(1.3, 0.06, 0.3, def.color, 0, 0.98, -1.55, { rx: 0.3 });
    const heads = [-0.62, 0.62].map(x => K.lamp(0.13, x, 0.86, 1.49)), tails = [-1, 1].map(s => K.light(false, 0.36, 0.1, s * 0.55, 0.72, -1.71));
    return { bumper, wing, struts: [], heads, tails, cabin, ...K.wheels(W4(0.92, 1.18, -1.12, 0.39, 0.32, 0.41, 0.38, 0.97)) };
  },
  rosso(K, def) {
    K.box(1.96, 0.24, 3.84, DARK, 0, 0.34, 0);
    K.panel(2.06, 0.46, 3.88, def.color, 0, 0.6, 0, { seg: [3, 2, 6], shape: (x, y, z) => [x, y > 0 && z > 0 ? y - 0.32 * z / 1.94 : y, z] });
    const cabin = K.panel(1.44, 0.36, 1.4, GLASS, 0, 0.94, -0.15, { seg: [2, 1, 2], shape: (x, y, z) => [y > 0 ? x * 0.86 : x, y, y > 0 && z > 0 ? z - 0.35 : z] });
    K.panel(1.16, 0.06, 0.55, def.color, 0, 1.13, -0.25, { seg: [2, 1, 1] }); K.number(0.5, 1.18, -0.3);
    for (let k = 0; k < 7; k++) K.box(1.1, 0.03, 0.05, DARK, 0, 0.97 + 0.003 * k, -0.95 - k * 0.11);
    for (const s of [-1, 1]) { K.box(0.16, 0.03, 0.4, DARK, s * 0.3, 0.72, 1.2); K.box(0.04, 0.12, 0.36, DARK, s * 1.02, 0.68, -0.4); K.box(0.06, 0.2, 0.42, def.color, s * 1.0, 1.02, -1.78); }
    K.box(1.1, 0.1, 0.05, DARK, 0, 0.48, 1.92);
    const bumper = K.box(1.8, 0.06, 0.14, DARK, 0, 0.38, 1.9); K.box(1.9, 0.16, 0.08, DARK, 0, 0.48, -1.95);
    const wing = K.box(2.0, 0.08, 0.36, def.color, 0, 1.12, -1.8, { rx: -0.15 });
    const heads = [-1, 1].map(s => K.light(true, 0.4, 0.08, s * 0.66, 0.58, 1.86)), tails = [-0.62, -0.42, 0.42, 0.62].map(x => K.light(false, 0.15, 0.15, x, 0.74, -1.96));
    return { bumper, wing, struts: [], heads, tails, cabin, ...K.wheels(W4(1.0, 1.28, -1.18, 0.38, 0.34, 0.42, 0.44)) };
  },
  // Vasquez: a desert trophy truck. Open cockpit in a tube roll cage, big knobbly wheels out at the corners, soft
  // long-travel suspension, light bar, nudge bar, spare tyre on the back deck.
  buggy(K, def) {
    K.box(1.46, 0.2, 3.1, DARK, 0, 0.66, 0);
    K.panel(1.5, 0.36, 2.2, def.color, 0, 0.9, 0.1, { seg: [2, 1, 4] });
    K.panel(1.36, 0.3, 1.0, def.color, 0, 0.94, 1.38, { seg: [2, 1, 2], shape: (x, y, z) => [x, y > 0 && z > 0 ? y - 0.16 : y, z] });   // sloping hood
    K.number(0.66, 1.03, 1.36, 0.16);
    for (const s of [-1, 1]) { K.box(0.5, 0.36, 0.6, DARK, s * 0.32, 1.14, -0.25); }                // seats
    K.part(sph(0.2, 8, 6), def.accent, -0.32, 1.46, -0.12, [0.4, 0.4, 0.4]);  // driver's helmet
    const T = 0.09, top = 1.9;
    for (const [x, z] of [[-0.66, 0.42], [0.66, 0.42], [-0.66, -0.78], [0.66, -0.78]]) K.box(T, top - 1.06, T, def.accent, x, (top + 1.06) / 2, z);
    for (const s of [-1, 1]) K.box(T, T, 1.2, def.accent, s * 0.66, top, -0.18);
    for (const z of [0.42, -0.78]) K.box(1.4, T, T, def.accent, 0, top, z);
    for (const s of [-1, 1]) K.box(T, T, 1.1, def.accent, s * 0.66, 1.45, -1.2, { rx: -0.75 });    // back stays
    const cabin = K.box(1.2, 0.34, 0.05, GLASS, 0, 1.3, 0.5, { rx: -0.3 });           // windscreen
    K.box(1.3, 0.12, 0.12, DARK, 0, top + 0.1, 0.44);                                    // light bar
    const heads = [-0.45, -0.15, 0.15, 0.45].map(x => K.lamp(0.1, x, top + 0.1, 0.52));
    const bumper = K.box(1.3, 0.34, 0.1, DARK, 0, 0.84, 1.92);                          // nudge bar
    const wing = K.part(cyl(0.44, 0.44, 0.28, 10), TYRE, 0, 1.0, -1.28, [0.88, 0.28, 0.88]);   // spare tyre
    const tails = [-1, 1].map(s => K.light(false, 0.24, 0.14, s * 0.56, 0.84, -1.56));
    return { bumper, wing, struts: [], heads, tails, cabin, soft: 2.2, ...K.wheels([[1.12, 1.2, 0.5, 0.42], [-1.12, 1.2, 0.5, 0.42], [1.12, -1.2, 0.5, 0.42], [-1.12, -1.2, 0.5, 0.42]], { knobbly: true, hub: def.accent }) };
  },
  // Monster truck: a pickup body riding high on four huge tyres, roll bar with lamps, flared arches.
  monster(K, def) {
    const R = 0.95, Y = 1.55;
    for (const s of [-1, 1]) for (const z of [-1.25, 1.25]) K.box(0.14, 0.9, 0.14, DARK, s * 0.62, 1.1, z, { rx: 0 });   // shocks
    K.box(1.2, 0.18, 3.0, DARK, 0, 1.15, 0);
    K.panel(2.0, 0.6, 3.5, def.color, 0, Y + 0.1, 0, { seg: [3, 2, 5] });
    const cabin = K.panel(1.8, 0.62, 1.4, GLASS, 0, Y + 0.7, 0.35, { seg: [2, 1, 2], shape: (x, y, z) => [y > 0 ? x * 0.92 : x, y, y > 0 && z > 0 ? z - 0.2 : z] });
    K.panel(1.7, 0.1, 1.15, def.color, 0, Y + 1.06, 0.3, { seg: [2, 1, 2] }); K.number(0.7, Y + 1.12, 0.3);
    for (const s of [-1, 1]) { K.box(0.36, 0.2, 1.3, def.accent, s * 1.08, Y + 0.35, 1.25); K.box(0.36, 0.2, 1.3, def.accent, s * 1.08, Y + 0.35, -1.25); K.box(0.04, 0.3, 2.9, def.accent, s * 1.01, Y + 0.05, 0); }   // arches, flames stripe
    for (const s of [-1, 1]) K.box(0.1, 0.6, 0.1, DARK, s * 0.85, Y + 0.7, -0.6);
    const wing = K.box(1.8, 0.1, 0.1, DARK, 0, Y + 1.0, -0.6);                                // roll bar
    const heads = [-0.6, -0.2, 0.2, 0.6].map(x => K.lamp(0.11, x, Y + 1.08, -0.52));
    K.grille(0.8, 0.3, 0, Y + 0.16, 1.755);
    for (const s of [-1, 1]) heads.push(K.light(true, 0.4, 0.16, s * 0.62, Y + 0.2, 1.76));
    const bumper = K.box(2.1, 0.22, 0.25, CHROME, 0, Y - 0.1, 1.82);
    const tails = [-1, 1].map(s => K.light(false, 0.3, 0.2, s * 0.7, Y + 0.2, -1.76));
    return { bumper, wing, struts: [], heads, tails, cabin, soft: 2.6, ...K.wheels([[1.05, 1.3, R, 0.7], [-1.05, 1.3, R, 0.7], [1.05, -1.3, R, 0.7], [-1.05, -1.3, R, 0.7]], { knobbly: true, hub: def.accent }) };
  },
  // Formula racer: a needle nose, open wheels, a cockpit with the driver's helmet, big front and rear wings.
  formula(K, def) {
    const nose = (x, y, z) => { const f = Math.max(0, z / 1.9); return [x * (1 - 0.72 * f), y > 0 ? y - 0.12 * f : y, z]; };
    K.panel(0.9, 0.34, 3.8, def.color, 0, 0.42, 0.1, { seg: [2, 1, 6], shape: nose });
    for (const s of [-1, 1]) K.panel(0.5, 0.3, 1.5, def.color, s * 0.62, 0.42, -0.45, { seg: [1, 1, 2] });   // sidepods
    K.box(0.12, 0.02, 3.4, def.accent, 0, 0.6, 0.2);
    const cabin = K.part(sph(0.24, 10, 8), def.accent, 0, 0.78, -0.25, [0.5, 0.5, 0.5]);   // the driver's helmet
    K.box(0.36, 0.06, 0.2, GLASS, 0, 0.8, -0.02);
    K.box(0.62, 0.5, 0.5, def.color, 0, 0.82, -0.9, { shape: (x, y, z) => [x, y > 0 && z < 0 ? y - 0.2 : y, z] });   // airbox
    K.number(0.5, 0.63, 0.75);
    const bumper = K.box(1.9, 0.06, 0.4, def.accent, 0, 0.26, 2.0);                   // front wing
    const wing = K.box(1.8, 0.08, 0.5, def.accent, 0, 1.12, -1.72);
    const struts = [-1, 1].map(s => K.box(0.06, 0.5, 0.2, DARK, s * 0.4, 0.86, -1.7));
    const heads = [K.light(true, 0.2, 0.06, 0, 0.5, 2.0)], tails = [K.light(false, 0.26, 0.14, 0, 0.5, -1.8)];
    return { bumper, wing, struts, heads, tails, cabin, ...K.wheels([[0.98, 1.3, 0.34, 0.34], [-0.98, 1.3, 0.34, 0.34], [0.98, -1.1, 0.4, 0.5], [-0.98, -1.1, 0.4, 0.5]]) };
  },
  // Rocket car: a black dart with tail fins, a bubble canopy and a jet nozzle whose flame grows with the throttle
  // and roars on boost (anim).
  rocket(K, def) {
    const dart = (x, y, z) => { const f = Math.max(0, z / 1.9); return [x * (1 - 0.6 * f * f), y > 0 ? y - 0.25 * f : y, z]; };
    K.panel(1.7, 0.5, 3.8, def.color, 0, 0.62, 0, { seg: [3, 2, 6], shape: dart });
    const cabin = K.part(sph(0.46, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), GLASS, 0, 0.86, 0.35, [0.9, 0.46, 0.9]); cabin.scale.z = 1.6;
    for (const s of [-1, 1]) { K.box(0.06, 0.8, 0.9, def.accent, s * 0.6, 1.2, -1.45, { shape: (x, y, z) => [x, y, y > 0 ? z - 0.3 : z] }); K.box(0.04, 0.04, 3.4, def.accent, s * 0.86, 0.72, 0); }
    K.number(0.6, 0.9, -0.7);
    const nozzle = K.part(cyl(0.34, 0.42, 0.5, 12, g => g.rotateX(Math.PI / 2)), DARK, 0, 0.72, -1.95, [0.8, 0.8, 0.5]);
    const flameM = new THREE.MeshBasicMaterial({ color: 0xFFB03A, transparent: true, opacity: 0.85, depthWrite: false }), coreM = new THREE.MeshBasicMaterial({ color: 0xFFF6C8 });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1, 10).rotateX(-Math.PI / 2).translate(0, 0, -0.5), flameM), core = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1, 8).rotateX(-Math.PI / 2).translate(0, 0, -0.5), coreM);
    flame.position.set(0, 0.72, -2.2); core.position.copy(flame.position); nozzle.parent.add(flame, core);
    const bumper = K.box(1.2, 0.1, 0.3, def.accent, 0, 0.42, 1.9);
    const heads = [-1, 1].map(s => K.light(true, 0.28, 0.06, s * 0.35, 0.62, 1.86)), tails = [-1, 1].map(s => K.light(false, 0.2, 0.2, s * 0.62, 0.72, -1.9));
    const anim = (v, c, now) => { const k = c.boost > 0 ? 2.4 : 0.3 + (c.inp.throttle || 0) * 1.2, f = k * (0.85 + 0.3 * Math.sin(now * 60)); flame.scale.set(1, 1, f); core.scale.set(1, 1, f * 0.7); flameM.color.setHex(c.boost > 0 ? 0x6FD8FF : 0xFFB03A); };
    return { bumper, wing: nozzle, struts: [], heads, tails, cabin, anim, ...K.wheels([[0.9, 1.25, 0.36, 0.3], [-0.9, 1.25, 0.36, 0.3], [0.95, -1.2, 0.42, 0.42], [-0.95, -1.2, 0.42, 0.42]]) };
  },
  // Hot rod: black with flames down the sides, a chrome supercharger poking through the bonnet (it shakes with the
  // revs), open front wheels, fat slicks, zoomie pipes.
  hotrod(K, def) {
    K.box(1.1, 0.24, 3.6, DARK, 0, 0.5, 0);
    K.panel(1.2, 0.46, 1.6, def.color, 0, 0.84, 0.85, { seg: [2, 1, 3] });                // long bonnet
    K.panel(1.7, 0.56, 1.8, def.color, 0, 0.9, -0.85, { seg: [3, 1, 3] });
    const cabin = K.panel(1.5, 0.42, 0.95, GLASS, 0, 1.36, -0.75, { seg: [2, 1, 1] });
    K.panel(1.54, 0.1, 0.95, def.color, 0, 1.62, -0.75, { seg: [2, 1, 1] }); K.number(0.6, 1.68, -0.75);
    for (const s of [-1, 1]) for (let k = 0; k < 4; k++) K.box(0.03, 0.14 + (k % 2) * 0.08, 0.5 - k * 0.08, k % 2 ? 0xFFC72C : def.accent, s * (k < 2 ? 0.61 : 0.86), 0.82 + (k % 2) * 0.04, 0.9 - k * 0.55);   // flames
    const blower = K.group(0, 1.2, 0.95);
    for (const [w, h, d, y, c] of [[0.6, 0.3, 0.7, 0, CHROME], [0.5, 0.12, 0.4, 0.22, 0x333333], [0.36, 0.26, 0.2, 0.4, CHROME]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: c })); m.position.y = y; m.castShadow = true; blower.add(m); }
    const struts = [];
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) struts.push(K.box(0.1, 0.1, 0.4, CHROME, s * 0.66, 1.02, 1.1 - k * 0.3, { rx: -0.5 }));   // zoomies
    const bumper = K.box(1.1, 0.12, 0.14, CHROME, 0, 0.56, 1.72);
    const wing = K.box(1.6, 0.1, 0.16, CHROME, 0, 0.62, -1.8);
    K.grille(0.76, 0.36, 0, 0.84, 1.655);
    const heads = [-1, 1].map(s => K.lamp(0.16, s * 0.72, 0.9, 1.5)), tails = [-1, 1].map(s => K.light(false, 0.18, 0.18, s * 0.72, 0.9, -1.77));
    const anim = (v, c, now) => { const r = (c.inp.throttle || 0) * 0.025; blower.position.x = Math.sin(now * 70) * r; blower.position.y = 1.2 + Math.abs(Math.cos(now * 55)) * r; };
    return { bumper, wing, struts, heads, tails, cabin, anim, ...K.wheels([[0.86, 1.3, 0.36, 0.26], [-0.86, 1.3, 0.36, 0.26], [0.98, -1.15, 0.5, 0.56], [-0.98, -1.15, 0.5, 0.56]]) };
  },
  // Interceptor: a long black-and-white sedan, push bar, and a light bar flashing red and blue (anim).
  police(K, def) {
    K.box(1.96, 0.32, 3.6, DARK, 0, 0.45, 0);
    K.panel(1.92, 0.46, 3.6, def.color, 0, 0.82, 0, { seg: [3, 2, 6] });
    for (const s of [-1, 1]) K.box(0.02, 0.4, 1.7, def.accent, s * 0.97, 0.84, -0.1);    // white doors
    const cabin = K.panel(1.64, 0.5, 1.7, GLASS, 0, 1.3, -0.3, { seg: [2, 1, 2], shape: (x, y, z) => [y > 0 ? x * 0.92 : x, y, y > 0 ? z * 0.8 : z] });
    K.panel(1.56, 0.1, 1.3, def.accent, 0, 1.6, -0.3, { seg: [2, 1, 2] }); K.number(0.7, 1.66, -0.62);
    K.box(1.3, 0.12, 0.3, DARK, 0, 1.7, 0.02);
    const red = K.glow(0.56, 0.16, 0.26, 0xFF2020, -0.34, 1.82, 0.02), blue = K.glow(0.56, 0.16, 0.26, 0x2050FF, 0.34, 1.82, 0.02);
    const bumper = K.box(1.3, 0.4, 0.14, DARK, 0, 0.66, 1.9);                            // push bar
    const wing = K.box(1.7, 0.06, 0.24, def.color, 0, 1.08, -1.72);
    K.grille(0.76, 0.16, 0, 0.84, 1.805);
    const heads = [-1, 1].map(s => K.light(true, 0.44, 0.14, s * 0.62, 0.86, 1.81)), tails = [-1, 1].map(s => K.light(false, 0.44, 0.14, s * 0.64, 0.9, -1.81));
    const anim = (v, c, now) => { const on = Math.floor(now * 6) % 2; red.material.color.setHex(on ? 0xFF2020 : 0x401010); blue.material.color.setHex(on ? 0x10183A : 0x3366FF); };
    return { bumper, wing, struts: [], heads, tails, cabin, anim, ...K.wheels([[0.97, 1.2, 0.42, 0.34], [-0.97, 1.2, 0.42, 0.34], [0.97, -1.15, 0.42, 0.34], [-0.97, -1.15, 0.42, 0.34]]) };
  },
  // Go-kart: a flat tray with side pods, the driver sitting right on it (helmet, steering wheel), a rear bumper bar.
  kart(K, def) {
    K.panel(1.3, 0.12, 2.3, def.color, 0, 0.3, 0, { seg: [2, 1, 3] });
    for (const s of [-1, 1]) K.panel(0.3, 0.2, 1.0, def.accent, s * 0.72, 0.34, 0.05, { seg: [1, 1, 2] });
    K.box(1.1, 0.24, 0.4, def.accent, 0, 0.36, 1.05, { shape: (x, y, z) => [x * (z > 0 ? 0.8 : 1), y, z] });   // nose cone
    K.number(0.5, 0.49, 1.02);
    K.box(0.6, 0.4, 0.55, DARK, 0, 0.55, -0.35);                                          // seat
    K.box(0.5, 0.45, 0.4, def.color, 0, 0.8, -0.2);                                         // the driver
    const cabin = K.part(sph(0.24, 10, 8), 0xF4F4F0, 0, 1.2, -0.18, [0.5, 0.5, 0.5]);
    K.box(0.4, 0.06, 0.06, DARK, 0, 0.78, 0.32);
    K.box(0.5, 0.3, 0.3, 0x5A5E66, 0, 0.5, -0.8);                                           // engine
    const bumper = K.box(1.2, 0.1, 0.1, CHROME, 0, 0.34, 1.3);
    const wing = K.box(1.5, 0.12, 0.12, CHROME, 0, 0.36, -1.2);
    const heads = [K.lamp(0.08, 0, 0.42, 1.28)], tails = [K.light(false, 0.3, 0.1, 0, 0.5, -1.0)];
    return { bumper, wing, struts: [], heads, tails, cabin, ...K.wheels([[0.72, 0.85, 0.24, 0.3], [-0.72, 0.85, 0.24, 0.3], [0.76, -0.85, 0.27, 0.38], [-0.76, -0.85, 0.27, 0.38]]) };
  },
  // Tuk-tuk: three wheels (one at the front), an open cab under a striped canvas canopy, a bench behind.
  tuktuk(K, def) {
    K.panel(1.5, 0.44, 2.2, def.color, 0, 0.72, -0.5, { seg: [2, 1, 3] });
    K.panel(0.7, 0.6, 1.1, def.color, 0, 0.8, 1.0, { seg: [1, 1, 2], shape: (x, y, z) => [x * (z > 0 ? 0.7 : 1), y, z] });   // nose
    const cabin = K.box(1.3, 0.5, 0.05, GLASS, 0, 1.4, 0.55, { rx: -0.2 });
    for (const [x, z] of [[-0.68, 0.5], [0.68, 0.5], [-0.68, -1.5], [0.68, -1.5]]) K.box(0.06, 1.0, 0.06, DARK, x, 1.45, z);
    for (let k = 0; k < 5; k++) K.panel(1.56, 0.1, 0.45, k % 2 ? def.accent : def.color, 0, 2.0, 0.5 - k * 0.45 + 0.23, { seg: [2, 1, 1] });   // canopy
    K.number(0.66, 2.06, -0.5);
    K.box(1.2, 0.3, 0.5, 0x7A4A2A, 0, 1.05, -1.1);                                        // bench
    const bumper = K.box(0.6, 0.14, 0.14, CHROME, 0, 0.5, 1.6);
    const wing = K.box(1.3, 0.2, 0.2, def.accent, 0, 0.95, -1.62);                          // luggage rack
    const heads = [K.lamp(0.14, 0, 1.0, 1.56)], tails = [-1, 1].map(s => K.light(false, 0.2, 0.14, s * 0.58, 0.8, -1.61));
    return { bumper, wing, struts: [], heads, tails, cabin, soft: 1.6, ...K.wheels([[0, 1.2, 0.34, 0.24], [0.72, -1.05, 0.36, 0.26], [-0.72, -1.05, 0.36, 0.26]]) };
  },
  // Ice cream van: a tall boxy van in pastel pink, a serving hatch, and a giant cone on the roof that turns (anim).
  icecream(K, def) {
    K.box(1.96, 0.3, 4.1, DARK, 0, 0.45, 0);
    K.panel(1.96, 1.3, 3.0, def.color, 0, 1.25, -0.5, { seg: [3, 2, 4] });
    K.panel(1.9, 0.7, 1.2, def.color, 0, 0.95, 1.5, { seg: [3, 1, 2] });
    const cabin = K.panel(1.8, 0.5, 0.5, GLASS, 0, 1.5, 1.05, { seg: [2, 1, 1], shape: (x, y, z) => [x, y, y > 0 ? z - 0.2 : z] });
    for (const s of [-1, 1]) { K.box(0.02, 0.5, 1.4, 0xFFF4DE, s * 0.99, 1.4, -0.6); K.box(0.02, 0.12, 3.0, def.accent, s * 0.99, 0.72, -0.5); }   // hatch, stripe
    K.number(0.7, 1.92, -1.4);
    const cone = K.group(0, 1.9, -0.3);
    const wafer = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.0, 12).rotateX(Math.PI), new THREE.MeshLambertMaterial({ color: 0xD9A45A })); wafer.position.y = 0.5; cone.add(wafer);
    for (const [c, y, r] of [[0xFFF4DE, 1.1, 0.46], [0xF08AB4, 1.45, 0.4], [0x8A5230, 1.75, 0.3]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), new THREE.MeshLambertMaterial({ color: c })); b.position.y = y; b.castShadow = true; cone.add(b); }
    const bumper = K.box(2.0, 0.24, 0.2, CHROME, 0, 0.6, 2.1);
    const wing = K.box(1.96, 0.1, 0.3, def.accent, 0, 1.94, -2.0);
    K.grille(0.9, 0.3, 0, 0.98, 2.105);
    const heads = [-1, 1].map(s => K.lamp(0.14, s * 0.66, 0.95, 2.1)), tails = [-1, 1].map(s => K.light(false, 0.2, 0.36, s * 0.8, 1.2, -2.01));
    const anim = (v, c, now) => { cone.rotation.y = now * 1.5; };
    return { bumper, wing, struts: [], heads, tails, cabin, anim, soft: 1.3, ...K.wheels([[0.97, 1.4, 0.42, 0.34], [-0.97, 1.4, 0.42, 0.34], [0.97, -1.3, 0.42, 0.34], [-0.97, -1.3, 0.42, 0.34]]) };
  },
  // Fire engine: a long red truck, a chrome ladder on the roof, a hose reel, and flashing blue beacons (anim).
  firetruck(K, def) {
    K.box(2.0, 0.34, 4.8, DARK, 0, 0.5, 0);
    K.panel(2.1, 1.0, 1.4, def.color, 0, 1.2, 1.6, { seg: [3, 2, 2] });
    const cabin = K.panel(1.96, 0.5, 0.3, GLASS, 0, 1.45, 2.26, { seg: [2, 1, 1] });
    K.panel(2.2, 1.2, 3.3, def.color, 0, 1.3, -0.75, { seg: [3, 2, 5] });
    for (const s of [-1, 1]) { K.box(0.02, 0.14, 3.2, def.accent, s * 1.11, 1.0, -0.75); K.box(0.02, 0.9, 3.0, 0xB81E18, s * 1.11, 1.3, -0.75); }
    const ladder = K.group(0, 2.0, -0.6);
    for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 4.2), new THREE.MeshLambertMaterial({ color: CHROME })); r.position.x = s * 0.4; ladder.add(r); }
    for (let k = 0; k < 11; k++) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.05, 0.05), new THREE.MeshLambertMaterial({ color: CHROME })); r.position.z = -2 + k * 0.4; ladder.add(r); }
    K.part(cyl(0.4, 0.4, 0.5, 12, g => g.rotateZ(Math.PI / 2)), 0xE8C050, 0, 2.2, -1.9, [0.8, 0.8, 0.5]);   // hose reel
    K.number(0.7, 1.72, 1.4);
    const beacons = [-1, 1].map(s => K.glow(0.3, 0.2, 0.3, 0x2050FF, s * 0.8, 1.8, 2.05));
    const bumper = K.box(2.1, 0.3, 0.2, CHROME, 0, 0.62, 2.45);
    const wing = K.box(2.0, 0.2, 0.2, CHROME, 0, 0.66, -2.45);
    K.grille(1.1, 0.38, 0, 1.0, 2.305);
    const heads = [-1, 1].map(s => K.lamp(0.16, s * 0.75, 0.95, 2.34)), tails = [-1, 1].map(s => K.light(false, 0.26, 0.3, s * 0.85, 1.0, -2.42));
    const anim = (v, c, now) => beacons.forEach((b, k) => b.material.color.setHex(Math.floor(now * 5 + k) % 2 ? 0x3366FF : 0x10183A));
    return { bumper, wing, struts: [], heads, tails, cabin, anim, ...K.wheels([[1.0, 1.7, 0.46, 0.4], [-1.0, 1.7, 0.46, 0.4], [1.0, -1.1, 0.46, 0.4], [-1.0, -1.1, 0.46, 0.4], [1.0, -1.8, 0.46, 0.4], [-1.0, -1.8, 0.46, 0.4]]) };
  },
  // Moon rover: a gold-foil tub on six wire wheels, two astronaut seats, a camera mast and a dish that scans (anim).
  rover(K, def) {
    K.box(1.6, 0.14, 3.2, 0x9A9EA6, 0, 0.72, 0);
    K.panel(1.5, 0.36, 1.1, def.accent, 0, 0.98, 1.0, { seg: [2, 1, 2] });                 // gold foil
    K.panel(1.5, 0.36, 0.9, def.accent, 0, 0.98, -1.1, { seg: [2, 1, 2] });
    for (const s of [-1, 1]) { K.box(0.5, 0.5, 0.5, def.color, s * 0.38, 1.05, -0.1); K.part(sph(0.2, 10, 8), 0xF4F4F0, s * 0.38, 1.55, -0.05, [0.4, 0.4, 0.4]); }   // seats, helmets
    const cabin = K.box(0.6, 0.06, 0.4, GLASS, -0.4, 1.8, -0.05);                           // helmet visor glint
    for (const s of [-1, 1]) K.box(1.9, 0.04, 1.0 - 0.3 * (s + 1), 0x2A3A6A, 0, 1.2, s * 1.0);   // solar panels
    K.number(0.5, 1.2, 1.1);
    K.box(0.06, 1.1, 0.06, CHROME, 0.55, 1.6, 1.3);
    const dish = K.group(0.55, 2.2, 1.3);
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 6, 0, Math.PI * 2, 0, Math.PI / 3), new THREE.MeshLambertMaterial({ color: 0xF4F4F0, side: THREE.DoubleSide })); d.rotation.x = -1.2; dish.add(d);
    const bumper = K.box(1.5, 0.12, 0.12, CHROME, 0, 0.72, 1.7);
    const wing = K.box(1.2, 0.3, 0.3, def.color, 0, 1.0, -1.72);
    const heads = [-1, 1].map(s => K.lamp(0.12, s * 0.5, 0.95, 1.58)), tails = [-1, 1].map(s => K.light(false, 0.2, 0.12, s * 0.5, 0.95, -1.58));
    const anim = (v, c, now) => { dish.rotation.y = Math.sin(now * 0.8) * 1.2; };
    const W = [];
    for (const z of [1.25, 0, -1.25]) for (const s of [-1, 1]) W.push([s * 0.98, z, 0.4, 0.3]);
    return { bumper, wing, struts: [], heads, tails, cabin, anim, soft: 2.0, ...K.wheels(W, { knobbly: true, hub: CHROME }) };
  },
  // Hovercraft: a rounded hull on a fat black rubber skirt, a glass bubble cockpit up front and a big caged fan on the
  // back that spins with the throttle (anim). No wheels to speak of: tiny ones hidden under the skirt.
  hover(K, def) {
    const skirt = K.box(2.3, 0.5, 3.9, TYRE, 0, 0.32, 0, { seg: [2, 1, 3], shape: (x, y, z) => [x * (Math.abs(z) > 1.6 ? 0.88 : 1), y, z * (Math.abs(x) > 0.9 ? 0.94 : 1)] });
    skirt.userData.home.dims = [2.3, 0.5, 3.9];
    K.panel(2.0, 0.36, 3.5, def.color, 0, 0.74, 0.05, { seg: [3, 1, 5], shape: (x, y, z) => [x * (z > 1.2 ? 0.8 : 1), y, z] });
    const cabin = K.panel(1.2, 0.5, 1.2, GLASS, 0, 1.15, 0.8, { seg: [2, 1, 2], shape: (x, y, z) => [y > 0 ? x * 0.7 : x, y, y > 0 ? z * 0.7 : z] });
    K.number(0.6, 0.93, -0.3);
    for (const s of [-1, 1]) K.box(0.08, 0.06, 3.0, def.accent, s * 0.98, 0.92, 0.05);     // side rubbing strakes
    const fanRing = K.part(d => d ? new THREE.TorusGeometry(0.72, 0.09, 12, 40) : flat(new THREE.TorusGeometry(0.72, 0.09, 6, 16)), DARK, 0, 1.55, -1.4, [1.6, 1.6, 0.2]);
    const fan = K.group(0, 1.55, -1.45);
    for (let k = 0; k < 3; k++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.3, 0.04), new THREE.MeshLambertMaterial({ color: 0xE8E8E8 })); bl.rotation.z = k * Math.PI / 3; fan.add(bl); }
    for (const s of [-1, 1]) K.box(0.08, 0.9, 0.08, DARK, s * 0.72, 1.1, -1.4);             // fan stands
    const rudder = K.box(0.06, 0.8, 0.5, def.accent, 0, 1.5, -1.95);
    const bumper = K.box(1.6, 0.14, 0.2, def.accent, 0, 0.72, 1.92);
    const heads = [-1, 1].map(s => K.lamp(0.12, s * 0.5, 0.82, 1.82)), tails = [-1, 1].map(s => K.light(false, 0.2, 0.12, s * 0.8, 0.8, -1.72));
    const anim = (v, c, now) => { fan.rotation.z = now * (6 + (c.inp.throttle || 0) * 30); rudder.rotation.y = -(c.inp.steer || 0) * 0.5; };
    return { bumper, wing: rudder, struts: [fanRing], heads, tails, cabin, anim, soft: 1.6, ...K.wheels([[0.7, 1.2, 0.2, 0.2], [-0.7, 1.2, 0.2, 0.2], [0.7, -1.2, 0.2, 0.2], [-0.7, -1.2, 0.2, 0.2]]) };
  },
  // Snowcat: a boxy orange cab on two wide rubber tracks (road wheels showing through), a snow blade on the front, a
  // roof light bar and a beacon that turns (anim).
  snowcat(K, def) {
    for (const s of [-1, 1]) {
      K.box(0.62, 0.72, 3.7, TYRE, s * 0.92, 0.4, 0, { seg: [1, 1, 2], shape: (x, y, z) => [x, y, Math.abs(z) > 1.5 && y < 0 ? z * 0.86 : z] });
      for (let k = 0; k < 9; k++) K.box(0.64, 0.06, 0.1, 0x3A3A40, s * 0.92, 0.78, -1.6 + k * 0.4);   // track cleats
    }
    K.box(1.2, 0.3, 3.2, DARK, 0, 0.62, 0);
    K.panel(1.9, 0.9, 2.3, def.color, 0, 1.28, -0.3, { seg: [3, 2, 3] });
    const cabin = K.panel(1.8, 0.62, 1.2, GLASS, 0, 1.98, 0.1, { seg: [2, 1, 2] });
    K.panel(1.9, 0.1, 1.4, def.color, 0, 2.34, 0.05, { seg: [2, 1, 2] });
    K.number(0.66, 2.4, -0.1);
    const bar = K.box(1.4, 0.12, 0.2, DARK, 0, 2.44, 0.6);
    const beacon = K.glow(0.24, 0.22, 0.24, 0xFFA020, 0, 2.52, -0.5);
    const bumper = K.box(2.5, 0.6, 0.18, def.accent, 0, 0.55, 2.05, { rx: -0.25 });          // snow blade
    for (const s of [-1, 1]) K.box(0.1, 0.1, 0.6, DARK, s * 0.6, 0.6, 1.72);
    const wing = K.box(1.5, 0.5, 0.5, def.accent, 0, 1.0, -1.7);                              // rear box
    K.grille(1.0, 0.42, 0, 1.18, 0.855);
    const heads = [-0.45, -0.15, 0.15, 0.45].map(x => K.lamp(0.1, x, 2.44, 0.72)), tails = [-1, 1].map(s => K.light(false, 0.2, 0.2, s * 0.7, 1.1, -1.96));
    const anim = (v, c, now) => { beacon.rotation.y = now * 6; beacon.material.color.setHex(Math.floor(now * 3) % 2 ? 0xFFA020 : 0x7A4A10); };
    return { bumper, wing, struts: [bar], heads, tails, cabin, anim, soft: 0.8, ...K.wheels([[0.92, 1.3, 0.3, 0.5], [-0.92, 1.3, 0.3, 0.5], [0.92, -1.3, 0.3, 0.5], [-0.92, -1.3, 0.3, 0.5], [0.92, 0, 0.3, 0.5], [-0.92, 0, 0.3, 0.5]]) };
  },
  // Stretch limo: absurdly long and low, two-tone with gold trim, a row of tinted windows, a sunroof with a flag and a
  // hood ornament.
  limo(K, def) {
    K.box(1.96, 0.28, 5.3, DARK, 0, 0.42, 0);
    K.panel(1.94, 0.48, 5.3, def.color, 0, 0.8, 0, { seg: [3, 2, 8] });
    const cabin = K.panel(1.7, 0.42, 3.6, GLASS, 0, 1.24, -0.45, { seg: [2, 1, 5], shape: (x, y, z) => [y > 0 ? x * 0.9 : x, y, y > 0 && z > 1.5 ? z - 0.3 : z] });
    K.panel(1.62, 0.08, 3.3, def.color, 0, 1.48, -0.55, { seg: [2, 1, 4] });
    for (const s of [-1, 1]) K.box(0.02, 0.06, 5.2, def.accent, s * 0.975, 0.98, 0);          // gold waistline
    K.box(0.9, 0.04, 0.9, GLASS, 0, 1.53, 0.1);                                                  // sunroof
    K.number(0.6, 1.53, -1.4);
    K.box(0.1, 0.16, 0.2, def.accent, 0, 1.08, 2.45);                                            // hood ornament
    const bumper = K.box(1.98, 0.16, 0.18, CHROME, 0, 0.6, 2.7);
    K.box(1.98, 0.14, 0.16, CHROME, 0, 0.6, -2.7);
    const wing = K.box(0.04, 0.5, 0.04, CHROME, 0.5, 1.8, 0.1); const flag = K.box(0.02, 0.24, 0.36, def.accent, 0.5, 1.95, -0.09);
    K.grille(0.64, 0.2, 0, 0.8, 2.655);
    const heads = [-0.7, -0.45, 0.45, 0.7].map(x => K.lamp(0.1, x, 0.84, 2.66)), tails = [-1, 1].map(s => K.light(false, 0.5, 0.1, s * 0.62, 0.88, -2.66));
    const anim = (v, c, now) => { flag.rotation.y = Math.sin(now * 9) * 0.3; };
    return { bumper, wing, struts: [flag], heads, tails, cabin, anim, ...K.wheels([[0.94, 1.8, 0.4, 0.3], [-0.94, 1.8, 0.4, 0.3], [0.94, -1.8, 0.4, 0.3], [-0.94, -1.8, 0.4, 0.3]]) };
  },
  // Sidecar: a big-bore motorbike with its rider on one side, a bullet-shaped sidecar with a passenger (hanging out
  // on the bends: anim) on the other, joined by a chrome frame.
  sidecar(K, def) {
    K.box(0.4, 0.4, 2.2, DARK, -0.55, 0.62, 0);                                                  // bike frame
    K.panel(0.46, 0.34, 0.9, def.color, -0.55, 0.96, 0.35, { seg: [1, 1, 2] });                  // tank
    K.box(0.4, 0.14, 0.7, TYRE, -0.55, 1.02, -0.35);                                             // seat
    K.box(0.9, 0.06, 0.06, CHROME, -0.55, 1.26, 0.9);                                            // bars
    const rider = K.group(-0.55, 1.1, -0.25);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.4), new THREE.MeshLambertMaterial({ color: def.accent })); torso.position.set(0, 0.35, 0.1); torso.rotation.x = 0.5; rider.add(torso);
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), new THREE.MeshLambertMaterial({ color: def.color })); helm.position.set(0, 0.75, 0.35); rider.add(helm);
    const cabin = K.panel(0.92, 0.46, 2.1, def.color, 0.62, 0.7, 0.05, { seg: [2, 1, 3], shape: (x, y, z) => [x * (1 - 0.35 * Math.max(0, z / 1.05) ** 2), y > 0 && z > 0.4 ? y - 0.16 : y, z] });   // the sidecar tub
    const pass = K.group(0.62, 0.95, -0.35);
    const pt = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.5, 0.36), new THREE.MeshLambertMaterial({ color: 0xF4F4F0 })); pt.position.y = 0.25; pass.add(pt);
    const ph = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 12), new THREE.MeshLambertMaterial({ color: def.accent })); ph.position.y = 0.62; pass.add(ph);
    K.number(0.5, 0.94, 0.55);
    for (const z of [0.6, -0.6]) K.box(1.1, 0.06, 0.06, CHROME, 0.05, 0.62, z);                 // frame
    const bumper = K.box(0.5, 0.14, 0.16, CHROME, 0.62, 0.62, 1.12);
    const wing = K.box(0.36, 0.12, 0.3, def.color, -0.55, 0.94, -1.05);                          // tail hump
    const heads = [K.lamp(0.14, -0.55, 1.1, 1.15)], tails = [K.light(false, 0.2, 0.12, -0.55, 0.92, -1.2)];
    const anim = (v, c, now) => { const lean = (c.inp.steer || 0); pass.position.x = 0.62 + lean * 0.45; pass.rotation.z = -lean * 0.4; rider.rotation.z = lean * 0.25; };
    return { bumper, wing, struts: [], heads, tails, cabin, anim, soft: 1.2, ...K.wheels([[-0.55, 1.05, 0.38, 0.2], [0.95, 0.3, 0.3, 0.2], [-0.55, -1.0, 0.4, 0.26]]) };
  },
  // Cement mixer: a heavy yellow cab and chassis carrying a striped drum that turns as it drives (anim), a chute at
  // the back, six wheels.
  mixer(K, def) {
    K.box(2.0, 0.34, 4.9, DARK, 0, 0.55, 0);
    K.panel(2.0, 1.2, 1.3, def.color, 0, 1.3, 1.75, { seg: [3, 2, 2] });
    const cabin = K.panel(1.9, 0.5, 0.5, GLASS, 0, 1.6, 2.2, { seg: [2, 1, 1], shape: (x, y, z) => [x, y, y > 0 ? z - 0.15 : z] });
    K.number(0.66, 1.92, 1.6);
    const drum = K.group(0, 1.7, -0.6); drum.rotation.x = 0.18;
    const dm = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.95, 2.8, 14).rotateX(Math.PI / 2), new THREE.MeshLambertMaterial({ color: def.accent })); dm.castShadow = true; drum.add(dm);
    for (let k = 0; k < 4; k++) { const st = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.06, 4, 14, Math.PI), new THREE.MeshLambertMaterial({ color: def.color })); st.rotation.set(0, Math.PI / 2, k * Math.PI / 2); st.position.z = -0.8 + k * 0.5; drum.add(st); }
    for (const s of [-1, 1]) K.box(0.2, 1.0, 0.2, DARK, s * 0.7, 1.1, -0.6);
    const wing = K.box(0.5, 0.12, 0.9, 0x8A8F96, 0, 1.1, -2.6, { rx: 0.5 });                     // chute
    const bumper = K.box(2.04, 0.3, 0.22, DARK, 0, 0.66, 2.46);
    K.grille(1.1, 0.4, 0, 1.08, 2.405);
    const heads = [-1, 1].map(s => K.lamp(0.13, s * 0.72, 0.92, 2.42)), tails = [-1, 1].map(s => K.light(false, 0.24, 0.2, s * 0.8, 0.9, -2.46));
    const anim = (v, c, now) => { drum.rotation.z = now * 1.6; };
    return { bumper, wing, struts: [], heads, tails, cabin, anim, soft: 0.8, ...K.wheels([[1.0, 1.75, 0.48, 0.4], [-1.0, 1.75, 0.48, 0.4], [1.0, -1.0, 0.48, 0.4], [-1.0, -1.0, 0.48, 0.4], [1.0, -1.95, 0.48, 0.4], [-1.0, -1.95, 0.48, 0.4]]) };
  }
};
/** Build a racer's body onto root/body. Returns the parts the damage and drawing code use. */
// the family cars (data/families.js): one builder from their chassis numbers
for (const id of FAMILY_IDS) MODELS[id] = (K, def) => familyModel(K, def, chassisOf(id), { DARK, GLASS, CHROME, TYRE });
export function buildCarModel(def, root, body, provider) {
  const K = kit(def, root, body), pack = provider !== 'classic' && blenderPack('car-' + def.model, provider === 'blender');
  const out = pack ? buildBlenderCar(K, def, pack) : (MODELS[def.model] || MODELS.hatch)(K, def);
  const paint = K.dentable.filter(m => m !== out.cabin && m.userData.home.color === def.color && m.userData.box), vol = m => m.userData.box.w * m.userData.box.h * m.userData.box.d;
  const panels = carvePanels(K, out, def, body, DARK);
  {   // mirrors, handles, plates, exhausts (close-up): on the biggest painted panel, kit box or Blender body
    const bv = m => { const g = (m.userData.lod || [m.geometry])[0]; g.computeBoundingBox(); const v = g.boundingBox.getSize(new THREE.Vector3()); return v.x * v.y * v.z; };
    const main = pack ? K.dentable.filter(m => m !== out.cabin && m.parent === body && m.userData.home && m.userData.home.color === def.color).sort((a, b) => bv(b) - bv(a))[0] : paint.slice().sort((a, b) => vol(b) - vol(a))[0];
    K.dress(main, out.cabin, def.color, panels, !!pack);
  }                                 // bonnet, boot and doors on hinges (render/anatomy.js)
  if (!Object.keys(panels).length) K.seams(paint.sort((a, b) => vol(b) - vol(a))[0], out.cabin);   // painted-on shut lines where there are no real ones
  const fit = fitParts(K, out, def.build, body, panels, { DARK, CHROME, LAMP, ACCENT: def.accent });   // upgrade parts (render/parts.js)
  mergeStatic(body, out, K);
  return { ...out, panels, dentable: K.dentable, lod: K.lod, lift: fit.lift, soft: (out.soft || 1) * fit.soft };
}
// Every separate mesh is a draw call (twice with shadows), and a body is dozens of small parts. The ones nothing acts on
// alone (not the bumper, wing, struts, lamps, cabin or dentable panels, nothing animated) are merged, one mesh per
// material for each detail level, so a car costs a handful of draws instead of a hundred.
function mergeStatic(body, out, K) {
  const keep = new Set(K.dentable);
  for (const v of Object.values(out)) for (const o of Array.isArray(v) ? v : [v]) if (o && o.isObject3D) keep.add(o);
  const both = new Map(), hiOnly = new Map();
  for (const m of [...body.children]) {
    if (!m.isMesh || keep.has(m) || m.children.length) continue;
    const hi = K.lod.hi.includes(m);
    if (!hi && !m.userData.home) continue;                                               // lamps and flashing glows stay separate
    const map = hi ? hiOnly : both; if (!map.has(m.material)) map.set(m.material, []); map.get(m.material).push(m);
  }
  const place = (g, m) => g.clone().applyMatrix4(m.matrix);
  for (const [mat, list] of both) {
    if (list.length < 2) continue;
    list.forEach(m => m.updateMatrix());
    const lo = mergeAll(list.map(m => place(m.userData.lod ? m.userData.lod[0] : m.geometry, m))), hasHi = list.some(m => m.userData.lod);
    const g = new THREE.Mesh(lo, mat); g.castShadow = true; body.add(g);
    if (hasHi) { g.userData.lod = [lo, mergeAll(list.map(m => place(m.userData.lod ? m.userData.lod[1] : m.geometry, m)))]; K.lod.swap.push(g); if (K.lod.on) g.geometry = g.userData.lod[1]; }
    for (const m of list) { body.remove(m); const i = K.lod.swap.indexOf(m); if (i >= 0) K.lod.swap.splice(i, 1); }
  }
  for (const [mat, list] of hiOnly) {
    if (list.length < 2) continue;
    list.forEach(m => m.updateMatrix());
    const g = new THREE.Mesh(mergeAll(list.map(m => place(m.geometry, m))), mat); g.visible = K.lod.on; body.add(g); K.lod.hi.push(g);
    for (const m of list) { body.remove(m); K.lod.hi.splice(K.lod.hi.indexOf(m), 1); }
  }
}
export const CAR_MODELS = Object.keys(MODELS);
