import * as THREE from 'three';
import { G } from '../../game.js';
import { HALF, WALL } from '../../core/constants.js';
import { TAU, mulberry32 } from '../../core/math.js';
import { _c, _e, _m, _p, _q, _s, addInstanced, flat } from '../geometry.js';
import { withCutaway } from '../materials.js';
import * as SH from './shapes.js';
import { debris } from '../effects/debris.js';

export function addScenery(group, tr, terr, stage) {
  const rnd = mulberry32(stage.seed * 7 + 11), C = stage.colors;
  const pick = a => a[Math.floor(rnd() * a.length)];
  const slopeAt = (x, z) => Math.hypot(terr.at(x + 1.5, z) - terr.at(x - 1.5, z), terr.at(x, z + 1.5) - terr.at(x, z - 1.5)) / 3;
  const houseW = [], houseR = [];
  // trees, cacti, rocks and bushes are placed by the core (track/obstacles.js) because cars can hit them; k = its index
  const trunks = [], pines = [], rounds = [], rocks = [[], [], []], bushes = [], cacti = [], OB = terr.obst ? terr.obst.items : [];
  OB.forEach((o, k) => {
    const base = { k, x: o.x, y: o.y, z: o.z, ry: o.ry };
    if (o.kind === 0 || o.kind === 1) trunks.push({ ...base, sx: o.s, sy: o.s, sz: o.s, color: 0x6B4A32 });
    if (o.kind === 0) pines.push({ ...base, sx: o.s, sy: o.sy, sz: o.s, color: o.color });
    else if (o.kind === 1) rounds.push({ ...base, sx: o.s, sy: o.sy, sz: o.s, color: o.color });
    else if (o.kind === 2) { _c.set(0x5F7F3C).offsetHSL(o.dh, 0, o.dl); cacti.push({ ...base, sx: o.s, sy: o.sy, sz: o.s, color: _c.getHex() }); }
    else if (o.kind === 3) { _c.set(C.rock).offsetHSL(0, 0, o.dl); rocks[o.shape].push({ ...base, sx: o.sx, sy: o.sy, sz: o.sz, rx: o.rx, color: _c.getHex() }); }
    else bushes.push({ ...base, sx: o.s, sy: o.sy, sz: o.s, color: o.color });
  });
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
  // the natural scenery: low-poly still, but with enough facets and baked shading (darker underneath and inside, lighter
  // on top) that it reads as rounded forms rather than a handful of flat faces; render/world/shapes.js builds them
  const LV = o => withCutaway(new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true }), false, Object.assign({ cloud: true }, o));
  const snowy = stage.surface === 'snow', mossy = !stage.cacti && !snowy, S = G.sceneryParts = new Map();
  const add = (geo, mat, list, opts) => { for (const ch of addInstanced(group, geo, mat, list, opts)) ch.list.forEach((it, j) => { if (it.k === undefined) return; let a = S.get(it.k); if (!a) S.set(it.k, a = []); a.push({ mesh: ch.mesh, j, it }); }); };
  add(SH.trunk(), LV(), trunks, { cast: true });
  add(SH.pine(), LV({ sway: 1 }), pines, { cast: true });
  if (snowy) add(SH.pineSnow(), LV({ sway: 1 }), pines.map(p => ({ ...p, color: 0xF2F6FA })));   // snow lying on the pines' tiers
  add(SH.round(), LV({ sway: 1 }), rounds, { cast: true });
  if (cacti.length) add(SH.cactus(), LV({ sway: 0.3 }), cacti, { cast: true });
  rocks.forEach((list, n) => { if (list.length) add(SH.rock(n, mossy ? C.grassB : null), LV(), list, { cast: true, receive: true }); });
  add(SH.bush(), LV({ sway: 2.2 }), bushes, {});   // too low to throw a shadow worth drawing
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
// Scenery that was hit (sim/obstacles.js events): a tree rocks away from the blow and settles, shedding leaves; a bush
// is flattened and springs back up. Each instance's matrix is rebuilt from its placement with the lean added.
const moving = new Map(), _ax2 = new THREE.Vector3(), _qt = new THREE.Quaternion();
export function sceneryHit(e, hint = 0) {
  const parts = G.sceneryParts && G.sceneryParts.get(e.k); if (!parts) return;
  const it = parts[0].it, m = moving.get(e.k) || { t: 0, amp: 0, nx: 0, nz: 0, bush: e.t === 'bush' };
  if (m.bush) { m.t = 0; m.amp = 1; } else { m.amp = Math.min(0.32, m.amp * 0.5 + e.v * 0.014); m.t = 0; m.nx = e.nx; m.nz = e.nz; }
  moving.set(e.k, m);
  const n = m.bush ? 6 : Math.round(4 + e.v * 0.6), top = it.y + (m.bush ? 0.8 : 3.4) * (it.sy || 1);
  for (let q = 0; q < n; q++) debris(it.x + (Math.random() - 0.5) * 2, top + Math.random(), it.z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 3, 0.5 + Math.random() * 2, (Math.random() - 0.5) * 3, it.color, 0.16, 0.03, 0.12, 2 + Math.random() * 1.5, hint);
}
export function updateScenery(dt) {
  for (const [k, m] of moving) {
    m.t += dt;
    const done = m.bush ? m.t > 2.5 : m.t > 3; if (done) moving.delete(k);
    for (const { mesh, j, it } of G.sceneryParts.get(k)) {
      _e.set(it.rx || 0, it.ry || 0, it.rz || 0); _q.setFromEuler(_e); _s.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1); _p.set(it.x, it.y, it.z);
      if (done) { /* back as placed */ } else if (m.bush) _s.y *= 0.3 + 0.7 * Math.min(1, m.t / 2.5) ** 2;   // squashed flat, springing back
      else { _ax2.set(m.nz, 0, -m.nx); _qt.setFromAxisAngle(_ax2, m.amp * Math.exp(-2.2 * m.t) * Math.cos(m.t * 11)); _q.premultiply(_qt); }
      mesh.setMatrixAt(j, _m.compose(_p, _q, _s)); mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
export function clearSceneryHits() { moving.clear(); }
