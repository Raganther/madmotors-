// Behaviour lock: the simulation must reproduce tests/golden.json exactly (race results on every stage, wall and
// barrier hits, the train scenario). If a change is *meant* to alter behaviour, regenerate with `npm run golden`.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import M from './core-under-test.js';
import { raceScenario, wallScenario, trainScenario } from './scenarios.js';

const golden = JSON.parse(fs.readFileSync(new URL('./golden.json', import.meta.url)));

describe('races (AI on every stage)', () => {
  M.STAGES.forEach((st, si) => it(st.name, () => expect(raceScenario(M, si)).toEqual(golden.races[st.name])));
});
describe('walls and barriers', () => {
  for (const key of Object.keys(golden.walls)) {
    const [, si, wt, sp] = key.match(/s(\d+)w(\d+)v(\d+)/).map(Number);
    it(key, () => expect(wallScenario(M, si, wt, sp)).toEqual(golden.walls[key]));
  }
});
it('train wrecks a car parked on the crossing', () => expect(trainScenario(M)).toEqual(golden.train));
