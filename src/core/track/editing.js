// Track editing helpers (the in-game track editor, ui/editor.js): lay a gorge circuit's sections out cheaply, without
// building the whole track, and close the loop by stretching straights. Sections are the stage format:
// ['s', length, endHeight, tags] and ['a', radius, degrees (+ = left), endHeight, tags], in screen axes (a = right,
// b = up-screen) starting at (0, 0) heading `heading`. A straight's length may be { toA } / { toB } (run on until that
// coordinate); freeze() turns those into plain metres, which is what the editor works with.
const TAU = Math.PI * 2;
/** Walk the sections: the road's centre line (a sample about every `step` m), where each section starts, and the end. */
export function sketch(segs, heading = 0, step = 2) {
  let a = 0, b = 0, phi = heading, h = segs.length ? endH(segs[segs.length - 1]) : 0;
  const pts = [{ a, b, h, sec: 0 }], starts = [], lens = [];
  segs.forEach((sg, n) => {
    starts.push({ i: pts.length - 1, a, b, phi, h });
    const eh = endH(sg), h0 = h;
    if (sg[0] === 's') {
      let len = sg[1];
      if (typeof len === 'object') len = len.toA !== undefined ? (len.toA - a) / Math.cos(phi) : (len.toB - b) / Math.sin(phi);
      lens.push(len);
      const k = Math.max(1, Math.round(Math.max(0, len) / step));
      for (let q = 1; q <= k; q++) { a += Math.cos(phi) * len / k; b += Math.sin(phi) * len / k; pts.push({ a, b, h: h0 + (eh - h0) * q / k, sec: n }); }
    } else {
      const R = sg[1], th = sg[2] * Math.PI / 180, k = Math.max(2, Math.round(R * Math.abs(th) / step)), d = th / k, chord = 2 * R * Math.sin(Math.abs(d) / 2);
      lens.push(R * Math.abs(th));
      for (let q = 1; q <= k; q++) { phi += d / 2; a += Math.cos(phi) * chord; b += Math.sin(phi) * chord; phi += d / 2; pts.push({ a, b, h: h0 + (eh - h0) * q / k, sec: n }); }
    }
    h = eh;
  });
  const turn = segs.reduce((t, sg) => t + (sg[0] === 'a' ? sg[2] : 0), 0);
  return { pts, starts, lens, end: { a, b, phi, h }, gap: Math.hypot(a, b), turn };
}
export const endH = sg => sg[0] === 's' ? sg[2] : sg[3];
/** A copy of the sections with every { toA } / { toB } length replaced by the metres it came out at. */
export function freeze(segs, heading = 0) {
  const { lens } = sketch(segs, heading);
  return segs.map((sg, n) => sg[0] === 's' && typeof sg[1] === 'object' ? ['s', Math.round(lens[n] * 100) / 100, ...sg.slice(2)] : JSON.parse(JSON.stringify(sg)));
}
/**
 * Close the loop: turn the last curve so the whole lap turns whole circles (one, or none for a figure of eight), then stretch two straights (the pair
 * that pulls most squarely, preferring later ones) so the end lands exactly on the start. With every angle fixed the
 * end point moves linearly with each straight's length, so it's a 2x2 solve. Returns { segs, ok, msg }.
 */
