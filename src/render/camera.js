import * as THREE from 'three';
import { G } from '../game.js';
import { clamp, wrapAngle } from '../core/math.js';
import { sdLeader } from '../core/modes/showdown.js';
import { CAM_DIR as CORE_CAM_DIR, WALL } from '../core/constants.js';
import { camera, pcamera, sun } from './renderer.js';
import { CUT } from './materials.js';
import { houseBoxes } from './elements/town.js';
import { _v1, _v3 } from './vehicles.js';
import { race } from '../ui/flow.js';

export const CAM_DIR = new THREE.Vector3(...CORE_CAM_DIR);
// Camera settings (menu / pause, C while racing). The top-down views are orthographic: dir points from the car toward
// the camera; chase has no fixed dir: it swings round to stay behind the car, el up from the ground. The rest (persp)
// are perspective cameras behind the car: back / up metres from it, looking look metres ahead and lookUp above the
// road; tv films you from trackside spots up the road. Zoom scales the view height, or the distance behind the car.
// Showdown, Deuce and Tiebreak judge "off the screen" on the top-down view, so there the perspective views fall back to chase.
export const CAM_MODES = {
  classic: { name: 'Classic', dir: CORE_CAM_DIR },
  overhead: { name: 'Overhead', dir: [1, 3.5, 1] },
  low: { name: 'Low', dir: [1, 0.82, 1] },
  chase: { name: 'Chase', el: 0.72 },
  behind: { name: 'Behind', persp: { back: 7.5, up: 3.1, look: 10, lookUp: 1.1, fov: 60, turn: 4 } },
  follow: { name: 'Follow', persp: { back: 15, up: 7, look: 14, lookUp: 0.4, fov: 52, turn: 3 } },
  heli: { name: 'Heli', persp: { back: 16, up: 19, look: 4, lookUp: 0, fov: 46, turn: 2 } },
  bonnet: { name: 'Bonnet', persp: { back: -0.9, up: 1.6, look: 22, lookUp: 0.9, fov: 70, turn: 14, fixed: true } },
  tv: { name: 'TV', tv: true }
};
export const CAM_ZOOMS = { close: { name: 'Close', k: 0.6 }, near: { name: 'Near', k: 0.78 }, normal: { name: 'Normal', k: 1 }, far: { name: 'Far', k: 1.3 } };
const PORTRAIT = 1.25;   // a tall screen sees less road across, so pull out a little (not so far the cars are specks)
let tv = null; const _look = new THREE.Vector3(), _cam = new THREE.Vector3();
// the perspective views: place pcamera behind (or over, or on) the car, or at a trackside spot for TV
function perspCamera(dt, snap, M, c) {
  const tr = G.world.tr, terr = G.world.terr, x = c.dx ?? c.x, y = c.dy ?? c.y, z = c.dz ?? c.z, v = Math.hypot(c.vx, c.vz);
  const hd = M.fixed || v < 4 ? c.yaw : Math.atan2(c.vx, c.vz);
  chaseHd = chaseHd === null || snap ? hd : chaseHd + wrapAngle(hd - chaseHd) * (1 - Math.exp(-dt * (M.turn || 4)));
  const fx = Math.sin(chaseHd), fz = Math.cos(chaseHd), aspect = innerWidth / innerHeight;
  if (M.tv) {
    // a camera on a pole beside the road ahead; once you're well past it, the next one goes up further on
    const i = c.pr.i, far = tv && Math.hypot(x - tv.x, z - tv.z) > 48 && ((x - tv.x) * fx + (z - tv.z) * fz) > 0;
    if (!tv || snap || far) {
      const j = tr.nx ? tr.adv(i, 45) : Math.min(tr.N - 2, i + 45), side = tv && tv.side > 0 ? -1 : 1, lat = side * 15;
      const px = tr.xs[j] + tr.rx[j] * lat, pz = tr.zs[j] + tr.rz[j] * lat;
      tv = { x: px, z: pz, y: Math.max(terr.at(px, pz), tr.H[j]) + 6, side };
    }
    _cam.set(tv.x, tv.y, tv.z); _look.set(x, y + 0.8, z);
    const d = _cam.distanceTo(_look); pcamera.fov = clamp(2 * Math.atan(9 / d) * 180 / Math.PI, 14, 60);   // zoom in as you get further away
  } else {
    const k = M.fixed ? 1 : (CAM_ZOOMS[G.camZoom] || CAM_ZOOMS.normal).k, tall = aspect < 1 && !M.fixed ? 1.6 : 1;   // a tall screen: higher up, looking down more (less sky)
    _cam.set(x - fx * M.back * k, y + M.up * k * tall, z - fz * M.back * k);
    _cam.y = Math.max(_cam.y, terr.at(_cam.x, _cam.z) + 1.2, tr.H[c.pr.i] + 0.8);   // never inside a bank
    _look.set(x + fx * M.look / tall, y + M.lookUp / tall, z + fz * M.look / tall);
    pcamera.fov = (aspect < 1 ? M.fov * 1.15 : M.fov) + clamp(v - 20, 0, 30) * 0.25;   // a touch wider at speed
  }
  const kk = snap ? 1 : 1 - Math.exp(-dt * (M.tv ? 30 : 12));
  pcamera.position.lerp(_cam, kk); pcamera.aspect = aspect; pcamera.updateProjectionMatrix();
  pcamera.lookAt(_look); pcamera.position.add(shakeOff);
  // the rest of the game follows along: shadows and snow round what's in view, and "which way is screen-up" for touch
  camT.set(x + fx * 22, y, z + fz * 22);
  camDir.copy(pcamera.position).sub(_look).normalize();
}
const camDir = CAM_DIR.clone(), _want = new THREE.Vector3(); let chaseHd = null;
export const camT = new THREE.Vector3();
export const shakeOff = new THREE.Vector3();
// ---------- camera ----------
// the shadow camera's own right/up axes (as lookAt builds them), used to snap it to its texel grid
export const SUN_Z = new THREE.Vector3(-50, 95, -20).normalize(), SUN_U = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), SUN_Z).normalize(), SUN_V = new THREE.Vector3().crossVectors(SUN_Z, SUN_U);
// The see-through window (materials.js withCutaway: whatever is in the way turns translucent) opens round the player's
// car in long covered stretches (tunnels, galleries), under a bridge, and wherever the ground between the camera and
// the car rises above it (a bank or hillside in front of a low camera); it eases open and shut.
const CUT_R = 20;
function updateCut(dt, snap) {
  if (!race || G.state === 'menu') { CUT.r.value = CUT.r2.value = 0; return; }
  const P = race.player; CUT.car.value.set(P.x, P.y, P.z);
  const covered = G.world.cover[G.world.tr.bi(P.pr.i)], hill = !covered && hidden(P), want = covered || hill || overBridge(P) || behindHouse(P) ? CUT_R : 0;
  CUT.r.value += (want - CUT.r.value) * (snap ? 1 : Math.min(1, dt * 6));
  if (hill) CUT.lift.value = 0.5; else if (CUT.r.value < 0.5) CUT.lift.value = 1.4;   // a hillside in the way sits low: cut closer to the car's height
  // the road ahead: a hillside between the camera and where the player is about to drive opens its own window there
  const tr = G.world.tr, ahead = [18, 32].map(k => tr.loopN ? tr.nb0(P.pr.i, k) : Math.min(tr.N - 1, P.pr.i + k)).find(j => hidden({ x: tr.xs[j], y: tr.H[j], z: tr.zs[j] }));
  if (ahead !== undefined) CUT.ahead.value.lerp(_ah.set(tr.xs[ahead], tr.H[ahead], tr.zs[ahead]), snap || CUT.r2.value < 0.5 ? 1 : Math.min(1, dt * 4));
  CUT.r2.value += ((ahead !== undefined ? CUT_R : 0) - CUT.r2.value) * (snap ? 1 : Math.min(1, dt * 6));
}
const _ah = new THREE.Vector3();
function hidden(P) {
  const T = G.world.W.terr, d = CUT.dir.value, y0 = P.y + 1.2;   // step back along the view line from the car's roof
  for (let t = 2; t < 70; t += 1.5) if (T.at(P.x + d.x * t, P.z + d.z * t) > y0 + d.y * t + 0.3) return true;
  return false;
}
// a building (render/elements/town.js) standing on the view line between the car and the camera
function behindHouse(P) {
  if (!houseBoxes.length) return false;
  const d = CUT.dir.value, near = houseBoxes.filter(b => Math.abs(b.x - P.x) < 70 && Math.abs(b.z - P.z) < 70); if (!near.length) return false;
  for (let t = 1; t < 60; t += 1) {
    const x = P.x + d.x * t, y = P.y + 1 + d.y * t, z = P.z + d.z * t;
    for (const b of near) { const dx = x - b.x, dz = z - b.z; if (y > b.y0 && y < b.y1 && Math.abs(dx * b.c - dz * b.s) < b.hd && Math.abs(dx * b.s + dz * b.c) < b.hw) return true; }
  }
  return false;
}
// a bridge deck (another road's) crossing the view line above the car
let brTr = null, brI = [];
function overBridge(P) {
  const tr = G.world.tr; if (brTr !== tr) { brTr = tr; brI = []; for (let i = 0; i < tr.N; i++) if (tr.bridge[i]) brI.push(i); }
  const d = CUT.dir.value, h = Math.hypot(d.x, d.z) || 1, ux = d.x / h, uz = d.z / h, rise = d.y / h;
  for (const i of brI) {
    const dx = tr.xs[i] - P.x, dz = tr.zs[i] - P.z, s = dx * ux + dz * uz; if (s < -WALL || s > 60) continue;   // along the view line, on the ground
    if (Math.abs(dx * uz - dz * ux) > WALL + 2) continue;
    if (tr.H[i] - 1 > P.y + 1.2 && tr.H[i] + 1 > P.y + rise * Math.max(0, s - WALL)) return true;          // over the car, and its near edge and parapet reach the line
  }
  return false;
}
export function updateCamera(dt, snap) {
  if (!G.world) return;
  updateCut(dt, snap);
  let tx, ty, tz, sp = 0;
  if (G.state === 'menu' || !race) {
    const tr = G.world.tr; const prev = G.attractS; G.attractS = (G.attractS + dt * 15) % (tr.loopN || tr.finishIdx);
    const i = Math.floor(G.attractS); tx = tr.xs[i]; tz = tr.zs[i]; ty = tr.H[i];
    if (G.attractS < prev) snap = true;
  } else if (race.sd && race.sd.focus) {
    // Showdown: frame the leader (the core decides who that is, and judges who has dropped off this view)
    const f = race.sd.focus; tx = f.x; ty = f.y; tz = f.z; if (race.sd.camSnap) { race.sd.camSnap = false; snap = true; }
  } else if (race.derby && G.world.tr.arena) {
    // a derby: frame the fight, the player and the cars still running near them, pulled towards the arena's middle
    const A = G.world.tr.arena, P = race.player, live = race.cars.filter(c => !c.out && Math.hypot(c.x - P.x, c.z - P.z) < 40);
    let x0 = P.x, x1 = P.x, z0 = P.z, z1 = P.z; for (const c of live) { x0 = Math.min(x0, c.x); x1 = Math.max(x1, c.x); z0 = Math.min(z0, c.z); z1 = Math.max(z1, c.z); }
    tx = ((x0 + x1) / 2) * 0.7 + A.x * 0.3; tz = ((z0 + z1) / 2) * 0.7 + A.z * 0.3; ty = A.floor; G.derbyFit = clamp(Math.max(x1 - x0, z1 - z0) * 1.3 + 22, 40, A.r * 2.2);
  } else {
    const c = race.player; sp = Math.hypot(c.vx, c.vz); tx = (c.dx ?? c.x) + c.vx * 0.42; tz = (c.dz ?? c.z) + c.vz * 0.42; ty = c.dy ?? c.y;
  }
  // which way the camera looks: the chosen mode (the menu's attract view is always classic), eased when it changes
  let mode = G.state === 'menu' || !race ? 'classic' : G.camMode in CAM_MODES ? G.camMode : 'classic';
  const PM = CAM_MODES[mode]; if ((PM.persp || PM.tv) && race.sd) mode = 'chase';
  if (race && race.derby && G.state !== 'menu') mode = 'classic';   // a derby: the overhead view, fitted to the fight
  G.persp = !!((PM.persp || PM.tv) && !race.sd && !(race && race.derby));
  if (G.persp) {
    const was = G.perspWas; G.perspWas = true;
    G.shake *= Math.exp(-dt * 7);
    if (G.shake > 0.01 && !matchMedia('(prefers-reduced-motion: reduce)').matches) shakeOff.set((Math.random() - 0.5), (Math.random() - 0.5) * 0.6, (Math.random() - 0.5)).multiplyScalar(G.shake * 0.35); else shakeOff.set(0, 0, 0);
    perspCamera(dt, snap || !was, PM.persp || PM, race.player);
    G.camDir = [camDir.x, camDir.y, camDir.z]; race.camDir = G.camDir; CUT.dir.value.copy(camDir);
    followSun(); return;
  }
  G.perspWas = false; tv = null;
  if (mode === 'chase') {
    const c = (race.sd && sdLeader(race)) || race.player, v = Math.hypot(c.vx, c.vz), hd = v > 4 ? Math.atan2(c.vx, c.vz) : c.yaw;
    chaseHd = chaseHd === null || snap ? hd : chaseHd + wrapAngle(hd - chaseHd) * (1 - Math.exp(-dt * 2.2));
    const el = CAM_MODES.chase.el; _want.set(-Math.sin(chaseHd) * Math.cos(el), Math.sin(el), -Math.cos(chaseHd) * Math.cos(el));
    if (!race.sd) { tx += Math.sin(chaseHd) * 7; tz += Math.cos(chaseHd) * 7; }   // look further up the road: it's up the screen
  } else { chaseHd = null; _want.set(...CAM_MODES[mode].dir).normalize(); }
  camDir.lerp(_want, snap ? 1 : 1 - Math.exp(-dt * 5)).normalize();
  G.camDir = [camDir.x, camDir.y, camDir.z]; if (race) race.camDir = G.camDir;   // the touch wheel and Showdown's "on screen" follow it
  const k = snap ? 1 : 1 - Math.exp(-dt * (G.state === 'menu' ? 2.5 : 5));
  camT.x += (tx - camT.x) * k; camT.y += (ty - camT.y) * k; camT.z += (tz - camT.z) * k;
  const aspect = innerWidth / innerHeight; let vh = 38 + clamp(sp, 0, 45) * 0.26;
  if (race && G.state !== 'menu' && race.sd) race.aspect = aspect;   // Showdown: the core picks the zoom (to fit the pack) for this screen shape
  else if (race && G.state !== 'menu') {
    // pull out where the ground falls away in front of the camera (ledges, bridges), pull in through town streets
    const c = race.player, tr = G.world.tr, drop = c.y - G.world.terr.at(c.x + 16, c.z + 16);
    vh += clamp((drop - 12) * 0.35, 0, 16);
    if (tr.town && tr.town[tr.bi(c.pr.i)]) vh -= 6;
  }
  if (race && race.derby && G.state !== 'menu' && G.world.tr.arena) vh = G.derbyFit || 50;
  if (aspect < 1) vh *= PORTRAIT;
  if (Math.min(innerWidth, innerHeight) < 520) vh *= 0.85;                            // a phone: the cars were specks
  if (G.state === 'menu') vh = 58; else vh *= (CAM_ZOOMS[G.camZoom] || CAM_ZOOMS.normal).k;
  if (race && G.state !== 'menu' && race.sd && race.sd.view) G.viewH = 2 * race.sd.view.hh;   // already eased by the core
  else G.viewH += (vh - G.viewH) * (snap ? 1 : 1 - Math.exp(-dt * 2));
  camera.left = -G.viewH * aspect / 2; camera.right = G.viewH * aspect / 2; camera.top = G.viewH / 2; camera.bottom = -G.viewH / 2; camera.updateProjectionMatrix();
  G.shake *= Math.exp(-dt * 7);
  if (G.shake > 0.01 && !matchMedia('(prefers-reduced-motion: reduce)').matches) shakeOff.set((Math.random() - 0.5), (Math.random() - 0.5) * 0.6, (Math.random() - 0.5)).multiplyScalar(G.shake * 1.1); else shakeOff.set(0, 0, 0);
  camera.position.copy(camT).add(shakeOff).addScaledVector(camDir, 300); camera.lookAt(_v1.copy(camT).add(shakeOff));
  CUT.dir.value.copy(camDir);                                                        // the see-through window looks along the view
  followSun();
}
function followSun() {
  // move the shadow camera in whole shadow-map texels so shadow edges don't crawl as the camera moves
  const tex = (sun.shadow.camera.right - sun.shadow.camera.left) / sun.shadow.mapSize.x;
  const a0 = camT.dot(SUN_U), b0 = camT.dot(SUN_V);
  _v3.copy(camT).addScaledVector(SUN_U, Math.round(a0 / tex) * tex - a0).addScaledVector(SUN_V, Math.round(b0 / tex) * tex - b0);
  sun.position.set(_v3.x - 50, _v3.y + 95, _v3.z - 20); sun.target.position.copy(_v3); sun.target.updateMatrixWorld();
}
