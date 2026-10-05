// Stage: Harbour Sprint. The second Rookie round: a seaside quay lap that teaches the drift boost. Three identical
// hairpins at the ends of the quays (the same corner three times a lap is how drifting clicks), a boost-pad blast
// along the harbour wall by the sea, and two easy sweepers home. Painted run-off and hay bales on every bend.
export default { name: 'Harbour Sprint', blurb: 'Rookie: three quay hairpins to learn the drift, and a boost run along the sea wall', type: 'gorge', laps: 3, seed: 2202, surface: 'tarmac', hillAmp: 1.5, jumps: 0, armco: true, soft: true,
  light: { sun: 0xFFF4DE, sunI: 1.08, sky: 0xDDF0FF, ground: 0x7A8A78, hemiI: 0.66, cloud: 0.2, grade: [1.0, 1.0, 1.03], sat: 1.12 },
  colors: { grassA: 0x9CC266, grassB: 0x88AE58, rock: 0xA7A39C, dirt: 0xC9B58E, road: 0x55595F, sky: 0xB6DDF2, round: [0x5E9C45, 0x74B04E], pine: [0x3E7447] },
  trees: { density: 0.0008, pine: 0.2 }, rocks: 0.0015, bushes: 0.002, village: true,
  river: { pts: [[-500, 250], [0, 252], [500, 250]], level: -3, width: 90, color: 0x5FAFD8 },   // the sea, beyond the harbour wall
  segs: (() => {
    const quay = { far: 0.3, rampF: 30, near: -0.3, rampN: 30 }, wall = { far: -4.5, rampF: 9, near: 0.3, rampN: 30 };
    return [
      ['s', 120, 0, quay],                                                    // start along the first quay
      ['a', 30, 180, 0, quay], ['s', 130, 0, quay],                            // hairpin 1, back along quay 2
      ['a', 30, -180, 0, quay], ['s', 130, 0, quay],                           // hairpin 2, out along quay 3
      ['a', 30, 180, 0, quay],                                                // hairpin 3
      ['s', 230, 0, { ...wall, boost: true }],                                // the harbour wall: boost pads by the sea
      ['a', 50, 90, 0, quay], ['s', 80, 0, quay], ['a', 50, 90, 0, quay],      // two easy sweepers home
      ['s', 110, 0, quay]
    ];
  })() };
