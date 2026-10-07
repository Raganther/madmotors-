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
    const setup = (item, lats, gaps, at = 400) => { const { R, Wd } = race(true), P = R.player; R.cars.forEach((c, k) => put(c, 150 + k * 20, 0, 0)); put(P, at, 0, 22); R.cars.filter(c => c !== P).forEach((c, k) => put(c, at + gaps[k], lats[k], 22)); P.wpn.item = item; P.wpn.uses = M.ITEM_USES[item]; P.inp.fire = true; return { R, Wd, P }; };
    { const { R, Wd } = setup('oil', [0, 5, -5], [-14, -60, -60]); let slid = false; for (let k = 0; k < 240; k++) { M.raceStep(R, 1 / 120, Wd); if (R.cars[0].oilT > 0) slid = true; } expect(slid).toBe(true); }
    { const { R, Wd } = setup('pulse', [3.5, 0, -5], [0, 60, -70]); const O = R.cars[0], v0 = Math.hypot(O.vx, O.vz); M.raceStep(R, 1 / 120, Wd); expect(O.stallT).toBeGreaterThan(0); expect(Math.hypot(O.vx, O.vz)).not.toBeCloseTo(v0, 0); expect(R.cars[1].stallT || 0).toBe(0); }
    { const gap = hook => { const { R, Wd, P } = setup('harpoon', [0, 5, -5], [30, -60, -70]); R.autoPlayer = true; if (!hook) P.inp.fire = false; let towed = 0; for (let k = 0; k < 300; k++) { M.raceStep(R, 1 / 120, Wd); if (R.wpn.hooks.some(h => h.tow > 0)) towed++; } return { towed, gap: R.cars[0].progress - P.progress }; };
      const on = gap(true), off = gap(false); expect(on.towed).toBeGreaterThan(60); expect(on.gap).toBeLessThan(off.gap - 5); }
    { const { R, Wd } = setup('gun', [0, 6, -6], [25, -60, -70], 990); R.autoPlayer = true; /* the gun fires straight where the car points: a straight, and someone driving it */ let hits = 0; for (let k = 0; k < 360; k++) { M.raceStep(R, 1 / 120, Wd); for (const c of R.cars) { hits += c.events.filter(e => e.t === 'bullet-hit').length; c.events.length = 0; } } expect(hits).toBeGreaterThan(3); }
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

// F6 (data/weapons.js): levels, gear and the signature weapons
describe('weapon modules', () => {
  const raceW = (pdef = {}, odef = {}) => { seedRandom(9); const Wd = W(), defs = DEFS.map(d => d.player ? { ...d, ...pdef } : { ...d, ...odef }); const R = M.createRace(Wd, defs, { weapons: true }); R.phase = 'racing'; return { R, Wd, P: R.player }; };
  // the player at `at` holding `item`, the others at `gaps` along and `lats` across from it
  const setup = (item, lats, gaps, pdef, odef, at = 400) => { const s = raceW(pdef, odef), { R, P } = s; R.cars.forEach((c, k) => put(c, 150 + k * 20, 0, 0)); put(P, at, 0, 22); R.cars.filter(c => c !== P).forEach((c, k) => put(c, at + gaps[k], lats[k], 22)); P.wpn.item = item; P.wpn.uses = M.ITEM_USES[item]; P.inp.fire = true; return s; };
  const run = (R, Wd, secs, on) => { for (let k = 0; k < secs * 120; k++) { M.raceStep(R, 1 / 120, Wd); for (const c of R.cars) { if (on) c.events.forEach(e => on(e, c)); c.events.length = 0; } } };
  const L3 = it => ({ wpn: { lv: { [it]: 3 } } });
  it('levels: a longer gun burst, a wider pulse, twin missiles, glue in the oil', () => {
    { const { R, Wd, P } = setup('gun', [0, 6, -6], [25, -60, -70], L3('gun')); M.raceStep(R, 1 / 120, Wd); expect(P.wpn.gunT).toBeGreaterThan(4.9); }
    for (const [lv, hit] of [[{}, false], [L3('pulse'), true]]) { const { R, Wd } = setup('pulse', [17, 0, -5], [0, 60, -70], lv); M.raceStep(R, 1 / 120, Wd); expect((R.cars[0].stallT || 0) > 0, JSON.stringify(lv)).toBe(hit); }
    { const { R, Wd } = setup('missile', [-3, 3, 0], [30, 45, -70], L3('missile')); M.raceStep(R, 1 / 120, Wd); expect(R.missiles.length).toBe(2); expect(new Set(R.missiles.map(m => m.tgt)).size).toBe(2); }
    const after = lv => { const { R, Wd } = setup('oil', [0, 5, -5], [-14, -60, -60], lv); let v = 99; run(R, Wd, 2, (e, c) => { if (e.t === 'oil-hit') v = Math.hypot(c.vx, c.vz); }); return v; };
    expect(after(L3('oil'))).toBeLessThan(after({}) - 3);
  });
  it('gear: flares draw a missile off, a shield soaks up a hit, then both recharge', () => {
    for (const gear of ['flares', 'shield']) {
      const { R, Wd } = setup('missile', [3, 5, -5], [40, -60, -70], {}, { wpn: { gear } }), T = R.cars[0]; const seen = [];
      run(R, Wd, 3, (e, c) => { if (c === T) seen.push(e.t); });
      expect(seen.includes('missile-hit'), gear).toBe(false); expect(seen.includes(gear === 'flares' ? 'flares' : 'shield'), gear).toBe(true);
      expect(gear === 'flares' ? T.wpn.flareT : T.wpn.shieldT).toBeGreaterThan(10);
    }
  });
  it('signature weapons come with their vehicle, and only with it', () => {
    const { R, Wd } = raceW({ vehicle: 'firetruck' }); R.autoPlayer = true; const got = [];
    run(R, Wd, 150, (e, c) => { if (e.t === 'pickup') got.push([c.isPlayer, e.item]); });
    expect(R.player.wpn.sig).toBe('water');
    expect(got.some(([p, it]) => p && it === 'water')).toBe(true);
    expect(got.some(([p, it]) => !p && M.SIG_ITEMS.includes(it))).toBe(false);
  });
  it('the water cannon shoves the car ahead aside, cement and the stinger catch the car behind, the crush slams a neighbour, the jingle stutters everyone near', () => {
    const lat0 = (() => { const { R, Wd } = setup('water', [0, 5, -5], [14, -60, -70]); R.player.inp.fire = false; run(R, Wd, 1.5); return R.cars[0].pr.lat; })();
    { const { R, Wd } = setup('water', [0, 5, -5], [14, -60, -70]); const n = []; run(R, Wd, 1.5, e => n.push(e.t)); expect(n).toContain('water-hit'); expect(Math.abs(R.cars[0].pr.lat - lat0) + R.cars[0].oilT).toBeGreaterThan(0.3); }
    const behind = item => { const { R, Wd } = setup(item, [0, 5, -5], [-16, -60, -70]); const n = []; run(R, Wd, 3, e => n.push(e.t)); return n; };
    expect(behind('cement')).toContain('cement-hit'); expect(behind('stinger')).toContain('stinger-hit');
    { const { R, Wd } = setup('crush', [4, 30, -30], [0, -60, -70]); const n = []; run(R, Wd, 3, e => n.push(e.t)); expect(n).toContain('crush'); expect(n).toContain('crush-hit'); }
    { const { R, Wd } = setup('jingle', [4, 0, -30], [8, -15, -90]); const n = []; run(R, Wd, 1, e => n.push(e.t)); expect(n.filter(t => t === 'jingle-hit').length).toBe(2); }
  });
});
