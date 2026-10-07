// Track versions (G6): night and rain made from a stage (data/versions.js), the wet road (core/elements/weather.js).
import { describe, expect, it } from 'vitest';
import { VERSIONS, versionOf } from '../src/data/versions.js';
import { STAGES, VERSIONED } from '../src/data/stages/index.js';
import { TIERS, roundsOf } from '../src/data/career.js';
import { WET } from '../src/core/elements/weather.js';
import * as M from '../src/core/index.js';

const lap = (st, n = 30) => {   // seconds for one AI car to cover n s of road; returns distance
  const tr = M.buildTrack(st), W = { tr, terr: M.buildTerrain(tr, st), surf: st.surface, armco: !!st.armco };
  let seed = 5; Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const R = M.createRace(W, [{ name: 'A', num: 1, skill: 0.95, model: 'coupe' }, { name: 'You', num: 2, player: true, model: 'coupe' }], { weapons: false }); R.phase = 'racing'; R.autoPlayer = true;
  for (let i = 0; i < 120 * n; i++) M.raceStep(R, 1 / 120, W);
  return { tr, d: R.cars[0].progress };
};
describe('track versions', () => {
  it('a version keeps the road and the seed, changes the look, and names itself', () => {
    const base = STAGES.find(s => s.name === 'Mountain Loop'), n = versionOf(base, 'night'), r = versionOf(base, 'rain');
    expect(n.name).toBe('Mountain Loop at Night'); expect(r.name).toBe('Mountain Loop in the Rain');
    for (const v of [n, r]) { expect(v.segs).toBe(base.segs); expect(v.seed).toBe(base.seed); expect(v.base).toBe(base.name); }
    expect(n.night).toBe(true); expect(r.wet).toBe(1); expect(r.colors.road).not.toBe(base.colors.road);
    expect(M.buildTrack(n).loopN).toBe(M.buildTrack(base).loopN);
    expect(Object.keys(VERSIONS)).toEqual(['night', 'rain']);
  });
  it('every listed version is a stage, and the career races some', () => {
    for (const [name, v] of VERSIONED) expect(STAGES.some(s => s.base === name && s.version === v)).toBe(true);
    const raced = new Set(TIERS.flatMap(t => t.events.flatMap(e => roundsOf(e).map(r => r.stage))));
    for (const v of ['night', 'rain']) expect(STAGES.some(s => s.version === v && raced.has(s.name)), v).toBe(true);
  });
  it('a wet road holds less: slower corners for the AI, slower progress', () => {
    const base = STAGES.find(s => s.name === 'Ravenrock Gorge'), dry = lap(base), wet = lap(versionOf(base, 'rain'));
    expect(wet.tr.wet).toBe(1); expect(dry.tr.wet).toBe(0);
    expect(Math.max(...wet.tr.vmax.slice(0, 500))).toBeLessThan(Math.max(...dry.tr.vmax.slice(0, 500)) + 1e-6);
    expect(wet.d).toBeLessThan(dry.d); expect(wet.d).toBeGreaterThan(dry.d * (1 - WET.GRIP));
  }, 60000);
});
