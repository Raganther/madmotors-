// Quick Race line-ups (data/cars.js stageDefs): rivals in cars that suit the stage, every rival there in a full field.
import { describe, expect, it } from 'vitest';
import { MAX_RIVALS, stageDefs, suitedGroups } from '../src/data/cars.js';
import { vehicleById } from '../src/data/vehicles.js';
import { STAGES } from '../src/data/stages/index.js';

describe('line-ups that suit the stage', () => {
  it('a small field is all from the groups that suit the stage, the player third', () => {
    for (const name of ['Old Town GP', 'Bogwood Rally', 'Frostpeak']) {
      const st = STAGES.find(s => s.name === name), d = stageDefs(vehicleById('coupe'), 3, st), want = suitedGroups(st);
      expect(d[2].player, name).toBe(true);
      for (const r of d.filter(x => !x.player)) expect(want, `${name}: ${r.vehicle}`).toContain(vehicleById(r.vehicle).group);
    }
  });
  it('a full field has every rival, whichever car the player took', () => {
    for (const v of ['coupe', 'kart', 'hatch', 'gt']) { const d = stageDefs(vehicleById(v), MAX_RIVALS, STAGES[0]); expect(d.length).toBe(MAX_RIVALS + 1); expect(new Set(d.map(x => x.name)).size).toBe(MAX_RIVALS + 1); }
  });
});
