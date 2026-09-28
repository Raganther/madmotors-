// Stage: Open Country. The first off-piste stage (elements/open.js): a dirt road out of the start, then no road at all
// across a meadow, through a pine forest (find the gaps, or go round it), over a rock garden and through a stream,
// back onto a long dirt road home. Five gates must be taken in order each lap; between them it's your line.
const road = { dirt: true }, field = { open: 'field' }, forest = { open: 'forest' }, rocks = { open: 'rocks' };
export default { name: 'Open Country', blurb: 'Off-piste: gates across a meadow, a forest, a rock garden and a stream', type: 'gorge', laps: 2, seed: 4242, surface: 'gravel', hillAmp: 3, jumps: 0, armco: false,
  light: { sun: 0xFFF0D8, sunI: 0.98, sky: 0xE6F2FF, ground: 0x6B7A4A, hemiI: 0.6, cloud: 0.3, grade: [1.03, 1.0, 0.97], sat: 1.12 },
  colors: { grassA: 0x8FC25A, grassB: 0x6FA548, rock: 0xA29E92, dirt: 0xA8875E, road: 0x9A7C58, sky: 0xBFE3F2, round: [0x5E9C45, 0x74B04E, 0x4F8A3F, 0x86B84F], pine: [0x3E7447, 0x4A8250, 0x356A40] },
  trees: { density: 0.0016, pine: 0.55 }, rocks: 0.0006, bushes: 0.003, village: false,
  segs: [
    ['s', 100, 0, road], ['a', 50, 45, 0, road],                                        // the dirt road out of the start
    ['s', 30, 0, { ...road, gate: true }],                                              // gate 1, then off the road
    ['s', 140, 0, field], ['a', 120, 45, 0, field],                                     // across the meadow
    ['s', 20, 0, { ...field, gate: true }],                                             // gate 2
    ['s', 150, 0, forest], ['a', 80, 90, 0, forest],                                    // through the pines (or round them)
    ['s', 20, 0, { ...rocks, gate: true }],                                             // gate 3
    ['s', 150, 0, rocks], ['s', 10, 0, { open: 'stream' }], ['s', 40, 0, field],        // the rock garden and the stream
    ['a', 60, 90, 0, { ...road, gate: true }],                                          // gate 4: back on the road
    ['s', 180, 0, road], ['s', 20, 0, { ...road, gate: true }],                         // gate 5, half way down
    ['s', { toB: 30 }, 0, road], ['a', 30, 90, 0, road], ['s', { toA: 0 }, 0, road]           // home
  ] };
