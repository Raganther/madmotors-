import * as THREE from 'three';
import { G } from '../game.js';
import { AudioSys } from '../audio/audio.js';
import { CAR_HL, CAR_HW } from '../core/constants.js';
import { clamp, lerp, wrapAngle } from '../core/math.js';
import { WRECK_T, carWear } from '../core/sim/damage.js';
import { SD } from '../core/modes/showdown.js';
import { CAR_DEFS, TRAFFIC_KINDS } from '../data/cars.js';
import { effectsForCar } from './effects/carfx.js';
import { debris } from './effects/debris.js';
import { glassBits, sparks } from './effects/impacts.js';
import { emit } from './effects/particles.js';
import { spawnProp } from './effects/props.js';
import { shockwave } from './effects/rings.js';
import { _p, _q, _s, flat, radialTex } from './geometry.js';
import { getCrackTex, glassMat, numberTex, paintMat } from './materials.js';
import { scene } from './renderer.js';
import { race } from '../ui/flow.js';
import { callout } from '../ui/hud.js';

export const carVis = [];
G.parkVis = [];
// brake-light glow sprites and a soft contact shadow under the body
export function addCarExtras(v, tails, hw, hl) {
  if (!G.glowTex) G.glowTex = radialTex([[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]);
  if (!G.blobTex) G.blobTex = radialTex([[0, 'rgba(255,255,255,1)'], [0.55, 'rgba(255,255,255,0.7)'], [1, 'rgba(255,255,255,0)']]);
  v.tailM = tails[0].material; v.glow = tails.map(t => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.glowTex, color: 0xFF3A22, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    sp.scale.set(1.3, 1.3, 1); sp.position.copy(t.position); sp.position.z -= 0.12; sp.visible = false; t.parent.add(sp); return sp;
  });
  const blob = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2.7, hl * 2.5).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: G.blobTex, color: 0x000000, transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
  blob.position.y = 0.05; blob.renderOrder = 1; v.root.add(blob); v.blob = blob;
}
export function makeCarMesh(def) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const L = c => c === def.color || c === def.accent ? paintMat(c) : c === 0x253450 ? glassMat() : new THREE.MeshLambertMaterial({ color: c });
  const dentable = [];
  const box = (w, h, d, c, x, y, z, seg) => {
    const g = flat(seg ? new THREE.BoxGeometry(w, h, d, seg[0], seg[1], seg[2]) : new THREE.BoxGeometry(w, h, d));
    const m = new THREE.Mesh(g, L(c)); m.position.set(x, y, z); m.castShadow = true; body.add(m);
    m.userData.home = { p: m.position.clone(), r: m.rotation.clone(), dims: [w, h, d], color: c };
    return m;
  };
  const dent = m => { m.userData.orig = Float32Array.from(m.geometry.attributes.position.array); dentable.push(m); return m; };
  dent(box(2.0, 0.34, 3.5, 0x2B2F3A, 0, 0.46, 0, [3, 1, 5]));
  dent(box(1.92, 0.48, 3.3, def.color, 0, 0.84, 0, [3, 2, 5]));
  const bumper = box(1.96, 0.28, 0.3, def.accent, 0, 0.62, 1.72);
  const cabin = dent(box(1.56, 0.52, 1.55, 0x253450, 0, 1.33, -0.25, [2, 1, 2]));
  dent(box(1.6, 0.1, 1.35, def.color, 0, 1.63, -0.3, [2, 1, 2]));
  dent(box(0.42, 0.02, 3.32, def.accent, 0, 1.09, 0, [1, 1, 5]));
  const wing = box(1.92, 0.08, 0.46, def.accent, 0, 1.38, -1.55);
  const struts = [box(0.08, 0.3, 0.12, 0x2B2F3A, -0.6, 1.2, -1.55), box(0.08, 0.3, 0.12, 0x2B2F3A, 0.6, 1.2, -1.55)];
  const hl = new THREE.MeshBasicMaterial({ color: 0xFFF6C8 }), tl = new THREE.MeshBasicMaterial({ color: 0xFF4A3A });
  const heads = [], tails = [];
  for (const s of [-1, 1]) { const a = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 0.06), hl); a.position.set(s * 0.62, 0.9, 1.66); body.add(a); heads.push(a); const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.06), tl); b.position.set(s * 0.64, 0.9, -1.66); body.add(b); tails.push(b); }
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), new THREE.MeshLambertMaterial({ map: numberTex(def.num, '#FFFFFF', '#1C2340'), transparent: true }));
  plate.rotation.x = -Math.PI / 2; plate.position.set(0, 1.69, -0.3); body.add(plate);
  const wheelG = flat(new THREE.CylinderGeometry(0.42, 0.42, 0.36, 10).rotateZ(Math.PI / 2)), wheelM = L(0x1E1E22), hubM = L(0xC9CCD4);
  const hubG = new THREE.CylinderGeometry(0.2, 0.2, 0.38, 6).rotateZ(Math.PI / 2);
  const wheels = [], steer = [];
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const pivot = new THREE.Group(); pivot.position.set(sx * 0.98, 0.42, sz * 1.15); root.add(pivot);
    const spin = new THREE.Group(); pivot.add(spin);
    const w = new THREE.Mesh(wheelG, wheelM); w.castShadow = true; spin.add(w); spin.add(new THREE.Mesh(hubG, hubM));
    wheels.push(spin); if (sz > 0) steer.push(pivot);
  }
  scene.add(root);
  const v = { root, body, wheels, steer, n: new THREE.Vector3(0, 1, 0), spin: 0, skPrev: [null, null], emitAcc: 0,
    dentable, bumper, wing, struts, heads, tails, cabin, glassM: cabin.material, crackM: null, parts: { bumper: 0, wing: 0, heads: 0, tails: 0, crack: 0 } };
  addCarExtras(v, tails, CAR_HW, CAR_HL); return v;
}
// push the bodywork in around a contact point (car-local coords), deterministic per vertex so shared corners stay welded
export function dentMesh(v, lx, ly, lz, ix, iz, depth, radius) {
  for (const m of v.dentable) {
    const pos = m.geometry.attributes.position, a = pos.array, o = m.userData.orig, mp = m.position;
    for (let k = 0; k < a.length; k += 3) {
      const vx = a[k] + mp.x, vy = a[k + 1] + mp.y, vz = a[k + 2] + mp.z;
      const d = Math.hypot(vx - lx, (vy - ly) * 0.8, vz - lz); if (d >= radius) continue;
      const f = (1 - d / radius) ** 2, j = Math.sin(o[k] * 12.9898 + o[k + 1] * 78.233 + o[k + 2] * 37.719) * 43758.5453, n = (j - Math.floor(j)) - 0.5;
      a[k] += ix * depth * f * (0.8 + n * 0.5); a[k + 2] += iz * depth * f * (0.8 + n * 0.5); a[k + 1] -= depth * f * (0.25 + n * 0.3);
      const ex = a[k] - o[k], ey = a[k + 1] - o[k + 1], ez = a[k + 2] - o[k + 2], el = Math.hypot(ex, ey, ez);
      if (el > 0.42) { const s = 0.42 / el; a[k] = o[k] + ex * s; a[k + 1] = o[k + 1] + ey * s; a[k + 2] = o[k + 2] + ez * s; }
    }
    pos.needsUpdate = true; m.geometry.computeVertexNormals();
  }
}
export function toCarLocal(c, x, z) { const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), dx = x - c.x, dz = z - c.z; return [dx * fz - dz * fx, dx * fx + dz * fz]; }
export function detachPart(c, v, m) {
  if (!m.visible) return;
  const { dims, color } = m.userData.home;
  m.updateWorldMatrix(true, false); m.matrixWorld.decompose(_p, _q, _s);
  const r = () => Math.random() - 0.5;
  spawnProp('box', _p.clone(), _q.clone(), dims, color, c.vx * 0.55 + r() * 5, 3 + Math.random() * 4, c.vz * 0.55 + r() * 5, 9, 'metal');
  m.visible = false;
}
export function updateCarDamageVis(c, v) {
  const d = c.dmg, P = v.parts;
  if (d.f > 0.25 && P.bumper < 1) { P.bumper = 1; v.bumper.rotation.x = 0.35; v.bumper.position.y -= 0.12; v.bumper.rotation.z = (Math.random() - 0.5) * 0.4; }
  if (d.f > 0.55 && P.bumper < 2) { P.bumper = 2; detachPart(c, v, v.bumper); }
  if (d.b > 0.3 && P.wing < 1) { P.wing = 1; v.wing.rotation.z = (Math.random() < 0.5 ? -1 : 1) * 0.3; v.wing.position.y -= 0.08; }
  if (d.b > 0.6 && P.wing < 2) { P.wing = 2; detachPart(c, v, v.wing); v.struts.forEach(m => detachPart(c, v, m)); }
  if (d.f > 0.35 && !P.heads) { P.heads = 1; v.heads.forEach(m => m.visible = false); const [x, y, z] = [c.x + Math.sin(c.yaw) * 1.7, c.y, c.z + Math.cos(c.yaw) * 1.7]; glassBits(x, y - 0.4, z, 5, c.pr.i); }
  if (d.b > 0.35 && !P.tails) { P.tails = 1; v.tails.forEach(m => m.visible = false); }
  if ((d.f > 0.4 || carWear(c) > 0.35) && !P.crack) { P.crack = 1; if (!v.crackM) v.crackM = new THREE.MeshLambertMaterial({ map: getCrackTex() }); v.cabin.material = v.crackM; }
}
export function repairCarVis(v) {
  for (const m of v.dentable) { m.geometry.attributes.position.array.set(m.userData.orig); m.geometry.attributes.position.needsUpdate = true; m.geometry.computeVertexNormals(); }
  for (const m of [v.bumper, v.wing, ...v.struts]) { const h = m.userData.home; m.position.copy(h.p); m.rotation.copy(h.r); m.visible = true; }
  v.heads.forEach(m => m.visible = true); v.tails.forEach(m => m.visible = true); v.cabin.material = v.glassM;
  v.parts = { bumper: 0, wing: 0, heads: 0, tails: 0, crack: 0 }; v.wreckFx = 0;
  v.flipA = 0; v.flipV = 0; v.wheels.forEach(w => w.visible = true);   // pooled road-car meshes come back whole
}
export function visOf(c) { return c.traffic ? c.vis : carVis[race.cars.indexOf(c)]; }
export function dentFx(c, e) {
  const v = visOf(c); if (!v) return;
  const [lx, lz] = toCarLocal(c, e.x, e.z), [ix, iz] = (() => { const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw); return [e.ix * fz - e.iz * fx, e.ix * fx + e.iz * fz]; })();
  dentMesh(v, lx, 0.8, lz, ix, iz, clamp(e.amt * 1.4, 0.04, 0.35), 0.8 + clamp(e.v * 0.03, 0, 0.7));
  updateCarDamageVis(c, v);
}
export function wreckFx(c, isPlayer, near) {
  const v = visOf(c);
  sparks(c.x, c.y, c.z, 30); shockwave(c.x, c.y, c.z, 7, 0xFFB03A);
  for (let k = 0; k < 26; k++) emit(c.x + (Math.random() - 0.5) * 2, c.y + 0.8, c.z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 7, 2 + Math.random() * 4, (Math.random() - 0.5) * 7, 1 + Math.random(), 1.4 + Math.random(), k % 3 ? 0x3A3A3A : 0xFF8A2E, -1);
  if (v) { detachPart(c, v, v.bumper); detachPart(c, v, v.wing); v.wreckFx = 1; }
  c.smokeT = WRECK_T;
  if (isPlayer) { G.shake = Math.min(1.6, G.shake + 1.2); G.slowmo = Math.max(G.slowmo, 0.3); if (!race.sd) callout('Wrecked!'); }
  if (isPlayer || near) AudioSys.crash('car', isPlayer ? 1 : 0.5);
}
// Road car takedown: it blows apart. Fireball, streaks of sparks, wheels and panels flying, glass, a black
// smoke column; the shell is scorched and tumbles through the air (see drawCar), then burns where it lands.
export function takedownFx(c, e, isPlayer, near) {
  const v = visOf(c), col = c.def.color, hint = c.pr.i, big = c.def.kind === 'truck' ? 1.4 : c.def.kind === 'van' ? 1.2 : 1;
  shockwave(c.x, c.y, c.z, 10 * big, 0xFFB03A); shockwave(c.x, c.y + 0.5, c.z, 5 * big, 0xFFF1B0);
  sparks(e.x, e.y, e.z, Math.round(40 + e.v * 1.5), e.nx, e.nz); sparks(c.x, c.y, c.z, 30);
  for (let k = 0; k < 34 * big; k++) { const a = Math.random() * Math.PI * 2, r = Math.random() * 6; emit(c.x, c.y + 1, c.z, Math.cos(a) * r + c.vx * 0.3, 3 + Math.random() * 7, Math.sin(a) * r + c.vz * 0.3, 0.45 + Math.random() * 0.5, 1.5 + Math.random() * 1.5, k % 3 === 0 ? 0xFFE27A : k % 3 === 1 ? 0xFFB03A : 0xFF5A1E, 3); }
  for (let k = 0; k < 16; k++) emit(c.x + (Math.random() - 0.5) * 2, c.y + 1.5, c.z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2 + c.vx * 0.2, 4 + Math.random() * 4, (Math.random() - 0.5) * 2 + c.vz * 0.2, 1.8 + Math.random(), 2.4 + Math.random() * 1.6, k % 2 ? 0x2E2E2E : 0x4A4A4A, -1.5);
  // flying parts: its wheels, panels in its paint, trim, glass
  const S = TRAFFIC_SHAPES[c.def.kind], fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
  if (S) for (const [sx, sz] of S.wheels) { const wx = c.x + fz * -sx + fx * sz, wz = c.z - fx * -sx + fz * sz; debris(wx, c.y + 0.3, wz, c.vx * 0.6 + (wx - c.x) * 4 + (Math.random() - 0.5) * 6, 5 + Math.random() * 6, c.vz * 0.6 + (wz - c.z) * 4 + (Math.random() - 0.5) * 6, 0x1E1E22, S.wr * 2, S.wr * 2, 0.36, 5 + Math.random() * 2, hint); }
  for (let k = 0; k < 10 * big; k++) { const s = 0.35 + Math.random() * 0.6; debris(c.x, c.y + 1, c.z, c.vx * 0.5 + e.nx * 6 + (Math.random() - 0.5) * 12, 4 + Math.random() * 8, c.vz * 0.5 + e.nz * 6 + (Math.random() - 0.5) * 12, k % 3 ? col : 0x2B2F3A, s * 1.6, s * 0.18, s, 4 + Math.random() * 2, hint); }
  glassBits(c.x, c.y, c.z, 10, hint);
  if (v) {
    detachPart(c, v, v.bumper); detachPart(c, v, v.wing); v.wreckFx = 1;
    v.paint.color.lerp(_scorch, 0.8); v.wheels.forEach(w => w.visible = false); v.heads.forEach(m => m.visible = false); v.tails.forEach(m => m.visible = false);
    v.flipV = (Math.random() < 0.5 ? -1 : 1) * (6 + Math.random() * 5) * (1 / big); v.flipA = 0;
  }
  c.smokeT = 1e9;
  if (isPlayer) { G.shake = Math.min(1.8, G.shake + 1.1); G.slowmo = Math.max(G.slowmo, 0.35); }
  if (isPlayer || near) AudioSys.crash('car', isPlayer ? 1 : 0.6);
}
const _scorch = new THREE.Color(0x1A1612);
// Showdown blow-up: a fireball and a smoke column on top of the wreck, in the car's colour
export function sdBoomFx(c, onScreen) {
  const col = c.def.color;
  shockwave(c.x, c.y, c.z, 11, col); shockwave(c.x, c.y + 0.4, c.z, 6, 0xFFE08A);
  for (let k = 0; k < 40; k++) { const a = Math.random() * Math.PI * 2, r = Math.random() * 7; emit(c.x, c.y + 1, c.z, Math.cos(a) * r, 4 + Math.random() * 7, Math.sin(a) * r, 0.5 + Math.random() * 0.5, 1.6 + Math.random() * 1.4, k % 4 === 0 ? col : k % 2 ? 0xFFB03A : 0xFFE27A, 4); }
  for (let k = 0; k < 18; k++) emit(c.x + (Math.random() - 0.5) * 1.5, c.y + 1.5, c.z + (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, 5 + Math.random() * 4, (Math.random() - 0.5) * 1.5, 1.6 + Math.random() * 0.8, 2.2 + Math.random() * 1.5, 0x3A3A3A, -1.5);
  if (onScreen) { G.shake = Math.min(1.8, G.shake + (c.isPlayer ? 1.4 : 0.7)); AudioSys.crash('car', c.isPlayer ? 1 : 0.8); }
}
// Showdown respawn: a ring and sparkles in the car's colour so you can see where it came back
export function sdSpawnFx(c) {
  shockwave(c.x, c.y, c.z, 6, c.def.color);
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; emit(c.x + Math.cos(a) * 1.6, c.y + 0.4, c.z + Math.sin(a) * 1.6, Math.cos(a) * 3, 2 + Math.random() * 2, Math.sin(a) * 3, 0.5, 0.7, k % 2 ? c.def.color : 0xFFFFFF, 2); }
}
// civilian vehicles: same part names as the race cars so damage visuals work on them too
export const TRAFFIC_SHAPES = {
  hatch: { wheels: [[0.95, 1.1], [-0.95, 1.1], [0.95, -1.1], [-0.95, -1.1]], wr: 0.4 },
  van: { wheels: [[1.02, 1.5], [-1.02, 1.5], [1.02, -1.5], [-1.02, -1.5]], wr: 0.44 },
  truck: { wheels: [[1.12, 2.2], [-1.12, 2.2], [1.12, -1.3], [-1.12, -1.3], [1.12, -2.35], [-1.12, -2.35]], wr: 0.52 }
};
export function makeTrafficMesh(kind) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const paint = paintMat(0xffffff), dentable = [];
  const box = (w, h, d, c, x, y, z, seg, mat) => {
    const g = flat(seg ? new THREE.BoxGeometry(w, h, d, seg[0], seg[1], seg[2]) : new THREE.BoxGeometry(w, h, d));
    const m = new THREE.Mesh(g, mat || new THREE.MeshLambertMaterial({ color: c })); m.position.set(x, y, z); m.castShadow = true; body.add(m);
    m.userData.home = { p: m.position.clone(), r: m.rotation.clone(), dims: [w, h, d], color: c };
    return m;
  };
  const dent = m => { m.userData.orig = Float32Array.from(m.geometry.attributes.position.array); dentable.push(m); return m; };
  const glass = 0x253450, trim = 0x8E939B, dark = 0x2B2F3A, glassM = glassMat();
  let cabin, bumper, wing, hz, hy;
  if (kind === 'hatch') {
    dent(box(1.9, 0.3, 3.3, dark, 0, 0.45, 0, [3, 1, 5]));
    dent(box(1.84, 0.55, 3.2, 0, 0, 0.86, 0, [3, 2, 5], paint));
    cabin = dent(box(1.6, 0.52, 1.9, glass, 0, 1.39, -0.3, [2, 1, 2], glassM));
    dent(box(1.64, 0.08, 1.7, 0, 0, 1.68, -0.35, [2, 1, 2], paint));
    bumper = box(1.9, 0.24, 0.2, trim, 0, 0.55, 1.68); wing = box(1.9, 0.24, 0.2, trim, 0, 0.55, -1.68); hz = 1.61; hy = 0.95;
  } else if (kind === 'van') {
    dent(box(2.06, 0.3, 4.4, dark, 0, 0.5, 0, [3, 1, 6]));
    dent(box(2.04, 1.55, 4.3, 0, 0, 1.4, -0.05, [3, 3, 6], paint));
    cabin = box(1.9, 0.6, 0.08, glass, 0, 1.72, 2.12, null, glassM); box(2.06, 0.46, 0.9, glass, 0, 1.72, 1.5, null, glassM);
    bumper = box(2.08, 0.26, 0.2, trim, 0, 0.6, 2.24); wing = box(2.08, 0.26, 0.2, trim, 0, 0.6, -2.24); hz = 2.13; hy = 1.0;
  } else {
    dent(box(2.3, 0.35, 6.1, dark, 0, 0.62, 0, [3, 1, 8]));
    dent(box(2.3, 1.5, 1.7, 0, 0, 1.55, 2.2, [3, 2, 2], paint));
    cabin = box(2.1, 0.62, 0.08, glass, 0, 1.9, 3.06, null, glassM);
    dent(box(2.42, 2.2, 4.3, 0xE8E6DF, 0, 2.0, -0.85, [3, 3, 6]));
    bumper = box(2.36, 0.3, 0.22, trim, 0, 0.62, 3.12); wing = box(2.36, 0.3, 0.22, trim, 0, 0.62, -3.1); hz = 3.07; hy = 1.05;
  }
  const hl = new THREE.MeshBasicMaterial({ color: 0xFFF6C8 }), tl = new THREE.MeshBasicMaterial({ color: 0xFF4A3A }), heads = [], tails = [];
  for (const sx of [-1, 1]) { const a = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.16, 0.06), hl); a.position.set(sx * 0.66, hy, hz); body.add(a); heads.push(a); const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), tl); b2.position.set(sx * 0.7, hy, -hz); body.add(b2); tails.push(b2); }
  const S = TRAFFIC_SHAPES[kind], wheelG = flat(new THREE.CylinderGeometry(S.wr, S.wr, 0.36, 10).rotateZ(Math.PI / 2)), wheelM = new THREE.MeshLambertMaterial({ color: 0x1E1E22 });
  const wheels = [], steer = [];
  for (const [sx, sz] of S.wheels) {
    const pivot = new THREE.Group(); pivot.position.set(sx, S.wr, sz); root.add(pivot);
    const spin = new THREE.Group(); pivot.add(spin); const w = new THREE.Mesh(wheelG, wheelM); w.castShadow = true; spin.add(w);
    wheels.push(spin); if (sz > 1.5 || (kind === 'hatch' && sz > 0)) steer.push(pivot);
  }
  root.visible = false; scene.add(root);
  const K = TRAFFIC_KINDS.find(k => k.kind === kind);
  const v = { root, body, wheels, steer, n: new THREE.Vector3(0, 1, 0), spin: 0, skPrev: [null, null], emitAcc: 0, wr: S.wr, paint, owner: null,
    dentable, bumper, wing, struts: [], heads, tails, cabin, glassM: cabin.material, crackM: null, parts: { bumper: 0, wing: 0, heads: 0, tails: 0, crack: 0 } };
  addCarExtras(v, tails, K.hw, K.hl); return v;
}
export const trafficPool = { hatch: [], van: [], truck: [] };
export function syncTrafficVis() {
  const live = race ? race.traffic : [];
  for (const pool of Object.values(trafficPool)) for (const v of pool) if (v.owner && (v.owner.dead || !live.includes(v.owner))) { v.owner.vis = null; v.owner = null; v.root.visible = false; }
  for (const c of live) {
    if (c.vis) continue;
    const v = trafficPool[c.def.kind].find(x => !x.owner); if (!v) continue;
    v.owner = c; c.vis = v; repairCarVis(v); v.paint.color.set(c.def.color); v.root.visible = true; v.n.set(0, 1, 0); v.wobble = 0;
  }
}
export let marker, crown;
export function initCars() {
  CAR_DEFS.forEach(d => carVis.push(makeCarMesh(d)));
  for (const k of Object.keys(trafficPool)) for (let i = 0; i < 5; i++) trafficPool[k].push(makeTrafficMesh(k));
  marker = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.1, 4).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: 0xFFC72C }));
  scene.add(marker);
  // Showdown leader's crown: a gold band with five points
  const gold = new THREE.MeshBasicMaterial({ color: 0xFFC72C });
  crown = new THREE.Group(); crown.add(new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.55, 0.34, 10, 1, true), gold));
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2, p = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.42, 4), gold); p.position.set(Math.cos(a) * 0.55, 0.36, Math.sin(a) * 0.55); crown.add(p); }
  crown.scale.setScalar(1.7); crown.visible = false; scene.add(crown);
}
export const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _mb = new THREE.Matrix4();
export function drawCar(c, v, dt, now) {
  let a = G.renderAlpha; if (c.px === undefined || Math.abs(c.x - c.px) + Math.abs(c.z - c.pz) > 6) a = 1;     // no smearing across a respawn
  c.dx = a < 1 ? lerp(c.px, c.x, a) : c.x; c.dy = a < 1 ? lerp(c.py, c.y, a) : c.y; c.dz = a < 1 ? lerp(c.pz, c.z, a) : c.z;
  const yaw = a < 1 ? c.pyaw + wrapAngle(c.yaw - c.pyaw) * a : c.yaw;
  v.root.position.set(c.dx, c.dy, c.dz);
  if (c.onGround) { _v1.set(-c.gx, 1, -c.gz).normalize(); v.n.lerp(_v1, 1 - Math.exp(-dt * 14)).normalize(); }
  _v2.set(Math.sin(yaw), 0, Math.cos(yaw));
  _v3.crossVectors(v.n, _v2).normalize(); _v2.crossVectors(_v3, v.n);
  _mb.makeBasis(_v3, v.n, _v2); v.root.quaternion.setFromRotationMatrix(_mb);
  v.wobble = (v.wobble || 0) * Math.exp(-dt * 4.5); v.wobT = (v.wobT || 0) + dt;
  // a destroyed road car tumbles while airborne and settles on its roof or its wheels
  if (v.flipV) { if (!c.onGround) v.flipA += v.flipV * dt; else { const tgt = Math.round(v.flipA / Math.PI) * Math.PI; v.flipA += (tgt - v.flipA) * Math.min(1, dt * 8); if (Math.abs(tgt - v.flipA) < 0.01) { v.flipA = tgt; v.flipV = 0; } } }
  v.body.rotation.z = clamp(c.vr * 0.016, -0.18, 0.18) + Math.sin(v.wobT * 32) * v.wobble + (v.flipA || 0);
  v.body.rotation.x = (c.onGround ? -clamp((c.acc || 0) * 0.003, -0.07, 0.07) : clamp(-c.vy * 0.012, -0.3, 0.3)) + Math.cos(v.wobT * 27) * v.wobble * 0.6;
  c.squash *= Math.exp(-dt * 7); v.body.scale.y = 1 - c.squash * 0.22; v.body.position.y = -c.squash * 0.08 + (1 - Math.cos(v.flipA || 0)) * 0.85;   // lifted so a flipped shell rests on its roof
  v.spin += c.vf * dt / (v.wr || 0.42); v.wheels.forEach(w => w.rotation.x = v.spin);
  v.steer.forEach(p => p.rotation.y = -c.inp.steer * 0.42);
  const braking = !v.parts.tails && ((c.inp.brake > 0.05 && c.vf > 0.5) || (c.inp.handbrake > 0 && Math.abs(c.vf) > 3));
  if (v.braking !== braking) { v.braking = braking; v.tailM.color.setHex(braking ? 0xFF4A36 : 0x8E2016); v.glow.forEach(g => g.visible = braking); }
  v.blob.visible = c.onGround;
  v.root.visible = c.ghost > 0 ? Math.floor(now * 14) % 2 === 0 : true;
  if (G.state === 'racing') effectsForCar(c, v, dt);
}
export function updateCarVisuals(dt, now) {
  if (!race) return;
  const sd = race.sd;
  race.cars.forEach((c, k) => { drawCar(c, carVis[k], dt, now); if (sd && sd.boomT[k] > 0 && sd.boomT[k] < SD.BOOM - 0.2) carVis[k].root.visible = false; });   // blown to bits
  syncTrafficVis();
  for (const c of race.traffic) if (c.vis) drawCar(c, c.vis, dt, now);
  for (const v of G.parkVis) v.root.visible = false;
  for (const c of race.parked) if (c.vis) drawCar(c, c.vis, dt, now);
  const P = race.player;
  const L = sd && G.state !== 'menu' && sd.holder >= 0 ? race.cars[sd.holder] : null;   // the crown sits on its holder
  marker.position.set(P.dx ?? P.x, (P.dy ?? P.y) + (L === P ? 5.4 : 3.6) + Math.sin(now * 4) * 0.25, P.dz ?? P.z); marker.rotation.y = now * 1.5;
  marker.visible = G.state !== 'menu';
  crown.visible = !!L;
  if (L) { crown.position.set(L.dx ?? L.x, (L.dy ?? L.y) + 3.1 + Math.sin(now * 3) * 0.15, L.dz ?? L.z); crown.rotation.y = now * 0.8; }
}
