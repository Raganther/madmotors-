export { bend, reversed, beatsAt } from './draw.js';
import { drawnLap as draw } from './draw.js';

// Timberline: the shared landscape for the layout drafts. A lake in a bowl of mountains: the big massif to the north,
// peaks north-east and north-west, shoulders east and west, low hills to the south (the camera's side, so the view
// stays open). Three rivers come down off the mountains in their own valleys and run into the lake: the north river
// (short and steep, through a gorge), the east river (a long winding valley) and the west creek. The log town is on
// the lake's south shore. Map metres with the lake in the middle: a = east, b = north (away from the camera).
export const MAP = {
  ground: {
    size: 1700, cell: 8, base: 5, floor: 1.5,
    hills: [
      [0, 40, -8, 160],            // the lake's bowl
      [-40, 620, 210, 210],        // the massif, north
      [700, 600, 150, 170],        // the north-east peak
      [-680, 560, 160, 180],       // the north-west peak
      [580, 60, 80, 150],          // the east shoulder
      [-680, 40, 90, 150],         // the west shoulder
      [0, -440, 22, 220],          // low hills south
      [330, -270, 34, 110],        // a knoll south-east of town
      [-330, -260, 30, 110]        // and south-west
    ],
    ridges: [
      [-30, 470, -10, 250, -60, 45], [-10, 250, 0, 160, -26, 34],                                    // the north river's gorge
      [560, 360, 470, 280, -40, 40], [470, 280, 400, 200, -42, 40], [400, 200, 300, 110, -30, 36], [300, 110, 170, 60, -14, 34],   // the east valley
      [-560, 300, -470, 230, -45, 40], [-470, 230, -400, 170, -40, 38], [-400, 170, -300, 90, -28, 34], [-300, 90, -180, 50, -12, 30]   // the west creek
    ]
  },
  lake: { pts: [[-150, 20], [-80, 85], [10, 95], [90, 50], [140, -5]], level: 0, width: 170, logs: 6, color: 0x4E7F8C },
  streams: [
    { pts: [[-40, 520], [-30, 470], [-20, 380], [-10, 250], [0, 165]], width: 12 },
    { pts: [[600, 400], [560, 360], [470, 280], [400, 200], [300, 110], [210, 70], [150, 55]], width: 16 },
    { pts: [[-600, 330], [-560, 300], [-470, 230], [-400, 170], [-300, 90], [-200, 55], [-150, 48]], width: 13 }
  ]
};

export const LOOK = {
  type: 'gorge', seed: 6061, surface: 'gravel', hillAmp: 0, armco: false,
  light: { sun: 0xFFE4BE, sunI: 1.0, sky: 0xCFE2EE, ground: 0x4C5A40, hemiI: 0.58, cloud: 0.3, grade: [1.03, 1.0, 0.95], sat: 1.08, haze: { color: 0xA9C2CF, top: 20, range: 60, amt: 0.4 } },
  colors: { grassA: 0x5E8A44, grassB: 0x46703A, rock: 0x837F76, dirt: 0x8C6A48, road: 0x8E7357, sky: 0xB6D4E2, round: [0x4F7E3C, 0x5C8A42], pine: [0x24533A, 0x2C5E40, 0x1F4A33, 0x356A46] },
  trees: { density: 0.011, pine: 0.95 }, rocks: 0.0018, bushes: 0.0025, alpine: { rock: [110, 150], snow: [175, 210], treeLine: 140 }
};

/** A lap over the Timberline landscape (draw.js drawnLap with this MAP). */
export const drawnLap = (line, opts) => draw(MAP, line, opts);
