// Track elements: the registry, stage validation and one small sandbox per element (data/sandboxes).
import { describe, it, expect } from 'vitest';
import M from './core-under-test.js';
import { SANDBOXES } from '../src/data/sandboxes/index.js';
import { genCircuit } from '../src/core/track/circuit.js';
import { seedRandom } from './scenarios.js';
import { VEHICLES } from '../src/data/vehicles.js';
import { CAR_DEFS, MAX_RIVALS, raceDefs } from '../src/data/cars.js';
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
const EXPECT = { kick: ['kick'], jump: ['jump'], bridge: ['bridge'], viaduct: ['bridge'], tunnel: ['tunnel', 'arch'], town: ['town', 'rockfall', 'gallery'], rails: ['rails'], gap: ['gap', 'boost', 'kick'], ferry: ['ferry'], branch: ['kick', 'boost', 'falls'], drawbridge: ['drawbridge', 'mill'], rally: ['mud', 'whoops', 'yump'], snow: ['ice'], shortcut: ['dirt', 'whoops'], hammer: ['hammer'] };
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

describe('drawbridge', () => {
  const st = SANDBOXES.drawbridge, D = M.DRAW;
  const race = phase => {
    const tr = M.buildTrack(st); tr.drawbridges[0].phase = phase;
    seedRandom(5); const W = { tr, terr: M.buildTerrain(tr, st), surf: st.surface, armco: true };
    const R = M.createRace(W, DEFS); R.phase = 'racing'; R.autoPlayer = true; R.hzT = 1e9; return { tr, W, R };
  };
  it('cycles down, warning, rising, up, lowering on race time; the leaves are a ramp with a gap between their tips', () => {
    const d = { phase: 0 };
    expect(M.drawState(d, 1)).toEqual({ ang: 0, st: 'down' });
    expect(M.drawState(d, D.DOWN + 1).st).toBe('warn');
    expect(M.drawState(d, D.DOWN + D.WARN + D.RISE / 2).ang).toBeCloseTo(D.AMAX / 2);
    expect(M.drawState(d, D.DOWN + D.WARN + D.RISE + 1)).toEqual({ ang: D.AMAX, st: 'up' });
    expect(M.drawState(d, D.CYCLE + 1).st).toBe('down');
    const { W } = race(0), b = W.draws[0], a = 20 * Math.PI / 180; b.ang = a;
    expect(M.groundAt(W, b.a + 5, 0, 0, 0)).toBeCloseTo(b.h + 5 * Math.tan(a));      // up the near leaf
    expect(M.groundAt(W, b.b - 5, 0, 0, 0)).toBeCloseTo(b.h + 5 * Math.tan(a));      // down the far one
    const m = (b.a + b.b) / 2; expect(M.groundAt(W, m, 0, W.tr.xs[m], W.tr.zs[m])).toBeLessThan(b.h - 5);   // between the tips: the drop
  });
  it('rising as the pack arrives at speed: they jump it and land; arriving when it is up: they wait at the gate. Nobody falls in', () => {
    for (const [phase, want] of [[4, 'jump'], [15, 'wait']]) {
      const { tr, W, R } = race(phase), d = tr.drawbridges[0], N0 = tr.loopN; let jumped = 0, waited = 0, t = 0;
      while (t < 45) {
        M.raceStep(R, 1 / 120, W); t += 1 / 120;
        for (const c of R.cars) {
          const u = c.pr.s % N0 - d.a;
          if (u > 0 && u < d.b - d.a && !c.onGround && W.draws[0].ang > 0.1) jumped++;
          if (u > -8 && u < 0 && Math.hypot(c.vx, c.vz) < 1 && W.draws[0].ang > M.DRAW.AJUMP) waited++;
          c.events.length = 0;
        }
      }
      expect(want === 'jump' ? jumped : waited).toBeGreaterThan(0);
      expect(R.cars.reduce((n, c) => n + c.respawns, 0)).toBe(0);
    }
  });
});

