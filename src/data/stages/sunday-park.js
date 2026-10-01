// Stage: Sunday Park. The first Rookie round: a flat parkland lap built to learn the controls on. A long start straight,
// two fast sweepers you can take flat, and one wide hairpin round the duck pond that teaches braking. A wide-open
// park with hay bales on the bends instead of tyres: a mistake costs a second, never the race.
export default { name: 'Sunday Park', blurb: 'Rookie: flat parkland, two fast sweepers and a hairpin round the duck pond', type: 'gorge', laps: 3, seed: 1101, surface: 'tarmac', hillAmp: 2, jumps: 0, armco: false, soft: true,
  light: { sun: 0xFFF6E0, sunI: 1.05, sky: 0xE4F2FF, ground: 0x6E8A52, hemiI: 0.64, cloud: 0.25, grade: [1.0, 1.01, 1.0], sat: 1.14 },
  colors: { grassA: 0x8FCB58, grassB: 0x74B44A, rock: 0xA8A49A, dirt: 0xB79C72, road: 0x5A5E66, sky: 0xBFE2F4, round: [0x4E9A3E, 0x67AE48, 0x7DBE52, 0x3F8A3A], pine: [0x3E7447, 0x4A8250] },
  trees: { density: 0.0022, pine: 0.15 }, rocks: 0.0004, bushes: 0.003, village: false,
  river: { pts: [[-54, 28], [-40, 38], [-26, 28]], level: -2.6, width: 14, color: 0x7CC4E8 },   // the duck pond inside the hairpin
  segs: (() => {
    const park = { far: 0.5, rampF: 30, near: -0.5, rampN: 30 };
    return [
      ['s', 200, 0, park],                                                    // start straight
      ['a', 80, 120, 0, park], ['s', 34.16, 0, park], ['a', 80, 90, 0, park],  // the two fast sweepers
      ['s', 230.85, 0, park],                                                 // back straight
      ['a', 34, 150, 0, park],                                                // round the pond
      ['s', 40, 0, park]
    ];
  })() };
