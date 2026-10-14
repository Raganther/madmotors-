// Demolitions (npm run demolition -- [stage] [--car id]): each stage with `demolition` (core/modes/demolition.js) played
// by the AI at a casual and a good skill: how long it ran, every car's score, walls and buildings down, who was wrecked.
// Each should run to the clock with most buildings down by the heavy cars and something left for the light ones.
import * as M from '../src/core/index.js';
import { raceDefs } from '../src/data/cars.js';
import { VEHICLES, vehicleById } from '../src/data/vehicles.js';
const args = process.argv.slice(2), ci = args.indexOf('--car'), car = ci >= 0 ? args.splice(ci, 2)[1] : 'coupe';
const want = args[0], stages = M.STAGES.filter(s => s.demolition && (!want || s.name.toLowerCase().includes(want.toLowerCase())));
for (const S of stages) {
  const tr = M.buildTrack(S), W = { tr, terr: M.buildTerrain(tr, S), surf: S.surface, armco: S.armco };
  W.obst = M.placeObstacles(tr, W.terr, S);
  console.log(`== ${S.name}: ${tr.structures.length} buildings, ${S.demolition.time || M.DEMO.TIME} s`);
  for (const skill of [0.88, 0.95]) {
    const defs = raceDefs(vehicleById(car) || VEHICLES[0], 5).map(d => ({ ...d, skill }));
    const R = M.createRace(W, defs, { mode: 'demolition' }); R.phase = 'racing'; R.autoPlayer = true;
    let n = 0; while (R.derby.phase === 'run' && n++ < 120 * 400) { M.raceStep(R, M.STEP, W); for (const c of R.cars) c.events.length = 0; }
    const D = R.demo, down = R.st.blds.filter(o => o.collapsed).length, bays = R.st.blds.reduce((a, o) => a + o.bays.filter(b => b.fallen).length, 0), nb = R.st.blds.reduce((a, o) => a + o.bays.length, 0), cells = R.st.blds.reduce((a, o) => a + o.down, 0), all = R.st.blds.reduce((a, o) => a + o.cells, 0);
    console.log(`  skill ${skill}: ${R.derby.t.toFixed(1)} s, ${down}/${R.st.blds.length} buildings down, ${bays}/${nb} bays, ${Math.round(100 * cells / all)}% of the walls`);
    for (const c of M.derbyOrder(R)) { const k = R.cars.indexOf(c); console.log(`    ${(c.name + (c.isPlayer ? ' (you)' : '')).padEnd(18)} ${(c.def.vehicle || c.def.model || '').toString().padEnd(10)} ${String(D.pts[k]).padStart(4)} pts  ${String(D.walls[k]).padStart(3)} wall bits ${D.razed[k]} down  ${c.out ? 'wrecked' : Math.round(100 * M.health(c)) + '%'}`); }
  }
}
