import { describe, it, expect } from 'vitest';
import { CAREER_RIVALS, SHOP, STARTERS, TIERS, awardTrophy, buyCar, careerDefs, careerField, eventById, forSale, newCareer, podiumOf, roundsOf, scoreRace, tierCars, tierOpen, tierStars, topTier, totalStars } from '../src/data/career.js';
import { STAGES } from '../src/data/stages/index.js';
import { VEHICLES } from '../src/data/vehicles.js';

const T0 = { air: 0, drift: 0, hits: 0, wrecks: 0, respawns: 0 };
describe('career data', () => {
  it('every round is a real stage with an objective; event ids are unique', () => {
    const ids = new Set();
    for (const t of TIERS) for (const ev of t.events) {
      expect(ids.has(ev.id), ev.id).toBe(false); ids.add(ev.id);
      for (const r of roundsOf(ev)) { expect(STAGES.some(s => s.name === r.stage), `${ev.name}: ${r.stage}`).toBe(true); expect(['drift', 'air', 'hits', 'clean']).toContain(r.obj.k); }
    }
  });
  it('the shop sells real vehicles, starters included, and every tier can open', () => {
    for (const id of [...Object.keys(SHOP), ...STARTERS]) expect(VEHICLES.some(v => v.id === id), id).toBe(true);
    for (let i = 1; i < TIERS.length; i++) expect(TIERS[i].need).toBeLessThanOrEqual(Math.round(TIERS[i - 1].events.reduce((a, ev) => a + roundsOf(ev).length * 3, 0) * 0.7));
  });
  it('fields: seven rivals, unique names, cars from the tier, skill scaled and capped', () => {
    for (const [ti, t] of TIERS.entries()) for (const ev of t.events) {
      const f = careerField(ev);
      expect(f.length).toBe(CAREER_RIVALS);
      expect(new Set(f.map(d => d.name)).size).toBe(CAREER_RIVALS);
      for (const d of f) { expect(tierCars(ti)).toContain(d.vehicle); expect(d.skill).toBeLessThanOrEqual(1); expect(d.skill).toBeGreaterThan(0.7); }
    }
    expect(careerField(TIERS[0].events[0])).toEqual(careerField(TIERS[0].events[0]));   // stable
  });
  it('the player lines up at the back, or the leader does from round 2', () => {
    const s = newCareer('tuktuk'), ev = TIERS[0].events[0], d = careerDefs(s, ev);
    expect(d.length).toBe(CAREER_RIVALS + 1); expect(d.at(-1).player).toBe(true); expect(d.at(-1).vehicle).toBe('tuktuk');
    const lead = d[2].name, d2 = careerDefs(s, ev, [lead, 'You']);
    expect(d2.at(-1).name).toBe(lead);
  });
});
describe('career rules', () => {
  it('stars: podium, win, objective; best kept; cash by place and bonuses', () => {
    let s = newCareer('coupe'); const ev = eventById('rookie-cup');
    let r = scoreRace(s, ev, 0, 3, 8, { ...T0, drift: 2 });   // objective: 2 drift boosts
    expect(r.stars).toBe(1 | 4); expect(r.fresh).toBe(5);
    expect(r.cash).toBe(550 + 40 + 150 + 250);
    s = r.state; expect(s.cash).toBe(1500 + r.cash); expect(totalStars(s)).toBe(2);
    r = scoreRace(s, ev, 0, 1, 8, { ...T0, wrecks: 1 });
    expect(r.stars).toBe(3); expect(r.fresh).toBe(2); expect(totalStars(r.state)).toBe(3);
    expect(scoreRace(r.state, ev, 0, 6, 8, T0).state.stars['rookie-cup:0']).toBe(7);   // a worse run keeps the stars
  });
  it('podium size follows the field', () => { expect(podiumOf(8)).toBe(3); expect(podiumOf(4)).toBe(2); expect(podiumOf(2)).toBe(1); expect(podiumOf(1)).toBe(1); });
  it('tiers open on stars; the showroom follows', () => {
    let s = newCareer('coupe');
    expect(tierOpen(s, 0)).toBe(true); expect(tierOpen(s, 1)).toBe(false); expect(forSale(s)).not.toContain('buggy');
    let k = 0; for (const ev of TIERS[0].events) roundsOf(ev).forEach((_, j) => { if (k++ < TIERS[1].need / 3) s = scoreRace(s, ev, j, 1, 8, { ...T0, drift: 9, air: 20, hits: 20 }).state; });
    expect(tierStars(s, TIERS[0])).toBeGreaterThanOrEqual(TIERS[1].need); expect(topTier(s)).toBe(1); expect(forSale(s)).toContain('buggy');
  });
  it('buying: needs the cash and an open showroom', () => {
    const s = newCareer('coupe');
    expect(buyCar(s, 'kart')).toBe(null);   // 1500 < 3000
    const rich = { ...s, cash: 50000 }, b = buyCar(rich, 'kart');
    expect(b.cash).toBe(50000 - SHOP.kart.price); expect(b.cars.kart).toEqual({}); expect(b.car).toBe('kart');
    expect(buyCar(rich, 'buggy')).toBe(null); expect(buyCar(b, 'kart')).toBe(null);
  });
  it('trophies pay once per step up', () => {
    const s = newCareer('coupe'), ev = eventById('rookie-cup');
    const a = awardTrophy(s, ev, 3); expect(a.cash).toBe(800);
    const b = awardTrophy(a.state, ev, 1); expect(b.cash).toBe(2500 - 800);
    expect(awardTrophy(b.state, ev, 2).cash).toBe(0); expect(awardTrophy(s, ev, 5).cash).toBe(0);
  });
});
