import { HALF } from '../constants.js';
import { SURF, surfReach } from '../elements/surf.js';

// ---------- surf (surf element) ----------
// Every step, each car on a surf stretch is checked against the wave there (elements/surf.js surfReach, fixed by race
// time): caught in it, it's in standing water (c.aqua, the same drag, slip and spray as a deep puddle) and is shoved
// towards the land; a car meeting a fresh wave raises a 'surf' event (the splash and its sound). Runs after wear, which
// sets c.aqua for puddles, and only ever raises it. No randomness.
function step(R, W, dt) {
  const tr = W.tr;
  for (const c of R.cars) {
    if (c.surfAq && c.aqua === c.surfAq) c.aqua = 0;   // last step's wave has drained (wear, on stages with puddles, sets c.aqua afresh itself)
    c.surfAq = 0;
    if (c.finished || !c.onGround) { c.surfIn = false; continue; }
    const b = tr.bi(c.pr.i); if (!tr.surf[b]) { c.surfIn = false; continue; }
    const reach = surfReach(tr, b, R.time), side = tr.surfSide[b];
    const fromEdge = HALF - side * c.pr.lat;   // metres in from the road's water-side edge
    const depth = reach - fromEdge;
    if (depth <= 0) { c.surfIn = false; continue; }
    const k = Math.min(1, depth / 4);
    c.aqua = c.surfAq = Math.max(c.aqua || 0, SURF.AQUA * k);
    const i = c.pr.i, pushX = -side * tr.rx[i], pushZ = -side * tr.rz[i];
    c.vx += pushX * SURF.PUSH * k * dt; c.vz += pushZ * SURF.PUSH * k * dt;
    if (!c.surfIn) c.events.push({ t: 'surf', k });
    c.surfIn = true;
  }
}
/** Surf on surf stretches. */
export const feature = {
  name: 'surf',
  init(R, W) { R.surf = !!W.tr.surf; },
  after(R, W, dt) { if (R.surf) step(R, W, dt); }
};
