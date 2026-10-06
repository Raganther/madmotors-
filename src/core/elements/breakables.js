// Breakables on the track (data/breakables.js; core/features/breakables.js breaks them, render/elements draws them):
//  - `breach: '<kind>'` on a branch's section: that kind is built across the mouth of the branch (its first tagged
//    sample). A shortcut only the cars heavy and fast enough to smash through can take; the AI knows (sim/ai.js).
//  - stage `props: [{ kind, at, lat, turn }]`: one where the stage says, `at` metres from the start line on the main
//    road, `lat` metres across, turned `turn` radians from across the road (the Workshop's Destruction yard uses it).
import { BREAKABLES, BREAKABLE_KINDS } from '../../data/breakables.js';
import { HALF } from '../constants.js';
const code = k => BREAKABLE_KINDS.indexOf(k) + 1;
export const element = {
  name: 'breakables', onBranch: true,
  about: 'breakable fences, gates, hay, crates and concrete (a breach across a shortcut, or props)',
  tags: { breach: `a breakable across a branch's mouth: ${BREAKABLE_KINDS.join(' | ')}` },
  stageKeys: { props: 'breakables placed on the main road: [{ kind, at: metres from the start, lat, turn }]' },
  channels: { breach: tg => tg.breach ? code(tg.breach) : 0 },
  section(tg) { if (tg.breach && !BREAKABLES[tg.breach]) throw new Error(`breach: no breakable "${tg.breach}" (${BREAKABLE_KINDS.join(', ')})`); },
  track(ctx, out) {
    const { ch, alts, xs0, zs0, th0, N0, startIdx, stage } = ctx, list = [];
    const put = (b, kind, lat, turn, alt) => list.push({ id: list.length, kind, b, alt, x: xs0[b] - Math.cos(th0[b]) * lat, z: zs0[b] + Math.sin(th0[b]) * lat, yaw: th0[b] + Math.PI / 2 + turn });
    // a breach goes where the branch has pulled clear of the main road (it starts side by side with it): its far end
    // must be off the main road (HALF from either centre line), so only cars taking the branch can hit it
    const clear = b => { let m = Infinity; for (let i = 0; i < N0; i++) m = Math.min(m, Math.hypot(xs0[i] - xs0[b], zs0[i] - zs0[b])); return m; };
    alts.forEach((a, k) => {
      for (let b = a.o; b < a.o + a.n; b++) if (ch.breach[b]) {
        const kind = BREAKABLE_KINDS[ch.breach[b] - 1]; let q = b; while (q < a.o + a.n - 1 && clear(q) < HALF * 2 + BREAKABLES[kind].w / 2) q++;
        put(q, kind, 0, 0, k); a.breach = kind; break;
      }
    });
    for (const p of stage.props || []) { if (!BREAKABLES[p.kind]) throw new Error(`${stage.name}: props: no breakable "${p.kind}"`); put(((startIdx + Math.round(p.at)) % N0 + N0) % N0, p.kind, p.lat || 0, p.turn || 0, -1); }
    out.breakables = list.length ? list : null;
  },
  markers: tr => (tr.breakables || []).map(o => ({ i: tr.u0(o.b), label: o.kind }))
};
