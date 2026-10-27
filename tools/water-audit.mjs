// Where water sits on every stage, and whether it's level: water splashes (how far the road climbs under the water),
// standing water in the rain and puddles in the ruts (how much of it lies on a slope), and the bog puddles (how far
// each one tilts). Water on a slope reads as water pooling uphill. npm run water-audit [-- stage]
import { STAGES, buildTrack } from '../src/core/index.js';
import { poolMap, rowDepths, WEAR_OPT } from '../src/core/features/wear.js';
import * as MUD from '../src/core/elements/mud.js';
const splashLevelOf = MUD.splashLevelOf;
const only = process.argv[2], SLOPE = 0.03, near = (tr, r) => Math.abs(tr.H[tr.u0(Math.min(tr.NB - 1, r + 2))] - tr.H[tr.u0(Math.max(0, r - 2))]) / 4;   // steeper than 3% along the road: water would run off, not stand
const slopeAt = (tr, r) => { const N = tr.NB, a = tr.u0(Math.max(0, r - 5)), b = tr.u0(Math.min(N - 1, r + 5)); return Math.abs(tr.H[b] - tr.H[a]) / 10; };
let bad = 0;
for (const st of STAGES) {
  if (only && st.name !== only) continue;
  const tr = buildTrack(st), out = [];
  if (tr.mud) {   // splashes: runs of mud === 2
    for (let r = 0; r < tr.NB; r++) if (tr.mud[r] === 2 && (r === 0 || tr.mud[r - 1] !== 2)) {
      let e = r; while (e + 1 < tr.NB && tr.mud[e + 1] === 2) e++;
      const H = []; for (let k = r; k <= e; k++) H.push(tr.H[tr.u0(k)]);
      const rise = Math.max(...H) - Math.min(...H), lv = splashLevelOf ? splashLevelOf(tr, tr.u0(r)) : null, dry = lv === null ? 0 : H.filter(h => h > lv - 0.05).length / H.length;
      out.push(`splash at ${r}: road rises ${rise.toFixed(1)} m under it${lv === null ? ' (water follows the road)' : `, level water, ${Math.round(dry * 100)}% of it dry road`}`); if (lv === null && rise > 0.6) bad++;
    }
    let tilt = 0, n = 0; for (let r = 0; r < tr.NB; r++) if (tr.mud[r] === 1) { n++; if (slopeAt(tr, r) > SLOPE) tilt++; }
    if (n) out.push(`bogs: ${n} rows, puddles only on the ${n - tilt} level ones`);
  }
  if (st.wet > 0) {
    const P = poolMap({ tr }, { ...WEAR_OPT, standing: true }), rd = rowDepths({ tr, surf: st.surface }, { ...WEAR_OPT, rain: true }).rd;
    let pc = 0, ps = 0, rc = 0, rs = 0;
    for (let r = 0; r < tr.NB; r++) { const sl = slopeAt(tr, r) > SLOPE; if (P && (P[r * 2] || P[r * 2 + 1])) { pc++; if (sl && near(tr, r) > SLOPE) ps++; } if (rd[r] && !sl) rc++; if (rd[r] && sl) rs++; }
    out.push(`rain: standing water on ${pc} rows, ${ps} of them on a slope; rut puddles possible on ${rc} level rows (${rs} sloping rows kept dry)`); if (ps) bad++;
  }
  if (out.length) console.log(st.name + '\n  ' + out.join('\n  '));
}
console.log(bad ? `${bad} stage(s) with water on a slope` : 'no water on a slope');