describe('mud and whoops', () => {
  const st = SANDBOXES.rally, tr = M.buildTrack(st);
  it('whoops are bumps on the road; bogs and splashes are slower corners for the AI', () => {
    const w = tr.whoops[0]; let lo = Infinity, hi = -Infinity; for (let q = 0; q < 44; q++) { lo = Math.min(lo, tr.H[w.i + q]); hi = Math.max(hi, tr.H[w.i + q]); }
    expect(hi - lo).toBeGreaterThan(0.7);
    const y = tr.yumps[0]; expect(tr.jump[y.i + 5]).toBe(2); expect(tr.H[y.i + 17] - tr.H[y.i]).toBeGreaterThan(2.5);   // a natural crest: unpainted, and a real rise
    const mudI = [...tr.mud].findIndex(v => v === 1), wetI = [...tr.mud].findIndex(v => v === 2);
    expect(tr.vmax[mudI + 5]).toBeLessThanOrEqual(70 * 0.8 + 1e-3); expect(tr.vmax[wetI + 5]).toBeLessThanOrEqual(70 * 0.66 + 1e-3);   // straight road: 70 dry
  });
  it('a car in the bog is on mud, in the splash on the ford, and loses speed there', () => {
    seedRandom(2); const W = { tr, terr: M.buildTerrain(tr, st), surf: st.surface, armco: true };
    const R = M.createRace(W, [{ name: 'p', player: true }]); R.phase = 'racing'; R.hzT = 1e9; const P = R.player, seen = new Set();
    const i = [...tr.mud].findIndex(v => v === 1) + 1; P.x = tr.xs[i]; P.z = tr.zs[i]; P.y = tr.H[i]; P.yaw = tr.th[i]; P.pr = M.project(tr, P.x, P.z, i, 3, 3); P.vx = tr.tx[i] * 25; P.vz = tr.tz[i] * 25;
    let t = 0; while (t < 4) { P.inp.throttle = 1; P.inp.steer = 0; M.raceStep(R, 1 / 120, W); t += 1 / 120; seen.add(P.surface); }
    expect(seen.has('mud')).toBe(true); expect(seen.has('ford')).toBe(true);
    expect(M.SURF.ford.drag).toBeGreaterThan(M.SURF.gravel.drag);
  });
});

describe('snow and ice', () => {
  const st = SANDBOXES.snow, tr = M.buildTrack(st);
  it('ice patches are slower corners for the AI, braked for a little before', () => {
    const b = [...tr.ice].findIndex(v => v), i = tr.u0(b);
    expect(tr.vmax[i + 5]).toBeLessThanOrEqual(70 * M.ICE_SLOW + 1e-3);
    expect(tr.vmax[i - 5]).toBeLessThan(70);
  });
  it('a car on the road is on snow, on a patch on ice, where it has far less grip', () => {
    seedRandom(2); const W = { tr, terr: M.buildTerrain(tr, st), surf: st.surface, armco: true };
    const R = M.createRace(W, [{ name: 'p', player: true }]); R.phase = 'racing'; R.hzT = 1e9; const P = R.player, seen = new Set();
    const i = tr.u0([...tr.ice].findIndex(v => v)) - 20; P.x = tr.xs[i]; P.z = tr.zs[i]; P.y = tr.H[i]; P.yaw = tr.th[i]; P.pr = M.project(tr, P.x, P.z, i, 3, 3); P.vx = tr.tx[i] * 20; P.vz = tr.tz[i] * 20;
    let t = 0; while (t < 3) { P.inp.throttle = 1; P.inp.steer = 0; M.raceStep(R, 1 / 120, W); t += 1 / 120; seen.add(P.surface); }
    expect(seen.has('snow')).toBe(true); expect(seen.has('ice')).toBe(true);
    expect(M.SURF.ice.latMax).toBeLessThan(M.SURF.snow.latMax * 0.5);
  });
});

