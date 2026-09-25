// Showdown mode: screen maths agree with the real camera, and the zoom/explosion/lights rules hold over whole matches.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import M from './core-under-test.js';
import { seedRandom } from './scenarios.js';

const DEFS = [
  { name: 'a', skill: 0.95, flick: 0.38, driftK: 1 / 62 }, { name: 'b', skill: 0.99, flick: 0.22, driftK: 1 / 38 },
  { name: 'p', player: true }, { name: 'c', skill: 0.92, flick: 0.28, driftK: 1 / 50 }
];
const SD = M.SD;

it('screenOffset matches the three.js orthographic camera', () => {
  const f = { x: 12, y: -30, z: 400 }, hw = 41, hh = 23;
  const cam = new THREE.OrthographicCamera(-hw, hw, hh, -hh, 1, 900);
  const d = new THREE.Vector3(...M.CAM_DIR);
  cam.position.set(f.x, f.y, f.z).addScaledVector(d, 300); cam.lookAt(f.x, f.y, f.z); cam.updateMatrixWorld();
  for (const p of [[20, -28, 390], [-5, -20, 430], [60, -45, 350], [12, -30, 400]]) {
    const v = new THREE.Vector3(...p).project(cam), [sx, sy] = M.screenOffset(...p, f);
    expect(sx).toBeCloseTo(v.x * hw, 6); expect(sy).toBeCloseTo(v.y * hh, 6);
  }
});
it('groundDir is the ground heading that shows on screen along a given direction (touch point-to-steer)', () => {
  for (const [ax, ay] of [[1, 0], [0, 1], [-1, 1], [0.3, -0.8]]) {
    const [gx, gz] = M.groundDir(ax, ay), [sx, sy] = M.screenOffset(gx, 0, gz, { x: 0, y: 0, z: 0 });
    expect(Math.hypot(gx, gz)).toBeCloseTo(1, 9);
    expect((sx * ax + sy * ay) / (Math.hypot(sx, sy) * Math.hypot(ax, ay))).toBeCloseTo(1, 9);
  }
});

const offFar = (R, c) => { const e = M.sdExtents(SD.ZMAX, R.aspect), [sx, sy] = M.screenOffset(c.x, c.y, c.z, R.sd.focus); return Math.abs(sx) > e.hw || Math.abs(sy) > e.hh; };
const inFar = (R, c) => { const e = M.sdExtents(SD.ZMAX, R.aspect), [sx, sy] = M.screenOffset(c.x, c.y, c.z, R.sd.focus); return Math.abs(sx) < e.hw && Math.abs(sy) < e.hh; };

function world(si) {
  const st = M.STAGES[si], tr = M.buildTrack(st), terr = M.buildTerrain(tr, st);
  return { tr, terr, surf: st.surface, armco: !!st.armco, traffic: st.traffic };
}
function match(si, aspect) {
  seedRandom(3 + si);
  const W = world(si), R = M.createRace(W, DEFS, { mode: 'showdown' }); R.aspect = aspect; R.phase = 'racing'; R.autoPlayer = true;
  const log = { spawnEv: [], crowns: [], booms: [], boomLosers: 0, boomsFar: true, rejoins: [], crownOk: true, zoomOk: true, holderOk: true, minT: 0 };
  let t = 0, total0 = 0;
  while (t < 900 && R.sd.phase !== 'over') {
    const boomed = R.sd.boomT.map(b => b > 0), h0 = R.sd.holder;
    M.raceStep(R, 1 / 120, W); t += 1 / 120;
    // crown time only grows (booms move it between cars): at most dt x2 per step in total
    const total = R.sd.crown.reduce((a, b) => a + b, 0);
    if (R.sd.crown.some(v => v < 0) || total - total0 > 2 / 120 + 1e-9) log.crownOk = false; total0 = total;
    if (R.sd.scale < SD.ZMIN - 1e-6 || R.sd.scale > SD.ZMAX + 1e-6) log.zoomOk = false;
    if (R.sd.scale < SD.ZMIN + 3) log.minT += 1 / 120;
    if (R.sd.holder !== h0 && h0 >= 0 && !(R.sd.boomT[h0] > 0) && R.sd.phase !== 'over') {
      // a steal: the new holder is clearly ahead of the old one
      if (R.cars[R.sd.holder].progress - R.cars[h0].progress <= SD.STEAL_EDGE) log.holderOk = false;
    }
    R.cars.forEach((c, k) => { if (boomed[k] && !(R.sd.boomT[k] > 0)) log.rejoins.push({ ghost: c.ghost > 1, wreck: c.wreckT, inView: inFar(R, c), behind: c.progress <= M.sdLeader(R).progress }); });
    for (const c of R.cars.concat(R.traffic, R.parked)) {
      for (const e of c.events) if (e.t === 'sd-spawn') log.spawnEv.push(e.slot); else if (e.t === 'sd-crown') log.crowns.push(e); else if (e.t === 'sd-boom') {
        log.booms.push(e); log.boomLosers += e.losers.length; for (const k of e.losers) if (!offFar(R, R.cars[k])) log.boomsFar = false;
      }
      c.events.length = 0;
    }
  }
  return { R, log, t };
}

