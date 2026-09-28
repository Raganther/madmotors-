import { GATE } from '../elements/open.js';

// Gates (elements/open.js `gate`): a stage's gates must be driven through in order, every lap. A car's progress can't
// run past its next gate until it has gone through it (between the posts, heading on), so going round one gains
// nothing: the standings, laps and the finish all wait until it comes back and takes it. Each gate taken is a
// 'gate' event (n = its number in the race, of `of`). `c.gateMiss` is set while a car has gone past its next gate
// without taking it (the HUD says so).
export function gateStep(c, W) {
  const G = W.tr.gates; if (!G || c.traffic) return;
  const tr = W.tr, k = c.gateK || 0;
  if (k < G.length) {
    const i = G[k], dx = c.x - tr.xs[i], dz = c.z - tr.zs[i], along = dx * tr.tx[i] + dz * tr.tz[i], lat = dx * tr.rx[i] + dz * tr.rz[i];
    if (c.gAlong !== undefined && c.gAlong < 0 && along >= 0 && Math.abs(lat) < GATE.W / 2 && Math.abs(c.y - tr.H[i]) < 12) {
      c.gateK = k + 1; c.gAlong = undefined; c.gateMiss = false; c.events.push({ t: 'gate', n: k + 1, of: G.length, i });
    } else c.gAlong = Math.abs(lat) < 60 ? along : Math.min(along, -1);                  // well off to the side: not through it
  }
  const kk = c.gateK || 0;
  if (kk < G.length) { const cap = G[kk] - 0.5; c.gateMiss = c.progress > G[kk] + 20; if (c.progress > cap) c.progress = cap; }
}
export const feature = {
  init(R, W) { if (W.tr.gates) for (const c of R.cars) { c.gateK = 0; c.gAlong = undefined; c.gateMiss = false; } }
};
