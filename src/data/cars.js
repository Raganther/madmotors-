import { vehicleById } from './vehicles.js';

// ---------- traffic ----------
// Civilian vehicles: oncoming (driving back up the hill in the other lane) and slow same-way cars to pass.
// They spawn ahead of the player and are removed once well behind; wrecked ones stay where they stopped.
export const TRAFFIC_KINDS = [
  { kind: 'hatch', hw: 0.95, hl: 1.7, im: 1, w: 5 },
  { kind: 'van', hw: 1.05, hl: 2.25, im: 0.65, w: 3 },
  { kind: 'truck', hw: 1.2, hl: 3.1, im: 0.4, w: 2 }
];
export const TRAFFIC_COLORS = [0xF2F2EE, 0x9CB4C9, 0x5E6B7A, 0xC9B79C, 0x7A9A6E, 0xB84A4A, 0x3E5C8C, 0xE6D38A];
// model: the body (render/carmodels.js): looks only, every racer has the same hitbox and handling
export const CAR_DEFS = [
  { name: 'Okafor', model: 'hatch', color: 0xE0402F, accent: 0xFFFFFF, num: 3, skill: 0.95, flick: 0.38, driftK: 1 / 62 },
  { name: 'Lindqvist', model: 'wedge', color: 0x2F7DE0, accent: 0xFFC72C, num: 11, skill: 0.99, flick: 0.22, driftK: 1 / 38 },
  { name: 'You', model: 'coupe', color: 0xFFC72C, accent: 0x1C2340, num: 7, player: true },
  { name: 'Vasquez', model: 'buggy', color: 0x2FB36B, accent: 0xFFFFFF, num: 24, skill: 0.92, flick: 0.28, driftK: 1 / 50 }
];

// The rest of the field, joining in this order as the Rivals setting goes past three: each drives its own vehicle
// from the garage (data/vehicles.js), with that vehicle's hitbox and handling.
export const MORE_RIVALS = [
  { name: 'Moreau', vehicle: 'formula', num: 5, skill: 0.97, flick: 0.2, driftK: 1 / 40 },
  { name: 'Brannigan', vehicle: 'monster', num: 99, skill: 0.93, flick: 0.35, driftK: 1 / 60 },
  { name: 'Delgado', vehicle: 'hotrod', num: 32, skill: 0.94, flick: 0.4, driftK: 1 / 34 },
  { name: 'Tanaka', vehicle: 'rover', num: 8, skill: 0.95, flick: 0.25, driftK: 1 / 55 },
  { name: 'Kowalski', vehicle: 'police', num: 1, skill: 0.96, flick: 0.3, driftK: 1 / 45 },
  { name: 'Nguyen', vehicle: 'kart', num: 17, skill: 0.95, flick: 0.3, driftK: 1 / 42 },
  { name: 'Achterberg', vehicle: 'rocket', num: 88, skill: 0.92, flick: 0.24, driftK: 1 / 50 },
  { name: 'Patel', vehicle: 'tuktuk', num: 4, skill: 0.93, flick: 0.32, driftK: 1 / 48 },
  { name: 'Rossi', vehicle: 'icecream', num: 21, skill: 0.92, flick: 0.3, driftK: 1 / 58 },
  { name: "O'Brien", vehicle: 'firetruck', num: 51, skill: 0.91, flick: 0.28, driftK: 1 / 62 }
];
export const MAX_RIVALS = 3 + MORE_RIVALS.length, DEFAULT_RIVALS = 3;
const asVehicle = (d, v) => ({ ...d, model: v.model, color: v.color, accent: v.accent, hw: v.hw, hl: v.hl, im: v.veh ? v.veh.im : undefined, veh: v.veh, vehicle: v.id });
/** The race's line-up with the player in vehicle v (data/vehicles.js) against `rivals` AI cars (1..MAX_RIVALS): the
 *  player gets v's livery, body, hitbox and handling. A rival whose car the player took drives the player's usual coupe
 *  instead. Up to three rivals it's the classic four-car field; a bigger field lines up with the player at the back. */
export function raceDefs(v, rivals = DEFAULT_RIVALS) {
  const coupe = CAR_DEFS.find(d => d.player), n = Math.max(1, Math.min(MAX_RIVALS, rivals));
  const swap = d => d.model === v.model && v.model !== 'coupe' ? { ...d, model: coupe.model } : d;
  const base = CAR_DEFS.filter(d => !d.player).slice(0, n).map(swap);
  const more = MORE_RIVALS.slice(0, Math.max(0, n - 3)).map(d => d.vehicle === v.id ? { ...d, ...coupeOf(d, coupe) } : asVehicle(d, vehicleById(d.vehicle)));
  const me = asVehicle(coupe, v);
  if (n <= 3) { const out = CAR_DEFS.filter(d => d.player || base.some(b => b.name === d.name)); return out.map(d => d.player ? me : base.find(b => b.name === d.name)); }
  return [...base, ...more, me];
}
// a rival whose vehicle the player took: the standard coupe in a livery of its own
function coupeOf(d, coupe) { const own = vehicleById(d.vehicle); return { model: coupe.model, color: own.color, accent: own.accent, vehicle: 'coupe' }; }
