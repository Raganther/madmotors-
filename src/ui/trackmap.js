import { TAU } from '../core/math.js';

// A track drawn as its outline from above, turned the way the race camera sees it (screen right is world (1, -1), down
// the screen is (1, 1): render/camera.js CAM_DIR), for the menu's track cards and the race's map in the HUD. The
// road a thick light line on a dark casing, bridges paler, tunnels dashed dark, branches thinner, the start (and a
// downhill's finish) chequered; in a race, a dot per car (yours bigger, ringed white).
const SX = (x, z) => (x - z) * Math.SQRT1_2, SY = (x, z) => (x + z) * Math.SQRT1_2;
function frame(tr, w, h, pad) {
  const N = tr.loopN || tr.N; let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < tr.N; i += 4) { const x = SX(tr.xs[i], tr.zs[i]), y = SY(tr.xs[i], tr.zs[i]); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const k = Math.min((w - 2 * pad) / (x1 - x0 || 1), (h - 2 * pad) / (y1 - y0 || 1)), ox = (w - (x1 - x0) * k) / 2 - x0 * k, oy = (h - (y1 - y0) * k) / 2 - y0 * k;
  return { N, k, X: (x, z) => ox + SX(x, z) * k, Y: (x, z) => oy + SY(x, z) * k };
}
function sizeTo(cv, cw, ch) {
  const dpr = Math.min(devicePixelRatio || 1, 2), w = cw || cv.clientWidth, h = ch || cv.clientHeight;
  if (!w || !h) return null;
  if (!cw && cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); return { g, w, h };
}
function drawRoad(g, tr, F, lw, col) {
  const { N, X, Y } = F, last = tr.loopN ? N : tr.finishIdx || N - 1, path = (a, b, step = 2) => { g.beginPath(); for (let i = a; i <= b; i += step) { const j = tr.loopN ? i % N : Math.min(i, tr.N - 1); i === a ? g.moveTo(X(tr.xs[j], tr.zs[j]), Y(tr.xs[j], tr.zs[j])) : g.lineTo(X(tr.xs[j], tr.zs[j]), Y(tr.xs[j], tr.zs[j])); } };
  g.lineJoin = g.lineCap = 'round';
  path(0, last); g.strokeStyle = 'rgba(10,14,30,0.85)'; g.lineWidth = lw + 3; g.stroke();
  for (const a of tr.alts || []) { g.beginPath(); for (let q = 0; q <= a.n; q++) { const i = a.u + q; q ? g.lineTo(X(tr.xs[i], tr.zs[i]), Y(tr.xs[i], tr.zs[i])) : g.moveTo(X(tr.xs[i], tr.zs[i]), Y(tr.xs[i], tr.zs[i])); } g.strokeStyle = 'rgba(10,14,30,0.85)'; g.lineWidth = lw + 1; g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = Math.max(1, lw - 2); g.stroke(); }
  path(0, last); g.strokeStyle = col; g.lineWidth = lw; g.stroke();
  // bridges paler, tunnels dark dashes over the line
  for (const [mask, c, dash] of [[tr.bridge, 'rgba(255,255,255,0.95)', []], [tr.tunnel, 'rgba(12,16,30,0.9)', [2, 2]]]) {
    let on = -1; g.setLineDash(dash);
    for (let i = 0; i <= last; i++) { const j = tr.loopN ? i % N : i, m = mask[j]; if (m && on < 0) on = i; if ((!m || i === last) && on >= 0) { if (i - on > 2) { path(on, i, 1); g.strokeStyle = c; g.lineWidth = Math.max(1.5, lw * 0.55); g.stroke(); } on = -1; } }
    g.setLineDash([]);
  }
  // the start line (and a downhill run's finish): a chequered tick across the road
  for (const li of tr.loopN ? [tr.startIdx % N] : [tr.startIdx, tr.finishIdx]) {
    const x = X(tr.xs[li], tr.zs[li]), y = Y(tr.xs[li], tr.zs[li]), rx = SX(tr.rx[li], tr.rz[li]), ry = SY(tr.rx[li], tr.rz[li]), L = lw + 4;
    for (let q = -2; q < 2; q++) { g.fillStyle = q % 2 ? '#fff' : '#111'; g.fillRect(x + rx * L * q / 2 - 1.5, y + ry * L * q / 2 - 1.5, 3, 3); }
  }
}
/** The outline of track tr on canvas cv (menu cards: no cars). col: the road's colour. */
export function drawTrackMap(cv, tr, col = '#E8ECF5', cw, ch) {
  const S = sizeTo(cv, cw, ch); if (!S) return; const { g, w, h } = S;
  g.clearRect(0, 0, w, h); drawRoad(g, tr, frame(tr, w, h, 6), Math.max(2.5, Math.min(w, h) / 26), col);
}
/** The race's map: the outline once (cached), the cars on it every call. */
export function drawRaceMap(cv, tr, cars) {
  const S = sizeTo(cv); if (!S) return; const { g, w, h } = S, F = frame(tr, w, h, 7);
  if (!(cv._cache && cv._cache.tr === tr && cv._cache.w === cv.width)) {
    const off = document.createElement('canvas'); off.width = cv.width; off.height = cv.height;
    const og = off.getContext('2d'), dpr = cv.width / w; og.setTransform(dpr, 0, 0, dpr, 0, 0); drawRoad(og, tr, F, Math.max(3, Math.min(w, h) / 22), 'rgba(232,236,245,0.9)');
    cv._cache = { tr, w: cv.width, off };
  }
  g.clearRect(0, 0, w, h); g.drawImage(cv._cache.off, 0, 0, w, h);
  const order = cars.slice().sort((a, b) => (a.isPlayer ? 1 : 0) - (b.isPlayer ? 1 : 0));
  for (const c of order) {
    if (c.y < -500) continue;
    const r = c.isPlayer ? 5.5 : 3.6; g.beginPath(); g.arc(F.X(c.x, c.z), F.Y(c.x, c.z), r, 0, TAU);
    g.fillStyle = '#' + c.def.color.toString(16).padStart(6, '0'); g.fill(); g.lineWidth = c.isPlayer ? 2.5 : 1.2; g.strokeStyle = c.isPlayer ? '#FFFFFF' : '#1C2340'; g.stroke();
  }
}
