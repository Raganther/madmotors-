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
