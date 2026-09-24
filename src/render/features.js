// Visual side of the race features (see core/features/index.js). Each entry may define:
//   init()                           once at boot
//   build(group, tr, terr, stage)    when a stage's world is built
//   newRace(r)                       when a race (re)starts, after the core has created it
//   update(dt, now, fxDt)            every frame while not paused
import * as THREE from 'three';
import { G } from '../game.js';
import { disposeGroup } from './geometry.js';
import { scene } from './renderer.js';
import { addRails } from './world/rails.js';
import { addCrossings, crossVis, updateCrossings } from './crossings.js';
import { initTrainsVis, updateTrainsVis } from './trains.js';
import { addTown } from './world/town.js';
import { addGallery } from './world/gallery.js';
import { initRockVis, updateRocks } from './rocks.js';
import { makeTrafficMesh } from './vehicles.js';

const railways = {
  name: 'railways',
  build(group, tr) { addRails(group, tr); addCrossings(group, tr); },
  newRace(r) {
    const w = G.world;
    if (w.trainGroup) { w.group.remove(w.trainGroup); disposeGroup(w.trainGroup); }
    w.trainGroup = new THREE.Group(); w.group.add(w.trainGroup);
    initTrainsVis(w.trainGroup, r);
    crossVis.forEach(v => { v.t = 0; v.gates.forEach(g => { g.broken = false; g.arm.visible = true; }); });
  },
  update(dt, now) { updateTrainsVis(); updateCrossings(dt, now); }
};
const town = {
  name: 'town',
  build(group, tr, terr, stage) { addTown(group, tr, terr, stage); },
  newRace(r) {   // a mesh per parked car
    for (const v of G.parkVis) { scene.remove(v.root); disposeGroup(v.root); } G.parkVis = [];
    for (const c of r.parked) { const v = makeTrafficMesh(c.def.kind); v.paint.color.set(c.def.color); v.root.visible = true; c.vis = v; G.parkVis.push(v); }
  }
};
const gallery = { name: 'gallery', build(group, tr) { addGallery(group, tr); } };
const rockfall = { name: 'rockfall', init: initRockVis, update(dt, now, fxDt) { updateRocks(fxDt); } };

export const RENDER_FEATURES = [railways, town, gallery, rockfall];
export const featureHook = (hook, ...args) => { for (const f of RENDER_FEATURES) if (f[hook]) f[hook](...args); };
