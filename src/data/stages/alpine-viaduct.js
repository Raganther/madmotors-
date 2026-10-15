// Alpine Viaduct: the first stage on a described landscape (core/track/ground.js): a ring of mountains, a valley and a
// ridge in the middle, and a 1.7 km lap laid over them the way the Terrain builder lays a road. Off the start shelf
// over a crest, a fast right and a downhill S into the valley side; the road is held 30 m up on a viaduct across the
// valley, lands into whoops, swings round two lefts and climbs at the ridge, then dives under it in a tunnel. Out of the
// tunnel through a mountain stream, over a crest, a long left, the chicane straight across the top, a kicker and back
// onto the shelf. About 55 s a lap.
export default {
  name: 'Alpine Viaduct', blurb: 'A viaduct over the valley, a tunnel through the ridge, a mountain stream', type: 'gorge', laps: 3, seed: 4417,
  surface: 'tarmac', hillAmp: 0, armco: true, startHeading: 0,
  light: { sun: 0xFFEAD4, sunI: 1.0, sky: 0xD2E4FF, ground: 0x566A58, hemiI: 0.62, cloud: 0.25, grade: [1.0, 1.0, 1.05], sat: 1.1 },
  colors: { grassA: 0x86BC58, grassB: 0x5F9443, rock: 0x9A968E, dirt: 0xA48A68, road: 0x4D5159, sky: 0xA9D2EC, round: [0x5A9842, 0x6FAE4C], pine: [0x2C663B, 0x377244, 0x265A36, 0x417D4A] },
  trees: { density: 0.004, pine: 0.9 }, rocks: 0.003, bushes: 0.002, alpine: { rock: [45, 85], snow: [95, 125], treeLine: 70 },
  // the landscape: the start shelf, the valley the viaduct spans, the ridge the tunnel goes under, the stream, and a
  // ring of peaks round the lap (plan metres from the start line: a = right, b = up-screen)
  ground: {
    size: 900, cell: 8, base: 0,
    hills: [[40, 30, 22, 80], [-160, -300, 110, 90], [500, -320, 130, 100], [150, 340, 95, 90], [520, 160, 85, 80], [-230, 130, 75, 80], [250, -640, 75, 90]],
    ridges: [[40, -230, 262, -230, -35, 38], [272, -270, 440, -270, 45, 26], [262, -132, 440, -132, -5, 9]]
  },
  // the road over it: held up across the valley (a viaduct), sunk under the ridge (a tunnel); the stream's splash and a
  // second crest by the metre
  drape: { lift: [[300, 440, 30], [750, 880, -45]], pieces: [{ s: 950, tag: 'mud', v: 'water' }, { s: 1050, tag: 'yump', v: 2.4 }] },
  segs: [
    ['s', 100, 0, { yump: 2.6 }],         // the start shelf and its crest
    ['a', 60, -90, 0, {}],                     // fast right
    ['a', 50, 35, 0, {}],                      // downhill S
    ['a', 50, -35, 0, {}],
    ['s', 220, 0, {}],                         // the viaduct
    ['s', 50, 0, { whoops: 0.7 }],             // whoops off the far end
    ['a', 35, 90, 0, {}],                      // two lefts at the foot of the ridge
    ['s', 60, 0, { boost: true }],
    ['a', 35, 90, 0, {}],
    ['s', 230, 0, {}],                         // the climb, and the tunnel under the ridge
    ['s', 217.36, 0, {}],                      // the stream, then a crest
    ['a', 70, 90, 0, {}],                      // the long left
    ['s', 228.08, 0, { chicane: 'concrete' }], // the chicane straight across the top
    ['a', 50, 90, 0, {}],
    ['s', 40, 0, { kick: 2.4 }],               // a kicker
    ['a', 40, 90, 0, {}]                       // back onto the shelf
  ]
};
