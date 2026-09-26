import { HAMMER, hammerLat } from '../elements/hammer.js';
import { damageCar } from '../sim/damage.js';

/** Wrecking balls (elements/hammer.js): a car the ball catches is batted along the ball's swing and dented. W.hamT
 *  carries the race time for the AI and the renderer. No randomness. */
export const feature = {
  name: 'hammers',
  after(R, W) {
    const tr = W.tr; W.hamT = R.time; if (!tr.hammers) return;
    for (const h of tr.hammers) {
      const { lat, v } = hammerLat(h, R.time), N = tr.loopN;
      for (const c of R.cars.concat(R.traffic || [])) {
        if (!c.onGround && c.y > tr.H[c.pr.i] + 1.5) continue;                      // jumped over it
        if (c.ghost > 0 || c.wreckT > 0 || (c.hitHam || 0) > R.time) continue;
        const ds = N ? ((c.pr.i - h.i) % N + N + N / 2) % N - N / 2 : c.pr.i - h.i;
        if (Math.abs(ds) > HAMMER.R + c.hl * 0.6 || Math.abs(c.pr.lat - lat) > HAMMER.R + c.hw) continue;
        const dir = Math.sign(v || (c.pr.lat - lat) || 1), rx = tr.rx[c.pr.i] * dir, rz = tr.rz[c.pr.i] * dir;
        c.vx = c.vx * HAMMER.SCRUB + rx * HAMMER.HIT_V; c.vz = c.vz * HAMMER.SCRUB + rz * HAMMER.HIT_V; c.spin += dir * HAMMER.SPIN; c.hitHam = R.time + 1;   // stopped dead and batted sideways
        damageCar(c, c.x - rx * c.hw, c.z - rz * c.hw, HAMMER.DENT, 1, rx, rz);
        c.events.push({ t: 'hammer-hit', x: c.x, y: c.y + 1, z: c.z });
      }
    }
  }
};
