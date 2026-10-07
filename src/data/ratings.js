import DATA from './ratings-data.js';
import { vehicleById } from './vehicles.js';
import { buildVeh } from './parts.js';

// Car ratings (G1): two numbers for any vehicle with any build, measured by `npm run ratings` (tools/ratings.mjs ->
// ratings-data.js), shown as bands D C B A S.
//   pace       % of lap time against the stock coupe, on tarmac or loose stages (lower is faster). A build moves it by
//              the measured sensitivities: sens[surface][stat] x ln(how much its parts multiply that stat)
//   toughness  the stock coupe is 1: damage dealt to a car it hits (square-rooted) over damage taken in two crashes.
//              A build's roll cage divides the damage it takes (veh.tough) and its armour adds weight (im), so it scales
//              by their ratios (exactly as core/sim/damage.js and the collisions use them)
export const RATINGS = DATA;
export const BANDS = ['D', 'C', 'B', 'A', 'S'];
// band edges: pace % (at most this for the band), toughness (at least this)
const PACE_EDGE = { S: -3, A: -1.2, B: 0.6, C: 2.5 }, TOUGH_EDGE = { S: 1.6, A: 1.3, B: 1.1, C: 0.97 };
export const paceBand = p => BANDS.slice(1).reverse().find(b => p <= PACE_EDGE[b]) || 'D';
export const toughBand = t => BANDS.slice(1).reverse().find(b => t >= TOUGH_EDGE[b]) || 'D';
/** How a band compares: D 0 ... S 4. */
export const bandRank = b => BANDS.indexOf(b);
const STD = { accel: 1, top: 1, grip: 1, off: 1, im: 1 };
/** Vehicle id's pace with build b on 'tarmac' or 'loose' (% vs the stock coupe; lower is faster). */
export function paceOf(id, b, surface = 'tarmac') {
  const car = DATA.cars[id]; if (!car) return 0;
  const veh = vehicleById(id).veh || STD, built = buildVeh(veh, b), S = DATA.sens[surface];
  let p = car[surface]; for (const k of Object.keys(S)) p += S[k] * Math.log((built[k] ?? 1) / (veh[k] ?? 1));
  return Math.round(p * 100) / 100;
}
/** Vehicle id's toughness with build b (the stock coupe is 1). */
export function toughOfBuild(id, b) {
  const car = DATA.cars[id]; if (!car) return 1;
  const veh = vehicleById(id).veh || STD, built = buildVeh(veh, b);
  return Math.round(car.tough * ((built.tough ?? 1) / (veh.tough ?? 1)) * Math.sqrt((veh.im ?? 1) / (built.im ?? 1)) * 100) / 100;
}
/** Everything about a car's rating: { tarmac, loose, tough } numbers and their bands; pace is its better surface. */
export function ratingOf(id, b) {
  const tarmac = paceOf(id, b, 'tarmac'), loose = paceOf(id, b, 'loose'), tough = toughOfBuild(id, b);
  return { tarmac, loose, tough, pace: Math.min(tarmac, loose), bands: { tarmac: paceBand(tarmac), loose: paceBand(loose), pace: paceBand(Math.min(tarmac, loose)), tough: toughBand(tough) } };
}
