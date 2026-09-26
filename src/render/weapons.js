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
let missiles = [], crates = [], slickPool = [], hookPool = [], tracers = null, tracerMat = null, flashes = [], smokes = [], domes = [], streaks = [], targetRing = null, fi = 0, si = 0, di = 0;
const MAXB = 80, _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);
export function initWeaponVis() {
  const white = L(0xF2F2EE), red = L(0xD8203A), flame = B(0xFFB03A);
  missiles = [];
  for (let k = 0; k < 16; k++) {
    const g = new THREE.Group();
    g.add(cyl(0.16, 1.3, white)); const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 8).rotateX(Math.PI / 2), red); nose.position.z = 0.85; g.add(nose);
    for (let f = 0; f < 4; f++) { const fin = box(0.03, 0.34, 0.3, red, 0, 0, -0.55); fin.rotation.z = f * Math.PI / 2; fin.translateY(0.2); g.add(fin); }
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.7, 8).rotateX(-Math.PI / 2), flame); fl.position.z = -1.0; g.add(fl);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xFFB45A, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); glow.scale.set(1.6, 1.6, 1); glow.position.z = -1.0; g.add(glow);
    g.scale.setScalar(2.3); g.visible = false; scene.add(g); missiles.push({ g, fl, glow, id: -1, last: null });
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
  tracerMat = new THREE.MeshBasicMaterial({ color: 0xFF9A1A, depthTest: false });   // hot orange, not white like the road paint; drawn over kerbs and walls
  tracers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.34, 0.34, 6), tracerMat, MAXB); tracers.count = 0; tracers.frustumCulled = false; tracers.renderOrder = 8; scene.add(tracers);
  // oil slicks: a dark glossy splat with a rainbow sheen
  const oilTex = canvasTex(128, 128, (g, w, h) => {
    const blob = (rr0, jag) => { g.beginPath(); for (let a = 0; a <= 24; a++) { const t = a / 24 * Math.PI * 2, rr = rr0 * (0.8 + jag * Math.sin(a * 2.7) + 0.06 * Math.cos(a * 5.3)); g.lineTo(w / 2 + Math.cos(t) * rr, h / 2 + Math.sin(t) * rr); } g.fill(); };
    const rim = g.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w / 2); rim.addColorStop(0, 'rgba(120,70,190,0.85)'); rim.addColorStop(0.45, 'rgba(40,170,160,0.75)'); rim.addColorStop(0.8, 'rgba(210,190,70,0.55)'); rim.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rim; blob(w / 2, 0.18);                                                               // a rainbow rim: petrol on the road
    const core = g.createRadialGradient(w * 0.45, h * 0.45, 2, w / 2, h / 2, w * 0.4); core.addColorStop(0, 'rgba(40,36,52,1)'); core.addColorStop(1, 'rgba(8,8,12,0.97)');
    g.fillStyle = core; blob(w * 0.38, 0.14);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(w * 0.4, h * 0.36, w * 0.14, h * 0.04, -0.6, 0, Math.PI * 2); g.fill();   // the gloss
  });
  slickPool = [];
  for (let k = 0; k < 24; k++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(WPN.OIL_R * 2.6, WPN.OIL_R * 2.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: oilTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 })); m.renderOrder = 2; m.visible = false; scene.add(m); slickPool.push(m); }
  // harpoon: a steel spear with a barbed head, and its line back to the car that fired it
  hookPool = [];
  for (let k = 0; k < 8; k++) {
    const g = new THREE.Group(); g.add(cyl(0.07, 1.4, L(0x9AA3AD))); const head = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 6).rotateX(Math.PI / 2), L(0x3A3F46)); head.position.z = 0.9; g.add(head);
    for (const s of [-1, 1]) { const barb = box(0.05, 0.05, 0.4, L(0x3A3F46), s * 0.15, 0, 0.6); barb.rotation.y = -s * 0.6; g.add(barb); }
    g.scale.setScalar(1.6); g.visible = false; scene.add(g);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0x2A2A2A })); line.frustumCulled = false; line.visible = false; scene.add(line);
    hookPool.push({ g, line });
  }
  // fireballs and flashes (additive glow sprites), smoke puffs (soft grey sprites), shockwave domes, and the red ring
  // under a car a missile is homing on
  const smokeTex = canvasTex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  flashes = []; smokes = []; domes = [];
  // a fireball: white-hot middle, orange body, soft edge; tinted by the flash colour (white = fire)
  const fireTex = canvasTex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,252,235,1)'); gr.addColorStop(0.3, 'rgba(255,214,110,1)'); gr.addColorStop(0.62, 'rgba(255,120,30,0.85)'); gr.addColorStop(1, 'rgba(255,60,10,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  for (let k = 0; k < 24; k++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, depthWrite: false, transparent: true })); sp.renderOrder = 6; sp.visible = false; scene.add(sp); flashes.push({ sp, t: 1, life: 1, size: 1 }); }
  for (let k = 0; k < 64; k++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, depthWrite: false, transparent: true })); sp.visible = false; scene.add(sp); smokes.push({ sp, t: 1, life: 1, size: 1, vy: 0 }); }
  for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x6EC8FF, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.visible = false; scene.add(m); domes.push({ m, t: 1, size: 1 }); }
  targetRing = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.6, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xFF2A2A, transparent: true, opacity: 0.8, depthWrite: false, depthTest: false }));
  targetRing.renderOrder = 9; targetRing.visible = false; scene.add(targetRing);
}
const glowTex = () => G.glowTex || (G.glowTex = canvasTex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }));
/** A glowing flash that swells and fades: fireballs, muzzle flashes, hits. */
export function flash(x, y, z, size, color, life = 0.35) { const f = flashes[fi]; fi = (fi + 1) % flashes.length; if (!f) return; f.sp.position.set(x, y, z); f.sp.material.color.set(color); f.t = 0; f.life = life; f.size = size; f.sp.visible = true; }
/** A soft smoke puff that rises, swells and thins out. */
export function smoke(x, y, z, size, color, life = 1.6, vy = 1.5) { const f = smokes[si]; si = (si + 1) % smokes.length; if (!f) return; f.sp.position.set(x, y, z); f.sp.material.color.set(color); f.t = 0; f.life = life; f.size = size; f.vy = vy; f.sp.visible = true; }
function dome(x, y, z, size, color) { const d = domes[di]; di = (di + 1) % domes.length; if (!d) return; d.m.position.set(x, y, z); d.m.material.color.set(color); d.t = 0; d.size = size; d.m.visible = true; }
function updateFx(dt) {
  for (const f of flashes) { if (f.t >= f.life) continue; f.t += dt; const k = Math.min(1, f.t / f.life), sc = f.size * (0.5 + 0.8 * Math.sqrt(k)); f.sp.scale.set(sc, sc, 1); f.sp.material.opacity = k < 0.4 ? 1 : 1 - (k - 0.4) / 0.6; if (k >= 1) f.sp.visible = false; }
  for (const f of smokes) { if (f.t >= f.life) continue; f.t += dt; const k = Math.min(1, f.t / f.life), sc = f.size * (0.6 + 0.9 * k); f.sp.position.y += f.vy * dt * (1 - k); f.sp.scale.set(sc, sc, 1); f.sp.material.opacity = 0.85 * (1 - k) * Math.min(1, f.t * 8); if (k >= 1) f.sp.visible = false; }
  for (const d of domes) { if (d.t >= 1) continue; d.t += dt / 0.45; const k = Math.min(1, d.t), e = 1 - Math.pow(1 - k, 3); d.m.scale.set(d.size * (0.15 + e), d.size * (0.15 + e) * 0.45, d.size * (0.15 + e)); d.m.material.opacity = 0.45 * (1 - k); if (k >= 1) d.m.visible = false; }
}
function place(g, tr, s, lat, up, prev) {
  const p = roadPos(tr, s, lat, up), n = roadPos(tr, s + 1, lat, up);
  g.position.set(p.x, p.y, p.z); g.rotation.set(0, Math.atan2(n.x - p.x, n.z - p.z), 0); return p;
}
export function updateWeaponVis(dt, now) {
  if (G.state !== 'paused') updateFx(dt);
  const tr = G.world && G.world.tr, R = race, S = R && R.wpn, on = tr && G.state !== 'menu';
  if (targetRing) targetRing.visible = false;
  for (const p of missiles) p.g.visible = false; for (const c of crates) c.g.visible = false; for (const m of slickPool) m.visible = false; for (const h of hookPool) { h.g.visible = false; h.line.visible = false; }
  if (tracers) tracers.count = 0;
  if (!on || !R) return;
  (R.missiles || []).forEach((m, k) => {
    const p = missiles[k % missiles.length], pos = missilePos(tr, m);
    const dx = p.id === m.id && p.last ? pos.x - p.last.x : tr.tx[pos.i], dz = p.id === m.id && p.last ? pos.z - p.last.z : tr.tz[pos.i];
    p.g.visible = true; p.g.position.set(pos.x, pos.y, pos.z); p.g.rotation.set(0, Math.atan2(dx, dz), 0);
    p.fl.scale.set(1, 1, 0.8 + 0.4 * Math.sin(now * 60 + k)); const gs = 1.4 + 0.5 * Math.sin(now * 47 + k); p.glow.scale.set(gs, gs, 1);
    const T = R.cars[m.tgt]; if (T && k === 0 && targetRing) { targetRing.visible = true; targetRing.position.set(T.dx ?? T.x, (T.dy ?? T.y) + 0.15, T.dz ?? T.z); const pul = 1 + 0.15 * Math.sin(now * 18); targetRing.scale.set(pul, 1, pul); }   // who it's after
    if (G.state === 'racing' && p.id === m.id && p.last) {                                   // exhaust: a smoke trail (a puff every 50 ms) and sparks
      const bx = pos.x - Math.sin(p.g.rotation.y) * 2.6, bz = pos.z - Math.cos(p.g.rotation.y) * 2.6;
      if ((p.puffT = (p.puffT || 0) - dt) <= 0) { p.puffT = 0.05; smoke(bx, pos.y, bz, 1.5, 0xE8E8E8, 0.9, 0.4); }
      emit(bx, pos.y, bz, (Math.random() - 0.5) * 1.5, 0.8 + Math.random(), (Math.random() - 0.5) * 1.5, 0.35, 0.4, 0xFFB03A, -0.5);
    }
    p.id = m.id; p.last = pos;
  });
  if (!S) return;
  S.crates.forEach((k, j) => { const c = crates[j % crates.length]; place(c.g, tr, k.s, k.lat, 1.3 + Math.sin(now * 2.5 + k.id) * 0.2); c.g.visible = true; c.b.rotation.set(now * 0.9 + k.id, now * 1.3, 0); c.r.material.opacity = 0.3 + 0.2 * Math.sin(now * 4 + k.id); });
  let nb = 0;
  for (const b of S.bullets) {
    if (nb >= MAXB) break;
    const p = roadPos(tr, b.s, b.lat, 1.4), n = roadPos(tr, b.s + 1, b.lat + b.dl / b.v, 1.4);
    _q.setFromAxisAngle(_y, Math.atan2(n.x - p.x, n.z - p.z)); _m.compose(_p.set(p.x, p.y, p.z), _q, _s.set(1, 1, 1)); tracers.setMatrixAt(nb++, _m);
  }
  streaks = streaks.filter(k => (k.t -= dt) > 0);                                   // rounds that hit within a frame or two: gun to target
  for (const k of streaks) {
    if (nb >= MAXB) break;
    const dx = k.b.x - k.a.x, dy = k.b.y - k.a.y, dz = k.b.z - k.a.z, L = Math.hypot(dx, dy, dz);
    _q.setFromAxisAngle(_y, Math.atan2(dx, dz)); _m.compose(_p.set((k.a.x + k.b.x) / 2, (k.a.y + k.b.y) / 2, (k.a.z + k.b.z) / 2), _q, _s.set(1, 1, L / 6)); tracers.setMatrixAt(nb++, _m);
  }
  tracers.count = nb;
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
  shockwave(e.x, e.y - 1, e.z, 9, 0xFF7A2E); flash(e.x, e.y + 1.5, e.z, 13, 0xFFFFFF, 0.5); flash(e.x, e.y + 2.2, e.z, 8, 0xFFFFFF, 0.8);
  for (let k = 0; k < 6; k++) smoke(e.x + (Math.random() - 0.5) * 3, e.y + 1 + Math.random() * 1.5, e.z + (Math.random() - 0.5) * 3, 4 + Math.random() * 3, k < 2 ? 0x7A5A48 : 0x4A4A4A, 1.6 + Math.random() * 0.8, 2 + Math.random() * 1.5);
  for (let k = 0; k < 26; k++) { const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 7; emit(e.x, e.y, e.z, Math.cos(a) * s, 2 + Math.random() * 6, Math.sin(a) * s, 0.4 + Math.random() * 0.4, 1.2 + Math.random(), Math.random() < 0.5 ? 0xFFB03A : 0xFF5A1E, -2); }
  for (let k = 0; k < 16; k++) emit(e.x + (Math.random() - 0.5) * 2, e.y + Math.random(), e.z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 3, 2 + Math.random() * 3, (Math.random() - 0.5) * 3, 1.2 + Math.random() * 0.8, 1.6 + Math.random(), Math.random() < 0.5 ? 0x4A4A4A : 0x6E6E6E, -1.2);
  for (let k = 0; k < 8; k++) debris(e.x, e.y, e.z, (Math.random() - 0.5) * 12, 4 + Math.random() * 6, (Math.random() - 0.5) * 12, 0x2A2A2A, 0.2, 0.08, 0.3, 1.4);
}
export function missilePuff(e) { flash(e.x, e.y, e.z, 4, 0xFFFFFF, 0.3); for (let k = 0; k < 10; k++) emit(e.x, e.y, e.z, (Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3, 0.8, 1.2, 0x9A9A9A, -0.8); }
export function pickupFx(e) { shockwave(e.x, e.y, e.z, 3.5, 0xFFC72C); for (let k = 0; k < 14; k++) emit(e.x, e.y + 1.2, e.z, (Math.random() - 0.5) * 6, 3 + Math.random() * 4, (Math.random() - 0.5) * 6, 0.5, 0.5, k % 2 ? 0xFFC72C : 0x8A5A2B, -3); }
export function pulseFx(c) { dome(c.x, c.y, c.z, WPN.PULSE_R, 0x6EC8FF); flash(c.x, c.y + 1, c.z, 7, 0x9ADCFF, 0.3); shockwave(c.x, c.y, c.z, WPN.PULSE_R, 0x6EC8FF); shockwave(c.x, c.y + 0.5, c.z, WPN.PULSE_R * 0.6, 0xCFEFFF); for (let k = 0; k < 30; k++) { const a = k / 30 * Math.PI * 2; emit(c.x, c.y + 0.8, c.z, Math.cos(a) * 16, 0.5, Math.sin(a) * 16, 0.4, 0.6, 0x9ADCFF, 0); } }
export function oilDropFx(c) { const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw); for (let k = 0; k < 10; k++) emit(c.x - fx * 2.2, c.y + 0.5, c.z - fz * 2.2, (Math.random() - 0.5) * 2, 1 + Math.random() * 2, (Math.random() - 0.5) * 2, 0.5, 0.4, 0x1A1820, -9); }
export function bulletHitFx(e, from) {
  if (from) streaks.push({ a: { x: from.dx ?? from.x, y: (from.dy ?? from.y) + 1.4, z: from.dz ?? from.z }, b: { x: e.x, y: e.y + 0.8, z: e.z }, t: 0.09 }); flash(e.x, e.y + 0.4, e.z, 1.6, 0xFFFFFF, 0.12); for (let k = 0; k < 6; k++) emit(e.x, e.y, e.z, (Math.random() - 0.5) * 6, 1 + Math.random() * 3, (Math.random() - 0.5) * 6, 0.25, 0.25, 0xFFD27A, -4); }

