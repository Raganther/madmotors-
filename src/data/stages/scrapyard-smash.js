// Stage: Scrapyard Smash. A breaker's yard at dusk: a painted kicker over the car crusher off the start, then wrecking
// balls swinging across the crane alley (or dodge them through the crusher yard: straight, but dirt and a mud hole),
// two hairpins up the side of the scrap mountain, boost pads along its top deck and a leap off the end, over the
// void, down into the yard; then the long run home past the stacks.
export default { name: 'Scrapyard Smash', blurb: 'Wrecking balls, a crusher kicker and a leap off the scrap mountain', type: 'gorge', laps: 3, seed: 6262, surface: 'tarmac', hillAmp: 3, jumps: 0, armco: false,
  light: { sun: 0xFFD2A0, sunI: 0.95, sky: 0xC9B8A8, ground: 0x4A4038, hemiI: 0.6, cloud: 0.35, grade: [1.04, 0.99, 0.95], sat: 0.95, haze: { color: 0xB09880, top: 0, range: 30, amt: 0.35 } },
  colors: { grassA: 0x7A6E5A, grassB: 0x6A5E4C, rock: 0x7A5A44, rock2: 0x5E4A3E, dirt: 0x6E5A48, dirtRoad: 0x7A624C, road: 0x3E4046, sky: 0xB8A898, round: [0x6A7040, 0x5E6438], pine: [0x3A4A34, 0x44543A] },
  trees: { density: 0.0012, pine: 0.4 }, rocks: 0.006, bushes: 0.003, village: false,
  segs: (() => {
    const yard = { far: 1, rampF: 16, near: 0, rampN: 16 }, alley = { far: 3, rampF: 10, near: 1, rampN: 10 }, heap = { far: 10, rampF: 8, near: -6, rampN: 10 }, deck = { far: 6, rampF: 6, near: -10, rampN: 6 };
    return [
      ['s', 70, 0, yard], ['s', 30, 0, { ...yard, kick: 2.4 }], ['s', 50, 0, yard],          // start, over the crusher
      ['a', 25, 90, 0, yard],
      ['s', 20, 1, alley], ['a', 30, -45, 1, alley], ['s', 3.1, 1, alley], ['a', 30, 45, 1, alley],   // out round the crane...
      ['s', 70, 2, { ...alley, hammers: 3 }],                                       // ...and under the wrecking balls
      ['a', 30, 45, 2, alley], ['s', 3.1, 2, alley], ['a', 30, -45, 2, alley], ['s', 20, 3, alley],
      ['a', 25, 90, 4, heap], ['s', 50, 8, heap],                                    // up the scrap mountain
      ['a', 18, -180, 12, heap], ['s', 60, 17, heap], ['a', 18, 180, 21, heap],
      ['s', 40, 24, { ...deck, boost: true }], ['s', 30, 24, { ...deck, kick: 1.6 }],   // flat out along the top deck
      ['s', 30, 16, { gap: true, far: -26, near: -26, rampF: 3, rampN: 3 }],                                              // and off the end
      ['s', { toA: -15 }, 10, yard], ['a', 25, 90, 6, yard], ['s', { toB: 25 }, 1, yard], ['a', 25, 90, 0, yard], ['s', { toA: 0 }, 0, yard]
    ];
  })(),
  branches: [{ from: 5, to: 12, name: 'crusher yard', share: 0.35, segs: [
    ['s', 40, 1, { dirt: true, whoops: 0.5 }], ['s', 40, 1.5, { mud: true }], ['s', { toB: 204.24 }, 2, { dirt: true }]
  ] }] };
