import * as THREE from 'three';
import { G } from '../game.js';
import { AudioSys } from '../audio/audio.js';
import { clamp, lerp } from '../core/math.js';
import { railAt } from '../core/track/rails.js';
import { flat } from './geometry.js';
import { race } from '../ui/flow.js';

// train models: locomotive + coaches, positioned from the core's train state each frame
export let trainVis = [];
export function makeTrainMeshes(group, T) {
  const d = T.L.def, M = c => new THREE.MeshLambertMaterial({ color: c }), meshes = [];
  T.cars.forEach((cl, k) => {
    const g = new THREE.Group(), add = (w, h, dd, c, x, y, z) => { const m = new THREE.Mesh(flat(new THREE.BoxGeometry(w, h, dd)), M(c)); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
    add(2.9, 0.7, cl - 0.4, 0x2A2C31, 0, 0.75, 0);                                     // underframe and bogies
    if (k === 0) {
      add(3.0, 2.3, cl - 3.4, d.body, 0, 2.15, -1.2); add(3.0, 1.1, 3.0, d.body, 0, 1.55, cl / 2 - 1.9);   // body + nose
      add(3.02, 0.55, cl - 3.6, d.band, 0, 2.55, -1.2); add(2.7, 0.3, cl - 3.8, 0x3A3D44, 0, 3.45, -1.2);
      add(2.4, 0.5, 0.1, 0x253450, 0, 2.7, cl / 2 - 3.42);                                                    // windscreen
      const hl = new THREE.Sprite(new THREE.SpriteMaterial({ map: G.glowTex, color: 0xFFF1B0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      hl.scale.set(2.2, 2.2, 1); hl.position.set(0, 1.9, cl / 2 - 0.3); g.add(hl);
    } else {
      add(3.0, 2.4, cl - 0.8, d.coach, 0, 2.2, 0); add(3.02, 0.6, cl - 1.2, d.band, 0, 2.5, 0); add(2.8, 0.25, cl - 1, 0x55585F, 0, 3.52, 0);
    }
    g.visible = false; group.add(g); meshes.push(g);
  });
  return meshes;
}
export function initTrainsVis(group, r = race) { trainVis = r && r.trains ? r.trains.map(T => ({ T, meshes: makeTrainMeshes(group, T) })) : []; }
export let trainHorned = new WeakSet();
export function updateTrainsVis() {
  if (!race || !race.trains) return;
  if (trainVis.length !== race.trains.length || trainVis.some((v, k) => v.T.L !== race.trains[k].L)) return;
  const P = race.player; let nearest = 1e9;
  race.trains.forEach((T, k) => {
    const v = trainVis[k]; v.T = T;
    if (!T.active) { v.meshes.forEach(m => m.visible = false); return; }
    const s = lerp(T.ps, T.s, G.renderAlpha); let off = 0;
    T.cars.forEach((cl, j) => {
      const p = railAt(T.L, s - T.dir * (off + cl / 2)), m = v.meshes[j];
      m.visible = true; m.position.set(p.x, p.h + 0.3, p.z); m.rotation.y = p.yaw + (T.dir < 0 ? Math.PI : 0); off += cl + 1.5;
      nearest = Math.min(nearest, Math.hypot(p.x - P.x, p.z - P.z));
    });
    // horn as it closes on a crossing near the player
    for (const C of T.L.crossings) {
      const ahead = (C.s - T.s) * T.dir;
      if (ahead > 0 && ahead < 110 && !T.horn && Math.hypot(G.world.tr.xs[C.i] - P.x, G.world.tr.zs[C.i] - P.z) < 150) { T.horn = true; AudioSys.trainHorn(); }
    }
  });
  AudioSys.trainRumble(clamp(1 - nearest / 130, 0, 1));
}