export function closeLoop(segs0, heading = 0, minLen = 3) {
  const segs = freeze(segs0, heading);
  const turn = segs.reduce((t, sg) => t + (sg[0] === 'a' ? sg[2] : 0), 0), want = Math.round(turn / 360) * 360, need = want - turn;   // a whole number of turns: one for a loop, none for a figure of eight
  if (Math.abs(need) > 0.01) {
    let k = -1; for (let n = segs.length - 1; n >= 0; n--) if (segs[n][0] === 'a' && Math.abs(segs[n][2] + need) < 300 && Math.sign(segs[n][2] + need) === Math.sign(segs[n][2])) { k = n; break; }
    if (k < 0) return { segs: segs0, ok: false, msg: `the corners turn ${Math.round(turn)} degrees in all; a lap needs ${want}, and no curve can take up the ${Math.round(need)}` };
    segs[k] = [...segs[k]]; segs[k][2] = Math.round((segs[k][2] + need) * 1000) / 1000;
  }
  // headings of the straights (fixed now), and where the end lands
  const { starts, end } = sketch(segs, heading), str = [];
  segs.forEach((sg, n) => { if (sg[0] === 's') str.push({ n, phi: starts[n].phi, len: sg[1] }); });
  let best = null;
  for (let x = str.length - 1; x >= 0; x--) for (let y = x - 1; y >= 0; y--) {
    const P = str[x], Q = str[y], det = Math.cos(P.phi) * Math.sin(Q.phi) - Math.sin(P.phi) * Math.cos(Q.phi);
    if (Math.abs(det) < 0.25) continue;
    // dP * uP + dQ * uQ = -end
    const dP = (-end.a * Math.sin(Q.phi) + end.b * Math.cos(Q.phi)) / det, dQ = (-end.b * Math.cos(P.phi) + end.a * Math.sin(P.phi)) / det;
    if (P.len + dP < minLen || Q.len + dQ < minLen) continue;
    const cost = Math.abs(dP) + Math.abs(dQ) - x * 0.5 - y * 0.25;                       // small changes, late in the lap
    if (!best || cost < best.cost) best = { P, Q, dP, dQ, cost };
  }
  if (!best) return { segs: segs0, ok: false, msg: `no two straights can close the ${end.a.toFixed(0)}, ${end.b.toFixed(0)} m gap without going below ${minLen} m: lengthen a straight or change a corner` };
  segs[best.P.n] = [...segs[best.P.n]]; segs[best.P.n][1] = Math.round((best.P.len + best.dP) * 100) / 100;
  segs[best.Q.n] = [...segs[best.Q.n]]; segs[best.Q.n][1] = Math.round((best.Q.len + best.dQ) * 100) / 100;
  return { segs, ok: true, msg: `closed: straight ${best.Q.n + 1} ${best.dQ >= 0 ? '+' : ''}${best.dQ.toFixed(1)} m, straight ${best.P.n + 1} ${best.dP >= 0 ? '+' : ''}${best.dP.toFixed(1)} m` };
}
export const wrapDeg = d => ((d % 360) + 540) % 360 - 180;
export { TAU };

