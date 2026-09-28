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
      if (tr.bridge[i] || tr.tunnel[i] || nearTunnel(tr, i) || (tr.voidMask && tr.voidMask[tr.bi(i)]) || (tr.open && tr.open[tr.bi(i)])) continue;   // open country has no road
      for (const o of [-(HALF - 1), 0, HALF - 1]) { const up = terr.at(tr.xs[i] + tr.rx[i] * o, tr.zs[i] + tr.rz[i] * o) - tr.H[i]; if (up > 0.5) bad.push(`sample ${i} lat ${o}: ${up.toFixed(1)} m`); }
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });
  for (const { st, tr, terr } of built) if (tr.bridge.some(v => v)) it(`${st.name}: no ground poking through a bridge deck`, () => {
    const bad = [];
    for (let i = 0; i < tr.N; i++) if (tr.bridge[i]) for (const o of [-(HALF - 1), 0, HALF - 1]) {
      const up = terr.at(tr.xs[i] + tr.rx[i] * o, tr.zs[i] + tr.rz[i] * o) - tr.H[i]; if (up > -0.8) bad.push(`sample ${i} lat ${o}: ${up.toFixed(1)} m`);
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });
  // a lap is one unbroken road: no two samples in a row further apart than a couple of metres (Mountain Pass once
  // stopped 50 m short of its start line, and the ground between wasn't shaped for a road that wasn't there)
  for (const { st, tr } of built) it(`${st.name}: the road has no gaps`, () => {
    const N = tr.loopN || tr.N, bad = [];
    for (let i = 0; i < (tr.loopN ? N : N - 1); i++) { const j = tr.loopN ? tr.nb0(i, 1) : i + 1, d = Math.hypot(tr.xs[j] - tr.xs[i], tr.zs[j] - tr.zs[i]); if (d > 2.5) bad.push(`sample ${i} to ${j}: ${d.toFixed(1)} m`); }
    expect(bad.slice(0, 5)).toEqual([]);
  });
  // the ground steps up over a tunnel at its mouth; the cells across the opening are left out (core terrain.js holes)
  for (const { st, tr, terr } of built) if (tr.tunnel.some(v => v)) it(`${st.name}: every tunnel mouth is open`, () => {
    const N = tr.loopN || tr.N, bad = [], nb = (i, d) => tr.loopN ? tr.nb0(i, d) : Math.max(0, Math.min(N - 1, i + d));
    const open = (x, z, y) => { const c = Math.floor((x - terr.x0) / terr.S), r = Math.floor((z - terr.z0) / terr.S); return (terr.holes && terr.holes[r * (terr.cols - 1) + c]) || terr.at(x, z) < y; };
    for (let i = 0; i < N; i++) for (const into of [1, -1]) {
      if (!tr.tunnel[i] || tr.tunnel[nb(i, -into)] || nb(i, -into) === i) continue;                  // a mouth, facing out along -into
      for (let a = -4; a <= 0; a++) for (const o of [-(HALF - 2), 0, HALF - 2]) {
        const x = tr.xs[i] + tr.tx[i] * a * into + tr.rx[i] * o, z = tr.zs[i] + tr.tz[i] * a * into + tr.rz[i] * o;
        if (!open(x, z, tr.H[i] + 1.5)) bad.push(`mouth at sample ${i}, ${a} m along, lat ${o}: ground ${(terr.at(x, z) - tr.H[i]).toFixed(1)} m up`);
      }
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
        if (tr.H[j] >= top - 1.5) continue;
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
