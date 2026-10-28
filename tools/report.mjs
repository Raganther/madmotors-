// Track report cards (core/track/report.js): each stage's lap time, flat-out share, corners, moments and the design
// pillars it meets, worst first, so we know which tracks need work. The Track Viewer (?viewer) shows the same card.
//   npm run report                 every stage, ranked
//   npm run report -- <stage>      one stage in full: its moments along the lap
import { buildTerrain, buildTrack, trackReport } from '../src/core/index.js';
const card = st => { const tr = buildTrack(st); return trackReport(tr, st, buildTerrain(tr, st)); };
import { STAGES } from '../src/data/stages/index.js';
import { stageArg } from './stage-arg.js';

const arg = process.argv[2], fmt = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
if (arg && arg !== 'all') {
  const { stage } = stageArg(arg), R = card(stage);
  console.log(`${R.name} (${R.type}${R.type === 'circuit' ? `, ${R.laps} laps` : ''}): ${R.len} m, about ${fmt(R.time)} a lap, ${Math.round(R.flat * 100)}% flat out, climbs ${R.climb.toFixed(0)} m (${R.hMin.toFixed(0)}..${R.hMax.toFixed(0)} m)`);
  console.log(`  corners: ${Object.entries(R.corners).map(([k, v]) => `${v} ${k}`).join(', ')}; crossings ${R.crossings}`);
  console.log('  moments:'); for (const m of R.moments) console.log(`    ${String(m.i - R.i0).padStart(5)} m  ${fmt(m.t).padStart(5)}  ${m.big ? '*' : ' '} ${m.kinds.join('+').padEnd(16)} ${m.label}`);
  console.log(`  pillars ${R.score}/${R.of}:`); for (const q of R.pillars) console.log(`    ${q.ok ? 'ok  ' : 'MISS'} ${q.name.padEnd(26)} ${q.val}${q.ok ? '' : '  -> ' + q.tip}`);
} else {
  const rows = STAGES.filter(s => !s.arena).map(s => { try { return card(s); } catch (e) { return { name: s.name, err: e.message }; } });
  rows.sort((a, b) => (a.score ?? -1) - (b.score ?? -1) || (b.dead ?? 0) - (a.dead ?? 0));
  console.log('score  stage                       lap    flat  moments/min  quiet   kinds                       missing');
  for (const R of rows) {
    if (R.err) { console.log(`  ?    ${R.name}: ${R.err}`); continue; }
    console.log(`${String(R.score).padStart(2)}/${R.of}   ${R.name.padEnd(27)} ${fmt(R.time).padStart(5)}  ${String(Math.round(R.flat * 100)).padStart(3)}%  ${R.perMin.toFixed(1).padStart(6)}      ${R.dead.toFixed(0).padStart(3)} s   ${R.kinds.join(',').padEnd(27)} ${R.pillars.filter(q => !q.ok).map(q => q.id).join(' ')}`);
  }
}
