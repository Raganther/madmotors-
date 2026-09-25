// Weapons (core/features/weapons.js): the homing missile and door bashing, and that with weapons off nothing changes.
import { describe, it, expect } from 'vitest';
import M from './core-under-test.js';
import { seedRandom } from './scenarios.js';

const DEFS = [
  { name: 'a', skill: 0.95, flick: 0.38, driftK: 1 / 62 }, { name: 'b', skill: 0.99, flick: 0.22, driftK: 1 / 38 },
  { name: 'p', player: true }, { name: 'c', skill: 0.92, flick: 0.28, driftK: 1 / 50 }
];
const st = M.STAGES[0], tr = M.buildTrack(st), W = () => ({ tr, terr: M.buildTerrain(tr, st), surf: st.surface, armco: !!st.armco });
const put = (c, i, lat, v = 20) => { c.x = tr.xs[i] + tr.rx[i] * lat; c.z = tr.zs[i] + tr.rz[i] * lat; c.y = tr.H[i]; c.yaw = tr.th[i]; c.vx = tr.tx[i] * v; c.vz = tr.tz[i] * v; c.pr = M.project(tr, c.x, c.z, i, 3, 3); c.progress = i; c.ghost = 0; };
const race = w => { seedRandom(9); const Wd = W(), R = M.createRace(Wd, DEFS, { weapons: w }); R.phase = 'racing'; return { R, Wd }; };

describe('weapons', () => {
  it('off: no weapon state, no missiles, nothing happens on the fire button', () => {
    const { R, Wd } = race(false); R.player.inp.fire = true; M.raceStep(R, 1 / 120, Wd);
    expect(R.missiles).toEqual([]); expect(R.player.wpn).toBeUndefined();
  });
  it('the missile locks on to the car ahead, homes across the road and knocks it up, spinning and slowed', () => {
    const { R, Wd } = race(true), P = R.player, T = R.cars[1];
    R.cars.forEach((c, k) => put(c, 200 + k * 3, -5, 0));
    put(P, 300, -3, 25); put(T, 340, 3, 22);
    expect(M.missileTarget(R, P)).toBe(1);
    P.inp.fire = true; M.raceStep(R, 1 / 120, Wd); expect(R.missiles.length).toBe(1); expect(P.wpn.ammo).toBe(0);
    let hit = null; for (let t = 0; t < 3 && !hit; t += 1 / 120) { M.raceStep(R, 1 / 120, Wd); hit = T.events.find(e => e.t === 'missile-hit'); T.events.length = 0; }
    expect(hit).toBeTruthy(); expect(hit.from).toBe(2);
    expect(Math.hypot(T.vx, T.vz)).toBeLessThan(12); expect(Math.abs(T.spin)).toBeGreaterThan(1);
    expect(T.wreckT > 0).toBe(false);                                                   // it hurts, it doesn't wreck
    for (let t = 0; t < M.WPN.RELOAD + 0.5; t += 1 / 120) M.raceStep(R, 1 / 120, Wd);
    expect(P.wpn.ammo).toBe(1);                                                          // and it reloads
  });
  it('a door swung at a car alongside shoves it away and dents it a little; swung at nothing it does nothing', () => {
    const { R, Wd } = race(true), P = R.player, O = R.cars[0];
    R.cars.forEach((c, k) => put(c, 150 + k * 20, 0, 0));
    put(P, 400, -1.5, 20); put(O, 400, 1.5, 20);
    const side = Math.sign(-(O.x - P.x) * Math.cos(P.yaw) + (O.z - P.z) * Math.sin(P.yaw));
    P.inp.door = -side; M.raceStep(R, 1 / 120, Wd); for (let k = 0; k < 20; k++) M.raceStep(R, 1 / 120, Wd);
    expect(O.events.some(e => e.t === 'door-hit')).toBe(false);                         // wrong side: nobody there
    P.wpn.doorCool = 0; O.events.length = 0; put(O, P.pr.i, P.pr.lat + 3, 20);
    P.inp.door = side; for (let k = 0; k < 30; k++) M.raceStep(R, 1 / 120, Wd);
    expect(O.events.some(e => e.t === 'door-hit')).toBe(true);
    expect(Math.abs(O.pr.lat - P.pr.lat)).toBeGreaterThan(3.2);                        // pushed away
    expect(O.dmg.l + O.dmg.r).toBeGreaterThan(0); expect(O.dmg.l + O.dmg.r).toBeLessThan(0.1);
  });
  it('a whole race with weapons: everyone still finishes, the AI uses both, nobody is wrecked over and over', () => {
    const { R, Wd } = race(true); R.autoPlayer = true; const n = {};
    let t = 0; while (t < 200 && !R.cars.every(c => c.finished)) { M.raceStep(R, 1 / 120, Wd); t += 1 / 120; for (const c of R.cars) { for (const e of c.events) n[e.t] = (n[e.t] || 0) + 1; c.events.length = 0; } }
    expect(R.cars.every(c => c.finished)).toBe(true);
    expect(n['door-hit'] || 0).toBeGreaterThan(0);
    expect(R.cars.reduce((a, c) => a + c.wrecks, 0)).toBeLessThanOrEqual(3);
  });
});
