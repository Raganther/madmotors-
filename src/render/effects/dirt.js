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
const GRAVEL = MUCK.gravel.col;
/** A new stage: gravel dust takes the colour of its own dirt (red on the mesa, pale on the dunes), lifted a little as
 *  dust is (render/world buildWorld). */
export function setMuck(stage) { const c = new THREE.Color(stage.colors.dirt || GRAVEL).lerp(new THREE.Color(0xD8CCB8), 0.3); MUCK.gravel.col = stage.colors.dirt ? c.getHex() : GRAVEL; }
let tex = null, heavy = null;
function dirtTex() {
  if (tex) return tex;
  tex = canvasTex(128, 128, (g, w, h) => {
    let s = 9; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 260; k++) {                                                 // heavier toward the bottom of each panel
      const y = h * Math.pow(r(), 0.55), x = r() * w, a = 0.25 + 0.7 * (y / h), rad = 1 + r() * 5 * (0.4 + y / h);
      g.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`; g.beginPath(); g.ellipse(x, y, rad * (1 + r()), rad, r() * 3, 0, Math.PI * 2); g.fill();
      if (r() < 0.25) g.fillRect(x, y, 1 + r() * 2, -8 - r() * 20);                // streaks flicked up the panel
    }
    // grime gathers first along the panel edges: the outer band for the faceted bodies, the band just inside it for the
    // rounded close-up ones (their faces use the middle 0.12-0.88 of the picture; geometry.js roundBox)
    for (const [e0, e1] of [[0, 0.07], [0.12, 0.2]]) for (let k = 0; k < 700; k++) {
      const side = Math.floor(r() * 4), along = r() * w, depth = (e0 + (e1 - e0) * Math.pow(r(), 1.6)) * w;
      const [x, y] = side === 0 ? [along, depth] : side === 1 ? [along, h - depth] : side === 2 ? [depth, along] : [w - depth, along];
      g.fillStyle = `rgba(255,255,255,${(0.18 + r() * 0.3).toFixed(2)})`; g.fillRect(x, y, 1 + r() * 2.5, 1 + r() * 2.5);
    }
  });
  return tex;
}
// a heavy coat (an oil drum burst over the car, wet cement): big blobs and runs over most of the panel
function heavyTex() {
  if (heavy) return heavy;
  heavy = canvasTex(128, 128, (g, w, h) => {
    let s = 21; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 90; k++) { const x = r() * w, y = r() * h, rad = 6 + r() * 16; g.fillStyle = `rgba(255,255,255,${(0.7 + r() * 0.3).toFixed(2)})`; g.beginPath(); g.ellipse(x, y, rad * (1 + r() * 0.6), rad, r() * 3, 0, Math.PI * 2); g.fill(); }
    for (let k = 0; k < 40; k++) { const x = r() * w, y = r() * h * 0.6; g.fillRect(x, y, 2 + r() * 3, 10 + r() * 40); }   // runs down the panel
    for (let k = 0; k < 30; k++) { g.clearRect(r() * w, r() * h, 2 + r() * 5, 2 + r() * 5); }   // the odd clean fleck
  });
  return heavy;
}
/** Give a car's panels a dirt layer, and its wheels one of their own: tyres and hubs muck up first and darkest. */
export function addDirt(v, panels, wheels = []) {
  const mk = () => new THREE.MeshLambertMaterial({ map: dirtTex(), color: 0xB49A74, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  const mat = mk(), wmat = mk(); mat.visible = wmat.visible = false;   // not drawn at all while the car is clean
  for (const m of panels) { const o = new THREE.Mesh(m.geometry, mat); o.renderOrder = 1; m.add(o); }
  for (const w of wheels) w.traverse(m => { if (m.isMesh && !m.userData.dirt) { const o = new THREE.Mesh(m.geometry, wmat); o.userData.dirt = true; o.renderOrder = 1; o.scale.setScalar(1.01); m.add(o); } });
  v.dirt = { amt: 0, mat, wmat, col: new THREE.Color(0xB49A74), tmp: new THREE.Color() };
}
/** Something thrown over the car (an oil slick, a drum bursting on it, wet cement, soot): the body takes that colour,
 *  at least `amt` of it, then it wears off over `wear` s (it runs off, the wind and the road take it) back to the
 *  muck that was under it. The muck keeps building up underneath meanwhile. */
export function coat(v, hex, amt, wear = 9) {
  const D = v && v.dirt; if (!D) return;
  if (!D.under) D.under = { col: D.col.clone(), amt: D.amt };
  D.coat = { col: new THREE.Color(hex), amt: Math.min(1, Math.max(D.coat ? D.coat.amt * D.coatK : 0, D.under.amt, amt)), t: 0, T: wear };
  if (amt > 0.6) texOf(D, heavyTex());
  wearCoat(D, 0);
}
// the coat stays full for the first third of its time, then fades to the muck under it
function wearCoat(D, dt) {
  const C = D.coat; C.t += dt;
  const k = D.coatK = 1 - Math.min(1, Math.max(0, (C.t - C.T / 3) / (C.T * 2 / 3)));
  D.col.copy(D.under.col).lerp(C.col, k); D.amt = D.under.amt + (C.amt - D.under.amt) * k;
  if (k <= 0) { D.coat = D.under = null; if (D.amt < 0.6) texOf(D, dirtTex()); }
  show(D);
}
/** A soaking (the water cannon): it rinses most of the muck off, and any coat with it. */
export function rinse(v, k = 0.4) { const D = v && v.dirt; if (!D) return; if (D.coat) { D.col.copy(D.under.col); D.amt = D.under.amt; D.coat = D.under = null; } D.amt *= k; if (D.amt < 0.3) texOf(D, dirtTex()); show(D); }
const texOf = (D, t) => { if (D.mat.map === t) return; D.mat.map = t; D.wmat.map = t; D.mat.needsUpdate = D.wmat.needsUpdate = true; };
export function resetDirt(v) { if (v.dirt) { texOf(v.dirt, dirtTex()); v.dirt.coat = v.dirt.under = null; v.dirt.amt = 0; v.dirt.mat.opacity = 0; v.dirt.wmat.opacity = 0; v.dirt.mat.visible = v.dirt.wmat.visible = false; } }
// the body shows the muck at its level; the wheels, which sit in it, at three times that, caked paler than the rubber
function show(D) { D.mat.color.copy(D.col); D.mat.opacity = Math.min(0.95, D.amt * 1.3); D.wmat.color.copy(D.col).multiplyScalar(1.45); D.wmat.opacity = Math.min(0.97, D.amt * 3); D.mat.visible = D.mat.opacity > 0.01; D.wmat.visible = D.wmat.opacity > 0.01; }   /* caked mud dries paler than the tyre under it */
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
  const M0 = D.under || D;                                                         // under a coat, the muck builds up beneath it
  if (inSpray(c)) { M0.amt = Math.min(1, M0.amt + 0.35 * dt); M0.col.lerp(D.tmp.setHex(MUCK.mud.col), Math.min(1, dt * 2)); }
  if (c.onGround) {
    const M = MUCK[fxSurf(c)] || MUCK.tarmac, sp = Math.hypot(c.vx, c.vz);
    if (sp >= 2) {
      const add = M.rate * dt * Math.min(1.5, sp / 20);
      if (add > 0 && M.col !== null) M0.col.lerp(D.tmp.setHex(M.col), Math.min(1, add / (M0.amt + add) * 1.5));
      if (c.surface === 'ford') M0.amt = Math.max(Math.min(M0.amt, 0.35), M0.amt + add);   // the splash rinses off the worst of it
      else M0.amt = Math.min(1, Math.max(0, M0.amt + add));
    }
  }
  if (D.coat) wearCoat(D, c.surface === 'ford' ? dt * 4 : dt);                     // a splash washes a coat off fast
  else show(D);
}
