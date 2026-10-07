// Stage: Salt Flats. Achterberg's home (the Legend boss, data/career.js): a speed course graded into a dry salt
// lake (the darker strip is the graded track) for the Rocket Car. Two very long straights with boost pads, four long sweepers you can just about take flat,
// and two fast kinks. Nothing to hit and nowhere to hide: pure top speed and nerve.
export default { name: 'Salt Flats', blurb: 'Boss track: a speed course on a salt lake, two huge straights and flat-out sweepers', type: 'gorge', laps: 2, seed: 7070, surface: 'tarmac', hillAmp: 0.4, jumps: 0, armco: false,
  light: { sun: 0xFFF4E4, sunI: 0.9, sky: 0xBFDDF6, ground: 0xB8B0A0, hemiI: 0.56, cloud: 0.3, grade: [1.0, 0.99, 0.97], sat: 1.05 },
  colors: { grassA: 0xE2DCCE, grassB: 0xD6CEBC, rock: 0xA89E8A, dirt: 0xCFC4AE, road: 0x6E665C, sky: 0xB4D6F2, round: [0x8E9A6A], pine: [0x6E7A5A] },
  trees: { density: 0, pine: 0 }, rocks: 0.0002, bushes: 0.0003, village: false,
  segs: (() => {
    const flat = { far: 0.1, rampF: 60, near: -0.1, rampN: 60 }, kink = [['a', 300, 8, 0, flat], ['a', 300, -16, 0, flat], ['a', 300, 8, 0, flat]];
    return [
      ['s', 300, 0, { ...flat, boost: true }], ...kink, ['s', 230, 0, flat],   // the start straight: boost pads, a kink
      ['a', 180, 90, 0, flat], ['s', 200, 0, flat], ['a', 180, 90, 0, flat],    // the far sweepers
      ['s', 300, 0, { ...flat, boost: true }], ...kink, ['s', 230, 0, flat],   // back the other way
      ['a', 180, 90, 0, flat], ['s', 200, 0, flat], ['a', 180, 90, 0, flat]
    ];
  })() };
