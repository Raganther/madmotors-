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

/** The race's line-up with the player in vehicle v (data/vehicles.js): their livery, body, hitbox and handling. A rival
 *  whose car the player took drives the player's usual coupe instead. */
export function raceDefs(v) {
  const coupe = CAR_DEFS.find(d => d.player);
  return CAR_DEFS.map(d => {
    if (d.player) return { ...d, model: v.model, color: v.color, accent: v.accent, hw: v.hw, hl: v.hl, im: v.veh ? v.veh.im : undefined, veh: v.veh, vehicle: v.id };
    return d.model === v.model && v.model !== 'coupe' ? { ...d, model: coupe.model } : d;
  });
}
