import * as THREE from 'three';

// ---------- geometry helpers ----------
export function flat(g) { const n = g.index ? g.toNonIndexed() : g; n.computeVertexNormals(); return n; }
/**
 * A box with its edges rounded off (radius r, k steps per quarter round) for the close-up car bodies. `seg` subdivides
 * the flat middle of each face (for dents), `shape(x, y, z) -> [x, y, z]` bends it afterwards like a plain box.
 * UVs are pulled in from the face edges: the panel texture's painted-on edge shading isn't wanted where the edge is real.
 */
export function roundBox(w, h, d, r, { seg = [1, 1, 1], shape, k = 2 } = {}) {
  const S = [w, h, d], n = seg.map(s => s + 2 * k), g = new THREE.BoxGeometry(w, h, d, n[0], n[1], n[2]), p = g.attributes.position, uv = g.attributes.uv;
  const remap = (v, ax) => {
    const L = S[ax], N = n[ax], j = Math.round((v / L + 0.5) * N);
    return j <= k ? -L / 2 + r * j / k : j >= N - k ? L / 2 - r * (N - j) / k : -L / 2 + r + (L - 2 * r) * (j - k) / (N - 2 * k);
  };
  const cl = (v, e) => Math.max(-e, Math.min(e, v)), nor = g.attributes.normal, f = shape || ((x, y, z) => [x, y, z]), e = 1e-3;
  for (let i = 0; i < p.count; i++) {
    let x = remap(p.getX(i), 0), y = remap(p.getY(i), 1), z = remap(p.getZ(i), 2);
    const ix = cl(x, w / 2 - r), iy = cl(y, h / 2 - r), iz = cl(z, d / 2 - r), dx = x - ix, dy = y - iy, dz = z - iz, l = Math.hypot(dx, dy, dz);
    // the exact normal of the rounded box (flat faces stay truly flat), carried through shape() by its Jacobian's cofactors
    let nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
    if (l > 1e-6) { x = ix + dx / l * r; y = iy + dy / l * r; z = iz + dz / l * r; nx = dx / l; ny = dy / l; nz = dz / l; }
    if (shape) {
      const a = f(x + e, y, z), b = f(x - e, y, z), c = f(x, y + e, z), c2 = f(x, y - e, z), q = f(x, y, z + e), q2 = f(x, y, z - e);
      const J = [0, 1, 2].map(k => [(a[k] - b[k]) / (2 * e), (c[k] - c2[k]) / (2 * e), (q[k] - q2[k]) / (2 * e)]);
      const C = (r0, c0) => { const R = [0, 1, 2].filter(k => k !== r0), Cc = [0, 1, 2].filter(k => k !== c0); return ((r0 + c0) % 2 ? -1 : 1) * (J[R[0]][Cc[0]] * J[R[1]][Cc[1]] - J[R[0]][Cc[1]] * J[R[1]][Cc[0]]); };
      const mx = C(0, 0) * nx + C(0, 1) * ny + C(0, 2) * nz, my = C(1, 0) * nx + C(1, 1) * ny + C(1, 2) * nz, mz = C(2, 0) * nx + C(2, 1) * ny + C(2, 2) * nz, ml = Math.hypot(mx, my, mz) || 1;
      nx = mx / ml; ny = my / ml; nz = mz / ml; [x, y, z] = f(x, y, z);
    }
    p.setXYZ(i, x, y, z); nor.setXYZ(i, nx, ny, nz); uv.setXY(i, 0.12 + uv.getX(i) * 0.76, 0.12 + uv.getY(i) * 0.76);
  }
  g.userData.smooth = true; g.userData.n0 = Float32Array.from(nor.array); return g;
}
/** Vertex normals averaged over every triangle touching the same point, across UV seams (built once, reused after dents). */
export function smoothNormals(g) {
  const p = g.attributes.position, N = p.count;
  let weld = g.userData.weld;
  if (!weld) {
    const at = new Map(); weld = new Int32Array(N);
    for (let i = 0; i < N; i++) { const key = Math.round(p.getX(i) * 1e4) + ',' + Math.round(p.getY(i) * 1e4) + ',' + Math.round(p.getZ(i) * 1e4); let w = at.get(key); if (w === undefined) at.set(key, w = at.size); weld[i] = w; }
    g.userData.weld = weld;
  }
  const acc = new Float32Array(N * 3), idx = g.index ? g.index.array : null, T = idx ? idx.length : N, a = p.array;
  for (let t = 0; t < T; t += 3) {
    const i0 = idx ? idx[t] : t, i1 = idx ? idx[t + 1] : t + 1, i2 = idx ? idx[t + 2] : t + 2;
    const ux = a[i1 * 3] - a[i0 * 3], uy = a[i1 * 3 + 1] - a[i0 * 3 + 1], uz = a[i1 * 3 + 2] - a[i0 * 3 + 2], vx = a[i2 * 3] - a[i0 * 3], vy = a[i2 * 3 + 1] - a[i0 * 3 + 1], vz = a[i2 * 3 + 2] - a[i0 * 3 + 2];
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;   // area-weighted
    for (const i of [i0, i1, i2]) { const w = weld[i] * 3; acc[w] += cx; acc[w + 1] += cy; acc[w + 2] += cz; }
  }
  const nor = g.attributes.normal && g.attributes.normal.count === N ? g.attributes.normal : new THREE.BufferAttribute(new Float32Array(N * 3), 3);
  for (let i = 0; i < N; i++) { const w = weld[i] * 3, l = Math.hypot(acc[w], acc[w + 1], acc[w + 2]) || 1; nor.setXYZ(i, acc[w] / l, acc[w + 1] / l, acc[w + 2] / l); }
  g.setAttribute('normal', nor); nor.needsUpdate = true; return g;
}
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
