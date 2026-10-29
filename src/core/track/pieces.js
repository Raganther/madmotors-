import { ELEMENTS } from '../elements/index.js';

// The Track Studio's set pieces (ui/studio.js Pieces tool): stage.edits.pieces = [{ s, k, len }], piece kind k (PIECES)
// over the road from sample s (metres round the lap from where it begins) for len metres. Each is the element's own
// section tag laid on those samples, exactly as a section of a stage file would carry it (its channels and its section
// markers), so a kicker, a splash or a row of wrecking balls behaves as it does anywhere. Circuits only (a downhill run
// has no sections); applied to the generator's output after the road's own line (core/track/path.js).
export const PIECES = {
  kick: { name: 'Kicker', tag: 'kick', v: 2.4, len: 30, kind: 'air', color: '#FF8A3A' },
  yump: { name: 'Crest jump', tag: 'yump', v: 2.6, len: 40, kind: 'air', color: '#FFB03A', straight: true },
  whoops: { name: 'Whoops', tag: 'whoops', v: 0.7, len: 60, kind: 'air', color: '#E8C060' },
  splash: { name: 'Water splash', tag: 'mud', v: 'water', len: 30, kind: 'surface', color: '#4AA8E8' },
  mud: { name: 'Mud bog', tag: 'mud', v: true, len: 40, kind: 'surface', color: '#7A5A3A' },
  boost: { name: 'Boost pads', tag: 'boost', v: true, len: 20, kind: 'surface', color: '#3AE8D8' },
  ice: { name: 'Ice', tag: 'ice', v: true, len: 60, kind: 'surface', color: '#BFE8FF' },
  dirt: { name: 'Dirt', tag: 'dirt', v: true, len: 80, kind: 'surface', color: '#B08050' },
  chicane: { name: 'Chicane', tag: 'chicane', v: 'concrete', len: 40, kind: 'smash', color: '#C8C8C8', straight: true },
  crumble: { name: 'Crumbling bridge', tag: 'crumble', v: true, len: 40, kind: 'smash', color: '#A8743A', straight: true },
  hammers: { name: 'Wrecking balls', tag: 'hammers', v: 3, len: 60, kind: 'moving', color: '#D84040' },
  rockfall: { name: 'Rockfall', tag: 'rockfall', v: true, len: 80, kind: 'moving', color: '#8A8A8A' },
  tunnel: { name: 'Tunnel', tag: 'tunnel', v: true, len: 80, kind: 'place', color: '#3A3A44' },
  bridge: { name: 'Bridge', tag: 'bridge', v: true, len: 60, kind: 'place', color: '#F4F4F0' },
  town: { name: 'Town', tag: 'town', v: true, len: 120, kind: 'place', color: '#E86AB0' },
  arch: { name: 'Arch', tag: 'arch', v: true, len: 10, kind: 'place', color: '#D9C7A3' },
  falls: { name: 'Waterfall', tag: 'falls', v: true, len: 30, kind: 'place', color: '#7AC8FF' },
};
/** Lay the stage's set pieces on a circuit generator's output (changed in place and returned). */
export function withPieces(stage, g) {
  const list = stage.edits && stage.edits.pieces; if (!list || !list.length) return g;
  const N = g.xs.length, chans = ELEMENTS.flatMap(e => Object.entries(e.channels || {}));
  if (!g.ch) {   // a generated circuit has only bridges and tunnels: give it every channel, at nothing
    g.ch = Object.fromEntries(chans.map(([k, f]) => [k, new Array(N).fill(f({}))]));
    if (g.bridge) g.ch.bridge = Array.from(g.bridge); if (g.tunnel) g.ch.tunnel = Array.from(g.tunnel);
  }
  g.marks = g.marks || {};
  for (const p of list) {
    const P = PIECES[p.k]; if (!P) throw new Error(`${stage.name}: edits.pieces: no piece "${p.k}" (${Object.keys(PIECES).join(', ')})`);
    const i0 = Math.max(0, Math.min(N - 2, Math.round(p.s))), i1 = Math.min(N - 1, i0 + Math.max(2, Math.round(p.len || P.len))), tg = { [P.tag]: P.v };
    for (const [k, f] of chans) { const v = f(tg); if (v !== f({}) && g.ch[k]) for (let i = i0; i < i1; i++) g.ch[k][i] = v; }
    for (const e of ELEMENTS) if (e.section) e.section(tg, i0, i1, g.marks);
  }
  return g;
}
