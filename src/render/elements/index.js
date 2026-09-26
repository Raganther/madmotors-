// Visual side of the track elements (core/elements) and race features (core/features), one entry per piece, in the
// order the world is built. Each entry may define:
//   init()                           once at boot
//   build(group, tr, terr, stage)    when a stage's world is built
//   newRace(r)                       when a race (re)starts, after the core has created it
//   update(dt, now, fxDt)            every frame while not paused
import * as THREE from 'three';
import { G } from '../../game.js';
import { disposeGroup } from '../geometry.js';
import { scene } from '../renderer.js';
import { addRails } from './rails.js';
import { addCrossings, crossVis, updateCrossings } from '../crossings.js';
import { initTrainsVis, updateTrainsVis } from '../trains.js';
import { addTown } from './town.js';
import { addGallery } from './gallery.js';
import { initRockVis, updateRocks } from '../rocks.js';
import { makeTrafficMesh } from '../vehicles.js';
import { addBridge } from './bridge.js';
import { addRiver, addRiverLogs, updateRiverLogs } from './river.js';
import { addTunnel } from './tunnel.js';
import { addArches } from './arch.js';
import { addBoostPads, updateBoostPads } from './boost.js';
import { addFerryDocks, newFerryRace, updateFerryVis } from './ferry.js';
import { initHazardVis, updateHazardVis } from '../hazards.js';
import { addFalls, updateFalls } from './falls.js';
import { addDrawbridges, updateDrawbridges } from './drawbridge.js';
import { addMill } from './mill.js';
import { addMud, newMudRace, updateMud } from './mud.js';
import { addWear, newWearRace, updateWear } from './wear.js';
import { addIce } from './ice.js';
import { initGateVis, updateGateVis } from '../gates.js';
import { addHammers, updateHammers } from './hammer.js';
import { initWeaponVis, updateWeaponVis } from '../weapons.js';
import { addSnowfall, updateSnowfall } from './snowfall.js';

const bridge = { name: 'bridge', build(group, tr, terr, stage) { addBridge(group, tr, terr, stage); } };
const river = { name: 'river', build(group, tr) { addRiver(group, tr); addRiverLogs(group, tr); }, update(dt, now) { updateRiverLogs(dt, now); } };
const railways = {
  name: 'rails',
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
const tunnel = { name: 'tunnel', build(group, tr, terr, stage) { addTunnel(group, tr, terr, stage); } };
const arch = { name: 'arch', build(group, tr, terr, stage) { addArches(group, tr, terr, stage); } };
const boost = { name: 'boost', build(group, tr) { addBoostPads(group, tr); }, update(dt, now) { updateBoostPads(now); } };
const ferry = { name: 'ferry', build(group, tr) { addFerryDocks(group, tr); }, newRace(r) { newFerryRace(r); }, update(dt, now) { updateFerryVis(dt, now); } };
const rockfall = { name: 'rockfall', init: initRockVis, update(dt, now, fxDt) { updateRocks(fxDt); } };

const hazards = { name: 'hazards', init: initHazardVis, update(dt, now) { updateHazardVis(dt, now); } };
const falls = { name: 'falls', build(group, tr, terr) { addFalls(group, tr, terr); }, update(dt, now) { updateFalls(dt, now); } };

const drawbridge = { name: 'drawbridge', build(group, tr) { addDrawbridges(group, tr); }, update(dt, now) { updateDrawbridges(dt, now); } };

const mill = { name: 'mill', build(group, tr, terr) { addMill(group, tr, terr); } };

const mud = { name: 'mud', build(group, tr, terr, stage) { addMud(group, tr, terr, stage); }, newRace() { newMudRace(); }, update(dt) { updateMud(dt); } };

const gates = { name: 'gates', init: initGateVis, update(dt, now) { updateGateVis(dt, now); } };   // checkpoint gates (Deuce, Tiebreak)
const weapons = { name: 'weapons', init: initWeaponVis, update(dt, now) { updateWeaponVis(dt, now); } };   // missiles in flight
const hammer = { name: 'hammer', build(group, tr) { addHammers(group, tr); }, update() { updateHammers(); } };
const ice = { name: 'ice', build(group, tr) { addIce(group, tr); } };
const snowfall = { name: 'snowfall', build(group, tr, terr, stage) { addSnowfall(group, stage); }, update(dt, now) { updateSnowfall(dt, now); } };   // weather (stage.snowfall)

const wear = { name: 'wear', build(group, tr, terr, stage) { addWear(group, tr, terr, stage); }, newRace() { newWearRace(); }, update(dt) { updateWear(dt); } };   // every stage (features/wear.js)

export const RENDER_ELEMENTS = [bridge, river, railways, town, gallery, tunnel, arch, boost, ferry, rockfall, hazards, falls, drawbridge, mill, mud, wear, ice, snowfall, gates, weapons, hammer];
export const elementHook = (hook, ...args) => { for (const f of RENDER_ELEMENTS) if (f[hook]) f[hook](...args); };
