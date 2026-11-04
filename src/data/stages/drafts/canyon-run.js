// Canyon Run: no lake, a river canyon. A forested plateau cut by a sheer-walled canyon and a side canyon. Out of the
// logging camp along the north rim, high over the side canyon, then down a ledge cut into the canyon's north wall
// and a hairpin onto the floor. Upstream along the floor beside the river, crossing it on low timber bridges, under
// the high bridge you'll cross later; up the south wall by a hairpin, along the south rim, and back across the
// canyon on a bridge 55 m over the river.
import { LOOK, bend, drawnLap, beatsAt } from './draw.js';

const C = [[-500, -100], [-250, -20], [-50, -120], [150, -30], [350, 60], [550, 0]];   // the canyon's line
// a point on the canyon floor at `a` metres east, `off` metres north of the river (south if negative)
const floor = list => list.map(([a, off, name]) => {
  let k = 0; while (k < C.length - 2 && C[k + 1][0] < a) k++;
  const [a0, b0] = C[k], [a1, b1] = C[k + 1], u = (a - a0) / (a1 - a0), L = Math.hypot(a1 - a0, b1 - b0), p = [a, Math.round(b0 + (b1 - b0) * u + off * (a1 - a0) / L)];
  return name ? [...p, name] : p;
});
const MAP = {
  ground: { size: 1700, cell: 8, base: 60, seed: 3, rough: [7, 140],
    ridges: [[C, -55, 80, 34], [150, -30, 90, 420, -40, 46, 24]] },   // the canyon (flat floor, sheer walls) and the side canyon
  streams: [{ pts: [[90, 440], [150, -30]], width: 8 }, { pts: [[650, 20], ...C.slice().reverse(), [-650, -140]], width: 10 }]
};
export const LINE = [
  [-320, 170], [-160, 170, 'camp'],                           // the logging camp on the north rim
  [-80, 175], [0, 160], [60, 150], [126, 150, 'side'], [200, 150],   // high over the side canyon
  [170, 112], [230, 62, 'ledge'], [300, 86], [400, 86], [500, 52],   // down onto the ledge in the north wall
  ...bend(560, 20, 30, 90, -90, null, 'floor'),               // a hairpin onto the floor
  ...floor([[480, -25], [420, -25], [360, -25], [300, 25], [240, 25], [180, 25], [120, -25, 'under'], [60, -25], [0, 25], [-60, 25],
    [-120, -25], [-180, -25], [-240, 25], [-300, 25], [-370, -22]]),   // upstream along the floor, 25 m one side of the river or the other
  [-440, -50, 'climb'], ...bend(-470, -75, 25, 90, 270).slice(1),      // up the south wall: hairpin...
  [-400, -100], [-335, -88], ...bend(-310, -110, 22, 90, -90).slice(1),   // ...east, hairpin...
  [-400, -140], [-455, -150], ...bend(-480, -180, 30, 90, 270).slice(1),  // ...west, hairpin
  [-380, -222], [-250, -205, 'south'], [-150, -205], [-60, -218], [10, -185],   // along the south rim
  [15, -150, 'high0'], [15, -60], [12, 0, 'high1'],           // the high bridge across the canyon
  [-40, 60], [-120, 80], [-220, 92], [-300, 110], [-370, 140]  // and back along the rim to camp
];
const { stage, at } = drawnLap(MAP, LINE, { lift: [['high0', 'high1', 30]] });
export default { ...LOOK, ...stage, name: 'Canyon Run', blurb: 'Down the canyon wall, up the river, back over it 55 m up', laps: 2,
  alpine: { rock: [80, 120], snow: [200, 240], treeLine: 150 }, towns: [{ style: 'alpine', at: 0, len: 160, steep: 10 }] };
export const design = {
  title: 'Canyon Run',
  story: 'No lake: a river canyon with sheer walls cut through a forested plateau. You go down into it, along the bottom beside the river, and up out of it, then cross it on a bridge high over the road you just drove.',
  beats: beatsAt(at, [
    ['camp', 'The logging camp', 'Start on the north rim, the canyon dropping away on your right.'],
    ['side', 'Over the side canyon', 'A high bridge across the side canyon where it joins the main one.'],
    ['ledge', 'The ledge', 'Down a shelf cut into the canyon\'s north wall, sheer rock above and below.'],
    ['floor', 'Onto the floor', 'A hairpin at the end of the ledge drops you onto the canyon floor.'],
    ['under', 'Up the river', 'Winding upstream beside the river, crossing it on low bridges, under the high bridge.'],
    ['climb', 'Up the south wall', 'Three hairpins zigzag up the wall and out of the canyon.'],
    ['south', 'The south rim', 'Fast along the rim, the drop on your left.'],
    ['high0', 'The high bridge', 'Straight back across the canyon, 55 m over the river and the road below.']
  ]),
  build: ['Rock walls for the canyon (the shape is there, the rock look is not)', 'Timber trestles and a tall steel or timber bridge']
};
