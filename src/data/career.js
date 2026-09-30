// Career (the menu's Career button; ui/career.js): start with one cheap car and climb four tiers, Rookie to Legend.
// Each tier is a set of events: cups (a few rounds raced for championship points, like a league) and one-off races.
// Every race pays cash by finishing place plus bonuses for style (big air, drift boosts, weapon hits, a clean run),
// and earns up to three stars: a podium, a win, and the race's own objective. Stars open the next tier. Cash buys cars.
// Rivals get quicker every tier (their skill is scaled), so the later tiers need a better car and better driving.
// Pure data and rules: the UI keeps the state in localStorage and calls these; tests/career.test.js checks them.
import { CAR_DEFS, MORE_RIVALS } from './cars.js';
import { vehicleById } from './vehicles.js';

export const CAREER_RIVALS = 7;
export const STARTERS = ['coupe', 'hatch', 'tuktuk'];
export const START_CASH = 1500;
/** Cars for sale: price and the tier whose showroom first sells them. */
export const SHOP = {
  tuktuk: { price: 2500, tier: 0 }, kart: { price: 3000, tier: 0 }, icecream: { price: 3000, tier: 0 }, sidecar: { price: 3500, tier: 0 },
  coupe: { price: 4000, tier: 0 }, hatch: { price: 4000, tier: 0 },
  buggy: { price: 9000, tier: 1 }, firetruck: { price: 10000, tier: 1 }, mixer: { price: 10000, tier: 1 }, rover: { price: 11000, tier: 1 },
  hotrod: { price: 12000, tier: 1 }, police: { price: 12000, tier: 1 },
  snowcat: { price: 18000, tier: 2 }, hover: { price: 20000, tier: 2 },
  monster: { price: 26000, tier: 2 }, wedge: { price: 30000, tier: 2 }, formula: { price: 38000, tier: 3 }, rocket: { price: 45000, tier: 3 }, limo: { price: 50000, tier: 3 },
};
export const PLACE_CASH = [1000, 750, 550, 400, 300, 220, 160, 120];
export const BONUS = { air: 30, drift: 20, hit: 15, clean: 150, obj: 250 };
export const TROPHY_CASH = [2500, 1500, 800];

// objectives: the third star of a race. n is a count over the whole race
const OBJ = {
  drift: n => ({ k: 'drift', n }), air: n => ({ k: 'air', n }), hits: n => ({ k: 'hits', n }), clean: () => ({ k: 'clean' }),
};
const { drift, air, hits, clean } = OBJ;
const R = (stage, obj) => ({ stage, obj });
export const TIERS = [
  { id: 'rookie', name: 'Rookie', blurb: 'Friendly locals on the easy roads', skill: 0.88, pay: 1, need: 0, events: [
    { id: 'rookie-cup', kind: 'cup', name: 'Rookie Cup', blurb: 'The four downhill stages, top to bottom', rounds: [R('Summit Meadow', drift(2)), R('Pine Forest', clean()), R('Quarry Run', air(2)), R('Village Descent', hits(3))] },
    { id: 'sunday-loops', kind: 'cup', name: 'Sunday Loops', blurb: 'Three short circuits to learn the lines', rounds: [R('Mountain Loop', drift(4)), R('Red Mesa Canyon', air(10)), R('Bogwood Rally', clean())] },
    { id: 'valley-run', kind: 'cup', name: 'Valley Run', blurb: 'Switchbacks, a town and a tunnel', rounds: [R('Pine Forest', hits(4)), R('Village Descent', drift(3)), R('Mountain Pass', clean())] },
  ] },
  { id: 'club', name: 'Club', blurb: 'Weekend racers who know the tracks', skill: 0.94, pay: 1.7, need: 15, events: [
    { id: 'circuit-series', kind: 'cup', name: 'Circuit Series', blurb: 'Switchbacks, viaducts, jumps and a waterfall', rounds: [R('Mountain Loop', hits(8)), R('Mountain Pass', drift(6)), R('Ravenrock Gorge', clean()), R('Red Mesa Canyon', air(12)), R('Thunder Falls', hits(8))] },
    { id: 'mud-snow', kind: 'cup', name: 'Mud & Snow', blurb: 'Loose surfaces all the way', rounds: [R('Quarry Run', air(3)), R('Bogwood Rally', air(8)), R('Frostpeak', drift(5)), R('Open Country', clean())] },
    { id: 'high-roads', kind: 'cup', name: 'High Roads', blurb: 'Tunnels, ledges and a spire', rounds: [R('Mountain Pass', hits(8)), R('Corkscrew Spire', drift(6)), R('Temple Ruins', clean())] },
  ] },
  { id: 'pro', name: 'Pro', blurb: 'Full-time drivers in sharp cars', skill: 0.97, pay: 2.6, need: 18, events: [
    { id: 'wild-cup', kind: 'cup', name: 'Wild Cup', blurb: 'The wildest tracks, each with a shortcut to find', rounds: [R('Corkscrew Spire', clean()), R('Scrapyard Smash', air(4)), R('Mesa Leap', air(4)), R('Temple Ruins', hits(8)), R('Glacier Rift', drift(5))] },
    { id: 'frozen-north', kind: 'cup', name: 'Frozen North', blurb: 'Snow, ice and open country', rounds: [R('Frostpeak', clean()), R('Glacier Rift', air(3)), R('Open Country', hits(6))] },
    { id: 'long-haul', kind: 'cup', name: 'Long Haul', blurb: 'The big circuits', rounds: [R('Ravenrock Gorge', hits(12)), R('Flyover Tangle', drift(8)), R('Thunder Falls', clean())] },
  ] },
  { id: 'legend', name: 'Legend', blurb: 'The best in the mountains', skill: 1, pay: 3.8, need: 18, events: [
    { id: 'grand-tour', kind: 'cup', name: 'Grand Tour', blurb: 'Six of the best, back to back', rounds: [R('Mountain Pass', clean()), R('Ravenrock Gorge', hits(12)), R('Thunder Falls', drift(6)), R('Bogwood Rally', air(10)), R('Glacier Rift', clean()), R('Temple Ruins', hits(10))] },
    { id: 'dirt-masters', kind: 'cup', name: 'Dirt Masters', blurb: 'Gravel, mud and snow, flat out', rounds: [R('Quarry Run', clean()), R('Bogwood Rally', drift(6)), R('Frostpeak', hits(10)), R('Open Country', air(2)), R('Glacier Rift', drift(6))] },
    { id: 'top-speed', kind: 'cup', name: 'Top Speed', blurb: 'Fast roads for fast cars', rounds: [R('Summit Meadow', clean()), R('Mountain Loop', drift(8)), R('Flyover Tangle', hits(12)), R('Mesa Leap', air(5)), R('Corkscrew Spire', clean())] },
  ] },
];
export const tierById = id => TIERS.find(t => t.id === id);
export const eventById = id => { for (const t of TIERS) { const e = t.events.find(e => e.id === id); if (e) return e; } return null; };
export const tierOf = ev => TIERS.findIndex(t => t.events.includes(ev));
export const roundsOf = ev => ev.rounds || [{ stage: ev.stage, obj: ev.obj }];

