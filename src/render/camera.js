import * as THREE from 'three';
import { G } from '../game.js';
import { clamp, wrapAngle } from '../core/math.js';
import { sdLeader } from '../core/modes/showdown.js';
import { CAM_DIR as CORE_CAM_DIR } from '../core/constants.js';
import { camera, sun } from './renderer.js';
import { _v1, _v3 } from './vehicles.js';
import { race } from '../ui/flow.js';

export const CAM_DIR = new THREE.Vector3(...CORE_CAM_DIR);
// Camera settings (menu / pause, C while racing). dir points from the car toward the camera; chase has no fixed
// dir: it swings round to stay behind the car it follows, el up from the ground. Zoom scales the view height.
export const CAM_MODES = {
  classic: { name: 'Classic', dir: CORE_CAM_DIR },
  overhead: { name: 'Overhead', dir: [1, 3.5, 1] },
  low: { name: 'Low', dir: [1, 0.82, 1] },
  chase: { name: 'Chase', el: 0.72 }
};
export const CAM_ZOOMS = { near: { name: 'Near', k: 0.78 }, normal: { name: 'Normal', k: 1 }, far: { name: 'Far', k: 1.3 } };
const camDir = CAM_DIR.clone(), _want = new THREE.Vector3(); let chaseHd = null;
export const camT = new THREE.Vector3();
export const shakeOff = new THREE.Vector3();
// ---------- camera ----------
// the shadow camera's own right/up axes (as lookAt builds them), used to snap it to its texel grid
export const SUN_Z = new THREE.Vector3(-50, 95, -20).normalize(), SUN_U = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), SUN_Z).normalize(), SUN_V = new THREE.Vector3().crossVectors(SUN_Z, SUN_U);
export function updateCamera(dt, snap) {
  if (!G.world) return;
  let tx, ty, tz, sp = 0;
  if (G.state === 'menu' || !race) {
    const tr = G.world.tr; const prev = G.attractS; G.attractS = (G.attractS + dt * 15) % (tr.loopN || tr.finishIdx);
    const i = Math.floor(G.attractS); tx = tr.xs[i]; tz = tr.zs[i]; ty = tr.H[i];
    if (G.attractS < prev) snap = true;
  } else if (race.sd && race.sd.focus) {
    // Showdown: frame the leader (the core decides who that is, and judges who has dropped off this view)
    const f = race.sd.focus; tx = f.x; ty = f.y; tz = f.z; if (race.sd.camSnap) { race.sd.camSnap = false; snap = true; }
  } else {
    const c = race.player; sp = Math.hypot(c.vx, c.vz); tx = (c.dx ?? c.x) + c.vx * 0.42; tz = (c.dz ?? c.z) + c.vz * 0.42; ty = c.dy ?? c.y;
  }
  // which way the camera looks: the chosen mode (the menu's attract view is always classic), eased when it changes
  const mode = G.state === 'menu' || !race ? 'classic' : G.camMode in CAM_MODES ? G.camMode : 'classic';
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
  const aspect = innerWidth / innerHeight; let vh = 44 + clamp(sp, 0, 45) * 0.3;
  if (race && G.state !== 'menu' && race.sd) race.aspect = aspect;   // Showdown: the core picks the zoom (to fit the pack) for this screen shape
  else if (race && G.state !== 'menu') {
    // pull out where the ground falls away in front of the camera (ledges, bridges), pull in through town streets
    const c = race.player, tr = G.world.tr, drop = c.y - G.world.terr.at(c.x + 16, c.z + 16);
    vh += clamp((drop - 12) * 0.35, 0, 16);
    if (tr.town && tr.town[tr.bi(c.pr.i)]) vh -= 6;
  }
  if (aspect < 1) vh *= 1.55; if (G.state === 'menu') vh = 58; else vh *= (CAM_ZOOMS[G.camZoom] || CAM_ZOOMS.normal).k;
  if (race && G.state !== 'menu' && race.sd && race.sd.view) G.viewH = 2 * race.sd.view.hh;   // already eased by the core
  else G.viewH += (vh - G.viewH) * (snap ? 1 : 1 - Math.exp(-dt * 2));
  camera.left = -G.viewH * aspect / 2; camera.right = G.viewH * aspect / 2; camera.top = G.viewH / 2; camera.bottom = -G.viewH / 2; camera.updateProjectionMatrix();
  G.shake *= Math.exp(-dt * 7);
  if (G.shake > 0.01 && !matchMedia('(prefers-reduced-motion: reduce)').matches) shakeOff.set((Math.random() - 0.5), (Math.random() - 0.5) * 0.6, (Math.random() - 0.5)).multiplyScalar(G.shake * 1.1); else shakeOff.set(0, 0, 0);
  camera.position.copy(camT).add(shakeOff).addScaledVector(camDir, 300); camera.lookAt(_v1.copy(camT).add(shakeOff));
  // move the shadow camera in whole shadow-map texels so shadow edges don't crawl as the camera moves
  const tex = (sun.shadow.camera.right - sun.shadow.camera.left) / sun.shadow.mapSize.x;
  const a0 = camT.dot(SUN_U), b0 = camT.dot(SUN_V);
  _v3.copy(camT).addScaledVector(SUN_U, Math.round(a0 / tex) * tex - a0).addScaledVector(SUN_V, Math.round(b0 / tex) * tex - b0);
  sun.position.set(_v3.x - 50, _v3.y + 95, _v3.z - 20); sun.target.position.copy(_v3); sun.target.updateMatrixWorld();
}
