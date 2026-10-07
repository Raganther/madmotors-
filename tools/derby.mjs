// Derby check (npm run derby -- [arena,...] [--cars n] [--v]): a derby in each arena (stages with `arena`) with the AI in
// every car at a casual and a good skill: how long it lasted, who went out when, who won, and how many were still
// running at the bell. A derby should end with a winner well inside the time limit (core/modes/derby.js DERBY.TIME).
import * as M from '../src/core/index.js';
import { raceDefs } from '../src/data/cars.js';
import { vehicleById } from '../src/data/vehicles.js';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const want = (args[0] && !args[0].startsWith('--') ? args[0].split(',') : null), N = +opt('cars', 6);
const arenas = M.STAGES.filter(s => s.arena && (!want || want.some(w => s.name.toLowerCase().includes(w.toLowerCase()))));
export function simDerby(st, defs, skill, seed0 = 7) {
  let seed = seed0; Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const tr = M.buildTrack(st), W = { tr, terr: M.buildTerrain(tr, st), surf: st.surface, armco: !!st.armco };
  const R = M.createRace(W, defs, { mode: 'derby', weapons: true }); R.phase = 'racing'; R.autoPlayer = true; R.player.ai.skill = skill;
  const outs = [], ev = {}; let t = 0;
  while (t < M.DERBY.TIME + 5 && R.derby.phase === 'run') {
    M.raceStep(R, M.STEP, W); t += M.STEP;
    for (const c of R.cars) { for (const e of c.events) { ev[e.t] = (ev[e.t] || 0) + 1; if (e.t === 'derby-out') outs.push(`${c.name} ${t.toFixed(0)}s`); } c.events.length = 0; }
  }
  return { t, outs, winner: R.cars[R.derby.winner].name, left: R.cars.filter(c => !c.out).length, ev };
}
if (process.argv[1] && process.argv[1].endsWith('derby.mjs')) {
  for (const st of arenas) for (const sk of [0.88, 0.95]) {
    const defs = raceDefs(vehicleById('monster'), N - 1), r = simDerby(st, defs, sk);
    console.log(`${st.name.padEnd(15)} skill ${sk}: ${r.left > 1 ? 'TIME UP' : 'won'} at ${r.t.toFixed(0)}s by ${r.winner}, ${r.left} running; out: ${r.outs.join(', ')}`);
    if (args.includes('--v')) console.log('   events', JSON.stringify(r.ev));
  }
}
