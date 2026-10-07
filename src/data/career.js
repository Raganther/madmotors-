// Career (the menu's Career button; ui/career.js): start with one cheap car and climb four tiers, Rookie to Legend.
// Each tier is a set of events: cups (a few rounds raced for championship points, like a league) and one-off races.
// Every race pays cash by finishing place plus bonuses for style (big air, drift boosts, weapon hits, a clean run),
// and earns up to three stars: a podium, a win, and the race's own objective. Cash buys cars, upgrades and paint.
// Each tier also has specials (a time trial for medals, a Showdown or checkpoint match, a one-make race where everyone
// drives the same car) and ends with a boss: a duel with a star driver in their signature car. Enough stars in a tier
// open its boss; beating the boss wins you their car and opens the next tier. Beat the Legend boss and the final,
// Champion of Champions, puts you up against every boss at once.
// Rivals get quicker every tier (their skill is scaled, and their cars carry the tier's upgrade level), so the later
// tiers need upgrades (the part slots of data/parts.js: engine, tyres, suspension, armour, aero, ram bar, roll cage), a better car and better driving. Some cups are
// for one discipline (Road, Rally, Off-road, Heavy, Oddball, Derby: data/disciplines.js), so it pays to own more than one.
// Pure data and rules: the UI keeps the state in localStorage and calls these; tests/career.test.js checks them.
import { CAR_DEFS, MORE_RIVALS } from './cars.js';
import { vehicleById } from './vehicles.js';
import { entryOK } from './disciplines.js';
import { PART_MAX, TYRE_KINDS, buildOf, buildVeh, slotById } from './parts.js';
import { GEAR, GEAR_PRICE, SIGNATURES, WEAPONS, WEAPON_IDS, WEAPON_MAX, WEAPON_PRICE, loadoutOf } from './weapons.js';

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
// ---------- entry (disciplines) and upgrades ----------
const STD = { accel: 1, top: 1, grip: 1, off: 1, im: 1 };
const base = id => vehicleById(id).veh || STD;
/** Can car id (with build b: its parts, data/parts.js) enter event ev? Its entry is { disc, maxPace?, maxTough? }
 *  (data/disciplines.js); an event without a disc is open to all. */
export const allowed = (ev, id, b) => entryOK(ev, id, b);
/** A vehicle's handling with upgrade levels `lv` (a build: data/parts.js; none = stock). */
export const upgradedVeh = (id, lv) => buildVeh(base(id), lv);
/** Respray car id in paint p (an index into PAINTS; -1 = its stock livery). */
export function paintCar(s, id, p) {
  if (!s.cars[id] || s.cash < PAINT_PRICE || (s.cars[id].paint ?? -1) === p) return null;
  const own = { ...s.cars[id] }; if (p < 0) delete own.paint; else own.paint = p;
  return { ...s, cash: s.cash - PAINT_PRICE, cars: { ...s.cars, [id]: own } };
}
export const upgLevel = (s, id, u) => (s.cars[id] && s.cars[id][u]) || 0;
/** Buy the next level of part slot u (data/parts.js SLOTS) for car id, or null (not yours, maxed, not enough cash). */
export function buyUpgrade(s, id, u) {
  const L = upgLevel(s, id, u), slot = slotById(u), p = slot && slot.price[L];
  if (!s.cars[id] || !slot || L >= PART_MAX || s.cash < p) return null;
  return { ...s, cash: s.cash - p, cars: { ...s.cars, [id]: { ...s.cars[id], [u]: L + 1 } } };
}
/** Swap car id's tyres to kind k (data/parts.js TYRE_KINDS): free, the level carries over. */
export function fitTyres(s, id, k) {
  if (!s.cars[id] || !TYRE_KINDS[k] || (s.cars[id].tyrKind || 'road') === k) return null;
  const own = { ...s.cars[id] }; if (k === 'road') delete own.tyrKind; else own.tyrKind = k;
  return { ...s, cars: { ...s.cars, [id]: own } };
}

