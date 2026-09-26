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
  it('the missile locks on to the car ahead, homes across the road and knocks it up, spinning and slowed; then it is used up', () => {
    const { R, Wd } = race(true), P = R.player, T = R.cars[1];
    R.cars.forEach((c, k) => put(c, 200 + k * 3, -5, 0));
    put(P, 300, -3, 25); put(T, 340, 3, 22);
    expect(M.missileTarget(R, P)).toBe(1);
    P.wpn.item = 'missile'; P.wpn.uses = 1; P.inp.fire = true; M.raceStep(R, 1 / 120, Wd); expect(R.missiles.length).toBe(1); expect(P.wpn.item).toBe(null);
    let hit = null; for (let t = 0; t < 3 && !hit; t += 1 / 120) { M.raceStep(R, 1 / 120, Wd); hit = T.events.find(e => e.t === 'missile-hit'); T.events.length = 0; }
    expect(hit).toBeTruthy(); expect(hit.from).toBe(2);
    expect(Math.hypot(T.vx, T.vz)).toBeLessThan(12); expect(Math.abs(T.spin)).toBeGreaterThan(1);
    expect(T.wreckT > 0).toBe(false);                                                   // it hurts, it doesn't wreck
  });
  it('one door button: it swings on whichever side the car is, shoves it away and dents it a little', () => {
    for (const lat of [3, -3]) {
      const { R, Wd } = race(true), P = R.player, O = R.cars[0];
      R.cars.forEach((c, k) => put(c, 150 + k * 20, 0, 0));
      put(P, 400, 0, 20); put(O, 400, lat, 20);
      const side = Math.sign(-(O.x - P.x) * Math.cos(P.yaw) + (O.z - P.z) * Math.sin(P.yaw));
      expect(M.doorSide(R, P)).toBe(side);
      P.inp.door = 1; for (let k = 0; k < 30; k++) M.raceStep(R, 1 / 120, Wd);
      expect(P.wpn.doorSide).toBe(side); expect(O.events.some(e => e.t === 'door-hit')).toBe(true);
      expect(Math.abs(O.pr.lat - P.pr.lat)).toBeGreaterThan(3.2);                      // pushed away
      expect(O.dmg.l + O.dmg.r).toBeGreaterThan(0); expect(O.dmg.l + O.dmg.r).toBeLessThan(0.1);
    }
  });
  it('the other weapons: oil makes the car behind slide, the pulse blows neighbours away and stalls them, the harpoon reels you in, the gun chips speed', () => {
    const setup = (item, lats, gaps) => { const { R, Wd } = race(true), P = R.player; R.cars.forEach((c, k) => put(c, 150 + k * 20, 0, 0)); put(P, 400, 0, 22); R.cars.filter(c => c !== P).forEach((c, k) => put(c, 400 + gaps[k], lats[k], 22)); P.wpn.item = item; P.wpn.uses = M.ITEM_USES[item]; P.inp.fire = true; return { R, Wd, P }; };
    { const { R, Wd } = setup('oil', [0, 5, -5], [-14, -60, -60]); let slid = false; for (let k = 0; k < 240; k++) { M.raceStep(R, 1 / 120, Wd); if (R.cars[0].oilT > 0) slid = true; } expect(slid).toBe(true); }
    { const { R, Wd } = setup('pulse', [3.5, 0, -5], [0, 60, -70]); const O = R.cars[0], v0 = Math.hypot(O.vx, O.vz); M.raceStep(R, 1 / 120, Wd); expect(O.stallT).toBeGreaterThan(0); expect(Math.hypot(O.vx, O.vz)).not.toBeCloseTo(v0, 0); expect(R.cars[1].stallT || 0).toBe(0); }
    { const gap = hook => { const { R, Wd, P } = setup('harpoon', [0, 5, -5], [30, -60, -70]); R.autoPlayer = true; if (!hook) P.inp.fire = false; let towed = 0; for (let k = 0; k < 300; k++) { M.raceStep(R, 1 / 120, Wd); if (R.wpn.hooks.some(h => h.tow > 0)) towed++; } return { towed, gap: R.cars[0].progress - P.progress }; };
      const on = gap(true), off = gap(false); expect(on.towed).toBeGreaterThan(60); expect(on.gap).toBeLessThan(off.gap - 5); }
    { const { R, Wd } = setup('gun', [0, 6, -6], [25, -60, -70]); let hits = 0; for (let k = 0; k < 360; k++) { M.raceStep(R, 1 / 120, Wd); for (const c of R.cars) { hits += c.events.filter(e => e.t === 'bullet-hit').length; c.events.length = 0; } } expect(hits).toBeGreaterThan(3); }
  });
  it('crates turn up ahead of everyone, not just the leader, and the back of the field gets the catch-up weapons', () => {
    const { R, Wd } = race(true); R.autoPlayer = true; const got = [], near = new Set();
    for (let t = 0; t < 45; t += 1 / 120) {
      M.raceStep(R, 1 / 120, Wd);
      for (const k of R.wpn.crates) R.cars.forEach((c, j) => { if (k.s - c.progress > 40 && k.s - c.progress < 110) near.add(j); });
      for (const c of R.cars) { for (const e of c.events) if (e.t === 'pickup') got.push({ item: e.item, rank: R.cars.filter(o => o.progress > c.progress).length }); c.events.length = 0; }
    }
    expect(near.size).toBe(4);                                                          // every car had a crate coming up at some point
    expect(got.length).toBeGreaterThan(4); expect(got.every(g => M.ITEMS.includes(g.item))).toBe(true);
  });
  it('a whole race with weapons: everyone still finishes, the AI uses both, nobody is wrecked over and over', () => {
    const { R, Wd } = race(true); R.autoPlayer = true; const n = {};
    let t = 0; while (t < 200 && !R.cars.every(c => c.finished)) { M.raceStep(R, 1 / 120, Wd); t += 1 / 120; for (const c of R.cars) { for (const e of c.events) n[e.t] = (n[e.t] || 0) + 1; c.events.length = 0; } }
    expect(R.cars.every(c => c.finished)).toBe(true);
    expect(n['door-hit'] || 0).toBeGreaterThan(0);
    expect(R.cars.reduce((a, c) => a + c.wrecks, 0)).toBeLessThanOrEqual(3);
  });
});
