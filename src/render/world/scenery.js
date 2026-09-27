import * as THREE from 'three';
import { G } from '../../game.js';
import { HALF, WALL } from '../../core/constants.js';
import { TAU, mulberry32 } from '../../core/math.js';
import { _c, _e, _m, _p, _q, _s, addInstanced, flat, merge } from '../geometry.js';
import { withCutaway } from '../materials.js';

export function addScenery(group, tr, terr, stage) {
  const rnd = mulberry32(stage.seed * 7 + 3), C = stage.colors;
  const pick = a => a[Math.floor(rnd() * a.length)];
  // anything standing high above a nearby road throws its shadow across the road: keep it back from the edge
  const overhangs = (x, z, q) => { if (!q) return false; const up = terr.at(x, z) - tr.H[q.i]; return up > 4 && q.d < 12 + up * 0.75; };
  const slopeAt = (x, z) => Math.hypot(terr.at(x + 1.5, z) - terr.at(x - 1.5, z), terr.at(x, z + 1.5) - terr.at(x, z - 1.5)) / 3;
  const x0 = Math.min(-195, tr.minX - 90), x1 = Math.max(195, tr.maxX + 90), z0 = tr.minZ - 80, z1 = tr.maxZ + 110, area = (x1 - x0) * (z1 - z0);
  const trunks = [], pines = [], rounds = [], rocks = [], bushes = [], houseW = [], houseR = [];
  const nT = Math.round(area * stage.trees.density);
  for (let k = 0; k < nT; k++) {
    const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0), q = tr.nearest(x, z);
    if (q && q.d < HALF + 11) continue; if (slopeAt(x, z) > 0.8 || overhangs(x, z, q)) continue; if (tr.town && q && tr.town[tr.bi(q.i)] && q.d < 32) continue; if (tr.falls && tr.falls.some(f => Math.hypot(x - tr.xs[f.i], z - tr.zs[f.i]) < 32)) continue; { const qt = tr.nearestTun(x, z); if (qt && qt.d < HALF + 16) continue; }
    const y = terr.at(x, z) - 0.2, s = 0.8 + rnd() * 0.7, ry = rnd() * TAU;
    trunks.push({ x, y, z, sx: s, sy: s, sz: s, color: 0x6B4A32 });
    const high = !!stage.alpine && y > stage.alpine.treeLine;
    if (high || rnd() < stage.trees.pine) pines.push({ x, y, z, sx: s, sy: s * (0.9 + rnd() * 0.4), sz: s, ry, color: pick(C.pine) });
    else rounds.push({ x, y, z, sx: s, sy: s * (0.85 + rnd() * 0.3), sz: s, ry, color: pick(C.round) });
  }
  // saguaro cacti (desert stages)
  const cacti = [];
  for (let k = 0, nC = Math.round(area * (stage.cacti || 0)); k < nC; k++) {
    const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0), q = tr.nearest(x, z);
    if (q && q.d < HALF + 8) continue; if (slopeAt(x, z) > 0.6 || overhangs(x, z, q)) continue;
    const s = 0.7 + rnd() * 0.6; _c.set(0x5F7F3C).offsetHSL((rnd() - 0.5) * 0.04, 0, (rnd() - 0.5) * 0.08);
    cacti.push({ x, y: terr.at(x, z) - 0.2, z, sx: s, sy: s * (0.85 + rnd() * 0.4), sz: s, ry: rnd() * TAU, color: _c.getHex() });
  }
  const nR = Math.round(area * stage.rocks);
  for (let k = 0; k < nR; k++) {
    const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0), q = tr.nearest(x, z); if (q && q.d < HALF + 5) continue;
    if (overhangs(x, z, q)) continue;
    const s = 0.8 + rnd() * 2.2; _c.set(C.rock).offsetHSL(0, 0, (rnd() - 0.5) * 0.12);
    rocks.push({ x, y: terr.at(x, z) - 0.2 * s, z, sx: s * (0.8 + rnd() * 0.6), sy: s * (0.5 + rnd() * 0.5), sz: s * (0.8 + rnd() * 0.6), ry: rnd() * TAU, rx: rnd() * 0.4, color: _c.getHex() });
  }
  const nB = Math.round(area * stage.bushes);
  for (let k = 0; k < nB; k++) {
    const x = x0 + rnd() * (x1 - x0), z = z0 + rnd() * (z1 - z0), q = tr.nearest(x, z); if (q && q.d < HALF + 4) continue; if (overhangs(x, z, q)) continue;
    if (stage.alpine && terr.at(x, z) > stage.alpine.treeLine) continue;
    const s = 0.6 + rnd() * 0.8; bushes.push({ x, y: terr.at(x, z) + 0.2 * s, z, sx: s, sy: s * 0.7, sz: s, ry: rnd() * TAU, color: pick(C.round) });
  }
  const tryHouse = (i, side, latMin, latVar) => {
    if (tr.loopN) i = (i % tr.loopN + tr.loopN) % tr.loopN;
    const lat = side * (latMin + rnd() * latVar), x = tr.xs[i] + tr.rx[i] * lat, z = tr.zs[i] + tr.rz[i] * lat, q = tr.nearest(x, z);
    if (!q || q.d < HALF + 9 || slopeAt(x, z) > 0.55) return;
    const w = 4 + rnd() * 2.5, d = 3.6 + rnd() * 1.6, h = 2.8 + rnd() * 1.6, rh = 1.8 + rnd() * 0.8, y = terr.at(x, z) - 0.4, ry = tr.th[i];
    houseW.push({ x, y, z, sx: w, sy: h + 0.4, sz: d, ry, color: pick([0xF3EBDD, 0xFFFFFF, 0xEADBC4, 0xDCE6EA, 0xF2D9C4]) });
    houseR.push({ x, y: y + h + 0.4, z, sx: w * 1.12, sy: rh, sz: d * 1.12, ry, color: pick([0xB5523B, 0xA3452F, 0x4B5563, 0x8C3B2E]) });
  };
  const vStart = stage.village ? Math.floor(tr.N * 0.45) : tr.loopN ? tr.startIdx - 110 : tr.finishIdx - 90;
  const vEnd = tr.loopN ? tr.startIdx + 60 : tr.N - 2;
  if (!tr.town) for (let i = vStart; i < vEnd; i += stage.village ? 12 : 9) for (const side of [-1, 1]) if (rnd() < 0.75) tryHouse(i, side, HALF + 12, 9);
  // spectators at hairpins and the start/finish
  const bodies = [], heads = [], arms = [], fans = [];
  const addFan = (x, z, face) => {
    const y = terr.at(x, z), col = pick([0xE0402F, 0x2F7DE0, 0xFFC72C, 0xFFFFFF, 0x2FB36B, 0x1C2340, 0xF28C28]);
    // how they pass the time: 0 bounce and cheer, 1 wave one arm, 2 shift about with their hands down
    const f = { x, y, z, ry: face, ph: rnd() * TAU, mode: Math.floor(rnd() * 3), sp: 0.8 + rnd() * 0.5, dive: -1, dx: 0, dz: 0 };
    fans.push(f);
    bodies.push({ x, y: y + 0.6, z, ry: face, color: col, f, part: 0 });
    heads.push({ x, y: y + 1.45, z, ry: face, color: pick([0xF1C9A5, 0xD9A47F, 0x9C6B4E, 0x6B4631]), f, part: 1 });
    for (const s of [-1, 1]) arms.push({ x, y: y + 1.1, z, ry: face, color: col, f, part: s < 0 ? 2 : 3 });
  };
  for (const hp of tr.hairpins) for (let i = hp.a; i <= hp.b; i += 3) {
    if (rnd() < 0.45) continue;
    const lat = hp.side * (WALL + 2.5 + rnd() * 3.5), x = tr.xs[i] + tr.rx[i] * lat, z = tr.zs[i] + tr.rz[i] * lat, q = tr.nearest(x, z);
    if (q && q.d < HALF + 3.5) continue; addFan(x, z, Math.atan2(tr.xs[i] - x, tr.zs[i] - z));
  }
  for (const li of (tr.loopN ? [tr.startIdx] : [tr.startIdx, tr.finishIdx])) for (let i0 = li - 22; i0 < li + 20; i0 += 2) for (const side of [-1, 1]) {
    const i = tr.loopN ? (i0 % tr.loopN + tr.loopN) % tr.loopN : i0;
    if (rnd() < 0.4) continue; const lat = side * (tr.town ? WALL + 0.8 + rnd() * 1.2 : WALL + 2 + rnd() * 3), x = tr.xs[i] + tr.rx[i] * lat, z = tr.zs[i] + tr.rz[i] * lat;
    addFan(x, z, Math.atan2(tr.xs[i] - x, tr.zs[i] - z));
  }
  const L = (o) => withCutaway(new THREE.MeshLambertMaterial({ color: 0xffffff }), false, Object.assign({ cloud: true }, o));
  addInstanced(group, flat(new THREE.CylinderGeometry(0.2, 0.28, 1.6, 5).translate(0, 0.8, 0)), L(), trunks, { cast: true });
  addInstanced(group, merge([flat(new THREE.ConeGeometry(1.7, 3.2, 7).translate(0, 2.6, 0)), flat(new THREE.ConeGeometry(1.2, 2.4, 7).translate(0, 4.2, 0))]), L({ sway: 1 }), pines, { cast: true });
  if (stage.surface === 'snow') {                                                    // snow stages: snow lying on the pines' upper slopes
    const cap = merge([flat(new THREE.ConeGeometry(0.8, 1.5, 7).translate(0, 4.66, 0)), flat(new THREE.CylinderGeometry(0.68, 1.12, 0.8, 7).translate(0, 2.6, 0))]);
    addInstanced(group, cap, L({ sway: 1 }), pines.map(p => ({ ...p, color: 0xF2F6FA })));
  }
  addInstanced(group, flat(new THREE.IcosahedronGeometry(1.7, 0).translate(0, 3.1, 0)), L({ sway: 1 }), rounds, { cast: true });
  if (cacti.length) {
    const cyl = (r, h) => new THREE.CylinderGeometry(r, r, h, 6);
    addInstanced(group, merge([flat(cyl(0.34, 3.6).translate(0, 1.8, 0)), flat(cyl(0.22, 0.9).rotateZ(Math.PI / 2).translate(0.55, 1.5, 0)), flat(cyl(0.22, 1.2).translate(0.95, 2.0, 0)),
      flat(cyl(0.2, 0.7).rotateZ(Math.PI / 2).translate(-0.45, 2.1, 0)), flat(cyl(0.2, 1.0).translate(-0.75, 2.55, 0))]), L({ sway: 0.3 }), cacti, { cast: true });
  }
  addInstanced(group, flat(new THREE.DodecahedronGeometry(1, 0)), L(), rocks, { cast: true, receive: true });
  addInstanced(group, flat(new THREE.IcosahedronGeometry(1, 0)), L({ sway: 2.2 }), bushes, { cast: true });
  addInstanced(group, flat(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), L(), houseW, { cast: true, receive: true });
  addInstanced(group, flat(new THREE.ConeGeometry(0.7071, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0)), L(), houseR, { cast: true });
  G.fans = fans;
  return addInstanced(group, flat(new THREE.BoxGeometry(0.62, 1.2, 0.42)), L(), bodies, { cast: true })
    .concat(addInstanced(group, flat(new THREE.BoxGeometry(0.42, 0.42, 0.42)), L(), heads, {}))
    .concat(addInstanced(group, flat(new THREE.BoxGeometry(0.16, 0.66, 0.16).translate(0, -0.3, 0)), L(), arms, {}));   // hung from the shoulder
}
G.fanChunks = []; G.fans = [];
// Spectators: each one idles in its own way, and dives clear when a car is about to reach it (heading its way, under
// ~0.8 s out), then picks itself up and walks back. Drawn only: the simulation never sees them.
const DIVE = { OUT: 0.42, DOWN: 1.9, UP: 2.7, BACK: 4.6 }, _mf = new THREE.Matrix4(), _ml = new THREE.Matrix4(), _qa = new THREE.Quaternion(), _ax = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const ease = t => t * t * (3 - 2 * t);
function threatened(f, cars) {
  for (const c of cars) {
    const sp2 = c.vx * c.vx + c.vz * c.vz; if (sp2 < 36) continue;
    const rx = f.x - c.x, rz = f.z - c.z, tc = (rx * c.vx + rz * c.vz) / sp2; if (tc < 0 || tc > 0.8) continue;
    const px = rx - c.vx * tc, pz = rz - c.vz * tc, d = Math.hypot(px, pz); if (d > 3.2) continue;
    const l = d > 0.3 ? d : 1; f.dx = d > 0.3 ? px / l : c.vz / Math.sqrt(sp2); f.dz = d > 0.3 ? pz / l : -c.vx / Math.sqrt(sp2);   // away from its path
    return true;
  }
  return false;
}
export function updateFans(now, dt = 1 / 60, cars = []) {
  for (const f of G.fans) {
    if (f.dive < 0) { if (cars.length && threatened(f, cars)) f.dive = 0; } else if ((f.dive += dt) > DIVE.BACK) f.dive = -1;
    let off = 0, lift = 0, tip = 0, armUp = 0, armSwing = 0, bob = 0;
    if (f.dive >= 0) {
      const t = f.dive;
      if (t < DIVE.OUT) { const k = t / DIVE.OUT; off = 2.4 * ease(k); lift = Math.sin(k * Math.PI) * 0.7; tip = 1.4 * ease(k); armUp = 2.9; }
      else if (t < DIVE.DOWN) { off = 2.4; tip = 1.4; armUp = 2.9; }
      else if (t < DIVE.UP) { const k = (t - DIVE.DOWN) / (DIVE.UP - DIVE.DOWN); off = 2.4; tip = 1.4 * (1 - ease(k)); armUp = 2.9 * (1 - k); }
      else { const k = (t - DIVE.UP) / (DIVE.BACK - DIVE.UP); off = 2.4 * (1 - ease(k)); bob = Math.abs(Math.sin(t * 9)) * 0.06; armSwing = Math.sin(t * 9) * 0.5; }
    } else {
      const w = now * 7 * f.sp + f.ph;
      if (f.mode === 0) { bob = Math.max(0, Math.sin(w)) * 0.22; armUp = 2.6 + Math.sin(w) * 0.3; }
      else if (f.mode === 1) { bob = Math.max(0, Math.sin(w * 0.5)) * 0.05; armUp = -1; armSwing = Math.sin(w * 0.9) * 0.5; }
      else { bob = Math.abs(Math.sin(w * 0.3)) * 0.04; armSwing = Math.sin(w * 0.35) * 0.15; }
    }
    // the fan's frame: standing at its spot facing the road, thrown `off` metres along (dx, dz), tipped over that way
    _p.set(f.x + f.dx * off, f.y + lift + bob, f.z + f.dz * off); _e.set(0, f.ry, 0); _q.setFromEuler(_e);
    if (tip) { _ax.set(f.dz, 0, -f.dx); _qa.setFromAxisAngle(_ax, tip); _q.premultiply(_qa); }
    f.m = (f.m || new THREE.Matrix4()).compose(_p, _q, _s.set(1, 1, 1)); f.armUp = armUp; f.armSwing = armSwing;
  }
  for (const { mesh, list } of G.fanChunks) {
    for (let j = 0; j < list.length; j++) {
      const it = list[j], f = it.f; if (!f.m) continue;
      if (it.part === 0) _ml.makeTranslation(0, 0.6, 0);
      else if (it.part === 1) _ml.makeTranslation(0, 1.45, 0);
      else {
        const s = it.part === 2 ? -1 : 1, up = f.armUp < 0 ? (s > 0 ? 2.7 : 0) : f.armUp;   // mode 1 waves the right arm only
        _e.set(f.armSwing * s, 0, s * (up + (f.armUp < 0 && s > 0 ? Math.sin(now * 8 + f.ph) * 0.35 : 0)));
        _ml.makeRotationFromEuler(_e).setPosition(s * 0.4, 1.12, 0);
      }
      mesh.setMatrixAt(j, _mf.multiplyMatrices(f.m, _ml));
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
}
