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
    if (q && q.d < HALF + 11) continue; if (slopeAt(x, z) > 0.8 || overhangs(x, z, q)) continue; if (tr.town && q && tr.town[q.i % tr.loopN] && q.d < 32) continue; { const qt = tr.nearestTun(x, z); if (qt && qt.d < HALF + 16) continue; }
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
  const bodies = [], heads = [];
  const addFan = (x, z, face) => {
    const y = terr.at(x, z); const col = pick([0xE0402F, 0x2F7DE0, 0xFFC72C, 0xFFFFFF, 0x2FB36B, 0x1C2340, 0xF28C28]);
    const ph = rnd() * TAU;
    bodies.push({ x, y: y + 0.6, z, ry: face, color: col, by: y + 0.6, ph });
    heads.push({ x, y: y + 1.45, z, ry: face, color: pick([0xF1C9A5, 0xD9A47F, 0x9C6B4E, 0x6B4631]), by: y + 1.45, ph });
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
  const fans = addInstanced(group, flat(new THREE.BoxGeometry(0.62, 1.2, 0.42)), L(), bodies, { cast: true })
    .concat(addInstanced(group, flat(new THREE.BoxGeometry(0.42, 0.42, 0.42)), L(), heads, {}));
  return fans;
}
G.fanChunks = [];
export function updateFans(now) {
  for (const { mesh, list } of G.fanChunks) {
    for (let j = 0; j < list.length; j++) { const it = list[j]; const b = Math.max(0, Math.sin(now * 7 + it.ph)) * 0.22; _e.set(0, it.ry, 0); _q.setFromEuler(_e); _p.set(it.x, it.by + b, it.z); _s.set(1, 1, 1); _m.compose(_p, _q, _s); mesh.setMatrixAt(j, _m); }
    mesh.instanceMatrix.needsUpdate = true;
  }
}
