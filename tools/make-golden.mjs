// Record tests/golden.json from a given core (default: the legacy single-file game).
import fs from 'node:fs';
import { loadLegacyCore } from './legacy-core.js';
import { raceScenario, wallScenario, trainScenario } from '../tests/scenarios.js';
const M = loadLegacyCore(process.argv[2] || 'index.html');
const out = { races: {}, walls: {}, train: null };
M.STAGES.forEach((st, si) => { out.races[st.name] = raceScenario(M, si); process.stdout.write(st.name + ' '); });
for (const [si, wt, sp] of [[0, 2, 25], [0, 1, 30], [0, 3, 20], [0, 2, 8], [5, 2, 36], [5, 1, 30], [6, 6, 30], [6, 2, 24], [6, 7, 20]]) out.walls[`s${si}w${wt}v${sp}`] = wallScenario(M, si, wt, sp);
out.train = trainScenario(M);
fs.writeFileSync('tests/golden.json', JSON.stringify(out, null, 1));
console.log('\nwritten tests/golden.json');
