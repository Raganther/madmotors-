import * as THREE from 'three';

// The Classic builder for the car families (data/families.js): one body built from a chassis's numbers, the way the
// hand-built MODELS in render/carmodels.js are (a dark tub, a dentable painted shell the anatomy cuts into panels, a
// glasshouse, bumpers, lights, wheels), plus the extras a car names. C: the kit's colours { DARK, GLASS, CHROME, TYRE }.
const cylG = (r, h, n = 10) => d => new THREE.CylinderGeometry(r, r, h, d ? n * 2 : n).rotateZ(Math.PI / 2);
const sphG = r => d => new THREE.SphereGeometry(r, d ? 20 : 8, d ? 14 : 6);
export function familyModel(K, def, P, C) {
  const { L, W, base, deck, cab } = P, y0 = base + 0.12, h = deck - y0, mid = (cab.zf + cab.zr) / 2, len = cab.zf - cab.zr;
  K.box(W - 0.06, 0.24, 2 * L - 0.2, C.DARK, 0, base + 0.12, 0);                                      // the tub
  // the painted shell: the bonnet drops by `nose` to the front, the boot by `tail` to the back, the ends pinch in a little
  const shell = (x, y, z) => { const f = Math.max(0, (z - (L - 0.7)) / 0.7), r = Math.max(0, (-z - (L - 0.5)) / 0.5); return [x * (1 - 0.06 * f * f - 0.04 * r * r), y > 0 ? y - P.nose * f - P.tail * r : y, z]; };
  K.panel(W, h, 2 * L, def.color, 0, y0 + h / 2, 0, { seg: [3, 2, 6], shape: shell });
  for (const s of [-1, 1]) K.box(0.02, 0.07, 2 * L * 0.78, def.accent, s * (W / 2 + 0.006), deck - 0.2, 0);   // side stripes
  let cabin;
  if (P.open) {   // a roadster: a raked screen, two seats, the driver
    cabin = K.box(W * 0.8, 0.3, 0.05, C.GLASS, 0, deck + 0.17, cab.zf, { rx: -0.45 });
    for (const s of [-1, 1]) K.box(0.5, 0.3, 0.5, C.DARK, s * 0.36, deck + 0.05, mid - 0.1);
  } else {
    const rake = cab.rake, glass = (x, y, z) => [y > 0 ? x * cab.taper : x, y, y > 0 ? (z > 0 ? z - rake : z + rake * 0.35) : z];
    cabin = K.panel(W * 0.9, cab.roof - deck, len, C.GLASS, 0, (cab.roof + deck) / 2, mid, { seg: [2, 1, 2], shape: glass });
    K.panel(W * 0.9 * cab.taper - 0.04, 0.08, len - rake * 1.35, def.color, 0, cab.roof + 0.04, mid - rake * 0.32, { seg: [2, 1, 1] });   // the roof
    K.number(Math.min(0.62, len * 0.5), cab.roof + 0.09, mid - rake * 0.32);
  }
  if (P.open) K.number(0.5, deck + 0.02, -L + 0.55);
  if (P.bed) {   // an open load bed behind the cab: a dark liner and painted rails
    const bl = cab.zr - (-L + 0.12); K.box(W - 0.24, 0.04, bl, C.DARK, 0, deck + 0.02, (cab.zr + (-L + 0.12)) / 2);
    for (const s of [-1, 1]) K.box(0.1, 0.22, bl, def.color, s * (W / 2 - 0.05), deck + 0.11, (cab.zr + (-L + 0.12)) / 2);
    K.box(W, 0.22, 0.1, def.color, 0, deck + 0.11, -L + 0.07);
  }
  // bumpers, wing, lights, grille
  const bc = P.bumper === 'chrome' ? C.CHROME : C.DARK;
  let bumper;
  if (P.bumper === 'bar') { bumper = K.box(W * 0.86, 0.36, 0.1, C.DARK, 0, base + 0.36, L + 0.12); for (const s of [-1, 1]) K.box(0.08, 0.08, 0.2, C.DARK, s * 0.5, base + 0.3, L + 0.02); }
  else bumper = K.box(W + 0.04, 0.16, 0.18, bc, 0, base + 0.22, L + 0.02);
  K.box(W + 0.02, 0.15, 0.16, bc, 0, base + 0.22, -L - 0.02);
  let wing = null; const struts = [];
  if (P.wing === 1) wing = K.box(W * 0.84, 0.06, 0.3, def.accent, 0, deck - P.tail + 0.06, -L + 0.2, { rx: -0.3 });
  if (P.wing === 2) { wing = K.box(W + 0.06, 0.07, 0.5, def.accent, 0, deck + 0.52, -L + 0.28); for (const s of [-1, 1]) struts.push(K.box(0.07, 0.48, 0.14, C.DARK, s * 0.6, deck + 0.26, -L + 0.28)); }
  const heads = [-1, 1].map(s => K.light(true, 0.36, 0.13, s * W * 0.32, deck - P.nose - 0.14, L + 0.01));
  const tails = [-1, 1].map(s => K.light(false, 0.4, 0.13, s * W * 0.33, deck - P.tail - 0.12, -L - 0.01));
  K.grille(W * 0.36, 0.14, 0, deck - P.nose - 0.18, L + 0.012);
  // extras
  const roofZ = mid - cab.rake * 0.32, X = P.extras || [];
  if (X.includes('sign')) { K.box(0.62, 0.18, 0.24, 0xF4F4F0, 0, cab.roof + 0.17, roofZ); K.box(0.66, 0.04, 0.28, C.DARK, 0, cab.roof + 0.08, roofZ); }
  if (X.includes('box')) K.box(W * 0.6, 0.22, Math.min(1.2, len - 0.5), C.DARK, 0, cab.roof + 0.2, roofZ - 0.1);
  if (X.includes('rack')) for (const s of [-1, 1]) K.box(0.05, 0.05, len - 0.6, C.DARK, s * W * 0.32, cab.roof + 0.1, roofZ);
  if (X.includes('lamps')) { const z = P.open ? cab.zf - 0.2 : cab.zf - cab.rake - 0.05, y = (P.open ? deck + 0.4 : cab.roof) + 0.12; K.box(1.1, 0.1, 0.1, C.DARK, 0, y - 0.04, z); [-0.39, -0.13, 0.13, 0.39].forEach(x => heads.push(K.lamp(0.09, x, y + 0.04, z + 0.06))); }
  if (X.includes('tyres')) for (const z of [-0.95, -1.45]) K.part(cylG(0.32, 0.24, 10), C.TYRE, 0.25 * (z > -1 ? 1 : -1), deck + 0.2, z, [0.64, 0.24, 0.64]);
  if (X.includes('cage')) for (const s of [-1, 1]) { K.box(0.06, 0.06, len - cab.rake, C.DARK, s * W * 0.3, cab.roof + 0.04, roofZ); K.box(0.04, cab.roof - deck - 0.1, 0.04, C.DARK, s * W * 0.43, (cab.roof + deck) / 2, mid); }
  if (X.includes('plates')) for (const s of [-1, 1]) K.box(0.04, 0.32, 1.3, 0x8D939C, s * (W / 2 + 0.03), base + 0.48, -0.05);
  if (X.includes('flaps')) for (const s of [-1, 1]) K.box(0.36, 0.28, 0.04, C.TYRE, s * P.wheels[0], 0.3, P.wheels[2] - P.wheels[3] - 0.12);
  if (X.includes('pipes')) for (const s of [-1, 1]) K.part(d => new THREE.CylinderGeometry(0.06, 0.06, 1.1, d ? 16 : 8).rotateX(Math.PI / 2), C.CHROME, s * (W / 2 + 0.04), base + 0.2, -0.2, [0.12, 0.12, 1.1]);
  if (X.includes('helmet')) K.part(sphG(0.19), def.accent, -0.36, deck + 0.27, mid - 0.15, [0.38, 0.38, 0.38]);
  const [x, zf, zr, r, wd] = P.wheels;
  return { bumper, wing, struts, heads, tails, cabin, soft: P.knobbly ? 1.8 : 1, ...K.wheels([[x, zf, r, wd], [-x, zf, r, wd], [x, zr, r, wd], [-x, zr, r, wd]], { knobbly: !!P.knobbly }) };
}
