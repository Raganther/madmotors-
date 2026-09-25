import * as THREE from 'three';
import { G } from '../../game.js';
import { HALF } from '../../core/constants.js';
import { WEAR } from '../../core/features/wear.js';
import { withCutaway } from '../materials.js';

// Track wear visuals (core/features/wear.js): a see-through layer over the whole road, one texel per wear cell,
// repainted from W.wear a few times a second. Grooves along the line on gravel, a dark rubbered-in line on tarmac, and
// the mud trail cars lay coming out of a bog. The bogs themselves draw their own ruts (mud.js).
const GROOVE = { gravel: [0x4E3A26, 1.4, 0.8], tarmac: [0x1C1C1E, 2.2, 0.45] }, TRAIL = new THREE.Color(0x3A2616);   // colour, strength, max opacity
let vis = null;
export function addWear(group, tr, stage) {
  vis = null;
  const NB = tr.NB, data = new Uint8Array(WEAR.COLS * NB * 4), tex = new THREE.DataTexture(data, WEAR.COLS, NB, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  const pos = [], uv = [], U = o => (o / WEAR.CELL + WEAR.COLS / 2) / WEAR.COLS, E = HALF - 0.2;
  for (const i of tr.all0) {
    const j = tr.nb0(i, 1), b = tr.bi(i); if (j === i) continue;
    if (tr.voidMask && (tr.voidMask[b] || tr.voidMask[tr.bi(j)])) continue;
    const v0 = (b + 0.5) / NB, v1 = (b + 1.5) / NB;
    const P = (k, o) => [tr.xs[k] + tr.rx[k] * o, tr.H[k] + 0.075, tr.zs[k] + tr.rz[k] * o];
    pos.push(...P(i, -E), ...P(j, -E), ...P(i, E), ...P(i, E), ...P(j, -E), ...P(j, E));
    uv.push(U(-E), v0, U(-E), v1, U(E), v0, U(E), v0, U(-E), v1, U(E), v1);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  const mat = withCutaway(new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }), false, { cut: false, cloud: true });
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.renderOrder = 1; group.add(m);
  const [col, k, max] = GROOVE[stage.surface] || GROOVE.tarmac;
  vis = { tr, data, tex, groove: new THREE.Color(col), k, max, seen: -1, t: 0 };
  paint(null);
}
function paint(W) {
  const { tr, data, groove, k, max } = vis, n = WEAR.COLS * tr.NB, c = new THREE.Color();
  for (let q = 0; q < n; q++) {
    const b = (q / WEAR.COLS) | 0, bog = tr.mud && tr.mud[b];
    const gv = W && !bog ? Math.min(max, W.wear.g[q] * k) : 0, mv = W && !bog ? Math.min(0.85, W.wear.m[q] * 1.2) : 0, a = Math.max(gv, mv);
    c.copy(groove).lerp(TRAIL, a > 0 ? mv / (gv + mv) : 0);
    data[q * 4] = c.r * 255; data[q * 4 + 1] = c.g * 255; data[q * 4 + 2] = c.b * 255; data[q * 4 + 3] = a * 255;
  }
  vis.tex.needsUpdate = true;
}
export function newWearRace() { if (vis) { vis.seen = -1; paint(null); } }
export function updateWear(dt) {
  const W = G.world && G.world.W; if (!vis || !W || !W.wear || (vis.t -= dt) > 0) return;
  vis.t = 0.2; if (W.wear.ver === vis.seen) return;
  vis.seen = W.wear.ver; paint(W);
}
