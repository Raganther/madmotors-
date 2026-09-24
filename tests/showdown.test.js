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

const offFar = (R, c) => { const e = M.sdExtents(SD.ZMAX, R.aspect), [sx, sy] = M.screenOffset(c.x, c.y, c.z, R.sd.focus); return Math.abs(sx) > e.hw || Math.abs(sy) > e.hh; };
const inFar = (R, c) => { const e = M.sdExtents(SD.ZMAX, R.aspect), [sx, sy] = M.screenOffset(c.x, c.y, c.z, R.sd.focus); return Math.abs(sx) < e.hw && Math.abs(sy) < e.hh; };

function world(si) {
  const st = M.STAGES[si], tr = M.buildTrack(st), terr = M.buildTerrain(tr, st);
  return { tr, terr, surf: st.surface, armco: !!st.armco, traffic: st.traffic };
}
function match(si, aspect) {
  seedRandom(3 + si);
  const W = world(si), R = M.createRace(W, DEFS, { mode: 'showdown' }); R.aspect = aspect; R.phase = 'racing'; R.autoPlayer = true;
  const log = { rounds: [], booms: 0, boomsFar: true, regroups: [], rejoins: [], lightsOk: true, zoomOk: true, minT: 0 };
  let t = 0;
  while (t < 600 && R.sd.phase !== 'over') {
    const wasAnnounce = R.sd.phase === 'announce', boomed = R.sd.boomT.map(b => b > 0);
    M.raceStep(R, 1 / 120, W); t += 1 / 120;
    if (R.sd.lights.some(l => l < 0)) log.lightsOk = false;
    if (R.sd.scale < SD.ZMIN - 1e-6 || R.sd.scale > SD.ZMAX + 1e-6) log.zoomOk = false;
    if (R.sd.scale < SD.ZMIN + 3) log.minT += 1 / 120;
    if (wasAnnounce && R.sd.phase === 'run') {
      const L = M.sdLeader(R);
      log.regroups.push({ spread: Math.max(...R.cars.map(k => Math.abs(k.pr.i - L.pr.i))), rolling: R.cars.every(k => Math.abs(Math.hypot(k.vx, k.vz) - SD.ROLL) < 1.5) });
    }
    R.cars.forEach((c, k) => { if (boomed[k] && !(R.sd.boomT[k] > 0) && R.sd.phase === 'run') log.rejoins.push({ ghost: c.ghost > 1, wreck: c.wreckT, inView: inFar(R, c) }); });
    for (const c of R.cars.concat(R.traffic, R.parked)) {
      for (const e of c.events) if (e.t === 'sd-round') {
        log.rounds.push({ winner: e.winner, losers: e.losers.slice() });
        if (e.boom) { log.booms++; for (const k of e.losers) if (!offFar(R, R.cars[k])) log.boomsFar = false; }
      }
      c.events.length = 0;
    }
  }
  return { R, log, t };
}

