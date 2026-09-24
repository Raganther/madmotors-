import * as THREE from 'three';

// ---------- geometry helpers ----------
export function flat(g) { const n = g.index ? g.toNonIndexed() : g; n.computeVertexNormals(); return n; }
export function merge(geos) {
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3); let o = 0;
  for (const g of geos) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); return out;
}
export const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
export function addInstanced(group, geo, mat, items, opts = {}) {
  const chunks = new Map(); const out = [];
  for (const it of items) { const k = Math.floor(it.x / 90) * 10007 + Math.floor(it.z / 90); let a = chunks.get(k); if (!a) { a = []; chunks.set(k, a); } a.push(it); }
  for (const list of chunks.values()) {
    const g = geo.clone(); const mesh = new THREE.InstancedMesh(g, mat, list.length);
    let cx = 0, cy = 0, cz = 0; for (const it of list) { cx += it.x; cy += it.y; cz += it.z; }
    cx /= list.length; cy /= list.length; cz /= list.length; let r = 0;
    list.forEach((it, j) => {
      _e.set(it.rx || 0, it.ry || 0, it.rz || 0); _q.setFromEuler(_e); _p.set(it.x, it.y, it.z);
      _s.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1); _m.compose(_p, _q, _s); mesh.setMatrixAt(j, _m);
      if (it.color !== undefined) { _c.set(it.color); mesh.setColorAt(j, _c); }
      r = Math.max(r, Math.hypot(it.x - cx, it.y - cy, it.z - cz) + Math.max(_s.x, _s.y, _s.z) * 6);
    });
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(cx, cy, cz), r + 4);
    mesh.frustumCulled = true;   // InstancedMesh turns culling off by default; each chunk has a real bounding sphere, so cull it
    mesh.castShadow = !!opts.cast; mesh.receiveShadow = !!opts.receive;
    group.add(mesh); out.push({ mesh, list });
  }
  geo.dispose();
  return out;
}
export function canvasTex(w, h, draw) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h); const t = new THREE.CanvasTexture(cv); t.anisotropy = 4; return t; }
export function disposeGroup(g) { g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); } }); }
// split a non-indexed mesh into square tiles so the parts off screen are culled instead of drawn every frame
export function chunkMesh(geo, mat, cell, receive) {
  const pos = geo.attributes.position.array, nor = geo.attributes.normal.array, col = geo.attributes.color ? geo.attributes.color.array : null;
  const buckets = new Map();
  for (let t = 0, nt = pos.length / 9; t < nt; t++) {
    const o = t * 9, k = (Math.floor((pos[o] + pos[o + 3] + pos[o + 6]) / 3 / cell) + 5000) * 10000 + Math.floor((pos[o + 2] + pos[o + 5] + pos[o + 8]) / 3 / cell) + 5000;
    let a = buckets.get(k); if (!a) buckets.set(k, a = []); a.push(t);
  }
  const group = new THREE.Group();
  for (const tris of buckets.values()) {
    const P = new Float32Array(tris.length * 9), Nn = new Float32Array(tris.length * 9), C = col ? new Float32Array(tris.length * 9) : null;
    tris.forEach((t, q) => { P.set(pos.subarray(t * 9, t * 9 + 9), q * 9); Nn.set(nor.subarray(t * 9, t * 9 + 9), q * 9); if (C) C.set(col.subarray(t * 9, t * 9 + 9), q * 9); });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(Nn, 3)); if (C) g.setAttribute('color', new THREE.BufferAttribute(C, 3));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.receiveShadow = !!receive; group.add(m);
  }
  geo.dispose();
  return group;
}
export function radialTex(stops) { return canvasTex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(0, 0, w, h); }); }
