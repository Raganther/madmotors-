import { BREAKABLES } from '../../data/breakables.js';
import { carSAT } from '../sim/collide.js';
import { damageCar } from '../sim/damage.js';
import { breaks, impactOf } from '../sim/impact.js';
import { groundAt, project } from '../track/query.js';

// ---------- breakables ----------
// The track's breakables (core/elements/breakables.js places them; data/breakables.js says how strong) are boxes a
// car hits like a wall, unless its impact (sim/impact.js) breaks them: then the car ploughs through, losing speed for
// how hard the thing was, and the thing is gone for the rest of the race (on every lap). Concrete leaves chunks on the
// road (R.chunks): loose blocks that get shoved about, slow whoever hits them and can trip a car into a spin.
// Deterministic: no random numbers (where the chunks go comes from the hit).
const CHUNK = { R: 0.55, MASS: 1.4, FRIC: 2.2, LIFE: 40 }, cellKey = (a, b) => a * 100003 + b;
export function breakableStep(R, W, dt) {
  W.brk = R.brk;                                                                       // the AI checks a breach is down (sim/ai.js)
  if (!R.brk.length && !R.chunks.length) return;
  const tr = W.tr, cars = R.cars.concat(R.traffic || [], R.parked || []);
  for (const c of cars) {
    if (c.ghost > 0) continue;
    const near = R.brkGrid.get(cellKey(Math.floor(c.x / 16), Math.floor(c.z / 16))); if (!near) continue;
    for (const k of near) {
      const o = R.brk[k]; if (o.broken || Math.abs(c.y - o.y) > 3 + (o.h || 0)) continue;
      const K = BREAKABLES[o.kind];
      const h = carSAT(o, c); if (!h) continue;                                   // normal points from the thing to the car
      const vn = -(c.vx * h.nx + c.vz * h.nz);                                    // speed into it
      if (vn > 0 && breaks(c, o.kind, vn)) {
        const keep = Math.max(0.35, 1 - 0.55 * K.hp / impactOf(c, vn));           // ploughs through: the harder the thing, the more it costs
        c.vx *= keep; c.vz *= keep; o.broken = true; o.by = R.cars.indexOf(c);
        damageCar(c, c.x - h.nx * c.hl, c.z - h.nz * c.hl, 4 + vn * 0.35 * Math.min(1, K.hp / 20), 0.6, h.nx, h.nz);
        c.events.push({ t: 'break', id: o.id, kind: o.kind, x: o.x, y: o.y, z: o.z, nx: h.nx, nz: h.nz, v: vn });
        for (let k = 0; k < K.chunks; k++) {                                      // the blocks scatter along the hit, spread across
          const a = (k - (K.chunks - 1) / 2) * 0.5, ca = Math.cos(a), sa = Math.sin(a), dx = -h.nx * ca + h.nz * sa, dz = -h.nz * ca - h.nx * sa, s = vn * (0.55 + 0.1 * k);
          R.chunks.push({ x: o.x + Math.sin(o.yaw) * (k - 1) * K.w / 3, z: o.z + Math.cos(o.yaw) * (k - 1) * K.w / 3, y: o.y + 0.4, vx: dx * s, vz: dz * s, vy: 2, age: 0, hint: c.pr.i, spin: 0, a: 0 });
        }
        break;
      }
      // solid: pushed back out like off a wall, bounced and dented by the speed it came in at
      c.x += h.nx * (h.depth + 0.01); c.z += h.nz * (h.depth + 0.01);
      if (vn > 0) {
        c.vx += h.nx * vn * 1.3; c.vz += h.nz * vn * 1.3;
        if (vn > 4) { damageCar(c, c.x - h.nx * c.hl, c.z - h.nz * c.hl, vn, 1, h.nx, h.nz); c.events.push({ t: 'hit', x: c.x - h.nx * c.hl, y: c.y + 0.5, z: c.z - h.nz * c.hl, v: vn, nx: -h.nx, nz: -h.nz, kind: o.kind }); }
      }
    }
  }
  // the chunks: slide and settle, shoved by cars, slowing them
  for (let k = R.chunks.length - 1; k >= 0; k--) {
    const q = R.chunks[k]; q.age += dt;
    q.vy -= 30 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.a += q.spin * dt;
    const pr = project(tr, q.x, q.z, q.hint, 20, 20); q.hint = pr.i;
    const g = groundAt(W, pr.s, pr.lat, q.x, q.z) + CHUNK.R * 0.6;
    if (q.y <= g) { q.y = g; q.vy = Math.max(0, -q.vy * 0.2); const f = Math.exp(-dt * CHUNK.FRIC); q.vx *= f; q.vz *= f; q.spin *= f; }
    for (const c of cars) {
      if (c.ghost > 0) continue;
      const dx = q.x - c.x, dz = q.z - c.z, d = Math.hypot(dx, dz), rr = CHUNK.R + c.hw;
      if (d > rr || Math.abs(c.y - q.y) > 1.5) continue;
      const nx = dx / (d || 1), nz = dz / (d || 1), rel = (c.vx - q.vx) * nx + (c.vz - q.vz) * nz; if (rel <= 0) continue;
      const m = 1 / (c.im || 1), share = m / (m + CHUNK.MASS);                  // momentum shared with the block
      q.vx += nx * rel * share * 1.6; q.vz += nz * rel * share * 1.6; q.spin += rel * 0.6;
      c.vx -= nx * rel * (1 - share); c.vz -= nz * rel * (1 - share); c.spin += (nx * c.vz - nz * c.vx > 0 ? 1 : -1) * rel * 0.04;
      q.x = c.x + nx * rr; q.z = c.z + nz * rr;
      if (rel > 6) damageCar(c, q.x, q.z, rel * 0.6, 0.5, -nx, -nz);
    }
    if (q.age > CHUNK.LIFE || pr.dist > 60) R.chunks.splice(k, 1);
  }
}
export const feature = {
  name: 'breakables',
  init(R, W) {
    const tr = W.tr;
    // the track's own (a breach, props) and the world kit's pieces (W.terr.kit: houses, fences, gates...); a piece
    // carries its own size, `w` across its face and `d` deep. A grid of 16 m cells keeps the per-car checks local.
    const own = (tr.breakables || []).map(b => { const K = BREAKABLES[b.kind]; return { ...b, hl: K.w / 2, hw: K.d / 2, y: b.y ?? tr.H[tr.u0(b.b)], broken: false }; });
    const kit = ((W.terr && W.terr.kit && W.terr.kit.solid) || []).map(p => ({ ...p, hl: p.w / 2, hw: p.d / 2, broken: false }));
    R.brk = own.concat(kit).map((o, k) => ({ ...o, id: k }));
    R.brkGrid = new Map(); R.brk.forEach((o, k) => { const r = Math.ceil(Math.max(o.hl, o.hw) / 16); for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const g = cellKey(Math.floor(o.x / 16) + a, Math.floor(o.z / 16) + b); let l = R.brkGrid.get(g); if (!l) R.brkGrid.set(g, l = []); l.push(k); } });
    R.chunks = [];
  },
  after: breakableStep
};
