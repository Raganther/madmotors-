// Painted ground (core/track/ground.js, the Terrain builder): the landscape is read back where it was painted, a road
// drawn across it follows it at a climb a car can take, and a stage carrying it builds with that landscape as its ground.
import { describe, it, expect } from 'vitest';
import M from './core-under-test.js';
import { closeLoop, fromStroke, sketch } from '../src/core/track/editing.js';
import { GROUND, blankGround, groundAt, groundFor, groundXZ, roadOnGround } from '../src/core/track/ground.js';
import { buildTerrain } from '../src/core/track/terrain.js';

// a 70 m mountain north-east of the middle, a 25 m deep basin south-west
const land = () => {
  const g = blankGround();
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
    const a = g.a0 + c * g.cell, b = g.b0 + r * g.cell;
    g.h[r * g.cols + c] = 70 * Math.exp(-((a - 110) ** 2 + (b - 60) ** 2) / (2 * 60 ** 2)) - 25 * Math.exp(-((a + 110) ** 2 + (b + 60) ** 2) / (2 * 55 ** 2));
  }
  return g;
};
// an oval lap round the middle, over the mountain's flank and through the basin
const lap = g => {
  const pts = Array.from({ length: 200 }, (_, k) => ({ a: 170 * Math.cos(k / 200 * Math.PI * 2), b: 110 * Math.sin(k / 200 * Math.PI * 2) }));
  const r = fromStroke(pts, { tol: 4, closeDist: 40 }), c = closeLoop(r.segs, r.heading);
  return { r, segs: roadOnGround(c.segs, r.heading, g, r.start) };
};
describe('painted ground', () => {
  it('reads back the painted heights, bilinear between grid points, in the plan and in the world', () => {
    const g = blankGround(0, 0, 0, 80, 8); g.h[5 * g.cols + 5] = 8;
    expect(groundAt(g, g.a0 + 40, g.b0 + 40)).toBeCloseTo(8); expect(groundAt(g, g.a0 + 44, g.b0 + 40)).toBeCloseTo(4); expect(groundAt(g, 999, 999)).toBe(0);
    const [a, b] = [g.a0 + 40, g.b0 + 40]; expect(groundXZ(g)((a - b) / Math.SQRT2, -(a + b) / Math.SQRT2)).toBeCloseTo(8);
  });
  it('a road follows the land: climbs the mountain, dips into the basin, never steeper than GRADE, and closes at one height', () => {
    const g = land(), { r, segs } = lap(g), k = sketch(segs, r.heading, 2), hs = k.pts.map(p => p.h);
    expect(k.gap).toBeLessThan(0.6);
    expect(Math.max(...hs)).toBeGreaterThan(20); expect(Math.min(...hs)).toBeLessThan(-5);
    for (let i = 1; i < k.pts.length; i++) {
      const d = Math.hypot(k.pts[i].a - k.pts[i - 1].a, k.pts[i].b - k.pts[i - 1].b);
      expect(Math.abs(hs[i] - hs[i - 1]) / Math.max(d, 0.5)).toBeLessThan(GROUND.GRADE + 0.02);
    }
    expect(Math.abs(hs[0] - hs[hs.length - 1])).toBeLessThan(0.11);
  });
  it('a stage carrying the landscape builds on it: the ground away from the road is the painted land, the road on its own heights', () => {
    const g = land(), { r, segs } = lap(g), base = M.STAGES[0];
    const st = { name: 'Painted', blurb: '', type: 'gorge', laps: 2, seed: 7, surface: 'tarmac', hillAmp: 0, armco: true, startHeading: r.heading, segs, ground: groundFor(g, r.start), light: base.light, colors: base.colors, trees: base.trees };
    const tr = M.buildTrack(st), T = buildTerrain(tr, st);
    const peak = { a: 110 - r.start.a, b: 60 - r.start.b }, x = (peak.a - peak.b) / Math.SQRT2, z = -(peak.a + peak.b) / Math.SQRT2;
    const c = Math.round((x - T.x0) / T.S), row = Math.round((z - T.z0) / T.S);
    expect(T.h[row * T.cols + c]).toBeGreaterThan(55);                       // the mountain top, well off the road
    expect(Math.max(...tr.H)).toBeGreaterThan(20); expect(Math.min(...tr.H)).toBeLessThan(-5);
  });
});
