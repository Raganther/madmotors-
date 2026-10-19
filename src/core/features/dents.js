// Rubble heaps (features/structures.js: where a building or a bay of it came down) are the other way up: a rounded,
// lumpy pile over the footprint, top metres high (heapOf), that groundAt adds too, so a car climbs over it.
// Crater shapes (features/weapons.js makes them, track/query.js groundAt rides them, render/craters.js draws them):
// a bowl of radius k.r and depth k.dep with a raised lip of thrown-out ground round it, its outline a little ragged
// (a few lobes, turned by the crater's id). groundAt adds dentAt to the ground under every wheel, so a car drops into
// the hole and climbs out over the lip, on a road, a verge or the face of a jump alike.
export const DENT = { LIP: 0.24, LIP_AT: 1.05, LIP_W: 0.42, REACH: 1.5 };   // lip height (x depth), where it peaks and how wide (x radius); how far out the shape reaches
/** How far the crater's edge reaches at angle a (radius multiplier: the ragged outline). */
export const dentEdge = (k, a) => 1 + 0.11 * Math.sin(3 * a + k.id * 1.7) + 0.06 * Math.sin(5 * a + k.id * 2.9) + 0.03 * Math.sin(9 * a + k.id);
/** The height crater k adds to the ground at (x, z): below 0 in the bowl, a little above it on the lip. */
export function dentOf(k, x, z) {
  const dx = x - k.x, dz = z - k.z, d2 = dx * dx + dz * dz, R = k.r * DENT.REACH * 1.2; if (d2 > R * R) return 0;
  const u = Math.sqrt(d2) / (k.r * dentEdge(k, Math.atan2(dz, dx))), b = 1 - u * u, l = (u - DENT.LIP_AT) / DENT.LIP_W, lip = 1 - l * l;
  return -k.dep * (b > 0 ? b : 0) + (lip > 0 ? DENT.LIP * k.dep * lip * lip : 0);
}
/** All the craters' dents at (x, z). */
export function dentAt(D, x, z) { let h = 0; for (let j = 0; j < D.length; j++) h += dentOf(D[j], x, z); return h; }
/** The height heap h adds at (x, z): a rounded-rectangle pile w along its front x d deep, a little lumpy. */
export function heapOf(h, x, z) {
  const dx = x - h.x, dz = z - h.z, u = (dx * Math.cos(h.f) - dz * Math.sin(h.f)) / (h.w / 2), v = (dx * Math.sin(h.f) + dz * Math.cos(h.f)) / (h.d / 2);
  if (u > 1.1 || u < -1.1 || v > 1.1 || v < -1.1) return 0;
  const e = Math.sqrt(Math.sqrt(u ** 4 + v ** 4)) * (1 + 0.08 * Math.sin(Math.atan2(v, u) * 5 + h.x)); if (e >= 1) return 0;
  const lump = 0.8 + 0.2 * Math.sin(x * 2.3 + z * 1.1) * Math.sin(z * 2.9 - x * 0.7);
  return h.top * (1 - e * e) * lump;
}
/** The tallest heap at (x, z) (they overlap where bays fell next to each other and then the rest came down). */
export function heapAt(H, x, z) { let m = 0; for (let j = 0; j < H.length; j++) { const v = heapOf(H[j], x, z); if (v > m) m = v; } return m; }
