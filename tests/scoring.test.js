// Event formats and scoring (G2): data/formats.js, data/scoring.js, and the career paying for destruction.
import { describe, expect, it } from 'vitest';
import { FORMATS, RACE_PTS, destructPts, formatOf } from '../src/data/formats.js';
import { ATTRIB, newTally, scoreOrder, tallyEvent } from '../src/data/scoring.js';
import { TIERS, eventById, newCareer, scoreRace } from '../src/data/career.js';

const cars = ['a', 'b', 'p', 'c'].map(name => ({ name })), PI = 2;
const feed = (t, list) => { for (const [k, e, now] of list) tallyEvent(t, cars, cars[k], e, now, PI); return t; };
describe('the race tally', () => {
  it('blames a wreck or a torn-off panel on whoever hit the car last, within ATTRIB seconds', () => {
    const t = feed(newTally(4), [
      [0, { t: 'door-hit', by: PI }, 1], [0, { t: 'wreck' }, 2],                                  // the player doors a, a wrecks: the player's
      [1, { t: 'missile-hit', from: 3 }, 1], [1, { t: 'dent', panels: [['bonnet', 2], ['boot', 1]] }, 1.5],   // c's missile tears b's bonnet off
      [3, { t: 'bump', a: cars[3], b: cars[0] }, 5], [0, { t: 'wreck' }, 5 + ATTRIB + 1],         // too long after: nobody's
      [PI, { t: 'break', kind: 'fence' }, 6], [PI, { t: 'takedown', kind: 'car' }, 7], [PI, { t: 'bigair' }, 7], [0, { t: 'oil-hit', from: PI }, 8],
    ]);
    expect(t.d[PI]).toEqual({ wrecked: 1, panels: 0, smashed: 1, takedowns: 1 }); expect(t.d[3]).toEqual({ wrecked: 0, panels: 1, smashed: 0, takedowns: 0 });
    expect(t.d[0].wrecked + t.d[1].wrecked).toBe(0); expect(t.air).toBe(1); expect(t.hits).toBe(2);
  });
  it('a race is the finishing order; a destruction format re-sorts it by race points and destruction', () => {
    const t = newTally(4); t.d[3].wrecked = 2;                                                 // c finished last but wrecked two
    expect(scoreOrder(cars, cars, t, 'race').map(r => r.c.name)).toEqual(['a', 'b', 'p', 'c']);
    const bang = scoreOrder(cars, cars, t, 'banger');
    expect(bang[0].c.name).toBe('c'); expect(bang.find(r => r.c.name === 'c').total).toBeCloseTo(RACE_PTS[3] + 8 * FORMATS.banger.weight.destruct);
    expect(bang.slice(1).map(r => r.c.name)).toEqual(['a', 'b', 'p']);
    expect(destructPts({ wrecked: 0, panels: 0, smashed: 2, takedowns: 0 }, 'demolition')).toBeGreaterThan(destructPts({ wrecked: 0, panels: 0, smashed: 2, takedowns: 0 }, 'banger'));
  });
});
describe('formats in the career', () => {
  it('every event has a known format; the ones that need an unbuilt mode are not used yet', () => {
    for (const T of TIERS) for (const ev of T.events) { expect(FORMATS[formatOf(ev)], ev.id).toBeTruthy(); expect(FORMATS[formatOf(ev)].soon, ev.id).toBeFalsy(); }
    expect(formatOf(eventById('heavyweights'))).toBe('banger'); expect(formatOf(eventById('seaside-double'))).toBe('demolition'); expect(formatOf(eventById('rookie-cup'))).toBe('race');
  });
  it('destruction pays only where the format weighs it', () => {
    const t = { air: 0, drift: 0, hits: 0, wrecks: 1, respawns: 0, wrecked: 2, panels: 1, smashed: 3, takedowns: 0 };
    const race = scoreRace(newCareer('coupe'), eventById('rookie-cup'), 0, 3, 8, t), demo = scoreRace(newCareer('coupe'), eventById('seaside-double'), 0, 3, 8, t);
    expect(race.lines.some(l => /wrecked|smashed/.test(l[0]))).toBe(false);
    expect(demo.lines.find(l => l[0].startsWith('Rivals wrecked'))[1]).toBeGreaterThan(0); expect(demo.cash).toBeGreaterThan(race.cash);
  });
});
