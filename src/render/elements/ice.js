import * as THREE from 'three';
import { HALF } from '../../core/constants.js';
import { canvasTex } from '../geometry.js';
import { withCutaway } from '../materials.js';

// Ice patches (core/elements/ice.js): a blue glaze over the road, darker than the snow round it, with painted glints,
// cracked and streaked, its ends ragged and tapering so it reads as a patch that has frozen across the road rather than a painted block.
let tex = null;
function iceTex() {
  if (tex) return tex;
  tex = canvasTex(128, 256, (g, w, h) => {
    let s = 17; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    g.fillStyle = '#E4EAF0'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 6; k++) { g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(r() * w, r() * h, 3 + r() * 6, 60 + r() * 90); }   // glints (a real highlight floods a flat patch white from this camera)
    for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(190,215,235,${0.15 + r() * 0.3})`; g.fillRect(r() * w, r() * h, 2 + r() * 10, 20 + r() * 60); }   // frost streaks along
    g.strokeStyle = 'rgba(120,160,195,0.55)'; g.lineWidth = 1;
    for (let k = 0; k < 14; k++) {                                                   // cracks
      let x = r() * w, y = r() * h; g.beginPath(); g.moveTo(x, y);
      for (let q = 0; q < 5; q++) { x += (r() - 0.5) * 30; y += (r() - 0.5) * 30; g.lineTo(x, y); }
      g.stroke();
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping; return tex;
}
export function addIce(group, tr) {
  if (!tr.ice) return;
  const pos = [], uv = [], idx = [], C = 9;
  for (const i0 of tr.all0) {
    const b = tr.bi(i0); if (!tr.ice[b] || (b > 0 && tr.ice[b - 1])) continue;          // the start of a run
    let n = 0; while (b + n < tr.NB && tr.ice[b + n]) n++;
    const rows = []; for (let i = i0, k = 0; k <= n; k++, i = tr.nb0(i, 1)) rows.push(i);
    const base = pos.length / 3;
    rows.forEach((i, k) => {
      const end = Math.min(k, n - k), taper = Math.min(1, end / 6);
      for (let c = 0; c < C; c++) {
        const f = c / (C - 1) - 0.5, rag = 0.85 + 0.15 * Math.sin(i * 1.7 + c * 2.3);   // ragged edges, narrowing to the ends
        const o = f * 2 * (HALF - 0.4) * Math.min(1, taper * rag * 1.2);
        pos.push(tr.xs[i] + tr.rx[i] * o, tr.H[i] + 0.09, tr.zs[i] + tr.rz[i] * o); uv.push(c / (C - 1), k / 10);
      }
      if (k) for (let c = 0; c < C - 1; c++) { const a = base + (k - 1) * C + c, d = a + C; idx.push(a, d, a + 1, a + 1, d, d + 1); }
    });
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  const mat = withCutaway(new THREE.MeshLambertMaterial({ map: iceTex(), color: 0x86B4D8, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }), false, { cut: false, cloud: true });
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.renderOrder = 1; group.add(m);
}