describe('showdown matches', () => {
  for (const [si, aspect] of [[0, 16 / 9], [6, 0.5]]) {
    it(`stage ${si + 1} (aspect ${aspect.toFixed(2)}): zoom-to-fit, booms only at full zoom, nobody out, winner decided`, () => {
      const { R, log, t } = match(si, aspect);
      expect(log.rounds.length).toBeGreaterThan(0);
      expect(log.booms).toBeGreaterThan(0);
      expect(log.boomsFar).toBe(true);
      expect(log.lightsOk).toBe(true);
      expect(log.zoomOk).toBe(true);
      for (const r of log.rounds) expect(r.losers).not.toContain(r.winner);
      for (const g of log.regroups) { expect(g.spread).toBeLessThanOrEqual(12); expect(g.rolling).toBe(true); }
      for (const r of log.rejoins) { expect(r.ghost).toBe(true); expect(r.wreck).toBe(0); expect(r.inView).toBe(true); }
      expect(R.sd.phase).toBe('over');
      expect(R.sd.winner).toBeGreaterThanOrEqual(0);
      expect(R.cars.every(c => !c.out)).toBe(true);
      console.log(`stage ${si + 1}: ${log.booms} booms, ${log.regroups.length} breakaways in ${t.toFixed(0)}s, close zoom ${(100 * log.minT / t).toFixed(0)}% of the time, spawns ${R.sd.spawns.join(',')}, final lights ${R.sd.lights.join('/')}, winner ${R.cars[R.sd.winner].name}`);
    });
  }

  const setup = () => {
    seedRandom(1);
    const W = world(0), tr = W.tr, R = M.createRace(W, DEFS, { mode: 'showdown' }); R.phase = 'racing'; R.autoPlayer = true;
    for (let n = 0; n < 240; n++) M.raceStep(R, 1 / 120, W);              // past the start grace
    const drop = c => { const i = Math.max(4, c.pr.i - 150); c.x = tr.xs[i]; c.z = tr.zs[i]; c.y = tr.H[i]; c.pr = M.project(tr, c.x, c.z, i, 3, 3); c.progress = i; c.vx = c.vz = 0; c.ghost = 0; };
    return { R, W, drop };
  };
  const stepUntil = (R, W, done, n = 400) => { for (let k = 0; k < n && !done(); k++) M.raceStep(R, 1 / 120, W); };

  it('a straggler: the camera zooms all the way out first, then it blows up, loses a light and rejoins near the leader', () => {
    const { R, W, drop } = setup();
    const L = M.sdLeader(R), victim = R.cars.find(c => c !== L), vi = R.cars.indexOf(victim), li = R.cars.indexOf(L);
    const before = R.sd.lights.slice();
    drop(victim);
    let maxScale = 0;
    stepUntil(R, W, () => { maxScale = Math.max(maxScale, R.sd.scale); return R.sd.boomT[vi] > 0; });
    expect(maxScale).toBeGreaterThan(SD.ZMAX - 0.5);
    expect(R.sd.lights[vi]).toBe(before[vi] - 1);
    expect(R.sd.lights[li]).toBe(before[li] + 1);
    expect(R.sd.phase).toBe('run');
    expect(victim.wreckT).toBeGreaterThan(0);
    stepUntil(R, W, () => !(R.sd.boomT[vi] > 0));
    expect(victim.wreckT).toBe(0);
    expect(victim.ghost).toBeGreaterThan(1);
    expect(Math.abs(M.sdLeader(R).pr.i - victim.pr.i)).toBeLessThanOrEqual(20);
    expect(Math.hypot(victim.vx, victim.vz)).toBeGreaterThan(10);
    expect(R.sd.scale).toBeLessThan(SD.ZMAX);                            // zoom comes back in once the pack is together again
  });

  it('respawns land behind, beside and in front of the leader, all in shot', () => {
    const { R, W, drop } = setup();
    for (let n = 0; n < 14 && R.sd.phase !== 'over'; n++) {
      const L = M.sdLeader(R), victim = R.cars.find(c => c !== L && !c.isPlayer), vi = R.cars.indexOf(victim);
      R.sd.lights.fill(4);
      drop(victim);
      stepUntil(R, W, () => R.sd.boomT[vi] > 0 || R.sd.phase !== 'run');
      stepUntil(R, W, () => !(R.sd.boomT[vi] > 0));
      if (R.sd.phase === 'run') expect(inFar(R, victim)).toBe(true);
      stepUntil(R, W, () => victim.ghost <= 0, 300);
    }
    for (const slot of ['behind', 'beside', 'front']) expect(R.sd.spawns).toContain(slot);
  });

  it('a car on no lights keeps racing (nobody is knocked out)', () => {
    const { R, W, drop } = setup();
    const L = M.sdLeader(R), victim = R.cars.find(c => c !== L), vi = R.cars.indexOf(victim);
    R.sd.lights[vi] = 0;
    drop(victim);
    stepUntil(R, W, () => R.sd.boomT[vi] > 0);
    expect(R.sd.lights[vi]).toBe(0);
    stepUntil(R, W, () => !(R.sd.boomT[vi] > 0));
    expect(victim.out).toBeFalsy();
    const p0 = victim.progress; stepUntil(R, W, () => false, 240);
    expect(victim.progress).toBeGreaterThan(p0 + 20);
  });

  it('a breakaway (everyone else dropped) scores each chaser and regroups with a rolling start', () => {
    const { R, W, drop } = setup();
    const L = M.sdLeader(R), li = R.cars.indexOf(L), before = R.sd.lights.slice();
    for (const c of R.cars) if (c !== L) drop(c);
    stepUntil(R, W, () => R.sd.phase !== 'run');
    expect(R.sd.phase).toBe('announce');
    expect(R.sd.lights[li]).toBe(before[li] + 3);
    stepUntil(R, W, () => R.sd.phase !== 'announce');
    expect(R.sd.phase).toBe('run');
    const lead = M.sdLeader(R);
    for (const c of R.cars) { expect(Math.abs(c.pr.i - lead.pr.i)).toBeLessThanOrEqual(12); expect(Math.hypot(c.vx, c.vz)).toBeGreaterThan(10); }
  });
});
