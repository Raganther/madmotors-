// Stage: The Stadium. A derby arena (core/elements/arena.js) under floodlights: a tarmac floor inside a concrete wall,
// crates and jersey blocks dotted about and three ramps. Fast and open: it rewards a good line into the side of a car.
export default { name: 'The Stadium', blurb: 'Derby arena: a floodlit tarmac bowl, concrete walls and three ramps', type: 'gorge', laps: 3, seed: 7373, surface: 'tarmac', hillAmp: 2, jumps: 0, armco: false,
  light: { sun: 0xE8EEFF, sunI: 0.8, sky: 0x8E9CC0, ground: 0x3A4050, hemiI: 0.7, cloud: 0.2, grade: [0.98, 1.0, 1.06], sat: 1.0 },
  colors: { grassA: 0x5E7A4A, grassB: 0x52703E, rock: 0x8A8A8E, dirt: 0x5A5E66, dirtRoad: 0x5A5E66, road: 0x4A4E56, sky: 0x8E9CC0, round: [0x4E7A3E, 0x5E8A48], pine: [0x3A5A40] },
  trees: { density: 0.0008, pine: 0.3 }, rocks: 0.0003, bushes: 0.001, village: false,
  arena: { ring: 'barrier', props: [{ kind: 'crates', n: 3 }, { kind: 'concrete', n: 4 }], ramps: 3 },
  segs: [['a', 30, 360, 0, { open: 'field' }]] };
