// The economy sheet (G4): data/economy.js, data/prices.js, and how fast the career pays (tools/career-sim.mjs).
import { describe, expect, it } from 'vitest';
import { CAR_BASE, RESALE, carPrice, sellValue, spentOn } from '../src/data/economy.js';
import { COST_GROW, costCurve } from '../src/data/prices.js';
import { SHOP, TIERS, buyUpgrade, careerDefs, newCareer, roundsOf, scoreRace, sellCar, sellPrice } from '../src/data/career.js';
import { SLOTS } from '../src/data/parts.js';
import { ratingOf } from '../src/data/ratings.js';
import { STAGES } from '../src/data/stages/index.js';
import * as M from '../src/core/index.js';
import { simRace } from '../tools/career-sim.mjs';

describe('prices', () => {
  it('a car costs its tier\'s base, more for pace and toughness: nothing priced by hand', () => {
    for (const [id, p] of Object.entries(SHOP)) { expect(p.price, id).toBe(carPrice(id, p.tier)); expect(p.price / CAR_BASE[p.tier], id).toBeGreaterThan(0.85); expect(p.price / CAR_BASE[p.tier], id).toBeLessThan(1.6); }
    const t1 = Object.keys(SHOP).filter(id => SHOP[id].tier === 1), q = id => -ratingOf(id).pace * 0.06 + (ratingOf(id).tough - 1) * 0.5;
    for (const a of t1) for (const b of t1) if (q(a) > q(b) + 0.05) expect(SHOP[a].price, `${a} vs ${b}`).toBeGreaterThanOrEqual(SHOP[b].price);
    for (let t = 1; t < TIERS.length; t++) expect(Math.min(...Object.values(SHOP).filter(p => p.tier === t).map(p => p.price))).toBeGreaterThan(Math.max(...Object.values(SHOP).filter(p => p.tier === t - 1).map(p => p.price)) * 0.8);
  });
  it('every level of a part costs COST_GROW times the last', () => {
    expect(costCurve(1500)).toEqual([1500, 3750, 9500]);
    for (const s of SLOTS) for (let L = 1; L < 3; L++) expect(Math.abs(s.price[L] / s.price[L - 1] - COST_GROW), s.id).toBeLessThan(0.15);
  });
  it('a car sells for 60% of its price and of what was spent on it; never the one you drive or your last', () => {
    let s = { ...newCareer('coupe'), cash: 100000 }; s = buyUpgrade(s, 'coupe', 'eng'); s = { ...s, cars: { ...s.cars, kart: {} } };
    expect(spentOn(s.cars.coupe)).toBe(SLOTS[0].price[0]); expect(sellPrice(s, 'coupe')).toBe(sellValue(SHOP.coupe.price, s.cars.coupe));
    expect(Math.abs(sellValue(SHOP.coupe.price, s.cars.coupe) - RESALE * (SHOP.coupe.price + SLOTS[0].price[0]))).toBeLessThanOrEqual(50);   // (to the $100)
    expect(sellCar(s, 'coupe')).toBe(null); const sold = sellCar(s, 'kart'); expect(sold.cars.kart).toBeUndefined(); expect(sold.cash).toBe(s.cash + sellPrice(s, 'kart'));
    expect(sellCar({ ...newCareer('coupe') }, 'coupe')).toBe(null);
  });
});
describe('pacing', () => {
  // the roadmap's target: a casual player (skill 0.88) can buy the next tier's cheapest car within six races
  it('six Rookie races at a casual skill buy the cheapest Club car', () => {
    const worlds = {}, world = name => worlds[name] || (worlds[name] = (st => { const tr = M.buildTrack(st); return { tr, terr: M.buildTerrain(tr, st), surf: st.surface, armco: !!st.armco }; })(STAGES.find(x => x.name === name)));
    let s = newCareer('coupe'); const T = TIERS[0], rounds = T.events.filter(e => e.kind === 'cup').flatMap(ev => roundsOf(ev).map((r, k) => ({ ev, r, k }))).slice(0, 6);
    for (const { ev, r, k } of rounds) { const res = simRace(careerDefs(s, ev), world(r.stage), 0.88, 7, ev); s = scoreRace(s, ev, k, res.place, res.n, res.t, res.time).state; }
    const club = Math.min(...Object.values(SHOP).filter(p => p.tier === 1).map(p => p.price));
    expect(s.cash).toBeGreaterThanOrEqual(club);
  }, 120000);
});
