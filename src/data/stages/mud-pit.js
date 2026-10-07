// Stage: Mud Pit. A derby arena (core/elements/arena.js) on the farm: a churned mud field walled with hay bales, more
// bales and a few fences across it, one ramp. Slow, sideways and heavy: the trucks love it.
export default { name: 'Mud Pit', blurb: 'Derby arena: a mud field walled with hay bales at the farm', type: 'gorge', laps: 3, seed: 7272, surface: 'gravel', hillAmp: 2.5, jumps: 0, armco: false, soft: true,
  light: { sun: 0xFFEBC4, sunI: 1.05, sky: 0xF0EAD8, ground: 0x7A6E48, hemiI: 0.62, cloud: 0.3, grade: [1.04, 1.0, 0.94], sat: 1.1 },
  colors: { grassA: 0xC2B85E, grassB: 0xA8A04E, rock: 0x9A8E78, dirt: 0x6E5238, dirtRoad: 0x6E5238, road: 0x6E5238, sky: 0xE8E0C8, round: [0x6E9A3E, 0x84A848, 0x9AB04E], pine: [0x4A6A3A] },
  trees: { density: 0.002, pine: 0.1 }, rocks: 0.0006, bushes: 0.003, village: false,
  arena: { ring: 'bales', props: [{ kind: 'hay', n: 5 }, { kind: 'fence', n: 3 }], ramps: 1 },
  segs: [['a', 28, 360, 0, { open: 'field' }]] };
