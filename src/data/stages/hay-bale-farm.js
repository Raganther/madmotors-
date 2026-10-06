// Stage: Hay Bale Farm. The third Rookie round: a gravel lap round the fields that teaches loose surfaces and air.
// Two gentle kickers (a hop, not a cliff), a short run of whoops through the orchard, the farmyard S-bend and a
// shallow ford. Low speeds, flat fields and hay bales on every bend: bounce off, never crash.
export default { name: 'Hay Bale Farm', blurb: 'Rookie: gravel round the fields, two little kickers, the orchard whoops and a ford', type: 'gorge', laps: 3, seed: 3303, surface: 'gravel', hillAmp: 2.5, jumps: 0, armco: false, soft: true,
  light: { sun: 0xFFEBC4, sunI: 1.05, sky: 0xF0EAD8, ground: 0x7A6E48, hemiI: 0.62, cloud: 0.25, grade: [1.04, 1.0, 0.94], sat: 1.12 },
  colors: { grassA: 0xC2B85E, grassB: 0xA8A04E, rock: 0x9A8E78, dirt: 0xA67C4E, road: 0xB08A5C, sky: 0xE8E0C8, round: [0x6E9A3E, 0x84A848, 0x9AB04E], pine: [0x4A6A3A] },
  trees: { density: 0.0024, pine: 0.1 }, rocks: 0.0006, bushes: 0.0035, towns: [{ style: 'farm', at: 0, len: 300 }, { style: 'farm', at: 550, len: 220 }],
  segs: (() => {
    const field = { far: 0.6, rampF: 26, near: -0.6, rampN: 26 }, ford = { far: -1.2, rampF: 8, near: -1.2, rampN: 8 };
    return [
      ['s', 90, 0, field],                                                    // start by the barn
      ['a', 55, 90, 0, field], ['s', 130, 0, { ...field, kick: 2.1 }],          // kicker 1 out of the first bend
      ['a', 55, 90, 0, field], ['s', 60, 0, { ...field, whoops: 0.5 }],         // the orchard whoops
      ['a', 45, -50, 0, field], ['a', 45, 50, 0, field],                       // the farmyard S-bend
      ['s', 70, -1, { ...ford, mud: 'water' }],                                // the ford
      ['a', 55, 90, 0, field], ['s', 40, 0, { ...field, kick: 2.1 }], ['s', 122.15, 0, field],   // kicker 2 down the back field
      ['a', 55, 90, 0, field], ['s', 108.94, 0, field]
    ];
  })() };