// ---------- drawing a track freehand ----------
// A stroke (points in a/b metres, as drawn with the mouse or a finger) becomes sections: it's resampled and smoothed,
// simplified to a polygon (Ramer-Douglas-Peucker, `tol` metres), and each corner of the polygon is rounded off with an
// arc as big as its two neighbouring legs allow (minR..maxR), the straights running between them. If the stroke ends
// back near where it began it's a lap: the polygon is closed and the track starts half way along its first leg, so
// every corner is a proper curve and the lap turns a whole circle; otherwise it's an open run for the editor to close.
// `from` = { a, b, phi, h } continues an existing track from its end (the first corner turns off its heading).
const rdp = (P, tol) => {
  if (P.length < 3) return P.slice();
  const [A, B] = [P[0], P[P.length - 1]], dx = B.a - A.a, dy = B.b - A.b, L = Math.hypot(dx, dy) || 1;
  let k = -1, dm = 0; for (let i = 1; i < P.length - 1; i++) { const d = Math.abs((P[i].a - A.a) * dy - (P[i].b - A.b) * dx) / L; if (d > dm) { dm = d; k = i; } }
  return dm < tol ? [A, B] : rdp(P.slice(0, k + 1), tol).slice(0, -1).concat(rdp(P.slice(k), tol));
};
function cleanStroke(pts, step) {
  const out = [pts[0]]; let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const p = out[out.length - 1], q = pts[i], d = Math.hypot(q.a - p.a, q.b - p.b); acc = d;
    if (acc >= step) { const n = Math.floor(acc / step); for (let k = 1; k <= n; k++) out.push({ a: p.a + (q.a - p.a) * k * step / d, b: p.b + (q.b - p.b) * k * step / d }); }
  }
  const last = pts[pts.length - 1]; if (Math.hypot(last.a - out[out.length - 1].a, last.b - out[out.length - 1].b) > step * 0.3) out.push(last);
  for (let pass = 0; pass < 2; pass++) for (let i = 1; i < out.length - 1; i++) out[i] = { a: (out[i - 1].a + 2 * out[i].a + out[i + 1].a) / 4, b: (out[i - 1].b + 2 * out[i].b + out[i + 1].b) / 4 };
  return out;
}
export function fromStroke(pts, { tol = 3, minR = 14, maxR = 160, closeDist = 45, from = null } = {}) {
  if (!pts || pts.length < 2) return null;
  let P = cleanStroke(pts, 3); if (P.length < 2) return null;
  // a lap if it ends near where it began: closeDist, or an eighth of the stroke for a big one
  const closed = !from && P.length > 8 && Math.hypot(P[P.length - 1].a - P[0].a, P[P.length - 1].b - P[0].b) < Math.max(closeDist, (P.length - 1) * 3 / 8);
  let V = rdp(from ? [{ a: from.a, b: from.b }, ...P] : P, tol);
  if (closed) { V.pop(); if (V.length < 3) return null; }
  if (V.length < 2) return null;
  const n = V.length, leg = k => { const p = V[k % n], q = V[(k + 1) % n]; return { len: Math.hypot(q.a - p.a, q.b - p.b), phi: Math.atan2(q.b - p.b, q.a - p.a) }; };
  const legs = Array.from({ length: closed ? n : n - 1 }, (_, k) => leg(k));
  if (legs.some(l => l.len < 0.5)) return null;
  // corners: at each polygon vertex between two legs (closed: all of them, the last at V[0]); continuing: one at the join too
  const corners = [];
  const cornerAt = (inPhi, inAvail, outLeg, outAvail) => {
    const th = wrapDeg((outLeg.phi - inPhi) * 180 / Math.PI), half = Math.tan(Math.abs(th) * Math.PI / 360);
    if (Math.abs(th) < 1.5) return { th: 0, R: 0, t: 0 };
    const R = Math.max(minR, Math.min(maxR, Math.min(inAvail, outAvail) / half));
    return { th, R, t: R * half };
  };
  const avail = k => legs[k].len * (closed ? 0.5 : (k === 0 && !from) || k === legs.length - 1 ? 0.9 : 0.5);
  if (from) corners.push(cornerAt(from.phi, Infinity, legs[0], legs[0].len * (legs.length > 1 ? 0.5 : 0.9)));
  for (let k = 1; k < legs.length; k++) corners.push(cornerAt(legs[k - 1].phi, avail(k - 1), legs[k], avail(k)));
  if (closed) corners.push(cornerAt(legs[legs.length - 1].phi, avail(legs.length - 1), legs[0], legs[0].len * 0.5));
  // walk it into sections: [straight, curve] per leg, heights all h
  const h = from ? from.h : 0, segs = [], S = (len) => { if (len > 0.5) segs.push(['s', Math.round(len * 100) / 100, h, {}]); }, A = c => { if (c.th) segs.push(['a', Math.round(c.R * 10) / 10, Math.round(c.th * 100) / 100, h, {}]); };
  if (closed) {
    // start half way along leg 0; corners[k] sits at the end of leg k (the last one back at V[0], before leg 0)
    const L = legs.length, cEnd = k => corners[k];   // corner between leg k and leg k+1 (k = L-1: back to leg 0)
    S(legs[0].len / 2 - cEnd(0).t); A(cEnd(0));
    for (let k = 1; k < L; k++) { S(legs[k].len - cEnd(k - 1).t - cEnd(k).t); A(cEnd(k)); }
    S(legs[0].len / 2 - cEnd(L - 1).t);
    const s0 = { a: (V[0].a + V[1].a) / 2, b: (V[0].b + V[1].b) / 2 };
    return { segs: tidy(segs), heading: legs[0].phi, start: s0, closed: true };
  }
  const off = from ? 1 : 0;   // corners index: corner i (from 'from') precedes leg i - off
  if (from) A(corners[0]);
  for (let k = 0; k < legs.length; k++) {
    const tIn = from ? corners[k].t : (k > 0 ? corners[k - 1].t : 0), tOut = k < legs.length - 1 ? corners[k + off].t : 0;
    S(legs[k].len - tIn - tOut); if (k < legs.length - 1) A(corners[k + off]);
  }
  return { segs: tidy(segs), heading: from ? from.phi : legs[0].phi, start: { a: V[0].a, b: V[0].b }, closed: false };
}
// fewer, cleaner sections: curves bending the same way with only a scrap of straight between become one curve (same total
// turn and length, so the heading comes out the same), and scraps of straight under 3 m go
function tidy(segs) {
  const out = [];
  for (const sg of segs) {
    const last = out[out.length - 1], prev = out[out.length - 2];
    if (sg[0] === 's' && sg[1] < 3 && out.length) continue;
    if (sg[0] === 'a' && last && last[0] === 'a' && Math.sign(last[2]) === Math.sign(sg[2])) { out[out.length - 1] = joinArcs(last, 0, sg); continue; }
    if (sg[0] === 'a' && last && last[0] === 's' && last[1] < 6 && prev && prev[0] === 'a' && Math.sign(prev[2]) === Math.sign(sg[2])) { out.pop(); out[out.length - 1] = joinArcs(prev, last[1], sg); continue; }
    out.push(sg);
  }
  return out;
}
function joinArcs(a, gap, b) {
  const th = a[2] + b[2], len = a[1] * Math.abs(a[2]) * Math.PI / 180 + gap + b[1] * Math.abs(b[2]) * Math.PI / 180;
  return ['a', Math.round(len / (Math.abs(th) * Math.PI / 180) * 10) / 10, Math.round(th * 100) / 100, b[3], b[4]];
}
