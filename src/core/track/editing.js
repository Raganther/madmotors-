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
