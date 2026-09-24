import { WALL } from '../constants.js';
import { damageCar } from '../sim/damage.js';
import { groundAt, project } from '../track/query.js';

// ---------- rockfall (cliff ledge) ----------
// Boulders drop off the rock face above the ledge and bounce across the road toward the drop. Often timed to land
// a few seconds ahead of the player while they are on the ledge.
export function rockStep(R, W, dt) {
  const tr = W.tr; if (!tr.rockfall) return;
  const N0 = tr.loopN, P = R.player, rnd = R.rnd, pi = P.pr.i % N0;
  R.rockT -= dt;
  if (R.phase === 'racing' && R.rockT <= 0 && R.rocks.length < 4) {
    R.rockT = 1.2;
    const sp = Math.max(15, Math.hypot(P.vx, P.vz)), j = Math.round(pi + sp * (2.2 + rnd() * 1.8));
    const jj = j % N0;
    if (tr.rockfall[jj] && tr.rockfall[pi] !== undefined && j - pi < 260) {
      const far = (-Math.cos(tr.th[jj]) * -Math.SQRT1_2 + Math.sin(tr.th[jj]) * -Math.SQRT1_2) > 0 ? 1 : -1, lat = far * (WALL + 9);
      const x = tr.xs[jj] + tr.rx[jj] * lat, z = tr.zs[jj] + tr.rz[jj] * lat, r = 1.5 + rnd() * 1.0, lv = -far * (8 + rnd() * 5), av = (rnd() - 0.5) * 6;
      R.rocks.push({ x, z, y: W.terr.at(x, z) + r + 3, vx: tr.rx[jj] * lv + tr.tx[jj] * av, vz: tr.rz[jj] * lv + tr.tz[jj] * av, vy: 2, r, age: 0, hint: P.pr.i + (j - pi), fresh: true, id: (R.rockId = (R.rockId || 0) + 1) });
      R.rockT = 3.5 + rnd() * 3;
    }
  }
  const cars = R.cars.concat(R.traffic, R.parked);
  for (let k = R.rocks.length - 1; k >= 0; k--) {
    const o = R.rocks[k]; o.age += dt;
    o.vy -= 30 * dt; o.x += o.vx * dt; o.y += o.vy * dt; o.z += o.vz * dt;
    const pr = project(tr, o.x, o.z, o.hint, 20, 20); o.hint = pr.i;
    const g = groundAt(W, pr.s, pr.lat, o.x, o.z) + o.r;
    if (o.y < g) { o.y = g; if (o.vy < 0) { if (o.vy < -6) o.landed = true; o.vy = -o.vy * 0.35; } const f = Math.exp(-dt * 0.8); o.vx *= f; o.vz *= f; }
    for (const c of cars) {
      if (c.ghost > 0 || c.finished) continue;
      const dx = c.x - o.x, dz = c.z - o.z, d = Math.hypot(dx, dz), rr = o.r + 1.3;
      if (d > rr || Math.abs(c.y + 0.8 - o.y) > o.r + 1.2) continue;
      const nx = dx / (d || 1), nz = dz / (d || 1), rel = Math.hypot(c.vx - o.vx, c.vz - o.vz);
      c.x += nx * (rr - d); c.z += nz * (rr - d);
      c.vx += nx * (4 + rel * 0.3) + o.vx * 0.3; c.vz += nz * (4 + rel * 0.3) + o.vz * 0.3; c.spin += (rnd() - 0.5) * 3;
      o.vx -= nx * rel * 0.3; o.vz -= nz * rel * 0.3;
      if (rel > 5) { c.events.push({ t: 'rockhit', x: o.x, z: o.z, y: c.y, v: rel }); damageCar(c, o.x, o.z, 10 + rel * 0.9, 1.2, -nx, -nz); }
    }
    if (o.age > 10 || o.y < tr.H[pr.i] - 30 || pr.dist > 70) R.rocks.splice(k, 1);
  }
}

/** Boulders dropping onto the cliff ledge. Active where the track has `rockfall` sections. */
export const feature = {
  name: 'rockfall',
  init(R) { R.rocks = []; R.rockT = 4; },
  after: rockStep
};
