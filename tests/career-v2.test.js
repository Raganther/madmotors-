// Career v2 (G5): series in every tier, boss tracks, the Elite tier (rated fields, personalities, the nemesis), seasons and prestige.
import { describe, expect, it } from 'vitest';
import { ELITE, NEMESES, PRESTIGE, SERIES, TIERS, allowed, bossOf, careerDefs, careerField, eventById, gateOf, isElite, modeOf, nemesisOf, newCareer, prestige, ratedLevel, scoreRace, seasonEvents, seasonRace, seasonTable, seriesOf, tierCars, tierOpen } from '../src/data/career.js';
import { SEASON_CASH } from '../src/data/economy.js';
import { STAGES } from '../src/data/stages/index.js';
import { buildOf } from '../src/data/parts.js';
import { paceOf } from '../src/data/ratings.js';
import * as M from '../src/core/index.js';

const T0 = { air: 0, drift: 0, hits: 0, wrecks: 0, respawns: 0 };
describe('series', () => {
  it('every tier runs a Road, Rally, Off-road and Derby series and an Oddball cup, each enterable with cars on sale by then', () => {
    for (const [ti, t] of TIERS.entries()) for (const id of SERIES) {
      const evs = t.events.filter(e => seriesOf(e) === id); expect(evs.length, `${t.id} ${id}`).toBeGreaterThan(0);
      for (const ev of evs) expect(tierCars(ti).filter(c => allowed(ev, c)).length, ev.id).toBeGreaterThanOrEqual(2);
    }
  });
  it('a derby series is raced as derbies; its rounds are arenas or derby tracks', () => {
    const ev = eventById('rookie-derby'); expect(modeOf(ev)).toBe('derby'); expect(careerField(ev).length).toBe(5);
    expect(careerDefs(newCareer('coupe'), ev).at(-1).player).toBe(true);
  });
});
describe('boss tracks', () => {
  it('the Monster Truck, the Formula Racer and the Rocket Car race on their own stages', () => {
    const at = { monster: 'Monster Stadium', formula: 'Old Town GP', rocket: 'Salt Flats' };
    for (const t of TIERS) { const b = bossOf(t); if (b && at[b.vehicle]) expect(b.stage, b.driver).toBe(at[b.vehicle]); }
    for (const name of Object.values(at)) expect(STAGES.some(s => s.name === name)).toBe(true);
  });
});
describe('Elite', () => {
  const champ = { ...newCareer('police'), beaten: { 'rookie-boss': true, 'club-boss': true, 'pro-boss': true, 'legend-boss': true, final: true }, champion: true, nemesis: { name: 'Delgado', beat: 0, lost: 0 } };
  const E = TIERS.findIndex(t => t.elite);
  it('opens on winning Champion of Champions, which names a nemesis', () => {
    expect(gateOf(TIERS[E - 1]).kind).toBe('final'); expect(tierOpen(newCareer('coupe'), E)).toBe(false); expect(tierOpen(champ, E)).toBe(true);
    const s = { ...newCareer('coupe'), beaten: { 'legend-boss': true } }, w = scoreRace(s, eventById('final'), 0, 1, 8, T0);
    expect(NEMESES).toContain(w.state.nemesis.name);
  });
  it('fields of twelve with the nemesis in every one, sharper and fully built; blockers and bombers among the rest', () => {
    for (const ev of TIERS[E].events) {
      const f = careerField(ev, E, champ), nem = f.find(d => d.name === nemesisOf(champ));
      expect(f.length, ev.id).toBe(modeOf(ev) === 'derby' ? 7 : ELITE.FIELD); expect(nem, ev.id).toBeTruthy(); expect(nem.persona).toBe('nemesis');
      expect(nem.build).toEqual({ eng: 3, tyr: 3, sus: 3 });
    }
    const all = TIERS[E].events.flatMap(ev => careerField(ev, E, champ).map(d => d.persona));
    expect(all).toContain('blocker'); expect(all).toContain('bomber');
  });
  it("rivals are built to the player's pace: a faster car meets better-built rivals", () => {
    const ev = eventById('elite-road'), lv = s => careerField(ev, E, s).filter(d => d.persona !== 'nemesis').reduce((a, d) => a + (d.build ? d.build.eng : 0), 0);
    const slow = { ...champ, car: 'coupe', cars: { coupe: {} } }, fast = { ...champ, car: 'coupe', cars: { coupe: { eng: 3, tyr: 3, sus: 3 } } };
    expect(lv(fast)).toBeGreaterThan(lv(slow));
    expect(ratedLevel('hotrod', -10, 'tarmac')).toBe(3); expect(ratedLevel('hotrod', 50, 'tarmac')).toBe(0);
    const L = ratedLevel('hotrod', -2, 'tarmac'); expect(paceOf('hotrod', buildOf({ eng: L, tyr: L, sus: L }), 'tarmac')).toBeLessThanOrEqual(-2 + ELITE.GAP);
  });
  it('the nemesis record counts who finished ahead', () => {
    const ev = TIERS[E].events[0];
    let s = scoreRace(champ, ev, 0, 2, 12, { ...T0, nemesis: 5 }).state; expect(s.nemesis).toMatchObject({ beat: 1, lost: 0 });
    s = scoreRace(s, ev, 1, 6, 12, { ...T0, nemesis: 1 }).state; expect(s.nemesis).toMatchObject({ beat: 1, lost: 1 });
  });
  it('a season scores every Elite race and ends when every Elite event is done: paid, titled, cups cleared', () => {
    let s = { ...champ, cups: { 'elite-gp': { round: 4 } } }; const evs = seasonEvents(); expect(evs.every(isElite)).toBe(true);
    let over = null;
    evs.forEach((ev, i) => { const r = seasonRace(s, ev, ['You', 'Delgado', 'Moreau'], true); s = r.state; if (i < evs.length - 1) expect(r.over).toBe(null); else over = r.over; });
    expect(over).toMatchObject({ n: 1, place: 1, cash: SEASON_CASH[0] }); expect(s.titles).toEqual([{ n: 1, place: 1 }]);
    expect(s.season).toEqual({ n: 2, pts: {}, done: {} }); expect(s.cups['elite-gp']).toBeUndefined();
    const r = seasonRace(s, evs[0], ['Moreau', 'You'], false); expect(seasonTable(r.state)[0]).toEqual({ name: 'Moreau', pts: 10 });
    expect(seasonRace(champ, eventById('rookie-cup'), ['You'], true).state).toBe(champ);   // not an Elite event: no season
  });
});
describe('prestige', () => {
  it('a Champion starts over at Rookie with the garage, sharper and better-built rivals, and bigger prizes', () => {
    const s = { ...newCareer('coupe'), cars: { coupe: { eng: 2 }, limo: {} }, champion: true, cash: 99999, stars: { 'rookie-cup:0': 7 } };
    expect(prestige(newCareer('coupe'))).toBe(null);
    const p = prestige(s); expect(p.prestige).toBe(1); expect(p.cars).toEqual(s.cars); expect(p.stars).toEqual({}); expect(p.champion).toBeFalsy(); expect(p.cash).toBe(newCareer('coupe').cash);
    const ev = eventById('circuit-series'), a = careerField(ev, 1, s), b = careerField(ev, 1, p);
    expect(b[0].skill).toBeGreaterThan(a[0].skill); expect(b[0].build.eng).toBe(a[0].build.eng + 1);
    expect(scoreRace(p, ev, 0, 1, 8, T0).cash).toBeGreaterThan(scoreRace(s, ev, 0, 1, 8, T0).cash);
    expect(PRESTIGE.MAX).toBe(3);
  });
});
describe('personalities (core/sim/ai.js, features/weapons.js)', () => {
  const st = STAGES.find(s => s.name === 'Mountain Loop'), tr = M.buildTrack(st), W = { tr, terr: M.buildTerrain(tr, st), surf: st.surface, armco: !!st.armco };
  const run = persona => {
    let seed = 3; Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const defs = careerDefs(newCareer('coupe'), eventById('circuit-series')).map(d => d.player ? d : { ...d, persona });
    const R = M.createRace(W, defs, { weapons: true }); R.phase = 'racing'; R.autoPlayer = true; const got = new Map(); let held = 0, used = 0;
    for (let i = 0; i < 120 * 60; i++) {   // how long a rival holds an item before using it
      M.raceStep(R, 1 / 120, W);
      for (const c of R.cars) { for (const e of c.events) if (!c.isPlayer && e.t === 'pickup') got.set(c, R.time); else if (!c.isPlayer && e.t === 'use' && got.has(c)) { held += R.time - got.get(c); used++; got.delete(c); } c.events.length = 0; }
    }
    return { hold: held / Math.max(1, used), R };
  };
  it('bombers use their weapons more than plain drivers do; blockers race without trouble', () => {
    const plain = run(undefined), bomb = run('bomber'), block = run('blocker');
    expect(bomb.hold).toBeLessThan(plain.hold * 0.8);
    expect(block.R.cars.every(c => c.progress > 500)).toBe(true);
  }, 120000);
});