describe('showdown matches (King of the Hill)', () => {
  for (const [si, aspect] of [[0, 16 / 9], [6, 0.5], [7, 16 / 9]]) {
    it(`stage ${si + 1} (aspect ${aspect.toFixed(2)}): crown changes hands on clear passes, booms at full zoom, winner decided`, () => {
      const { R, log, t } = match(si, aspect);
      expect(log.crowns.length).toBeGreaterThan(0);                      // the first crowning (steals are forced in a test below)
      expect(log.crowns[0].from).toBe(-1);
      expect(log.boomsFar).toBe(true);
      expect(log.crownOk).toBe(true);
      expect(log.zoomOk).toBe(true);
      expect(log.holderOk).toBe(true);
      for (const b of log.booms) expect(b.losers).not.toContain(b.to);
      for (const r of log.rejoins) { expect(r.ghost).toBe(true); expect(r.wreck).toBe(0); expect(r.inView).toBe(true); expect(r.behind).toBe(true); }
      expect(R.sd.phase).toBe('over');
      expect(R.sd.winner).toBeGreaterThanOrEqual(0);
      const w = R.sd.winner; expect(R.sd.crown[w]).toBe(Math.max(...R.sd.crown));
      expect(log.spawnEv).toEqual(R.sd.spawns);                                  // one sd-spawn event per rejoin
      expect(R.sd.spawns.every(s => s === 'behind' || s === 'beside')).toBe(true);
      expect(R.sd.booms.reduce((a, b) => a + b, 0)).toBe(log.boomLosers);
      console.log(`stage ${si + 1}: ${log.crowns.length - 1} steals, ${log.booms.length} booms in ${t.toFixed(0)}s, close zoom ${(100 * log.minT / t).toFixed(0)}% of the time, crown ${R.sd.crown.map(v => v.toFixed(1)).join('/')}, winner ${R.cars[w].name}`);
    });
  }

  const setup = () => {
    seedRandom(1);
    const W = world(0), tr = W.tr, R = M.createRace(W, DEFS, { mode: 'showdown' }); R.phase = 'racing'; R.autoPlayer = true;
    for (let n = 0; n < 240; n++) M.raceStep(R, 1 / 120, W);              // past the start grace
    const drop = c => { const i = Math.max(4, c.pr.i - 150); c.x = tr.xs[i]; c.z = tr.zs[i]; c.y = tr.H[i]; c.pr = M.project(tr, c.x, c.z, i, 3, 3); c.progress = i; c.vx = c.vz = 0; c.ghost = 0; };
    const put = (c, i, lat = 0) => { c.x = tr.xs[i] + tr.rx[i] * lat; c.z = tr.zs[i] + tr.rz[i] * lat; c.y = tr.H[i]; c.pr = M.project(tr, c.x, c.z, i, 3, 3); c.progress = c.pr.s; };
    return { R, W, drop, put };
  };
  const stepUntil = (R, W, done, n = 400) => { for (let k = 0; k < n && !done(); k++) M.raceStep(R, 1 / 120, W); };

  it('the leader banks crown time at a flat rate (no streak bonus)', () => {
    const { R, W } = setup();
    const h = R.sd.holder; expect(h).toBeGreaterThanOrEqual(0);
    expect(M.sdMult(0)).toBe(1); expect(M.sdMult(12)).toBe(1);
    R.sd.streak = 12; const c0 = R.sd.crown[h];
    M.raceStep(R, 1 / 120, W);
    if (R.sd.holder === h) expect(R.sd.crown[h] - c0).toBeCloseTo(1 / 120, 6);
  });

  it('side by side the crown stays put; a clear pass steals it and resets the streak', () => {
    const { R, W, put } = setup();
    const h = R.sd.holder, H = R.cars[h], rival = R.cars.find((c, k) => k !== h), ri = R.cars.indexOf(rival);
    // freeze everyone so only our placement decides the order
    const hold = () => { for (const c of R.cars) { c.vx = c.vz = 0; c.inp.throttle = 0; } };
    const i = Math.round(H.pr.i) + 40;
    put(H, i, -2.5); put(rival, i + 1, 2.5); hold(); R.sd.streak = 7;
    for (let n = 0; n < 120; n++) { hold(); M.raceStep(R, 1 / 120, W); }
    expect(R.sd.holder).toBe(h);                                          // 1 m ahead is not a pass
    put(rival, i + 8, 2.5); hold(); M.raceStep(R, 1 / 120, W);
    expect(R.sd.holder).toBe(ri);                                          // 8 m ahead is
    expect(R.sd.streak).toBeLessThan(0.05);
    expect(R.sd.steals[ri]).toBeGreaterThan(0);
  });

  it('a straggler: full zoom first, then it blows up, pays the holder crown time and rejoins behind or beside the leader', () => {
    const { R, W, drop } = setup();
    const hi = R.sd.holder, victim = R.cars.find((c, k) => k !== hi), vi = R.cars.indexOf(victim);
    R.sd.crown[vi] = 10; const before = R.sd.crown.slice();
    drop(victim);
    let maxScale = 0;
    stepUntil(R, W, () => { maxScale = Math.max(maxScale, R.sd.scale); return R.sd.boomT[vi] > 0; });
    expect(maxScale).toBeGreaterThan(SD.ZMAX - 0.5);
    expect(R.sd.crown[vi]).toBeCloseTo(before[vi] - SD.BOOM_TAKE, 6);
    const to = R.sd.holder; expect(R.sd.crown[to]).toBeGreaterThanOrEqual(before[to] + SD.BOOM_TAKE - 1e-9);
    expect(victim.wreckT).toBeGreaterThan(0);
    stepUntil(R, W, () => !(R.sd.boomT[vi] > 0));
    expect(victim.wreckT).toBe(0);
    expect(victim.ghost).toBeGreaterThan(1);
    const L = M.sdLeader(R); expect(L.pr.i - victim.pr.i).toBeGreaterThanOrEqual(0); expect(L.pr.i - victim.pr.i).toBeLessThanOrEqual(20);
    expect(Math.hypot(victim.vx, victim.vz)).toBeGreaterThan(10);
  });

  it('a car with no crown time just blows up (nothing below zero), and everyone left behind at once all blow up with no pause', () => {
    const { R, W, drop } = setup();
    const hi = R.sd.holder;
    R.cars.forEach((c, k) => { if (k !== hi) R.sd.crown[k] = 0; });
    for (const c of R.cars) if (c !== R.cars[hi]) drop(c);
    stepUntil(R, W, () => R.sd.boomT.filter(b => b > 0).length === R.cars.length - 1);
    expect(R.sd.boomT.filter(b => b > 0).length).toBe(R.cars.length - 1);
    expect(R.sd.phase).toBe('run');
    expect(R.sd.crown.every(v => v >= 0)).toBe(true);
    stepUntil(R, W, () => R.sd.boomT.every(b => !(b > 0)));
    const L = M.sdLeader(R);
    for (const c of R.cars) { expect(L.pr.i - c.pr.i).toBeGreaterThanOrEqual(0); expect(L.pr.i - c.pr.i).toBeLessThanOrEqual(20); }
  });

  it('first to the target wins', () => {
    const { R, W } = setup();
    const h = R.sd.holder; R.sd.crown[h] = SD.TARGET - 0.01;
    stepUntil(R, W, () => R.sd.phase === 'over', 10);
    expect(R.sd.phase).toBe('over');
    expect(R.sd.winner).toBe(R.sd.holder);
  });
});

