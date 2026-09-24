import * as THREE from 'three';
import { G } from '../../game.js';
import { AudioSys } from '../../audio/audio.js';
import { clamp } from '../../core/math.js';
import { groundAt, project } from '../../core/track/query.js';
import { _c, _m, _p, _s, flat } from '../geometry.js';
import { scene } from '../renderer.js';
import { _ax, _mr, _qa, _qb, _up } from '../world/barriers.js';
import { race } from '../../ui/flow.js';

// ---------- loose props (knocked-off tyres, posts, rails, bales) ----------
export const PROPS = { box: { max: 220 }, tyre: { max: 140 } };
export function initProps() {
  for (const [k, geo] of [['box', flat(new THREE.BoxGeometry(1, 1, 1))], ['tyre', flat(new THREE.CylinderGeometry(0.55, 0.55, 0.42, 12))]]) {
    const P = PROPS[k];
    P.mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), P.max);
    P.mesh.frustumCulled = false; P.mesh.castShadow = true; P.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    P.data = []; P.head = 0; _m.makeScale(0, 0, 0);
    for (let i = 0; i < P.max; i++) { P.data.push({ on: false, q: new THREE.Quaternion(), w: new THREE.Vector3() }); P.mesh.setMatrixAt(i, _m); _c.set(0xffffff); P.mesh.setColorAt(i, _c); }
    scene.add(P.mesh);
  }
}
export function spawnProp(kind, pos, quat, dims, color, vx, vy, vz, spin, snd) {
  const P = PROPS[kind], i = P.head; P.head = (P.head + 1) % P.max; const d = P.data[i];
  const [sx, sy, sz] = dims || [1, 1, 1];
  Object.assign(d, { on: true, rest: false, x: pos.x, y: pos.y, z: pos.z, vx, vy, vz, sx, sy, sz, cool: 0.25, snd, hint: race ? race.player.pr.i : 0,
    hx: kind === 'tyre' ? 0.55 : sx / 2, hy: kind === 'tyre' ? 0.21 : sy / 2, hz: kind === 'tyre' ? 0.55 : sz / 2 });
  d.r = Math.max(d.hx, d.hy, d.hz); d.q.copy(quat); d.w.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(spin);
  _c.set(color); P.mesh.setColorAt(i, _c); P.mesh.instanceColor.needsUpdate = true;
}
export function clearProps() {
  _m.makeScale(0, 0, 0);
  for (const P of Object.values(PROPS)) { if (!P.mesh) continue; P.data.forEach((d, i) => { d.on = false; P.mesh.setMatrixAt(i, _m); }); P.mesh.instanceMatrix.needsUpdate = true; }
}
export let propSndT = 0;
export function updateProps(dt) {
  if (!G.world || !G.world.W.bar) return;
  const W = G.world.W, tr = W.tr, cars = race ? race.cars.concat(race.traffic, race.parked) : [];
  propSndT -= dt;
  for (const P of Object.values(PROPS)) {
    let dirty = false;
    for (let i = 0; i < P.max; i++) {
      const d = P.data[i]; if (!d.on) continue;
      if (d.cool > 0) d.cool -= dt;
      else for (const c of cars) {          // cars bat loose props out of the way
        const dx = d.x - c.x, dz = d.z - c.z, rr = 1.7 + d.r, sp = Math.hypot(c.vx, c.vz);
        if (sp < 2 || dx * dx + dz * dz > rr * rr || Math.abs(d.y - c.y - 0.6) > 1.8) continue;
        const dl = Math.hypot(dx, dz) || 1, k = 0.9 + Math.random() * 0.4;
        d.vx = c.vx * k + dx / dl * (2 + sp * 0.2); d.vz = c.vz * k + dz / dl * (2 + sp * 0.2); d.vy = 2 + sp * (0.08 + Math.random() * 0.12);
        d.w.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(3 + sp * 0.3);
        d.rest = false; d.cool = 0.35; c.vx *= 0.99; c.vz *= 0.99;
        if (c.isPlayer && sp > 6 && propSndT <= 0) { AudioSys.crash(d.snd, clamp(sp / 45, 0.08, 0.45)); propSndT = 0.08; }
        break;
      }
      if (d.rest) continue;
      dirty = true;
      d.vy -= 30 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      const wl = d.w.length(); if (wl > 1e-4) { _ax.copy(d.w).divideScalar(wl); _qa.setFromAxisAngle(_ax, wl * dt); d.q.premultiply(_qa); }
      const pr = project(tr, d.x, d.z, d.hint, 30, 30); d.hint = pr.i;
      _mr.makeRotationFromQuaternion(d.q); const e = _mr.elements;
      const hy = Math.abs(e[1]) * d.hx + Math.abs(e[5]) * d.hy + Math.abs(e[9]) * d.hz;
      const gy = groundAt(W, pr.s, pr.lat, d.x, d.z) + hy;
      if (d.y <= gy) {
        d.y = gy; if (d.vy < 0) d.vy = -d.vy * 0.3;
        const f = Math.exp(-dt * 4); d.vx *= f; d.vz *= f; d.w.multiplyScalar(Math.exp(-dt * 5));
        // settle flat: turn the most upright local axis toward straight up
        let kb = 0; for (let a = 1; a < 3; a++) if (Math.abs(e[a * 4 + 1]) > Math.abs(e[kb * 4 + 1])) kb = a;
        const sg = e[kb * 4 + 1] >= 0 ? 1 : -1; _ax.set(e[kb * 4] * sg, e[kb * 4 + 1] * sg, e[kb * 4 + 2] * sg);
        _qa.setFromUnitVectors(_ax, _up); _qb.identity().slerp(_qa, Math.min(1, dt * 6)); d.q.premultiply(_qb);
        if (Math.abs(d.vy) < 1.5 && Math.hypot(d.vx, d.vz) < 0.6 && d.w.length() < 0.6) { d.rest = true; d.vy = 0; }
      }
      if (d.y < -2000) { d.on = false; _m.makeScale(0, 0, 0); P.mesh.setMatrixAt(i, _m); continue; }
      _p.set(d.x, d.y, d.z); _s.set(d.sx, d.sy, d.sz); _m.compose(_p, d.q, _s); P.mesh.setMatrixAt(i, _m);
    }
    if (dirty) P.mesh.instanceMatrix.needsUpdate = true;
  }
}