// ---------- the armoury (data/weapons.js): weapon levels and gear, per car ----------
/** The weapons car id can level up: the five everyone finds, and its own signature weapon. */
export const armoury = id => WEAPON_IDS.filter(w => !WEAPONS[w].sig || SIGNATURES[id] === w);
export const weaponLevel = (s, id, w) => Math.max(1, (s.cars[id] && s.cars[id].wl && s.cars[id].wl[w]) || 1);
/** Buy the next level of weapon w for car id, or null. */
export function buyWeapon(s, id, w) {
  const L = weaponLevel(s, id, w), p = WEAPON_PRICE[L];
  if (!s.cars[id] || !armoury(id).includes(w) || L >= WEAPON_MAX || s.cash < p) return null;
  const own = s.cars[id]; return { ...s, cash: s.cash - p, cars: { ...s.cars, [id]: { ...own, wl: { ...(own.wl || {}), [w]: L + 1 } } } };
}
/** Gear g on car id: bought the first time (GEAR_PRICE), fitted free after that; fitting the fitted one takes it off. */
export function fitGear(s, id, g) {
  const own = s.cars[id]; if (!own || !GEAR[g]) return null;
  const has = (own.gears || []).includes(g); if (!has && s.cash < GEAR_PRICE) return null;
  const next = { ...own, gears: has ? own.gears : [...(own.gears || []), g] }; if (own.gear === g) delete next.gear; else next.gear = g;
  return { ...s, cash: s.cash - (has ? 0 : GEAR_PRICE), cars: { ...s.cars, [id]: next } };
}
// rivals' weapons: the tier's upgrade level (Pro 2, Legend 3) on all of them; bosses carry a shield too
const rivalLoad = (L, gear) => { const lv = L > 1 ? Object.fromEntries(WEAPON_IDS.map(w => [w, Math.min(WEAPON_MAX, L)])) : null; return lv || gear ? { ...(lv ? { lv } : {}), ...(gear ? { gear } : {}) } : null; };

export const PLACE_CASH = [1000, 750, 550, 400, 300, 220, 160, 120];
export const BONUS = { air: 30, drift: 20, hit: 15, clean: 150, obj: 250 };
export const TROPHY_CASH = [2500, 1500, 800];
export const MEDAL_CASH = [450, 700, 1000];   // time trial: bronze, silver, gold
export const DUEL_GAP = 5;   // a duel (a boss): the first star for finishing this close behind (seconds)
export const BOSS_PURSE = 3000, FINAL_PURSE = 25000, PAINT_PRICE = 800;
/** A time trial's medal times from its gold `par` (seconds): bronze, silver, gold. */
export const medals = par => [par * 1.1, par * 1.05, par].map(x => Math.round(x * 10) / 10);
/** Paint jobs for the garage's paint shop: body colour and accent. */
export const PAINTS = [
  { name: 'Race Red', color: 0xD7261E, accent: 0xF4F4F0 }, { name: 'Sunburst', color: 0xFFC72C, accent: 0x1C2340 }, { name: 'Gulf', color: 0x8FC5E8, accent: 0xF08A24 },
  { name: 'British Green', color: 0x1F5B3A, accent: 0xE8D9A8 }, { name: 'Midnight', color: 0x151823, accent: 0xE8C35A }, { name: 'Lime', color: 0x9BE22E, accent: 0x1A1A1A },
  { name: 'Candy Pink', color: 0xF46FAE, accent: 0xFFFFFF }, { name: 'Arctic', color: 0xEEF3F7, accent: 0x2F7DE0 }, { name: 'Copper', color: 0xB8643A, accent: 0x2A1E17 },
  { name: 'Violet', color: 0x7A3FD1, accent: 0xFFD21F }, { name: 'Gunmetal', color: 0x4A5058, accent: 0xFF5A1E }, { name: 'Champion Gold', color: 0xD9B44A, accent: 0x16161A },
];

