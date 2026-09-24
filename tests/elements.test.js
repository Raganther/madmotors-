// Track elements: the registry, stage validation and one small sandbox per element (data/sandboxes).
import { describe, it, expect } from 'vitest';
import M from './core-under-test.js';
import { SANDBOXES } from '../src/data/sandboxes/index.js';
import { genCircuit } from '../src/core/track/circuit.js';
import { seedRandom } from './scenarios.js';

const DEFS = [{ name: 'a', skill: 0.95, flick: 0.38, driftK: 1 / 62 }, { name: 'b', skill: 0.99, flick: 0.22, driftK: 1 / 38 }, { name: 'p', player: true }, { name: 'c', skill: 0.92, flick: 0.28, driftK: 1 / 50 }];

describe('element registry and stage validation', () => {
  it('elements have unique names, and every section tag belongs to exactly one element', () => {
    const names = M.ELEMENTS.map(e => e.name); expect(new Set(names).size).toBe(names.length);
    const tags = M.ELEMENTS.flatMap(e => Object.keys(e.tags || {})); expect(new Set(tags).size).toBe(tags.length);
  });
  it('every stage and sandbox validates', () => { for (const s of [...M.STAGES, ...Object.values(SANDBOXES)]) expect(() => M.validateStage(s)).not.toThrow(); });
  it('a typo in a section tag or a stage option fails loudly, naming the tags that exist', () => {
    const base = SANDBOXES.bridge;
    expect(() => M.buildTrack({ ...base, segs: [...base.segs.slice(0, 1), ['s', 20, 0, { brigde: true }], ...base.segs.slice(1)] })).toThrow(/tag "brigde".*Section tags: .*bridge/);
    expect(() => M.buildTrack({ ...base, jmups: 2 })).toThrow(/stage option "jmups"/);
  });
  it('a section that comes out backwards (sections before it overshoot) fails loudly', () => {
    const base = SANDBOXES.bridge, segs = base.segs.slice(); segs[0] = ['s', 20, 0];   // bottom too short for the top
    expect(() => M.buildTrack({ ...base, segs })).toThrow(/comes out -?\d+\.\d m long/);
  });
});

// what each sandbox must contain, by element name
const EXPECT = { kick: ['kick'], jump: ['jump'], bridge: ['bridge'], viaduct: ['bridge'], tunnel: ['tunnel', 'arch'], town: ['town', 'rockfall', 'gallery'], rails: ['rails'] };
describe('sandboxes', () => {
  it('there is a sandbox listed here for each one defined', () => expect(Object.keys(SANDBOXES).sort()).toEqual(Object.keys(EXPECT).sort()));
  for (const [name, stage] of Object.entries(SANDBOXES)) it(`${name}: builds, closes, has its elements, and four AI cars lap it cleanly`, () => {
    expect(genCircuit(stage).closeGap).toBeLessThan(1.5);
    const tr = M.buildTrack(stage), got = new Set(M.trackMarkers(tr).map(m => m.element));
    for (const e of EXPECT[name]) expect(got).toContain(e);
    seedRandom(11); const W = { tr, terr: M.buildTerrain(tr, stage), surf: stage.surface, armco: !!stage.armco, traffic: stage.traffic };
    const R = M.createRace(W, DEFS); R.phase = 'racing'; R.autoPlayer = true; R.hzT = 1e9;   // no leader hazards: judge the element itself
    const lapEnd = tr.startIdx + tr.loopN; let t = 0;
    while (t < 60 && R.cars.some(c => c.progress < lapEnd)) { M.raceStep(R, 1 / 120, W); t += 1 / 120; }
    expect(R.cars.every(c => c.progress >= lapEnd)).toBe(true);
    expect(R.cars.reduce((a, c) => a + c.respawns, 0)).toBeLessThanOrEqual(1);
  });
  it('element tags reach the built track', () => {
    const b = M.buildTrack(SANDBOXES.bridge), k = M.buildTrack(SANDBOXES.kick);
    expect(b.bridge.reduce((a, v) => a + v, 0)).toBeGreaterThan(60);
    expect(k.kicks.map(x => x.h)).toEqual([2.6, 2.2, 2.4]);
    for (const { i } of k.kicks) expect(k.jump[i + 5]).toBe(1);
  });
});
