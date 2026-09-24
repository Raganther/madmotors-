// Track elements: the registry, stage validation and one small sandbox per element (data/sandboxes).
import { describe, it, expect } from 'vitest';
import M from './core-under-test.js';
import { SANDBOXES } from '../src/data/sandboxes/index.js';
import { genCircuit } from '../src/core/track/circuit.js';
import { seedRandom } from './scenarios.js';
const FERRYLEN = M.FERRY.LEN;

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
const EXPECT = { kick: ['kick'], jump: ['jump'], bridge: ['bridge'], viaduct: ['bridge'], tunnel: ['tunnel', 'arch'], town: ['town', 'rockfall', 'gallery'], rails: ['rails'], gap: ['gap', 'boost', 'kick'], ferry: ['ferry'], branch: ['kick', 'boost', 'falls'] };
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

describe('gap and boost pads', () => {
  const setup = () => { seedRandom(4); const st = SANDBOXES.gap, tr = M.buildTrack(st), W = { tr, terr: M.buildTerrain(tr, st), surf: st.surface, armco: true }; const R = M.createRace(W, [{ name: 'p', player: true }]); R.phase = 'racing'; R.hzT = 1e9; return { tr, W, R, c: R.cars[0] }; };
  const gapRun = tr => { let a = -1, b = -1; for (let i = 0; i < tr.loopN; i++) if (tr.gap[i]) { if (a < 0) a = i; b = i; } return [a, b]; };
  const put = (tr, c, i, v) => { c.x = tr.xs[i]; c.z = tr.zs[i]; c.y = tr.H[i]; c.yaw = tr.th[i]; c.pr = M.project(tr, c.x, c.z, i, 3, 3); c.progress = i; c.lastGood = i; c.vx = tr.tx[i] * v; c.vz = tr.tz[i] * v; c.vy = 0; c.onGround = true; };
  it('too slow: the car drops into the gap and comes back on the far side', () => {
    const { tr, W, R, c } = setup(), [a, b] = gapRun(tr); put(tr, c, a - 3, 9);
    let fell = false; for (let n = 0; n < 600 && !fell; n++) { c.inp.throttle = 0; M.raceStep(R, 1 / 120, W); fell = c.events.some(e => e.t === 'fell'); c.events.length = 0; }
    expect(fell).toBe(true);
    expect(c.pr.i).toBeGreaterThan(b);                                  // respawned past the far edge
    expect(c.pr.i).toBeLessThan(b + 20);
  });
  it('boost pads fire a boost', () => {
    const { tr, W, R, c } = setup(); let i0 = -1; for (let i = 0; i < tr.loopN; i++) if (tr.boostPad[i]) { i0 = i; break; }
    put(tr, c, i0 - 4, 20); for (let n = 0; n < 60; n++) { c.inp.throttle = 1; M.raceStep(R, 1 / 120, W); }
    expect(c.boost).toBeGreaterThan(0.3);
  });
});

describe('ferry (barge)', () => {
  const setup = () => { seedRandom(3); const st = SANDBOXES.ferry, tr = M.buildTrack(st), W = { tr, terr: M.buildTerrain(tr, st), surf: st.surface, armco: true }; return { tr, W }; };
  it('everyone boards, it waits for them to stop, crosses with them aboard, and they drive off at the far dock', () => {
    const { tr, W } = setup(), R = M.createRace(W, DEFS); R.phase = 'racing'; R.autoPlayer = true; R.hzT = 1e9;
    const f = W.ferries[0]; let depart = null, arrive = false, t = 0;
    while (t < 40 && !arrive) {
      M.raceStep(R, 1 / 120, W); t += 1 / 120;
      for (const e of R.player.events) { if (e.t === 'ferry-depart' && !depart) depart = { aboard: e.aboard, speeds: R.cars.map(c => Math.hypot(c.vx, c.vz)) }; if (e.t === 'ferry-arrive') arrive = true; }
      for (const c of R.cars) c.events.length = 0;
    }
    expect(depart.aboard.length).toBe(4);
    for (const v of depart.speeds) expect(v).toBeLessThan(2.5);                 // pulled up before it left
    expect(arrive).toBe(true);
    for (const c of R.cars) expect(c.pr.s % tr.loopN).toBeGreaterThan(f.b - FERRYLEN);   // rode across
    for (let n = 0; n < 600; n++) M.raceStep(R, 1 / 120, W);
    for (const c of R.cars) expect(c.pr.s % tr.loopN).toBeGreaterThan(f.b + 5);          // and drove off
    expect(R.cars.every(c => c.respawns === 0)).toBe(true);
  });
  it('a car that misses it waits at the shut gate (never past the edge) and catches the next trip', () => {
    const { tr, W } = setup(), R = M.createRace(W, [{ name: 'a', skill: 0.95 }, { name: 'p', player: true }]); R.phase = 'racing'; R.autoPlayer = true; R.hzT = 1e9;
    const f = W.ferries[0], P = R.player; let moved = false, t = 0, rode = false, closest = 99;
    while (t < 40 && !rode) {
      if (f.phase === 'toB' && !moved) { moved = true; const i = f.a - 60; P.x = tr.xs[i]; P.z = tr.zs[i]; P.y = tr.H[i]; P.yaw = tr.th[i]; P.pr = M.project(tr, P.x, P.z, i, 3, 3); P.progress = i; P.lastGood = i; P.vx = tr.tx[i] * 20; P.vz = tr.tz[i] * 20; P.onGround = true; }
      M.raceStep(R, 1 / 120, W); t += 1 / 120;
      const pb = P.pr.s % tr.loopN; if (moved && f.phase !== 'A' && pb < f.a + 2 && pb > f.a - 8) closest = Math.min(closest, f.a - pb);
      if (moved && f.trips === 2 && pb > f.b) rode = true;
      for (const c of R.cars) c.events.length = 0;
    }
    expect(closest).toBeGreaterThan(0);                                            // held at the gate
    expect(rode).toBe(true);                                                        // over on the second trip
    expect(P.respawns).toBe(0);
  });
});


