// Stage: Monster Stadium. Brannigan's home (the Rookie boss, data/career.js): a dirt supercross oval inside a
// floodlit stadium, made for the Monster Truck. Each straight has a big kicker, then a run of whoops or a mud pit;
// the ends are two tight dirt hairpins against the wall, and a line of crates down the back straight to drive over.
export default { name: 'Monster Stadium', blurb: 'Boss track: a floodlit dirt oval, two big kickers, whoops and a mud pit', type: 'gorge', laps: 7, seed: 8181, surface: 'gravel', hillAmp: 1, jumps: 0, armco: true,
  light: { sun: 0xEEF0FF, sunI: 0.85, sky: 0x7C88B0, ground: 0x4A4038, hemiI: 0.7, cloud: 0.15, grade: [1.02, 0.99, 1.04], sat: 1.06 },
  colors: { grassA: 0x6A5A44, grassB: 0x5E503C, rock: 0x7A746C, dirt: 0x8A6440, dirtRoad: 0x8E6A44, road: 0x8E6A44, sky: 0x7C88B0, round: [0x4E7A3E, 0x5E8A48], pine: [0x3A5A40] },
  trees: { density: 0, pine: 0 }, rocks: 0.0001, bushes: 0.0002, village: false,
  props: [{ kind: 'crates', at: 330, lat: -3 }, { kind: 'crates', at: 336, lat: 2.5 }, { kind: 'crates', at: 342, lat: -0.5 }],
  segs: (() => {
    const pit = { far: 1.2, rampF: 6, near: 1.2, rampN: 6 };   // the stadium's banked earth walls
    return [
      ['s', 40, 0, pit], ['s', 60, 0, { ...pit, kick: 2.8 }], ['s', 50, 0, { ...pit, whoops: 0.6 }],   // start, kicker 1, whoops
      ['a', 26, 180, 0, pit],                                                                       // hairpin by the scoreboard
      ['s', 45, 0, { ...pit, mud: true }], ['s', 55, 0, { ...pit, kick: 3 }], ['s', 50, 0, pit],      // mud pit, kicker 2, the crates
      ['a', 26, 180, 0, pit]
    ];
  })() };
