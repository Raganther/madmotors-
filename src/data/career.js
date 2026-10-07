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
// Career v2 (G5): every tier runs a Road, a Rally, an Off-road and a Derby series and an Oddball cup (SERIES; the low
// tiers cap their pace band), and the bosses race on their own tracks. Past Legend, the Elite tier is a season (points
// from every Elite race, a title at the end) against fields of twelve whose cars are rated against yours, with drivers
// who block and drivers who bomb, and a nemesis who turns up everywhere. Then prestige: start again, keep the garage,
// harder rivals and better pay.
// Pure data and rules: the UI keeps the state in localStorage and calls these; tests/career.test.js checks them.
import { CAR_DEFS, MORE_RIVALS } from './cars.js';
import { vehicleById } from './vehicles.js';
import { entryOK } from './disciplines.js';
import { FORMATS, RACE_PTS, formatOf } from './formats.js';
import { BONUS, BOSS_PURSE, DESTRUCT_CASH, FINAL_PURSE, FORMAT_PAY, MEDAL_CASH, PAINT_PRICE, PLACE_CASH, PRESTIGE_PAY, SEASON_CASH, START_CASH, TIER_PAY, TROPHY_CASH, carPrice, sellValue } from './economy.js';
export { BONUS, BOSS_PURSE, DESTRUCT_CASH, FINAL_PURSE, MEDAL_CASH, PAINT_PRICE, PLACE_CASH, SEASON_CASH, START_CASH, TROPHY_CASH } from './economy.js';
import { paceOf } from './ratings.js';
import { DISCIPLINES } from './disciplines.js';
import { PART_MAX, TYRE_KINDS, buildOf, buildVeh, slotById } from './parts.js';
import { GEAR, GEAR_PRICE, SIGNATURES, WEAPONS, WEAPON_IDS, WEAPON_MAX, WEAPON_PRICE, loadoutOf } from './weapons.js';

export const CAREER_RIVALS = 7;
export const STARTERS = ['coupe', 'hatch', 'tuktuk'];
/** Cars for sale: the tier whose showroom first sells them, and their price (data/economy.js: from the tier and the car's ratings). */
const SHOP_TIER = { tuktuk: 0, kart: 0, icecream: 0, sidecar: 0, coupe: 0, hatch: 0, buggy: 0, mixer: 0, firetruck: 1, rover: 1, hotrod: 1, police: 1,
  snowcat: 2, hover: 2, monster: 2, wedge: 2, formula: 3, rocket: 3, limo: 3 };
export const SHOP = Object.fromEntries(Object.entries(SHOP_TIER).map(([id, tier]) => [id, { tier, price: carPrice(id, tier) }]));
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

