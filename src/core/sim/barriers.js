import { WALL } from '../constants.js';
import { clamp } from '../math.js';

// ---------- breakable barriers ----------
// Barriers are split into pieces of BAR_P track samples per side. Tyres (1), fences (2) and hay (3) take
// damage and give way; armco (fence on armco stages) bends and only breaks on huge hits. Bridge rails (4)
// and tunnel walls (5) never break. Loop tracks key pieces by the base sample so damage carries over laps.
export const BAR_P = 3, BAR_HP = { 1: 15, 2: 9, 3: 6 }, ARMCO_HP = 30, ARMCO_BEND = 1.3;
export function makeBarriers(tr, armco) {
  const NB = tr.NB, NP = Math.ceil(NB / BAR_P) + 1;
  const F = () => new Float32Array(NP), U = () => new Uint8Array(NP);
  return { NB, NP, armco: !!armco, dmg: [F(), F()], broken: [U(), U()], bend: [F(), F()], changes: [] };
}
export function barPiece(W, i) { return (W.tr.bi(i) / BAR_P) | 0; }
export function wallAt(W, i, side) {
  const tr = W.tr, w = side > 0 ? tr.wallR[i] : tr.wallL[i];
  if (!w || w > 3 || !W.bar) return w;
  return W.bar.broken[side > 0 ? 1 : 0][barPiece(W, i)] ? 0 : w;
}
export function wallPos(W, i, side) { return W.bar ? WALL + W.bar.bend[side > 0 ? 1 : 0][barPiece(W, i)] : WALL; }
// A car hit the barrier at sample i with into-wall speed vn. Returns true when it gave way. From outside (`fromOut`: a car
// off the road driving back on) it's only loose tyres, a fence or armco's back: any push knocks the piece over.
export function hitBarrier(W, i, side, vn, alongSgn, c, fromOut = false) {
  const tr = W.tr, B = W.bar, w = wallAt(W, i, side);
  if (!B || !w || w > 3) return false;
  const s = side > 0 ? 1 : 0, p = barPiece(W, i), wrapP = q => tr.loopN ? (q % (B.NP - 1) + (B.NP - 1)) % (B.NP - 1) : clamp(q, 0, B.NP - 1);
  if (fromOut) B.dmg[s][p] = 1e3;
  else if (w === 2 && B.armco) {
    if (vn > 5) {
      const add = (vn - 5) * 0.06;
      for (const [q, f] of [[p, 1], [p - 1, 0.5], [p + 1, 0.5]]) { const qq = wrapP(q); B.bend[s][qq] = Math.min(ARMCO_BEND, B.bend[s][qq] + add * f); }
      B.changes.push({ t: 'bend', s, p });
    }
    if (vn < 20) return false;
    B.dmg[s][p] += vn;
    if (B.dmg[s][p] < ARMCO_HP) return false;
  } else {
    B.dmg[s][p] += Math.max(0, vn - 2.5);
    if (B.dmg[s][p] < BAR_HP[w]) return false;
  }
  const out = [p]; if (vn > 8) out.push(wrapP(p + alongSgn)); if (fromOut) out.push(wrapP(p - 1), wrapP(p + 1));   // a gap a car fits through
  for (const q of out) {
    if (B.broken[s][q]) continue;
    B.broken[s][q] = 1;
    B.changes.push({ t: 'break', s, p: q, w, vx: c.vx, vz: c.vz, v: vn });
  }
  return true;
}
