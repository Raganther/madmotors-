// Car families (G6): cars from a shared chassis (data/families.js), drawn by render/families.js (Classic) and
// blender/chassis.py (Blender) from the same numbers.
import { describe, expect, it } from 'vitest';
import { FAMILIES, FAMILY_CARS, FAMILY_IDS, chassisOf } from '../src/data/families.js';
import { VEHICLES } from '../src/data/vehicles.js';
import { MORE_RIVALS } from '../src/data/cars.js';
import { SHOP } from '../src/data/career.js';
import { discsOf } from '../src/data/disciplines.js';
import { RATINGS } from '../src/data/ratings.js';
import { CAR_HL, CAR_HW } from '../src/core/constants.js';

describe('car families', () => {
  it('a car takes its family\'s chassis and changes only what it names', () => {
    const e = chassisOf('estate'), s = FAMILIES.saloon;
    expect(e.L).toBe(s.L); expect(e.cab.zr).toBe(FAMILY_CARS.estate.cab.zr); expect(e.cab.rake).toBe(s.cab.rake); expect(e.extras).toEqual(['box', 'lamps', 'flaps']);
    expect(chassisOf('nope')).toBe(null);
  });
  it('every family car is in the garage with a rival who drives it, a showroom price, a discipline and measured ratings', () => {
    for (const id of FAMILY_IDS) {
      const v = VEHICLES.find(x => x.id === id); expect(v, id).toBeTruthy(); expect(v.model).toBe(id);
      expect(MORE_RIVALS.some(d => d.vehicle === id), id).toBe(true); expect(SHOP[id], id).toBeTruthy();
      expect(discsOf(id).length, id).toBeGreaterThan(0); expect(RATINGS.cars[id], id).toBeTruthy();
    }
  });
  it('every chassis fits the hitbox and keeps its wheels under the body', () => {
    for (const id of FAMILY_IDS) {
      const P = chassisOf(id), v = VEHICLES.find(x => x.id === id), [x, zf, zr, r, w] = P.wheels;
      expect(P.W / 2, id).toBeLessThanOrEqual((v.hw || CAR_HW) + 0.35); expect(x + w / 2, id).toBeLessThanOrEqual((v.hw || CAR_HW) + 0.35);
      expect(P.L + 0.17, id).toBeLessThanOrEqual((v.hl || CAR_HL) + 0.35);
      expect(zf, id).toBeLessThan(P.L); expect(-zr, id).toBeLessThan(P.L); expect(P.cab.zf, id).toBeGreaterThan(P.cab.zr);
      expect(r, id).toBeGreaterThan(P.base * 0.5); expect(P.cab.roof, id).toBeGreaterThan(P.deck);
    }
  });
});