describe('checkpoint modes (Deuce, Tiebreak)', () => {
  const st = M.STAGES[9], tr = M.buildTrack(st), W = { tr, terr: M.buildTerrain(tr, st), surf: st.surface, armco: true };
  it('win by two, like tennis: 3-3 is deuce, 4-3 advantage, 5-3 wins a Deuce; Tiebreak needs 7', () => {
    const S = { kind: 'deuce', points: [3, 3, 0, 1] };
    expect(M.cpState(S, 0)).toBe('deuce'); S.points[0] = 4; expect(M.cpState(S, 0)).toBe('advantage');
    S.points[0] = 5; expect(M.cpState(S, 0)).toBe('win'); S.points = [4, 1, 0, 0]; expect(M.cpState(S, 0)).toBe('win');
    const T = { kind: 'tiebreak', points: [5, 1, 0, 0] }; expect(M.cpState(T, 0)).toBe(''); T.points[0] = 7; expect(M.cpState(T, 0)).toBe('win');
    T.points = [7, 6, 0, 0]; expect(M.cpState(T, 0)).toBe('advantage');
  });
  it('the first car through the gate scores; passing beside it scores nothing', () => {
    seedRandom(3); const R = M.createRace(W, DEFS, { mode: 'deuce' }); R.phase = 'racing'; R.autoPlayer = true; R.aspect = 16 / 9; R.camDir = M.CAM_DIR;
    M.raceStep(R, 1 / 120, W); const G = R.sd.gate; expect(G.open).toBe(true); expect(Math.abs(G.lat)).toBe(M.CP.LAT);
    const put = (c, s, lat) => { const i = Math.round(s); c.x = tr.xs[i] + tr.rx[i] * lat; c.z = tr.zs[i] + tr.rz[i] * lat; c.pr = M.project(tr, c.x, c.z, i, 3, 3); c.progress = s; };
    R.cars.forEach((c, k) => { put(c, G.s - 3, 0); R.sd.prev[k] = c.progress; });
    put(R.cars[0], G.s + 1, -G.lat); M.raceStep(R, 1 / 120, W);                        // car 0: past it, wrong side
    expect(R.sd.points.every(p => p === 0)).toBe(true);
    put(R.cars[3], G.s + 1, G.lat); R.sd.prev[3] = G.s - 1; M.raceStep(R, 1 / 120, W);  // car 3: through it
    expect(R.sd.points).toEqual([0, 0, 0, 1]); expect(R.sd.gate.n).toBe(1); expect(R.sd.gate.s).toBeGreaterThan(G.s + 100);
  });
  it('a whole Deuce match ends with a winner two clear (or the road runs out), everyone scoring off the same gates', () => {
    for (const mode of ['deuce', 'tiebreak']) {
      seedRandom(4); const R = M.createRace(W, DEFS, { mode }); R.phase = 'racing'; R.autoPlayer = true; R.aspect = 16 / 9; R.camDir = M.CAM_DIR;
      let t = 0; while (t < 400 && R.sd.phase !== 'over') { M.raceStep(R, 1 / 120, W); t += 1 / 120; }
      expect(R.sd.phase).toBe('over'); const w = R.sd.winner, P = R.sd.points;
      expect(P[w]).toBe(Math.max(...P));
      if (M.cpState(R.sd, w) !== 'win') expect(R.cars[w].progress).toBeGreaterThanOrEqual(tr.finishIdx - 1);   // only the road running out ends it early
    }
  });
});
