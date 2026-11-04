import * as THREE from 'three';
import { G } from '../../game.js';
import { race } from '../../ui/flow.js';
import { HALF } from '../../core/constants.js';
import { surfReach } from '../../core/elements/surf.js';

// Surf (core/elements/surf.js): on each surf stretch, a sheet of wash running from out in the water up across the road
// to the wave's reach, a band of foam at its front. Rebuilt every frame from race time, so it is exactly where the
// simulation says the water is. Looks only.
let runs = [];
export function addSurf(group, tr) {
  runs = []; if (!tr.surf) return;
  const NB = tr.NB;
  for (let b = 0; b < NB; b++) {
    if (!tr.surf[b] || (b > 0 && tr.surf[b - 1])) continue;
    let e = b; while (e < NB && tr.surf[e]) e++;
    const rows = []; for (let q = b; q < e; q += 2) rows.push(q);
    const n = rows.length; if (n < 2) continue;
    const mk = (color, opacity) => { const g = new THREE.BufferGeometry(), pos = new Float32Array(n * 2 * 3), idx = []; for (let r = 0; r < n - 1; r++) { const a = r * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide })); m.frustumCulled = false; m.renderOrder = 3; group.add(m); return m; };
    runs.push({ rows, wash: mk(0xA9D6E4, 0.55), foam: mk(0xF4FAFC, 0.85) });
  }
  updateSurf();
}
export function updateSurf() {
  if (!runs.length) return;
  const W = G.world && G.world.W, tr = W && W.tr; if (!tr || !tr.surf) return;
  const t = race ? race.time : 0;
  for (const R of runs) {
    const pw = R.wash.geometry.attributes.position, pf = R.foam.geometry.attributes.position;
    R.rows.forEach((b, r) => {
      const i = tr.u0(b), side = tr.surfSide[b], rx = tr.rx[i] * side, rz = tr.rz[i] * side, y = tr.H[i] + 0.12, reach = surfReach(tr, b, t);
      // lateral offsets (towards the water positive): the sheet's outer edge in the water, its front at the reach, foam 1.4 m deep
      const out = HALF + 10, front = HALF - reach, foamBack = Math.min(out, front + 1.4);
      const P = (o, h) => [tr.xs[i] + rx * o, h, tr.zs[i] + rz * o];
      pw.array.set([...P(out, y - 0.4), ...P(foamBack, y)], r * 6);
      pf.array.set([...P(foamBack, y + 0.01), ...P(front, y + 0.02)], r * 6);
    });
    pw.needsUpdate = true; pf.needsUpdate = true;
    const any = R.rows.some(b => surfReach(tr, b, t) > 0.3); R.wash.visible = R.foam.visible = any;
  }
}
