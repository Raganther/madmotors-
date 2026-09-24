// Drive an element sandbox (or a stage) with four AI cars for one lap and report what happened around each element:
// markers, lap times, air time, wrecks, respawns and the events the features raised. Also writes the layout map.
//   npm run sandbox -- <name>|all       (names: see src/data/sandboxes/index.js; or a stage number/name)
import { execFileSync } from 'node:child_process';
import * as M from '../src/core/index.js';
import { SANDBOXES } from '../src/data/sandboxes/index.js';
import { stageArg } from './stage-arg.js';

const DEFS = [{ name: 'Okafor', skill: 0.95, flick: 0.38, driftK: 1 / 62 }, { name: 'Lindqvist', skill: 0.99, flick: 0.22, driftK: 1 / 38 }, { name: 'You', player: true }, { name: 'Vasquez', skill: 0.92, flick: 0.28, driftK: 1 / 50 }];
let seed = 7; Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };   // repeatable runs

function report(arg) {
  const { stage, id } = stageArg(SANDBOXES[arg] ? 'sandbox:' + arg : arg);
  const tr = M.buildTrack(stage), terr = M.buildTerrain(tr, stage), W = { tr, terr, surf: stage.surface, armco: !!stage.armco, traffic: stage.traffic };
  const N = tr.loopN || tr.N, marks = M.trackMarkers(tr);
  console.log(`\n== ${stage.name} (${id}): ${N} m a lap${tr.loopN ? `, ${tr.laps} laps` : ''}`);
  for (const m of marks) console.log(`   ${m.element.padEnd(9)} @${String(m.i).padStart(5)}  ${m.label}`);
  const R = M.createRace(W, DEFS); R.phase = 'racing'; R.autoPlayer = true;
  const lapEnd = tr.startIdx + N, counts = {}, air = [], perEl = {};
  const near = i => { let best = null; for (const m of marks) { const d = ((i - m.i) % N + N) % N; if (d < 80 && (!best || d < best.d)) best = { d, m }; } return best && best.m; };
  let t = 0; const done = new Map(), takeoff = R.cars.map(() => 0);
  while (t < 240 && done.size < R.cars.length) {
    M.raceStep(R, 1 / 120, W); t += 1 / 120;
    R.cars.forEach((c, k) => { if (!c.onGround && c.airT === 0) takeoff[k] = c.pr.i; if (!done.has(c) && c.progress >= lapEnd) done.set(c, t); });
    for (const c of R.cars.concat(R.traffic, R.parked || [])) {
      for (const e of c.events) {
        counts[e.t] = (counts[e.t] || 0) + 1;
        if (e.t === 'land' && e.air > 0.25) air.push(e.air);
        if (['wreck', 'respawn', 'trainhit', 'rockhit', 'destroyed', 'cowhit', 'oil'].includes(e.t)) { const m = near(c.pr.i % N); const k = m ? m.label : 'open road'; (perEl[k] = perEl[k] || {})[e.t] = (perEl[k][e.t] || 0) + 1; }
      }
      c.events.length = 0;
    }
  }
  console.log(`   lap: ${[...done.values()].map(v => v.toFixed(1) + 's').join(' ')}${done.size < R.cars.length ? ` (${R.cars.length - done.size} did not finish in 240 s)` : ''}`);
  if (air.length) console.log(`   air: ${air.length} jumps, ${Math.min(...air).toFixed(2)}-${Math.max(...air).toFixed(2)} s`);
  for (const [k, v] of Object.entries(perEl)) console.log(`   near ${k}: ${Object.entries(v).map(([e, n]) => `${n} ${e}`).join(', ')}`);
  const shown = ['bump', 'hit', 'smash', 'wreck', 'respawn', 'trainhit', 'rockhit', 'destroyed', 'takedown', 'hazard', 'cowhit', 'oil', 'bigair'].filter(k => counts[k]);
  console.log(`   events: ${shown.map(k => `${k} ${counts[k]}`).join(', ') || 'none'}`);
  try { execFileSync('node', ['tools/layout.mjs', SANDBOXES[arg] ? 'sandbox:' + arg : arg], { stdio: 'ignore' }); console.log(`   map: tools/out/layout-${id}.svg`); } catch (e) { console.log('   (layout map failed: ' + e.message + ')'); }
}
const arg = process.argv[2] || 'all';
for (const a of arg === 'all' ? Object.keys(SANDBOXES) : [arg]) report(a);
