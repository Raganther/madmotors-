import * as THREE from 'three';
import { G } from '../game.js';
import { WEAR, RUT, WEATHER, WEAR_OPT, poolMap, rutCellH } from '../core/features/wear.js';
import { HALF } from '../core/constants.js';
import { waterGrid, waterMaterial } from './water.js';

// Ruts you can see (core/features/wear.js digs them): their height, cell by cell, in a small texture (WEAR.COLS across,
// a row per base sample), redrawn when the wear changes. Every surface that should sink into them (the road's driving
// strips, the wear overlay, the bogs) carries `wuv` per vertex: u, v into the texture (u < 0: never moves) and the
// road's right vector there (rx, rz); withRuts moves each vertex by the height it reads and tilts its normal by the
// slope across the road, so a rut's walls catch the light. All of them read the same texels, so they move together and
// match what the cars ride on (core rutGround: the same bilinear cells). The puddles: water lying in the deepest ruts on a
// wet stage. G.wearOpt (menu: Track wear) / the race's W.wear.opt: grooves, puddles.
const RANGE = 0.4;                                                         // metres either side of 0 the texture holds
const U = { uRut: { value: null }, uRutOn: { value: 0 }, uRutDu: { value: 1 / WEAR.COLS } };
let vis = null, shiny = [];
/** A wet road's material: specular, gleaming in the rain; k: how much (tarmac 1, gravel less). The Shine option turns it
 *  off from the next race (updateRuts). */
