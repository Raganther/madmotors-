// The Knot: a road tied in a trefoil knot over rolling forest hills, with a lake to the west. It crosses itself three
// times, over, under, over, so every lobe ends on a bridge or in a cutting under one.
import { LOOK, drawnLap, beatsAt } from './draw.js';

const MAP = {
  ground: { size: 1500, cell: 8, base: 20, floor: 4, seed: 7, rough: [10, 150],
    hills: [[0, 250, 30, 160], [-250, -150, 25, 140], [260, -120, 28, 150]] },
  lake: { pts: [[-500, -150], [-470, 150]], level: 3, width: 160, logs: 3, color: 0x4E7F8C },
  streams: [{ pts: [[200, 520], [120, 380], [180, 200], [60, 60], [-150, 20], [-330, 0], [-430, 10]], width: 10 }]
};
// the trefoil: x = sin t + 2 sin 2t, y = cos t - 2 cos 2t, 105 m to the unit, a point every 8 degrees
const P = []; for (let k = 0; k < 45; k++) { const t = k * 8 * Math.PI / 180; P.push([Math.round(105 * (Math.sin(t) + 2 * Math.sin(2 * t))), Math.round(105 * (Math.cos(t) - 2 * Math.cos(2 * t)))]); }
// where it crosses itself: each crossing's two passes, the first one in lap order low, the second high, alternately
const X = [], cross = (p, q, r, s) => { const d = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0]); if (!d) return false; const u = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / d, v = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d; return u > 0 && u < 1 && v > 0 && v < 1; };
for (let i = 0; i < P.length; i++) for (let j = i + 3; j < P.length; j++) if ((j + 1) % P.length !== i && cross(P[i], P[(i + 1) % P.length], P[j], P[(j + 1) % P.length])) X.push([i, j]);
const lift = [];
X.forEach(([i, j], n) => { const lo = n % 2 ? j : i, hi = n % 2 ? i : j, N = P.length; P[lo].push(`lo${n}`); P[(lo + 1) % N].push(`lo${n}b`); P[hi].push(`hi${n}`); P[(hi + 1) % N].push(`hi${n}b`); lift.push([`lo${n}`, `lo${n}b`, -7], [`hi${n}`, `hi${n}b`, 11]); });
P[2].push('lobe1'); P[17].push('lobe2'); P[32].push('lobe3');
export const LINE = P;
const { stage, at } = drawnLap(MAP, LINE, { lift: lift.map(([a, b, m]) => [a, b, m]) });
export default { ...LOOK, ...stage, name: 'The Knot', blurb: 'A road tied in a knot: three crossings, over, under, over', laps: 3 };
export const design = {
  title: 'The Knot',
  story: 'Pure layout madness: one road tied in a trefoil knot over rolling forest, crossing itself three times. Every lobe is a long sweeping bend that ends going over or under the road you were on a moment ago. Short and busy, three laps.',
  beats: beatsAt(at, [
    ['lobe1', 'The first lobe', 'A long sweeping bend through the trees...'],
    ['lo0', 'Under, then over', '...dive under the road, and a moment later you\'re crossing over it.'],
    ['lobe2', 'The second lobe', 'Round the next lobe beside the lake.'],
    ['lobe3', 'The third lobe', 'And the last, over the creek.']
  ]),
  build: ['Nothing new: bridges and cuttings we have']
};
