import * as THREE from 'three';
import { G } from '../game.js';
import { missilePos, roadPos, WPN } from '../core/features/weapons.js';
import { emit } from './effects/particles.js';
import { debris } from './effects/debris.js';
import { shockwave } from './effects/rings.js';
import { canvasTex } from './geometry.js';
import { scene } from './renderer.js';
import { race } from '../ui/flow.js';

// Weapons visuals (core/features/weapons.js): weapon crates on the road, missiles in flight, tracer rounds, oil
// slicks, the harpoon and its line, blasts and puffs. The weapon mounts that rise out of the cars' roofs are
// makeMount / updateMount, driven from render/vehicles.js.
const L = c => new THREE.MeshLambertMaterial({ color: c }), B = c => new THREE.MeshBasicMaterial({ color: c });
const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); return b; };
const cyl = (r, l, m, x = 0, y = 0, z = 0) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 10).rotateX(Math.PI / 2), m); c.position.set(x, y, z); return c; };
let missiles = [], crates = [], slickPool = [], hookPool = [], tracers = null, tracerMat = null;
const MAXB = 80, _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);
export function initWeaponVis() {
  const white = L(0xF2F2EE), red = L(0xD8203A), flame = B(0xFFB03A);
  missiles = [];
  for (let k = 0; k < 16; k++) {
    const g = new THREE.Group();
    g.add(cyl(0.16, 1.3, white)); const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 8).rotateX(Math.PI / 2), red); nose.position.z = 0.85; g.add(nose);
    for (let f = 0; f < 4; f++) { const fin = box(0.03, 0.34, 0.3, red, 0, 0, -0.55); fin.rotation.z = f * Math.PI / 2; fin.translateY(0.2); g.add(fin); }
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.7, 8).rotateX(-Math.PI / 2), flame); fl.position.z = -1.0; g.add(fl);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), new THREE.MeshBasicMaterial({ color: 0xFFE7A8, transparent: true, opacity: 0.8 })); glow.position.z = -0.95; g.add(glow);
    g.scale.setScalar(1.8); g.visible = false; scene.add(g); missiles.push({ g, fl, id: -1, last: null });
  }
  // crates: a wooden box with a yellow "?" on every side, floating and turning over a glowing ring
  const q = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#8A5A2B'; g.fillRect(0, 0, w, h); g.strokeStyle = '#5E3C1C'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6); g.fillStyle = '#FFC72C'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', w / 2, h / 2 + 2); });
  const cm = new THREE.MeshLambertMaterial({ map: q, emissive: 0x5A3E14 }), ring = new THREE.MeshBasicMaterial({ color: 0xFFC72C, transparent: true, opacity: 0.45, depthWrite: false });
  crates = [];
  for (let k = 0; k < 40; k++) {
    const g = new THREE.Group(), b = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), cm); b.castShadow = true; g.add(b);
    const r = new THREE.Mesh(new THREE.RingGeometry(1.4, 2.0, 24).rotateX(-Math.PI / 2), ring); r.position.y = -1.3; g.add(r);
    g.visible = false; scene.add(g); crates.push({ g, b, r });
  }
  // tracer rounds: stretched glowing bars, all in one instanced mesh
  tracerMat = new THREE.MeshBasicMaterial({ color: 0xFFE27A });
  tracers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.12, 1.6), tracerMat, MAXB); tracers.count = 0; tracers.frustumCulled = false; scene.add(tracers);
  // oil slicks: a dark glossy splat with a rainbow sheen
  const oilTex = canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(20,18,24,0.95)'); gr.addColorStop(0.55, 'rgba(30,26,40,0.9)'); gr.addColorStop(0.7, 'rgba(90,60,140,0.6)'); gr.addColorStop(0.8, 'rgba(40,120,110,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); for (let a = 0; a < 20; a++) { const t = a / 20 * Math.PI * 2, rr = w / 2 * (0.8 + 0.2 * Math.sin(a * 2.7)); g.lineTo(w / 2 + Math.cos(t) * rr, h / 2 + Math.sin(t) * rr); } g.fill(); });
  slickPool = [];
  for (let k = 0; k < 24; k++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(WPN.OIL_R * 2.2, WPN.OIL_R * 2.2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: oilTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 })); m.renderOrder = 2; m.visible = false; scene.add(m); slickPool.push(m); }
  // harpoon: a steel spear with a barbed head, and its line back to the car that fired it
  hookPool = [];
  for (let k = 0; k < 8; k++) {
    const g = new THREE.Group(); g.add(cyl(0.07, 1.4, L(0x9AA3AD))); const head = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 6).rotateX(Math.PI / 2), L(0x3A3F46)); head.position.z = 0.9; g.add(head);
    for (const s of [-1, 1]) { const barb = box(0.05, 0.05, 0.4, L(0x3A3F46), s * 0.15, 0, 0.6); barb.rotation.y = -s * 0.6; g.add(barb); }
    g.scale.setScalar(1.6); g.visible = false; scene.add(g);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0x2A2A2A })); line.frustumCulled = false; line.visible = false; scene.add(line);
    hookPool.push({ g, line });
  }
}
function place(g, tr, s, lat, up, prev) {
  const p = roadPos(tr, s, lat, up), n = roadPos(tr, s + 1, lat, up);
  g.position.set(p.x, p.y, p.z); g.rotation.set(0, Math.atan2(n.x - p.x, n.z - p.z), 0); return p;
}
export function updateWeaponVis(dt, now) {
  const tr = G.world && G.world.tr, R = race, S = R && R.wpn, on = tr && G.state !== 'menu';
  for (const p of missiles) p.g.visible = false; for (const c of crates) c.g.visible = false; for (const m of slickPool) m.visible = false; for (const h of hookPool) { h.g.visible = false; h.line.visible = false; }
  if (tracers) tracers.count = 0;
  if (!on || !R) return;
  (R.missiles || []).forEach((m, k) => {
    const p = missiles[k % missiles.length], pos = missilePos(tr, m);
    const dx = p.id === m.id && p.last ? pos.x - p.last.x : tr.tx[pos.i], dz = p.id === m.id && p.last ? pos.z - p.last.z : tr.tz[pos.i];
    p.g.visible = true; p.g.position.set(pos.x, pos.y, pos.z); p.g.rotation.set(0, Math.atan2(dx, dz), 0);
    p.fl.scale.set(1, 1, 0.8 + 0.4 * Math.sin(now * 60 + k));
    if (G.state === 'racing' && p.id === m.id && p.last) for (let q = 0; q < 3; q++) emit(pos.x - Math.sin(p.g.rotation.y) * 2.2, pos.y, pos.z - Math.cos(p.g.rotation.y) * 2.2, (Math.random() - 0.5) * 1.5, 0.8 + Math.random(), (Math.random() - 0.5) * 1.5, 0.7 + Math.random() * 0.5, 0.7 + Math.random() * 0.5, q ? 0xC8C8C8 : 0xE6E6E6, -0.5);
    p.id = m.id; p.last = pos;
  });
  if (!S) return;
  S.crates.forEach((k, j) => { const c = crates[j % crates.length]; place(c.g, tr, k.s, k.lat, 1.3 + Math.sin(now * 2.5 + k.id) * 0.2); c.g.visible = true; c.b.rotation.set(now * 0.9 + k.id, now * 1.3, 0); c.r.material.opacity = 0.3 + 0.2 * Math.sin(now * 4 + k.id); });
  S.bullets.forEach((b, j) => {
    if (j >= MAXB) return;
    const p = roadPos(tr, b.s, b.lat, 1.0), n = roadPos(tr, b.s + 1, b.lat + b.dl / b.v, 1.0);
    _q.setFromAxisAngle(_y, Math.atan2(n.x - p.x, n.z - p.z)); _m.compose(_p.set(p.x, p.y, p.z), _q, _s.set(1, 1, 1)); tracers.setMatrixAt(j, _m); tracers.count = j + 1;
  });
  if (tracers.count) tracers.instanceMatrix.needsUpdate = true;
  S.slicks.forEach((o, j) => { const m = slickPool[j % slickPool.length], p = roadPos(tr, o.s, o.lat, 0.1); m.position.set(p.x, p.y, p.z); m.rotation.y = o.id; m.visible = true; const k = Math.min(1, o.t * 4) * (1 - (o.hits || 0) * 0.18); m.scale.setScalar(Math.max(0.3, k)); });
  S.hooks.forEach((h, j) => {
    const v = hookPool[j % hookPool.length], A = R.cars[h.from], T = h.to >= 0 ? R.cars[h.to] : null;
    const p = h.tow && T ? { x: T.dx ?? T.x, y: (T.dy ?? T.y) + 0.9, z: T.dz ?? T.z } : place(v.g, tr, h.s, h.lat, 1.0);
    if (h.tow && T) { v.g.position.set(p.x, p.y, p.z); v.g.rotation.set(0, T.yaw + Math.PI, 0); }
    v.g.visible = true; v.line.visible = true;
    const a = v.line.geometry.attributes.position; a.setXYZ(0, A.dx ?? A.x, (A.dy ?? A.y) + 1.3, A.dz ?? A.z); a.setXYZ(1, p.x, p.y, p.z); a.needsUpdate = true;
  });
}
/** A missile hitting a car: fireball, smoke, sparks and bits, a shock ring. */
export function missileBlast(e) {
  shockwave(e.x, e.y - 1, e.z, 7, 0xFF7A2E);
  for (let k = 0; k < 26; k++) { const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 7; emit(e.x, e.y, e.z, Math.cos(a) * s, 2 + Math.random() * 6, Math.sin(a) * s, 0.4 + Math.random() * 0.4, 1.2 + Math.random(), Math.random() < 0.5 ? 0xFFB03A : 0xFF5A1E, -2); }
  for (let k = 0; k < 16; k++) emit(e.x + (Math.random() - 0.5) * 2, e.y + Math.random(), e.z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 3, 2 + Math.random() * 3, (Math.random() - 0.5) * 3, 1.2 + Math.random() * 0.8, 1.6 + Math.random(), Math.random() < 0.5 ? 0x4A4A4A : 0x6E6E6E, -1.2);
  for (let k = 0; k < 8; k++) debris(e.x, e.y, e.z, (Math.random() - 0.5) * 12, 4 + Math.random() * 6, (Math.random() - 0.5) * 12, 0x2A2A2A, 0.2, 0.08, 0.3, 1.4);
}
export function missilePuff(e) { for (let k = 0; k < 10; k++) emit(e.x, e.y, e.z, (Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3, 0.8, 1.2, 0x9A9A9A, -0.8); }
export function pickupFx(e) { shockwave(e.x, e.y, e.z, 3.5, 0xFFC72C); for (let k = 0; k < 14; k++) emit(e.x, e.y + 1.2, e.z, (Math.random() - 0.5) * 6, 3 + Math.random() * 4, (Math.random() - 0.5) * 6, 0.5, 0.5, k % 2 ? 0xFFC72C : 0x8A5A2B, -3); }
export function pulseFx(c) { shockwave(c.x, c.y, c.z, WPN.PULSE_R, 0x6EC8FF); shockwave(c.x, c.y + 0.5, c.z, WPN.PULSE_R * 0.6, 0xCFEFFF); for (let k = 0; k < 30; k++) { const a = k / 30 * Math.PI * 2; emit(c.x, c.y + 0.8, c.z, Math.cos(a) * 16, 0.5, Math.sin(a) * 16, 0.4, 0.6, 0x9ADCFF, 0); } }
export function oilDropFx(c) { const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw); for (let k = 0; k < 10; k++) emit(c.x - fx * 2.2, c.y + 0.5, c.z - fz * 2.2, (Math.random() - 0.5) * 2, 1 + Math.random() * 2, (Math.random() - 0.5) * 2, 0.5, 0.4, 0x1A1820, -9); }
export function bulletHitFx(e) { for (let k = 0; k < 4; k++) emit(e.x, e.y, e.z, (Math.random() - 0.5) * 6, 1 + Math.random() * 3, (Math.random() - 0.5) * 6, 0.25, 0.25, 0xFFD27A, -4); }

