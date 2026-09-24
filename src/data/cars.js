// ---------- traffic ----------
// Civilian vehicles: oncoming (driving back up the hill in the other lane) and slow same-way cars to pass.
// They spawn ahead of the player and are removed once well behind; wrecked ones stay where they stopped.
export const TRAFFIC_KINDS = [
  { kind: 'hatch', hw: 0.95, hl: 1.7, im: 1, w: 5 },
  { kind: 'van', hw: 1.05, hl: 2.25, im: 0.65, w: 3 },
  { kind: 'truck', hw: 1.2, hl: 3.1, im: 0.4, w: 2 }
];
export const TRAFFIC_COLORS = [0xF2F2EE, 0x9CB4C9, 0x5E6B7A, 0xC9B79C, 0x7A9A6E, 0xB84A4A, 0x3E5C8C, 0xE6D38A];
export const CAR_DEFS = [
  { name: 'Okafor', color: 0xE0402F, accent: 0xFFFFFF, num: 3, skill: 0.95, flick: 0.38, driftK: 1 / 62 },
  { name: 'Lindqvist', color: 0x2F7DE0, accent: 0xFFC72C, num: 11, skill: 0.99, flick: 0.22, driftK: 1 / 38 },
  { name: 'You', color: 0xFFC72C, accent: 0x1C2340, num: 7, player: true },
  { name: 'Vasquez', color: 0x2FB36B, accent: 0xFFFFFF, num: 24, skill: 0.92, flick: 0.28, driftK: 1 / 50 }
];
