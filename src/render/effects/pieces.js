import * as THREE from 'three';
import { G } from '../../game.js';
import { groundAt, project } from '../../core/track/query.js';
import { scene } from '../renderer.js';

// Loose car pieces: real parts of a car's model (wheels, bumper, wing, spoiler struts, lights) knocked off and left
// tumbling and bouncing down the road, then sinking away. flingPiece() throws one part; breakApart() takes a car to
// bits (a wreck, a takedown, a Showdown blow-up; a destruction derby would call it too). Pieces are clones sharing the
// car's geometry and materials, dirt and dents included; the originals stay hidden until repairCarVis puts them back.
const MAX = 48, GRAV = 30, _box = new THREE.Box3(), _v = new THREE.Vector3(), _ax = new THREE.Vector3(), _qa = new THREE.Quaternion();
let live = [];
/** Throw part `src` (an Object3D on a car) off at (vx, vy, vz) m/s, tumbling at `spin` rad/s. Hides the original. */
export function flingPiece(src, vx, vy, vz, spin, { life = 7, hint = 0, keep = false } = {}) {
  if (!src || !src.visible) return null;
  src.updateWorldMatrix(true, true);
  const o = src.clone(true); src.matrixWorld.decompose(o.position, o.quaternion, o.scale);
  o.traverse(m => { if (m.isMesh) m.castShadow = true; });
  scene.add(o); o.updateMatrixWorld(true);
  _box.setFromObject(o); _box.getSize(_v); const r = Math.max(0.12, Math.min(_v.x, _v.y, _v.z) / 2), R = Math.max(_v.x, _v.y, _v.z) / 2;
  const p = { o, vx, vy, vz, w: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(spin), age: 0, life, r, R, hint, rest: false, s0: o.scale.clone() };
  live.push(p); if (live.length > MAX) drop(live.shift());
  if (!keep) src.visible = false;
  return p;
}
/** Take car c (render vis v) to pieces: power ~1 for a wreck (all four wheels, the panels), less sheds fewer wheels.
 *  keep: leave the car's own parts showing (a Showdown blow-up, where the car is back on the road at once). */
export function breakApart(c, v, { power = 1, keep = false } = {}) {
  if (!v) return;
  const parts = [...(power >= 1 ? v.wheels : v.wheels.filter(() => Math.random() < power)), v.bumper, v.wing, ...(v.struts || []), ...(v.heads || []).slice(0, 1), ...(v.tails || []).slice(0, 1)];
  for (const m of parts) {
    if (!m || !m.visible) continue;
    m.updateWorldMatrix(true, false); m.getWorldPosition(_v);
    const dx = _v.x - c.x, dz = _v.z - c.z, dl = Math.hypot(dx, dz) || 1, out = (3 + Math.random() * 5) * Math.max(0.5, power);
    flingPiece(m, c.vx * 0.5 + dx / dl * out + (Math.random() - 0.5) * 2, 4 + Math.random() * 6 * power, c.vz * 0.5 + dz / dl * out + (Math.random() - 0.5) * 2, 5 + Math.random() * 9, { hint: c.pr.i, keep, life: 6 + Math.random() * 3 });
  }
  if (!keep && power >= 1) v.broken = true;                                          // no wheels left: the shell drops onto its belly (drawCar)
}
export function updatePieces(dt) {
  if (!live.length || !G.world) return;
  const W = G.world.W, tr = W.tr;
  live = live.filter(p => {
    p.age += dt; if (p.age >= p.life) { drop(p); return false; }
    const o = p.o;
    if (!p.rest) {
      p.vy -= GRAV * dt; o.position.x += p.vx * dt; o.position.y += p.vy * dt; o.position.z += p.vz * dt;
      const wl = p.w.length(); if (wl > 1e-4) { _ax.copy(p.w).divideScalar(wl); _qa.setFromAxisAngle(_ax, wl * dt); o.quaternion.premultiply(_qa); }
      const pr = project(tr, o.position.x, o.position.z, p.hint, 30, 30); p.hint = pr.i;
      const gy = groundAt(W, pr.s, pr.lat, o.position.x, o.position.z) + p.r;
      if (o.position.y < gy) {
        o.position.y = gy; if (p.vy < 0) p.vy = -p.vy * 0.35;
        const f = Math.exp(-dt * 3); p.vx *= f; p.vz *= f; p.w.multiplyScalar(Math.exp(-dt * 2.5));
        if (Math.abs(p.vy) < 1.2 && Math.hypot(p.vx, p.vz) < 0.5) p.rest = true;
      }
    }
    const left = p.life - p.age; if (left < 1) { o.position.y -= dt * p.R * 0.8; o.scale.copy(p.s0).multiplyScalar(Math.max(0.01, left)); }   // sinks and shrinks away
    return true;
  });
}
function drop(p) { scene.remove(p.o); }
export function clearPieces() { for (const p of live) drop(p); live = []; }
