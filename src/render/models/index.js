import * as THREE from 'three';

// Meshes modelled in Blender (tools/blender/*.py, packed by tools/blender/export.mjs): each part's positions (int16,
// 1/8000 m), normals (int8) and indices (uint16), base64. Decoded once into geometries, in the game's axes
// (x right, y up, z forward), with planar UVs (the paint's fine texture) laid over the top.
const cache = new Map();
const bytes = s => Uint8Array.from(atob(s), c => c.charCodeAt(0)).buffer;
/** { [part name]: { [material]: BufferGeometry } } for a packed model. */
export function decodeModel(packed) {
  if (cache.has(packed)) return cache.get(packed);
  const out = {};
  for (const p of packed) {
    const P = new Int16Array(bytes(p.pos)), N = new Int8Array(bytes(p.nor)), I = new Uint16Array(bytes(p.idx));
    const pos = Float32Array.from(P, v => v / 8000), nor = Float32Array.from(N, v => v / 127), uv = new Float32Array(pos.length / 3 * 2);
    for (let k = 0; k < pos.length / 3; k++) { uv[k * 2] = pos[k * 3] * 0.4 + 0.5; uv[k * 2 + 1] = pos[k * 3 + 2] * 0.28 + 0.5; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(I, 1));
    (out[p.name] = out[p.name] || {})[p.mat] = g;
  }
  cache.set(packed, out); return out;
}
