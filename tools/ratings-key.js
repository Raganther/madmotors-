// What the ratings (src/data/ratings-data.js, `npm run ratings`) were measured from: every vehicle's handling and hitbox,
// the car physics and the damage numbers. If any of it changes, the key changes and tests/ratings.test.js says the
// ratings are stale (run `npm run ratings` again and commit the file).
import { VEHICLES } from '../src/data/vehicles.js';
import { PHYS, CAR_HW, CAR_HL } from '../src/core/constants.js';
import { DMG_K } from '../src/core/sim/damage.js';

export function ratingsKey() {
  const s = JSON.stringify([VEHICLES.map(v => [v.id, v.veh || null, v.hw || CAR_HW, v.hl || CAR_HL]), PHYS, DMG_K]);
  let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }   // FNV-1a
  return h.toString(16).padStart(8, '0');
}
