import * as THREE from 'three';
import { canvasTex } from '../geometry.js';
import { race } from '../../ui/flow.js';
import { fxSurf } from './carfx.js';

// Dirty cars: every racer's body panels carry a see-through layer of splatter (sharing the panel's geometry, so it
// dents with it). It builds up from what the wheels are on: slowly on gravel and grass, fast in mud; a water splash
// rinses the worst of it off, and following a car through a bog gets you sprayed. Its colour drifts toward the
// latest muck: pale dust, green-brown, dark mud, or snow.
const MUCK = { gravel: { rate: 0.025, col: 0xB49A74 }, grass: { rate: 0.012, col: 0x6E6A3A }, mud: { rate: 0.4, col: 0x4A3322 }, ford: { rate: -0.3, col: 0x5A4632 }, tarmac: { rate: -0.004, col: null },
  snow: { rate: 0.02, col: 0xEEF3F8 }, powder: { rate: 0.05, col: 0xFFFFFF }, ice: { rate: -0.002, col: null } };   // snow: a crust of white builds up instead
let tex = null;
function dirtTex() {
  if (tex) return tex;
  tex = canvasTex(128, 128, (g, w, h) => {
    let s = 9; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 260; k++) {                                                 // heavier toward the bottom of each panel
      const y = h * Math.pow(r(), 0.55), x = r() * w, a = 0.25 + 0.7 * (y / h), rad = 1 + r() * 5 * (0.4 + y / h);
      g.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`; g.beginPath(); g.ellipse(x, y, rad * (1 + r()), rad, r() * 3, 0, Math.PI * 2); g.fill();
      if (r() < 0.25) g.fillRect(x, y, 1 + r() * 2, -8 - r() * 20);                // streaks flicked up the panel
    }
  });
  return tex;
}
/** Give a car's panels a dirt layer. */
export function addDirt(v, panels) {
  const mat = new THREE.MeshLambertMaterial({ map: dirtTex(), color: 0xB49A74, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  for (const m of panels) { const o = new THREE.Mesh(m.geometry, mat); o.renderOrder = 1; m.add(o); }
  v.dirt = { amt: 0, mat, col: new THREE.Color(0xB49A74), tmp: new THREE.Color() };
}
export function resetDirt(v) { if (v.dirt) { v.dirt.amt = 0; v.dirt.mat.opacity = 0; } }
// following a car through a bog: its rooster tail lands on you
function inSpray(c) {
  if (!race) return false;
  for (const o of race.cars) {
    if (o === c || o.surface !== 'mud' || !o.onGround || Math.hypot(o.vx, o.vz) < 8) continue;
    const dx = c.x - o.x, dz = c.z - o.z, fx = Math.sin(o.yaw), fz = Math.cos(o.yaw), behind = -(dx * fx + dz * fz), side = Math.abs(dx * fz - dz * fx);
    if (behind > 2 && behind < 14 && side < 2.6) return true;
  }
  return false;
}
export function updateDirt(c, v, dt) {
  const D = v.dirt; if (!D) return;
  if (inSpray(c)) { D.amt = Math.min(1, D.amt + 0.35 * dt); D.col.lerp(D.tmp.setHex(MUCK.mud.col), Math.min(1, dt * 2)); D.mat.color.copy(D.col); D.mat.opacity = Math.min(0.95, D.amt * 1.3); }
  if (!c.onGround) return;
  const M = MUCK[fxSurf(c)] || MUCK.tarmac, sp = Math.hypot(c.vx, c.vz); if (sp < 2) return;
  const add = M.rate * dt * Math.min(1.5, sp / 20);
  if (add > 0 && M.col !== null) D.col.lerp(D.tmp.setHex(M.col), Math.min(1, add / (D.amt + add) * 1.5));
  if (c.surface === 'ford') D.amt = Math.max(Math.min(D.amt, 0.35), D.amt + add);   // the splash rinses off the worst of it
  else D.amt = Math.min(1, Math.max(0, D.amt + add));
  D.mat.color.copy(D.col); D.mat.opacity = Math.min(0.95, D.amt * 1.3);
}
