import * as THREE from 'three';
import { G } from '../game.js';
import { AudioSys } from '../audio/audio.js';
import { HALF } from '../core/constants.js';
import { clamp, smoothstep, wrapAngle } from '../core/math.js';
import { railAt } from '../core/track/rails.js';
import { spawnProp } from './effects/props.js';
import { race } from '../ui/flow.js';

// level crossings: posts with lamps, a crossbuck and a barrier arm on each road edge
export let crossVis = [];
export function addCrossings(group, tr) {
  crossVis = []; const rl = tr.rails; if (!rl) return;
  const M = c => new THREE.MeshLambertMaterial({ color: c }), B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  for (const C of rl.crossings) {
    const i = C.i, rp = railAt(C.line, C.s), H = tr.H[i];
    const vis = { C, t: 0, gates: [], lamps: [], flash: 0 };
    // one gate each side of the rails: on the right-hand edge before them and the left-hand edge after them (both directions covered)
    const cross = Math.abs(Math.sin(wrapAngle(rp.yaw - tr.th[i]))), setBack = Math.round(4 + HALF * Math.sqrt(Math.max(0, 1 - cross * cross)) / Math.max(0.3, cross) + 2.5);   // clear of a diagonal track
    for (const [side, along] of [[1, -1], [-1, 1]]) {
      const j = i + along * setBack, jj = tr.loopN ? (j + tr.loopN) % tr.loopN : j;
      const px = tr.xs[jj] + tr.rx[jj] * side * (HALF + 1.4), pz = tr.zs[jj] + tr.rz[jj] * side * (HALF + 1.4), gy = tr.H[jj];
      const post = new THREE.Mesh(B(0.3, 2.6, 0.3), M(0xE8E8E8)); post.position.set(px, gy + 1.3, pz); post.castShadow = true; group.add(post);
      const cb = new THREE.Group(); cb.position.set(px, gy + 3.0, pz); cb.rotation.y = tr.th[jj]; group.add(cb);
      for (const r of [0.75, -0.75]) { const bar = new THREE.Mesh(B(1.5, 0.22, 0.06), M(0xF4F4F0)); bar.rotation.z = r; cb.add(bar); }
      const lampM = [new THREE.MeshBasicMaterial({ color: 0x3A1410 }), new THREE.MeshBasicMaterial({ color: 0x3A1410 })];
      for (const [k, dx] of [[0, -0.32], [1, 0.32]]) { const l = new THREE.Mesh(B(0.26, 0.26, 0.12), lampM[k]); l.position.set(dx, -0.62, 0.1); cb.add(l); }
      vis.lamps.push(lampM);
      // barrier arm: pivot on the post, arm reaches across to just past the centre line
      const pivot = new THREE.Group(); pivot.position.set(px, gy + 1.05, pz);
      pivot.rotation.y = Math.atan2(-tr.rx[jj] * side, -tr.rz[jj] * side) - Math.PI / 2;   // local +x points across the road
      group.add(pivot);
      const arm = new THREE.Group(); pivot.add(arm);
      const len = HALF + 1.6;
      for (let k = 0; k < 5; k++) { const seg = new THREE.Mesh(B(len / 5, 0.16, 0.1), M(k % 2 ? 0xF4F4F0 : 0xD8352A)); seg.position.x = (k + 0.5) * len / 5; seg.castShadow = true; arm.add(seg); }
      vis.gates.push({ pivot, arm, len, broken: false, px, pz, dirx: -tr.rx[jj] * side, dirz: -tr.rz[jj] * side, gy });
    }
    crossVis.push(vis);
  }
}
export let bellT = 0;
export function updateCrossings(dt, now) {
  if (!race) return;
  const P = race.player, cars = race.cars.concat(race.traffic);
  for (const v of crossVis) {
    const closed = v.C.closed;
    v.t = clamp(v.t + (closed ? dt : -dt) / 1.2, 0, 1);
    const ang = (1 - smoothstep(0, 1, v.t)) * Math.PI * 0.47;
    const on = closed && Math.floor(now * 2.4) % 2 === 0;
    v.lamps.forEach(([a, b]) => { a.color.setHex(closed ? (on ? 0xFF3B26 : 0x3A1410) : 0x3A1410); b.color.setHex(closed ? (on ? 0x3A1410 : 0xFF3B26) : 0x3A1410); });
    for (const g of v.gates) {
      g.pivot.rotation.z = ang;
      if (g.broken && v.t < 0.02) { g.broken = false; g.arm.visible = true; }
      if (!g.broken && v.t > 0.6) for (const c of cars) {          // driving through a lowered arm snaps it off
        const mx = g.px + g.dirx * g.len / 2, mz = g.pz + g.dirz * g.len / 2, sp = Math.hypot(c.vx, c.vz);
        if (sp > 3 && Math.hypot(c.x - mx, c.z - mz) < g.len / 2 + 0.6 && Math.abs(((c.x - g.px) * -g.dirz + (c.z - g.pz) * g.dirx)) < 1.6) {
          g.broken = true; g.arm.visible = false;
          const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(g.dirx, g.dirz) + Math.PI / 2);
          spawnProp('box', new THREE.Vector3(mx, g.gy + 1.05, mz), q, [g.len, 0.16, 0.1], 0xD8352A, c.vx * 0.7, 4, c.vz * 0.7, 8, 'wood');
          if (c.isPlayer) AudioSys.crash('wood', 0.5);
          break;
        }
      }
    }
    // bells while the barrier is down and the player is close
    if (closed && Math.hypot(P.x - tr_x(v), P.z - tr_z(v)) < 90) { bellT -= dt; if (bellT <= 0) { bellT = 0.45; AudioSys.bell(); } }
  }
}
export function tr_x(v) { return G.world.tr.xs[v.C.i]; }
export function tr_z(v) { return G.world.tr.zs[v.C.i]; }
