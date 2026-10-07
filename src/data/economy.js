import { ratingOf } from './ratings.js';
import { SLOTS } from './parts.js';
import { GEAR, GEAR_PRICE, WEAPON_PRICE } from './weapons.js';

// The career's economy on one sheet (G4): every price and every payout. data/career.js reads it; `npm run career`
// measures how it plays (cash over time, races per purchase) and the pacing dashboard shows it.
//   cars     a car's price comes from the tier whose showroom sells it and its measured ratings (data/ratings.js):
//            CAR_BASE[tier] x (1 + PACE_K x how much quicker than the coupe it is on its better surface (%) +
//            TOUGH_K x how much tougher), rounded to $250 (from $10k, $500). Better cars cost more; nothing is priced by hand
//   parts    each level COST_GROW times the last (data/prices.js; the bases are in data/parts.js and data/weapons.js)
//   resale   a car sells for RESALE of its price and of everything spent on it (parts, weapon levels, gear)
//   payouts  place cash, style bonuses, trophies, medals, purses: times the tier's pay (TIER_PAY) and the format's (FORMAT_PAY)
export const START_CASH = 1500;
export const CAR_BASE = [3200, 9000, 19000, 38000], PACE_K = 0.06, TOUGH_K = 0.5, RESALE = 0.6;
export const TIER_PAY = [1, 1.7, 2.6, 3.8, 5];   // Rookie, Club, Pro, Legend, Elite
export const FORMAT_PAY = { race: 1, banger: 1.1, demolition: 1.1, figure8: 1, derby: 1.2, trial: 1, boss: 1, showdown: 1, deuce: 1, tiebreak: 1 };
export const PLACE_CASH = [1000, 750, 550, 400, 300, 220, 160, 120];
export const BONUS = { air: 30, drift: 20, hit: 15, clean: 150, obj: 250 };
export const DESTRUCT_CASH = { wrecked: 150, panels: 40, smashed: 20, takedowns: 60 };   // per item, times the format's destruct weight
export const TROPHY_CASH = [2500, 1500, 800];
export const MEDAL_CASH = [450, 700, 1000];   // time trial: bronze, silver, gold
export const BOSS_PURSE = 3000, FINAL_PURSE = 25000, PAINT_PRICE = 800;
export const SEASON_CASH = [40000, 24000, 14000];   // an Elite season's top three (G5)
export const PRESTIGE_PAY = 0.2;   // each prestige level pays this much more (and rivals are harder: data/career.js PRESTIGE)
const round = x => x < 10000 ? Math.round(x / 250) * 250 : Math.round(x / 500) * 500;
/** The price of car id in tier `tier`'s showroom. */
export function carPrice(id, tier) {
  const r = ratingOf(id);
  return round(CAR_BASE[tier] * (1 + PACE_K * Math.max(-3, -r.pace) + TOUGH_K * (r.tough - 1)));
}
/** What's been spent on an owned-car record: its parts, weapon levels and gear. */
export function spentOn(own) {
  if (!own) return 0;
  let n = 0;
  for (const s of SLOTS) for (let L = 0; L < (own[s.id] || 0); L++) n += s.price[L];
  for (const L of Object.values(own.wl || {})) for (let k = 1; k < L; k++) n += WEAPON_PRICE[k];
  for (const g of own.gears || []) if (GEAR[g]) n += GEAR_PRICE;
  return n;
}
/** What car id (bought at `price`, kept as `own`) sells for. */
export const sellValue = (price, own) => Math.round(RESALE * (price + spentOn(own)) / 100) * 100;
