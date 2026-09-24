import { clamp } from '../math.js';

// The road graph: which sample follows which. Every built track carries this API, so code that walks along the road
// (the AI looking ahead, respawns, features) works the same on every stage:
//   NB, bi(i), u0(b)   base samples (one lap: the main loop, then each branch's own samples); unrolled index -> base
//                      sample, and a base sample -> its unrolled index on lap 0 (what nearest() returns)
//   nb(b, d), nb0(u, d) step d samples from base sample b / lap-0 index u (main route through forks, wrapping)
//   adv(i, d, alt)     step d samples from unrolled index i, taking branch `alt` at its fork (-1 = main route)
//   progOf(s)          progress for a road position (branches map onto the stretch of main road they replace)
//   ahead(b, prog)     the first unrolled index of base sample b with progress beyond prog (-1 if none)
//   all0               every base sample as a lap-0 index: the main loop, then each branch (for drawing the road)
//   twin               base sample -> the nearest sample on the other route where a car can change road (fork, merge)
//                      (fork and merge), else -1; null without branches
// Branch layout (stage.branches): the main laps come first (NM samples, as on any circuit), then for each lap a block
// per branch: [copy of the fork sample F, the branch's samples, copy of the merge sample M]. Nothing steps onto the
// copies; they just keep float positions like s - 0.8 at the ends of a branch on the right ground.

/** A route with no branches: point-to-point (loopN 0) or a plain circuit. */
export function plainRoute(N, N0) {
  const w = N0 ? i => ((i % N0) + N0) % N0 : i => clamp(i, 0, N - 1);
  return { NB: N0 || N, NM: N, alts: [], nx: null, pv: null, twin: null, all0: Int32Array.from({ length: N0 || N }, (_, i) => i), bi: N0 ? i => i % N0 : i => i, u0: b => b,
    nb: (b, d) => w(b + d), nb0: (u, d) => w(u + d), adv: (i, d) => clamp(i + d, 0, N - 1), progOf: s => s, lapOf: i => N0 ? (i / N0) | 0 : 0,
    ahead: N0 ? (b, prog) => { const i = Math.floor(prog), u = i + ((b - i % N0) % N0 + N0) % N0; return u < N ? u : -1; } : (b, prog) => b > prog ? b : -1 };
}
/** A circuit with branches. AL: [{ F, M, o, n, name, g, h }] (fork / merge main samples, base offset and count, and
 *  how many of its samples run beside the main road at the fork (g) and the merge (h): progress there matches the main
 *  road's one for one, so switching roads doesn't jump; the middle is stretched or squeezed to fit). */
export function branchRoute({ N0, NM, laps, AL, nx0, pv0 }) {
  let NAU = 0; for (const a of AL) { a.off = NAU; NAU += a.n + 2; }
  const N = NM + (laps + 1) * NAU, NB = N0 + AL.reduce((s, a) => s + a.n, 0);
  const bmap = new Int32Array(NAU), amap = new Int8Array(NAU), altOf = new Int8Array(NB).fill(-1);
  AL.forEach((a, k) => {
    bmap[a.off] = a.F; for (let q = 0; q < a.n; q++) bmap[a.off + 1 + q] = a.o + q; bmap[a.off + a.n + 1] = a.M;
    amap.fill(k, a.off, a.off + a.n + 2); altOf.fill(k, a.o, a.o + a.n); a.u = NM + a.off;
  });
  const bi = i => i < NM ? i % N0 : bmap[(i - NM) % NAU];
  const u0 = b => { if (b < N0) return b; const a = AL[altOf[b]]; return NM + a.off + 1 + b - a.o; };
  const lapU = (b, L) => b < N0 ? L * N0 + b : u0(b) + L * NAU;
  const lapOf = i => i < NM ? (i / N0) | 0 : ((i - NM) / NAU) | 0;
  const nb = (b, d) => { while (d > 0) { b = nx0[b]; d--; } while (d < 0) { b = pv0[b]; d++; } return b; };
  const main = u => Math.max(0, Math.min(NM - 1, u));
  const nx = new Int32Array(N), pv = new Int32Array(N);
  for (let i = 0; i < NM; i++) { nx[i] = main(i + 1); pv[i] = main(i - 1); }
  for (let L = 0; L <= laps; L++) for (const a of AL) {
    const s = NM + L * NAU + a.off, F = L * N0 + a.F, M = L * N0 + a.M;
    nx[s] = s + 1; pv[s] = main(F - 1);                                              // copy of F
    for (let q = 1; q <= a.n; q++) { nx[s + q] = q < a.n ? s + q + 1 : main(M); pv[s + q] = q > 1 ? s + q - 1 : main(F); }
    nx[s + a.n + 1] = main(M + 1); pv[s + a.n + 1] = s + a.n;                        // copy of M
  }
  const adv = (i, d, alt = -1) => {
    while (d > 0) { if (alt >= 0 && i < NM && i % N0 === AL[alt].F) i = AL[alt].u + lapOf(i) * NAU + 1; else i = nx[i]; d--; }
    while (d < 0) { i = pv[i]; d++; }
    return i;
  };
  const progOf = s => {
    const i = s | 0; if (i < NM) return s;
    const r = (i - NM) % NAU, a = AL[amap[r]], q = r - a.off + s - i, D = a.M - a.F, n1 = a.n + 1;   // q: 0 copy of F, 1..n the branch, n+1 copy of M
    const g = a.g || 0, h = a.h || 0, p = g + h < Math.min(D, n1) - 2 ? (q <= g ? q : q >= n1 - h ? D - (n1 - q) : g + (q - g) * (D - h - g) / (n1 - h - g)) : q * D / n1;
    return lapOf(i) * N0 + a.F + p;
  };
  const ahead = (b, prog) => {
    for (let L = Math.max(0, Math.floor(prog / N0) - 1); L <= laps; L++) { const u = lapU(b, L); if (u < N && (b >= N0 || u < NM) && progOf(u) > prog) return u; }
    return -1;
  };
  const all0 = Int32Array.from({ length: NB }, (_, b) => u0(b));
  return { N, NB, NM, NAU, alts: AL, nx, pv, all0, bi, u0, nb, nb0: (u, d) => u0(nb(bi(u), d)), adv, progOf, ahead, lapOf, lapU, twin: null };
}
