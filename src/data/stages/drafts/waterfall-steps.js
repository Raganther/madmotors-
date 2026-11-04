// Waterfall Steps: no mountain, a staircase. The land rises from a lake in four cliffs, a creek falling down each one.
// The road climbs the staircase on ramps cut along the cliffs, crossing the creek at the foot of each waterfall, and
// comes back down the west side in a rush of esses and hairpins.
import { LOOK, bend, drawnLap, beatsAt } from './draw.js';

const MAP = {
  ground: { size: 1600, cell: 8, base: 0, seed: 5, rough: [4, 90],
    scarps: [[-900, -150, 900, -150, 22, 18], [-900, 0, 900, 0, 26, 20], [-900, 150, 900, 150, 28, 22], [-900, 300, 900, 300, 30, 24]] },
  lake: { pts: [[40, -380], [260, -400]], level: -3, width: 130, logs: 3, color: 0x4E7F8C },
  streams: [{ pts: [[20, 470], [0, 360], [30, 260], [-10, 170], [20, 80], [-20, 0], [10, -80], [-15, -160], [20, -250], [60, -330]], width: 10 }]
};
export const LINE = [
  [-150, -250], [100, -262, 'lake'],                          // along the lake shore, east
  [220, -250], [300, -215], [330, -180],
  [250, -160], [120, -150, 'ramp1'], [-60, -142], ...bend(-60, -117, 25, -90, -270).slice(1),   // ramp up the first cliff, west; hairpin
  [40, -8], [140, 0, 'ramp2'], [260, 8], ...bend(260, 33, 25, -90, 90).slice(1),               // the second, east; hairpin
  [160, 142], [60, 148, 'ramp3'], [-60, 153], ...bend(-60, 178, 25, -90, -270).slice(1),     // the third, west; hairpin
  [40, 296], [140, 300, 'ramp4'], [260, 305], ...bend(260, 330, 25, -90, 90).slice(1),         // the fourth, east; hairpin
  [180, 382], [60, 400, 'top'], [-80, 392], [-200, 372], [-300, 330],                                         // across the top, over the creek's source
  [-360, 270, 'down'], [-420, 200], [-350, 140], [-400, 70], ...bend(-370, 20, 50, 135, 270).slice(1),       // down the west side: esses...
  [-300, -60], [-260, -110], ...bend(-300, -150, 50, 45, -90).slice(1), [-380, -230], [-300, -260]           // ...and a last swoop to the shore
];
const { stage, at } = drawnLap(MAP, LINE);
export default { ...LOOK, ...stage, name: 'Waterfall Steps', blurb: 'Up a staircase of cliffs and waterfalls, down in a rush', laps: 2 };
export const design = {
  title: 'Waterfall Steps',
  story: 'The land rises from a lake in four cliffs, with a creek pouring down every one. You climb the staircase on ramps cut along the cliff faces, crossing the creek at the foot of each waterfall, then come back down the far side fast.',
  beats: beatsAt(at, [
    ['lake', 'The lake shore', 'Start beside the lake at the foot of the steps.'],
    ['ramp1', 'The first ramp', 'Up along the face of the first cliff, past the lowest waterfall.'],
    ['ramp2', 'The second ramp', 'Hairpin, and up the next cliff the other way: the creek again, one fall higher.'],
    ['ramp3', 'The third ramp', 'And again, higher still.'],
    ['ramp4', 'The fourth ramp', 'The last and tallest cliff.'],
    ['top', 'The top', 'Across the top step, over the creek where it starts.'],
    ['down', 'Down the west side', 'Esses down through the cliffs in cuttings, then a last swoop to the shore.']
  ]),
  build: ['Waterfalls where the creek drops off each cliff', 'Rock faces on the cliffs, ledges for the ramps']
};
