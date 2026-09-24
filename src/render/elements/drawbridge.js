import * as THREE from 'three';
import { G } from '../../game.js';
import { AudioSys } from '../../audio/audio.js';
import { HALF, WALL } from '../../core/constants.js';
import { DRAW } from '../../core/elements/drawbridge.js';
import { flat } from '../geometry.js';
import { withCutaway } from '../materials.js';
import { race } from '../../ui/flow.js';

// Drawbridge visuals: the mill race under it, stone abutments, the two steel leaves (asphalt deck, red girders,
// railings, hazard stripes at the tips) hinged at each bank, a gate and signal at the approach, and the bells while
// it's warning or moving. The leaves follow W.draws (core/features/drawbridge.js).
const L = c => new THREE.MeshLambertMaterial({ color: c });
const box = (w, h, d, m, x, y, z, parent) => { const b = new THREE.Mesh(flat(new THREE.BoxGeometry(w, h, d)), m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; parent.add(b); return b; };
let vis = [], bellT = 0;
export function addDrawbridges(group, tr) {
  vis = [];
  const deck = L(0x4A4E56), girder = L(0xB8392C), stone = L(0x8F8A80), white = L(0xF2F2EE), yel = L(0xFFC72C), blk = L(0x262626), dark = L(0x2B2F3A);
  const water = withCutaway(new THREE.MeshLambertMaterial({ color: 0x3E7DAE }), false, { cut: false, cloud: true, water: true });
  for (const d of tr.drawbridges || []) {
    const len = d.b - d.a, half = len / 2, mid = d.a + half, i = Math.round(mid);
    const root = new THREE.Group(); root.position.set(tr.xs[i] + tr.tx[i] * (mid - i), d.h, tr.zs[i] + tr.tz[i] * (mid - i)); root.rotation.y = tr.th[d.a]; group.add(root);
    const pond = new THREE.Mesh(new THREE.PlaneGeometry(90, len + 2).rotateX(-Math.PI / 2), water); pond.position.y = -6.5; pond.receiveShadow = true; root.add(pond);
    for (const s of [-1, 1]) box(2 * WALL + 3, 7, 3, stone, 0, -3.6, s * (half + 1.4), root);   // abutments
    const leaves = [-1, 1].map(s => {                                                   // s = -1 the near leaf, hinged at the near bank
      const pivot = new THREE.Group(); pivot.position.set(0, 0, s * half); root.add(pivot);
      const g = new THREE.Group(); g.position.z = -s * half / 2; pivot.add(g);
      box(2 * HALF + 0.6, 0.5, half, deck, 0, -0.26, 0, g);
      for (const x of [-1, 1]) {
        box(0.35, 0.9, half, girder, x * (HALF + 0.5), -0.55, 0, g);
        box(0.12, 0.12, half, white, x * (HALF + 0.55), 0.9, 0, g);
        for (let k = 0; k < 4; k++) box(0.12, 0.9, 0.12, white, x * (HALF + 0.55), 0.45, -half / 2 + (k + 0.5) * half / 4, g);
      }
      for (let k = 0; k < 6; k++) box((2 * HALF) / 6, 0.03, 0.6, k % 2 ? yel : blk, -HALF + (k + 0.5) * 2 * HALF / 6, 0.01, -s * (half / 2 - 0.3), g);   // hazard stripes at the tip
      box(2 * HALF + 2, 1.4, 1.2, dark, 0, -1.2, s * half / 2 - s * 0.2, g);            // counterweight end
      return pivot;
    });
    // the gate and signal at the approach, and a signal on the far bank for the other way round
    const gate = new THREE.Group(); gate.position.set(-(WALL - 0.3), 0, -half - 3); root.add(gate);
    box(0.4, 1.4, 0.4, dark, 0, 0.7, 0, gate);
    const arm = new THREE.Group(); arm.position.set(0, 1.25, 0); gate.add(arm);
    for (let k = 0; k < 6; k++) box(2 * WALL / 6, 0.22, 0.18, k % 2 ? yel : L(0xE0402F), (k + 0.5) * 2 * WALL / 6, 0, 0, arm);
    const lamps = [];
    for (const [x, z] of [[-(WALL + 1.2), -half - 3], [WALL + 1.2, -half - 3]]) {
      box(0.3, 3.2, 0.3, dark, x, 1.6, z, root);
      for (const dx of [-0.3, 0.3]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0x551511 })); l.position.set(x + dx, 3.3, z - 0.2); root.add(l); lamps.push(l); }
    }
    const hut = new THREE.Group(); hut.position.set(WALL + 4, 0, half + 4); root.add(hut);   // the bridge keeper's hut
    box(3, 2.6, 3, white, 0, 1.3, 0, hut); box(3.6, 0.4, 3.6, girder, 0, 2.8, 0, hut); box(2.2, 0.8, 0.1, L(0x253450), 0, 1.7, -1.52, hut);
    vis.push({ k: vis.length, leaves, arm, armA: 1.35, lamps, root });
  }
}
export function updateDrawbridges(dt, now) {
  const W = G.world && G.world.W; if (!vis.length || !W || !W.draws) return;
  const P = race && race.player; let ring = false;
  for (const v of vis) {
    const d = W.draws[v.k]; if (!d) continue;
    v.leaves[0].rotation.x = -d.ang; v.leaves[1].rotation.x = d.ang;
    const shut = d.ang > DRAW.AJUMP, warn = d.st !== 'down';
    v.armA += ((shut ? 0 : 1.35) - v.armA) * Math.min(1, dt * 3); v.arm.rotation.z = v.armA;
    const on = warn && Math.floor(now * 3) % 2;
    v.lamps.forEach((l, j) => l.material.color.setHex(warn && (j % 2 ? on : !on) ? 0xFF3A22 : 0x551511));
    if (warn && d.st !== 'up' && P && v.root.position.distanceTo(new THREE.Vector3(P.x, P.y, P.z)) < 160) ring = true;
  }
  if (ring) { bellT -= dt; if (bellT <= 0) { bellT = 0.45; AudioSys.bell(); } }
}
