// The world built around the road never gets in its way, on any stage (hand-made or drawn in the editor): the ground
// stays under every road that passes near (not just the one it was shaped for), bridge supports never stand on a road
// underneath, and one road only passes over another on a bridge. Each of these was a bug on a real stage once.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import M from './core-under-test.js';
import { addBridge } from '../src/render/elements/bridge.js';
import { HALF } from '../src/core/constants.js';

const built = M.STAGES.map(st => { const tr = M.buildTrack(st); return { st, tr, terr: M.buildTerrain(tr, st) }; });
const nearTunnel = (tr, i) => { for (let d = -8; d <= 8; d++) { const j = tr.loopN ? tr.nb0(i, d) : Math.max(0, Math.min(tr.N - 1, i + d)); if (tr.tunnel[j]) return true; } return false; };
const otherStretch = (tr, a, b) => { const d = Math.abs(tr.bi(a) - tr.bi(b)), L = tr.loopN; return (L ? Math.min(d, L - d) : d) > 60; };
describe('the world stays out of the road', () => {
  for (const { st, tr, terr } of built) it(`${st.name}: no ground above the road`, () => {
    const bad = [];
    for (let i = 0; i < tr.N; i += 2) {
      if (tr.bridge[i] || tr.tunnel[i] || nearTunnel(tr, i) || (tr.voidMask && tr.voidMask[tr.bi(i)])) continue;
      for (const o of [-(HALF - 1), 0, HALF - 1]) { const up = terr.at(tr.xs[i] + tr.rx[i] * o, tr.zs[i] + tr.rz[i] * o) - tr.H[i]; if (up > 0.5) bad.push(`sample ${i} lat ${o}: ${up.toFixed(1)} m`); }
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });
  for (const { st, tr, terr } of built) if (tr.bridge.some(v => v)) it(`${st.name}: no bridge support on a road underneath`, () => {
    const g = new THREE.Group(); addBridge(g, tr, terr, st);
    const bad = [];
    g.traverse(o => (o.userData.supports || []).forEach(p => {
      // the road's centre line inside the support's box grown by the road's half width, less a little: they overlap
      const top = p.y + p.sy / 2, c = Math.cos(p.ry || 0), sn = Math.sin(p.ry || 0), mu = (p.sx || 1) / 2 + HALF - 1, mv = (p.sz || 1) / 2 + HALF - 1;
      for (let j = 0; j < tr.N; j++) {
        if (tr.bridge[j] || tr.H[j] >= top - 1.5) continue;
        const dx = tr.xs[j] - p.x, dz = tr.zs[j] - p.z;
        if (Math.abs(dx * c - dz * sn) < mu && Math.abs(dx * sn + dz * c) < mv) { bad.push(`support at ${p.x.toFixed(0)},${p.z.toFixed(0)} on sample ${j}`); break; }
      }
    }));
    expect(bad.slice(0, 5)).toEqual([]);
  });
  for (const { st, tr } of built) it(`${st.name}: one road only crosses another on a bridge`, () => {
    const bad = [];
    for (let i = 0; i < tr.N; i += 3) for (let j = i + 60; j < tr.N; j += 3) {
      if (!otherStretch(tr, i, j) || Math.hypot(tr.xs[i] - tr.xs[j], tr.zs[i] - tr.zs[j]) > HALF) continue;
      const [lo, hi] = tr.H[i] < tr.H[j] ? [i, j] : [j, i];
      if (tr.H[hi] - tr.H[lo] > 1.5 && !tr.bridge[hi] && !tr.tunnel[lo]) bad.push(`${hi} over ${lo} without a bridge (${(tr.H[hi] - tr.H[lo]).toFixed(1)} m)`);
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });
});
