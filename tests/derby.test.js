// The derby (G3): core/modes/derby.js on an arena (core/elements/arena.js).
import { describe, expect, it } from 'vitest';
import M from './core-under-test.js';
import { seedRandom } from './scenarios.js';
import { BREAKABLES } from '../src/data/breakables.js';

const arenaStage = name => M.STAGES.find(s => s.name === name);
const world = st => { const tr = M.buildTrack(st), terr = M.buildTerrain(tr, st); return { tr, terr, W: { tr, terr, surf: st.surface, armco: !!st.armco } }; };
const DEFS = [{ name: 'a', skill: 0.95 }, { name: 'b', skill: 0.92, vehicle: 'monster', model: 'monster', veh: { accel: 0.98, top: 0.945, grip: 0.95, off: 1.3, im: 0.55, tough: 1.5 }, im: 0.55 }, { name: 'p', player: true }, { name: 'c', skill: 0.9 }, { name: 'd', skill: 0.93 }];

describe('arenas', () => {
  for (const name of ['Scrapyard Bowl', 'Mud Pit', 'The Stadium']) it(`${name}: a flat floor of its own shape inside unbreakable walls, props on the floor, nothing growing on it, the grid clear`, () => {
    const st = arenaStage(name), { tr, terr, W } = world(st), A = tr.arena;
    expect(A).toBeTruthy(); expect(A.walls.length).toBeGreaterThan(0);
    const rad = A.poly.map(([x, z]) => Math.hypot(x - A.x, z - A.z)); expect(Math.max(...rad) / Math.min(...rad)).toBeGreaterThan(1.2);   // not a circle
    const ring = tr.breakables.filter(b => b.arena && BREAKABLES[b.kind].hp === Infinity), props = tr.breakables.filter(b => b.arena && BREAKABLES[b.kind].hp < Infinity);
    expect(ring.length).toBeGreaterThan(40); for (const b of ring) expect(Math.abs(M.arenaWall(A, b.x, b.z).d)).toBeLessThan(0.5);
    expect(props.length).toBeGreaterThan(3); for (const b of props) { expect(M.inArena(A, b.x, b.z)).toBe(true); expect(M.arenaWall(A, b.x, b.z).d).toBeGreaterThan(3); }
    const xs = A.poly.map(p => p[0]), zs = A.poly.map(p => p[1]); let n = 0;
    for (let x = Math.min(...xs); x < Math.max(...xs); x += 4) for (let z = Math.min(...zs); z < Math.max(...zs); z += 4) if (M.inArena(A, x, z) && M.arenaWall(A, x, z).d > 2) { n++; const dy = terr.at(x, z) - A.floor; expect(dy).toBeGreaterThan(-0.5); expect(dy).toBeLessThan(1.6); }
    expect(n).toBeGreaterThan(100);
    for (const o of terr.obst.items || terr.obst) expect(M.arenaOut(A, o.x, o.z)).toBeGreaterThan(3);
    const R = M.createRace(W, Array.from({ length: 13 }, (_, k) => ({ name: 'c' + k, skill: 0.9 })), { mode: 'derby' });
    for (const c of R.cars) expect(M.arenaWall(A, c.x, c.z).d).toBeGreaterThan(2);   // a full field lines up inside, off the walls
  });
  it('Mud Pit: its wallows drive as mud and its pond as a ford; the floor round them is the stage surface', () => {
    const { tr, W } = world(arenaStage('Mud Pit')), A = tr.arena, R = M.createRace(W, DEFS), c = R.cars[0];
    expect(A.pits.map(p => p.kind).sort()).toEqual(['mud', 'mud', 'water']);
    for (const p of A.pits) { c.x = p.x; c.z = p.z; M.raceStep(R, M.STEP, W); expect(c.surface).toBe(p.kind === 'water' ? 'ford' : 'mud'); expect(M.arenaPit(A, p.x, p.z)).toBe(p); }
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
    const out = R.cars.find(c => c.out), at = [out.x, out.z]; M.respawn(out, world(arenaStage('Scrapyard Bowl')).W); expect([out.x, out.z]).toEqual(at);   // Reset does nothing once you're out: the wreck stays put
  });
  it('the order: survivors by health, then the wrecked, last out first; races without it are untouched', () => {
    const { R } = derby(arenaStage('The Stadium'), 20), ord = M.derbyOrder(R), alive = ord.filter(c => !c.out);
    for (let i = 1; i < alive.length; i++) expect(M.health(alive[i - 1])).toBeGreaterThanOrEqual(M.health(alive[i]));
    expect(ord.slice(alive.length).map(c => R.cars.indexOf(c))).toEqual(R.derby.out.slice().reverse());
    const { W } = world(arenaStage('The Stadium')), plain = M.createRace(W, DEFS); expect(plain.derby).toBeUndefined(); expect(plain.cars[0].dmgK).toBeUndefined();
  });
});
