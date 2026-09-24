import * as THREE from 'three';
import { elementHook } from '../elements/index.js';
import { G } from '../../game.js';
import { buildTrack } from '../../core/track/build.js';
import { buildTerrain } from '../../core/track/terrain.js';
import { STAGES } from '../../data/stages/index.js';
import { clearSkids } from '../effects/skids.js';
import { disposeGroup } from '../geometry.js';
import { FX } from '../materials.js';
import { hemi, scene, setGrade, sun } from '../renderer.js';
import { addBarriers } from './barriers.js';
import { addGantry, addSigns } from './landmarks.js';
import { makeRoadMesh } from './road.js';
import { addScenery } from './scenery.js';
import { makeTerrainMesh } from './terrain.js';

// ==CORE END==
// ===== App: rendering, audio, input, UI =====
const TRACKS = [];
/** The built road for stage idx, built on first use (sandbox stages can be appended to STAGES at boot). */
export const trackOf = idx => TRACKS[idx] || (TRACKS[idx] = buildTrack(STAGES[idx]));
// Where the scenery goes see-through over the player: only long covered stretches (tunnels, the rock gallery)
// of 40 m or more, plus 12 m either side of the portals. Bridges, arches, houses and short cuttings stay solid.
function coverMap(tr) {
  const N = tr.loopN || tr.N, w = i => tr.loopN ? (i % N + N) % N : Math.max(0, Math.min(N - 1, i)), out = new Uint8Array(N);
  const cov = i => tr.tunnel[i] || (tr.gallery && tr.gallery[i]);
  for (let i = 0; i < N; i++) {
    if (!cov(i) || cov(w(i - 1)) && (tr.loopN || i > 0)) continue;   // start of a run
    let n = 0; while (n < N && cov(w(i + n))) n++;
    if (n >= 40) for (let k = -12; k < n + 12; k++) out[w(i + k)] = 1;
  }
  return out;
}
export function buildWorld(idx) {
  if (G.world) { scene.remove(G.world.group); disposeGroup(G.world.group); }
  const stage = STAGES[idx], tr = trackOf(idx), terr = buildTerrain(tr, stage);
  const group = new THREE.Group(); scene.add(group);
  scene.background.set(stage.colors.sky); scene.fog.color.set(stage.colors.sky);
  const Lt = stage.light; sun.color.setHex(Lt.sun); sun.intensity = Lt.sunI; hemi.color.setHex(Lt.sky); hemi.groundColor.setHex(Lt.ground); hemi.intensity = Lt.hemiI; FX.cloudAmt.value = Lt.cloud; setGrade(Lt);
  const hz = Lt.haze; FX.hazeAmt.value = hz ? hz.amt : 0; if (hz) { FX.hazeCol.value.setHex(hz.color); FX.hazeTop.value = hz.top; FX.hazeRange.value = hz.range; }
  group.add(makeTerrainMesh(terr, tr, stage));
  const roads = makeRoadMesh(tr, stage); group.add(roads.main); if (roads.bridge) group.add(roads.bridge);
  addBarriers(group, tr, terr, stage);
  G.fanChunks = addScenery(group, tr, terr, stage);
  if (tr.loopN) addGantry(group, tr, terr, tr.startIdx, 'START / FINISH');
  else { addGantry(group, tr, terr, tr.startIdx, 'START'); addGantry(group, tr, terr, tr.finishIdx, 'FINISH'); }
  elementHook('build', group, tr, terr, stage);                 // bridges, river, railways, town, gallery, tunnel, arches
  addSigns(group, tr, terr);
  G.world = { idx, stage, tr, terr, group, cover: coverMap(tr), W: { tr, terr, surf: stage.surface, armco: !!stage.armco, traffic: stage.traffic } };
  clearSkids();
}