describe('dirt shortcuts and wrecking balls', () => {
  it('a dirt branch is a gravel surface, shorter than the road it cuts off, and the AI takes it sometimes', () => {
    const st = SANDBOXES.shortcut, tr = M.buildTrack(st), a = tr.alts[0];
    expect(a.n).toBeLessThan(a.M - a.F);                                                 // shorter than the S it cuts across
    const W = { tr, terr: M.buildTerrain(tr, st), surf: st.surface, armco: true };
    seedRandom(8); const R = M.createRace(W, DEFS); R.phase = 'racing'; R.autoPlayer = true; const surf = new Set(), took = new Set();
    for (let t = 0; t < 80; t += 1 / 120) { M.raceStep(R, 1 / 120, W); R.cars.forEach((c, k) => { if (c.pr.i >= tr.NM) { took.add(k); surf.add(c.surface); } }); }
    expect(took.size).toBeGreaterThan(0); expect(surf.has('gravel')).toBe(true);
    expect(R.cars.every(c => c.lap >= 2)).toBe(true);
  });
  it('a wrecking ball bats a car standing in its path sideways; the AI times its run and gets through', () => {
    const st = SANDBOXES.hammer, tr = M.buildTrack(st), W = { tr, terr: M.buildTerrain(tr, st), surf: st.surface, armco: true }, h = tr.hammers[0];
    const R = M.createRace(W, DEFS); R.phase = 'racing'; const P = R.player;
    let t = 0; while (Math.abs(M.hammerLat(h, t).lat) > 0.5) t += 0.01;                 // the ball crossing the middle
    R.time = t - 0.05; const i = h.i; P.x = tr.xs[i]; P.z = tr.zs[i]; P.y = tr.H[i]; P.yaw = tr.th[i]; P.vx = P.vz = 0; P.pr = M.project(tr, P.x, P.z, i, 3, 3); P.ghost = 0;
    for (let k = 0; k < 24; k++) M.raceStep(R, 1 / 120, W);
    expect(P.events.some(e => e.t === 'hammer-hit')).toBe(true); expect(Math.hypot(P.vx, P.vz)).toBeGreaterThan(5);
    seedRandom(8); const R2 = M.createRace(W, DEFS); R2.phase = 'racing'; R2.autoPlayer = true; let hits = 0;
    for (let s = 0; s < 70; s += 1 / 120) { M.raceStep(R2, 1 / 120, W); for (const c of R2.cars) { hits += c.events.filter(e => e.t === 'hammer-hit').length; c.events.length = 0; } }
    expect(R2.cars.every(c => c.lap >= 2)).toBe(true); expect(hits).toBeLessThanOrEqual(8);   // ~30 passes: most clean, the odd one batted
  });
});

describe('ruts: bogs churn up as the race goes on', () => {
  const st = SANDBOXES.rally, tr = M.buildTrack(st), W = { tr, terr: M.buildTerrain(tr, st), surf: st.surface, armco: true }, C = M.WEAR.COLS, [a, b] = M.mudRuns(tr)[0], len = b - a;
  const run = (groove, lat) => {
    const R = M.createRace(W, [{ name: 'p', player: true }]); R.phase = 'racing'; R.hzT = 1e9; const P = R.player, g = W.wear.g;
    if (groove) for (let u = 0; u < len; u++) for (const k of [11, 12, 13, 15, 16, 17]) g[(a + u) * C + k] = 1;   // a rut under each wheel of a centred car
    const i = a + 1; P.x = tr.xs[i] + tr.rx[i] * lat; P.z = tr.zs[i] + tr.rz[i] * lat; P.y = tr.H[i]; P.yaw = tr.th[i]; P.pr = M.project(tr, P.x, P.z, i, 3, 3); P.vx = tr.tx[i] * 12; P.vz = tr.tz[i] * 12;
    let t = 0; while ((P.pr.s % tr.loopN) < a + len && t < 10) { P.inp.throttle = 1; P.inp.steer = 0; M.raceStep(R, 1 / 120, W); t += 1 / 120; }
    return { t, lat: P.pr.lat, R };
  };
  it('the rutted line is quicker than fresh mud; beside it, the ruts tug you in and cost time', () => {
    const fresh = run(false, 0), line = run(true, 0), beside = run(true, 3);
    expect(line.t).toBeLessThan(fresh.t * 0.95);
    expect(beside.t).toBeGreaterThan(line.t);
    expect(beside.lat).toBeLessThan(2.8);                                          // pulled toward the groove
    expect(M.rutLane(W, line.R.player, 0)).toBeCloseTo(0, 0);                      // and the AI can see where it is
  });
  it('racing digs ruts along the line the cars take, and everyone still gets round', () => {
    seedRandom(4); const R = M.createRace(W, DEFS); R.phase = 'racing'; R.autoPlayer = true; R.hzT = 1e9; let t = 0;
    while (t < 90 && R.cars.some(c => !c.finished)) { M.raceStep(R, 1 / 120, W); t += 1 / 120; }
    const across = Array.from({ length: C }, (_, k) => { let s = 0; for (let u = 0; u < len; u++) s += W.wear.g[(a + u) * C + k]; return s / len; });
    expect(Math.max(...across)).toBeGreaterThan(0.5); expect(across[0] + across[C - 1]).toBeLessThan(0.2);   // a groove, not the whole width
    expect(R.cars.every(c => c.finished)).toBe(true); expect(R.cars.reduce((n, c) => n + c.respawns, 0)).toBe(0);
  });
});

