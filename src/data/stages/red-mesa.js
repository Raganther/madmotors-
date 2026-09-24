// Stage: Red Mesa Canyon. A short desert circuit built for air: five placed kickers ('kick' tags), a rock arch,
// a mine railway, a cliff-top ledge and a flyover across the start straight.
export default { name: 'Red Mesa Canyon', traffic: { on: 0, with: 1 }, blurb: 'Short and savage: five jumps, a rock arch and a mine railway', type: 'gorge', laps: 3, seed: 4242, surface: 'tarmac', hillAmp: 3, jumps: 0, armco: true, rockGap: 1.8,
  light: { sun: 0xFFD3A6, sunI: 1.08, sky: 0xFFE6C8, ground: 0x8A5A3A, hemiI: 0.56, cloud: 0.12, grade: [1.07, 1.0, 0.9], sat: 1.12, haze: { color: 0xE9B78E, top: 0, range: 40, amt: 0.35 } },
  colors: { grassA: 0xD8A46A, grassB: 0xC98F58, rock: 0xB4583A, rock2: 0xD27B4E, dirt: 0xCB9560, road: 0x5E5655, sky: 0xF3CFA6, round: [0x7D8A48, 0x8E9953, 0x6F7C40], pine: [0x6E7F45] },
  trees: { density: 0.0009, pine: 0 }, rocks: 0.004, bushes: 0.0025, cacti: 0.0016, village: false,
  alpine: { rock: [14, 44], snow: [900, 1000], treeLine: 900 }, strata: 3.2,
  // ore line from the mine: out of the hillside, across the road just past the rock arch, and back in
  rails: [{ id: 'mine', pts: [[276, 20, 5], [276, 215, 5]], portals: true, speed: 20, cars: 3, body: 0x3A3836, coach: 0x8C4A2A, band: 0xD9A13B }],
  segs: (() => {
    const wash = { far: 3, rampF: 20, near: 2, rampN: 20 }, climb = { far: 10, rampF: 12, near: -8, rampN: 14 }, plunge = { far: 8, rampF: 10, near: -6, rampN: 12 };
    const low = { far: 6, rampF: 14, near: -3, rampN: 16 }, arch = { arch: true, far: 24, rampF: 6, near: 2, rampN: 10 }, ledge = { far: 30, rampF: 5, near: -24, rampN: 10, rockfall: true };
    const stair = { far: 14, rampF: 8, near: -16, rampN: 12 }, run = { far: 8, rampF: 12, near: -8, rampN: 14 };
    return [
      ['s', 90, 0, wash],                                                   // start/finish in the dry wash
      ['a', 35, 90, 3, wash], ['a', 150, -20, 20, climb],                         // climb the mesa shoulder
      ['s', 25, 22, { ...climb, kick: 2.6 }], ['a', 130, 20, 6, plunge],          // Mesa Leap: over the crest and down
      ['a', 22, -180, 5, low], ['s', 25, 5, low], ['a', 25, 90, 5, low],
      ['s', 35, 5, arch],                                                    // rock arch
      ['s', 45, 5, low],                                                     // mine railway crossing
      ['a', 24, 90, 10, low], ['s', { toB: 240 }, 31, climb], ['a', 30, 90, 38, { ...ledge, rockfall: false }],
      ['a', 200, 12, 40, ledge], ['s', 30, 40, ledge],                                                  // cliff-top ledge (rockfall)
      ['s', 25, 40, { ...stair, kick: 2.4 }], ['a', 100, -12, 32, stair],         // the Staircase: two kicks down, landing on straights
      ['s', 20, 32, { ...stair, kick: 2.4 }], ['s', 41, 24, stair],
      ['a', 30, 90, 23, run], ['a', 40, -40, 21, run], ['a', 40, 80, 19, run], ['a', 40, -40, 18, run],
      ['s', 25, 18, { ...run, kick: 2.2 }], ['a', 70, -22, 16, run], ['a', 70, 22, 14, run], ['s', { toB: 30 }, 14, run],    // crest jump, then down to the flyover
      ['s', { toB: -30 }, 14, { bridge: true }],                              // flyover across the start straight
      ['s', { toB: -50 }, 12, low], ['a', 25, -90, 10, low],
      ['s', 30, 10, { ...low, kick: 2.4 }], ['s', { toA: -10 }, 3, low],     // last kick, down into the wash
      ['a', 25, -90, 2, wash], ['s', { toB: -25 }, 1, wash], ['a', 25, -90, 0, wash], ['s', { toA: 0 }, 0, wash]
    ];
  })() };
