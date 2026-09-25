import * as THREE from 'three';
import { G } from '../../game.js';
import { HALF } from '../../core/constants.js';
import { WEAR } from '../../core/features/wear.js';
import { withCutaway } from '../materials.js';

// Track wear visuals (core/features/wear.js): a see-through layer over the road and its verges, one texel per wear
// cell (WEAR.TCOLS across), repainted from W.wear a few times a second. On it: fresh tyre tracks (dark on dirt and
// gravel, torn and flattened on grass, wet on mud; a drift leaves a curved scuff), grooves worn in along the line
// (gravel), a rubbered-in line (tarmac), a packed-down line (snow) and the mud trail cars lay coming out of a bog. It follows the road across and
// the terrain over the verges. The bogs draw their own ruts (mud.js); tarmac skid marks are effects/skids.js.
const T = WEAR.TCOLS, OFF = (WEAR.TCOLS - WEAR.COLS) / 2, SPAN = T * WEAR.CELL / 2;
// per stage surface: groove colour and how strongly grooves show; tyre track colour on the road
const LOOK = { gravel: { groove: [0x4E, 0x3A, 0x26], gk: 12, gmax: 0.55, track: [0x33, 0x22, 0x14], tmax: 0.85 },
  tarmac: { groove: [0x1C, 0x1C, 0x1E], gk: 40, gmax: 0.4, track: [0x2A, 0x2A, 0x2A], tmax: 0.5 },
  snow: { groove: [0x9C, 0xA9, 0xB8], gk: 14, gmax: 0.5, track: [0x7E, 0x8C, 0x9E], tmax: 0.6, verge: [0x8E, 0x9E, 0xB2] } };   // snow: packed grey-blue, powder ploughed
const VERGE = [0x33, 0x30, 0x18], TRAIL = [0x3A, 0x26, 0x16], BOG = [0x2A, 0x1C, 0x10];
let vis = null;
export function addWear(group, tr, terr, stage) {
  vis = null;
  const NB = tr.NB, data = new Uint8Array(T * NB * 4), tex = new THREE.DataTexture(data, T, NB, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  const pos = [], uv = [], idx = [], STEP = 1, NX = Math.round(2 * SPAN / STEP) + 1;
  const up = (i, o) => {                                                            // on the road, the shoulder, or the ground
    const x = tr.xs[i] + tr.rx[i] * o, z = tr.zs[i] + tr.rz[i] * o, a = Math.abs(o), H = tr.H[i];
    if (a <= HALF - 0.2) return H + 0.075;
    const g = terr.at(x, z) + 0.1; return a < HALF + 2 ? Math.max(g, H + 0.07 - 0.45 * (a - HALF + 0.2) / 2.2) : g;
  };
  for (const i of tr.all0) {
    const j = tr.nb0(i, 1), b = tr.bi(i); if (j === i) continue;
    if (tr.voidMask && (tr.voidMask[b] || tr.voidMask[tr.bi(j)])) continue;
    const deck = tr.bridge[i] || tr.bridge[j] || tr.tunnel[i] || tr.tunnel[j], w = deck ? HALF - 0.2 : SPAN;   // no verges off a bridge
    const base = pos.length / 3;
    for (const [k, v] of [[i, (b + 0.5) / NB], [j, (b + 1.5) / NB]]) for (let n = 0; n < NX; n++) {
      const o = Math.max(-w, Math.min(w, -SPAN + n * STEP));
      pos.push(tr.xs[k] + tr.rx[k] * o, up(k, o), tr.zs[k] + tr.rz[k] * o); uv.push((o / WEAR.CELL + T / 2) / T, v);
    }
    for (let n = 0; n < NX - 1; n++) idx.push(base + n, base + NX + n, base + n + 1, base + n + 1, base + NX + n, base + NX + n + 1);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const mat = withCutaway(new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }), false, { cut: false, cloud: true });
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.renderOrder = 1; group.add(m);
  vis = { tr, data, tex, look: LOOK[stage.surface] || LOOK.tarmac, seen: -1, t: 0 };
  paint(null);
}
function paint(W) {
  const { tr, data, look } = vis, NB = tr.NB, road = HALF / WEAR.CELL;
  if (!W) { data.fill(0); vis.tex.needsUpdate = true; return; }
  const { g, t, m } = W.wear;
  for (let b = 0; b < NB; b++) {
    const bog = tr.mud && tr.mud[b] === 1;
    for (let k = 0; k < T; k++) {
      const q = b * T + k, p = q * 4, verge = Math.abs(k + 0.5 - T / 2) > road, gk = k - OFF;
      const gv = !bog && !verge && gk >= 0 && gk < WEAR.COLS ? look.gmax * (1 - Math.exp(-g[b * WEAR.COLS + gk] * look.gk)) : 0;
      const tv = (verge ? 0.8 : bog ? 0.5 : look.tmax) * (1 - Math.exp(-t[q] * 5)), mv = bog ? 0 : 0.85 * (1 - Math.exp(-m[q] * 2));
      const a = Math.min(0.9, Math.max(gv, tv, mv)), sum = gv + tv + mv || 1, tc = verge ? look.verge || VERGE : bog ? BOG : look.track;
      for (let ch = 0; ch < 3; ch++) data[p + ch] = (look.groove[ch] * gv + tc[ch] * tv + TRAIL[ch] * mv) / sum;
      data[p + 3] = a * 255;
    }
  }
  vis.tex.needsUpdate = true;
}
export function newWearRace() { if (vis) { vis.seen = -1; paint(null); } }
export function updateWear(dt) {
  const W = G.world && G.world.W; if (!vis || !W || !W.wear || (vis.t -= dt) > 0) return;
  vis.t = 0.2; if (W.wear.ver === vis.seen) return;
  vis.seen = W.wear.ver; paint(W);
}
