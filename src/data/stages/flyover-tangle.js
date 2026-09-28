// Stage: Flyover Tangle. Drawn by the player in the track editor: a lap that knots itself eight times, so the road
// climbs to a middle level (9 m) and a high deck (18 m) and every crossing is a flyover. Off the start on the ground,
// a jump, under three decks; up and round over the knot, across the high deck, the long drop back down, then out through
// the village, a muddy jumping run and the climb over the start straight before the last swoop home. Autumn hills.
// Heights and bridge spans were planned so each crossing clears by at least 9 m with no grade much over 10%.
export default { name: 'Flyover Tangle', blurb: 'A lap knotted into eight flyovers, drawn in the track editor', type: 'gorge', laps: 3, seed: 5151, surface: 'tarmac', hillAmp: 3, jumps: 0, armco: true, viaduct: true,
  startHeading: -2.4751654293590293,
  light: { sun: 0xFFE2B8, sunI: 1.0, sky: 0xF2E6D2, ground: 0x7A6A48, hemiI: 0.6, cloud: 0.3, grade: [1.05, 1.0, 0.94], sat: 1.12 },
  colors: { grassA: 0xB8B45E, grassB: 0x9C9A4C, rock: 0xA89C8A, dirt: 0xB58E62, road: 0x565A62, sky: 0xE8D8BE, round: [0xD9822B, 0xC4562E, 0xE0A63A, 0x9C7A3A], pine: [0x3E6A42, 0x4A7448] },
  trees: { density: 0.0028, pine: 0.35 }, rocks: 0.0008, bushes: 0.004, village: false,
  segs: [
    ['s', 21.82, 0, { jump: true }], ['a', 27.3, 102.16, 0, {}], ['s', 42.95, 0, {}],
    ['a', 42.6, -116.41, 0, {}], ['a', 42.6, -29.58, 1.6, {}], ['s', 17.83, 3, {}],
    ['a', 16.5, -173.29, 6.7, {}], ['s', 28.13, 8.8, {}], ['s', 37.98, 9, { bridge: true }],
    ['s', 26.98, 9, { bridge: true }], ['a', 33.6, -63.12, 9, { bridge: true }], ['a', 33.6, -44.27, 9, {}],
    ['a', 33.6, -58.31, 9, { bridge: true }], ['a', 33.6, -10.72, 9.6, { bridge: true }], ['s', 23.52, 12, { bridge: true }],
    ['s', 5.93, 12.6, {}], ['a', 29.9, -46.05, 15, {}], ['a', 29.9, -48.31, 17.5, { bridge: true }],
    ['s', 4.78, 18, { bridge: true }], ['s', 34.01, 18, { bridge: true }], ['s', 5.54, 18, { bridge: true }],
    ['a', 62.2, -4.08, 18, { bridge: true }], ['a', 62.2, -18.44, 18, { bridge: true }], ['a', 62.2, -31.91, 18, { bridge: true }],
    ['s', 8.17, 18, { bridge: true }], ['a', 77.6, -24.69, 18, { bridge: true }], ['a', 77.6, -24.89, 14.6, { bridge: true }],
    ['a', 77.6, -18.28, 12.2, {}], ['s', 3.19, 11.8, {}], ['a', 14, 171.6, 7.6, {}],
    ['s', 8.81, 6.8, {}], ['a', 38.6, 100.34, 0, {}], ['a', 38.6, 29.17, 0, {}],
    ['s', 120.69, 0, {}], ['a', 37.8, -107.38, 1.9, {}], ['s', 35.08, 2.9, { town: true }],
    ['a', 83.8, -59.93, 5.2, { jump: true, mud: true }], ['s', 40.93, 6.3, { jump: true, mud: true }], ['a', 61.1, -64.32, 8.2, { jump: true, mud: true }],
    ['a', 61.1, -20.02, 8.7, { jump: true, mud: true, bridge: true }], ['s', 10.21, 9, { bridge: true }], ['s', 32.44, 7, { bridge: true }],
    ['s', 34.56, 5, {}], ['a', 15.6, 200.73, 1.7, {}], ['s', 27.73, 0, {}]
  ] };