// ---------- the state ----------
/** A fresh career: the starter car, a little cash, nothing raced. */
export function newCareer(starter) {
  return { v: 1, cash: START_CASH, car: starter, cars: { [starter]: {} }, stars: {}, cups: {}, trophies: {}, races: 0, wins: 0, earned: 0 };
}
const starKey = (ev, k) => ev.id + ':' + k;
const bits = m => (m & 1) + (m >> 1 & 1) + (m >> 2 & 1);
/** Stars earned on round k of event ev (0..3), and as a bit mask (1 podium, 2 win, 4 objective). */
export const roundStars = (s, ev, k) => bits(s.stars[starKey(ev, k)] || 0);
export const roundMask = (s, ev, k) => s.stars[starKey(ev, k)] || 0;
export const eventStars = (s, ev) => roundsOf(ev).reduce((a, _, k) => a + roundStars(s, ev, k), 0);
export const eventMaxStars = ev => roundsOf(ev).length * 3;
export const tierStars = (s, t) => t.events.reduce((a, ev) => a + eventStars(s, ev), 0);
export const tierMaxStars = t => t.events.reduce((a, ev) => a + eventMaxStars(ev), 0);
export const totalStars = s => TIERS.reduce((a, t) => a + tierStars(s, t), 0);
/** Tier i is open once the tier below has `need` stars. */
export const tierOpen = (s, i) => i === 0 || tierStars(s, TIERS[i - 1]) >= TIERS[i].need;
/** The highest open tier. */
export const topTier = s => { let i = 0; while (i + 1 < TIERS.length && tierOpen(s, i + 1)) i++; return i; };
/** Cars you can buy now: sold in an open tier's showroom and not already yours. */
export const forSale = s => Object.keys(SHOP).filter(id => SHOP[id].tier <= topTier(s) && !s.cars[id]);
export function buyCar(s, id) {
  const p = SHOP[id]; if (!p || s.cars[id] || p.tier > topTier(s) || s.cash < p.price) return null;
  return { ...s, cash: s.cash - p.price, cars: { ...s.cars, [id]: {} }, car: id };
}
export const selectCar = (s, id) => s.cars[id] ? { ...s, car: id } : s;

