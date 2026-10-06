import { STYLES } from '../../data/styles.js';
import { BREAKABLES } from '../../data/breakables.js';
import { WALL } from '../constants.js';
import { mulberry32 } from '../math.js';
import { railProject } from '../track/rails.js';

// ---------- the world kit: towns from rules + a style ----------
// stage.towns = [{ style, at, len, side, steep }]: a town along the road from `at` metres (from the start line) for
// `len` metres, on 'both' sides, or the 'left' / 'right' one (`steep`: the most a plot's ground may rise, default 3.2 m). The same rules lay out every style (data/styles.js says
// what each looks like): a pavement, then plot after plot along the frontage, each with a house at the back, a drive
// in from the road with a gate in the front boundary (fence, wall, hedge...), a side boundary, maybe a barn or a
// garden tree; every few plots a side road runs off, closed at the end by something breakable; lamps, bins, benches
// and postboxes on the pavement. A plot that would hit a road, a railway or a cliff is left out.
// Everything a car can hit is a breakable piece (data/breakables.js, kit kinds): houses and barns never give way, a
// picket fence snaps, a stone wall needs a heavy car (core/features/breakables.js). Deterministic: its own random
// numbers from the stage seed, so the race's draws (R.rnd) are untouched; trees and rocks keep out of its zones.
export const KIT = { PAVE: 1.8, SEG: 5, THICK: { picket: 0.14, wall: 0.5, hedge: 0.9, railing: 0.1, chain: 0.08 }, TALL: { picket: 1.0, wall: 0.95, hedge: 1.35, railing: 1.0, chain: 1.8 } };
export function layoutTowns(tr, terr, stage) {
  if (!stage.towns || !stage.towns.length) return null;
  const out = { solid: [], ground: [], decor: [], zones: [], pave: [] };
  stage.towns.forEach((T, n) => layoutTown(tr, terr, stage, T, n, out));
  const Z = out.zones;
  /** Is (x, z) inside a plot, a side road or a pavement (grown by m metres)? Trees and rocks keep out. */
  out.inZone = (x, z, m = 0) => Z.some(r => { const dx = x - r.x, dz = z - r.z, a = dx * Math.sin(r.yaw) + dz * Math.cos(r.yaw), b = dx * Math.cos(r.yaw) - dz * Math.sin(r.yaw); return Math.abs(a) < r.hl + m && Math.abs(b) < r.hw + m; });
  return out;
}
function layoutTown(tr, terr, stage, T, n, out) {
  const S = STYLES[T.style]; if (!S) throw new Error(`${stage.name}: towns: no style "${T.style}" (${Object.keys(STYLES).join(', ')})`);
  const rnd = mulberry32(stage.seed * 31 + n * 977 + 5), span = a => a[0] + rnd() * (a[1] - a[0]), pick = a => a[Math.floor(rnd() * a.length)];
  const N0 = tr.loopN, I = m => N0 ? ((tr.startIdx + Math.round(m)) % N0 + N0) % N0 : Math.max(1, Math.min(tr.N - 3, (tr.startIdx || 0) + Math.round(m)));
  const L0 = WALL + KIT.PAVE, sides = T.side === 'left' ? [-1] : T.side === 'right' ? [1] : [-1, 1];
  // where the road is, in the frame of sample i: u out from the road (beyond the pavement), v along it
  const frame = (i, sd) => { const tx = tr.tx[i], tz = tr.tz[i], rx = tr.rx[i] * sd, rz = tr.rz[i] * sd, P = (u, v) => [tr.xs[i] + rx * (L0 + u) + tx * v, tr.zs[i] + rz * (L0 + u) + tz * v]; P.sd = sd; return P; };
  const lapGap = (a, b) => { const d = Math.abs(a - b); return N0 ? Math.min(d, N0 - d % N0) : d; };
  // a rectangle (in a frame: u0..u1 out, v0..v1 along) is clear if every point on it is no nearer any road than its
  // own place in the frame says it should be, keeps off other roads, railways, tunnels and bridges, and is fairly flat
  const clear = (P, i, u0, u1, v0, v1, steep) => {
    const hs = [];
    for (const u of [u0, (u0 + u1) / 2, u1]) for (const v of [v0, 0, v1]) {
      const [x, z] = P(u, v), q = tr.nearest(x, z); if (!q) return false;
      if (q.d < L0 + u - 1.2 || (lapGap(tr.bi(q.i), i) > 40 && q.d < L0 + 8)) return false;
      if (tr.rails && tr.rails.lines.some(Ln => { const pj = railProject(Ln, x, z); return pj.d < 6 && pj.s > Ln.visA && pj.s < Ln.visB; })) return false;
      const qt = tr.nearestTun && tr.nearestTun(x, z); if (qt && qt.d < 14) return false;
      hs.push(terr.at(x, z));
    }
    if (tr.bridge && tr.bridge[i]) return false;
    return Math.max(...hs) - Math.min(...hs) < steep;
  };
  const free = (x, z, r) => !out.zones.some(o => Math.hypot(o.x - x, o.z - z) < r + Math.max(o.hl, o.hw) * 0.7);
  const zone = (P, yaw, u0, u1, v0, v1) => { const [x, z] = P((u0 + u1) / 2, (v0 + v1) / 2); out.zones.push({ x, z, yaw, hl: (v1 - v0) / 2, hw: (u1 - u0) / 2 }); };
  const piece = (P, kind, u, v, w, d, h, yaw, extra = {}) => { const [x, z] = P(u, v); out.solid.push({ kind, x, z, y: terr.at(x, z), yaw, w, d, h, sd: P.sd, style: T.style, ...extra }); };
  // a run of boundary from (u, va) to (u, vb) along the street, in pieces of at most KIT.SEG metres, with a gap (g0..g1)
  const boundary = (P, kind, u, va, vb, yaw, g0 = 1e9, g1 = -1e9) => {
    if (kind === 'none') return;
    const runs = g0 < g1 ? [[va, g0], [g1, vb]] : [[va, vb]];
    for (const [a, b] of runs) { const n = Math.ceil((b - a) / KIT.SEG); for (let k = 0; k < n; k++) { const s0 = a + (b - a) * k / n, s1 = a + (b - a) * (k + 1) / n; if (s1 - s0 > 0.4) piece(P, kind, u, (s0 + s1) / 2, s1 - s0, KIT.THICK[kind], KIT.TALL[kind], yaw); } }
  };
  for (const sd of sides) {
    let m = T.at, plotNo = 0, lastLamp = -1e9;
    while (m < T.at + T.len) {
      const pw = span(S.plot.w), pd = span(S.plot.d), i = I(m + pw / 2), P = frame(i, sd), yaw = tr.th[i], across = yaw + Math.PI / 2;
      plotNo++;
      // the pavement in front, and its lamps (every street.lamp metres, set back against the plots)
      out.pave.push({ i, sd, a: I(m), b: I(m + pw), style: T.style });
      if (S.street.lamp && m - lastLamp >= S.street.lamp) { lastLamp = m; piece(P, 'post', -KIT.PAVE + 0.6, 0, 0.3, 0.3, 4.6, yaw, { lamp: true }); }
      // a side road every few plots: a lane off the road, closed at the end by something breakable
      if (S.side.every && plotNo % S.side.every === 0 && clear(P, i, 0, S.side.len, -3.5, 3.5, 4) && free(...P(S.side.len / 2, 0), 4)) {
        const E = BREAKABLES[S.side.end], [x, z] = P(S.side.len / 2, 0);
        out.ground.push({ kind: 'lane', x, z, yaw: across, w: S.side.len + KIT.PAVE + 0.6, d: 6.4, u0: -KIT.PAVE - 0.6, i, sd, len: S.side.len });
        piece(P, S.side.end, S.side.len - 1, 0, E.w || 6, E.d || 0.3, E.h || 1.2, yaw);
        zone(P, across, -KIT.PAVE, S.side.len, -3.5, 3.5); m += 12; continue;
      }
      if (rnd() < S.plot.gap || !clear(P, i, 0, pd, -pw / 2, pw / 2, T.steep || 3.2) || !free(...P(pd / 2, 0), Math.min(pw, pd) / 2)) { m += pw; continue; }
      // the house at the back of the plot, facing the road; a barn or shed beside it, or a garden tree
      const hw = Math.min(span(S.houses.w), pw - 4), hd = span(S.houses.d), hv = (rnd() - 0.5) * (pw - hw - 4), hu = pd - hd / 2 - 3, floors = Math.round(span(S.houses.floors));
      const [hx, hz] = P(hu, hv), hy = Math.min(...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => terr.at(...P(hu + a * hd / 2, hv + b * hw / 2))));
      out.solid.push({ kind: 'house', x: hx, z: hz, y: hy, yaw, w: hw, d: hd, h: floors * 3 + 0.4, floors, wall: pick(S.houses.walls), roofC: pick(S.houses.roofs), roof: S.houses.roof, sd, style: T.style });
      const dv = hv + (hw / 2 - 1.8) * (rnd() < 0.5 ? -1 : 1), gw = S.gate === 'gate' ? BREAKABLES.gate.w : 3.4;
      if (rnd() < S.houses.barn) {
        const bw = T.style === 'farm' ? 11 : 6, bd = T.style === 'farm' ? 14 : 6, bv = -Math.sign(dv - hv || 1) * (pw / 2 - bw / 2 - 1.5);
        if (Math.abs(bv - hv) > (hw + bw) / 2 + 1) piece(P, 'barn', pd - bd / 2 - 2, bv, bw, bd, T.style === 'farm' ? 6.5 : 3.2, yaw, { wall: T.style === 'farm' ? 0x9C3B2E : pick(S.houses.walls), roofC: pick(S.houses.roofs) });
      } else if (rnd() < S.tree) { const [tx, tz] = P(pd * 0.35, -Math.sign(dv - hv || 1) * pw * 0.28); out.decor.push({ kind: 'tree', x: tx, z: tz, y: terr.at(tx, tz), s: 0.8 + rnd() * 0.5 }); }
      // the garden, the drive in to the house, the front boundary with its gate, one side boundary
      out.ground.push({ kind: 'garden', ...xz(P(pd / 2, 0)), yaw, w: pw, d: pd, color: S.garden, i, sd });
      out.ground.push({ kind: 'drive', ...xz(P((pd - hd - 3) / 2 - 0.3, dv)), yaw: across, w: pd - hd - 2.4, d: 3, color: S.drive, i, sd });
      boundary(P, S.bound, 0.3, -pw / 2, pw / 2, yaw, dv - gw / 2, dv + gw / 2);
      piece(P, S.gate, 0.3, dv, gw, 0.2, S.gate === 'gate' ? 1.4 : 1.1, yaw);
      if (S.boundSide !== 'none') { const n = Math.ceil(pd * 0.75 / KIT.SEG); for (let k = 0; k < n; k++) piece(P, S.boundSide, 0.3 + (pd * 0.75 - 0.3) * (k + 0.5) / n, -pw / 2, (pd * 0.75 - 0.3) / n, KIT.THICK[S.boundSide], KIT.TALL[S.boundSide], across); }   // down one side, back from the road
      // pavement furniture in front of the plot
      for (const [k, w, d, h] of [['bin', 0.6, 0.6, 1.0], ['bench', 1.6, 0.5, 0.8], ['postbox', 0.5, 0.5, 1.4]]) if (rnd() < S.street[k]) piece(P, k, -KIT.PAVE + 0.9, (rnd() - 0.5) * pw * 0.6, w, d, h, yaw);
      zone(P, yaw, -KIT.PAVE, pd, -pw / 2, pw / 2);
      m += pw;
    }
  }
}
const xz = ([x, z]) => ({ x, z });
