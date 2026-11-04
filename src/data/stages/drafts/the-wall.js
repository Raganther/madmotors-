// The Wall: a 110 m escarpment across the map. From the lowland town, up the face on a ladder of hairpins, along the
// top and over the river where it pours off the edge, then down inside the rock in a spiral tunnel that passes under
// itself, out at the foot of the wall, and round the lake to town.
import { LOOK, bend, drawnLap, beatsAt } from './draw.js';

const MAP = {
  ground: { size: 1800, cell: 8, base: 0, seed: 11, rough: [6, 100, 1], scarps: [[-900, 0, 900, 0, 110, 360]] },
  lake: { pts: [[-420, -300], [-250, -330]], level: -2, width: 150, logs: 3, color: 0x4E7F8C },
  streams: [{ pts: [[120, 520], [100, 300], [80, 150], [60, 0], [30, -150], [-120, -250], [-250, -320]], width: 11 }]
};
const helix = []; for (let k = 0; k <= 27; k++) { const t = (90 + k * 20) * Math.PI / 180, r = 66 - k * 0.9; helix.push([Math.round(-350 + r * Math.cos(t)), Math.round(170 + r * Math.sin(t))]); }
helix[0].push('helix'); helix[9].push('hx1'); helix[18].push('hx2'); helix[27].push('hx3');
export const LINE = [
  [-100, -300], [150, -300, 'town'],                          // the lowland town
  [300, -280], [420, -240], [490, -185],                     // to the foot of the wall
  [450, -170, 'ladder'], [280, -140], ...bend(280, -114, 26, -90, -270).slice(1),   // the ladder: west, hairpin...
  [450, -60], ...bend(450, -34, 26, -90, 90).slice(1),        // ...east, hairpin...
  [280, 20], ...bend(280, 46, 26, -90, -270).slice(1),        // ...west, hairpin...
  [450, 100], ...bend(450, 126, 26, -90, 90).slice(1),        // ...east, hairpin...
  [280, 180],                                                 // ...and west to the top
  [150, 215, 'top'], [90, 225, 'falls'], [-100, 232], [-250, 225],   // along the top, over the river at the lip
  ...helix,                                                   // the spiral tunnel, down inside the wall
  [-310, 95], [-318, 0], [-330, -120, 'out'],                 // out at the foot
  [-340, -180], [-290, -240, 'lake'], [-200, -285]            // round the lake to town
];
const { stage, at } = drawnLap(MAP, LINE, { lift: [['hx1', 'out', -22], ['hx2', 'out', -22], ['hx3', 'out', -22]] });   // down a step each time round
export default { ...LOOK, ...stage, name: 'The Wall', blurb: 'Up a cliff on a ladder of hairpins, down inside it in a spiral tunnel', laps: 2,
  towns: [{ style: 'alpine', at: 0, len: 180, steep: 10 }] };
export const design = {
  title: 'The Wall',
  story: 'A 110 m escarpment cuts the map in two. You climb it on a ladder of four hairpins stacked up the face, cross the river where it pours off the edge, and come back down inside the rock in a spiral tunnel that loops under itself.',
  beats: beatsAt(at, [
    ['town', 'The lowland town', 'Start below the wall.'],
    ['ladder', 'The ladder', 'Five legs zigzagging up the cliff face, a hairpin at every end: the whole climb is in view from the camera.'],
    ['top', 'The top', 'Over the lip and along the top.'],
    ['falls', 'Over the falls', 'Across the river right where it pours off the edge.'],
    ['helix', 'The spiral tunnel', 'Into the rock and round and down, passing under yourself.'],
    ['out', 'Out at the foot', 'Burst out of the cliff base.'],
    ['lake', 'Round the lake', 'Back to town.']
  ]),
  build: ['A waterfall off the escarpment', 'Rock on the cliff face', 'Lit tunnel interiors would help the spiral']
};
