// Sandboxes: a tiny loop per track element (or a few together) so one piece can be driven, measured and debugged on
// its own. Open one in the browser with ?sandbox=<name>, or report on it with `npm run sandbox -- <name>`.
// Each is an ordinary 'gorge' stage: a rounded rectangle whose four sides are the lists of sections passed in (the
// top may be at most bottom + 30 m long, or the closing section would come out backwards: buildTrack says so).
import ravenrock from '../stages/ravenrock-gorge.js';
import summit from '../stages/summit-meadow.js';

const R = 30;
/** A rounded-rectangle loop: bottom (the start straight, heading right), right, top, left, back to the start. */
function loop(name, about, { bottom, right, top, left }, extra = {}) {
  const segs = [...bottom, ['a', R, 90, bottom.at(-1)[2]], ...right, ['a', R, 90, right.at(-1)[2]], ...top, ['s', { toA: 0 }, 0], ['a', R, 90, 0], ...left, ['s', { toB: R }, 0], ['a', R, 90, 0]];
  return { name: 'Sandbox: ' + name, blurb: about, type: 'gorge', laps: 3, seed: 101, surface: 'tarmac', hillAmp: 2, jumps: 0, armco: true,
    light: summit.light, colors: summit.colors, trees: { density: 0.002, pine: 0.4 }, rocks: 0.001, bushes: 0.002, village: false, segs, ...extra };
}
const flat = n => ['s', n, 0];
export const SANDBOXES = {
  kick: loop('kick', 'placed kickers: a crest jump, a two-kick staircase', {
    bottom: [flat(200)],
    right: [['s', 50, 8, { far: 6, near: -6 }], ['s', 25, 8, { kick: 2.6 }], ['s', 45, 0, { far: 4, near: -8 }]],
    top: [flat(40), ['s', 25, 0, { kick: 2.2 }], ['s', 30, -4], ['s', 20, -4, { kick: 2.4 }], ['s', 30, -8]],
    left: [['s', 40, 0]]
  }),
  jump: loop('jump', 'automatic jumps (stage.jumps) on a long straight tagged `jump`', {
    bottom: [flat(230)], right: [flat(60)], top: [['s', 200, 0, { jump: true }]], left: [flat(20)]
  }, { jumps: 1 }),
  bridge: loop('bridge', 'a bridge over a ravine, and a flyover-height crossing', {
    bottom: [flat(120)],
    right: [['s', 30, 4], ['s', 70, 4, { bridge: true, far: -20, near: -20, rampF: 6, rampN: 6 }], ['s', 30, 0]],
    top: [flat(60)], left: [flat(20)]
  }),
  viaduct: loop('viaduct', 'the same ravine with stone viaduct bridges', {
    bottom: [flat(120)], right: [['s', 30, 4], ['s', 70, 4, { bridge: true, far: -20, near: -20, rampF: 6, rampN: 6 }], ['s', 30, 0]], top: [flat(60)], left: [flat(20)]
  }, { viaduct: true }),
  tunnel: loop('tunnel', 'a long bored tunnel (see-through window inside) and a rock arch', {
    bottom: [flat(120)], right: [['s', 20, 0], ['s', 70, 2, { tunnel: true, far: 26, near: 22 }], ['s', 30, 0]],
    top: [flat(30), ['s', 40, 0, { arch: true, far: 18, rampF: 6, near: 2, rampN: 10 }], flat(10)], left: [flat(20)]
  }),
  town: loop('town', 'a town street with parked cars, then a gallery ledge with rockfall', {
    bottom: [['s', 120, 0, { town: true, far: -2, rampF: 40, near: 1, rampN: 30 }]],
    right: [['s', 90, 12, { far: 30, rampF: 5, near: -20, rampN: 10, rockfall: true }]],
    top: [['s', 70, 12, { gallery: true, far: 30, rampF: 5, near: -20, rampN: 10 }], ['s', 30, 6]],
    left: [['s', 60, 0]]
  }, { traffic: { on: 1, with: 1 } }),
  gap: loop('gap', 'boost pads, a kicker and a 28 m gap over a river canyon', {
    bottom: [flat(150)],
    right: [['s', 30, 4, { boost: true }], ['s', 20, 4, { kick: 3, boost: true, far: -30, near: -30, rampF: 4, rampN: 4 }],
      ['s', 28, -2, { gap: true, far: -40, near: -40, rampF: 3, rampN: 3 }], ['s', 40, -3, { far: -12, near: -12, rampF: 6, rampN: 6 }], ['s', 20, 0]],
    top: [flat(60)], left: [flat(20)]
  }, { river: { pts: [[100, 94], [300, 94]], level: -30, width: 14 } }),
  ferry: loop('ferry', 'a barge across a river: queue at the gate, ride over, drive off', {
    bottom: [flat(150)],
    right: [['s', 30, 0], ['s', 20, -8, { far: -4, near: -4 }], ['s', 50, -8, { ferry: true, far: -16, rampF: 3, near: -16, rampN: 3 }], ['s', 20, -8, { far: -4, near: -4 }], ['s', 30, 0]],
    top: [flat(60)], left: [flat(20)]
  }, { river: { pts: [[80, 125], [300, 125]], level: -11, width: 40 } }),
  branch: loop('branch', 'the road splits: a kicker on the main road, a lower boosted route under a waterfall beside it, merging again', {
    bottom: [flat(40), flat(60), ['s', 40, 0, { kick: 2.4 }], flat(60), flat(40)], right: [flat(60)], top: [flat(200)], left: [flat(20)]
  }, { branches: [{ from: 1, to: 4, name: 'low road', segs: [['a', 30, -60, -2, { near: -3 }], ['a', 30, 60, -4], ['s', 56, -4, { boost: true, falls: true, far: 26, rampF: 8 }], ['a', 30, 60, -2], ['a', 30, -60, 0]] }] }),
  drawbridge: loop('drawbridge', 'a drawbridge over a mill race (it rises every so often: jump it while it is low, or wait), and a sawmill', {
    bottom: [['s', 150, 0, { mill: true }]],
    right: [['s', 40, 0], ['s', 24, 0, { drawbridge: 0, far: -10, rampF: 3, near: -10, rampN: 3 }], ['s', 40, 0]],
    top: [['s', 80, 0, { logs: true }]], left: [flat(20)]
  }),
  rails: loop('rails', 'a level crossing with trains', {
    bottom: [flat(120)], right: [flat(60)], top: [flat(80)], left: [flat(20)]
  }, { rails: [{ id: 'line', pts: [[60, -80, 0], [60, 80, 0]], speed: 26, cars: 3, body: ravenrock.rails[0].body, coach: ravenrock.rails[0].coach, band: ravenrock.rails[0].band }] })
};
