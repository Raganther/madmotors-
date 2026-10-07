// Disciplines and ratings (G1): data/disciplines.js, data/ratings.js, measured by `npm run ratings` (tools/ratings.mjs).
import { describe, expect, it } from 'vitest';
import { RATINGS, BANDS, paceBand, paceOf, ratingOf, toughBand, toughOfBuild } from '../src/data/ratings.js';
import { DISCIPLINES, DISC_IDS, discsOf, entryOK, entryWhy } from '../src/data/disciplines.js';
import { VEHICLES } from '../src/data/vehicles.js';
import { ratingsKey } from '../tools/ratings-key.js';

describe('ratings', () => {
  it('were measured from today\'s vehicles and physics (if not: npm run ratings, and commit src/data/ratings-data.js)', () => {
    expect(RATINGS.key).toBe(ratingsKey());
    for (const v of VEHICLES) expect(RATINGS.cars[v.id], v.id).toBeTruthy();
  });
  it('the coupe is the yardstick: pace 0 on both surfaces, toughness 1', () => {
    expect(RATINGS.cars.coupe).toEqual({ tarmac: 0, loose: 0, tough: 1 });
    expect(ratingOf('coupe').bands).toEqual({ tarmac: 'B', loose: 'B', pace: 'B', tough: 'C' });
  });
  it('specialists rate where their role says: loose-surface cars on loose ground, heavies for toughness', () => {
    for (const id of ['rover', 'hover', 'snowcat', 'buggy', 'monster']) expect(ratingOf(id).bands.loose, id).toBe('S');
    for (const id of ['monster', 'mixer', 'firetruck']) expect(['A', 'S'], id).toContain(ratingOf(id).bands.tough);
    expect(['C', 'D']).toContain(ratingOf('formula').bands.loose); expect(['C', 'D']).toContain(ratingOf('kart').bands.tough);
    expect(BANDS).toEqual(['D', 'C', 'B', 'A', 'S']); expect(paceBand(-10)).toBe('S'); expect(paceBand(10)).toBe('D'); expect(toughBand(2)).toBe('S'); expect(toughBand(0.5)).toBe('D');
  });
  it('a build moves the ratings: engine and tyres for pace, a cage and armour for toughness', () => {
    expect(paceOf('coupe', { eng: 3 })).toBeLessThan(-2); expect(paceOf('coupe', { eng: 3 }, 'loose')).toBeLessThan(-2);
    expect(paceOf('coupe', { sus: 3 }, 'loose')).toBeLessThan(paceOf('coupe', { sus: 3 }, 'tarmac'));
    expect(toughOfBuild('coupe', { cage: 3 })).toBeCloseTo(1.36); expect(toughOfBuild('coupe', { arm: 3 })).toBeGreaterThan(1.1);
    expect(ratingOf('coupe', { eng: 3, tyr: 3 }).bands.tarmac).toBe('S');
  });
});
describe('disciplines', () => {
  it('every vehicle is in at least one; derby is earned by toughness, so a roll cage can get a coupe in', () => {
    for (const v of VEHICLES) expect(discsOf(v.id).length, v.id).toBeGreaterThan(0);
    for (const d of DISC_IDS) for (const id of DISCIPLINES[d].cars || []) expect(VEHICLES.some(v => v.id === id), `${d}: ${id}`).toBe(true);
    expect(discsOf('mixer')).toContain('derby'); expect(discsOf('coupe')).not.toContain('derby'); expect(discsOf('coupe', { cage: 3 })).toContain('derby');
  });
  it('an entry: the discipline, then any caps on pace (on the discipline\'s surface) and toughness', () => {
    expect(entryOK({}, 'kart')).toBe(true); expect(entryOK({ disc: 'oddball' }, 'kart')).toBe(true); expect(entryOK({ disc: 'oddball' }, 'coupe')).toBe(false);
    expect(entryOK({ disc: 'road', maxPace: 'B' }, 'coupe')).toBe(true); expect(entryOK({ disc: 'road', maxPace: 'B' }, 'coupe', { eng: 3 })).toBe(false);
    expect(entryOK({ disc: 'offroad', maxPace: 'A' }, 'rover')).toBe(false); expect(entryOK({ disc: 'heavy', maxTough: 'A' }, 'mixer')).toBe(false);
    expect(entryWhy({ disc: 'road', maxPace: 'B' }, 'coupe', { eng: 3 })).toMatch(/pace B \(yours is S\)/); expect(entryWhy({ disc: 'oddball' }, 'coupe')).toMatch(/Oddball/);
  });
});
