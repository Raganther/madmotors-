import * as THREE from 'three';
import { blenderPack, decodePack, gfx } from './index.js';

// Blender scenery (blender/scenery.py): a pack's parts as single geometries for instancing, every material of a part
// merged (the vertex colours carry the shading and the baked details; the instance colour tints them). null when
// Blender models are off or the pack doesn't exist, so the caller keeps its Classic shape. There are hundreds of each,
// seen from the race camera, so they use the far level unless Graphics is on High (the near one cost 12-20% more frame
// time on the forest and village stages; the far one about 5%).
export const sceneryPack = id => instancePack('scn-' + id);
/** Kit pieces (blender/pieces.py: portals, piers, gates, lamps, barrier pieces) the same way. */
export const kitPack = id => instancePack('kit-' + id);
function instancePack(id) {
  const pack = blenderPack(id); if (!pack) return null;
  const H = decodePack(pack), cache = {}, L = gfx === 'high' ? H.hi : H.lo;
  const looped = part => Object.values(H.hi[part] || {}).some(g => g.userData.loop);   // an authored loop lives on the near level
  const geo = part => cache[part] || (cache[part] = merge(Object.values((looped(part) ? H.hi[part] : L[part]) || H.hi[part] || {})));
  return { geo, n: H.meta.variants || 1, meta: H.meta, has: part => !!H.hi[part] };
}
function merge(geos) {
  if (geos.length === 1) return geos[0];
  let n = 0, m = 0; for (const g of geos) { n += g.attributes.position.count; m += g.index.count; }
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3).fill(1), idx = new Uint32Array(m); let o = 0, q = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); if (g.attributes.color) col.set(g.attributes.color.array, o * 3);
    const I = g.index.array; for (let k = 0; k < I.length; k++) idx[q + k] = I[k] + o; o += g.attributes.position.count; q += I.length;
  }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3)); out.setIndex(new THREE.BufferAttribute(idx, 1)); return out;
}
/** The instances of a list that take variant v of n (by their obstacle index, else their place in the list). */
export const variant = (list, n, v) => list.filter((it, j) => ((it.k ?? j) % n) === v);
/** A Lambert material that shows a Blender part's vertex colours (options as for MeshLambertMaterial). */
export const vcMat = (o = {}) => new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, ...o });
/** Moss on the upward faces of a rock (as the Classic rocks have on green stages): a copy with its colours tinted. */
export function mossy(geo, moss) {
  const g = geo.clone(), m = new THREE.Color(moss), l = (m.r + m.g + m.b) / 3 || 1, c = g.attributes.color, n = g.attributes.normal;
  const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  g.setAttribute('color', c.clone()); const C = g.attributes.color;
  for (let i = 0; i < C.count; i++) { const k = sm(0.55, 0.9, n.getY(i)) * 0.55; if (k > 0) C.setXYZ(i, C.getX(i) * (1 - k + k * m.r / l), C.getY(i) * (1 - k + k * m.g / l), C.getZ(i) * (1 - k + k * m.b / l)); }
  return g;
}
