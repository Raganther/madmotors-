// A light 3D viewer for stage drafts, to turn round on a phone before anything is built in the game: the land, the
// lake, the road (bridges, tunnels, branches), the trees and towns, the beats of the lap, and an elevation profile.
//   npm run trackview [-- draft:<name> ...]   (default: every draft in data/stages/drafts)  -> tools/out/trackview.html
// Each draft module may export `design` = { title, story, beats: [{ m, name, text }], build: [...] } for the notes beside it.
// AI cars lap each draft once for a lap time (as tools/sandbox.mjs does). Publish the page as an artifact to share it.
import fs from 'node:fs';
import * as M from '../src/core/index.js';
import { DRAFTS, DESIGNS } from '../src/data/stages/drafts/index.js';

const names = process.argv.slice(2).map(a => a.replace(/^draft:/, ''));
const list = names.length ? names : Object.keys(DRAFTS);
let seed = 7; Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };   // repeatable AI laps
const r1 = v => Math.round(v * 10) / 10;
const b64 = arr => Buffer.from(new Int16Array(arr).buffer).toString('base64');

function lapTime(stage, tr, terr) {
  const W = { tr, terr, surf: stage.surface, armco: !!stage.armco, traffic: null };
  const R = M.createRace(W, [{ name: 'a', skill: 0.95, flick: 0.3, driftK: 1 / 50 }, { name: 'b', skill: 0.99, flick: 0.22, driftK: 1 / 38 }, { name: 'You', player: true }]);
  R.phase = 'racing'; R.autoPlayer = true;
  const N = tr.loopN || tr.N, end = tr.startIdx + N, done = new Map(); let t = 0, resets = 0;
  while (t < 300 && done.size < R.cars.length) {
    M.raceStep(R, 1 / 60, W); t += 1 / 60;
    for (const c of R.cars) { for (const e of c.events) if (e.t === 'respawn') resets++; if (!done.has(c) && c.progress >= end) done.set(c, t); }
  }
  const ts = [...done.values()].sort((a, b) => a - b);
  return { best: ts.length ? r1(ts[0]) : null, slow: ts.length ? r1(ts[ts.length - 1]) : null, finished: ts.length, cars: R.cars.length, resets };
}

const out = [];
for (const name of list) {
  const stage = DRAFTS[name]; if (!stage) throw new Error(`no draft "${name}"; drafts: ${Object.keys(DRAFTS).join(', ')}`);
  const tr = M.buildTrack(stage), terr = M.buildTerrain(tr, stage), N = tr.loopN || tr.N;
  // the ground, every other grid point, in decimetres
  const k = 2, cols = Math.floor((terr.cols - 1) / k) + 1, rows = Math.floor((terr.rows - 1) / k) + 1, h = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) h.push(Math.round(terr.h[r * k * terr.cols + c * k] * 10));
  // the road every 2 m: x, z, height, and a flag (1 bridge, 2 tunnel, 4 dirt, 8 town)
  const road = (from, n) => { const p = []; for (let q = 0; q < n; q += 2) { const i = from + q; p.push(r1(tr.xs[i]), r1(tr.zs[i]), r1(tr.H[i]), (tr.bridge[i] ? 1 : 0) | (tr.tunnel[i] ? 2 : 0) | (tr.dirt && tr.dirt[tr.bi(i)] ? 4 : 0) | (tr.town && tr.town[tr.bi(i)] ? 8 : 0)); } return p; };
  const main = road(0, N + 2), alts = tr.alts.map(a => ({ name: a.name, fork: a.F, merge: a.M, pts: road(a.u, a.n + 1) }));
  const trees = []; for (const t of terr.obst.items) if (t.kind === 0 || t.kind === 1) trees.push(r1(t.x), r1(t.z), r1(t.y), r1(t.s), t.kind);
  const step = Math.max(1, Math.ceil(trees.length / 5 / 9000));   // at most 9000 trees
  const thin = []; for (let q = 0; q < trees.length; q += 5 * step) thin.push(...trees.slice(q, q + 5));
  const houses = terr.kit.solid.filter(s => s.w * s.d > 12 && s.h > 3).map(s => [r1(s.x), r1(s.z), r1(s.y ?? 0), r1(s.w), r1(s.d), r1(s.h), r1(s.yaw)]);
  const marks = M.trackMarkers(tr).filter(m => m.i < N).map(m => ({ i: m.i, el: m.element, label: m.label }));
  const H = Array.from(tr.H.slice(0, N));
  const climb = H.reduce((s, v, i) => s + Math.max(0, v - H[(i + N - 1) % N]), 0);
  const lap = lapTime(stage, tr, terr);
  const d = DESIGNS[name] || {};
  out.push({ id: name, name: stage.name, blurb: stage.blurb, laps: stage.laps, surface: stage.surface, design: d,
    len: N, climb: Math.round(climb), hmin: r1(Math.min(...H)), hmax: r1(Math.max(...H)), start: tr.startIdx, lap,
    ground: { x0: terr.x0, z0: terr.z0, S: terr.S * k, cols, rows, h: b64(h) },
    water: tr.river ? { level: tr.river.level, pts: tr.river.pts.map(p => p.map(r1)), width: tr.river.width, color: tr.river.color ?? null } : null,
    road: main, alts, trees: thin, houses, marks, colors: stage.colors, sky: stage.light?.sky ?? stage.colors?.sky });
  console.log(`${stage.name}: ${N} m a lap, climb ${Math.round(climb)} m, ${r1(Math.min(...H))}..${r1(Math.max(...H))} m, AI lap ${lap.best}-${lap.slow} s (${lap.finished}/${lap.cars} finished, ${lap.resets} resets), ${thin.length / 5} trees, ${houses.length} houses; ${marks.map(m => m.label).join(', ')}`);
}
const tpl = fs.readFileSync(new URL('./trackview.html', import.meta.url), 'utf8');
fs.mkdirSync('tools/out', { recursive: true });
const file = 'tools/out/trackview.html';
fs.writeFileSync(file, tpl.replace('/*DATA*/null', JSON.stringify(out)));
console.log('wrote', file, `(${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
