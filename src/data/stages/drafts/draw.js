import { closeLoop, sketch } from '../../../core/track/editing.js';

// Drawing a draft: a lap as a line of waypoints over a map (its landscape, lake and streams, in map metres), the way the
// Track editor's Draw tool turns a stroke into a lap. Every draft uses these; each brings its own map.
/** Waypoints round a bend: centre (a, b), radius r, from angle d0 to d1 (degrees, counter-clockwise from east) in
 *  steps of 30 degrees or less, so a hairpin or a loop keeps its shape when the line is turned into curves. */
export function bend(a, b, r, d0, d1, name0, name1) {
  const n = Math.max(2, Math.ceil(Math.abs(d1 - d0) / 30)), out = [];
  for (let k = 0; k <= n; k++) { const t = (d0 + (d1 - d0) * k / n) * Math.PI / 180, p = [Math.round((a + r * Math.cos(t)) * 10) / 10, Math.round((b + r * Math.sin(t)) * 10) / 10]; if (k === 0 && name0) p.push(name0); if (k === n && name1) p.push(name1); out.push(p); }
  return out;
}
/** A lap drawn as a line of waypoints on the map (map metres), turned into straights and curves the way the Track
 *  editor's Draw tool does (core/track/editing.js fromStroke), with the map's landscape (`ground`), lake (`lake`, the
 *  stage's river) and `streams` moved so the
 *  stage's start line (half way along the first leg) is at the origin as a stage needs. A waypoint can carry a name
 *  ([a, b, 'name']); `lift: [['from', 'to', metres], ...]` then holds the road up (or, negative, down into a cutting or
 *  tunnel) between where it passes those two waypoints, so a bridge or a tunnel stays put when the line is redrawn; `pieces: [['name', tag, value], ...]` put an element there (a kicker, an
 *  arch, a water splash) and `spans: [['from', 'to', tag, value], ...]` along the whole stretch between two (surf). Returns { stage: its fields, at: metres along the lap of each named waypoint }. */
/** The waypoints as a closed polygon with every corner rounded off by an arc as big as its two legs allow (up to
 *  maxR): the Draw tool's way of turning a line into a lap (fromStroke), without its clean-up of a hand-drawn stroke, so
 *  the lap passes exactly where the waypoints put it and closes by construction. Starts half way along the first leg. */
export function filletLap(waypoints, { maxR = 220 } = {}) {
  const V = waypoints.map(([a, b]) => ({ a, b })), n = V.length, leg = k => { const p = V[k % n], q = V[(k + 1) % n]; return { len: Math.hypot(q.a - p.a, q.b - p.b), phi: Math.atan2(q.b - p.b, q.a - p.a) }; };
  const legs = V.map((_, k) => leg(k)), wrap = d => ((d % 360) + 540) % 360 - 180;
  const corner = k => { const th = wrap((legs[k].phi - legs[(k + n - 1) % n].phi) * 180 / Math.PI), half = Math.tan(Math.abs(th) * Math.PI / 360); if (Math.abs(th) < 0.5) return { th: 0, R: 0, t: 0 }; const R = Math.min(maxR, Math.min(legs[(k + n - 1) % n].len, legs[k].len) * 0.5 / half); return { th, R, t: R * half }; };
  const C = V.map((_, k) => corner(k)), segs = [], S = l => { if (l > 1) segs.push(['s', Math.round(l * 100) / 100, 0, {}]); }, A = c => { if (c.th) segs.push(['a', Math.round(c.R * 100) / 100, Math.round(c.th * 1000) / 1000, 0, {}]); };
  S(legs[0].len / 2 - C[1].t); A(C[1]);
  for (let k = 1; k < n; k++) { S(legs[k].len - C[k].t - C[(k + 1) % n].t); A(C[(k + 1) % n]); }
  S(legs[0].len / 2 - C[0].t);
  return { segs, heading: legs[0].phi, start: { a: (V[0].a + V[1].a) / 2, b: (V[0].b + V[1].b) / 2 }, closed: true, tight: C.filter(c => c.th && c.R < 12).length };
}
export function drawnLap(map, waypoints, { lift = [], pieces = [], spans = [], ...opts } = {}) {
  const r = filletLap(waypoints, opts);
  // rounding leaves a few centimetres: close it up exactly the way the editor's Close the loop does
  const c = closeLoop(r.segs, r.heading); if (!c.ok) throw new Error('drawnLap: ' + c.msg); r.segs = c.segs;
  const o = r.start, mv = ([a, b, ...rest]) => [Math.round((a - o.a) * 10) / 10, Math.round((b - o.b) * 10) / 10, ...rest];
  // metres along the lap where it passes each named waypoint (in order round the lap)
  const k = sketch(r.segs, r.heading, 2), run = [0]; for (let i = 1; i < k.pts.length; i++) run.push(run[i - 1] + Math.hypot(k.pts[i].a - k.pts[i - 1].a, k.pts[i].b - k.pts[i - 1].b));
  const at = {}; let from = 0;
  for (const [a, b, name] of waypoints) {
    const [pa, pb] = mv([a, b]); let best = from, bd = Infinity;
    for (let i = from; i < Math.min(k.pts.length, from + 600); i++) { const d = Math.hypot(k.pts[i].a - pa, k.pts[i].b - pb); if (d < bd) { bd = d; best = i; } }
    from = best; if (name) at[name] = Math.round(run[best]);
  }
  for (const [f, t] of spans) for (const w of [f, t]) if (at[w] === undefined) throw new Error(`drawnLap: no waypoint named "${w}"`);
  for (const [f, t, tag, v] of spans) for (let m = at[f]; m <= at[t]; m += 5) pieces = [...pieces, [{ m }, tag, v]];   // a tag over a whole stretch: every piece along it (they're 25 m at most)
  for (const [w] of pieces) if (typeof w === 'string' && at[w] === undefined) throw new Error(`drawnLap: no waypoint named "${w}"`);
  for (const [f, t] of lift) if (at[f] === undefined || at[t] === undefined) throw new Error(`drawnLap: no waypoint named "${at[f] === undefined ? f : t}"`);
  const g = map.ground, line2 = R => Array.isArray(R[0]) ? [R[0].map(mv), ...R.slice(1)] : [...mv([R[0], R[1]]), ...mv([R[2], R[3]]), ...R.slice(4)];
  const stage = { startHeading: r.heading, segs: r.segs, drape: { lift: lift.map(([f, t, m]) => [Math.min(at[f], at[t]), Math.max(at[f], at[t]), m]), pieces: pieces.map(([w, tag, v]) => ({ s: typeof w === 'string' ? at[w] : w.m, tag, v })) },
    ground: { ...g, hills: (g.hills || []).map(mv), ridges: (g.ridges || []).map(line2), scarps: (g.scarps || []).map(line2) } };
  if (map.lake) stage.river = { ...map.lake, pts: map.lake.pts.map(mv) };
  if (map.streams) stage.streams = map.streams.map(s => ({ ...s, pts: s.pts.map(mv) }));
  return { stage, at };
}
/** The same line driven the other way round: still starting on main street (the first two waypoints swap). */
export const reversed = wp => [wp[1], wp[0], ...wp.slice(2).reverse()];
/** The lap's beats for the viewer, placed at named waypoints: [['name', 'title', 'what happens'], ...]. */
export const beatsAt = (at, list) => list.map(([w, name, text]) => ({ m: at[w], name, text })).sort((a, b) => a.m - b.m);

/** The forest look every Timberline draft starts from (a draft overrides what it needs). */
export { LOOK } from './timberline.js';
