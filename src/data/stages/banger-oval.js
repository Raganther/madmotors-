// Stage: Banger Oval. A derby track (G3): a short tarmac oval behind a tyre-lined Armco, made for banger racing (data/
// formats.js): two straights, two tight ends, the whole field nose to tail into the first bend. Contact pays here.
export default { name: 'Banger Oval', blurb: 'Derby track: a short oval for banger racing, tight ends, nose to tail', type: 'gorge', laps: 6, seed: 7474, surface: 'tarmac', hillAmp: 1.5, jumps: 0, armco: true,
  light: { sun: 0xFFE2B8, sunI: 0.95, sky: 0xC8C0D8, ground: 0x4A4838, hemiI: 0.62, cloud: 0.3, grade: [1.03, 1.0, 0.97], sat: 1.0 },
  colors: { grassA: 0x6E8A4E, grassB: 0x5E7A42, rock: 0x8A8478, dirt: 0x8A7458, road: 0x50545C, sky: 0xC8C0D8, round: [0x4E7A3E, 0x5E8A48], pine: [0x3A5A40] },
  trees: { density: 0.0016, pine: 0.3 }, rocks: 0.0004, bushes: 0.002, village: false,
  segs: (() => {
    const flatland = { far: 0.3, rampF: 20, near: -0.3, rampN: 20 };
    return [['s', 130, 0, flatland], ['a', 32, 180, 0, flatland], ['s', 130, 0, flatland], ['a', 32, 180, 0, flatland]];
  })() };
