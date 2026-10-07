// Stage: The Stadium. A derby arena (core/elements/arena.js) under floodlights: a figure of eight in concrete, a big
// bowl and a small one joined by a neck with a jump each way (head-on, if two cars choose the same moment), an
// arrowhead wall in the small bowl splitting the charge out of the neck, a jersey-block island, crates and blocks.
// Fast: it rewards a good line into the side of a car.
const arc = (ca, cb, r, t0, t1, n) => Array.from({ length: n + 1 }, (_, k) => { const t = (t0 + (t1 - t0) * k / n) * Math.PI / 180; return [+(ca + Math.cos(t) * r).toFixed(1), +(cb + Math.sin(t) * r).toFixed(1)]; });
const NECK = 9, BIG = 42, SMALL = 34, FAR = 100, tb = Math.asin(NECK / BIG) * 180 / Math.PI, ts = Math.asin(NECK / SMALL) * 180 / Math.PI;
export default { name: 'The Stadium', blurb: 'Derby arena: a floodlit figure of eight, two bowls and a neck with jumps both ways', type: 'gorge', laps: 3, seed: 7373, surface: 'tarmac', hillAmp: 2, jumps: 0, armco: false,
  light: { sun: 0xE8EEFF, sunI: 0.8, sky: 0x8E9CC0, ground: 0x3A4050, hemiI: 0.7, cloud: 0.2, grade: [0.98, 1.0, 1.06], sat: 1.0 },
  colors: { grassA: 0x5E7A4A, grassB: 0x52703E, rock: 0x8A8A8E, dirt: 0x5A5E66, dirtRoad: 0x5A5E66, road: 0x4A4E56, sky: 0x8E9CC0, round: [0x4E7A3E, 0x5E8A48], pine: [0x3A5A40] },
  trees: { density: 0.0008, pine: 0.3 }, rocks: 0.0003, bushes: 0.001, village: false,
  arena: { ring: 'barrier',
    shape: [...arc(0, 0, BIG, tb, 360 - tb, 26), ...arc(FAR, 0, SMALL, 180 + ts, 540 - ts, 20)],
    walls: [[82, 0, 100, 13], [82, 0, 100, -13],                                  // the arrowhead in the small bowl
      [-26, 8, -14, 8], [-14, 8, -14, 20], [-14, 20, -26, 20], [-26, 20, -26, 8]],   // the island in the big one
    ramps: [{ a: 50, b: 4.5, dir: 0 }, { a: 60, b: -4.5, dir: 180 }, { a: -24, b: -18, dir: 90 }],
    props: [{ kind: 'crates', n: 3 }, { kind: 'concrete', n: 4 }] },
  segs: [['a', 30, 360, 0, { open: 'field' }]] };
