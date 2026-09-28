// Open country (off-piste): `open: 'field' | 'forest' | 'rocks' | 'stream'` makes a section a leg with no road at all.
// The section's centre line is only the route the race measures progress along; cars drive the ground itself (rolling,
// not flattened), there are no barriers and no resets for leaving the line, and the land either side is what the kind
// says: open grass, a forest of trees with gaps a car fits through, a rock garden, or a shallow stream to ford. The
// scenery for it is placed in track/obstacles.js (placeOpen), the ground in track/terrain.js.
// `gate: true` puts a gate across the route at the start of its section (on a road or in open country): gates must be
// driven through in order (features/gates.js), and on a stage with gates the AI finds its own way to the next one
// across open country (sim/nav.js). A gate is GATE.W wide.
export const OPEN = { field: 1, forest: 2, rocks: 3, stream: 4 };
export const OPEN_NAME = Object.fromEntries(Object.entries(OPEN).map(([k, v]) => [v, k]));
export const GATE = { W: 16, RAMP: 15 };   // gate width (m); open legs blend from road-flat ground to rolling over RAMP m
export const element = {
  name: 'open',
  about: 'off-piste legs (no road: field, forest, rocks, stream) and gates to drive through in order',
  tags: { open: "'field', 'forest', 'rocks' or 'stream': no road, open country of that kind", gate: 'true: a gate across the route at the start of this section' },
  channels: { open: tg => OPEN[tg.open] || 0, gate: tg => tg.gate ? 1 : 0 },
  wallsLast(ctx) {
    const { NB, ch, wallL0, wallR0, kerbL0, kerbR0 } = ctx;
    for (let i = 0; i < NB; i++) if (ch.open[i]) { wallL0[i] = wallR0[i] = 0; kerbL0[i] = kerbR0[i] = 0; }
  },
  speeds(ctx) { const { NB, ch, vmax0 } = ctx; for (let i = 0; i < NB; i++) if (ch.open[i]) vmax0[i] = 40; },   // the AI drives open legs by sim/nav.js, not these
  track(ctx, out) {
    const { ch, NB, nb } = ctx;
    out.open = null; out.openW = null; out.gates = null;
    if (ch.open.some(v => v)) {
      out.open = ch.open;
      // how far into open country each sample is, 0..1 over GATE.RAMP m: the ground leaves the road's level gradually
      const w = new Float32Array(NB);
      for (let i = 0; i < NB; i++) if (ch.open[i]) { let d = 1; while (d < GATE.RAMP && ch.open[nb(i, d)] && ch.open[nb(i, -d)]) d++; w[i] = d / GATE.RAMP; }
      out.openW = w;
    }
    if (ch.gate.some(v => v)) {
      // gates in race order over the whole race (every lap), as unrolled samples: the start of each gate section
      const g = [], bi = out.bi, first = b => ch.gate[b] && !ch.gate[nb(b, -1)];
      for (let i = out.startIdx + 1; i < out.finishIdx; i++) if (first(bi(i)) && !(g.length && bi(g.at(-1)) === bi(i))) g.push(i);
      out.gates = g;
    }
  },
  markers: tr => {
    const out = [];
    if (tr.open) for (let b = 0; b < tr.NB; b++) if (tr.open[b] && (b === 0 || tr.open[b - 1] !== tr.open[b])) out.push({ i: tr.u0(b), label: OPEN_NAME[tr.open[b]] });
    if (tr.gates) { const L = tr.loopN || tr.N; tr.gates.forEach((i, n) => { if (i < tr.startIdx + L) out.push({ i: tr.u0(tr.bi(i)), label: `gate ${n + 1}` }); }); }
    return out;
  }
};
/** Is base sample b in open country? */
export const isOpen = (tr, i) => !!(tr.open && tr.open[tr.bi(i)]);
