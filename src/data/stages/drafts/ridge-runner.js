// Ridge Runner: a knife-edge ridge between two valleys. Out of town, up through the ridge's east end in a climbing
// tunnel, along the crest with the ground falling away both sides, off the west end on a long trestle into the north valley, back east along its river,
// then south straight through the ridge in a tunnel, under the crest road, to the lake and town.
import { LOOK, bend, drawnLap, beatsAt } from './draw.js';

const MAP = {
  ground: { size: 1900, cell: 8, base: 10, floor: 4, seed: 8, rough: [5, 90, 1],
    ridges: [[[[-420, 75], [-200, 125], [0, 90], [200, 135], [420, 100]], 75, 70, 45]] },
  lake: { pts: [[-440, -260], [-360, -110]], level: 3, width: 140, logs: 3, color: 0x4E7F8C },
  streams: [{ pts: [[700, 460], [450, 340], [200, 300], [0, 330], [-250, 300], [-500, 330], [-760, 420]], width: 11 }]
};
export const LINE = [
  [-150, -265], [100, -262, 'town'],                          // town, heading east
  [250, -240], [420, -170], [520, -90, 'climb'], [580, -10], ...bend(540, 40, 40, -30, 100).slice(1),   // up the east end
  [450, 92], [400, 100], [300, 120, 'crest'], [200, 135], [100, 110], [0, 90], [-100, 105], [-200, 125, 'crest2'], [-300, 105], [-400, 80],   // along the crest
  [-490, 58], [-570, 40, 'drop'], ...bend(-590, 80, 40, -60, -270).slice(1),   // down the west end, round into the north valley
  [-500, 190], [-420, 250, 'river'], [-300, 285], [-150, 270], [0, 290], [150, 270], [260, 245],   // east along the river
  [300, 200, 'tun0'], [310, 100], [300, 0, 'tun1'], [270, -80],   // south through the ridge, under the crest
  [220, -140], [80, -170], [-60, -150], [-200, -120, 'lake'], [-290, -160], [-290, -240], [-230, -275]   // round the lake to town
];
const { stage, at } = drawnLap(MAP, LINE);
export default { ...LOOK, ...stage, name: 'Ridge Runner', blurb: 'Along a knife-edge ridge, then back underneath it', laps: 2,
  towns: [{ style: 'alpine', at: 0, len: 160, steep: 10 }] };
export const design = {
  title: 'Ridge Runner',
  story: 'A knife-edge ridge between two valleys. You climb up inside it in a tunnel, run along its crest with the ground falling away on both sides, leave it on a long trestle, and later go straight through it, under the road you were on. The longest lap here.',
  beats: beatsAt(at, [
    ['town', 'Town', 'Start south of the ridge, heading east.'],
    ['climb', 'Up inside the ridge', 'Round the east end and into a tunnel that climbs up through the rock, popping out on the crest.'],
    ['crest', 'The crest', 'Along the knife edge, drops both sides, rolling over the high points.'],
    ['crest2', 'Still on the crest', 'The ridge kinks: commit, there is nowhere to go wide.'],
    ['drop', 'Off the west end', 'Straight off the end of the ridge onto a long curving trestle, 70 m down into the north valley.'],
    ['river', 'The north valley', 'Back east along the river through the trees.'],
    ['tun0', 'Through the ridge', 'A tunnel straight under the crest you drove along.'],
    ['lake', 'Round the lake', 'Out into the south valley and round the lake to town.']
  ]),
  build: ['Crags along the crest (the land is there, the rock look is not)']
};