// ---------- the field ----------
// every AI driver with the vehicle they own (the classic four's cars are the hatch, wedge and buggy)
const OWN = { Okafor: 'hatch', Lindqvist: 'wedge', Vasquez: 'buggy' };
export const DRIVERS = [...CAR_DEFS.filter(d => !d.player).map(d => ({ ...d, vehicle: OWN[d.name] })), ...MORE_RIVALS];
const hash = str => { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
/** A vehicle entry as a race def: its body, livery, hitbox and handling (`skin` gives the livery instead). */
const asDef = (d, v, skin = v) => ({ name: d.name, num: d.num, skill: d.skill, flick: d.flick, driftK: d.driftK, player: d.player, model: v.model, color: skin.color, accent: skin.accent, hw: v.hw, hl: v.hl, im: v.veh ? v.veh.im : undefined, veh: v.veh, vehicle: v.id });
/** The cars that belong in a tier: sold in its showroom or below. */
export const tierCars = ti => Object.keys(SHOP).filter(id => SHOP[id].tier <= ti);
/** The AI field for one round of an event: CAREER_RIVALS drivers in cars that belong in the tier (their own if it
 *  does, else one from the tier in their own livery), each at the tier's skill. Always the same for a given event. */
export function careerField(ev, ti = tierOf(ev)) {
  const T = TIERS[ti], ok = tierCars(ti), order = DRIVERS.slice().sort((a, b) => hash(ev.id + a.name) - hash(ev.id + b.name));
  const own = order.filter(d => ok.includes(d.vehicle)), rest = order.filter(d => !ok.includes(d.vehicle));
  const pick = [...own, ...rest].slice(0, CAREER_RIVALS);
  return pick.map((d, k) => {
    const v = vehicleById(ok.includes(d.vehicle) ? d.vehicle : ok[hash(ev.id + k) % ok.length]);
    return { ...asDef(d, v, vehicleById(d.vehicle)), skill: Math.min(1, d.skill * T.skill) };
  });
}
/** The player's race def in career car `id`. */
export function careerPlayer(s, id = s.car) { const coupe = CAR_DEFS.find(d => d.player); return asDef(coupe, vehicleById(id)); }
/** Race defs for a round: the field, then the player at the back of the grid (from round 2 of a cup the grid lines up
 *  in reverse championship order: `order` is the championship order, best first). */
export function careerDefs(s, ev, order = null) {
  let defs = [...careerField(ev), careerPlayer(s)];
  if (order) { const rank = n => { const i = order.indexOf(n); return i < 0 ? 99 : i; }; defs = defs.slice().sort((a, b) => rank(b.name) - rank(a.name)); }
  return defs;
}

// ---------- scoring a race ----------
export const objDone = (o, t) => o.k === 'clean' ? t.wrecks === 0 && t.respawns === 0 : (t[o.k] || 0) >= o.n;
export function objText(o) {
  const pl = (n, a, b = a + 's') => `${n} ${n === 1 ? a : b}`;
  return o.k === 'clean' ? 'A clean race: no wrecks, no resets' : o.k === 'drift' ? `${pl(o.n, 'drift boost')}` : o.k === 'air' ? `${pl(o.n, 'big air')}` : o.k === 'hits' ? `Hit rivals ${pl(o.n, 'time')} with weapons` : '';
}
/** The top places that count as a podium in a field of n (top 3 of 8, top 2 of 4, only a win in a duel). */
export const podiumOf = n => Math.max(1, Math.min(3, Math.floor(n / 2)));
/**
 * Score round k of event ev: `place` of `n` cars, `t` the player's tally { air, drift, hits, wrecks, respawns }.
 * Returns { state, stars (mask this race), fresh (mask of newly earned stars), cash, lines: [[label, amount]] }.
 */
export function scoreRace(s, ev, k, place, n, t) {
  const T = TIERS[tierOf(ev)], o = roundsOf(ev)[k].obj, pay = x => Math.round(x * T.pay / 10) * 10;
  const mask = (place <= podiumOf(n) ? 1 : 0) | (place === 1 ? 2 : 0) | (objDone(o, t) ? 4 : 0);
  const had = roundMask(s, ev, k), fresh = mask & ~had;
  const lines = [[`${ordinal(place)} place`, pay(PLACE_CASH[place - 1] || 0)]];
  if (t.air) lines.push([`Big air ×${t.air}`, pay(BONUS.air * t.air)]);
  if (t.drift) lines.push([`Drift boosts ×${t.drift}`, pay(BONUS.drift * t.drift)]);
  if (t.hits) lines.push([`Weapon hits ×${t.hits}`, pay(BONUS.hit * t.hits)]);
  if (t.wrecks === 0 && t.respawns === 0) lines.push(['Clean race', pay(BONUS.clean)]);
  if (mask & 4) lines.push(['Objective', pay(BONUS.obj)]);
  const cash = lines.reduce((a, l) => a + l[1], 0);
  const state = { ...s, cash: s.cash + cash, earned: s.earned + cash, races: s.races + 1, wins: s.wins + (place === 1 ? 1 : 0), stars: { ...s.stars, [starKey(ev, k)]: had | mask } };
  return { state, stars: mask, fresh, cash, lines };
}
/** A finished cup's trophy (place 1..3, else 0) pays out once per step up: a later gold after a bronze pays the difference. */
export function awardTrophy(s, ev, place) {
  const prev = s.trophies[ev.id] || 0, T = TIERS[tierOf(ev)], val = p => p >= 1 && p <= 3 ? Math.round(TROPHY_CASH[p - 1] * T.pay / 10) * 10 : 0;
  if (!val(place) || (prev && prev <= place)) return { state: s, cash: 0 };
  const cash = val(place) - (prev ? val(prev) : 0);
  return { state: { ...s, cash: s.cash + cash, earned: s.earned + cash, trophies: { ...s.trophies, [ev.id]: place } }, cash };
}
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