// objectives: the third star of a race. n is a count over the whole race
const OBJ = {
  drift: n => ({ k: 'drift', n }), air: n => ({ k: 'air', n }), hits: n => ({ k: 'hits', n }), clean: () => ({ k: 'clean' }),
};
const { drift, air, hits, clean } = OBJ;
const R = (stage, obj) => ({ stage, obj });
// the specials and the boss of a tier: single races
const trial = (id, name, stage, par) => ({ id, kind: 'trial', name, blurb: 'Alone against the clock: bronze, silver and gold times', stage, par });
const mode = (id, m, name, stage, obj, blurb) => ({ id, kind: 'mode', mode: m, name, blurb, stage, obj });
const onemake = (id, make, name, stage, obj, blurb) => ({ id, kind: 'onemake', make, name, blurb, stage, obj });
const boss = (id, driver, vehicle, stage, need, obj, blurb) => ({ id, kind: 'boss', driver, vehicle, name: `Boss: ${driver}`, blurb, stage, need, obj });
export const TIERS = [
  { id: 'rookie', name: 'Rookie', blurb: 'Friendly locals on the easy roads', skill: 0.88, upg: 0, pay: 1, events: [
    { id: 'rookie-cup', kind: 'cup', name: 'Rookie Cup', blurb: 'Four easy tracks: steering, drifting, dirt and jumps, then weapons', rounds: [R('Sunday Park', clean()), R('Harbour Sprint', drift(4)), R('Hay Bale Farm', air(3)), R('Village Green', hits(3))] },
    { id: 'sunday-loops', kind: 'cup', name: 'Sunday Loops', blurb: 'Three short circuits to learn the lines', rounds: [R('Mountain Loop', drift(4)), R('Red Mesa Canyon', air(10)), R('Bogwood Rally', clean())] },
    { id: 'seaside-double', kind: 'cup', name: 'Seaside Double', blurb: 'The park, the harbour and the farm again, a little sharper', rounds: [R('Harbour Sprint', hits(3)), R('Hay Bale Farm', clean()), R('Sunday Park', drift(3))] },
    trial('park-sprint', 'Park Sprint', 'Sunday Park', 78.4),
    mode('rookie-king', 'showdown', 'King of the Loop', 'Mountain Loop', drift(3), 'Showdown against three rivals: hold the lead to bank crown time'),
    onemake('ice-cream-derby', 'icecream', 'Ice Cream Derby', 'Village Green', hits(3), 'Everyone in an Ice Cream Van round the fete: pure driving'),
    boss('rookie-boss', 'Brannigan', 'monster', 'Red Mesa Canyon', 20, air(10), 'One on one with the Monster Truck over the jumps. Win it and it\'s yours'),
    { id: 'pocket-rockets', kind: 'cup', disc: 'oddball', name: 'Pocket Rockets', blurb: 'Oddballs only: karts, trikes, bikes and vans', rounds: [R('Sunday Park', hits(3)), R('Harbour Sprint', drift(4)), R('Village Green', clean())] },
  ] },
  { id: 'club', name: 'Club', blurb: 'Weekend racers who know the tracks', skill: 0.94, upg: 1, pay: 1.7, events: [
    { id: 'circuit-series', kind: 'cup', name: 'Circuit Series', blurb: 'Switchbacks, viaducts, jumps and a waterfall', rounds: [R('Mountain Loop', hits(8)), R('Mountain Pass', drift(6)), R('Ravenrock Gorge', clean()), R('Red Mesa Canyon', air(12)), R('Thunder Falls', hits(8))] },
    { id: 'mud-snow', kind: 'cup', disc: 'offroad', name: 'Mud & Snow', blurb: 'Loose surfaces all the way: off-road cars only', rounds: [R('Quarry Run', air(3)), R('Bogwood Rally', air(8)), R('Frostpeak', drift(5)), R('Open Country', clean())] },
    { id: 'high-roads', kind: 'cup', name: 'High Roads', blurb: 'Tunnels, ledges and a spire', rounds: [R('Mountain Pass', hits(8)), R('Corkscrew Spire', drift(6)), R('Temple Ruins', clean())] },
    trial('frost-attack', 'Frostpeak Time Attack', 'Frostpeak', 116.7),
    mode('falls-deuce', 'deuce', 'Deuce at the Falls', 'Thunder Falls', hits(4), 'Checkpoints, first to 4, win by two'),
    onemake('kart-chaos', 'kart', 'Kart Chaos', 'Corkscrew Spire', drift(4), 'Eight Go-Karts round the spire'),
    boss('club-boss', 'Lindqvist', 'wedge', 'Ravenrock Gorge', 26, clean(), 'The Group B ace on the viaducts. Beat Lindqvist and the Wedge is yours'),
    { id: 'downhill-classic', kind: 'cup', name: 'Downhill Classic', blurb: 'The four original downhill runs, top to bottom: fast, steep and unforgiving', rounds: [R('Summit Meadow', drift(2)), R('Pine Forest', clean()), R('Quarry Run', air(2)), R('Village Descent', hits(4))] },
    { id: 'heavyweights', kind: 'cup', disc: 'heavy', name: 'Heavyweights', blurb: 'Trucks, vans and limos: the biggest wins', rounds: [R('Village Descent', hits(4)), R('Scrapyard Smash', air(3)), R('Mountain Pass', clean())] },
  ] },
  { id: 'pro', name: 'Pro', blurb: 'Full-time drivers in sharp cars', skill: 0.97, upg: 2, pay: 2.6, events: [
    { id: 'wild-cup', kind: 'cup', name: 'Wild Cup', blurb: 'The wildest tracks, each with a shortcut to find', rounds: [R('Corkscrew Spire', clean()), R('Scrapyard Smash', air(4)), R('Mesa Leap', air(4)), R('Temple Ruins', hits(8)), R('Glacier Rift', drift(5))] },
    { id: 'frozen-north', kind: 'cup', disc: 'offroad', name: 'Frozen North', blurb: 'Snow, ice and open country: off-road cars only', rounds: [R('Frostpeak', clean()), R('Glacier Rift', air(3)), R('Open Country', hits(6))] },
    { id: 'long-haul', kind: 'cup', name: 'Long Haul', blurb: 'The big circuits', rounds: [R('Ravenrock Gorge', hits(12)), R('Flyover Tangle', drift(8)), R('Thunder Falls', clean())] },
    trial('mesa-attack', 'Mesa Time Attack', 'Mesa Leap', 114.3),
    mode('mesa-showdown', 'showdown', 'Mesa Showdown', 'Red Mesa Canyon', air(6), 'King of the Hill over the mesa jumps'),
    onemake('monster-mash', 'monster', 'Monster Mash', 'Scrapyard Smash', hits(6), 'Eight Monster Trucks in the scrapyard'),
    boss('pro-boss', 'Moreau', 'formula', 'Flyover Tangle', 28, drift(6), 'The Formula Racer through the flyovers. Win and it\'s yours'),
    { id: 'tarmac-gp', kind: 'cup', disc: 'road', name: 'Tarmac GP', blurb: 'Road cars on the smoothest circuits', rounds: [R('Mountain Loop', drift(6)), R('Flyover Tangle', hits(10)), R('Corkscrew Spire', clean()), R('Summit Meadow', drift(2))] },
  ] },
  { id: 'legend', name: 'Legend', blurb: 'The best in the mountains', skill: 0.98, upg: 3, pay: 3.8, events: [
    { id: 'grand-tour', kind: 'cup', name: 'Grand Tour', blurb: 'Six of the best, back to back', rounds: [R('Mountain Pass', clean()), R('Ravenrock Gorge', hits(12)), R('Thunder Falls', drift(6)), R('Bogwood Rally', air(10)), R('Glacier Rift', clean()), R('Temple Ruins', hits(10))] },
    { id: 'dirt-masters', kind: 'cup', disc: 'offroad', name: 'Dirt Masters', blurb: 'Gravel, mud and snow, flat out: off-road cars only', rounds: [R('Quarry Run', clean()), R('Bogwood Rally', drift(6)), R('Frostpeak', hits(10)), R('Open Country', air(2)), R('Glacier Rift', drift(6))] },
    { id: 'top-speed', kind: 'cup', disc: 'road', name: 'Top Speed', blurb: 'Fast roads for fast tarmac cars', rounds: [R('Summit Meadow', clean()), R('Mountain Loop', drift(8)), R('Flyover Tangle', hits(12)), R('Mesa Leap', air(5)), R('Corkscrew Spire', clean())] },
    trial('flyover-attack', 'Flyover Time Attack', 'Flyover Tangle', 147.7),
    mode('legend-tiebreak', 'tiebreak', 'Legend Tiebreak', 'Temple Ruins', hits(6), 'Checkpoints, first to 7, win by two'),
    onemake('rocket-run', 'rocket', 'Rocket Run', 'Summit Meadow', clean(), 'Eight Rocket Cars down the mountain'),
    boss('legend-boss', 'Achterberg', 'rocket', 'Thunder Falls', 30, clean(), 'The Rocket Car at the falls. Beat Achterberg and the rocket is yours'),
    { id: 'final', kind: 'final', name: 'Champion of Champions', blurb: 'Every boss at once, fully upgraded. Win it for the gold limo and the title', stage: 'Mountain Pass', obj: clean() },
  ] },
];
export const tierById = id => TIERS.find(t => t.id === id);
export const eventById = id => { for (const t of TIERS) { const e = t.events.find(e => e.id === id); if (e) return e; } return null; };
export const tierOf = ev => TIERS.findIndex(t => t.events.includes(ev));
export const roundsOf = ev => ev.rounds || [{ stage: ev.stage, obj: ev.obj }];

