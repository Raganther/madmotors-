// Off-piste (core/elements/open.js, features/gates.js, sim/nav.js): gates count only in order and only through the
// posts, a car can't gain anything by going round one, there's always a way from open country to the next gate, and
// the AI gets a field round Open Country taking every gate.
import { describe, it, expect } from 'vitest';
import M from './core-under-test.js';
import { seedRandom } from './scenarios.js';
import { navOf } from '../src/core/sim/nav.js';
import { GATE } from '../src/core/elements/open.js';

const st = M.STAGES.find(s => s.name === 'Open Country'), tr = M.buildTrack(st), terr = M.buildTerrain(tr, st);
const W = () => ({ tr, terr, surf: st.surface, armco: !!st.armco });
const at = (c, i, lat, v = 0) => { c.x = tr.xs[i] + tr.rx[i] * lat; c.z = tr.zs[i] + tr.rz[i] * lat; c.y = terr.at(c.x, c.z); c.yaw = tr.th[i]; c.vx = tr.tx[i] * v; c.vz = tr.tz[i] * v; c.pr = M.project(tr, c.x, c.z, i, 3, 3); c.progress = i; c.gAlong = undefined; };
describe('off-piste', () => {
  it('a gate counts only driven through between its posts, and going round it gains nothing', () => {
    seedRandom(3); const w = W(), R = M.createRace(w, [{ name: 'p', player: true }]); R.phase = 'racing';
    const c = R.player, g = tr.gates[0];
    at(c, g - 20, GATE.W / 2 + 6, 20);                                                       // outside the posts
    for (let k = 0; k < 360; k++) { c.inp.throttle = 1; M.raceStep(R, 1 / 120, w); }
    expect(c.gateK).toBe(0); expect(c.progress).toBeLessThan(g); expect(c.gateMiss).toBe(true);
    at(c, g - 20, 0, 20);                                                                    // back, and through it
    for (let k = 0; k < 240; k++) { c.inp.throttle = 1; M.raceStep(R, 1 / 120, w); }
    expect(c.gateK).toBe(1); expect(c.progress).toBeGreaterThan(g); expect(c.gateMiss).toBe(false);
  });
  it('from anywhere in open country there is a way to the next gate', () => {
    const nv = navOf(W()), N = tr.loopN, bad = [];
    for (let i = 0; i < N; i += 5) {
      if (!tr.open[tr.bi(i)]) continue;
      const w = nv.wps.get(nv.next[tr.bi(i)]);
      for (const o of [-30, 0, 30]) {
        const x = tr.xs[i] + tr.rx[i] * o, z = tr.zs[i] + tr.rz[i] * o, c = Math.round((x - nv.x0) / 2), r = Math.round((z - nv.z0) / 2);
        let best = Infinity; for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) best = Math.min(best, w.f[(r + a) * nv.cols + c + b]);   // next to a tree is fine
        if (!(best < 1e5)) bad.push(`sample ${i} lat ${o}`);
      }
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });
  it('the AI gets round Open Country taking every gate in order', () => {
    seedRandom(7); const w = W();
    const R = M.createRace(w, [{ name: 'a', skill: 0.95, flick: 0.3, driftK: 1 / 50 }, { name: 'b', skill: 0.9, flick: 0.2, driftK: 1 / 40 }, { name: 'c', skill: 0.85, flick: 0.3, driftK: 1 / 45 }, { name: 'p', player: true }]);
    R.phase = 'racing'; R.autoPlayer = true; const taken = R.cars.map(() => []);
    let t = 0; while (t < 300 && !R.cars.every(c => c.finished)) { M.raceStep(R, 1 / 120, w); R.cars.forEach((c, k) => { for (const e of c.events) if (e.t === 'gate') taken[k].push(e.n); c.events.length = 0; }); t += 1 / 120; }
    expect(R.cars.every(c => c.finished)).toBe(true);
    for (const g of taken) expect(g).toEqual(tr.gates.map((_, n) => n + 1));
    expect(R.cars.reduce((a, c) => a + c.respawns, 0)).toBeLessThanOrEqual(4);
  });
});
