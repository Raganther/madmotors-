import { makeRailLine, railAt, railProject } from '../track/rails.js';

// Railways (stage.rails): lines laid in screen axes. Where a line meets the road at the same height it's a level
// crossing (barriers open, trains from features/trains.js); elsewhere the road bridges it or it tunnels under.
export const element = {
  name: 'rails',
  about: 'railway lines, level crossings where they meet the road',
  stageKeys: { rails: 'railway lines: [{ id, pts: [[a, b, h], ...], speed, cars, colours... }]' },
  heights(ctx) {
    const { stage, N0, xs0, zs0, H0 } = ctx;
    const rails = ctx.rails = stage.rails ? { lines: stage.rails.map(makeRailLine), crossings: [] } : null;
    if (rails) for (const L of rails.lines) {
      let run = [];
      const flush = () => { if (run.length) { const i = run[Math.floor(run.length / 2)], pj = railProject(L, xs0[i], zs0[i]); const C = { i, s: pj.s, line: L, closed: false }; L.crossings.push(C); rails.crossings.push(C); } run = []; };
      for (let i = 0; i < N0; i++) {
        const pj = railProject(L, xs0[i], zs0[i]), h = railAt(L, pj.s).h;
        if (pj.d < 3 && Math.abs(H0[i] - h) < 2.5) run.push(i); else flush();
      }
      flush();
    }
    ctx.nearCrossing = (j, r) => !!rails && rails.crossings.some(C => { const d = Math.abs(j - C.i); return Math.min(d, N0 - d) < r; });
  },
  // gaps in the barriers where a railway crosses
  wallsLast(ctx) {
    const { w, wallL0, wallR0, kerbL0, kerbR0 } = ctx;
    if (ctx.rails) for (const C of ctx.rails.crossings) for (let j = C.i - 9; j <= C.i + 9; j++) { wallL0[w(j)] = 0; wallR0[w(j)] = 0; kerbL0[w(j)] = 0; kerbR0[w(j)] = 0; }
  },
  track(ctx, out) { out.rails = ctx.rails; },
  markers: tr => tr.rails ? tr.rails.crossings.map(C => ({ i: C.i, label: 'level crossing' })) : []
};
