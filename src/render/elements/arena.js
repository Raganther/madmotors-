import * as THREE from 'three';
import { BREAKABLES } from '../../data/breakables.js';
import { flat, mergeAll } from '../geometry.js';
import { arenaOut, inArena } from '../../core/elements/arena.js';

// A derby arena's wall ring (core/elements/arena.js places it; core/features/breakables.js bounces cars off it):
// dozens of pieces end to end, so it is drawn as one merged mesh per material, not a group per piece (the props
// inside are ordinary breakables, render/elements/breakables.js). Tyres: stacks of tyres, the odd stack painted;
// barrier: a concrete wall with a row of sponsor boards and floodlights round it; bales: hay bales two high.
const RING = {
  tyres: (put, k, L) => { const n = Math.max(2, Math.round(L / 1.2)); for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) put(new THREE.CylinderGeometry(0.55, 0.55, 0.36, 10).translate(0, 0.2 + j * 0.37, (i - (n - 1) / 2) * (L - 0.6) / (n - 1)), (k * 4 + i) % 9 === 0 ? 0xE8E8E8 : (k * 4 + i) % 9 === 4 ? 0xC8352A : 0x1E1F23); },
  barrier: (put, k, L) => { put(new THREE.BoxGeometry(0.9, 1.3, L).translate(0, 0.65, 0), 0xC9C6BE); put(new THREE.BoxGeometry(0.1, 0.6, L - 0.4).translate(-0.5, 1.0, 0), [0xD7261E, 0xFFC72C, 0x2F7DE0, 0xF4F4F0][k % 4]); },
  bales: (put, k, L) => { const n = Math.max(2, Math.round(L / 1.22)); for (let i = 0; i < n; i++) for (let j = 0; j < 2; j++) put(new THREE.BoxGeometry(1.4, 0.75, 1.15).translate(0, 0.38 + j * 0.76, (i - (n - 1) / 2) * (L - 1.1) / (n - 1) + (j ? 0.3 : 0)), (k + i + j) % 3 ? 0xD9B85C : 0xC9A64A); },
};
export function addArena(group, tr, terr) {
  const A = tr.arena; if (!A) return;
  const geos = new Map(), m4 = new THREE.Matrix4();
  (tr.breakables || []).filter(b => b.arena && BREAKABLES[b.kind].arena).forEach((b, k) => {
    m4.makeRotationY(b.yaw).setPosition(b.x, b.y ?? A.floor, b.z);
    RING[A.ring]((g, c) => { if (!geos.has(c)) geos.set(c, []); geos.get(c).push(flat(g).applyMatrix4(m4)); }, k, b.len || 5);   // (each piece cut to its run: b.len)
  });
  for (const [c, list] of geos) { const m = new THREE.Mesh(mergeAll(list), new THREE.MeshLambertMaterial({ color: c })); m.castShadow = true; m.receiveShadow = true; group.add(m); }
  // pits: a mud wallow is a churned brown skin over the dip; a water hole is a flat pool filling it
  for (const p of A.pits) {
    const g = new THREE.CircleGeometry(p.r * (p.kind === 'water' ? 0.95 : 1.05), 28, 0).rotateX(-Math.PI / 2), pos = g.attributes.position, col = [];
    const c0 = new THREE.Color(p.kind === 'water' ? 0x2E4A58 : 0x2E2218), c1 = new THREE.Color(p.kind === 'water' ? 0x4A7080 : 0x4A3626);
    for (let i = 0; i < pos.count; i++) {
      const x = p.x + pos.getX(i), z = p.z + pos.getZ(i), e = Math.hypot(pos.getX(i), pos.getZ(i)) / p.r, n = Math.sin(x * 1.7) * Math.cos(z * 1.3);
      pos.setXYZ(i, x, p.kind === 'water' ? A.floor - 0.04 : terr.at(x, z) + 0.04, z);
      const k = Math.min(1, Math.max(0, 0.5 + n * 0.3 + (p.kind === 'water' ? e * 0.4 : -e * 0.2))); col.push(...c0.clone().lerp(c1, k).toArray());
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, p.kind === 'water' ? new THREE.MeshLambertMaterial({ color: 0x3A5E6E, transparent: true, opacity: 0.92, depthWrite: false })
      : new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 25, specular: 0x2A2420, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.receiveShadow = true; group.add(m);
  }
  // ramps: a solid wedge over the terrain's hump (core arenaRamps), boards or packed earth, with a dark lip and chevrons
  const wood = A.ring === 'barrier', side = new THREE.MeshLambertMaterial({ color: wood ? 0x6E5A44 : 0x5E4632 }), chev = new THREE.MeshBasicMaterial({ color: 0xFFC72C });
  for (const r of A.ramps) {
    const g = new THREE.BufferGeometry(), P = [], C = [], hw = r.w / 2, L = r.len / 2, prof = [[-L, 0], [L / 2, r.h], [L, 0]];   // along, height: up 3/4, off the lip
    const top = new THREE.Color(wood ? 0xA8885E : 0x7A5E40), lip = new THREE.Color(0x2A2622), at = (u, v, y) => [r.x + Math.sin(r.yaw) * u + Math.cos(r.yaw) * v, A.floor + y + 0.04, r.z + Math.cos(r.yaw) * u - Math.sin(r.yaw) * v];
    const quad = (a, b, c, d, col) => { for (const p of [a, b, c, a, c, d]) { P.push(...p); C.push(col.r, col.g, col.b); } };
    for (let i = 0; i < 2; i++) { const [u0, y0] = prof[i], [u1, y1] = prof[i + 1]; quad(at(u0, -hw, y0), at(u0, hw, y0), at(u1, hw, y1), at(u1, -hw, y1), i ? lip : top); }
    for (const v of [-hw, hw]) { const c = new THREE.Color(side.color); P.push(...at(-L, v, 0), ...at(L / 2, v, r.h), ...at(L, v, 0)); for (let k = 0; k < 3; k++) C.push(c.r, c.g, c.b); }
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })); m.castShadow = true; m.receiveShadow = true; group.add(m);
    const slope = Math.atan2(r.h, 1.5 * L);
    for (const f of [0.3, 0.65]) {   // two chevrons up the face
      const u = -L + f * 1.5 * L, s = new THREE.Mesh(new THREE.BoxGeometry(hw * 1.1, 0.03, 0.45), chev), [x, y, z] = at(u, 0, f * r.h + 0.02);
      s.position.set(x, y, z); s.rotation.set(-slope, r.yaw, 0, 'YXZ'); group.add(s);
    }
  }
  if (A.ring === 'barrier') {   // floodlights round the stadium, at the outline's corners (every few, outside the wall)
    const pole = new THREE.MeshLambertMaterial({ color: 0x8A8F98 }), lamp = new THREE.MeshBasicMaterial({ color: 0xFFF6D8 }), P = A.poly, step = Math.max(1, Math.round(P.length / 6));
    for (let k = 0; k < P.length; k += step) {
      const [px, pz] = P[k], [ax, az] = P[(k + P.length - 1) % P.length], [bx, bz] = P[(k + 1) % P.length], L = Math.hypot(bx - ax, bz - az) || 1, s = inArena(A, px + (bz - az) / L, pz - (bx - ax) / L) ? -6 : 6, x = px + (bz - az) / L * s, z = pz - (bx - ax) / L * s;   // out along the outline's normal
      if (arenaOut(A, x, z) < 4) continue;   // (a corner where the outline turns in, by a neck: no room)
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 16, 8), pole); p.position.set(x, A.floor + 8, z); p.castShadow = true; group.add(p);
      const h = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 0.5), lamp); h.position.set(x, A.floor + 16.3, z); h.lookAt(A.x, A.floor, A.z); group.add(h);
    }
  }
}