// ---------- weapon mounts on the cars ----------
// Every car has a mount under its roof: when it's holding a weapon, that weapon's module rises out of the roof
// (missile pod, twin guns, oil drum, pulse coil, harpoon gun); firing kicks it back, and once the weapon is spent the
// mount sinks away again. Built the first time a car picks something up.
function module(item) {
  const g = new THREE.Group(), dark = L(0x2E333B), steel = L(0x9AA3AD), yel = L(0xFFC72C), red = L(0xD8203A);
  if (item === 'missile') { g.add(box(0.9, 0.34, 1.1, dark)); for (const s of [-1, 1]) { g.add(cyl(0.13, 1.2, steel, s * 0.22, 0.02, 0.1)); const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 8).rotateX(Math.PI / 2), red); tip.position.set(s * 0.22, 0.02, 0.8); g.add(tip); } g.rotation.x = -0.18; }
  else if (item === 'gun') { g.add(box(0.5, 0.3, 0.6, dark)); for (const s of [-1, 1]) g.add(cyl(0.07, 1.1, steel, s * 0.14, 0.05, 0.6)); const fl = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), new THREE.MeshBasicMaterial({ color: 0xFFE27A, transparent: true, opacity: 0.9 })); fl.position.z = 1.25; fl.visible = false; g.add(fl); g.userData.flash = fl; }
  else if (item === 'oil') { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.8, 12).rotateZ(Math.PI / 2), L(0x1C1C22)); g.add(d); g.add(box(0.82, 0.1, 0.72, yel)); g.add(cyl(0.07, 0.5, steel, 0, -0.1, -0.5)); g.position.z = -0.4; }
  else if (item === 'pulse') { const t = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.09, 8, 20).rotateX(Math.PI / 2), steel); g.add(t); const core = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8), new THREE.MeshBasicMaterial({ color: 0x6EC8FF })); core.position.y = 0.2; g.add(core); g.add(cyl(0.05, 0.5, steel, 0, 0.05, 0).rotateX(Math.PI / 2)); g.userData.core = core; }
  else if (item === 'harpoon') { g.add(box(0.36, 0.32, 0.5, dark)); g.add(cyl(0.12, 1.2, steel, 0, 0.06, 0.4)); const head = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.38, 6).rotateX(Math.PI / 2), L(0x3A3F46)); head.position.set(0, 0.06, 1.12); g.add(head); g.userData.head = head; }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
