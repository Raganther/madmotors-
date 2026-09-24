// Top-down plan of a stage's road: colour = height, white = bridge, black = tunnel, blue = river, orange = railway.
// Also reports places where two different parts of the road pass close to each other (and how far apart in height).
//   node tools/layout.mjs [stage]            -> tools/out/layout-<stage>.svg
import fs from 'node:fs';
import { buildTrack, railAt, trackMarkers } from '../src/core/index.js';
import { stageArg } from './stage-arg.js';

const { stage: st, id: sid } = stageArg(process.argv[2]), tr = buildTrack(st), N = tr.loopN || tr.N;
const X = [], Z = []; for (let i = 0; i < N; i++) { X.push(tr.xs[i]); Z.push(tr.zs[i]); }
// screen axes: a = right, b = up (the game camera looks from +x+z)
const A = X.map((x, i) => (x - Z[i]) / Math.SQRT2), B = X.map((x, i) => -(x + Z[i]) / Math.SQRT2);
for (const m of trackMarkers(tr)) console.log(`  ${m.element.padEnd(9)} at ${String(m.i).padStart(5)}  ${m.label}`);
console.log(`${st.name}: ${N} samples per lap${tr.loopN ? `, ${tr.laps} laps` : ''}, height ${Math.min(...tr.H.slice(0, N)).toFixed(0)}..${Math.max(...tr.H.slice(0, N)).toFixed(0)} m`);
const seen = new Set();
for (let i = 0; i < N; i += 3) for (let j = i + 90; j < N; j += 3) {
  if (tr.loopN && N - (j - i) < 90) continue;
  const d = Math.hypot(A[i] - A[j], B[i] - B[j]); if (d >= 36) continue;
  const key = Math.round(i / 40) + ':' + Math.round(j / 40); if (seen.has(key)) continue; seen.add(key);
  console.log(`  close: sample ${i} and ${j}, ${d.toFixed(1)} m apart, height difference ${Math.abs(tr.H[i] - tr.H[j]).toFixed(1)} m${tr.bridge[i] || tr.bridge[j] ? ' (bridge)' : ''}`);
}
const all = [...A, ...B], mn = Math.min(...all), mx = Math.max(...all), pad = 40, S = 900, sc = S / (mx - mn + 2 * pad);
const px = a => (a - mn + pad) * sc, py = b => S - (b - mn + pad) * sc, hmin = Math.min(...tr.H.slice(0, N)), hmax = Math.max(...tr.H.slice(0, N));
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" style="background:#20242c;font-family:sans-serif">`;
if (st.river) svg += `<polyline points="${st.river.pts.map(([a, b]) => `${px(a)},${py(b)}`).join(' ')}" fill="none" stroke="#3f86c9" stroke-width="${st.river.width * sc}" opacity=".7"/>`;
if (tr.rails) for (const L of tr.rails.lines) { const pts = []; for (let s = 0; s <= L.len; s += 5) { const p = railAt(L, s); pts.push(`${px((p.x - p.z) / Math.SQRT2)},${py(-(p.x + p.z) / Math.SQRT2)}`); } svg += `<polyline points="${pts.join(' ')}" fill="none" stroke="#f39c32" stroke-width="2" stroke-dasharray="6 3"/>`; }
for (let i = 0; i < N; i++) {
  const j = (i + 1) % N; if (!tr.loopN && j === 0) break;
  const t = (tr.H[i] - hmin) / Math.max(1, hmax - hmin), col = tr.bridge[i] ? '#fff' : tr.tunnel[i] ? '#000' : `hsl(${240 - t * 240},80%,55%)`;
  svg += `<line x1="${px(A[i])}" y1="${py(B[i])}" x2="${px(A[j])}" y2="${py(B[j])}" stroke="${col}" stroke-width="${tr.bridge[i] ? 7 : 5}"/>`;
}
// branches: from the fork, along the branch, to the merge (dashed outline so they stand out)
const sa = i => (tr.xs[i] - tr.zs[i]) / Math.SQRT2, sb = i => -(tr.xs[i] + tr.zs[i]) / Math.SQRT2;
for (const a of tr.alts) {
  for (let q = 0; q <= a.n; q++) { const i = a.u + q, j = i + 1, t = (tr.H[i] - hmin) / Math.max(1, hmax - hmin); svg += `<line x1="${px(sa(i))}" y1="${py(sb(i))}" x2="${px(sa(j))}" y2="${py(sb(j))}" stroke="hsl(${240 - t * 240},80%,55%)" stroke-width="5"/>`; }
  for (let q = 1; q <= a.n; q += 100) svg += `<text x="${px(sa(a.u + q)) + 6}" y="${py(sb(a.u + q)) - 6}" fill="#9ef" font-size="12">${a.name} h${tr.H[a.u + q].toFixed(0)}</text>`;
  console.log(`  branch "${a.name}": forks at ${a.F}, merges at ${a.M} (main ${a.M - a.F} m, branch ${a.n + 1} m)`);
}
for (let i = 0; i < N; i += 100) svg += `<text x="${px(A[i]) + 6}" y="${py(B[i]) - 6}" fill="#fff" font-size="12">${i} h${tr.H[i].toFixed(0)}</text>`;
// every element's markers (tunnel, bridge, kick, crossing...), labelled
for (const m of trackMarkers(tr)) { const i = m.i < tr.NM ? m.i % N : m.i; svg += `<circle cx="${px(sa(i))}" cy="${py(sb(i))}" r="4" fill="#ffd34a"/><text x="${px(sa(i)) + 6}" y="${py(sb(i)) + 14}" fill="#ffd34a" font-size="11">${m.label}</text>`; }
svg += `<circle cx="${px(A[tr.startIdx])}" cy="${py(B[tr.startIdx])}" r="6" fill="#ff0"/><text x="12" y="22" fill="#fff" font-size="15">${st.name}</text></svg>`;
fs.mkdirSync('tools/out', { recursive: true });
const out = `tools/out/layout-${sid}.svg`; fs.writeFileSync(out, svg); console.log('wrote', out);
