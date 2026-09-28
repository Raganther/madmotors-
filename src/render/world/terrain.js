import * as THREE from 'three';
import { HALF } from '../../core/constants.js';
import { clamp, mulberry32, smoothstep } from '../../core/math.js';
import { chunkMesh } from '../geometry.js';
import { withCutaway } from '../materials.js';
import { quality } from '../renderer.js';

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
    // drops read from above: ground at the foot of a rise sits in its shadow, the lip along the top of a drop catches the light
    let up = 0, down = 0;
    for (let rr = -2; rr <= 2; rr++) for (let cc = -2; cc <= 2; cc++) { const hh = h[clamp(r + rr, 0, rows - 1) * cols + clamp(c + cc, 0, cols - 1)] - y; if (hh > up) up = hh; if (-hh > down) down = -hh; }
    t.multiplyScalar(1 - 0.32 * smoothstep(2.5, 12, up) * (1 - steep * 0.5) + 0.12 * smoothstep(2.5, 10, down) * (1 - steep));
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
  // normals half way between per-face (the faceted look) and smooth (light rolls across the slopes instead of breaking
  // at every triangle): the ground stays low-poly but loses the crinkled-paper look up close
  g.computeVertexNormals(); const fg = g.toNonIndexed(); g.dispose();
  const sn = fg.attributes.normal.array.slice(); fg.computeVertexNormals(); const nn = fg.attributes.normal.array;
  for (let i = 0; i < nn.length; i += 3) { const x = nn[i] * 0.45 + sn[i] * 0.55, y = nn[i + 1] * 0.45 + sn[i + 1] * 0.55, z = nn[i + 2] * 0.45 + sn[i + 2] * 0.55, l = Math.hypot(x, y, z) || 1; nn[i] = x / l; nn[i + 1] = y / l; nn[i + 2] = z / l; }
  const mesh = chunkMesh(fg, withCutaway(new THREE.MeshLambertMaterial({ vertexColors: true }), true, { cloud: true, grain: 0.1, strata: stage.strata || 0 }), 60, true);
  // cliffs and banks throw shadows on the ground below them (the rest of the height cue from the top-down cameras); not on
  // Graphics: Low (applyQuality flips it)
  // only chunks with real relief in them: flat ground can't shade anything, and every caster is drawn again for the sun
  mesh.traverse(o => { if (!o.isMesh) return; o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox; if (bb.max.y - bb.min.y < 7) return; o.userData.terrain = true; o.castShadow = quality !== 'low'; });
  return mesh;
}