// ---------- weapon mounts on the cars ----------
// Every car has a mount under its roof: when it's holding a weapon, that weapon's module rises out of the roof
// (missile pod, twin guns, oil drum, pulse coil, harpoon gun); firing kicks it back, and once the weapon is spent the
// mount sinks away again. Built the first time a car picks something up.
function module(item) {
  const g = new THREE.Group(), dark = L(0x2E333B), steel = L(0x9AA3AD), yel = L(0xFFC72C), red = L(0xD8203A);
  if (item === 'missile') { g.add(box(0.9, 0.34, 1.1, dark)); for (const s of [-1, 1]) { g.add(cyl(0.13, 1.2, steel, s * 0.22, 0.02, 0.1)); const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 8).rotateX(Math.PI / 2), red); tip.position.set(s * 0.22, 0.02, 0.8); g.add(tip); } g.rotation.x = -0.18; }
  else if (item === 'gun') { g.add(box(0.5, 0.3, 0.6, dark)); for (const s of [-1, 1]) g.add(cyl(0.07, 1.1, steel, s * 0.14, 0.05, 0.6)); const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xFFD27A, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); fl.scale.set(1.3, 1.3, 1); fl.position.z = 1.3; fl.visible = false; g.add(fl); g.userData.flash = fl; }
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
  m.visible = M.up > 0.03; m.position.y = (M.up - 1) * 0.6 + 0.1; m.scale.setScalar((0.3 + 0.7 * M.up) * 1.5);   // a size that reads from the race camera
  m.position.z = (M.held === 'oil' ? -0.4 : 0) - M.kick * 0.35; m.rotation.x = (M.held === 'missile' ? -0.18 : 0) - M.kick * 0.25;   // recoil
  if (m.userData.flash) m.userData.flash.visible = w.gunT > 0 && Math.floor(now * 30) % 2 === 0;
  if (m.userData.core) m.userData.core.scale.setScalar(1 + 0.25 * Math.sin(now * 12));
  if (m.userData.head) m.userData.head.visible = !!w.item;
  if (!want && M.up < 0.03) M.held = null;
}
export function mountKick(v) { if (v && v.mount) v.mount.kick = 1; }
