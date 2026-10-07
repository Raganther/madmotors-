// Stage: Scrapyard Bowl. A derby arena (core/elements/arena.js; the derby: core/modes/derby.js) in the breaker's yard
// at dusk: a dirt bowl ringed with stacked tyres, crates and concrete blocks to smash or hide behind, and two earth
// ramps to fly off. Last car running wins. The ring of track round the middle is only where the cars line up.
export default { name: 'Scrapyard Bowl', blurb: 'Derby arena: a tyre-walled dirt bowl in the scrapyard, ramps and crates', type: 'gorge', laps: 3, seed: 7171, surface: 'gravel', hillAmp: 3, jumps: 0, armco: false,
  light: { sun: 0xFFD2A0, sunI: 0.95, sky: 0xC9B8A8, ground: 0x4A4038, hemiI: 0.6, cloud: 0.35, grade: [1.04, 0.99, 0.95], sat: 0.95, haze: { color: 0xB09880, top: 0, range: 30, amt: 0.35 } },
  colors: { grassA: 0x7A6E5A, grassB: 0x6A5E4C, rock: 0x7A5A44, rock2: 0x5E4A3E, dirt: 0x7A624C, dirtRoad: 0x7A624C, road: 0x6E5A48, sky: 0xB8A898, round: [0x6A7040, 0x5E6438], pine: [0x3A4A34, 0x44543A] },
  trees: { density: 0.0012, pine: 0.4 }, rocks: 0.004, bushes: 0.002, village: false,
  arena: { ring: 'tyres', props: [{ kind: 'crates', n: 4 }, { kind: 'concrete', n: 3 }], ramps: 2 },
  segs: [['a', 26, 360, 0, { open: 'field' }]] };
