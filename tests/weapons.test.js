// Weapons (core/features/weapons.js): the homing missile and door bashing, and that with weapons off nothing changes.
import { describe, it, expect } from 'vitest';
import M from './core-under-test.js';
import { seedRandom } from './scenarios.js';
import { WORKSHOP_STAGE } from '../src/data/workshop.js';
const ytr = M.buildTrack(WORKSHOP_STAGE);

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
    P.wpn.item = 'missile'; P.wpn.uses = 1; P.wpn.lockTgt = 1; P.wpn.lockK = 1;   // locked (the lock itself: the next test)
    P.inp.fire = true; M.raceStep(R, 1 / 120, Wd); expect(R.missiles.length).toBe(1); expect(R.missiles[0].tgt).toBe(1); expect(P.wpn.item).toBe(null);
    let hit = null; for (let t = 0; t < 3 && !hit; t += 1 / 120) { M.raceStep(R, 1 / 120, Wd); hit = T.events.find(e => e.t === 'missile-hit'); T.events.length = 0; }
    expect(hit).toBeTruthy(); expect(hit.from).toBe(2);
    expect(Math.hypot(T.vx, T.vz)).toBeLessThan(12); expect(Math.abs(T.spin)).toBeGreaterThan(1);
    expect(T.wreckT > 0).toBe(false);                                                   // it hurts, it doesn't wreck
  });
  it('the lock: it builds while the car ahead stays in your sights; fired early the missile flies straight, fired locked it homes', () => {
    const { R, Wd } = race(true), P = R.player, T = R.cars[1];
    R.cars.forEach((c, k) => put(c, 200 + k * 3, -5, 0)); put(P, 300, -3, 0); put(T, 340, 3, 0);
    P.wpn.item = 'missile'; P.wpn.uses = 1; const seen = [];
    for (let k = 0; k < 30; k++) { M.raceStep(R, 1 / 120, Wd); put(P, 300, -3, 0); put(T, 340, 3, 0); }   // a quarter of a second: not locked yet
    expect(P.wpn.lockTgt).toBe(1); expect(P.wpn.lockK).toBeGreaterThan(0.1); expect(P.wpn.lockK).toBeLessThan(1); expect(M.lockedOn(R, P)).toBe(-1);
    for (let k = 0; k < 150; k++) { M.raceStep(R, 1 / 120, Wd); put(P, 300, -3, 0); put(T, 340, 3, 0); seen.push(...P.events.map(e => e.t)); P.events.length = 0; }
    expect(M.lockedOn(R, P)).toBe(1); expect(seen).toContain('locked');
    P.wpn.lockK = 0.5; P.inp.fire = true; M.raceStep(R, 1 / 120, Wd); expect(R.missiles[0].tgt).toBe(-1);   // early: a dumb shot
    R.missiles.length = 0; P.wpn.item = 'missile'; P.wpn.uses = 1; P.wpn.lockTgt = 1; P.wpn.lockK = 1; P.inp.fire = true; M.raceStep(R, 1 / 120, Wd); expect(R.missiles[0].tgt).toBe(1);
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
      for (const c of R.cars) { for (const e of c.events) if (e.t === 'pickup' && !e.def) got.push({ item: e.item, rank: R.cars.filter(o => o.progress > c.progress).length }); c.events.length = 0; }
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
  const setup = (item, lats, gaps, pdef, odef, at = 400) => { const s = raceW(pdef, odef), { R, P } = s; R.cars.forEach((c, k) => put(c, 150 + k * 20, 0, 0)); put(P, at, 0, 22); R.cars.filter(c => c !== P).forEach((c, k) => put(c, at + gaps[k], lats[k], 22)); P.wpn.item = item; P.wpn.uses = M.ITEM_USES[item]; if (item === 'missile') { P.wpn.lockTgt = M.missileTarget(R, P); P.wpn.lockK = 1; } P.inp.fire = true; return s; };
  const run = (R, Wd, secs, on) => { for (let k = 0; k < secs * 120; k++) { M.raceStep(R, 1 / 120, Wd); for (const c of R.cars) { if (on) c.events.forEach(e => on(e, c)); c.events.length = 0; } } };
  const L3 = it => ({ wpn: { lv: { [it]: 3 } } });
  it('levels: a longer gun burst, a wider pulse, twin missiles, glue in the oil', () => {
    { const { R, Wd, P } = setup('gun', [0, 6, -6], [25, -60, -70], L3('gun')); M.raceStep(R, 1 / 120, Wd); expect(P.wpn.gunT).toBeGreaterThan(4.9); }
    for (const [lv, hit] of [[{}, false], [L3('pulse'), true]]) { const { R, Wd } = setup('pulse', [17, 0, -5], [0, 60, -70], lv); M.raceStep(R, 1 / 120, Wd); expect((R.cars[0].stallT || 0) > 0, JSON.stringify(lv)).toBe(hit); }
    { const { R, Wd } = setup('missile', [-3, 3, 0], [30, 45, -70], L3('missile')); M.raceStep(R, 1 / 120, Wd); expect(R.missiles.length).toBe(2); expect(new Set(R.missiles.map(m => m.tgt)).size).toBe(2); }
    const after = lv => { const { R, Wd } = setup('oil', [0, 5, -5], [-14, -60, -60], lv); let v = 99; run(R, Wd, 2, (e, c) => { if ((e.t === 'oil-hit' || e.t === 'drum-hit') && v === 99) v = Math.hypot(c.vx, c.vz); }); return v; };
    expect(after(L3('oil'))).toBeLessThan(after({}) - 3);
  });
  it('oil: a drum off the back bounces down the road and bursts into a slick; one that lands on the car behind oils it', () => {
    { const { R, Wd } = setup('oil', [0, 6, -6], [-90, -100, -110]), ev = []; run(R, Wd, 0.05); expect(R.wpn.drums.length).toBe(1);
      run(R, Wd, 2.5, e => ev.push(e.t)); expect(ev).toContain('drum-bounce'); expect(ev).toContain('drum-burst'); expect(R.wpn.slicks.length).toBe(1); expect(R.wpn.drums.length).toBe(0); }
    { const { R, Wd, P } = setup('oil', [0, 6, -6], [-9, -100, -110]), T = R.cars.find(c => c !== P && c.progress > P.progress - 12 && c.progress < P.progress); let hit = null;
      run(R, Wd, 1.5, (e, c) => { if (e.t === 'drum-hit' && c === T) hit = { oil: c.oilT }; }); expect(hit).not.toBe(null); expect(hit.oil).toBeGreaterThan(M.WPN.OIL_T); }
  });
  it('a blast by an oil slick sets it alight: the car through it is scorched, not sent sliding, and it burns away', () => {
    const { R, Wd, P } = setup('mine', [0, 6, -6], [-30, -100, -110]), T = R.cars.find(c => c !== P && c.progress > P.progress - 32 && c.progress < P.progress);
    R.wpn.slicks.push({ id: 900, s: P.progress - 10, lat: 0, t: 0, from: R.cars.indexOf(P), r: M.WPN.OIL_R });
    P.inp.fire = false; R.wpn.mines.push({ id: 901, x: P.x, y: P.y, z: P.z, t: 5, from: R.cars.indexOf(T), blast: 6, dmg: 1 });   // set off under the player, 10 m from the slick
    const ev = []; run(R, Wd, 3, (e, c) => ev.push([e.t, c === T]));
    expect(ev.some(([t]) => t === 'oil-fire')).toBe(true); expect(ev.some(([t, isT]) => t === 'fire-hit' && isT)).toBe(true); expect(ev.some(([t, isT]) => t === 'oil-hit' && isT)).toBe(false);
    run(R, Wd, 3); expect(R.wpn.slicks.some(o => o.id === 900)).toBe(false);
  });
  it('the mortar: a shell lands where the car ahead will be, throws and dents it, and leaves a crater that jolts the next car through', () => {
    const { R, Wd, P } = setup('mortar', [0, 6, -6], [55, -60, -70]), T = R.cars[0]; const seen = [];
    M.raceStep(R, 1 / 120, Wd); expect(R.wpn.shells.length).toBe(1); expect(R.wpn.shells[0].tgt).toBe(0);
    run(R, Wd, 2.2, (e, c) => { if (c === T) seen.push(e.t); });
    expect(seen).toContain('mortar-hit'); expect(T.dmg.f + T.dmg.b + T.dmg.l + T.dmg.r).toBeGreaterThan(0);
    expect(R.wpn.craters.length).toBe(1);
    const k = R.wpn.craters[0], hits = []; put(P, Math.round(k.s) - 12, k.lat, 22); P.inp.throttle = 0; P.inp.steer = 0;   // the player, hands off, straight at it
    run(R, Wd, 1.2, (e, c) => { if (c === P) hits.push(e.t); });
    expect(hits).toContain('crater-hit');
    expect(L3('mortar').wpn.lv.mortar).toBe(3);
    { const s3 = setup('mortar', [0, 6, -6], [55, -60, -70], L3('mortar')); M.raceStep(s3.R, 1 / 120, s3.Wd); expect(s3.R.wpn.shells.length).toBe(3); expect(s3.R.wpn.shells[0].r).toBeGreaterThan(6.5); }
  });
  it('mines: dropped behind, armed, the car that runs over one is thrown up and slowed; its layer gets through', () => {
    const { R, Wd, P } = setup('mine', [0, 6, -6], [-16, -70, -80]); let hit = null, boom = 0;
    run(R, Wd, 2.5, (e, c) => { if (e.t === 'mine-hit' && c !== P && !hit) hit = { vy: c.vy, v: Math.hypot(c.vx, c.vz) }; if (e.t === 'mine-boom') boom++; });
    expect(boom).toBe(1); expect(hit).not.toBe(null); expect(hit.vy).toBeGreaterThan(2); expect(hit.v).toBeLessThan(18);
    expect(P.wpn.uses).toBe(1); expect(R.wpn.mines.length).toBe(0);
  });
  const WPN_ARM = () => R0time + M.WPN.MINE_ARM; let R0time = 0;
  it('mines: thrown off the back they tumble and bounce, settle and only then arm; one tumbling into a car goes off on it', () => {
    { const { R, Wd } = setup('mine', [0, 6, -6], [-90, -100, -110]), ev = []; run(R, Wd, 0.05); const m = R.wpn.mines[0]; expect(m.rest).toBeFalsy(); expect(m.y).toBeGreaterThan(R.player.y + 0.5);
      run(R, Wd, 3, e => ev.push(e.t)); expect(ev).toContain('mine-bounce'); expect(ev).toContain('mine-settle'); expect(R.wpn.mines.length).toBe(1); expect(R.wpn.mines[0].rest).toBe(true); expect(ev).not.toContain('mine-boom'); }
    { const { R, Wd, P } = setup('mine', [0, 6, -6], [-7, -100, -110]); let first = null; R0time = R.time;   // the car right behind runs into it while it's still in the air
      run(R, Wd, 1.5, (e, c) => { if (e.t === 'mine-hit' && c !== P && !first) first = { at: R.time }; });
      expect(first).not.toBe(null); expect(first.at).toBeLessThan(WPN_ARM()); expect(R.wpn.mines.length).toBe(0); }   // before any mine could have settled and armed
  });
  it('blasts reach the scenery: a mine breaks the crates near it, a missile even concrete, and nothing far off', () => {
    const Wy = { tr: ytr, terr: M.buildTerrain(ytr, WORKSHOP_STAGE), surf: WORKSHOP_STAGE.surface, armco: true }, R = M.createRace(Wy, DEFS, { weapons: true });
    const crates = R.brk.find(o => o.kind === 'crates'), conc = R.brk.find(o => o.kind === 'concrete');
    M.blastScenery(R, crates.x + 2, crates.z, M.WPN.BLAST_MINE[0], M.WPN.BLAST_MINE[1], 0); expect(crates.broken).toBe(true);
    M.blastScenery(R, conc.x, conc.z, M.WPN.BLAST_MISSILE[0], M.WPN.BLAST_MISSILE[1], 0); expect(conc.broken).toBe(true); expect(R.chunks.length).toBe(3);
    expect(R.brk.filter(o => o.broken).length).toBe(2);
  });
  it('defence: rivals with flares or a shield (gear) start holding it, use it on a missile coming for them, and get it back', () => {
    for (const gear of ['flares', 'shield']) {
      const { R, Wd } = setup('missile', [3, 5, -5], [40, -60, -70], {}, { wpn: { gear } }), T = R.cars[0]; const seen = [];
      expect(T.wpn.def).toBe(gear);
      run(R, Wd, 3, (e, c) => { if (c === T) seen.push(e.t === 'defend' ? e.item : e.t); });
      expect(seen.includes('missile-hit'), gear).toBe(false); expect(seen.includes(gear), gear).toBe(true);
      expect(T.wpn.def, gear).toBe(null); expect(T.wpn.defT, gear).toBeGreaterThan(10);
      R.wpn.crates = []; for (const c of R.cars) c.wpn.crateT = 1e9;   // (no blue crate to fill the slot meanwhile)
      let back = false; run(R, Wd, 20, (e, c) => { if (c === T && e.t === 'recharged' && e.item === gear) back = true; }); expect(back, gear).toBe(true);
    }
  });
  it('defence: flares too early burn out, a shield blocks, smoke breaks a lock, a repair kit mends', () => {
    // P fires a locked missile at T; T uses its defence `at` s after (before, when negative): was T hit?
    const missileAt = (def, at) => {
      const { R, Wd, P } = setup('missile', [3, 5, -5], [40, -60, -70]), T = R.cars[0], use = () => { T.wpn.def = def; T.inp.defend = true; }; P.inp.fire = false;
      if (at < 0) { use(); for (let k = 0; k < -at * 120; k++) { M.raceStep(R, 1 / 120, Wd); put(P, 400, 0, 22); put(T, 440, 3, 22); } }
      P.wpn.item = 'missile'; P.wpn.uses = 1; P.wpn.lockTgt = 0; P.wpn.lockK = 1; P.inp.fire = true; let hit = false;
      for (let k = 0; k < 360; k++) { if (k === Math.round(at * 120)) use(); run(R, Wd, 1 / 120, (e, c) => { if (c === T && e.t === 'missile-hit') hit = true; }); }
      return hit;
    };
    expect(missileAt(null, 99)).toBe(true);
    expect(missileAt('flares', 0.3)).toBe(false);
    expect(missileAt('flares', -2)).toBe(true);   // too early: burnt out before the missile came
    expect(missileAt('shield', 0.5)).toBe(false);
    { const { R, Wd, P } = setup('missile', [3, 5, -5], [40, -60, -70]), T = R.cars[0]; P.inp.fire = false; expect(M.lockedOn(R, P)).toBe(0);
      T.wpn.def = 'smoke'; T.inp.defend = true; M.raceStep(R, 1 / 120, Wd); expect(M.lockedOn(R, P)).toBe(-1); expect(T.wpn.def).toBe(null);
      run(R, Wd, 0.5); expect(R.wpn.clouds.length).toBeGreaterThan(0); expect(P.wpn.lockK).toBe(0); }
    { const { R, Wd } = setup('gun', [3, 5, -5], [40, -60, -70]), T = R.cars[0]; T.dmg = { f: 0.6, b: 0.2, l: 0.5, r: 0 };
      T.wpn.def = 'repair'; T.inp.defend = true; M.raceStep(R, 1 / 120, Wd); expect(T.dmg).toEqual({ f: 0, b: 0, l: 0, r: 0 }); }
  });
  it('defence: blue crates fill the defence slot beside the weapon, and the rivals use what they get', () => {
    const { R, Wd } = raceW(), got = [], used = []; R.autoPlayer = true;
    run(R, Wd, 150, (e, c) => { if (e.t === 'pickup' && e.def) got.push(e.def); if (e.t === 'defend') used.push(e.item); });
    expect(got.length).toBeGreaterThan(1); expect(got.every(d => M.DEFENCE.includes(d))).toBe(true); expect(used.length).toBeGreaterThan(0);
  });
  it('signature weapons come with their vehicle, and only with it', () => {
    const { R, Wd } = raceW({ vehicle: 'firetruck' }), got = [];
    expect(R.player.wpn.sig).toBe('water');
    const odds = c => Object.fromEntries(M.ITEMS.map((it, q) => [it, M.pickupOdds(R, c)[q]]));
    expect(odds(R.player).water).toBeGreaterThan(1); for (const it of M.SIG_ITEMS) if (it !== 'water') expect(odds(R.player)[it]).toBe(0);
    for (const c of R.cars) if (!c.isPlayer) for (const it of M.SIG_ITEMS) expect(odds(c)[it]).toBe(0);
    R.autoPlayer = true; run(R, Wd, 150, (e, c) => { if (e.t === 'pickup') got.push([c.isPlayer, e.item]); });
    expect(got.length).toBeGreaterThan(5); expect(got.some(([p, it]) => !p && M.SIG_ITEMS.includes(it))).toBe(false);
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
