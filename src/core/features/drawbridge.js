import { DRAW } from '../elements/drawbridge.js';
import { HALF } from '../constants.js';
import { respawn } from '../sim/car.js';

// ---------- drawbridges (drawbridge element) ----------
// Each bridge (tr.drawbridges: leaves from sample a to b, road height h) follows a fixed cycle on race time: down,
// WARN s of bells, both leaves rise to AMAX, hold, come down. Deterministic, no randomness. The leaves are ground
// (drawDeckAt, used by groundAt), so a leaf on its way up is a real ramp. Once steeper than AJUMP the gate holds cars
// back and anyone left standing on a leaf slides off it; a car in the water goes back to the approach.
// State lives on the world (W.draws, like W.ferries) so the ground query can see the leaves.
const base = (tr, s) => { if (s >= tr.NM) return -1e6; const N0 = tr.loopN || tr.N; return ((s % N0) + N0) % N0; };
/** Leaf angle (radians) and phase name at race time t. */
export function drawState(d, t) {
  let k = (((t + d.phase) % DRAW.CYCLE) + DRAW.CYCLE) % DRAW.CYCLE;
  if (k < DRAW.DOWN) return { ang: 0, st: 'down' }; k -= DRAW.DOWN;
  if (k < DRAW.WARN) return { ang: 0, st: 'warn' }; k -= DRAW.WARN;
  if (k < DRAW.RISE) return { ang: DRAW.AMAX * k / DRAW.RISE, st: 'rise' }; k -= DRAW.RISE;
  if (k < DRAW.HOLD) return { ang: DRAW.AMAX, st: 'up' }; k -= DRAW.HOLD;
  return { ang: DRAW.AMAX * (1 - k / DRAW.LOWER), st: 'lower' };
}
/** Height of a leaf's deck at (s, lat), or null (the gap between the leaves, or off the side: the water). */
export function drawDeckAt(W, s, lat) {
  if (!W.draws) return null; const b = base(W.tr, s);
  for (const d of W.draws) {
    const u = b - d.a, L = d.b - d.a; if (u < -0.5 || u > L + 0.5) continue;
    if (Math.abs(lat) > HALF + 0.4) return null;
    const reach = L / 2 * Math.cos(d.ang), t = Math.tan(d.ang);
    if (u <= reach) return d.h + Math.max(0, u) * t;
    if (L - u <= reach) return d.h + Math.max(0, L - u) * t;
    return null;
  }
  return null;
}
/** For the AI: the speed to be doing (99 = no limit). Go if the leaves will be flat, or low enough to jump at this
 *  speed, when it gets there; otherwise pull up at the gate. */
export function drawTarget(W, c) {
  if (!W.draws || !W.draws.length) return 99;
  const b = base(W.tr, c.pr.s), sp = Math.hypot(c.vx, c.vz);
  for (const d of W.draws) {
    const dist = d.a - b; if (dist < -0.5 || dist > 150) continue;
    const a = drawState(d, W.drawT + dist / Math.max(sp, 4)).ang;
    if (a < 0.1 || (a < DRAW.AJUMP * 0.8 && sp > 21)) return 99;
    const stop = dist - 1.5 - c.hl; return stop <= 0 ? 0 : Math.sqrt(stop * 12);
  }
  return 99;
}
// move a car along/across the road at its sample by (ds, dl) metres
function shift(tr, c, ds) { const i = c.pr.i; c.x += tr.tx[i] * ds; c.z += tr.tz[i] * ds; c.pr.s += ds; }
function stopAlong(tr, c, sgn) { const i = c.pr.i, along = c.vx * tr.tx[i] + c.vz * tr.tz[i]; if (along * sgn > 0) { c.vx -= tr.tx[i] * along; c.vz -= tr.tz[i] * along; } }
function step(R, W) {
  const tr = W.tr, P = R.player; W.drawT = R.time;
  for (const d of W.draws) {
    const { ang, st } = drawState(d, R.time); d.ang = ang;
    if (st !== d.st) { if (st === 'warn' || st === 'rise') P.events.push({ t: 'draw-' + st, i: d.a }); d.st = st; }
    const shut = ang > DRAW.AJUMP, L = d.b - d.a;
    for (const c of R.cars) {
      if (c.finished) continue;
      const u = base(tr, c.pr.s) - d.a; if (u < -60 || u > L + 4) continue;
      c.stuckT = 0; c.wallStuck = 0;                                                    // waiting at the gate isn't being stuck
      if (u >= 0 && u <= L && c.y < d.h - 4) { c.events.push({ t: 'splash' }); c.lastGood = c.pr.i - Math.round(u) - 14; respawn(c, W); continue; }
      if (!shut) continue;
      const lim = -1 - c.hl;
      if (u > lim && u < 0.5 && c.y < d.h + 2) { shift(tr, c, lim - u); stopAlong(tr, c, 1); }                 // the gate
      else if (u >= 0.5 && u <= L && c.onGround) {                                                            // slid off a rising leaf
        if (u < L / 2) { shift(tr, c, lim - u); stopAlong(tr, c, 1); } else { shift(tr, c, L + 1 + c.hl - u); stopAlong(tr, c, -1); }
      }
    }
  }
}
/** Drawbridges on drawbridge sections. */
export const feature = {
  name: 'drawbridge',
  init(R, W) { W.drawT = 0; W.draws = (W.tr.drawbridges || []).map(d => ({ ...d, ang: 0, st: 'down' })); R.draws = W.draws; },
  after(R, W) { if (W.draws.length) step(R, W); }
};
