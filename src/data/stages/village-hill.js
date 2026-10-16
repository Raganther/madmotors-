// Stage: Village Hill. Drawn by the user on the Sketch pad: a big hill with no set road up it. Out of the start, the
// gate drops you onto open mountainside and you climb it any way you like: across a meadow, up through an alpine
// village (go between the houses or round them), through a stream, then a boulder field where rocks come bouncing down
// the slope. Four gates in order keep everyone honest. At the top a road runs along the ridge and winds back down in
// switchbacks to the start.
const road = { dirt: true }, field = { open: 'field' }, rocks = { open: 'rocks' };
export default { name: 'Village Hill', blurb: 'Off-piste: climb the hill your own way through a village and falling boulders, then switchbacks down', type: 'gorge', laps: 2, seed: 9137, surface: 'gravel', hillAmp: 3, jumps: 0, armco: false,
  light: { sun: 0xFFEBD0, sunI: 1.0, sky: 0xDCEBFF, ground: 0x5E6E52, hemiI: 0.62, cloud: 0.35, grade: [1.02, 1.0, 1.02], sat: 1.1 },
  colors: { grassA: 0x9CC65E, grassB: 0x78A84B, rock: 0x9E988C, dirt: 0xA3845D, road: 0x93775A, sky: 0xB5DAEE, round: [0x5E9C45, 0x74B04E, 0x86B84F], pine: [0x2F6A3E, 0x3A7646, 0x285E38] },
  trees: { density: 0.0018, pine: 0.75 }, rocks: 0.0007, bushes: 0.003, village: false,
  towns: [{ style: 'alpine', at: 262, len: 205, steep: 7 }],
  segs: [
    ['s', 80, 0, road], ['s', 20, 0, { ...road, gate: true }],                         // the start, and gate 1 onto the hill
    ['s', 150, 10, field], ['s', 20, 12, { ...field, gate: true }],                    // up the meadow to gate 2
    ['s', 200, 28, field],                                                              // through the village (towns, above)
    ['s', 14, 29, { open: 'stream' }],                                                  // ford the stream
    ['s', 20, 31, { ...rocks, gate: true }], ['s', 140, 43, { ...rocks, rockfall: true }],   // gate 3, the boulder field
    ['a', 60, -90, 46, { ...road, gate: true }],                                        // gate 4: onto the ridge road
    ['s', 160, 46, road], ['a', 40, -90, 45, road],                                     // along the top, and over the edge
    ['s', 40, 42, road], ['a', 28, -80, 39, road], ['a', 28, 160, 32, road],            // the switchbacks down
    ['a', 28, -160, 25, road], ['s', 30, 23, road], ['a', 28, 160, 16, road],
    ['a', 28, -160, 9, road], ['a', 28, 80, 6, road],
    ['s', { toA: -30 }, 3, road], ['a', 40, -90, 1, road],                              // along the bottom
    ['s', { toB: -40 }, 0, road], ['a', 40, -90, 0, road], ['s', { toA: 0 }, 0, road]  // and home
  ] };
