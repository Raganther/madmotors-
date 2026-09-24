// Showdown mode: screen maths agree with the real camera, and the round/lights rules hold over whole matches.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import M from './core-under-test.js';
import { seedRandom } from './scenarios.js';

const DEFS = [
  { name: 'a', skill: 0.95, flick: 0.38, driftK: 1 / 62 }, { name: 'b', skill: 0.99, flick: 0.22, driftK: 1 / 38 },
  { name: 'p', player: true }, { name: 'c', skill: 0.92, flick: 0.28, driftK: 1 / 50 }
];

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

function match(si, view = { hw: 40, hh: 22 }) {
  seedRandom(3 + si);
  const st = M.STAGES[si], tr = M.buildTrack(st), terr = M.buildTerrain(tr, st), W = { tr, terr, surf: st.surface, armco: !!st.armco, traffic: st.traffic };
  const R = M.createRace(W, DEFS, { mode: 'showdown' }); R.view = view; R.phase = 'racing'; R.autoPlayer = true;
  const log = { rounds: [], regroups: [], booms: 0, rejoins: [], lightsOk: true, ev: {} };
  let t = 0;
  while (t < 600 && R.sd.phase !== 'over') {
    const wasAnnounce = R.sd.phase === 'announce', boomed = R.sd.boomT.map(b => b > 0);
    M.raceStep(R, 1 / 120, W); t += 1 / 120;
    const act = R.cars.filter(k => !k.out);
    if (wasAnnounce && R.sd.phase === 'run') {
      const L = M.sdLeader(R);
      log.regroups.push({ spread: Math.max(...act.map(k => Math.abs(k.pr.i - L.pr.i))), rolling: act.every(k => Math.abs(Math.hypot(k.vx, k.vz) - M.SD.ROLL) < 1.5) });
    }
    R.cars.forEach((c, k) => { if (boomed[k] && !(R.sd.boomT[k] > 0) && !c.out && R.sd.phase === 'run') log.rejoins.push({ ghost: c.ghost > 1, wreck: c.wreckT }); });
    if (R.sd.lights.reduce((a, b) => a + b, 0) !== 4 * R.cars.length) log.lightsOk = false;
    for (const c of R.cars.concat(R.traffic, R.parked)) {
      for (const e of c.events) {
        log.ev[e.t] = (log.ev[e.t] || 0) + 1;
        if (e.t === 'sd-round') { log.rounds.push({ winner: e.winner, losers: e.losers.slice(), lights: R.sd.lights.slice() }); if (e.boom) log.booms++; }
      }
      c.events.length = 0;
    }
  }
  return { R, W, log, t };
}

describe('showdown matches', () => {
  for (const si of [0, 6]) {
    it(`stage ${si + 1}: stragglers blow up, lights conserved, regroups roll, winner decided`, () => {
      const { R, log, t } = match(si);
      expect(log.rounds.length).toBeGreaterThan(0);
      expect(log.lightsOk).toBe(true);
      for (const r of log.rounds) { expect(r.losers).not.toContain(r.winner); }
      expect(log.booms).toBeGreaterThan(0);
      for (const g of log.regroups) { expect(g.spread).toBeLessThanOrEqual(12); expect(g.rolling).toBe(true); }
      for (const r of log.rejoins) { expect(r.ghost).toBe(true); expect(r.wreck).toBe(0); }
      expect(R.sd.phase).toBe('over');
      expect(R.sd.winner).toBeGreaterThanOrEqual(0);
      R.cars.forEach((c, k) => { if (R.sd.lights[k] <= 0) { expect(c.out).toBe(true); expect(c.ghost).toBe(Infinity); } });
      console.log(`stage ${si + 1}: ${log.booms} booms, ${log.regroups.length} breakaways, ${log.rounds.length} rounds in ${t.toFixed(0)}s, final lights ${R.sd.lights.join('/')}, winner ${R.cars[R.sd.winner].name}`);
    });
  }
  const setup = () => {
    seedRandom(1);
    const st = M.STAGES[0], tr = M.buildTrack(st), terr = M.buildTerrain(tr, st), W = { tr, terr, surf: st.surface, armco: false };
    const R = M.createRace(W, DEFS, { mode: 'showdown' }); R.phase = 'racing'; R.autoPlayer = true;
    for (let n = 0; n < 240; n++) M.raceStep(R, 1 / 120, W);              // past the start grace
    const drop = c => { const i = Math.max(4, c.pr.i - 150); c.x = tr.xs[i]; c.z = tr.zs[i]; c.y = tr.H[i]; c.pr = M.project(tr, c.x, c.z, i, 3, 3); c.progress = i; c.vx = c.vz = 0; c.ghost = 0; };
    return { R, W, drop };
  };
  it('a straggler left off the screen blows up, loses one light to the leader, and rejoins rolling behind the pack', () => {
    const { R, W, drop } = setup();
    const L = M.sdLeader(R), victim = R.cars.find(c => c !== L), vi = R.cars.indexOf(victim), li = R.cars.indexOf(L);
    const before = R.sd.lights.slice();
    drop(victim);
    for (let n = 0; n < 200 && !(R.sd.boomT[vi] > 0); n++) M.raceStep(R, 1 / 120, W);
    expect(R.sd.lights[vi]).toBe(before[vi] - 1);
    expect(R.sd.lights[li]).toBe(before[li] + 1);
    expect(R.sd.phase).toBe('run');
    expect(victim.wreckT).toBeGreaterThan(0);
    for (let n = 0; n < 200 && R.sd.boomT[vi] > 0; n++) M.raceStep(R, 1 / 120, W);
    expect(victim.wreckT).toBe(0);
    expect(victim.ghost).toBeGreaterThan(1);
    const [sx, sy] = M.screenOffset(victim.x, victim.y, victim.z, R.sd.focus);
    expect(Math.abs(sx)).toBeLessThan(R.view.hw); expect(Math.abs(sy)).toBeLessThan(R.view.hh);
    expect(Math.hypot(victim.vx, victim.vz)).toBeGreaterThan(10);
  });
  it('a breakaway (everyone else dropped) scores each chaser and regroups with a rolling start', () => {
    const { R, W, drop } = setup();
    const L = M.sdLeader(R), li = R.cars.indexOf(L), before = R.sd.lights.slice();
    for (const c of R.cars) if (c !== L) drop(c);
    for (let n = 0; n < 200 && R.sd.phase === 'run'; n++) M.raceStep(R, 1 / 120, W);
    expect(R.sd.phase).toBe('announce');
    expect(R.sd.lights[li]).toBe(before[li] + 3);
    for (let n = 0; n < 200 && R.sd.phase === 'announce'; n++) M.raceStep(R, 1 / 120, W);
    expect(R.sd.phase).toBe('run');
    const lead = M.sdLeader(R);
    for (const c of R.cars) { expect(Math.abs(c.pr.i - lead.pr.i)).toBeLessThanOrEqual(12); expect(Math.hypot(c.vx, c.vz)).toBeGreaterThan(10); }
  });
});
