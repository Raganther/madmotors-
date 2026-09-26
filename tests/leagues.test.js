import { describe, it, expect } from 'vitest';
import { LEAGUES, LEAGUE_POINTS, LEAGUE_RIVALS, newLeague, scoreRound, standings, leagueDone } from '../src/data/leagues.js';
import { STAGES } from '../src/data/stages/index.js';
import { raceDefs } from '../src/data/cars.js';
import { vehicleById } from '../src/data/vehicles.js';

describe('leagues', () => {
  it('every round names a real stage', () => {
    for (const L of LEAGUES) for (const n of L.stages) expect(STAGES.some(s => s.name === n), `${L.name}: ${n}`).toBe(true);
  });
  it('the league field has a points place for everyone', () => {
    expect(raceDefs(vehicleById('coupe'), LEAGUE_RIVALS).length).toBe(LEAGUE_POINTS.length);
  });
  it('scores rounds, orders the table and knows when it is over', () => {
    let run = newLeague('rookie');
    run = scoreRound(run, ['A', 'You', 'B']);
    run = scoreRound(run, ['You', 'A', 'B']);
    expect(run.pts).toEqual({ A: 18, You: 18, B: 12 });
    expect(standings(run).map(s => s.name)).toEqual(['You', 'A', 'B']);   // tie on points and wins: the last round decides
    expect(standings(run, ['C']).at(-1)).toEqual({ name: 'C', pts: 0, wins: 0 });
    expect(leagueDone(run)).toBe(false);
    run = scoreRound(scoreRound(run, ['B']), ['B']);
    expect(leagueDone(run)).toBe(true);
  });
});
