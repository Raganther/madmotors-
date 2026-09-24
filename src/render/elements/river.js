import * as THREE from 'three';
import { lerp } from '../../core/math.js';
import { chunkMesh } from '../geometry.js';
import { withCutaway } from '../materials.js';

export function addRiver(group, tr) {
  const rv = tr.river; if (!rv) return;
  const pos = [], hw = rv.width / 2 + 6, y = rv.level;
  for (let k = 0; k < rv.pts.length - 1; k++) {
    const [ax, az] = rv.pts[k], [bx, bz] = rv.pts[k + 1], L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 8), nx = -(bz - az) / L * hw, nz = (bx - ax) / L * hw;
    for (let q = 0; q < n; q++) {
      const t0 = q / n, t1 = (q + 1) / n, x0 = lerp(ax, bx, t0), z0 = lerp(az, bz, t0), x1 = lerp(ax, bx, t1), z1 = lerp(az, bz, t1);
      pos.push(x0 - nx, y, z0 - nz, x1 - nx, y, z1 - nz, x0 + nx, y, z0 + nz, x0 + nx, y, z0 + nz, x1 - nx, y, z1 - nz, x1 + nx, y, z1 + nz);
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  // wind the triangles upward if the polyline ran the other way
  if (g.attributes.normal.array[1] < 0) { g.attributes.normal.array.forEach((v, i, a) => a[i] = -v); }
  const mat = withCutaway(new THREE.MeshLambertMaterial({ color: 0x3E7DAE, side: THREE.DoubleSide }), false, { cut: false, cloud: true, water: true });   // opaque: nothing needs to show through
  group.add(chunkMesh(g, mat, 80, true));
}