describe('track wear on every surface', () => {
  it('gravel grooves along the line and grips a little better there; cars leaving a bog lay a mud trail; tarmac only looks worn', () => {
    const st = M.STAGES.find(x => x.name === 'Bogwood Rally'), tr = M.buildTrack(st), W = { tr, terr: M.buildTerrain(tr, st), surf: st.surface }, C = M.WEAR.COLS;
    seedRandom(6); const R = M.createRace(W, DEFS); R.phase = 'racing'; R.autoPlayer = true; R.hzT = 1e9;
    for (let t = 0; t < 24; t += 1 / 120) M.raceStep(R, 1 / 120, W);
    const [a, b] = M.mudRuns(tr)[0], sum = (arr, r0, r1) => { let s = 0; for (let r = r0; r < r1; r++) for (let k = 0; k < C; k++) s += arr[r * C + k]; return s; };
    expect(sum(W.wear.g, 60, 120)).toBeGreaterThan(1);                             // grooves on the gravel start straight
    const T = M.WEAR.TCOLS, wide = (arr, r0, r1) => { let s = 0; for (let r = r0; r < r1; r++) for (let k = 0; k < T; k++) s += arr[r * T + k]; return s; };
    expect(wide(W.wear.m, b + 2, b + 20)).toBeGreaterThan(wide(W.wear.m, 60, 120));   // a mud trail out of the bog
    expect(wide(W.wear.t, 60, 120)).toBeGreaterThan(5);                              // fresh tyre tracks on the dirt from the first lap
    expect(M.SURF.gravelSwept.grip).toBeGreaterThan(M.SURF.gravel.grip);
    const tt = M.buildTrack(M.STAGES[0]), Wt = { tr: tt, terr: M.buildTerrain(tt, M.STAGES[0]), surf: 'tarmac' }, Rt = M.createRace(Wt, DEFS); Rt.phase = 'racing'; Rt.autoPlayer = true;
    for (let t = 0; t < 5; t += 1 / 120) M.raceStep(Rt, 1 / 120, Wt);
    expect(Wt.wear.g.some(v => v > 0)).toBe(true); expect(Rt.cars.every(c => !(c.rut > 0))).toBe(true);   // worn to look at, same to drive on
    expect(Wt.wear.t.some(v => v > 0)).toBe(false);                               // tarmac: no dirt tracks (skid marks instead)
  });
});

describe('the garage', () => {
  it('the standard coupe is the line-up as it always was; picking a rival\'s car hands them the coupe', () => {
    const std = raceDefs(VEHICLES[0]); expect(std.map(d => d.model)).toEqual(CAR_DEFS.map(d => d.model));
    expect(std.find(d => d.player).veh).toBeUndefined();
    const h = raceDefs(VEHICLES.find(v => v.id === 'hatch')); expect(h.find(d => d.player).model).toBe('hatch'); expect(h.filter(d => d.model === 'hatch').length).toBe(1);
    expect(new Set(VEHICLES.map(v => v.id)).size).toBe(VEHICLES.length); expect(VEHICLES.length).toBe(19);
  });
  it('a full field: one of every vehicle, 19 cars on the grid, the player at the back; everyone gets round', () => {
    const defs = raceDefs(VEHICLES[0], MAX_RIVALS);
    expect(defs.length).toBe(19); expect(new Set(defs.map(d => d.model)).size).toBe(19); expect(defs.at(-1).player).toBe(true);
    expect(raceDefs(VEHICLES.find(v => v.id === 'kart'), MAX_RIVALS).filter(d => d.model === 'kart').length).toBe(1);   // whoever drove it takes a coupe
    expect(raceDefs(VEHICLES[0], 1).map(d => d.name)).toEqual(['Okafor', 'You']);
    for (const st of [M.STAGES[0], M.STAGES[10]]) {
      seedRandom(5); const tr = M.buildTrack(st), W = { tr, terr: M.buildTerrain(tr, st), surf: st.surface, armco: !!st.armco, traffic: st.traffic };
      const R = M.createRace(W, defs); R.phase = 'racing'; R.autoPlayer = true; R.hzT = 1e9;
      let t = 0; while (t < 400 && !R.cars.every(c => c.finished)) { M.raceStep(R, 1 / 120, W); t += 1 / 120; }
      const resp = R.cars.reduce((a, c) => a + c.respawns, 0);
      expect(R.cars.every(c => c.finished)).toBe(true); expect(resp).toBeLessThanOrEqual(Math.ceil(defs.length / 2));   // a pack this size crowds a few off at the tight corners (resets, not wrecks)
    }
  });
  it('every vehicle gets round a tarmac and a dirt stage alone, within 10% of the coupe, without respawning', () => {
    for (const st of [M.STAGES[7], M.STAGES[9]]) {
      const tr = M.buildTrack(st), W = { tr, terr: M.buildTerrain(tr, st), surf: st.surface, armco: !!st.armco }; let base = 0;
      for (const v of VEHICLES) {
        seedRandom(7); const R = M.createRace(W, [raceDefs(v).find(d => d.player)]); R.phase = 'racing'; R.autoPlayer = true; R.hzT = 1e9;
        const P = R.player, end = tr.startIdx + tr.loopN; let t = 0;
        while (t < 120 && P.progress < end) { M.raceStep(R, 1 / 120, W); t += 1 / 120; }
        if (!base) base = t;
        expect(Math.abs(t / base - 1), `${v.id} on ${st.name}`).toBeLessThan(0.1); expect(P.respawns, v.id).toBe(0);
      }
    }
  });
});

