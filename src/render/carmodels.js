import * as THREE from 'three';
import { flat } from './geometry.js';
import { numberTex } from './materials.js';
import { bakeAO, carMat } from './carpaint.js';

// The racers' bodies, one builder per model (CAR_DEFS[].model). They differ where it shows from the camera, overhead:
// outline, roof and deck. All share the same footprint (the hitbox is the same for everyone), wheels, lights and the
// damage hooks: each builder hands back the parts damage acts on (bumper, wing + struts fall off, heads/tails go
// out, cabin glass cracks, dentable panels dent), and optionally anim(v, c, now) for moving parts (lights, flames).
// +z is the front, y up, ground at 0. The garage (data/vehicles.js) lists them all.
const DARK = 0x2B2F3A, GLASS = 0x253450, CHROME = 0xD3D7DD, TYRE = 0x1E1E22, LAMP = 0xFFF6C8;

function kit(def, root, body) {
  const mats = new Map(), dentable = [];
  const kind = c => c === def.color || c === def.accent ? 'paint' : c === GLASS ? 'glass' : c === CHROME ? 'chrome' : c === TYRE ? 'rubber' : 'trim';
  const mat = c => { if (!mats.has(c)) mats.set(c, carMat(kind(c), c)); return mats.get(c); };
  const hl = new THREE.MeshBasicMaterial({ color: LAMP }), tl = new THREE.MeshBasicMaterial({ color: 0xFF4A3A });
  const K = {
    dentable,
    /** A mesh on the body; `dims` is what flies off when it's knocked loose. */
    part(geo, c, x, y, z, dims) { const m = new THREE.Mesh(bakeAO(geo, y), mat(c)); m.position.set(x, y, z); m.castShadow = true; body.add(m); m.userData.home = { p: m.position.clone(), r: m.rotation.clone(), dims, color: c }; return m; },
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
    /** A lamp with its own material, for lights that flash or change (anim). */
    glow(w, h, d, c, x, y, z, parent = body) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ color: c })); m.position.set(x, y, z); parent.add(m); return m; },
    group(x, y, z) { const g = new THREE.Group(); g.position.set(x, y, z); body.add(g); return g; },
    /** Wheels: [x, z, radius, width] each; the front pair steers. knobbly = off-road tread blocks. */
    wheels(list, { knobbly = false, hub = 0xC9CCD4 } = {}) {
      const wheels = [], steer = [];
      for (const [x, z, r, wd] of list) {
        const pivot = new THREE.Group(); pivot.position.set(x, r, z); root.add(pivot);
        const spin = new THREE.Group(); pivot.add(spin);
        const t = new THREE.Mesh(bakeAO(flat(new THREE.CylinderGeometry(r, r, wd, knobbly ? 8 : 10).rotateZ(Math.PI / 2)), r), mat(TYRE)); t.castShadow = true; spin.add(t);
        spin.add(new THREE.Mesh(bakeAO(new THREE.CylinderGeometry(r * 0.48, r * 0.48, wd + 0.02, 6).rotateZ(Math.PI / 2), r), mat(hub)));
        if (knobbly) for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * Math.PI * 2, b = new THREE.Mesh(bakeAO(new THREE.BoxGeometry(wd * 0.9, 0.1, 0.16), r), mat(TYRE)); b.position.set(0, Math.cos(a) * r, Math.sin(a) * r); b.rotation.x = -a; spin.add(b); }
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
    const cabin = K.part(new THREE.SphereGeometry(0.24, 10, 8), def.accent, 0, 0.78, -0.25, [0.5, 0.5, 0.5]);   // the driver's helmet
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
    const cabin = K.part(new THREE.SphereGeometry(0.46, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), GLASS, 0, 0.86, 0.35, [0.9, 0.46, 0.9]); cabin.scale.z = 1.6;
    for (const s of [-1, 1]) { K.box(0.06, 0.8, 0.9, def.accent, s * 0.6, 1.2, -1.45, { shape: (x, y, z) => [x, y, y > 0 ? z - 0.3 : z] }); K.box(0.04, 0.04, 3.4, def.accent, s * 0.86, 0.72, 0); }
    K.number(0.6, 0.9, -0.7);
    const nozzle = K.part(flat(new THREE.CylinderGeometry(0.34, 0.42, 0.5, 12).rotateX(Math.PI / 2)), DARK, 0, 0.72, -1.95, [0.8, 0.8, 0.5]);
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
    const cabin = K.part(new THREE.SphereGeometry(0.24, 10, 8), 0xF4F4F0, 0, 1.2, -0.18, [0.5, 0.5, 0.5]);
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
    for (const [c, y, r] of [[0xFFF4DE, 1.1, 0.46], [0xF08AB4, 1.45, 0.4], [0x8A5230, 1.75, 0.3]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), new THREE.MeshLambertMaterial({ color: c })); b.position.y = y; b.castShadow = true; cone.add(b); }
    const bumper = K.box(2.0, 0.24, 0.2, CHROME, 0, 0.6, 2.1);
    const wing = K.box(1.96, 0.1, 0.3, def.accent, 0, 1.94, -2.0);
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
    K.part(flat(new THREE.CylinderGeometry(0.4, 0.4, 0.5, 12).rotateZ(Math.PI / 2)), 0xE8C050, 0, 2.2, -1.9, [0.8, 0.8, 0.5]);   // hose reel
    K.number(0.7, 1.72, 1.4);
    const beacons = [-1, 1].map(s => K.glow(0.3, 0.2, 0.3, 0x2050FF, s * 0.8, 1.8, 2.05));
    const bumper = K.box(2.1, 0.3, 0.2, CHROME, 0, 0.62, 2.45);
    const wing = K.box(2.0, 0.2, 0.2, CHROME, 0, 0.66, -2.45);
    const heads = [-1, 1].map(s => K.lamp(0.16, s * 0.75, 0.95, 2.34)), tails = [-1, 1].map(s => K.light(false, 0.26, 0.3, s * 0.85, 1.0, -2.42));
    const anim = (v, c, now) => beacons.forEach((b, k) => b.material.color.setHex(Math.floor(now * 5 + k) % 2 ? 0x3366FF : 0x10183A));
    return { bumper, wing, struts: [], heads, tails, cabin, anim, ...K.wheels([[1.0, 1.7, 0.46, 0.4], [-1.0, 1.7, 0.46, 0.4], [1.0, -1.1, 0.46, 0.4], [-1.0, -1.1, 0.46, 0.4], [1.0, -1.8, 0.46, 0.4], [-1.0, -1.8, 0.46, 0.4]]) };
  },
  // Moon rover: a gold-foil tub on six wire wheels, two astronaut seats, a camera mast and a dish that scans (anim).
  rover(K, def) {
    K.box(1.6, 0.14, 3.2, 0x9A9EA6, 0, 0.72, 0);
    K.panel(1.5, 0.36, 1.1, def.accent, 0, 0.98, 1.0, { seg: [2, 1, 2] });                 // gold foil
    K.panel(1.5, 0.36, 0.9, def.accent, 0, 0.98, -1.1, { seg: [2, 1, 2] });
    for (const s of [-1, 1]) { K.box(0.5, 0.5, 0.5, def.color, s * 0.38, 1.05, -0.1); K.part(new THREE.SphereGeometry(0.2, 10, 8), 0xF4F4F0, s * 0.38, 1.55, -0.05, [0.4, 0.4, 0.4]); }   // seats, helmets
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
    const fanRing = K.part(flat(new THREE.TorusGeometry(0.72, 0.09, 6, 16)), DARK, 0, 1.55, -1.4, [1.6, 1.6, 0.2]);
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
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshLambertMaterial({ color: def.color })); helm.position.set(0, 0.75, 0.35); rider.add(helm);
    const cabin = K.panel(0.92, 0.46, 2.1, def.color, 0.62, 0.7, 0.05, { seg: [2, 1, 3], shape: (x, y, z) => [x * (1 - 0.35 * Math.max(0, z / 1.05) ** 2), y > 0 && z > 0.4 ? y - 0.16 : y, z] });   // the sidecar tub
    const pass = K.group(0.62, 0.95, -0.35);
    const pt = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.5, 0.36), new THREE.MeshLambertMaterial({ color: 0xF4F4F0 })); pt.position.y = 0.25; pass.add(pt);
    const ph = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), new THREE.MeshLambertMaterial({ color: def.accent })); ph.position.y = 0.62; pass.add(ph);
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
    const heads = [-1, 1].map(s => K.lamp(0.13, s * 0.72, 0.92, 2.42)), tails = [-1, 1].map(s => K.light(false, 0.24, 0.2, s * 0.8, 0.9, -2.46));
    const anim = (v, c, now) => { drum.rotation.z = now * 1.6; };
    return { bumper, wing, struts: [], heads, tails, cabin, anim, soft: 0.8, ...K.wheels([[1.0, 1.75, 0.48, 0.4], [-1.0, 1.75, 0.48, 0.4], [1.0, -1.0, 0.48, 0.4], [-1.0, -1.0, 0.48, 0.4], [1.0, -1.95, 0.48, 0.4], [-1.0, -1.95, 0.48, 0.4]]) };
  }
};
/** Build a racer's body onto root/body. Returns the parts the damage and drawing code use. */
export function buildCarModel(def, root, body) {
  const K = kit(def, root, body), out = (MODELS[def.model] || MODELS.hatch)(K, def);
  return { ...out, dentable: K.dentable };
}
export const CAR_MODELS = Object.keys(MODELS);
