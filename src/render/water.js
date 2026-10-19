import * as THREE from 'three';
import { withCutaway } from './materials.js';
import { WAVE, WAVE_GLSL } from './waves.js';

// Water, every open surface of it (rivers, the sea, water splashes, open-country streams): a sheet that knows how deep
// it is over the ground at each corner (`depth`, metres), and a material that draws it by that depth. Clear and pale
// in the shallows, so the ground shows through and slips away under it; a ragged line of foam where it laps the
// bank; darker and nearly opaque where it's deep; nothing at all where the ground is higher. So the shoreline is
// wherever the land rises out of the water, at any angle and any shape, instead of the edge of the mesh.
const FOAM = new THREE.Color(0xEEF6FF);
/** The water material: base colour `color`, `deep` where it's deep, opacity `alpha` there. frozen: ice (opaque, no
 *  foam, a sharp edge). foam: how white the shore line is (a muddy puddle's is faint). scale: shades shallow water as
 *  if it were deeper, so a puddle a few cm deep still gets its clear edge and its dark middle. extra: more depth from
 *  a texture, for water whose bed moves (render/ruts.js: the ruts under a puddle): { uniforms, vert, vmain, frag,
 *  fmain (statements that adjust `dep`, metres), key }. Plain THREE + the shared world effects (materials.js
 *  withCutaway: ripples, cloud shadows). */
export function waterMaterial({ color = 0x3E7DAE, deep = null, alpha = 0.9, frozen = false, map = null, foam: foamK = 1, scale = 1, extra = null } = {}) {
  const mat = frozen ? new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })
    : new THREE.MeshLambertMaterial({ color, map, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  withCutaway(mat, false, frozen ? { cut: false, cloud: true, grain: 0.25 } : { cut: false, cloud: true, water: true });
  const base = mat.onBeforeCompile, key = mat.customProgramCacheKey, D = new THREE.Color(deep ?? new THREE.Color(color).multiplyScalar(0.55).getHex()), X = extra || {};
  const v3 = c => `vec3(${c.r.toFixed(3)}, ${c.g.toFixed(3)}, ${c.b.toFixed(3)})`;
  mat.onBeforeCompile = sh => {
    base(sh);
    if (!frozen) Object.assign(sh.uniforms, WAVE);
    Object.assign(sh.uniforms, X.uniforms || {});
    sh.vertexShader = 'attribute float depth;\nvarying float vDepth;\n' + (X.vert || '') + (frozen ? '' : WAVE_GLSL) + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vDepth = depth;' + (X.vmain || '') + (frozen ? '' : `
  transformed.y += waveAt((modelMatrix * vec4(position, 1.0)).xz);   // the cars' waves lift and drop the surface (render/waves.js)`));
    sh.fragmentShader = 'varying float vDepth;\n' + (X.frag || '') + (frozen ? '' : WAVE_GLSL) + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      float dep = vDepth;
      ${X.fmain || ''}
      dep *= ${scale.toFixed(2)};` + (frozen ? `
      if (dep <= 0.0) discard;` : `
      // the cars' waves (render/waves.js): the water rides up the bank on a crest and draws back in a trough, the
      // churned water froths, and the slopes of the waves catch the light
      float wh = waveAt(vCutW.xz), wgx = waveAt(vCutW.xz + vec2(0.5, 0.0)) - waveAt(vCutW.xz - vec2(0.5, 0.0)), wgz = waveAt(vCutW.xz + vec2(0.0, 0.5)) - waveAt(vCutW.xz - vec2(0.0, 0.5));
      if (dep + wh * 1.6 <= 0.0) discard;
      // the shore wobbles a little with time (the water lapping), foam rides just inside it
      float lap = dep + wh * 1.6 + 0.035 * sin(vCutW.x * 0.9 + vCutW.z * 0.7 + uTime * 1.8) * sin(vCutW.z * 1.3 - uTime * 1.1);
      float churn = smoothstep(0.03, 0.12, abs(wh) + 0.5 * length(vec2(wgx, wgz)));
      float foam = max(smoothstep(0.0, 0.05, lap) * (1.0 - smoothstep(0.07 + churn * 0.15, 0.2 + churn * 0.35, lap)), churn * 0.3) * ${foamK.toFixed(2)};
      diffuseColor.rgb *= clamp(1.0 + (wgx * 0.9 - wgz * 0.6) * 6.0, 0.55, 1.5);   // crests lit, troughs in shade
      diffuseColor.rgb = mix(diffuseColor.rgb * 1.12, ${v3(D)}, smoothstep(0.25, 2.2, dep));
      diffuseColor.rgb = mix(diffuseColor.rgb, ${v3(FOAM)}, foam * 0.75);
      diffuseColor.a = max(${alpha.toFixed(2)} * mix(0.38, 1.0, smoothstep(0.05, 1.6, dep)) * smoothstep(0.0, 0.1, lap), foam * 0.8);`));
  };
  mat.customProgramCacheKey = () => key() + 'depth3' + (frozen ? 'f' : '') + alpha + D.getHex() + '/' + foamK + '/' + scale + (X.key || '');
  return mat;
}
/** A water sheet from a grid of R rows x C columns: corner(r, c) -> [x, y, z, ground] (ground: the height of the land
 *  or road under that corner). Cells that are dry at all four corners are left out; the rest fade by depth. */
export function waterGrid(R, C, corner, mat, uvScale = 8) {
  const pos = new Float32Array(R * C * 3), uv = new Float32Array(R * C * 2), dep = new Float32Array(R * C), idx = [];
  for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const [x, y, z, g] = corner(r, c), k = r * C + c;
    pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; uv[k * 2] = x / uvScale; uv[k * 2 + 1] = z / uvScale; dep[k] = y - g;
  }
  for (let r = 0; r < R - 1; r++) for (let c = 0; c < C - 1; c++) {
    const a = r * C + c, b = a + 1, d = a + C, e = d + 1;
    if (dep[a] <= 0 && dep[b] <= 0 && dep[d] <= 0 && dep[e] <= 0) continue;
    idx.push(a, d, b, b, d, e);
  }
  if (!idx.length) return null;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('depth', new THREE.BufferAttribute(dep, 1)); g.setIndex(idx);
  g.computeVertexNormals();
  // wound upward whichever way the rows ran (a back face is lit from below: near black)
  if (g.attributes.normal.getY(idx[0]) < 0) { for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; } g.setIndex(idx); g.computeVertexNormals(); }
  const m = new THREE.Mesh(g, mat); m.renderOrder = 1; m.receiveShadow = true; return m;
}
/** Water standing at height y (root's frame) over the ground across the rectangle x0..x1, z0..z1 of group root, every
 *  `step` m: a moat, a canal under a bridge. Only where the ground is lower than the water; its banks are the shore. */
export function waterPool(root, terr, [x0, x1, z0, z1], y, mat, step = 1.5) {
  root.updateMatrixWorld(true);
  const C = Math.ceil((x1 - x0) / step) + 1, R = Math.ceil((z1 - z0) / step) + 1, v = new THREE.Vector3();
  const m = waterGrid(R, C, (r, c) => {
    const x = x0 + (x1 - x0) * c / (C - 1), z = z0 + (z1 - z0) * r / (R - 1); v.set(x, y, z); root.localToWorld(v);
    return [x, y, z, y - (v.y - terr.at(v.x, v.z))];   // the ground, in root's frame
  }, mat);
  if (m) root.add(m); return m;
}
