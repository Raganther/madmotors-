// Archipelago: a lake full of islands, each its own place, and the lap hops between them. From the log town on the
// long south island, through the shallows to the mountain island and round and up its cone, off its top on a trestle
// across the water to the ridge island and along its spine, through a long ford to the gorge island and down the
// slot canyon through its middle, then island to island over the stepping stones back to town. The lake floor is the
// land itself (river bed: false), so every hill that clears the water is an island, and the fords are sand bars just
// under the surface: you drive through the water, not over it.
import { LOOK, drawnLap, beatsAt } from './draw.js';

const bar = (a1, b1, a2, b2) => [a1, b1, a2, b2, 4.4, 20, 8];   // a sand bar from one island to the next, 0.6 m under the water
const MAP = {
  ground: { size: 2000, cell: 8, base: 15, seed: 13, rough: [3, 70],
    hills: [
      [0, 760, 70, 220], [-900, 300, 60, 220], [900, 300, 65, 220], [-650, -600, 35, 200], [650, -600, 30, 200],   // hills round the lake
      [-400, -20, 52, 175, 110], [-400, -20, 8, 45],   // the mountain island: a cone
      [430, 40, 32, 150, 55],                          // the gorge island
      [370, -150, 9, 40, 15], [290, -195, 9, 38, 14]   // the stepping stones
    ],
    ridges: [
      [-470, 20, 470, 20, -20, 600, 170],              // the lake's bowl: a flat floor 5 m under the water, shores rising to the hills
      [-150, -240, 150, -240, 10, 85, 45],             // the town's long island
      [[[-230, 230], [-30, 285], [120, 262]], 32, 46], // the ridge island
      [[[434, -62], [436, 60], [438, 138]], -26, 18, 7],   // the slot canyon through the gorge island
      bar(-215, -228, -318, -142), bar(250, 232, 405, 190), bar(426, -124, 384, -146), bar(352, -164, 306, -188), bar(272, -208, 226, -232)
    ] },
  lake: { pts: [[-470, 20], [470, 20]], level: 0, width: 860, logs: 5, color: 0x3F7E8E, bed: false }
};
// one turn clockwise round the cone, from its south side, closing in as it climbs
const spiral = []; for (let k = 0; k <= 18; k++) { const th = (-90 - k * 20) * Math.PI / 180, r = 150 - k * 3.6; spiral.push([Math.round(-400 + r * Math.cos(th)), Math.round(-20 + r * Math.sin(th))]); }
spiral[0].push('mountain'); spiral[8].push('under0'); spiral[10].push('under1');
export const LINE = [
  [120, -236], [-80, -244, 'town'],                           // main street, the length of the town's island
  [-170, -238], [-218, -224, 'ford1'], [-266, -184], [-312, -148, 'ford1b'],   // through the shallows to the mountain island
  ...spiral,                                                  // round and up the cone
  [-428, -62], [-418, -5, 'top'], [-396, 50, 'over0'], [-372, 98], [-350, 125, 'over1'],   // over the top, across the climb below
  [-318, 150, 'tr0'], [-282, 188], [-242, 225, 'tr1'],        // off it on the trestle, across the water
  [-170, 255, 'ridge'], [-90, 275], [-30, 285], [60, 274], [125, 266], [185, 272], [228, 252],   // along the ridge island's spine and down its end
  [275, 226, 'ford2'], [330, 212, 'ford2b'], [380, 198, 'ford2c'],   // the long ford
  [430, 190], [438, 140, 'slot'], [436, 60], [433, -30], [430, -112],   // down the slot canyon
  [405, -135, 'ford3'], [370, -152, 'stones'], [330, -174, 'ford4'], [290, -196], [252, -218, 'ford5'], [200, -232]   // the stepping stones home
];
const fords = ['ford1', 'ford1b', 'ford2', 'ford2b', 'ford2c', 'ford3', 'ford4', 'ford5'];
const { stage, at } = drawnLap(MAP, LINE, { lift: [['tr0', 'tr1', 9], ['over0', 'over1', 6], ['under0', 'under1', -4]], pieces: fords.map(f => [f, 'mud', 'water']) });
export default { ...LOOK, ...stage, name: 'Archipelago', blurb: 'Island to island: through the shallows, up a cone, along a ridge, down a slot canyon', laps: 2,
  colors: { ...LOOK.colors, dirt: 0xB09A74 }, towns: [{ style: 'alpine', at: 0, len: 190, steep: 10 }] };
export const design = {
  title: 'Archipelago',
  story: 'A lake full of islands, each a different place, and the lap hops between them. Most of the crossings are fords: sand bars just under the surface that you drive through, spray everywhere. One island is a cone you spiral up, one is a ridge you run along the spine of, one has a slot canyon cut through it, and the last few are stepping stones.',
  beats: beatsAt(at, [
    ['town', 'The town island', 'Start on main street, the length of the long south island, water both sides.'],
    ['ford1', 'Through the shallows', 'Off the end of the island and through the water on a sand bar.'],
    ['mountain', 'The mountain island', 'Round and up the cone, the lake falling away below.'],
    ['top', 'Over the top', 'Across the summit, over the road you climbed...'],
    ['tr0', 'The trestle', '...and off it on a long timber trestle across the water to the next island.'],
    ['ridge', 'The ridge island', 'Along the spine of a long narrow island, water both sides.'],
    ['ford2', 'The long ford', '150 m through the water to the gorge island.'],
    ['slot', 'The slot canyon', 'Straight down a narrow canyon cut through the island, rock walls close either side.'],
    ['stones', 'The stepping stones', 'Island, ford, island, ford, island: hopping back to town.']
  ]),
  build: ['Fords that feel like water: the splash we have (spray, drag), at the scale of a sand bar', 'Sandy beaches round every island', 'Rock walls for the slot canyon', 'A timber trestle', 'The big lake is one water sheet: it may need a coarser grid to stay fast']
};
