import * as THREE from 'three';
import { featureHook } from '../features.js';
import { G } from '../../game.js';
import { buildTrack } from '../../core/track/build.js';
import { buildTerrain } from '../../core/track/terrain.js';
import { STAGES } from '../../data/stages/index.js';
import { clearSkids } from '../effects/skids.js';
import { disposeGroup } from '../geometry.js';
import { FX } from '../materials.js';
import { hemi, scene, setGrade, sun } from '../renderer.js';
import { addBarriers } from './barriers.js';
import { addBridge } from './bridges.js';
import { addArches, addGantry, addSigns, addTunnel } from './landmarks.js';
import { addRiver } from './river.js';
import { makeRoadMesh } from './road.js';
import { addScenery } from './scenery.js';
import { makeTerrainMesh } from './terrain.js';

// ==CORE END==
// ===== App: rendering, audio, input, UI =====
export const TRACKS = STAGES.map(s => buildTrack(s));
export function buildWorld(idx) {
  if (G.world) { scene.remove(G.world.group); disposeGroup(G.world.group); }
  const stage = STAGES[idx], tr = TRACKS[idx], terr = buildTerrain(tr, stage);
  const group = new THREE.Group(); scene.add(group);
  scene.background.set(stage.colors.sky); scene.fog.color.set(stage.colors.sky);
  const Lt = stage.light; sun.color.setHex(Lt.sun); sun.intensity = Lt.sunI; hemi.color.setHex(Lt.sky); hemi.groundColor.setHex(Lt.ground); hemi.intensity = Lt.hemiI; FX.cloudAmt.value = Lt.cloud; setGrade(Lt);
  const hz = Lt.haze; FX.hazeAmt.value = hz ? hz.amt : 0; if (hz) { FX.hazeCol.value.setHex(hz.color); FX.hazeTop.value = hz.top; FX.hazeRange.value = hz.range; }
  group.add(makeTerrainMesh(terr, tr, stage));
  G.bridgeMats = [];
  const roads = makeRoadMesh(tr, stage); group.add(roads.main); if (roads.bridge) group.add(roads.bridge);
  addBarriers(group, tr, terr, stage);
  G.fanChunks = addScenery(group, tr, terr, stage);
  if (tr.loopN) addGantry(group, tr, terr, tr.startIdx, 'START / FINISH');
  else { addGantry(group, tr, terr, tr.startIdx, 'START'); addGantry(group, tr, terr, tr.finishIdx, 'FINISH'); }
  addBridge(group, tr, terr, stage);
  addRiver(group, tr);
  featureHook('build', group, tr, terr, stage);
  addTunnel(group, tr, terr);
  addArches(group, tr, terr, stage);
  addSigns(group, tr, terr);
  G.world = { idx, stage, tr, terr, group, W: { tr, terr, surf: stage.surface, armco: !!stage.armco, traffic: stage.traffic } };
  clearSkids();
}
