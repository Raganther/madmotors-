import { closeLoop, fromStroke, sketch } from '../../../core/track/editing.js';

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

/** Waypoints round a bend: centre (a, b), radius r, from angle d0 to d1 (degrees, counter-clockwise from east) in
 *  steps of 30 degrees or less, so a hairpin or a loop keeps its shape when the line is turned into curves. */
export function bend(a, b, r, d0, d1, name0, name1) {
  const n = Math.max(2, Math.ceil(Math.abs(d1 - d0) / 30)), out = [];
  for (let k = 0; k <= n; k++) { const t = (d0 + (d1 - d0) * k / n) * Math.PI / 180, p = [Math.round((a + r * Math.cos(t)) * 10) / 10, Math.round((b + r * Math.sin(t)) * 10) / 10]; if (k === 0 && name0) p.push(name0); if (k === n && name1) p.push(name1); out.push(p); }
  return out;
}
/** A lap drawn as a line of waypoints on the map (map metres), turned into straights and curves the way the Track
 *  editor's Draw tool does (core/track/editing.js fromStroke), with the landscape, lake and streams moved so the
 *  stage's start line (half way along the first leg) is at the origin as a stage needs. A waypoint can carry a name
 *  ([a, b, 'name']); `lift: [['from', 'to', metres], ...]` then holds the road up (or, negative, down into a cutting or
 *  tunnel) between where it passes those two waypoints, so a bridge or a tunnel stays put when the line is redrawn. Returns { stage: its fields, at: metres along the lap of each named waypoint }. */
export function drawnLap(waypoints, { lift = [], ...opts } = {}) {
  const r = fromStroke(waypoints.map(([a, b]) => ({ a, b })), { tol: 2, minR: 16, maxR: 220, ...opts });
  if (!r || !r.closed) throw new Error('Timberline: the waypoints did not make a closed lap');
  // tight corners can't always be as round as the line asks: close it up exactly the way the editor's Close the loop does
  const c = closeLoop(r.segs, r.heading); if (!c.ok) throw new Error('Timberline: ' + c.msg); r.segs = c.segs;
  const o = r.start, mv = ([a, b, ...rest]) => [Math.round((a - o.a) * 10) / 10, Math.round((b - o.b) * 10) / 10, ...rest];
  // metres along the lap where it passes each named waypoint (in order round the lap)
  const k = sketch(r.segs, r.heading, 2), run = [0]; for (let i = 1; i < k.pts.length; i++) run.push(run[i - 1] + Math.hypot(k.pts[i].a - k.pts[i - 1].a, k.pts[i].b - k.pts[i - 1].b));
  const at = {}; let from = 0;
  for (const [a, b, name] of waypoints) {
    const [pa, pb] = mv([a, b]); let best = from, bd = Infinity;
    for (let i = from; i < Math.min(k.pts.length, from + 600); i++) { const d = Math.hypot(k.pts[i].a - pa, k.pts[i].b - pb); if (d < bd) { bd = d; best = i; } }
    from = best; if (name) at[name] = Math.round(run[best]);
  }
  for (const [f, t] of lift) if (at[f] === undefined || at[t] === undefined) throw new Error(`Timberline: no waypoint named "${at[f] === undefined ? f : t}"`);
  const g = MAP.ground;
  const stage = { startHeading: r.heading, segs: r.segs, drape: { lift: lift.map(([f, t, m]) => [Math.min(at[f], at[t]), Math.max(at[f], at[t]), m]) },
    ground: { ...g, hills: g.hills.map(mv), ridges: g.ridges.map(([a1, b1, a2, b2, ...rest]) => [...mv([a1, b1]), ...mv([a2, b2]), ...rest]) },
    river: { ...MAP.lake, pts: MAP.lake.pts.map(mv) }, streams: MAP.streams.map(s => ({ ...s, pts: s.pts.map(mv) })) };
  return { stage, at };
}
/** The same line driven the other way round: still starting on main street (the first two waypoints swap). */
export const reversed = wp => [wp[1], wp[0], ...wp.slice(2).reverse()];
/** The lap's beats for the viewer, placed at named waypoints: [['name', 'title', 'what happens'], ...]. */
export const beatsAt = (at, list) => list.map(([w, name, text]) => ({ m: at[w], name, text })).sort((a, b) => a.m - b.m);