describe('getting back into the race', () => {
  const setup = si => {
    const st = M.STAGES[si], tr = M.buildTrack(st), W = { tr, terr: M.buildTerrain(tr, st), surf: st.surface, armco: !!st.armco };
    seedRandom(7); const R = M.createRace(W, raceDefs(VEHICLES[0], 7)); R.phase = 'racing'; R.autoPlayer = true; R.hzT = 1e9;
    for (let k = 0; k < 120 * 25; k++) M.raceStep(R, 1 / 120, W);
    return { tr, W, R, P: R.player };
  };
  it('a car outside the tyre wall drives straight back on: the barrier gives way to a push from outside', () => {
    for (const si of [0, 4, 7, 11]) {
      const { tr, W, R, P } = setup(si);
      let wi = -1; for (let i = P.pr.i + 20; i < P.pr.i + 400; i++) if (tr.wallR[i] === 1 || tr.wallL[i] === 1) { wi = i; break; }
      expect(wi, M.STAGES[si].name).toBeGreaterThan(0);
      const side = tr.wallR[wi] === 1 ? 1 : -1, lat = side * (M.WALL + 2.6), a = 0.9;                      // parked 2.6 m outside, nose 50 degrees back to the road
      const fx = tr.tx[wi] * Math.cos(a) - side * tr.rx[wi] * Math.sin(a), fz = tr.tz[wi] * Math.cos(a) - side * tr.rz[wi] * Math.sin(a);
      R.autoPlayer = false; P.x = tr.xs[wi] + tr.rx[wi] * lat; P.z = tr.zs[wi] + tr.rz[wi] * lat; P.yaw = Math.atan2(fx, fz); P.vx = P.vz = 0; P.lastGood = wi; P.pr = M.project(tr, P.x, P.z, wi, 4, 4);
      let t = 0, back = false; const r0 = P.respawns;
      while (t < 3 && !back) { P.inp.throttle = 1; P.inp.steer = 0; P.inp.brake = 0; M.raceStep(R, 1 / 120, W); t += 1 / 120; back = Math.abs(P.pr.lat) < M.HALF; }
      expect(back, M.STAGES[si].name).toBe(true); expect(P.respawns).toBe(r0);
    }
  });
  it('the player respawns rolling, by the nearest pack, and never further on than they had got', () => {
    for (const si of [4, 11]) {
      const { tr, W, P } = setup(si);
      const at = P.progress; M.respawn(P, W);
      const q = M.project(tr, P.x, P.z, P.lastGood, 4, 4), p = tr.progOf(q.s);
      expect(Math.hypot(P.vx, P.vz)).toBeGreaterThanOrEqual(M.PACK.VMIN);                           // a rolling start
      expect(p).toBeLessThanOrEqual(at + 1);
      let last = p; P.progress = p;
      for (let k = 0; k < 4; k++) { M.respawn(P, W); const r = M.project(tr, P.x, P.z, P.lastGood, 4, 4); P.progress = tr.progOf(r.s); expect(P.progress).toBeLessThanOrEqual(last + 1); last = P.progress; }   // pressing R again gains nothing
    }
  });
});
