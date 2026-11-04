// Crater: an old volcano with a lake in its crater. Up the outer slopes from the town at its foot, round the rim with
// the ground falling away inside and out, then a ledge cut into the crater's inner wall spiralling down to the lake,
// and out through the wall in a tunnel, under the rim road, and down the slopes to town.
import { LOOK, drawnLap, beatsAt } from './draw.js';

const MAP = {
  ground: { size: 1800, cell: 8, base: 20, seed: 10, rough: [6, 100, 1],
    hills: [[0, 0, 130, 320], [0, 0, -75, 150, 55]] },        // the volcano, and the crater in its top
  lake: { pts: [[-30, -10], [30, 10]], level: 79, width: 120, logs: 0, color: 0x3F7480 }
};
const around = (th0, th1, r0, r1, n) => Array.from({ length: n + 1 }, (_, k) => { const t = (th0 + (th1 - th0) * k / n) * Math.PI / 180, r = r0 + (r1 - r0) * k / n; return [Math.round(r * Math.cos(t)), Math.round(r * Math.sin(t))]; });
const up = around(-70, 130, 520, 205, 10), rim = around(140, 250, 172, 168, 5).slice(0), down = around(255, 600, 138, 112, 17);
up[0].push('slopes'); up[6].push('slopes2'); rim[1].push('rim'); down[0].push('ledge'); down[12].push('lakeside');
export const LINE = [
  [-120, -560], [100, -560, 'town'],                          // the town at the volcano's foot
  [230, -530], ...up,                                         // round and up the outer slopes
  ...rim,                                                     // round the rim
  ...down,                                                    // down the ledge inside the crater
  [-60, -150, 'out0'], [-80, -260], [-110, -360, 'out1'], [-150, -450], [-190, -530], [-160, -585]   // out through the wall, down to town
];
const { stage, at } = drawnLap(MAP, LINE);
export default { ...LOOK, ...stage, name: 'Crater', blurb: 'Up the volcano, round its rim, down inside the crater, out through the wall', laps: 2,
  colors: { ...LOOK.colors, rock: 0x6F665E, dirt: 0x7A5E48 }, alpine: { rock: [110, 140], snow: [400, 420], treeLine: 125 },
  towns: [{ style: 'alpine', at: 0, len: 150, steep: 10 }] };
export const design = {
  title: 'Crater',
  story: 'An old volcano with a lake in its crater. You climb its slopes, run round the rim with drops on both sides, spiral down a ledge inside the crater to the water, and leave through a tunnel in the crater wall, under the rim road.',
  beats: beatsAt(at, [
    ['town', 'The town at the foot', 'Start below the volcano.'],
    ['slopes', 'Up the slopes', 'A long climbing curve round the outside of the volcano.'],
    ['slopes2', 'Above the trees', 'Higher, the forest thinning to rock.'],
    ['rim', 'The rim', 'Round the crater\'s edge, falling away inside and out.'],
    ['ledge', 'Into the crater', 'Over the lip onto a ledge cut into the inner wall, spiralling down.'],
    ['lakeside', 'The crater lake', 'Down at the water.'],
    ['out0', 'Out through the wall', 'A tunnel through the crater wall, under the rim road.'],
    ['out1', 'Down to town', 'Fast down the outer slopes.']
  ]),
  build: ['Volcanic rock: dark crags on the rim and the crater wall']
};
