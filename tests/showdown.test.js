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
  const log = { rounds: [], regroups: [], lightsOk: true, ev: {} };
  let t = 0;
  while (t < 600 && R.sd.phase !== 'over') {
    M.raceStep(R, 1 / 120, W); t += 1 / 120;
    if (R.sd.lights.reduce((a, b) => a + b, 0) !== 4 * R.cars.length) log.lightsOk = false;
    for (const c of R.cars.concat(R.traffic, R.parked)) {
      for (const e of c.events) {
        log.ev[e.t] = (log.ev[e.t] || 0) + 1;
        if (e.t === 'sd-round') log.rounds.push({ winner: e.winner, losers: e.losers.slice(), lights: R.sd.lights.slice() });
        if (e.t === 'sd-hold') {
          const L = M.sdLeader(R), act = R.cars.filter(k => !k.out);
          log.regroups.push({ spread: Math.max(...act.map(k => Math.abs(k.pr.i - L.pr.i))), held: act.every(k => k.hold > 1.4), still: act.every(k => Math.hypot(k.vx, k.vz) < 0.01) });
        }
      }
      c.events.length = 0;
    }
  }
  return { R, W, log, t };
}

describe('showdown matches', () => {
  for (const si of [0, 6]) {
    it(`stage ${si + 1}: rounds are scored, lights conserved, regroups tight, winner decided`, () => {
      const { R, log, t } = match(si);
      expect(log.rounds.length).toBeGreaterThan(0);
      expect(log.lightsOk).toBe(true);
      for (const r of log.rounds) { expect(r.losers).not.toContain(r.winner); }
      expect(log.regroups.length).toBeGreaterThan(0);
      for (const g of log.regroups) { expect(g.spread).toBeLessThanOrEqual(12); expect(g.held).toBe(true); expect(g.still).toBe(true); }
      expect(R.sd.phase).toBe('over');
      expect(R.sd.winner).toBeGreaterThanOrEqual(0);
      R.cars.forEach((c, k) => { if (R.sd.lights[k] <= 0) { expect(c.out).toBe(true); expect(c.ghost).toBe(Infinity); } });
      console.log(`stage ${si + 1}: ${log.rounds.length} rounds in ${t.toFixed(0)}s, final lights ${R.sd.lights.join('/')}, winner ${R.cars[R.sd.winner].name}`);
    });
  }
  it('a car pushed off the screen loses exactly one light to the leader', () => {
    seedRandom(1);
    const st = M.STAGES[0], tr = M.buildTrack(st), terr = M.buildTerrain(tr, st), W = { tr, terr, surf: st.surface, armco: false };
    const R = M.createRace(W, DEFS, { mode: 'showdown' }); R.phase = 'racing'; R.autoPlayer = true;
    for (let n = 0; n < 240; n++) M.raceStep(R, 1 / 120, W);              // past the start grace
    const L = M.sdLeader(R), victim = R.cars.find(c => c !== L), vi = R.cars.indexOf(victim), li = R.cars.indexOf(L);
    const before = R.sd.lights.slice(), i = Math.max(4, victim.pr.i - 150);
    victim.x = tr.xs[i]; victim.z = tr.zs[i]; victim.y = tr.H[i]; victim.pr = M.project(tr, victim.x, victim.z, i, 3, 3); victim.progress = i; victim.vx = victim.vz = 0;
    for (let n = 0; n < 60 && R.sd.phase === 'run'; n++) M.raceStep(R, 1 / 120, W);
    expect(R.sd.lights[vi]).toBe(before[vi] - 1);
    expect(R.sd.lights[li]).toBe(before[li] + 1);
    expect(R.sd.phase).toBe('announce');
  });
});