export function makeMount(v) {
  // roof height: the body's visible meshes, measured with the car put back at the origin
  const p0 = v.root.position.clone(), q0 = v.root.quaternion.clone(); v.root.position.set(0, 0, 0); v.root.quaternion.identity(); v.root.updateMatrixWorld(true);
  const bb = new THREE.Box3(), tmp = new THREE.Box3();
  v.body.traverse(o => { if (o.isMesh && o.visible && o.geometry && !o.material.transparent) { o.geometry.computeBoundingBox(); tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); bb.union(tmp); } });
  v.root.position.copy(p0); v.root.quaternion.copy(q0); v.root.updateMatrixWorld(true);
  const roof = bb.isEmpty() ? 1.2 : bb.max.y;
  const g = new THREE.Group(); g.position.y = roof - 0.05; v.body.add(g);
  const mods = {}; for (const it of ['missile', 'gun', 'oil', 'pulse', 'harpoon']) { const m = module(it); m.visible = false; g.add(m); mods[it] = m; }
  return { g, mods, up: 0, held: null, kick: 0 };
}
export function updateMount(c, v, dt, now) {
  const w = c.wpn, want = w.item || (w.gunT > 0 ? 'gun' : null);
  if (!want && !v.mount) return;
  if (!v.mount) v.mount = makeMount(v);
  const M = v.mount;
  if (want && want !== M.held) { if (M.held) M.mods[M.held].visible = false; M.held = want; M.up = 0; M.mods[want].visible = true; }
  M.up += ((want ? 1 : 0) - M.up) * Math.min(1, dt * (want ? 7 : 5));
  M.kick *= Math.exp(-dt * 9);
  const m = M.held && M.mods[M.held]; if (!m) return;
  m.visible = M.up > 0.03; m.position.y = (M.up - 1) * 0.6 + 0.1; m.scale.setScalar((0.3 + 0.7 * M.up) * 1.5);   // a size that reads from the race camera m.position.z = (M.held === 'oil' ? -0.4 : 0) - M.kick * 0.35;
  if (m.userData.flash) m.userData.flash.visible = w.gunT > 0 && Math.floor(now * 30) % 2 === 0;
  if (m.userData.core) m.userData.core.scale.setScalar(1 + 0.25 * Math.sin(now * 12));
  if (m.userData.head) m.userData.head.visible = !!w.item;
  if (!want && M.up < 0.03) M.held = null;
}
export function mountKick(v) { if (v && v.mount) v.mount.kick = 1; }
