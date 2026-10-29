import { HALF } from '../constants.js';
import { autoRoad, generateGround, groundFor, roadOnGround } from './ground.js';
import { buildTrack } from './build.js';
import { buildTerrain } from './terrain.js';
import { trackReport } from './report.js';
import { PIECES } from './pieces.js';

// The Track Studio's Generate (ui/studio.js): a whole track to start editing from. A landscape in a style
// (ground.js generateGround), a lap laid on it (autoRoad), the look of an existing stage, and set pieces put along it
// to meet the design pillars (core/track/report.js): a beat every ~9 s of the lap, each a different kind from the one
// before (a jump, wrecking balls, something to smash, a splash), jumps and chicanes only on straights. Six tries, each curlier,
// the best report card wins. Returns a stage with edits.pieces / edits.houses (so they show and edit like any).
export const LOOKS = { meadow: 'Summit Meadow', forest: 'Pine Forest', canyon: 'Red Mesa Canyon', snow: 'Frostpeak', dunes: 'Dune Rally', moor: 'Highland Rally', bog: 'Bogwood Rally', alpine: 'Alpine Viaduct', park: 'Sunday Park' };
const BEAT = 9, ROTA = ['air', 'moving', 'smash', 'surface', 'air', 'smash', 'moving', 'air'];
const clone = o => JSON.parse(JSON.stringify(o));
/** A generated stage. look: the stage whose colours, light and scenery it borrows. */
export function generateStage({ style = 'hills', length = 'medium', surface = 'tarmac', look, seed = 1, name = 'Generated track' }) {
  let best = null;
  for (let t = 0; t < 6; t++) {
    const st = attempt({ style, length, surface, look, seed: seed + t * 101, name, wiggle: 1 + t * 0.45 }); if (!st) continue;   // (curlier each try)
    let R; try { const tr = buildTrack(clone(st)); R = trackReport(tr, st, buildTerrain(tr, clone(st))); } catch (e) { continue; }
    if (!best || R.score > best.R.score) best = { st, R };
  }
  return best ? best.st : null;
}
function attempt({ style, length, surface, look, seed, name, wiggle }) {
  const ground = generateGround(style, seed), road = autoRoad(ground, { seed, length, pieces: false, wiggle }); if (!road) return null;
  const st = { name, blurb: 'Generated in the Track Studio', type: 'gorge', laps: 3, seed, surface, hillAmp: 0, armco: true, startHeading: road.heading,
    segs: roadOnGround(road.segs, road.heading, ground, road.start, {}), ground: groundFor(ground, road.start), edits: { pieces: [], houses: [] } };
  for (const k of ['light', 'colors', 'trees', 'rocks', 'bushes', 'cacti']) if (look && look[k] !== undefined) st[k] = clone(look[k]);
  if (!st.light || !st.colors) return null;
  let tr; try { tr = buildTrack(clone(st)); } catch (e) { return null; }
  const R = trackReport(tr, st), N = tr.loopN, p = R.profile;
  // time round the lap at each sample, from the speed profile
  const tAt = new Float32Array(N + 1); for (let i = 0; i < N; i++) tAt[i + 1] = tAt[i] + 1 / Math.max(4, p[i]);
  const straight = (s, len) => { for (let i = s - 10; i < s + len + 25; i++) if (Math.abs(tr.ks[((i % N) + N) % N]) > 1 / 140) return false; return true; };
  const n = Math.max(3, Math.min(8, Math.round(R.time / BEAT))), used = [];
  for (let b = 0; b < n; b++) {
    const want = (b + 0.6) / n * R.time; let s0 = 0; while (s0 < N - 1 && tAt[s0] < want) s0++;
    const kind = ROTA[b % ROTA.length];
    // look either side of the beat for a spot the piece suits (well clear of the start and the other pieces)
    for (let d = 0; d < 90; d += 6) for (const s of [s0 + d, s0 - d]) {
      if (s < 80 || s > N - 100 || used.some(u => Math.abs(u - s) < 70)) continue;
      const k = kind === 'air' ? (straight(s, 40) ? 'yump' : 'kick') : kind === 'moving' ? 'hammers' : kind === 'surface' ? (surface === 'tarmac' ? 'splash' : 'mud') : straight(s, 40) ? 'chicane' : null;
      if (kind === 'smash' && !k) { houses(st, tr, s); used.push(s); d = 99; break; }
      if (PIECES[k].straight && !straight(s, PIECES[k].len)) continue;
      st.edits.pieces.push({ s, k }); used.push(s); d = 99; break;
    }
  }
  st.edits.pieces.sort((a, b) => a.s - b.s);
  try { buildTrack(clone(st)); } catch (e) { st.edits.pieces = st.edits.pieces.filter(q => { try { buildTrack({ ...clone(st), edits: { ...st.edits, pieces: [q] } }); return true; } catch (er) { return false; } }); }
  return st;
}
// a row of cottages and sheds beside the road on a bend's outside: a smash lane
function houses(st, tr, s) {
  const N = tr.loopN, side = (tr.ks[s % N] > 0 ? -1 : 1);
  for (let q = 0; q < 3; q++) {
    const i = (s + q * 14) % N, type = q === 1 ? 'shed' : 'cottage', lat = side * (HALF + (type === 'shed' ? 6 : 7.5));
    const x = tr.xs[i] + tr.rx[i] * lat, z = tr.zs[i] + tr.rz[i] * lat, f = Math.round(Math.atan2(tr.xs[i] - x, tr.zs[i] - z) * 180 / Math.PI);
    st.edits.houses.push({ type, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, f });
  }
}