describe('branches (stage.branches: the road splits and joins again)', () => {
  const st = SANDBOXES.branch, tr = M.buildTrack(st), a = tr.alts[0];
  it('the road graph: fork to merge along the branch, progress mapped onto the main road it replaces', () => {
    expect(a.M - a.F).toBe(160);
    for (const L of [0, 1, 2]) {
      const F = L * tr.loopN + a.F, M0 = L * tr.loopN + a.M;
      expect(tr.adv(F, 1, -1)).toBe(F + 1);                                          // the main road by default
      const j = tr.adv(F, 1, 0); expect(j).toBeGreaterThanOrEqual(tr.NM); expect(tr.bi(j)).toBe(a.o);
      expect(tr.adv(F, a.n + 1, 0)).toBe(M0);                                        // along the branch to the merge
      expect(tr.adv(j, -1)).toBe(F);
      let last = -1; for (let q = 0; q < a.n; q++) { const p = tr.progOf(tr.adv(j, q)); expect(p).toBeGreaterThan(last); last = p; }
      expect(last).toBeGreaterThan(M0 - 2); expect(last).toBeLessThan(M0);
    }
    const q = tr.nearest(tr.xs[a.u + 60], tr.zs[a.u + 60]); expect(q.i).toBe(a.u + 60); // nearest() gives lap-0 road indices
  });
  it('no barriers between the two roads where they run side by side, tyres on the nose where they part', () => {
    let fork = 0, merge = 0; for (let b = 0; b < tr.NB; b++) if (tr.twin[b] >= 0) { if (b < a.F + 60 || (b >= a.o && b < a.o + 60)) fork++; else merge++; }
    expect(fork).toBeGreaterThan(40); expect(merge).toBeGreaterThan(40);
    const side = tr.wallL[a.u + 5] === 0 ? 'wallL' : 'wallR';
    expect(tr.wallL[a.F + 10]).toBe(0);                                              // the branch leaves on the main road's left
    expect([...Array(40)].some((_, k) => tr[side][a.u + 20 + k] === 1 || tr.wallR[a.u + 20 + k] === 1)).toBe(true);
  });
  it('the AI splits between the routes and everyone gets round; plain circuits and point-to-point stages have the same route API', () => {
    seedRandom(3); const W = { tr, terr: M.buildTerrain(tr, st), surf: st.surface, armco: true };
    const R = M.createRace(W, DEFS); R.phase = 'racing'; R.autoPlayer = true; R.hzT = 1e9;
    const took = R.cars.map(() => 0); let t = 0;
    while (t < 120 && R.cars.some(c => !c.finished)) { M.raceStep(R, 1 / 120, W); t += 1 / 120; R.cars.forEach((c, k) => { if (c.pr.i >= tr.NM) took[k] = 1; }); }
    expect(R.cars.every(c => c.finished)).toBe(true);
    expect(took.some(v => v)).toBe(true);
    expect(R.cars.reduce((n, c) => n + c.respawns, 0)).toBe(0);
    for (const s of [M.STAGES[0], M.STAGES[4]]) { const t2 = M.buildTrack(s); expect(t2.alts).toEqual([]); expect(t2.bi(7)).toBe(7); expect(t2.u0(7)).toBe(7); expect(t2.progOf(12.5)).toBe(12.5); expect(t2.adv(10, 5)).toBe(15); }
  });
  it('a branch that does not rejoin where it should, or uses an element branches do not support, fails loudly', () => {
    const br = st.branches[0], bad = segs => M.buildTrack({ ...st, branches: [{ ...br, segs }] });
    expect(() => bad(br.segs.slice(0, -1))).toThrow(/branch 0 ends .* from where it should rejoin/);
    expect(() => bad([...br.segs.slice(0, 2), ['s', 56, -4, { bridge: true }], ...br.segs.slice(3)])).toThrow(/"bridge" can't be used on a branch/);
  });
});
