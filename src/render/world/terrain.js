import * as THREE from 'three';
import { HALF } from '../../core/constants.js';
import { clamp, mulberry32, smoothstep } from '../../core/math.js';
import { chunkMesh } from '../geometry.js';
import { withCutaway } from '../materials.js';

export function makeTerrainMesh(terr, tr, stage) {
  const { cols, rows, S, x0, z0, h, dist } = terr, n = cols * rows, C = stage.colors;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  const cA = new THREE.Color(C.grassA), cB = new THREE.Color(C.grassB), cR = new THREE.Color(C.rock), cD = new THREE.Color(C.dirt), cS = new THREE.Color(0xE9EEF2), cR2 = new THREE.Color(C.rock2 || C.rock), t = new THREE.Color();
  const rnd = mulberry32(stage.seed + 5);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const i = r * cols + c, x = x0 + c * S, z = z0 + r * S, y = h[i];
    pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
    const dx = (h[r * cols + Math.min(cols - 1, c + 1)] - h[r * cols + Math.max(0, c - 1)]) / (2 * S);
    const dz = (h[Math.min(rows - 1, r + 1) * cols + c] - h[Math.max(0, r - 1) * cols + c]) / (2 * S);
    const nv = tr.noise.fbm(x * 0.03 + 40, z * 0.03, 3) * 0.5 + 0.5;
    t.copy(cA).lerp(cB, clamp(nv * 1.5 - 0.25, 0, 1));
    const steep = smoothstep(0.5, 0.95, Math.hypot(dx, dz));
    t.lerp(cR, steep);
    if (stage.alpine) {
      const al = stage.alpine;
      t.lerp(cR, smoothstep(al.rock[0], al.rock[1], y) * 0.7);
      // mesa strata: alternate rock tones in horizontal bands, strongest on the cliff faces
      if (stage.strata && C.rock2 && Math.floor((y + tr.noise.n2(x * 0.02, z * 0.02) * 0.8) / stage.strata) % 2) t.lerp(cR2, 0.65 * Math.max(steep, smoothstep(al.rock[0], al.rock[1], y)));
      const snow = smoothstep(0.15, 0.35, tr.noise.fbm(x * 0.06, z * 0.06, 2)) * smoothstep(al.snow[0], al.snow[1], y);
      if (snow > 0) t.lerp(cS, snow * 0.9);
    }
    const d = dist[i]; if (d < HALF + 5) t.lerp(cD, 1 - smoothstep(HALF + 2, HALF + 5, d));
    t.offsetHSL(0, 0, (rnd() - 0.5) * 0.035);
    col[i * 3] = t.r; col[i * 3 + 1] = t.g; col[i * 3 + 2] = t.b;
  }
  const idx = new Uint32Array((cols - 1) * (rows - 1) * 6); let k = 0;
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
    const a = r * cols + c, b = a + 1, cc = a + cols, d = cc + 1;
    idx[k++] = a; idx[k++] = cc; idx[k++] = b; idx[k++] = b; idx[k++] = cc; idx[k++] = d;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  const fg = g.toNonIndexed(); g.dispose(); fg.computeVertexNormals();          // per-face normals keep the faceted look with cheap Lambert lighting
  return chunkMesh(fg, withCutaway(new THREE.MeshLambertMaterial({ vertexColors: true }), true, { cloud: true, grain: 0.16 }), 60, true);
}
