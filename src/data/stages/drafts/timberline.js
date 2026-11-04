// Timberline: what the three layout drafts share. One mountainside above a lake, a logging town on the lake's south
// shore (the start line is on its main street, heading east), a creek that comes off the mountain in a gorge and falls
// into the lake's east end, high forest all round. Plan metres from the start line: a = right (east), b = up-screen
// (north, away from the camera). The drafts are three different laps over this same land, so they can be compared.
export const LAND = {
  size: 1300, cell: 8, base: 0,
  hills: [
    [80, 205, -8, 95],           // the lake's basin (gentle: the lake itself is the river element's bed)
    [960, 820, 150, 240],        // the mountain, north-east
    [-330, 470, 70, 160],        // the shoulder over the lake's west side
    [620, -40, 34, 120],         // the knoll east of town
    [-360, -60, 22, 120],        // and west of it
    [430, 330, 30, 90],          // the foothill the creek cuts its gorge through
    [40, -360, -9, 200]          // the valley falling away south (towards the camera)
  ],
  ridges: [
    [-600, 800, 900, 800, 110, 170],  // the mountain wall behind the lake
    [340, 280, 520, 322, -26, 18],   // the creek's gorge through the foothill: the falls are at its foot, a = 340
    [520, 322, 760, 380, -14, 18],   // and further up, shallower as the land drops behind the foothill
    [230, 245, 335, 278, -20, 12],   // an inlet of the lake up to the foot of the falls
    [-80, 20, 300, 20, -3, 60]       // the shelf the town sits on, just above the water
  ]
};
// the lake (a wide, still stretch of the river element: one water level for the whole stage)
export const LAKE = { pts: [[10, 205], [150, 215]], level: -11, width: 150, logs: 5, color: 0x4E7F8C };

export const LOOK = {
  type: 'gorge', seed: 6061, surface: 'gravel', hillAmp: 0, armco: false, startHeading: 0,
  light: { sun: 0xFFE4BE, sunI: 1.0, sky: 0xCFE2EE, ground: 0x4C5A40, hemiI: 0.58, cloud: 0.3, grade: [1.03, 1.0, 0.95], sat: 1.08, haze: { color: 0xA9C2CF, top: -6, range: 40, amt: 0.4 } },
  colors: { grassA: 0x5E8A44, grassB: 0x46703A, rock: 0x837F76, dirt: 0x8C6A48, road: 0x8E7357, sky: 0xB6D4E2, round: [0x4F7E3C, 0x5C8A42], pine: [0x24533A, 0x2C5E40, 0x1F4A33, 0x356A46] },
  trees: { density: 0.011, pine: 0.95 }, rocks: 0.0016, bushes: 0.0025, alpine: { rock: [70, 105], snow: [125, 160], treeLine: 95 },
  ground: LAND, river: LAKE
};
