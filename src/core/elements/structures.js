// Destructible buildings (data/structures.js says how strong; core/features/structures.js breaks them; render/elements
// /structures.js draws them). Stage `buildings: [...]`, each one of:
//   { type, at, lat, turn }      beside the main road: `at` metres from the start line, its middle `lat` m across
//                                (+ right), its front facing the road (turned `turn` degrees from that)
//   { type, a, b, face }         anywhere, in the segs' screen axes round the circuit's middle (like an arena's shape):
//                                a right, b up-screen, metres; its front faces `face` degrees (0 = +a, 90 = +b)
//   plus w, d, floors to change the type's size; `road: true` to let it stand on a road: on a branch it blocks the
//   shortcut until it's smashed open (the AI knows: sim/ai.js)
// A building near the road is the road's edge: the barrier in front of it comes out (wallsLast), so you hit the house.
// Deterministic: no random numbers but the look's (colours from the stage seed).
import { BUILDINGS, BUILDING_TYPES, STRUCT } from '../../data/structures.js';
import { HALF, WALL } from '../constants.js';
import { mulberry32 } from '../math.js';
const S2 = Math.SQRT2;
/** A building's four corners [[x, z], ...] (front-right, front-left, back-left, back-right). */
export function corners(o) {
  const nx = Math.sin(o.f), nz = Math.cos(o.f), tx = Math.cos(o.f), tz = -Math.sin(o.f), hw = o.w / 2, hd = o.d / 2;
  return [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([s, u]) => [o.x + tx * hw * s + nx * hd * u, o.z + tz * hw * s + nz * hd * u]);
}
/** Is (x, z) inside building o's footprint, grown by m metres? */
export function inFootprint(o, x, z, m = 0) {
  const dx = x - o.x, dz = z - o.z, u = dx * Math.sin(o.f) + dz * Math.cos(o.f), v = dx * Math.cos(o.f) - dz * Math.sin(o.f);
  return Math.abs(u) < o.d / 2 + m && Math.abs(v) < o.w / 2 + m;
}
function place(ctx) {
  const { stage, xs0, zs0, th0, N0, startIdx } = ctx; if (!stage.buildings || !stage.buildings.length) return null;
  let cx = 0, cz = 0; for (let i = 0; i < N0; i++) { cx += xs0[i]; cz += zs0[i]; } cx /= N0; cz /= N0;
  const rnd = mulberry32(stage.seed * 17 + 401), pick = a => a[Math.floor(rnd() * a.length)];
  return stage.buildings.map((B, id) => {
    const T = BUILDINGS[B.type]; if (!T) throw new Error(`${stage.name}: buildings: no type "${B.type}" (${BUILDING_TYPES.join(', ')})`);
    let x, z, f;
    if (B.at !== undefined) {
      const b = ((startIdx + Math.round(B.at)) % N0 + N0) % N0, lat = B.lat || 0;
      x = xs0[b] - Math.cos(th0[b]) * lat; z = zs0[b] + Math.sin(th0[b]) * lat;
      f = Math.atan2(xs0[b] - x, zs0[b] - z) + (B.turn || 0) * Math.PI / 180;   // facing the road
    } else {
      x = cx + (B.a - B.b) / S2; z = cz - (B.a + B.b) / S2;
      const t = (B.face || 0) * Math.PI / 180, da = Math.cos(t), db = Math.sin(t); f = Math.atan2((da - db) / S2, -(da + db) / S2);
    }
    const o = { id, type: B.type, mat: B.mat || T.mat, x, z, f, w: B.w || T.w, d: B.d || T.d, floors: B.floors || T.floors, open: !!T.open, shop: !!T.shop, road: !!B.road,
      wall: pick(T.walls), roofC: pick(T.roofC), roof: T.roof };
    if (!o.road) {   // a building on the road is a mistake unless it says so
      const cs = corners(o).concat([[x, z]]);
      for (let i = 0; i < N0; i++) for (const [px, pz] of cs) if (Math.hypot(px - xs0[i], pz - zs0[i]) < HALF + 0.5) throw new Error(`${stage.name}: building ${id} (${B.type}) stands on the road at sample ${i}: move it, or say road: true`);
    }
    return o;
  });
}
export const element = {
  name: 'structures', onBranch: false,
  about: 'destructible buildings: walls of panels that heavy cars burst through and light ones crack, collapsing into rubble',
  stageKeys: { demolition: '{ time: s }: raced as a Demolition (core/modes/demolition.js): knock the buildings down against the clock', buildings: `destructible buildings: [{ type: ${BUILDING_TYPES.join(' | ')}, at, lat, turn } | { type, a, b, face }, + w, d, floors, road }]` },
  wallsLast(ctx) {
    const S = ctx.structures = place(ctx); if (!S) return;
    // the barrier comes out in front of a building near the road (the building is the edge), on that side only
    const { N0, xs0, zs0, th0, wallL0, wallR0, kerbL0, kerbR0 } = ctx;
    for (const o of S) {
      const pts = corners(o); for (let k = 0; k < 4; k++) { const p = pts[k], q = pts[(k + 1) % 4]; for (let t = 0.25; t < 1; t += 0.25) pts.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
      for (let i = 0; i < N0; i++) for (const [px, pz] of pts) {
        const dx = px - xs0[i], dz = pz - zs0[i]; if (dx * dx + dz * dz > 400) continue;
        const lat = -dx * Math.cos(th0[i]) + dz * Math.sin(th0[i]), along = dx * Math.sin(th0[i]) + dz * Math.cos(th0[i]);
        if (Math.abs(along) < 3 && Math.abs(lat) < WALL + STRUCT.PANEL * 2) { if (lat > 0) { if (wallR0[i] < 4) wallR0[i] = 0; kerbR0[i] = 0; } else { if (wallL0[i] < 4) wallL0[i] = 0; kerbL0[i] = 0; } }
      }
    }
  },
  track(ctx, out) {
    out.demolition = ctx.stage.demolition || null;
    const S = out.structures = ctx.structures || null; if (!S) return;
    // a building standing on a branch (road: true) blocks that shortcut: the AI takes it only once it's down or it can
    // smash its way through (sim/ai.js), like a breach
    const { NB, xs0, zs0, alts } = ctx;
    for (const o of S) if (o.road) {
      let b = 0, bd = 1e9; for (let i = 0; i < NB; i++) { const d = Math.hypot(xs0[i] - o.x, zs0[i] - o.z); if (d < bd) { bd = d; b = i; } }
      const k = alts.findIndex(a => b >= a.o && b < a.o + a.n); if (k >= 0) { o.alt = k; alts[k].breachSt = o.id; }
    }
  },
  markers: tr => (tr.structures || []).map(o => { const q = tr.nearest(o.x, o.z); return { i: q ? q.i : tr.startIdx, label: `${o.type} (${o.mat})` }; })
};
