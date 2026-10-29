// The Track Studio's edits (core/track/edits.js): sculpting lifts the land and the road over it, props and clears change
// the scenery, placed buildings join the track's; a copy with no edits builds exactly like the stage.
import { describe, expect, it } from 'vitest';
import { buildTerrain, buildTrack, sculptAt, sculptDab } from '../src/core/index.js';
import { buildingsOf } from '../src/core/elements/structures.js';
import { STAGES } from '../src/data/stages/index.js';

const copy = (st, edits) => ({ ...JSON.parse(JSON.stringify(st)), edits });
describe('studio edits', () => {
  it('a copy with empty edits builds the same road and ground', () => {
    for (const k of [0, 8]) {
      const st = STAGES[k], a = buildTrack(st), b = buildTrack(copy(st, {}));
      expect(Array.from(b.H.slice(0, 500))).toEqual(Array.from(a.H.slice(0, 500)));
    }
  });
  it('raising the land under the road lifts the road and the ground there', () => {
    for (const k of [0, 8]) {   // a downhill run and a circuit
      const st = STAGES[k], tr0 = buildTrack(st), i = tr0.startIdx + 300, x = tr0.xs[i], z = tr0.zs[i];
      const sc = { cell: 4, d: {} }; for (let n = 0; n < 12; n++) sculptDab(sc, 'raise', x, z, 12, 1, () => 0);
      const lift = sculptAt(sc, x, z); expect(lift).toBeGreaterThan(3);
      const s2 = copy(st, { sculpt: sc }), tr = buildTrack(s2), q = tr.nearest(x, z);
      expect(tr.H[q.i] - tr0.H[i]).toBeGreaterThan(lift * 0.8);
      const t0 = buildTerrain(tr0, st), t1 = buildTerrain(tr, s2), ox = x + tr0.rx[i] * 9, oz = z + tr0.rz[i] * 9;   // beside the road, inside the brush
      expect(t1.at(ox, oz) - t0.at(ox, oz)).toBeGreaterThan(1);
    }
  });
  it('flatten pulls the land toward the height it started at', () => {
    const sc = { cell: 4, d: {} }, base = (x) => x * 0.2;   // a slope
    for (let n = 0; n < 30; n++) sculptDab(sc, 'flatten', 40, 0, 10, 1, base, 8);
    expect(Math.abs(base(36) + sculptAt(sc, 36, 0) - 8)).toBeLessThan(0.3);
  });
  it('props and clears change the scenery; placed buildings join the track', () => {
    const st = STAGES[8], tr0 = buildTrack(st), t0 = buildTerrain(tr0, st), i = tr0.startIdx + 200, x = tr0.xs[i] + tr0.rx[i] * 30, z = tr0.zs[i] + tr0.rz[i] * 30;
    const near0 = t0.obst.items.filter(o => Math.hypot(o.x - x, o.z - z) < 25).length;
    const s2 = copy(st, { clears: [[x, z, 25]], props: [{ k: 'pine', x, z, s: 1.4 }, { k: 'boulder', x: x + 6, z }], houses: [{ type: 'barn', x: x + tr0.rx[i] * 30, z: z + tr0.rz[i] * 30, f: 0 }] });
    const tr = buildTrack(s2), t1 = buildTerrain(tr, s2), here = t1.obst.items.filter(o => Math.hypot(o.x - x, o.z - z) < 25);
    expect(near0).toBeGreaterThan(0); expect(here.length).toBe(2); expect(here.some(o => o.kind === 0 && o.s === 1.4)).toBe(true);
    expect(buildingsOf(tr, t1).some(o => o.type === 'barn' && o.placed)).toBe(true);
  });
});
describe('studio road (core/track/path.js)', () => {
  it('a road redrawn through its own points keeps its line, length and set pieces', async () => {
    const { pathFromTrack } = await import('../src/core/track/path.js');
    for (const k of [0, 4, 8, 36]) {   // a downhill run, a generated loop, a gorge circuit, a gorge with a town
      const st = STAGES[k], tr0 = buildTrack(st), s2 = copy(st, { path: pathFromTrack(tr0) }), tr = buildTrack(s2), N0 = tr0.loopN || tr0.N, N = tr.loopN || tr.N;
      let off = 0; for (let i = 0; i < N; i += 7) off = Math.max(off, tr0.nearest(tr.xs[i], tr.zs[i]).d);
      expect(off, st.name).toBeLessThan(3); expect(Math.abs(N - N0) / N0, st.name).toBeLessThan(0.05);
      const tun = t => Array.from(t.tunnel.slice(0, t.loopN || t.N)).filter(Boolean).length; expect(Math.abs(tun(tr) - tun(tr0)), st.name).toBeLessThan(N0 * 0.02 + 3);
    }
  });
  it('moving a point moves the road there, and its lift raises it', async () => {
    const { pathFromTrack } = await import('../src/core/track/path.js');
    const st = STAGES[18], tr0 = buildTrack(st), path = pathFromTrack(tr0), k = Math.floor(path.pts.length / 2), q = path.pts[k];
    const moved = JSON.parse(JSON.stringify(path)); moved.pts[k] = [q[0] + 25, q[1], 4];
    const tr = buildTrack(copy(st, { path: moved })), n = tr.nearest(q[0] + 25, q[1]);
    expect(n.d).toBeLessThan(2); expect(tr0.nearest(q[0] + 25, q[1]).d).toBeGreaterThan(15);
    expect(tr.H[n.i] - tr0.H[tr0.nearest(q[0], q[1]).i]).toBeGreaterThan(2.5);
  });
});
describe('studio set pieces and New track', () => {
  it('a set piece on any circuit is the element itself, where it was put', async () => {
    const { trackMarkers } = await import('../src/core/elements/index.js');
    for (const k of [18, 4]) {   // a gorge circuit and a generated loop
      const st = STAGES[k], tr = buildTrack(copy(st, { pieces: [{ s: 300, k: 'hammers' }, { s: 500, k: 'kick' }] })), m = trackMarkers(tr);
      expect(m.some(x => x.element === 'hammer' && Math.abs(tr.bi(x.i) - 330) < 40), st.name).toBe(true);
      expect(m.some(x => x.element === 'kick' && Math.abs(tr.bi(x.i) - 500) < 5), st.name).toBe(true);
    }
  });
  it('New track makes a stage that builds, with set pieces and a decent report card', async () => {
    const { generateStage, trackReport } = await import('../src/core/index.js');
    const st = generateStage({ style: 'valley', length: 'medium', surface: 'tarmac', look: STAGES[1], seed: 7 });
    expect(st).toBeTruthy(); expect(st.edits.pieces.length).toBeGreaterThan(1);
    const tr = buildTrack(JSON.parse(JSON.stringify(st))), R = trackReport(tr, st, buildTerrain(tr, st));
    expect(R.score).toBeGreaterThanOrEqual(5);
  });
});
