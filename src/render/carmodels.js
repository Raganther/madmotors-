import * as THREE from 'three';
import { flat } from './geometry.js';
import { glassMat, numberTex, paintMat } from './materials.js';

// The racers' bodies, one builder per model (CAR_DEFS[].model). They differ where it shows from the camera, overhead:
// outline, roof and deck. All share the same footprint (the hitbox is the same for everyone), wheels, lights and the
// damage hooks: each builder hands back the parts damage acts on (bumper, wing + struts fall off, heads/tails go
// out, cabin glass cracks, dentable panels dent). +z is the front, y up, ground at 0.
const DARK = 0x2B2F3A, GLASS = 0x253450, CHROME = 0xD3D7DD, TYRE = 0x1E1E22, LAMP = 0xFFF6C8;

function kit(def, root, body) {
  const mats = new Map(), dentable = [];
  const mat = c => { if (!mats.has(c)) mats.set(c, c === def.color || c === def.accent ? paintMat(c) : c === GLASS ? glassMat() : new THREE.MeshLambertMaterial({ color: c })); return mats.get(c); };
  const hl = new THREE.MeshBasicMaterial({ color: LAMP }), tl = new THREE.MeshBasicMaterial({ color: 0xFF4A3A });
  const K = {
    dentable,
    /** A mesh on the body; `dims` is what flies off when it's knocked loose. */
    part(geo, c, x, y, z, dims) { const m = new THREE.Mesh(geo, mat(c)); m.position.set(x, y, z); m.castShadow = true; body.add(m); m.userData.home = { p: m.position.clone(), r: m.rotation.clone(), dims, color: c }; return m; },
    /** A box; seg subdivides it (for dents), shape(x, y, z) -> [x, y, z] bends its corners (wedges, tapers, fastbacks). */
    box(w, h, d, c, x, y, z, { seg, shape, rx = 0 } = {}) {
      const g = seg ? new THREE.BoxGeometry(w, h, d, seg[0], seg[1], seg[2]) : new THREE.BoxGeometry(w, h, d);
      if (shape) { const p = g.attributes.position; for (let k = 0; k < p.count; k++) { const [a, b, e] = shape(p.getX(k), p.getY(k), p.getZ(k)); p.setXYZ(k, a, b, e); } }
      const m = K.part(flat(g), c, x, y, z, [w, h, d]); m.rotation.x = rx; m.userData.home.r.copy(m.rotation); return m;
    },
    panel(...a) { const m = K.box(...a); m.userData.orig = Float32Array.from(m.geometry.attributes.position.array); dentable.push(m); return m; },
    light(front, w, h, x, y, z) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), front ? hl : tl); m.position.set(x, y, z); body.add(m); return m; },
    lamp(r, x, y, z) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.08, 10).rotateX(Math.PI / 2), hl); m.position.set(x, y, z); body.add(m); return m; },
    number(size, y, z, rx = 0) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshLambertMaterial({ map: numberTex(def.num, '#FFFFFF', '#1C2340'), transparent: true }));
      m.rotation.x = -Math.PI / 2 + rx; m.position.set(0, y, z); body.add(m); return m;
    },
    /** Wheels: [x, z, radius, width] each; the front pair steers. knobbly = off-road tread blocks. */
    wheels(list, { knobbly = false, hub = 0xC9CCD4 } = {}) {
      const wheels = [], steer = [];
      for (const [x, z, r, wd] of list) {
        const pivot = new THREE.Group(); pivot.position.set(x, r, z); root.add(pivot);
        const spin = new THREE.Group(); pivot.add(spin);
        const t = new THREE.Mesh(flat(new THREE.CylinderGeometry(r, r, wd, knobbly ? 8 : 10).rotateZ(Math.PI / 2)), mat(TYRE)); t.castShadow = true; spin.add(t);
        spin.add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.48, r * 0.48, wd + 0.02, 6).rotateZ(Math.PI / 2), mat(hub)));
        if (knobbly) for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * Math.PI * 2, b = new THREE.Mesh(new THREE.BoxGeometry(wd * 0.9, 0.1, 0.16), mat(TYRE)); b.position.set(0, Math.cos(a) * r, Math.sin(a) * r); b.rotation.x = -a; spin.add(b); }
        wheels.push(spin); if (z > 0) steer.push(pivot);
      }
      return { wheels, steer, wr: list[0][2] };
    }
  };
  return K;
}
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
    const spare = K.part(flat(new THREE.CylinderGeometry(0.34, 0.34, 0.2, 10)), TYRE, 0, 1.9, -0.8, [0.68, 0.2, 0.68]);
    const bumper = K.box(2.0, 0.3, 0.3, def.accent, 0, 0.6, 1.7);
    const wing = K.box(1.62, 0.07, 0.3, def.accent, 0, 1.76, -1.36, { rx: 0.25 });
    K.box(1.3, 0.12, 0.12, DARK, 0, 1.17, 1.42);                                     // spotlight bar
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
    const heads = [-0.72, -0.42, 0.42, 0.72].map(x => K.lamp(0.12, x, 0.84, 1.81));
    const tails = [-1, 1].map(s => K.light(false, 0.56, 0.12, s * 0.6, 0.86, -1.81));
    return { bumper, wing, struts: [], heads, tails, cabin, ...K.wheels([[0.94, 1.22, 0.4, 0.3], [-0.94, 1.22, 0.4, 0.3], [1.02, -1.12, 0.46, 0.48], [-1.02, -1.12, 0.46, 0.48]]) };
  },
  // Vasquez: a desert trophy truck. Open cockpit in a tube roll cage, big knobbly wheels out at the corners, soft
  // long-travel suspension, light bar, nudge bar, spare tyre on the back deck.
  buggy(K, def) {
    K.box(1.46, 0.2, 3.1, DARK, 0, 0.66, 0);
    K.panel(1.5, 0.36, 2.2, def.color, 0, 0.9, 0.1, { seg: [2, 1, 4] });
    K.panel(1.36, 0.3, 1.0, def.color, 0, 0.94, 1.38, { seg: [2, 1, 2], shape: (x, y, z) => [x, y > 0 && z > 0 ? y - 0.16 : y, z] });   // sloping hood
    K.number(0.66, 1.03, 1.36, 0.16);
    for (const s of [-1, 1]) { K.box(0.5, 0.36, 0.6, DARK, s * 0.32, 1.14, -0.25); }                // seats
    K.part(new THREE.SphereGeometry(0.2, 8, 6), def.accent, -0.32, 1.46, -0.12, [0.4, 0.4, 0.4]);  // driver's helmet
    const T = 0.09, top = 1.9;
    for (const [x, z] of [[-0.66, 0.42], [0.66, 0.42], [-0.66, -0.78], [0.66, -0.78]]) K.box(T, top - 1.06, T, def.accent, x, (top + 1.06) / 2, z);
    for (const s of [-1, 1]) K.box(T, T, 1.2, def.accent, s * 0.66, top, -0.18);
    for (const z of [0.42, -0.78]) K.box(1.4, T, T, def.accent, 0, top, z);
    for (const s of [-1, 1]) K.box(T, T, 1.1, def.accent, s * 0.66, 1.45, -1.2, { rx: -0.75 });    // back stays
    const cabin = K.box(1.2, 0.34, 0.05, GLASS, 0, 1.3, 0.5, { rx: -0.3 });           // windscreen
    K.box(1.3, 0.12, 0.12, DARK, 0, top + 0.1, 0.44);                                    // light bar
    const heads = [-0.45, -0.15, 0.15, 0.45].map(x => K.lamp(0.1, x, top + 0.1, 0.52));
    const bumper = K.box(1.3, 0.34, 0.1, DARK, 0, 0.84, 1.92);                          // nudge bar
    const wing = K.part(flat(new THREE.CylinderGeometry(0.44, 0.44, 0.28, 10)), TYRE, 0, 1.0, -1.28, [0.88, 0.28, 0.88]);   // spare tyre
    const tails = [-1, 1].map(s => K.light(false, 0.24, 0.14, s * 0.56, 0.84, -1.56));
    return { bumper, wing, struts: [], heads, tails, cabin, soft: 2.2, ...K.wheels([[1.12, 1.2, 0.5, 0.42], [-1.12, 1.2, 0.5, 0.42], [1.12, -1.2, 0.5, 0.42], [-1.12, -1.2, 0.5, 0.42]], { knobbly: true, hub: def.accent }) };
  }
};
/** Build a racer's body onto root/body. Returns the parts the damage and drawing code use. */
export function buildCarModel(def, root, body) {
  const K = kit(def, root, body), out = (MODELS[def.model] || MODELS.hatch)(K, def);
  return { ...out, dentable: K.dentable };
}
export const CAR_MODELS = Object.keys(MODELS);
