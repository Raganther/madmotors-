// Stage: Old Town GP. Moreau's home (the Pro boss, data/career.js): a street circuit through an old harbour town for
// the Formula Racer. Armco on every kerb, houses either side: a long start straight, two square right-handers round
// the top block, a left-right flick through the market, the long run back with a fast chicane, and one blind right
// onto the straight. Flat and tight: brake late, touch nothing.
export default { name: 'Old Town GP', blurb: 'Boss track: a street circuit, square corners between the houses and a fast chicane', type: 'gorge', laps: 4, seed: 9292, surface: 'tarmac', hillAmp: 0.8, jumps: 0, armco: true,
  light: { sun: 0xFFF0D8, sunI: 1.06, sky: 0xD8ECFF, ground: 0x7E7A6E, hemiI: 0.66, cloud: 0.2, grade: [1.03, 1.0, 0.98], sat: 1.1 },
  colors: { grassA: 0x8EAA62, grassB: 0x7C9856, rock: 0xB0A898, dirt: 0xB8A486, road: 0x4E5258, sky: 0xC2E0F6, round: [0x5E9C45, 0x74B04E], pine: [0x3E7447] },
  trees: { density: 0.0006, pine: 0.1 }, rocks: 0.0004, bushes: 0.0015,
  towns: [{ style: 'village', at: 10, len: 220 }, { style: 'seaside', at: 300, len: 200 }, { style: 'village', at: 700, len: 300 }],
  segs: (() => {
    const st = { far: 0.3, rampF: 20, near: 0.3, rampN: 20 };
    return [
      ['s', 240, 0, st],                                                   // the start straight
      ['a', 20, -90, 0, st], ['s', 110, 0, st], ['a', 20, -90, 0, st],      // two square rights round the top block
      ['s', 60, 0, st], ['a', 16, 90, 0, st], ['s', 80, 0, st], ['a', 16, -90, 0, st],   // the market flick
      ['s', 148, 0, st], ['a', 22, -90, 0, st],                            // down to the harbour
      ['s', 70, 0, st], ['a', 25, 25, 0, st], ['a', 25, -50, 0, st], ['a', 25, 25, 0, st], ['s', 105.74, 0, st],   // the run back and the chicane
      ['a', 22, -90, 0, st]                                                // the blind right onto the straight
    ];
  })() };
