import { describe, it, expect } from 'vitest';
import { bossOf, eventOpen, medals, paintCar, PAINTS, PAINT_PRICE, tierMaxStars, CAREER_RIVALS, allowed, fitTyres, armoury, buyWeapon, fitGear, buyUpgrade, careerPlayer, upgradedVeh, SHOP, STARTERS, TIERS, awardTrophy, buyCar, careerDefs, careerField, eventById, forSale, newCareer, podiumOf, roundsOf, scoreRace, tierCars, tierOpen, tierStars, topTier, totalStars } from '../src/data/career.js';
import { DISCIPLINES } from '../src/data/disciplines.js';
import { SLOTS } from '../src/data/parts.js';
import { STAGES } from '../src/data/stages/index.js';
import { VEHICLES } from '../src/data/vehicles.js';

const T0 = { air: 0, drift: 0, hits: 0, wrecks: 0, respawns: 0 };
describe('career data', () => {
  it('every round is a real stage with an objective; event ids are unique', () => {
    const ids = new Set();
    for (const t of TIERS) for (const ev of t.events) {
      expect(ids.has(ev.id), ev.id).toBe(false); ids.add(ev.id);
      for (const r of roundsOf(ev)) { expect(STAGES.some(s => s.name === r.stage), `${ev.name}: ${r.stage}`).toBe(true); if (ev.kind === 'trial') expect(ev.par).toBeGreaterThan(20); else expect(['drift', 'air', 'hits', 'clean']).toContain(r.obj.k); }
    }
  });
  it('the shop sells real vehicles, starters included, and every tier can open', () => {
    for (const id of [...Object.keys(SHOP), ...STARTERS]) expect(VEHICLES.some(v => v.id === id), id).toBe(true);
    for (const t of TIERS) { const b = bossOf(t); expect(b, t.id).toBeTruthy(); expect(b.need).toBeLessThanOrEqual(Math.round(tierMaxStars(t) * 0.65)); }
  });
  it('fields: seven rivals, unique names, cars from the tier, skill scaled and capped', () => {
    for (const [ti, t] of TIERS.entries()) for (const ev of t.events.filter(e => e.kind === 'cup' || e.kind === 'onemake')) {
      const f = careerField(ev);
      expect(f.length).toBe(CAREER_RIVALS);
      expect(new Set(f.map(d => d.name)).size).toBe(CAREER_RIVALS);
      for (const d of f) { expect(ev.make ? [ev.make] : tierCars(ti)).toContain(d.vehicle); expect(d.skill).toBeLessThanOrEqual(1); expect(d.skill).toBeGreaterThan(0.7); }
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
    let r = scoreRace(s, ev, 1, 3, 8, { ...T0, drift: 4 });   // round 2's objective: 4 drift boosts
    expect(r.stars).toBe(1 | 4); expect(r.fresh).toBe(5);
    expect(r.cash).toBe(550 + 80 + 150 + 250);
    s = r.state; expect(s.cash).toBe(1500 + r.cash); expect(totalStars(s)).toBe(2);
    r = scoreRace(s, ev, 1, 1, 8, { ...T0, wrecks: 1 });
    expect(r.stars).toBe(3); expect(r.fresh).toBe(2); expect(totalStars(r.state)).toBe(3);
    expect(scoreRace(r.state, ev, 1, 6, 8, T0).state.stars['rookie-cup:1']).toBe(7);   // a worse run keeps the stars
  });
  it('a duel: the first star for finishing within DUEL_GAP of the winner', () => {
    const s = newCareer('coupe'), B = eventById('rookie-boss');
    expect(scoreRace(s, B, 0, 2, 2, { ...T0, gap: 3 }).stars & 1).toBe(1);
    expect(scoreRace(s, B, 0, 2, 2, { ...T0, gap: 9 }).stars & 1).toBe(0);
    expect(scoreRace(s, B, 0, 1, 2, { ...T0, gap: 0 }).stars & 3).toBe(3);
  });
  it('podium size follows the field', () => { expect(podiumOf(8)).toBe(3); expect(podiumOf(4)).toBe(2); expect(podiumOf(2)).toBe(1); expect(podiumOf(1)).toBe(1); });
  it('tiers open on stars; the showroom follows', () => {
    let s = newCareer('coupe');
    expect(tierOpen(s, 0)).toBe(true); expect(tierOpen(s, 1)).toBe(false); expect(forSale(s)).not.toContain('buggy');
    const B = bossOf(TIERS[0]);
    expect(eventOpen(s, B)).toBe(false);
    let k = 0; for (const ev of TIERS[0].events.filter(e => e.kind === 'cup')) roundsOf(ev).forEach((_, j) => { if (k++ < Math.ceil(B.need / 3)) s = scoreRace(s, ev, j, 1, 8, { ...T0, drift: 9, air: 20, hits: 20 }).state; });
    expect(tierStars(s, TIERS[0])).toBeGreaterThanOrEqual(B.need); expect(eventOpen(s, B)).toBe(true); expect(topTier(s)).toBe(0);   // stars open the boss, not the tier
    const r = scoreRace(s, B, 0, 1, 2, { ...T0, air: 20 });
    expect(r.prize).toBe('monster'); expect(r.state.cars.monster).toEqual({}); expect(r.lines.some(l => /purse/.test(l[0]))).toBe(true);
    s = r.state; expect(topTier(s)).toBe(1); expect(forSale(s)).toContain('buggy');
    expect(scoreRace(s, B, 0, 1, 2, T0).prize).toBe(null);   // the prize comes once
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
describe('career disciplines and upgrades', () => {
  it('every discipline cup can be entered with cars on sale by then, and its field is all of the discipline', () => {
    for (const [ti, t] of TIERS.entries()) for (const ev of t.events.filter(e => e.disc)) {
      expect(DISCIPLINES[ev.disc], ev.id).toBeTruthy();
      expect(tierCars(ti).filter(id => allowed(ev, id)).length, ev.id).toBeGreaterThanOrEqual(2);
      for (const d of careerField(ev)) expect(allowed(ev, d.vehicle, d.build), `${ev.id}: ${d.name} in ${d.vehicle}`).toBe(true);
    }
  });
  it('rivals carry the tier upgrade level; the player their own', () => {
    const club = TIERS[1].events[0], f = careerField(club)[0];
    expect(f.veh).toEqual(upgradedVeh(f.vehicle, { eng: 1, tyr: 1, sus: 1 }));
    expect(careerField(TIERS[0].events[0])[0].veh).toEqual(upgradedVeh(careerField(TIERS[0].events[0])[0].vehicle, {}));
    const s = { ...newCareer('coupe'), cars: { coupe: { eng: 2, arm: 1 } } }, p = careerPlayer(s);
    expect(p.veh.accel).toBeCloseTo(1.06); expect(p.veh.top).toBeCloseTo(1.03); expect(p.veh.im).toBeCloseTo(0.92); expect(p.im).toBeCloseTo(0.92);
  });
  it('upgrades cost cash, go up a level at a time and stop at the top', () => {
    let s = { ...newCareer('coupe'), cash: 100000 };
    for (let L = 0; L < 3; L++) s = buyUpgrade(s, 'coupe', 'eng');
    expect(s.cars.coupe.eng).toBe(3); expect(s.cash).toBe(100000 - SLOTS[0].price.reduce((a, b) => a + b, 0));
    expect(buyUpgrade(s, 'coupe', 'eng')).toBe(null); expect(buyUpgrade(s, 'kart', 'eng')).toBe(null);
    expect(buyUpgrade(newCareer('coupe'), 'coupe', 'tyr').cars.coupe.tyr).toBe(1);   // 1500 in the bank: just enough
    expect(SLOTS.map(u => u.id)).toEqual(['eng', 'tyr', 'sus', 'arm', 'aero', 'ram', 'cage']);
  });
  it('parts: the new slots change toughness, ram and grip; tyres swap kind for free, keeping their level', () => {
    let s = { ...newCareer('coupe'), cash: 100000 };
    for (const u of ['cage', 'ram', 'aero', 'tyr']) s = buyUpgrade(s, 'coupe', u);
    const p = careerPlayer(s);
    expect(p.veh.tough).toBeCloseTo(1.12); expect(p.veh.ram).toBeCloseTo(1.2); expect(p.veh.grip).toBeCloseTo(1.02 * 1.03); expect(p.veh.top).toBeCloseTo(0.995);
    expect(p.build).toEqual({ tyr: 1, aero: 1, ram: 1, cage: 1 });
    const g = fitTyres(s, 'coupe', 'gravel'), q = careerPlayer(g);
    expect(g.cash).toBe(s.cash); expect(g.cars.coupe.tyr).toBe(1); expect(q.veh.off).toBeCloseTo(1.03); expect(q.veh.grip).toBeCloseTo(1.02 * 1.01); expect(q.build.tyrKind).toBe('gravel');
    expect(fitTyres(g, 'coupe', 'gravel')).toBe(null); expect(fitTyres(g, 'coupe', 'road').cars.coupe.tyrKind).toBe(undefined);
  });
  it('the armoury: weapon levels per car (the signature weapon only on its own vehicle), gear bought once and swapped free; rivals and bosses are armed by tier', () => {
    expect(armoury('coupe')).toEqual(['missile', 'gun', 'oil', 'pulse', 'harpoon']); expect(armoury('firetruck')).toContain('water'); expect(armoury('coupe')).not.toContain('water');
    let s = { ...newCareer('coupe'), cash: 20000 };
    s = buyWeapon(s, 'coupe', 'gun'); expect(s.cars.coupe.wl.gun).toBe(2); expect(s.cash).toBe(17500);
    s = buyWeapon(s, 'coupe', 'gun'); expect(buyWeapon(s, 'coupe', 'gun')).toBe(null); expect(buyWeapon(s, 'coupe', 'water')).toBe(null);
    s = fitGear(s, 'coupe', 'shield'); const c1 = s.cash; s = fitGear(s, 'coupe', 'flares'); s = fitGear(s, 'coupe', 'shield');
    expect(s.cash).toBe(c1 - 3000); expect(s.cars.coupe.gear).toBe('shield');
    expect(careerPlayer(s).wpn).toEqual({ lv: { gun: 3 }, gear: 'shield' }); expect(careerPlayer(newCareer('coupe')).wpn).toBe(null);
    expect(careerField(TIERS[0].events[0])[0].wpn).toBe(null); expect(careerField(TIERS[3].events[0])[0].wpn.lv.missile).toBe(3);
    expect(careerField(TIERS.find(t => t.id === 'club').events.find(e => e.kind === 'boss'))[0].wpn.gear).toBe('shield');
  });
  it('a career saved before the parts (F5) loads as it was', () => {
    const old = { ...newCareer('coupe'), cars: { coupe: { eng: 2, tyr: 1, sus: 3, arm: 1, paint: 4 } } }, p = careerPlayer(old);
    expect(p.veh).toEqual(upgradedVeh('coupe', { eng: 2, tyr: 1, sus: 3, arm: 1 })); expect(p.build).toEqual({ eng: 2, tyr: 1, sus: 3, arm: 1 });
    expect(careerPlayer(newCareer('coupe')).build).toBe(null);
  });
});
describe('career races run', () => {
  // a Legend field on Thunder Falls: a rival falling in by the ferry once respawned at a fractional sample and the
  // race crashed (features/ferry.js); now it races to the flag
  it('a Legend round on Thunder Falls finishes', async () => {
    const M = await import('../src/core/index.js');
    const st = STAGES.find(s => s.name === 'Thunder Falls'), tr = M.buildTrack(st), W = { tr, terr: M.buildTerrain(tr, st), surf: st.surface, armco: !!st.armco };
    const s = { ...newCareer('police'), cars: { police: { eng: 3, tyr: 3, sus: 3, arm: 3 } } };
    let seed = 7; const rnd = Math.random; Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    try {
      const R = M.createRace(W, careerDefs(s, eventById('grand-tour')), { weapons: true }); R.phase = 'racing'; R.autoPlayer = true; R.player.ai.skill = 0.88;
      for (let t = 0; t < 400 && !R.player.finished; t += 1 / 120) M.raceStep(R, 1 / 120, W);
      expect(R.player.finished).toBe(true);
      for (const c of R.cars) expect(Number.isFinite(c.x) && Number.isFinite(c.z), c.name).toBe(true);
    } finally { Math.random = rnd; }
  }, 120000);
});
describe('career specials, bosses, paint', () => {
  it('every tier has a trial, a mode special, a one-make race and a boss; the final waits for the Legend boss', () => {
    for (const t of TIERS) for (const k of ['trial', 'mode', 'onemake', 'boss']) expect(t.events.some(e => e.kind === k), `${t.id} ${k}`).toBe(true);
    const fin = eventById('final'), s = newCareer('coupe');
    expect(eventOpen(s, fin)).toBe(false);
    const all = { ...s, beaten: { 'rookie-boss': true, 'club-boss': true, 'pro-boss': true, 'legend-boss': true } };
    expect(eventOpen(all, fin)).toBe(true);
    const f = careerField(fin); expect(f.length).toBe(CAREER_RIVALS);
    for (const b of TIERS.map(bossOf)) expect(f.some(d => d.name === b.driver && d.vehicle === b.vehicle), b.driver).toBe(true);
    const w = scoreRace(all, fin, 0, 1, 8, T0); expect(w.prize).toBe('limo'); expect(w.state.champion).toBe(true);
  });
  it('fields: a trial is alone, a mode special has three rivals, a boss one, a one-make race lends the car stock', () => {
    const s = { ...newCareer('coupe'), cars: { coupe: { eng: 3 } } };
    expect(careerDefs(s, eventById('park-sprint')).length).toBe(1);
    expect(careerDefs(s, eventById('rookie-king')).length).toBe(4);
    const b = careerDefs(s, eventById('club-boss')); expect(b.length).toBe(2); expect(b[0].name).toBe('Lindqvist'); expect(b[0].vehicle).toBe('wedge');
    const om = careerDefs(s, eventById('ice-cream-derby')); expect(om.every(d => d.vehicle === 'icecream')).toBe(true); expect(om.at(-1).veh).toEqual(om[0].veh);
  });
  it('time trials give stars by medal and keep the best time', () => {
    const ev = eventById('park-sprint'), [b, sv, g] = medals(ev.par), s = newCareer('coupe');
    expect(scoreRace(s, ev, 0, 1, 1, T0, g - 0.5).stars).toBe(7);
    expect(scoreRace(s, ev, 0, 1, 1, T0, sv - 0.1).stars).toBe(3);
    expect(scoreRace(s, ev, 0, 1, 1, T0, b - 0.1).stars).toBe(1);
    expect(scoreRace(s, ev, 0, 1, 1, T0, b + 5).stars).toBe(0);
    const r = scoreRace(s, ev, 0, 1, 1, T0, 50); expect(r.state.best['park-sprint']).toBe(50);
    expect(scoreRace(r.state, ev, 0, 1, 1, T0, 55).state.best['park-sprint']).toBe(50);
  });
  it('paint: costs a respray, stock again is -1, and the player wears it', () => {
    const s = { ...newCareer('coupe'), cash: 5000 }, p = paintCar(s, 'coupe', 2);
    expect(p.cash).toBe(5000 - PAINT_PRICE); expect(careerPlayer(p).color).toBe(PAINTS[2].color);
    expect(paintCar(p, 'coupe', 2)).toBe(null); expect(paintCar(p, 'kart', 1)).toBe(null);
    expect(paintCar(p, 'coupe', -1).cars.coupe.paint).toBe(undefined);
  });
});