export const DUEL_GAP = 5;   // a duel (a boss): the first star for finishing this close behind (seconds)
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
  wrecked: n => ({ k: 'wrecked', n }), smashed: n => ({ k: 'smashed', n }),
};
const { drift, air, hits, clean, wrecked, smashed } = OBJ;
const R = (stage, obj) => ({ stage, obj });
// the specials and the boss of a tier: single races
const trial = (id, name, stage, par) => ({ id, kind: 'trial', name, blurb: 'Alone against the clock: bronze, silver and gold times', stage, par });
const mode = (id, m, name, stage, obj, blurb) => ({ id, kind: 'mode', mode: m, name, blurb, stage, obj });
const onemake = (id, make, name, stage, obj, blurb) => ({ id, kind: 'onemake', make, name, blurb, stage, obj });
// a derby (core/modes/derby.js) in an arena: derby cars only (toughness B or better: data/disciplines.js)
const derby = (id, name, stage, obj, blurb) => ({ ...mode(id, 'derby', name, stage, obj, blurb), disc: 'derby', format: 'derby' });
const boss = (id, driver, vehicle, stage, need, obj, blurb) => ({ id, kind: 'boss', driver, vehicle, name: `Boss: ${driver}`, blurb, stage, need, obj });
// a series (G5): a cup for one discipline (data/disciplines.js), maybe capped at a pace band; a derby series is a cup of derbies
const series = (id, disc, name, blurb, rounds, cap = {}) => ({ id, kind: 'cup', disc, series: disc, name, blurb, rounds, ...cap });
const derbies = (id, name, blurb, rounds) => ({ id, kind: 'cup', mode: 'derby', disc: 'derby', format: 'derby', series: 'derby', name, blurb, rounds });
/** The series every tier runs, in hub order (an event's `series`, or a cup's discipline when it's one of these). */
export const SERIES = ['road', 'rally', 'offroad', 'derby', 'oddball'];
export const seriesOf = ev => ev.kind !== 'cup' ? null : ev.series || (SERIES.includes(ev.disc) ? ev.disc : null);
export const seriesName = id => DISCIPLINES[id].name;
/** How a round of ev is raced: 'race', a checkpoint mode, a Showdown or a derby (a derby series' rounds too). */
export const modeOf = ev => ev.mode || 'race';
export const TIERS = [
  { id: 'rookie', name: 'Rookie', blurb: 'Friendly locals on the easy roads', skill: 0.91, upg: 0, pay: TIER_PAY[0], events: [
    { id: 'rookie-cup', kind: 'cup', name: 'Rookie Cup', blurb: 'Four easy tracks: steering, drifting, dirt and jumps, then weapons', rounds: [R('Sunday Park', clean()), R('Harbour Sprint', drift(4)), R('Hay Bale Farm', air(3)), R('Village Green', hits(3))] },
    { id: 'sunday-loops', kind: 'cup', name: 'Sunday Loops', blurb: 'Three short circuits to learn the lines', rounds: [R('Mountain Loop', drift(4)), R('Red Mesa Canyon', air(10)), R('Bogwood Rally', clean())] },
    { id: 'seaside-double', kind: 'cup', format: 'demolition', name: 'Seaside Smash', blurb: 'Demolition rally through the harbour and the farm: smashed fences and gates score as well as your place', rounds: [R('Harbour Sprint', smashed(4)), R('Hay Bale Farm', smashed(3)), R('Sunday Park', drift(3))] },
    trial('park-sprint', 'Park Sprint', 'Sunday Park', 78.4),
    mode('rookie-king', 'showdown', 'King of the Loop', 'Mountain Loop', drift(3), 'Showdown against three rivals: hold the lead to bank crown time'),
    { ...onemake('ice-cream-derby', 'icecream', 'Ice Cream Derby', 'Village Green', wrecked(1), 'Everyone in an Ice Cream Van round the fete\'s figure of eight: points for your place and for the vans you take out'), format: 'figure8' },
    boss('rookie-boss', 'Brannigan', 'monster', 'Monster Stadium', 20, air(12), 'One on one with the Monster Truck in its own stadium: the kickers, the whoops and the mud. Win it and it\'s yours'),
    { id: 'pocket-rockets', kind: 'cup', disc: 'oddball', name: 'Pocket Rockets', blurb: 'Oddballs only: karts, trikes, bikes and vans', rounds: [R('Sunday Park', hits(3)), R('Harbour Sprint', drift(4)), R('Village Green', clean())] },
    series('rookie-road', 'road', 'Rookie Road', 'Road cars on the easy tarmac (pace A or below)', [R('Sunday Park', drift(3)), R('Harbour Sprint', clean()), R('Mountain Loop', hits(3))], { maxPace: 'A' }),
    series('rookie-rally', 'rally', 'Gravel Cup', 'Rally cars on gravel and dirt', [R('Hay Bale Farm', air(2)), R('Bogwood Rally', drift(3)), R('Red Mesa Canyon', clean())]),
    series('rookie-offroad', 'offroad', 'Farm Track Trophy', 'Off-road cars round the farm, the quarry and the stadium', [R('Hay Bale Farm', clean()), R('Quarry Run', air(2)), R('Monster Stadium', air(6))]),
    derbies('rookie-derby', 'Banger Bash', 'Three derbies: the oval, the scrapyard and the mud. Derby cars only', [R('Banger Oval', wrecked(1)), R('Scrapyard Bowl', wrecked(1)), R('Mud Pit', wrecked(2))]),
  ] },
  { id: 'club', name: 'Club', blurb: 'Weekend racers who know the tracks', skill: 0.92, upg: 1, pay: TIER_PAY[1], events: [
    { id: 'circuit-series', kind: 'cup', name: 'Circuit Series', blurb: 'Switchbacks, viaducts, jumps and a waterfall', rounds: [R('Mountain Loop', hits(8)), R('Mountain Pass', drift(6)), R('Ravenrock Gorge', clean()), R('Red Mesa Canyon', air(12)), R('Thunder Falls', hits(8))] },
    { id: 'mud-snow', kind: 'cup', disc: 'offroad', name: 'Mud & Snow', blurb: 'Loose surfaces all the way: off-road cars only', rounds: [R('Quarry Run', air(3)), R('Bogwood Rally', air(8)), R('Frostpeak', drift(5)), R('Open Country', clean())] },
    { id: 'high-roads', kind: 'cup', name: 'High Roads', blurb: 'Tunnels, ledges and a spire', rounds: [R('Mountain Pass', hits(8)), R('Corkscrew Spire', drift(6)), R('Temple Ruins', clean())] },
    trial('frost-attack', 'Frostpeak Time Attack', 'Frostpeak', 116.7),
    mode('falls-deuce', 'deuce', 'Deuce at the Falls', 'Thunder Falls', hits(4), 'Checkpoints, first to 4, win by two'),
    onemake('kart-chaos', 'kart', 'Kart Chaos', 'Corkscrew Spire', drift(4), 'Eight Go-Karts round the spire'),
    derby('scrapyard-derby', 'Scrapyard Derby', 'Scrapyard Bowl', wrecked(2), 'Six cars in the tyre-walled bowl: wreck the rest, be the last one running'),
    boss('club-boss', 'Lindqvist', 'wedge', 'Ravenrock Gorge', 26, clean(), 'The Group B ace on the viaducts. Beat Lindqvist and the Wedge is yours'),
    { id: 'downhill-classic', kind: 'cup', name: 'Downhill Classic', blurb: 'The four original downhill runs, top to bottom: fast, steep and unforgiving', rounds: [R('Summit Meadow', drift(2)), R('Pine Forest', clean()), R('Quarry Run', air(2)), R('Village Descent', hits(4))] },
    { id: 'oval-bangers', kind: 'cup', format: 'banger', name: 'Oval Bangers', blurb: 'Banger racing on the oval and round the village green: wrecks score', rounds: [R('Banger Oval', wrecked(1)), R('Village Green', hits(4)), R('Banger Oval', wrecked(2))] },
    { id: 'heavyweights', kind: 'cup', disc: 'heavy', format: 'banger', name: 'Heavyweights', blurb: 'Banger racing for trucks, vans and limos: wrecks score', rounds: [R('Village Descent', wrecked(1)), R('Scrapyard Smash', air(3)), R('Mountain Pass', clean())] },
    series('club-road', 'road', 'Club Tarmac', 'Road cars round the old town and the loops (pace A or below)', [R('Old Town GP', drift(4)), R('Mountain Loop', clean()), R('Harbour Sprint', hits(4))], { maxPace: 'A' }),
    series('club-rally', 'rally', 'Club Rally', 'Rally cars through the woods, the quarry and the canyon', [R('Bogwood Rally', clean()), R('Quarry Run', air(2)), R('Red Mesa Canyon', drift(5)), R('Hay Bale Farm', air(3))]),
    derbies('club-derby', 'Club Derby Series', 'Three derbies, scrapyard to stadium. Derby cars only', [R('Scrapyard Bowl', wrecked(2)), R('Banger Oval', wrecked(2)), R('The Stadium', wrecked(1))]),
    series('club-oddball', 'oddball', 'Odd Club', 'Oddballs on the spire, the green and in the stadium', [R('Corkscrew Spire', drift(4)), R('Village Green', hits(4)), R('Monster Stadium', air(6))]),
  ] },
  { id: 'pro', name: 'Pro', blurb: 'Full-time drivers in sharp cars', skill: 0.93, upg: 2, pay: TIER_PAY[2], events: [
    { id: 'wild-cup', kind: 'cup', name: 'Wild Cup', blurb: 'The wildest tracks, each with a shortcut to find', rounds: [R('Corkscrew Spire', clean()), R('Scrapyard Smash', air(4)), R('Mesa Leap', air(4)), R('Temple Ruins', hits(8)), R('Glacier Rift', drift(5))] },
    { id: 'frozen-north', kind: 'cup', disc: 'offroad', name: 'Frozen North', blurb: 'Snow, ice and open country: off-road cars only', rounds: [R('Frostpeak', clean()), R('Glacier Rift', air(3)), R('Open Country', hits(6))] },
    { id: 'long-haul', kind: 'cup', name: 'Long Haul', blurb: 'The big circuits', rounds: [R('Ravenrock Gorge', hits(12)), R('Flyover Tangle', drift(8)), R('Thunder Falls', clean())] },
    trial('mesa-attack', 'Mesa Time Attack', 'Mesa Leap', 114.3),
    derby('mud-pit-derby', 'Mud Pit Derby', 'Mud Pit', wrecked(2), 'A derby in the mud at the farm: heavy, slow and sideways'),
    mode('mesa-showdown', 'showdown', 'Mesa Showdown', 'Red Mesa Canyon', air(6), 'King of the Hill over the mesa jumps'),
    { ...onemake('monster-mash', 'monster', 'Monster Mash', 'Scrapyard Smash', wrecked(2), 'Eight Monster Trucks in the scrapyard: a banger race, wrecks score'), format: 'banger' },
    boss('pro-boss', 'Moreau', 'formula', 'Old Town GP', 28, drift(6), 'The Formula Racer on its street circuit, between the houses. Win and it\'s yours'),
    { id: 'tarmac-gp', kind: 'cup', disc: 'road', name: 'Tarmac GP', blurb: 'Road cars on the smoothest circuits', rounds: [R('Mountain Loop', drift(6)), R('Flyover Tangle', hits(10)), R('Corkscrew Spire', clean()), R('Summit Meadow', drift(2))] },
    series('pro-rally', 'rally', 'Pro Rally', 'Rally cars on ice, mud and the temple stones', [R('Bogwood Rally', drift(6)), R('Glacier Rift', clean()), R('Quarry Run', air(3)), R('Temple Ruins', hits(6))]),
    derbies('pro-derby', 'Pro Derby Series', 'Three derbies, harder hitters. Derby cars only', [R('Mud Pit', wrecked(2)), R('Scrapyard Bowl', wrecked(3)), R('The Stadium', wrecked(2))]),
    series('pro-oddball', 'oddball', 'Strange Days', 'Oddballs on the quays, in the scrapyard and over the mesa', [R('Harbour Sprint', drift(6)), R('Scrapyard Smash', air(4)), R('Mesa Leap', clean())]),
  ] },
  { id: 'legend', name: 'Legend', blurb: 'The best in the mountains', skill: 0.935, upg: 3, pay: TIER_PAY[3], events: [
    { id: 'grand-tour', kind: 'cup', name: 'Grand Tour', blurb: 'Six of the best, back to back', rounds: [R('Mountain Pass', clean()), R('Ravenrock Gorge', hits(12)), R('Thunder Falls', drift(6)), R('Bogwood Rally', air(10)), R('Glacier Rift', clean()), R('Temple Ruins', hits(10))] },
    { id: 'dirt-masters', kind: 'cup', disc: 'offroad', name: 'Dirt Masters', blurb: 'Gravel, mud and snow, flat out: off-road cars only', rounds: [R('Quarry Run', clean()), R('Bogwood Rally', drift(6)), R('Frostpeak', hits(10)), R('Open Country', air(2)), R('Glacier Rift', drift(6))] },
    { id: 'top-speed', kind: 'cup', disc: 'road', name: 'Top Speed', blurb: 'Fast roads for fast tarmac cars', rounds: [R('Summit Meadow', clean()), R('Mountain Loop', drift(8)), R('Flyover Tangle', hits(12)), R('Mesa Leap', air(5)), R('Corkscrew Spire', clean())] },
    trial('flyover-attack', 'Flyover Time Attack', 'Flyover Tangle', 147.7),
    derby('stadium-derby', 'Stadium Derby', 'The Stadium', wrecked(3), 'Under the floodlights: the fastest, hardest derby of them all'),
    mode('legend-tiebreak', 'tiebreak', 'Legend Tiebreak', 'Temple Ruins', hits(6), 'Checkpoints, first to 7, win by two'),
    onemake('rocket-run', 'rocket', 'Rocket Run', 'Summit Meadow', clean(), 'Eight Rocket Cars down the mountain'),
    boss('legend-boss', 'Achterberg', 'rocket', 'Salt Flats', 30, clean(), 'The Rocket Car on the salt flats, flat out. Beat Achterberg and the rocket is yours'),
    { id: 'final', kind: 'final', name: 'Champion of Champions', blurb: 'Every boss at once, fully upgraded. Win it for the gold limo, the title and the Elite tier', stage: 'Mountain Pass', obj: clean() },
    series('legend-rally', 'rally', 'Rally Legends', 'Rally cars on the five hardest loose stages', [R('Glacier Rift', drift(6)), R('Bogwood Rally', clean()), R('Frostpeak', air(3)), R('Red Mesa Canyon', air(12)), R('Temple Ruins', clean())]),
    derbies('legend-derby', 'Legend Derby Series', 'Four derbies, the hardest hitters there are. Derby cars only', [R('The Stadium', wrecked(3)), R('Mud Pit', wrecked(2)), R('Scrapyard Bowl', wrecked(3)), R('Banger Oval', wrecked(3))]),
    series('legend-oddball', 'oddball', 'Oddball Masters', 'Oddballs on the boss tracks', [R('Monster Stadium', air(8)), R('Old Town GP', clean()), R('Salt Flats', drift(3))]),
  ] },
  // Elite (G5): no boss, a season. Fields of twelve, rivals' builds rated against your car (ELITE), blockers, bombers and a nemesis
  { id: 'elite', name: 'Elite', blurb: 'A season against the best, twelve cars a race', skill: 0.93, upg: 3, pay: TIER_PAY[4], elite: true, events: [
    { id: 'elite-gp', kind: 'cup', name: 'Elite Grand Prix', blurb: 'Twelve cars on the big circuits', rounds: [R('Old Town GP', clean()), R('Ravenrock Gorge', hits(12)), R('Salt Flats', drift(4)), R('Thunder Falls', clean())] },
    series('elite-road', 'road', 'Elite Road', 'Road cars at full speed', [R('Salt Flats', clean()), R('Flyover Tangle', drift(8)), R('Old Town GP', hits(8)), R('Corkscrew Spire', clean())]),
    series('elite-rally', 'rally', 'Elite Rally', 'Rally cars on ice, mud and gravel', [R('Glacier Rift', clean()), R('Bogwood Rally', drift(6)), R('Temple Ruins', hits(8)), R('Red Mesa Canyon', air(12))]),
    series('elite-offroad', 'offroad', 'Elite Off-road', 'Off-road cars, open country and the stadium', [R('Open Country', clean()), R('Monster Stadium', air(10)), R('Frostpeak', drift(5)), R('Quarry Run', air(3))]),
    derbies('elite-derby', 'Elite Derby', 'Eight-car derbies. Derby cars only', [R('The Stadium', wrecked(3)), R('Scrapyard Bowl', wrecked(3)), R('Mud Pit', wrecked(3))]),
    series('elite-oddball', 'oddball', 'Elite Oddball', 'Oddballs, twelve at a time', [R('Monster Stadium', air(8)), R('Harbour Sprint', hits(8)), R('Mesa Leap', clean())]),
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
/** The event whose win opens the next tier: the final in Legend, else the boss (none in Elite). */
export const gateOf = t => t.events.find(e => e.kind === 'final') || bossOf(t);
export const beaten = (s, ev) => !!(s.beaten && s.beaten[ev.id]);
/** Tier i is open once the gate of the tier below (its boss; the final for Elite) is beaten. */
export const tierOpen = (s, i) => i === 0 || beaten(s, gateOf(TIERS[i - 1]));
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
/** What car id sells for (data/economy.js: RESALE of its price and of what's been spent on it). */
export const sellPrice = (s, id) => s.cars[id] && SHOP[id] ? sellValue(SHOP[id].price, s.cars[id]) : 0;
/** Sell car id, or null: not the one you're driving (pick another first), not your last. */
export function sellCar(s, id) {
  if (!s.cars[id] || id === s.car || Object.keys(s.cars).length < 2 || !SHOP[id]) return null;
  const cars = { ...s.cars }; delete cars[id];
  return { ...s, cash: s.cash + sellPrice(s, id), cars, sold: (s.sold || 0) + 1 };
}

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
export function careerField(ev, ti = tierOf(ev), s = null) {
  const T = TIERS[ti], p = prestigeOf(s), k = T.skill + PRESTIGE.SKILL * p, L = Math.min(PART_MAX, T.upg + p);   // prestige: sharper rivals, more parts
  if (ev.kind === 'trial') return [];
  if (ev.kind === 'boss') return [bossDef(ev.driver, ev.vehicle, L, k)];
  if (ev.kind === 'final') {
    const bosses = TIERS.map(bossOf).filter(Boolean).map(b => bossDef(b.driver, b.vehicle, PART_MAX, k)), rest = DRIVERS.filter(d => !bosses.some(b => b.name === d.name) && ['limo', 'police', 'hover'].includes(d.vehicle));
    return [...bosses, ...rest.map(d => bossDef(d.name, d.vehicle, PART_MAX, k))];
  }
  const field = T.elite ? eliteField(ev, T, ti, s, k) : cupField(ev, ti, k, L);
  if (modeOf(ev) === 'derby') return field.slice(0, T.elite ? 7 : 5);   // a derby: six cars in the arena (Elite: eight)
  if (ev.kind === 'mode') return field.slice(0, 3);
  if (ev.kind === 'onemake') { const v = vehicleById(ev.make); return field.map(d => ({ ...d, model: v.model, hw: v.hw, hl: v.hl, veh: v.veh, im: v.veh ? v.veh.im : undefined, vehicle: v.id, build: null })); }   // stock cars
  return field;
}
// a star driver in their car, a notch sharper than the tier (skill `k`) and upgraded to `L`
function bossDef(name, vehicle, L, k) {
  const d = DRIVERS.find(x => x.name === name), lv = { eng: L, tyr: L, sus: L }, veh = upgradedVeh(vehicle, lv);
  return { ...asDef(d, vehicleById(vehicle)), skill: Math.min(1, d.skill * k + 0.02), veh, im: veh.im, build: buildOf(lv), wpn: rivalLoad(L, 'shield') };
}
const lvOf = L => ({ eng: L, tyr: L, sus: L });
// the drivers for an event, in a fixed order for it: the ones whose own car is allowed first
function lineUp(ev, ok, n, skip = []) {
  const order = DRIVERS.filter(d => !skip.includes(d.name)).sort((a, b) => hash(ev.id + a.name) - hash(ev.id + b.name));
  return [...order.filter(d => ok.includes(d.vehicle)), ...order.filter(d => !ok.includes(d.vehicle))].slice(0, n);
}
// a rival's car: their own if the event takes it, else one from the event's list in their own livery
const rivalCar = (ev, d, k, ok) => vehicleById(ok.includes(d.vehicle) ? d.vehicle : ok[hash(ev.id + k) % ok.length]);
function cupField(ev, ti, k, L) {
  const lv = lvOf(L), b = buildOf(lv); let ok = tierCars(ti).filter(id => allowed(ev, id, b));
  if (!ok.length) ok = tierCars(ti).filter(id => allowed(ev, id, null));   // a pace cap the tier's parts break: stock cars
  return lineUp(ev, ok, CAREER_RIVALS).map((d, i) => {
    const v = rivalCar(ev, d, i, ok), bl = allowed(ev, v.id, b) ? lv : null, veh = upgradedVeh(v.id, bl);
    return { ...asDef(d, v, vehicleById(d.vehicle)), skill: Math.min(1, d.skill * k), veh, im: veh.im, build: buildOf(bl), wpn: rivalLoad(L) };   // their parts show
  });
}
// ---------- Elite (G5) ----------
/** Elite rules: FIELD rivals (twelve cars), each rival's parts picked so its pace on the event's surface is within
 *  GAP % of the player's car (data/ratings.js), a share of blockers and bombers (core/sim/ai.js, features/weapons.js),
 *  and the career's nemesis in every race, sharper and fully built, who blocks and bombs the player. */
export const ELITE = { FIELD: 11, GAP: 0.6, NEMESIS_SKILL: 0.015 };
export const NEMESES = ['Kowalski', 'Delgado', 'Haddad', 'Duval'];
/** The career's nemesis: chosen when Elite opens (scoreRace), the first of NEMESES before that. */
export const nemesisOf = s => (s && s.nemesis && s.nemesis.name) || NEMESES[0];
const surfOf = ev => ev.disc ? DISCIPLINES[ev.disc].surface : 'pace';
const paceOn = (id, b, surf) => surf === 'pace' ? Math.min(paceOf(id, b, 'tarmac'), paceOf(id, b, 'loose')) : paceOf(id, b, surf);
/** The parts level (0..3 on engine, tyres, suspension) that brings car id within ELITE.GAP of pace `target` (or as close as it gets). */
export function ratedLevel(id, target, surf, ev = null) {
  for (let L = 0; L <= PART_MAX; L++) if (paceOn(id, buildOf(lvOf(L)), surf) <= target + ELITE.GAP && (!ev || allowed(ev, id, buildOf(lvOf(L))))) return L;
  return PART_MAX;
}
function eliteField(ev, T, ti, s, k) {
  const surf = surfOf(ev), me = s ? paceOn(s.car, buildOf(s.cars[s.car]), surf) : -2, nem = nemesisOf(s);
  let ok = tierCars(ti).filter(id => allowed(ev, id, null)); if (!ok.length) ok = tierCars(ti);
  const nd = DRIVERS.find(d => d.name === nem), field = lineUp(ev, ok, ELITE.FIELD - 1, [nem]).map((d, i) => {
    const v = rivalCar(ev, d, i, ok), L = ratedLevel(v.id, me, surf, ev), veh = upgradedVeh(v.id, lvOf(L)), h = hash(ev.id + d.name) % 5;
    return { ...asDef(d, v, vehicleById(d.vehicle)), skill: Math.min(1, d.skill * k), veh, im: veh.im, build: buildOf(lvOf(L)), wpn: rivalLoad(Math.max(2, L)), persona: h === 0 ? 'blocker' : h === 1 ? 'bomber' : undefined };
  });
  const nv = rivalCar(ev, nd, 99, ok), nveh = upgradedVeh(nv.id, lvOf(PART_MAX));
  const nemesis = { ...asDef(nd, nv, vehicleById(nd.vehicle)), skill: Math.min(1, nd.skill * k + ELITE.NEMESIS_SKILL), veh: nveh, im: nveh.im, build: buildOf(lvOf(PART_MAX)), wpn: rivalLoad(PART_MAX, 'shield'), persona: 'nemesis' };
  return [nemesis, ...field];   // the nemesis first, so a derby (eight cars) always has them
}

// ---------- prestige (G5) ----------
/** Each prestige level: rivals SKILL sharper and one parts level higher (to 3), pay PRESTIGE_PAY more (data/economy.js). */
export const PRESTIGE = { SKILL: 0.01, MAX: 3 };
export const prestigeOf = s => Math.min(PRESTIGE.MAX, (s && s.prestige) || 0);
export const prestigePay = s => 1 + PRESTIGE_PAY * ((s && s.prestige) || 0);
/** Start the career again from Rookie (a Champion only): keep every car and its parts, the titles and the prestige level + 1. */
export function prestige(s) {
  if (!s.champion) return null;
  return { ...newCareer(s.car), cars: s.cars, car: s.car, prestige: (s.prestige || 0) + 1, titles: s.titles || [], nemesis: s.nemesis };
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
  let defs = [...careerField(ev, tierOf(ev), s), careerPlayer(s, s.car, ev)];
  if (order) { const rank = n => { const i = order.indexOf(n); return i < 0 ? 99 : i; }; defs = defs.slice().sort((a, b) => rank(b.name) - rank(a.name)); }
  return defs;
}

// ---------- scoring a race ----------
export const objDone = (o, t) => o.k === 'clean' ? t.wrecks === 0 && t.respawns === 0 : (t[o.k] || 0) >= o.n;
export function objText(o) {
  const pl = (n, a, b = a + 's') => `${n} ${n === 1 ? a : b}`;
  return o.k === 'clean' ? 'A clean race: no wrecks, no resets' : o.k === 'drift' ? `${pl(o.n, 'drift boost')}` : o.k === 'air' ? `${pl(o.n, 'big air')}` : o.k === 'hits' ? `Hit rivals ${pl(o.n, 'time')} with weapons`
    : o.k === 'wrecked' ? `Wreck ${pl(o.n, 'rival')}` : o.k === 'smashed' ? `Smash ${pl(o.n, 'fence, gate or wall', 'fences, gates or walls')}` : '';
}
/** The top places that count as a podium in a field of n (top 3 of 8, top 2 of 4, only a win in a duel). */
export const podiumOf = n => Math.max(1, Math.min(3, Math.floor(n / 2)));
/**
 * Score round k of event ev: `place` of `n` cars, `t` the player's tally { air, drift, hits, wrecks, respawns, gap }
 * (gap: seconds behind the winner, for a duel), `time` the player's finish time (a time trial).
 * Returns { state, stars (mask this race), fresh (mask of newly earned stars), cash, lines: [[label, amount]] }.
 */
export function scoreRace(s, ev, k, place, n, t, time = 0) {
  const T = TIERS[tierOf(ev)], o = roundsOf(ev)[k].obj, fp = FORMAT_PAY[formatOf(ev)] || 1, pp = prestigePay(s), pay = x => Math.round(x * T.pay * fp * pp / 10) * 10;   // the tier's pay, the format's (data/economy.js) and prestige's
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
  // destruction (data/formats.js): paid in the formats that weigh it
  const wd = (FORMATS[formatOf(ev)] || FORMATS.race).weight.destruct;
  if (wd > 0) for (const [k, label] of [['wrecked', 'Rivals wrecked'], ['panels', 'Panels torn off'], ['smashed', 'Scenery smashed'], ['takedowns', 'Road cars taken out']]) if (t[k]) lines.push([`${label} ×${t[k]}`, pay(DESTRUCT_CASH[k] * t[k] * wd)]);
  if (t.wrecks === 0 && t.respawns === 0) lines.push(['Clean race', pay(BONUS.clean)]);
  if (mask & 4 && ev.kind !== 'trial') lines.push(['Objective', pay(BONUS.obj)]);
  // a boss or the final won for the first time: the purse and the prize car
  const won = place === 1 && (ev.kind === 'boss' || ev.kind === 'final') && !beaten(s, ev), prize = won ? (ev.kind === 'final' ? 'limo' : ev.vehicle) : null;
  if (won) lines.push([ev.kind === 'final' ? 'Champion\'s purse' : 'Boss purse', ev.kind === 'final' ? FINAL_PURSE : pay(BOSS_PURSE)]);
  const cash = lines.reduce((a, l) => a + l[1], 0);
  let state = { ...s, cash: s.cash + cash, earned: s.earned + cash, races: s.races + 1, wins: s.wins + (place === 1 ? 1 : 0), stars: { ...s.stars, [starKey(ev, k)]: had | mask } };
  if (won) state = { ...state, beaten: { ...(s.beaten || {}), [ev.id]: true }, cars: s.cars[prize] ? state.cars : { ...state.cars, [prize]: {} }, champion: s.champion || ev.kind === 'final' };
  if (won && ev.kind === 'final' && !s.nemesis) state = { ...state, nemesis: { name: NEMESES[s.races % NEMESES.length], beat: 0, lost: 0 } };   // Elite opens: someone takes it personally
  // the nemesis (Elite): t.nemesis is their place in this race (0: not in it)
  if (T.elite && t.nemesis > 0) { const N = state.nemesis || { name: nemesisOf(state), beat: 0, lost: 0 }, w = place < t.nemesis; state = { ...state, nemesis: { ...N, beat: N.beat + (w ? 1 : 0), lost: N.lost + (w ? 0 : 1) } }; }
  if (ev.kind === 'trial' && time > 0 && !(s.best && s.best[ev.id] <= time)) state = { ...state, best: { ...(s.best || {}), [ev.id]: time } };
  return { state, stars: mask, fresh, cash, lines, prize };
}
/** A finished cup's trophy (place 1..3, else 0) pays out once per step up: a later gold after a bronze pays the difference. */
export function awardTrophy(s, ev, place) {
  const prev = s.trophies[ev.id] || 0, T = TIERS[tierOf(ev)], val = p => p >= 1 && p <= 3 ? Math.round(TROPHY_CASH[p - 1] * T.pay * prestigePay(s) / 10) * 10 : 0;
  if (!val(place) || (prev && prev <= place)) return { state: s, cash: 0 };
  const cash = val(place) - (prev ? val(prev) : 0);
  return { state: { ...s, cash: s.cash + cash, earned: s.earned + cash, trophies: { ...s.trophies, [ev.id]: place } }, cash };
}
const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');

// ---------- the Elite season (G5) ----------
/** The season so far: { n, pts: { name: points }, done: { eventId: true } } (every Elite race scores RACE_PTS for every car in it). */
export const seasonOf = s => (s && s.season) || { n: 1, pts: {}, done: {} };
export const isElite = ev => !!TIERS[tierOf(ev)].elite;
/** The season standings, best first: [{ name, pts }]. */
export const seasonTable = s => Object.entries(seasonOf(s).pts).map(([name, pts]) => ({ name, pts })).sort((a, b) => b.pts - a.pts || (a.name === 'You' ? -1 : b.name === 'You' ? 1 : a.name.localeCompare(b.name)));
/** The events a season runs: every Elite event. */
export const seasonEvents = () => TIERS.filter(t => t.elite).flatMap(t => t.events);
/**
 * Score an Elite race for the season: `names` is the finishing order (the player is 'You'), `finished` says the event
 * is over (its last round, or a single race). When every Elite event is done the season ends: the top three are paid
 * SEASON_CASH, the result goes in `titles`, and the next season starts (Elite cups cleared, points back to zero).
 * Returns { state, over: null | { n, place, cash } }.
 */
export function seasonRace(s, ev, names, finished) {
  if (!isElite(ev)) return { state: s, over: null };
  const S0 = seasonOf(s), pts = { ...S0.pts };
  names.forEach((n, i) => { pts[n] = (pts[n] || 0) + (RACE_PTS[i] || 0); });
  const done = finished ? { ...S0.done, [ev.id]: true } : S0.done;
  let state = { ...s, season: { ...S0, pts, done } };
  if (!seasonEvents().every(e => done[e.id])) return { state, over: null };
  const place = seasonTable(state).findIndex(x => x.name === 'You') + 1, cash = place <= 3 ? Math.round(SEASON_CASH[place - 1] * prestigePay(s) / 10) * 10 : 0;
  const cups = { ...state.cups }; for (const e of seasonEvents()) delete cups[e.id];
  state = { ...state, cash: state.cash + cash, earned: state.earned + cash, cups, titles: [...(s.titles || []), { n: S0.n, place }], season: { n: S0.n + 1, pts: {}, done: {} } };
  return { state, over: { n: S0.n, place, cash } };
}
