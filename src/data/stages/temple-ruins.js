// Stage: Temple Ruins. Deep jungle: off the start, across the moat on a drawbridge (jump it low or wait), under a stone
// arch and up the ziggurat's switchbacks to its top terrace, down past a waterfall, then round through a mud bog and
// a river splash, home along the south wall. Behind? The ruins path skips the ziggurat: a rough dirt track through the
// fallen stones, a bog, a crest jump and a run of whoops.
export default { name: 'Temple Ruins', blurb: 'A drawbridge moat, a ziggurat climb, a waterfall, and a path through the ruins', type: 'gorge', laps: 3, seed: 9292, surface: 'tarmac', hillAmp: 4, jumps: 0, armco: false,
  light: { sun: 0xFFF2C8, sunI: 0.95, sky: 0xCFE6D0, ground: 0x3A5A34, hemiI: 0.65, cloud: 0.3, grade: [0.98, 1.04, 0.96], sat: 1.18, haze: { color: 0xA8C8A0, top: -2, range: 28, amt: 0.45 } },
  colors: { grassA: 0x4E8A38, grassB: 0x3A7430, rock: 0x8A8672, rock2: 0x9A9278, dirt: 0x7A5E3E, dirtRoad: 0x8A6A44, road: 0x6E6A5E, sky: 0xB8D8C0, round: [0x2E7A34, 0x3E8A3A, 0x5A9A2E], pine: [0x2A5A2E, 0x346A34] },
  trees: { density: 0.009, pine: 0.15 }, rocks: 0.002, bushes: 0.008, village: false,
  segs: (() => {
    const jungle = { far: 3, rampF: 16, near: 0, rampN: 16 }, temple = { far: 8, rampF: 5, near: -5, rampN: 5 }, top = { far: 3, rampF: 5, near: -8, rampN: 5 };
    return [
      ['s', 70, 0, jungle], ['a', 30, 90, 1, jungle],                               // start
      ['s', 40, 1, { drawbridge: 0, far: -10, rampF: 3, near: -10, rampN: 3 }],     // over the moat
      ['s', 40, 4, jungle], ['a', 30, -90, 8, jungle],
      ['s', 50, 13, { ...temple, arch: true }],                                     // under the arch, up the ziggurat...
      ['a', 16, 180, 17, temple], ['s', 40, 21, top], ['a', 16, -180, 24, temple],  // ...its switchbacks...
      ['s', 104, 12, { ...temple, falls: true }],                                   // ...and down past the waterfall
      ['s', 36, 9, jungle], ['a', 30, -90, 6, jungle],
      ['s', 60, 3, { ...jungle, mud: true }], ['s', { toB: -40 }, 1, jungle],       // the bog
      ['a', 30, -90, 0, jungle],
      ['s', 60, 0, jungle], ['s', 24, -0.5, { mud: 'water', far: -1.5, rampF: 6, near: -1.5, rampN: 6 }], ['s', { toA: -40 }, 0, jungle],   // the river splash
      ['a', 35, -90, 0, jungle], ['a', 35, -90, 0, jungle], ['s', { toA: 0 }, 0, jungle]
    ];
  })(),
  branches: [{ from: 6, to: 10, name: 'ruins path', share: 0.2, segs: [
    ['s', 30, 14, { dirt: true, far: 4, rampF: 6, near: -2, rampN: 6 }],
    ['a', 17, 90, 15, { mud: true }], ['s', 30, 17, { dirt: true, yump: 2.0 }],
    ['a', 17, -90, 12, { dirt: true, whoops: 0.6 }]
  ] }] };