export function wetShine(mat, k) { mat.specular = new THREE.Color(0x262B32).multiplyScalar(k); mat.shininess = 40 + 60 * k; mat.userData.shine = mat.specular.clone(); shiny = [mat]; return mat; }   // (one road per world)
/** wuv for a vertex at lateral offset o on base row r of track tr (rx, rz: the road's right vector there). */
export const wuvOf = (tr, r, o, rx, rz) => [(o / WEAR.CELL + WEAR.COLS / 2) / WEAR.COLS, (r + 0.5) / tr.NB, rx, rz];
export const NO_WUV = [-1, 0, 0, 0];
/** Let `mat` sink into the ruts (geometry with a wuv attribute). Chains whatever onBeforeCompile it has. */
export function withRuts(mat) {
  const base = mat.onBeforeCompile, key = mat.customProgramCacheKey;
  mat.onBeforeCompile = sh => {
    if (base) base(sh);
    Object.assign(sh.uniforms, U);
    const read = 'float rutAt(vec2 p) { return (texture2D(uRut, p).r * 255.0 - 128.0) / 127.0 * ' + RANGE.toFixed(2) + '; }\n';
    sh.vertexShader = 'attribute vec4 wuv;\nuniform sampler2D uRut;\nuniform float uRutOn;\nuniform float uRutDu;\n' + read + sh.vertexShader
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        float rutK = wuv.x >= 0.0 ? uRutOn : 0.0;
        if (rutK > 0.0) { float sl = (rutAt(wuv.xy + vec2(uRutDu, 0.0)) - rutAt(wuv.xy - vec2(uRutDu, 0.0))) / (2.0 * ${WEAR.CELL.toFixed(2)}); objectNormal = normalize(objectNormal - vec3(wuv.z, 0.0, wuv.w) * sl * 1.6); }`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n        if (rutK > 0.0) transformed.y += rutAt(wuv.xy);');
  };
  mat.customProgramCacheKey = () => (key ? key() : '') + 'ruts';
  return mat;
}
/** A new world: the texture for its track, and on a wet stage the puddle sheet over the roads that can rut. */
export function addRuts(group, tr, stage, rd) {
  const NB = tr.NB, data = new Uint8Array(WEAR.COLS * NB * 4).fill(128), tex = new THREE.DataTexture(data, WEAR.COLS, NB, THREE.RGBAFormat);
  tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true; U.uRut.value = tex;
  vis = { tr, data, tex, seen: -1, t: 0, puddles: null, shown: false, standing: null };
  if (!(stage.wet > 0)) shiny = [];
  if (!(stage.wet > 0)) return;
  // standing water along the edges and in the dips (core features/wear.js poolMap: the same water the cars aquaplane
  // in): a sheet a few cm over the road's edge, its depth running to nothing where the pool's edge is, so render/water.js
  // gives it a soft shore on the road
  const P = poolMap({ tr }, { ...WEAR_OPT, standing: true });
  if (P) {
    const mat = waterMaterial({ color: 0x40505E, deep: 0x2A3742, alpha: 0.62 }), D = 0.07;
    for (let side = 0; side < 2; side++) {
      const sg = side ? 1 : -1;
      for (let r0 = 0; r0 < tr.NB;) {
        if (!P[r0 * 2 + side]) { r0++; continue; }
        let r1 = r0; while (r1 + 1 < tr.NB && P[(r1 + 1) * 2 + side]) r1++;
        const rows = []; for (let r = Math.max(0, r0 - 1); r <= Math.min(tr.NB - 1, r1 + 1); r++) rows.push(r);
        const C = 15, m = waterGrid(rows.length, C, (q, c) => {
          const r = rows[q], i = tr.u0(r), w = P[r * 2 + side] || 0, o = sg * (HALF + 0.4 - (c / (C - 1)) * (WEATHER.POOL_MAX + 0.8)), into = HALF - Math.abs(o);   // from just past the edge inward
          return [tr.xs[i] + tr.rx[i] * o, tr.H[i] + 0.05 + D, tr.zs[i] + tr.rz[i] * o, w > 0 ? tr.H[i] + 0.05 + D * Math.min(1.4, Math.max(0, into + 0.4) / (w + 0.01)) : tr.H[i] + 1];
        }, mat);
        if (m) { m.renderOrder = 2; group.add(m); (vis.standing = vis.standing || []).push(m); }
        r0 = r1 + 1;
      }
    }
  }
  // puddles: a flat sheet RUT.PUDDLE under the fresh surface over every row that ruts; it shows only where a rut goes
  // deeper than that (its fragments read the same texture), so only the deepest bits of the line hold water: lighter
  // at the edge, dark in the middle
  const pos = [], wuv = [], idx = [], C = Math.round(2 * (6 - 0.6) / 0.5) + 1;
  for (const i of tr.all0) {
    const r = tr.bi(i), j = tr.nb0(i, 1); if (j === i || !rd[r] || !rd[tr.bi(j)]) continue;
    const b = pos.length / 3;
    for (const k of [i, j]) for (let c = 0; c < C; c++) { const o = -5.4 + c * 0.5; pos.push(tr.xs[k] + tr.rx[k] * o, tr.H[k] + 0.05 - RUT.PUDDLE, tr.zs[k] + tr.rz[k] * o); wuv.push(...wuvOf(tr, tr.bi(k), o, tr.rx[k], tr.rz[k])); }
    for (let c = 0; c < C - 1; c++) idx.push(b + c, b + C + c, b + c + 1, b + c + 1, b + C + c, b + C + c + 1);
  }
  if (!idx.length) return;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('wuv', new THREE.Float32BufferAttribute(wuv, 4)); g.setIndex(idx); g.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ color: 0x3C4A50, emissive: 0x0C1216, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'attribute vec4 wuv;\nvarying vec2 vWuv;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vWuv = wuv.xy;');
    sh.fragmentShader = 'uniform sampler2D uRut;\nvarying vec2 vWuv;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float al = vWuv.y * ${tr.NB.toFixed(1)}, dip = 0.5 + 0.5 * sin(al * 0.31) * sin(al * 0.117 + 1.7);   // water gathers in the dips: patches every 10-20 m
      float dpt = -${RUT.PUDDLE.toFixed(3)} - 0.07 * (1.0 - dip) - (texture2D(uRut, vWuv).r * 255.0 - 128.0) / 127.0 * ${RANGE.toFixed(2)};
      if (dpt <= 0.0) discard;
      diffuseColor.rgb = mix(diffuseColor.rgb * 1.15, diffuseColor.rgb * 0.6, smoothstep(0.0, 0.06, dpt));   // brown-grey at the edge, dark in the middle
      diffuseColor.a = smoothstep(0.0, 0.025, dpt) * 0.72;`);
  };
  mat.customProgramCacheKey = () => 'puddles' + tr.NB;
  const m = new THREE.Mesh(g, mat); m.renderOrder = 1; m.visible = false; group.add(m); vis.puddles = m;
}
export function newRutsRace() { if (!vis) return; vis.data.fill(128); vis.tex.needsUpdate = true; vis.seen = -1; }
/** Redraw the texture from the race's ruts a few times a second (only when they've changed). */
export function updateRuts(dt) {
  const W = G.world && G.world.W; if (!vis || !W || !W.wear || !W.wear.opt) return;
  const O = W.wear.opt; U.uRutOn.value = O.grooves ? 1 : 0; if (vis.puddles) vis.puddles.visible = !!(O.puddles && O.grooves && W.wear.dug);
  if (vis.standing) for (const m of vis.standing) m.visible = !!O.standing;
  for (const m of shiny) m.specular.copy(m.userData.shine).multiplyScalar(O.shine === false ? 0 : 1);
  if (!O.grooves || !W.wear.dug || (vis.t -= dt) > 0) return;
  vis.t = 0.25; if (W.wear.ver === vis.seen) return; vis.seen = W.wear.ver;
  const { data, tr } = vis, C = WEAR.COLS;
  for (let r = 0; r < tr.NB; r++) { if (!W.wear.rd[r]) continue; for (let k = 0; k < C; k++) data[(r * C + k) * 4] = Math.max(1, Math.min(255, Math.round(128 + rutCellH(W, r, k) / RANGE * 127))); }
  vis.tex.needsUpdate = true;
}
