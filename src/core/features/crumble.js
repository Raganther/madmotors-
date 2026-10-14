import { CRUMBLE } from '../elements/crumble.js';
import { HALF } from '../constants.js';
import { massOf } from '../sim/impact.js';
import { respawn } from '../sim/car.js';

// ---------- crumbling bridges (crumble element) ----------
// Each span (tr.crumbles: samples a..b) is a grid of planks, a metre along by CRUMBLE.LANES across, each with hp. A
// car on the deck wears the planks under its front and back axles by its mass squared x (0.4 + speed / 30) per second;
// landing on the deck costs LAND x how hard it came down. A plank at 0 is gone: the ground there is the water
// (crumbleDeckAt, used by groundAt). A car that drops through comes back past the far end. State lives on the world
// (W.crumbles, as drawbridges do) so the ground query can see it. Deterministic: no random numbers.
const base = (tr, s) => { if (s >= tr.NM) return -1e6; const N0 = tr.loopN || tr.N; return ((s % N0) + N0) % N0; };
const laneOf = lat => Math.max(0, Math.min(CRUMBLE.LANES - 1, Math.floor((lat + CRUMBLE.LANES * CRUMBLE.LANE_W / 2) / CRUMBLE.LANE_W)));
/** The deck's height at (s, lat), sagging as its plank wears, or null where it's gone (or off the side). */
export function crumbleDeckAt(W, s, lat) {
  if (!W.crumbles) return null; const b = base(W.tr, s);
  for (const d of W.crumbles) {
    const u = b - d.a, L = d.b - d.a; if (u < 0 || u >= L) continue;
    if (Math.abs(lat) > HALF + 0.4) return null;
    const hp = d.hp[Math.floor(u) * CRUMBLE.LANES + laneOf(lat)]; if (hp <= 0) return null;
    return d.h0 + (d.h1 - d.h0) * u / L - CRUMBLE.SAG * (1 - hp / d.max) * Math.sin(Math.PI * (u + 0.5) / L);
  }
  return null;
}
/** For the AI: the lane centre (lat) with the soundest planks over the next stretch of a bridge ahead, or null. */
export function crumbleLane(W, c) {
  if (!W.crumbles) return null; const b = base(W.tr, c.pr.s);
  for (const d of W.crumbles) {
    const u0 = b - d.a, L = d.b - d.a; if (u0 < -45 || u0 > L - 2) continue;
    let best = -1, bl = 0;
    for (let l = 0; l < CRUMBLE.LANES; l++) {
      let m = Infinity; for (let u = Math.max(0, Math.floor(u0) + 1); u < Math.min(L, Math.max(0, Math.floor(u0)) + 16); u++) m = Math.min(m, d.hp[u * CRUMBLE.LANES + l]);
      const sc = m + (l === 1 ? 0.05 * d.max : 0); if (sc > best) { best = sc; bl = l; }
    }
    return (bl - (CRUMBLE.LANES - 1) / 2) * CRUMBLE.LANE_W;
  }
  return null;
}
function step(R, W, dt) {
  const tr = W.tr;
  for (const d of W.crumbles) {
    const L = d.b - d.a;
    for (const c of R.cars.concat(R.traffic || [])) {
      const u = base(tr, c.pr.s) - d.a; if (u < -2 || u > L + 2) continue;
      if (u >= 0 && u < L && c.y < d.h0 + (d.h1 - d.h0) * u / L - 5 && !c.destroyed) {   // through the deck and into the water
        c.events.push({ t: 'splash' }); c.lastGood = c.pr.i - Math.round(u) + L + 10; respawn(c, W); continue;
      }
      const landed = c.onGround && c.crAir; c.crAir = !c.onGround;                        // just landed: the squash says how hard
      if (!c.onGround || Math.abs(c.pr.lat) > HALF + 0.4) continue;
      const sp = Math.hypot(c.vx, c.vz), m = massOf(c), cs = Math.sin(c.yaw) * tr.tx[c.pr.i] + Math.cos(c.yaw) * tr.tz[c.pr.i];
      const wear = CRUMBLE.WEAR * m * m * (0.4 + sp / 30) * dt + (landed ? CRUMBLE.LAND * m * c.squash * 25 : 0);
      for (const ax of [0.6, -0.6]) {                                                    // under the front and back axles
        const uu = Math.floor(u + ax * c.hl * cs); if (uu < 0 || uu >= L) continue;
        const k = uu * CRUMBLE.LANES + laneOf(c.pr.lat); if (d.hp[k] <= 0) continue;
        d.hp[k] -= wear / 2;
        if (d.hp[k] <= 0) { d.hp[k] = 0; d.gone++; c.events.push({ t: 'plank', x: c.x, y: c.y, z: c.z }); }
      }
    }
  }
}
export const feature = {
  name: 'crumble',
  init(R, W) {
    W.crumbles = (W.tr.crumbles || []).map(d => { const max = CRUMBLE.HP * d.k; return { ...d, max, hp: new Float32Array((d.b - d.a) * CRUMBLE.LANES).fill(max), gone: 0 }; });
    R.crumbles = W.crumbles;
  },
  after(R, W, dt) { if (W.crumbles.length) step(R, W, dt); }
};