// ---------- the state ----------
/** A fresh career: the starter car, a little cash, nothing raced. */
export function newCareer(starter) {
  return { v: 1, cash: START_CASH, car: starter, cars: { [starter]: {} }, stars: {}, cups: {}, trophies: {}, beaten: {}, best: {}, races: 0, wins: 0, earned: 0 };
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
export const bossOf = t => t.events.find(e => e.kind === 'boss');
export const beaten = (s, ev) => !!(s.beaten && s.beaten[ev.id]);
/** Tier i is open once the boss of the tier below is beaten. */
export const tierOpen = (s, i) => i === 0 || beaten(s, bossOf(TIERS[i - 1]));
/** Can event ev be raced yet? A boss wants its `need` stars in the tier, the final the Legend boss beaten. */
export function eventOpen(s, ev) {
  const ti = tierOf(ev); if (!tierOpen(s, ti)) return false;
  if (ev.kind === 'boss') return tierStars(s, TIERS[ti]) >= ev.need || beaten(s, ev);
  if (ev.kind === 'final') return beaten(s, bossOf(TIERS[ti]));
  return true;
}
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
/** The AI field for one round of an event: CAREER_RIVALS drivers in cars that belong in the tier and the event's
 *  class (their own if it does, else one from the tier in their own livery), each at the tier's skill with the
 *  tier's upgrades on engine, tyres and suspension. Always the same for a given event. */
export function careerField(ev, ti = tierOf(ev)) {
  const T = TIERS[ti];
  if (ev.kind === 'trial') return [];
  if (ev.kind === 'boss') return [bossDef(ev.driver, ev.vehicle, T.upg, T.skill)];
  if (ev.kind === 'final') {
    const bosses = TIERS.map(bossOf).map(b => bossDef(b.driver, b.vehicle, PART_MAX, T.skill)), rest = DRIVERS.filter(d => !bosses.some(b => b.name === d.name) && ['limo', 'police', 'hover'].includes(d.vehicle));
    return [...bosses, ...rest.map(d => bossDef(d.name, d.vehicle, PART_MAX, T.skill))];
  }
  const field = cupField(ev, T, ti);
  if (ev.kind === 'mode') return field.slice(0, 3);
  if (ev.kind === 'onemake') { const v = vehicleById(ev.make); return field.map(d => ({ ...d, model: v.model, hw: v.hw, hl: v.hl, veh: v.veh, im: v.veh ? v.veh.im : undefined, vehicle: v.id, build: null })); }   // stock cars
  return field;
}
// a star driver in their car, a notch sharper than the tier (skill `k`) and upgraded to `L`
function bossDef(name, vehicle, L, k) {
  const d = DRIVERS.find(x => x.name === name), lv = { eng: L, tyr: L, sus: L }, veh = upgradedVeh(vehicle, lv);
  return { ...asDef(d, vehicleById(vehicle)), skill: Math.min(1, d.skill * k + 0.02), veh, im: veh.im, build: buildOf(lv), wpn: rivalLoad(L, 'shield') };
}
function cupField(ev, T, ti) {
  const lv = { eng: T.upg, tyr: T.upg, sus: T.upg }, ok = tierCars(ti).filter(id => allowed(ev, id, buildOf(lv))), order = DRIVERS.slice().sort((a, b) => hash(ev.id + a.name) - hash(ev.id + b.name));
  const own = order.filter(d => ok.includes(d.vehicle)), rest = order.filter(d => !ok.includes(d.vehicle));
  const pick = [...own, ...rest].slice(0, CAREER_RIVALS);
  return pick.map((d, k) => {
    const v = vehicleById(ok.includes(d.vehicle) ? d.vehicle : ok[hash(ev.id + k) % ok.length]);
    const veh = upgradedVeh(v.id, lv);
    return { ...asDef(d, v, vehicleById(d.vehicle)), skill: Math.min(1, d.skill * T.skill), veh, im: veh.im, build: buildOf(lv), wpn: rivalLoad(T.upg) };   // their parts show
  });
}
/** The player's race def in career car `id`, with its upgrades and paint (a one-make race: its car, stock). */
export function careerPlayer(s, id = s.car, ev = null) {
  const coupe = CAR_DEFS.find(d => d.player);
  if (ev && ev.make) return asDef(coupe, vehicleById(ev.make));
  const own = s.cars[id] || {}, veh = upgradedVeh(id, own), paint = PAINTS[own.paint];
  return { ...asDef(coupe, vehicleById(id), paint || vehicleById(id)), veh, im: veh.im, build: buildOf(own), wpn: loadoutOf(own) };
}
/** Can the player race event ev in their current car? (One-make races lend you the car.) */
export const canEnter = (s, ev) => !!ev.make || allowed(ev, s.car, buildOf(s.cars[s.car]));
/** Race defs for a round: the field, then the player at the back of the grid (from round 2 of a cup the grid lines up
 *  in reverse championship order: `order` is the championship order, best first). */
export function careerDefs(s, ev, order = null) {
  let defs = [...careerField(ev), careerPlayer(s, s.car, ev)];
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
 * Score round k of event ev: `place` of `n` cars, `t` the player's tally { air, drift, hits, wrecks, respawns, gap }
 * (gap: seconds behind the winner, for a duel), `time` the player's finish time (a time trial).
 * Returns { state, stars (mask this race), fresh (mask of newly earned stars), cash, lines: [[label, amount]] }.
 */
export function scoreRace(s, ev, k, place, n, t, time = 0) {
  const T = TIERS[tierOf(ev)], o = roundsOf(ev)[k].obj, pay = x => Math.round(x * T.pay / 10) * 10;
  let mask, lines;
  if (ev.kind === 'trial') {   // stars by medal: bronze 1, silver 2, gold 3
    const m = medals(ev.par), got = time > 0 ? m.filter(x => time <= x).length : 0;
    mask = [0, 1, 3, 7][got]; lines = got ? [[`${['Bronze', 'Silver', 'Gold'][got - 1]} medal`, pay(MEDAL_CASH[got - 1])]] : [['No medal', 0]];
  } else {
    const near = n === 2 ? place === 1 || (t.gap >= 0 && t.gap <= DUEL_GAP) : place <= podiumOf(n);   // a duel's first star: close behind
    mask = (near ? 1 : 0) | (place === 1 ? 2 : 0) | (objDone(o, t) ? 4 : 0);
    lines = [[`${ordinal(place)} place`, pay(PLACE_CASH[place - 1] || 0)]];
  }
  const had = roundMask(s, ev, k), fresh = mask & ~had;
  if (t.air) lines.push([`Big air ×${t.air}`, pay(BONUS.air * t.air)]);
  if (t.drift) lines.push([`Drift boosts ×${t.drift}`, pay(BONUS.drift * t.drift)]);
  if (t.hits) lines.push([`Weapon hits ×${t.hits}`, pay(BONUS.hit * t.hits)]);
  if (t.wrecks === 0 && t.respawns === 0) lines.push(['Clean race', pay(BONUS.clean)]);
  if (mask & 4 && ev.kind !== 'trial') lines.push(['Objective', pay(BONUS.obj)]);
  // a boss or the final won for the first time: the purse and the prize car
  const won = place === 1 && (ev.kind === 'boss' || ev.kind === 'final') && !beaten(s, ev), prize = won ? (ev.kind === 'final' ? 'limo' : ev.vehicle) : null;
  if (won) lines.push([ev.kind === 'final' ? 'Champion\'s purse' : 'Boss purse', ev.kind === 'final' ? FINAL_PURSE : pay(BOSS_PURSE)]);
  const cash = lines.reduce((a, l) => a + l[1], 0);
  let state = { ...s, cash: s.cash + cash, earned: s.earned + cash, races: s.races + 1, wins: s.wins + (place === 1 ? 1 : 0), stars: { ...s.stars, [starKey(ev, k)]: had | mask } };
  if (won) state = { ...state, beaten: { ...(s.beaten || {}), [ev.id]: true }, cars: s.cars[prize] ? state.cars : { ...state.cars, [prize]: {} }, champion: s.champion || ev.kind === 'final' };
  if (ev.kind === 'trial' && time > 0 && !(s.best && s.best[ev.id] <= time)) state = { ...state, best: { ...(s.best || {}), [ev.id]: time } };
  return { state, stars: mask, fresh, cash, lines, prize };
}
/** A finished cup's trophy (place 1..3, else 0) pays out once per step up: a later gold after a bronze pays the difference. */
export function awardTrophy(s, ev, place) {
  const prev = s.trophies[ev.id] || 0, T = TIERS[tierOf(ev)], val = p => p >= 1 && p <= 3 ? Math.round(TROPHY_CASH[p - 1] * T.pay / 10) * 10 : 0;
  if (!val(place) || (prev && prev <= place)) return { state: s, cash: 0 };
  const cash = val(place) - (prev ? val(prev) : 0);
  return { state: { ...s, cash: s.cash + cash, earned: s.earned + cash, trophies: { ...s.trophies, [ev.id]: place } }, cash };
}
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
