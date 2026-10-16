// Crumble: an old timber bridge that wears out under the race (features/crumble.js runs it). The deck is planks in
// three lanes, a plank a metre; every car crossing wears the planks under it, heavy ones far faster (mass squared),
// a landing hardest of all. Worn planks sag and darken, then drop into the water. A car whose middle is over a hole
// drops through and comes back on the far side (like a gap); arrive fast and a hole is only a bump you fly over.
// Lap by lap the line across gets ragged: the AI picks the soundest lane (sim/ai.js). Tag a straight section over a
// channel (far/near about -10 with short ramps, like a drawbridge) `crumble: true`, or a number to scale how strong
// it is (1 = CRUMBLE.HP); a `kick` just before it gives a way over once it's gone.
import { runs, baseRuns } from './jump.js';
export const CRUMBLE = { HP: 1, WEAR: 2.4, LAND: 0.03, SAG: 0.3, LANES: 3, LANE_W: 4 };
export const element = {
  name: 'crumble', hollow: true,
  about: 'an old timber bridge that wears out plank by plank as the race crosses it: heavy cars fastest',
  tags: { crumble: 'this straight section is a timber bridge that wears through (a number scales its strength)' },
  channels: { crumble: tg => tg.crumble ? (typeof tg.crumble === 'number' ? Math.round(tg.crumble * 10) : 10) : 0 },
  walls(ctx) {
    const { N0, ch, wallL0, wallR0, kerbL0, kerbR0 } = ctx;
    for (let i = 0; i < N0; i++) if (ch.crumble[i]) { wallL0[i] = wallR0[i] = 4; kerbL0[i] = kerbR0[i] = 0; }   // timber railings
  },
  track(ctx, out) {
    const { ch, N0, H0 } = ctx; if (!ch.crumble.some(v => v)) { out.crumble = null; out.crumbles = []; return; }
    out.crumble = ch.crumble;
    out.crumbles = runs(ch.crumble, N0).map(([a, b]) => ({ a, b, h0: H0[(a - 1 + N0) % N0], h1: H0[b % N0], k: ch.crumble[a] / 10, land: (b + 8) % N0 }));
  },
  markers: tr => baseRuns(tr, tr.crumble).map(([a, b]) => ({ i: a, label: `crumbling bridge ${b - a}m` }))
};
