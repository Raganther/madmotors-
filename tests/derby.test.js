// The derby (G3): core/modes/derby.js on an arena (core/elements/arena.js).
import { describe, expect, it } from 'vitest';
import M from './core-under-test.js';
import { seedRandom } from './scenarios.js';
import { BREAKABLES } from '../src/data/breakables.js';

const arenaStage = name => M.STAGES.find(s => s.name === name);
const world = st => { const tr = M.buildTrack(st), terr = M.buildTerrain(tr, st); return { tr, terr, W: { tr, terr, surf: st.surface, armco: !!st.armco } }; };
const DEFS = [{ name: 'a', skill: 0.95 }, { name: 'b', skill: 0.92, vehicle: 'monster', model: 'monster', veh: { accel: 0.98, top: 0.945, grip: 0.95, off: 1.3, im: 0.55, tough: 1.5 }, im: 0.55 }, { name: 'p', player: true }, { name: 'c', skill: 0.9 }, { name: 'd', skill: 0.93 }];

describe('arenas', () => {
  for (const name of ['Scrapyard Bowl', 'Mud Pit', 'The Stadium']) it(`${name}: a flat floor inside an unbreakable ring, props on the floor, nothing growing on it`, () => {
    const st = arenaStage(name), { tr, terr } = world(st), A = tr.arena;
    expect(A).toBeTruthy(); expect(A.r).toBeGreaterThan(30);
    const ring = tr.breakables.filter(b => b.arena && BREAKABLES[b.kind].hp === Infinity), props = tr.breakables.filter(b => b.arena && BREAKABLES[b.kind].hp < Infinity);
    expect(ring.length).toBeGreaterThan(40); for (const b of ring) expect(Math.abs(Math.hypot(b.x - A.x, b.z - A.z) - A.r)).toBeLessThan(0.5);
    expect(props.length).toBeGreaterThan(3); for (const b of props) expect(Math.hypot(b.x - A.x, b.z - A.z)).toBeLessThan(A.r - 3);
    for (let a = 0; a < 6.28; a += 0.5) for (const f of [0.1, 0.5, 0.85]) { const x = A.x + Math.sin(a) * A.r * f, z = A.z + Math.cos(a) * A.r * f; expect(terr.at(x, z) - A.floor).toBeGreaterThan(-0.2); expect(terr.at(x, z) - A.floor).toBeLessThan(1.6); }
    for (const o of terr.obst.items || terr.obst) expect(Math.hypot(o.x - A.x, o.z - A.z)).toBeGreaterThan(A.r + 3);
  });
});
describe('the derby', () => {
  const derby = (st, secs = 160) => { seedRandom(11); const { W } = world(st), R = M.createRace(W, DEFS, { mode: 'derby' }); R.phase = 'racing'; R.autoPlayer = true; const outs = [];
    for (let t = 0; t < secs && R.derby.phase === 'run'; t += M.STEP) { M.raceStep(R, M.STEP, W); for (const c of R.cars) { for (const e of c.events) if (e.t === 'derby-out' || e.t === 'derby-over') outs.push([e.t, c.name, R.time]); c.events.length = 0; } }
    return { R, outs }; };
  it('ends with one car running and a winner well inside the time; the wrecked stay out, damage doesn\'t mend', () => {
    const { R, outs } = derby(arenaStage('Scrapyard Bowl'));
    expect(R.derby.phase).toBe('over'); expect(R.derby.t).toBeLessThan(M.DERBY.TIME);
    expect(R.cars.filter(c => !c.out).length).toBeLessThanOrEqual(1); expect(R.derby.out.length).toBeGreaterThanOrEqual(R.cars.length - 1);
    expect(M.derbyOrder(R)[0]).toBe(R.cars[R.derby.winner]); expect(outs.filter(o => o[0] === 'derby-out').length).toBe(R.derby.out.length);
    for (const c of R.cars.filter(c => c.out)) expect(c.wreckT).toBeGreaterThan(1e6);
  });
  it('the order: survivors by health, then the wrecked, last out first; races without it are untouched', () => {
    const { R } = derby(arenaStage('The Stadium'), 20), ord = M.derbyOrder(R), alive = ord.filter(c => !c.out);
    for (let i = 1; i < alive.length; i++) expect(M.health(alive[i - 1])).toBeGreaterThanOrEqual(M.health(alive[i]));
    expect(ord.slice(alive.length).map(c => R.cars.indexOf(c))).toEqual(R.derby.out.slice().reverse());
    const { W } = world(arenaStage('The Stadium')), plain = M.createRace(W, DEFS); expect(plain.derby).toBeUndefined(); expect(plain.cars[0].dmgK).toBeUndefined();
  });
});
