import { $ } from './dom.js';

// Sketch pad, for Claude: a sheet of paper to draw ideas on (tracks, set pieces, anything), with a pen that follows
// Apple Pencil pressure, a marker, an eraser, lines, arrows, boxes, circles and words. "Send to Claude" saves the
// picture (a PNG asset) and its strokes (a JSON asset, so it can be opened and drawn on again) with a title and a
// message in the artifact's database ("sketches" collection); Claude looks at the picture and answers (`reply`),
// which shows in My sketches. Without the database (a saved copy of the page) sketches are kept on this device.
// With a Pencil, fingers don't draw (palm rest): one finger moves the paper, two pinch to zoom.
const W = 1600, H = 1200, DRAFT = 'downhill-rush-sketch', LOCAL = 'downhill-rush-sketches';
const COLS = ['#1C2340', '#7A8199', '#E0402F', '#F28C28', '#FFC72C', '#3BA55C', '#2F7DE0', '#8B5A2B', '#9B59B6', '#FFFFFF'];
const SIZES = { pen: [3, 7, 14], marker: [18, 32, 56], eraser: [20, 44, 90], text: [26, 40, 64] };
const TOOLS = [['pen', '✎', 'Pen'], ['marker', '▮', 'Marker'], ['eraser', '⌫', 'Eraser'], ['line', '╱', 'Line'], ['arrow', '➚', 'Arrow'],
  ['rect', '▭', 'Box'], ['ellipse', '◯', 'Circle'], ['text', 'T', 'Words'], ['hand', '✋', 'Move']];
const FREE = { pen: 1, marker: 1, eraser: 1 };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const r1 = v => Math.round(v * 10) / 10;
let S = null, redo = [], db = null, assets = null, sent = [], localOnly = true;
let cv, ctx, ink, ictx, live, lctx, view = { x: 0, y: 0, s: 1 }, cur = null, textAt = null, penSeen = false;
const pts = new Map(); let pinch = null, pan = null;

function fresh() { return { title: '', msg: '', bg: 'grid', tool: 'pen', col: 0, size: 1, strokes: [], of: null, dirty: false }; }
function save() { try { localStorage.setItem(DRAFT, JSON.stringify(S)); } catch (e) { /* full: fine, it's a draft */ } }
function loadLocal() { try { return JSON.parse(localStorage.getItem(LOCAL) || '[]') || []; } catch (e) { return []; } }
function saveLocal(list) { try { localStorage.setItem(LOCAL, JSON.stringify(list)); return true; } catch (e) { return false; } }

export function initSketch() {
  $('sketch-btn').addEventListener('click', openSketch);
  cv = $('sk-paper'); ctx = cv.getContext('2d');
  ink = document.createElement('canvas'); ink.width = W; ink.height = H; ictx = ink.getContext('2d');
  live = document.createElement('canvas'); live.width = W; live.height = H; lctx = live.getContext('2d');
  $('sk-tools').innerHTML = TOOLS.map(([k, i, n]) => `<button type="button" data-tool="${k}" title="${n}" aria-label="${n}"><span>${i}</span><small>${n}</small></button>`).join('');
  $('sk-cols').innerHTML = COLS.map((c, n) => `<button type="button" data-col="${n}" style="background:${c}" aria-label="Colour ${n + 1}"></button>`).join('');
  $('sk-sizes').innerHTML = [0, 1, 2].map(n => `<button type="button" data-size="${n}" aria-label="${['Thin', 'Medium', 'Thick'][n]}"><i style="width:${5 + n * 6}px;height:${5 + n * 6}px"></i></button>`).join('');
  $('sk-tools').addEventListener('click', e => { const b = e.target.closest('[data-tool]'); if (b) { S.tool = b.dataset.tool; hideText(); bar(); save(); } });
  $('sk-cols').addEventListener('click', e => { const b = e.target.closest('[data-col]'); if (b) { S.col = +b.dataset.col; if (S.tool === 'eraser' || S.tool === 'hand') S.tool = 'pen'; bar(); save(); } });
  $('sk-sizes').addEventListener('click', e => { const b = e.target.closest('[data-size]'); if (b) { S.size = +b.dataset.size; bar(); save(); } });
  $('sk-undo').addEventListener('click', undo); $('sk-redo').addEventListener('click', redoIt);
  $('sk-clear').addEventListener('click', () => { if (live0().length) { commit({ k: 'clear' }); } });
  $('sk-bg').addEventListener('click', () => { S.bg = S.bg === 'grid' ? 'plain' : 'grid'; bar(); save(); paint(); });
  $('sk-fit').addEventListener('click', () => { fit(); paint(); });
  $('sk-new').addEventListener('click', () => { if (S.dirty && live0().length && !confirm('Start a new sketch? This one has not been sent to Claude.')) return; S = fresh(); redo = []; replay(); fields(); bar(); save(); });
  $('sk-exit').addEventListener('click', closeSketch);
  $('sk-title').addEventListener('input', e => { S.title = e.target.value.slice(0, 60); save(); });
  $('sk-send').addEventListener('click', () => { $('sk-msg').value = S.msg; $('sk-sendform').hidden = false; $('sk-msg').focus(); });
  $('sk-msg').addEventListener('input', e => { S.msg = e.target.value; save(); });
  $('sk-sendgo').addEventListener('click', send); $('sk-sendcancel').addEventListener('click', () => { $('sk-sendform').hidden = true; });
  $('sk-mine').addEventListener('click', openList); $('sk-listclose').addEventListener('click', () => { $('sk-list').hidden = true; });
  $('sk-listbody').addEventListener('click', e => { const o = e.target.closest('[data-open]'), d = e.target.closest('[data-del]'); if (o) reopen(o.dataset.open); if (d) del(d.dataset.del); });
  $('sk-textok').addEventListener('click', placeText); $('sk-textcancel').addEventListener('click', hideText);
  $('sk-text').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); placeText(); } if (e.key === 'Escape') hideText(); });
  cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move);
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  addEventListener('resize', () => { if (!$('sketch').hidden) { size(); fit(); paint(); } });
  addEventListener('keydown', e => {
    if ($('sketch').hidden || /INPUT|TEXTAREA/.test(document.activeElement && document.activeElement.tagName)) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redoIt() : undo(); }
  });
  if (window.claude && window.claude.use) {
    window.claude.use('db').then(d => {
      if (!d) return; db = d; localOnly = false;
      db.collection('sketches').onSnapshot(s => { sent = s.docs.map(x => ({ id: x.id, ...x.data() })); if (!$('sk-list').hidden) drawList(); }, () => { db = null; localOnly = true; });
    });
    window.claude.use('assets').then(a => { assets = a; });
  }
}
export function openSketch() {
  if (!S) { try { S = JSON.parse(localStorage.getItem(DRAFT) || 'null'); } catch (e) { S = null; } S = S && Array.isArray(S.strokes) ? { ...fresh(), ...S } : fresh(); }
  $('menu').hidden = true; $('sketch').hidden = false;
  fields(); bar(); requestAnimationFrame(() => { size(); fit(); replay(); });
}
function closeSketch() { hideText(); $('sk-sendform').hidden = true; $('sk-list').hidden = true; $('sketch').hidden = true; $('menu').hidden = false; }
function fields() { $('sk-title').value = S.title; $('sk-msg').value = S.msg; }
function bar() {
  document.querySelectorAll('#sk-tools [data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === S.tool));
  document.querySelectorAll('#sk-cols [data-col]').forEach(b => b.classList.toggle('on', +b.dataset.col === S.col));
  document.querySelectorAll('#sk-sizes [data-size]').forEach(b => b.classList.toggle('on', +b.dataset.size === S.size));
  $('sk-undo').disabled = !S.strokes.length; $('sk-redo').disabled = !redo.length;
  $('sk-bg').textContent = S.bg === 'grid' ? 'Paper: grid' : 'Paper: plain';
  cv.className = 'sk-' + S.tool;
}

// --- the view: the paper (W x H) sits on the canvas at view.x/y, view.s screen pixels per paper pixel ---
function size() { const r = cv.getBoundingClientRect(), d = devicePixelRatio || 1; cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d)); }
function fit() { const r = cv.getBoundingClientRect(), s = Math.min((r.width - 24) / W, (r.height - 24) / H); view = { s, x: (r.width - W * s) / 2, y: (r.height - H * s) / 2 }; }
function toPaper(cx, cy) { const r = cv.getBoundingClientRect(); return [(cx - r.left - view.x) / view.s, (cy - r.top - view.y) / view.s]; }
function zoomAt(cx, cy, f) { const r = cv.getBoundingClientRect(), x = cx - r.left, y = cy - r.top, s = Math.max(0.1, Math.min(8, view.s * f)); f = s / view.s; view.x = x - (x - view.x) * f; view.y = y - (y - view.y) * f; view.s = s; paint(); }
function background(c) {
  c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, W, H); if (S.bg !== 'grid') return;
  c.lineWidth = 1; for (let g = 40; g < Math.max(W, H); g += 40) {
    c.strokeStyle = g % 200 ? '#E4ECF7' : '#C9D8EE'; c.beginPath();
    if (g < W) { c.moveTo(g + 0.5, 0); c.lineTo(g + 0.5, H); } if (g < H) { c.moveTo(0, g + 0.5); c.lineTo(W, g + 0.5); } c.stroke();
  }
}
let queued = false;
function paint() { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; paintNow(); }); } }
function paintNow() {
  const d = devicePixelRatio || 1; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#2A3150'; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(view.s * d, 0, 0, view.s * d, view.x * d, view.y * d);
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 18; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.shadowBlur = 0;
  background(ctx); ctx.drawImage(ink, 0, 0);
  // shapes and the marker draw on `live` until they're done
  if (cur && (!FREE[cur.k] || cur.k === 'marker')) { ctx.globalAlpha = cur.k === 'marker' ? 0.4 : 1; ctx.drawImage(live, 0, 0); ctx.globalAlpha = 1; }
}

// --- strokes: { k, c, w, p: [x, y, pressure, ...] } in paper pixels; { k: 'text', c, w, x, y, t }; { k: 'clear' } ---
const pw = (s, i) => s.k === 'pen' && s.pr ? s.w * (0.3 + 1.2 * s.p[i + 2]) : s.w;
function segment(c, s, i) {   // the piece of a freehand stroke ending at point i/3: midpoint to midpoint through the point before
  const p = s.p, n = i / 3; if (n < 1) { c.beginPath(); c.arc(p[0], p[1], pw(s, 0) / 2, 0, 7); c.fill(); return; }
  const a = n >= 2 ? [(p[i - 6] + p[i - 3]) / 2, (p[i - 5] + p[i - 2]) / 2] : [p[0], p[1]], m = [(p[i - 3] + p[i]) / 2, (p[i - 2] + p[i + 1]) / 2];
  c.lineWidth = pw(s, i - 3); c.beginPath(); c.moveTo(a[0], a[1]); c.quadraticCurveTo(p[i - 3], p[i - 2], m[0], m[1]); c.stroke();
}
function style(c, s) { c.strokeStyle = c.fillStyle = s.c; c.lineCap = c.lineJoin = 'round'; c.globalCompositeOperation = s.k === 'eraser' ? 'destination-out' : 'source-over'; }
function drawFree(c, s, from = 0) { style(c, s); for (let i = from; i < s.p.length; i += 3) segment(c, s, i); c.globalCompositeOperation = 'source-over'; }
function endFree(c, s) { const p = s.p, n = p.length; if (n < 6) return; style(c, s); c.lineWidth = pw(s, n - 3); c.beginPath(); c.moveTo((p[n - 6] + p[n - 3]) / 2, (p[n - 5] + p[n - 2]) / 2); c.lineTo(p[n - 3], p[n - 2]); c.stroke(); c.globalCompositeOperation = 'source-over'; }
function drawShape(c, s) {
  style(c, s); c.lineWidth = s.w; const [x0, y0, , x1, y1] = s.p; c.beginPath();
  if (s.k === 'line' || s.k === 'arrow') { c.moveTo(x0, y0); c.lineTo(x1, y1); }
  if (s.k === 'arrow') { const a = Math.atan2(y1 - y0, x1 - x0), h = Math.max(18, s.w * 4); for (const d of [-0.45, 0.45]) { c.moveTo(x1, y1); c.lineTo(x1 - Math.cos(a + d) * h, y1 - Math.sin(a + d) * h); } }
  if (s.k === 'rect') c.rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
  if (s.k === 'ellipse') c.ellipse((x0 + x1) / 2, (y0 + y1) / 2, Math.abs(x1 - x0) / 2 + 0.1, Math.abs(y1 - y0) / 2 + 0.1, 0, 0, 7);
  c.stroke();
}
function drawText(c, s) { style(c, s); c.font = `700 ${s.w}px 'Barlow Semi Condensed','Arial Narrow',Arial,sans-serif`; c.textBaseline = 'middle'; s.t.split('\n').forEach((l, n) => c.fillText(l, s.x, s.y + n * s.w * 1.15)); }
function drawStroke(c, s) {
  if (s.k === 'marker') { lctx.clearRect(0, 0, W, H); drawFree(lctx, s); endFree(lctx, s); c.globalAlpha = 0.4; c.drawImage(live, 0, 0); c.globalAlpha = 1; }
  else if (FREE[s.k]) { drawFree(c, s); endFree(c, s); } else if (s.k === 'text') drawText(c, s); else drawShape(c, s);
}
function live0() { let n = S.strokes.length; while (n-- > 0) if (S.strokes[n].k === 'clear') break; return S.strokes.slice(n + 1); }   // what's on the paper now
function replay() { ictx.clearRect(0, 0, W, H); for (const s of live0()) drawStroke(ictx, s); bar(); paint(); }
function commit(s) { S.strokes.push(s); redo = []; S.dirty = true; if (s.k === 'clear') replay(); else if (!FREE[s.k] || s.k === 'marker') drawStroke(ictx, s); else endFree(ictx, s); save(); bar(); paint(); }
function undo() { const s = S.strokes.pop(); if (!s) return; redo.push(s); S.dirty = true; save(); replay(); }
function redoIt() { const s = redo.pop(); if (!s) return; S.strokes.push(s); S.dirty = true; save(); replay(); }

// --- pointers: Pencil and mouse draw; fingers draw too until a Pencil is seen; two fingers pinch; Move tool pans ---
function drawsWith(e) { return S.tool !== 'hand' && (e.pointerType === 'pen' || e.pointerType === 'mouse' && e.button === 0 || e.pointerType === 'touch' && !penSeen); }
function down(e) {
  e.preventDefault(); if (!$('sk-textform').hidden) { hideText(); return; }
  cv.setPointerCapture(e.pointerId); if (e.pointerType === 'pen') penSeen = true;
  pts.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
  const touches = [...pts.values()].filter(p => p.type === 'touch');
  if (e.pointerType === 'touch' && touches.length >= 2) {   // a second finger: that was a pinch, not a stroke
    if (cur && cur.touch) { cur = null; replay(); } pan = null;
    const [a, b] = touches; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, v: { ...view } }; return;
  }
  if (cur) return;
  if (drawsWith(e)) {
    const [x, y] = toPaper(e.clientX, e.clientY);
    if (S.tool === 'text') { showText(x, y, e.clientX, e.clientY); return; }
    const k = S.tool, w = (SIZES[k] || SIZES.pen)[S.size];
    cur = { k, c: COLS[S.col], w, p: [r1(x), r1(y), FREE[k] ? +(e.pressure || 0.5).toFixed(2) : 0], id: e.pointerId, touch: e.pointerType === 'touch' };
    if (k === 'pen' && e.pointerType === 'pen') cur.pr = 1;
    if (!FREE[k]) cur.p.push(r1(x), r1(y), 0);
    if (k === 'pen' || k === 'eraser') drawFree(ictx, cur);
    paint(); return;
  }
  pan = { id: e.pointerId, x: e.clientX, y: e.clientY, v: { ...view } };
}
function move(e) {
  const p = pts.get(e.pointerId); if (!p) return; p.x = e.clientX; p.y = e.clientY;
  if (pinch) {
    const t = [...pts.values()].filter(q => q.type === 'touch'); if (t.length < 2) return; const [a, b] = t;
    const f = Math.max(0.1, Math.min(8, pinch.v.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d)) / pinch.v.s, r = cv.getBoundingClientRect();
    const mx = (a.x + b.x) / 2 - r.left, my = (a.y + b.y) / 2 - r.top, ox = pinch.mx - r.left, oy = pinch.my - r.top;
    view = { s: pinch.v.s * f, x: mx - (ox - pinch.v.x) * f, y: my - (oy - pinch.v.y) * f }; paint(); return;
  }
  if (pan && pan.id === e.pointerId) { view.x = pan.v.x + e.clientX - pan.x; view.y = pan.v.y + e.clientY - pan.y; paint(); return; }
  if (!cur || cur.id !== e.pointerId) return;
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : []; for (const q of evs.length ? evs : [e]) addPoint(q);
  paint();
}
function addPoint(e) {
  const [x, y] = toPaper(e.clientX, e.clientY), p = cur.p;
  if (!FREE[cur.k]) { p[3] = r1(x); p[4] = r1(y); lctx.clearRect(0, 0, W, H); drawShape(lctx, cur); return; }
  if (Math.hypot(x - p[p.length - 3], y - p[p.length - 2]) * view.s < 1.5) return;
  p.push(r1(x), r1(y), +(e.pressure || 0.5).toFixed(2));
  if (cur.k === 'marker') { lctx.clearRect(0, 0, W, H); drawFree(lctx, cur); } else drawFree(ictx, cur, p.length - 3);
}
function up(e) {
  pts.delete(e.pointerId);
  if (pinch) { if ([...pts.values()].filter(q => q.type === 'touch').length < 2) pinch = null; return; }
  if (pan && pan.id === e.pointerId) { pan = null; return; }
  if (!cur || cur.id !== e.pointerId) return;
  const s = cur; cur = null; delete s.id; delete s.touch; lctx.clearRect(0, 0, W, H);
  if (!FREE[s.k] && Math.hypot(s.p[3] - s.p[0], s.p[4] - s.p[1]) < 4) { paint(); return; }   // a tap with a shape tool: nothing
  commit(s);
}
function showText(x, y, cx, cy) {
  textAt = { x, y }; const f = $('sk-textform'), r = $('sketch').getBoundingClientRect();
  f.style.left = Math.min(cx - r.left, r.width - 270) + 'px'; f.style.top = Math.min(cy - r.top, r.height - 120) + 'px';
  f.hidden = false; $('sk-text').value = ''; $('sk-text').focus();
}
function hideText() { textAt = null; $('sk-textform').hidden = true; }
function placeText() { const t = $('sk-text').value.trim(), at = textAt; hideText(); if (t && at) commit({ k: 'text', c: COLS[S.col], w: SIZES.text[S.size], x: r1(at.x), y: r1(at.y), t }); }

// --- sending: the picture and the strokes as assets, the rest in the "sketches" collection ---
function picture(scale = 1) { const c = document.createElement('canvas'); c.width = W * scale; c.height = H * scale; const x = c.getContext('2d'); x.scale(scale, scale); background(x); x.drawImage(ink, 0, 0); return c; }
const blobOf = (c, type, q) => new Promise(res => c.toBlob(res, type, q));
async function send() {
  const strokes = live0(); if (!strokes.length) { flash('Draw something first'); return; }
  $('sk-sendform').hidden = true; S.msg = $('sk-msg').value.trim();
  const doc = { title: S.title.trim() || 'Untitled sketch', message: S.msg, w: W, h: H, strokeCount: strokes.length, of: S.of || null, at: new Date().toISOString(), status: 'sent' };
  if (!localOnly && db) {
    try {
      flash('Sending to Claude…', true);
      if (assets) {
        doc.shot = (await assets.upload(await blobOf(picture(), 'image/png'), { type: 'image/png' })).id;
        try { doc.strokes = (await assets.upload(new Blob([JSON.stringify({ w: W, h: H, bg: S.bg, strokes })], { type: 'application/json' }), { type: 'application/json' })).id; } catch (e) { /* the picture matters more */ }
      }
      if (!doc.shot) throw new Error('no picture');
      await db.collection('sketches').doc('s' + Date.now().toString(36)).set(doc);
      S.dirty = false; S.msg = ''; save(); flash('Sent to Claude. Ask Claude to look at your sketch.'); return;
    } catch (e) { flash('Could not send it to Claude; kept on this device'); }
  }
  const list = loadLocal(); list.push({ id: 'l' + Date.now().toString(36), ...doc, thumb: picture(0.25).toDataURL('image/jpeg', 0.8), data: { bg: S.bg, strokes } });
  while (list.length && !saveLocal(list)) list.shift();   // full: the oldest go first
  S.dirty = false; S.msg = ''; save(); flash('Kept on this device (not connected to Claude)');
}
function flash(t, stay) { const el = $('sk-toast'); el.textContent = t; el.hidden = false; clearTimeout(flash.t); if (!stay) flash.t = setTimeout(() => { el.hidden = true; }, 2800); }
function allSketches() { return (localOnly ? loadLocal() : sent).slice().sort((a, b) => (b.at || '').localeCompare(a.at || '')); }
function openList() { drawList(); $('sk-list').hidden = false; }
function drawList() {
  const all = allSketches();
  $('sk-listsub').textContent = localOnly ? 'Kept on this device: this page is not connected to Claude.' : 'Sent to Claude: it looks at each one and answers here.';
  $('sk-listbody').innerHTML = all.length ? all.map(s => `<div class="sk-item${s.reply || s.status === 'done' ? ' done' : ''}">
    ${s.thumb || s.shot ? `<img alt="" src="${esc(s.thumb || '/_blob/' + s.shot)}">` : '<span class="sk-noimg"></span>'}
    <div><b>${esc(s.title)}</b> <small>${esc((s.at || '').slice(0, 10))}</small>${s.message ? `<p>${esc(s.message)}</p>` : ''}${s.reply ? `<em>Claude: ${esc(s.reply)}</em>` : ''}
    <span class="sk-itembtns">${s.strokes || s.data ? `<button type="button" class="btn" data-open="${esc(s.id)}">Open</button>` : ''}<button type="button" class="btn" data-del="${esc(s.id)}">Delete</button></span></div></div>`).join('')
    : '<p>No sketches yet. Draw an idea and press Send to Claude.</p>';
}
async function reopen(id) {
  const s = allSketches().find(x => x.id === id); if (!s) return;
  if (S.dirty && live0().length && !confirm('Open this sketch? The one on the paper has not been sent to Claude.')) return;
  let data = s.data;
  if (!data && s.strokes) { try { data = await (await fetch('/_blob/' + s.strokes)).json(); } catch (e) { flash('Could not open that sketch'); return; } }
  if (!data || !Array.isArray(data.strokes)) return;
  S = { ...fresh(), title: s.title, bg: data.bg || 'grid', strokes: data.strokes, of: id }; redo = [];
  $('sk-list').hidden = true; fields(); replay(); save();
}
async function del(id) {
  if (!confirm('Delete this sketch?')) return;
  if (!localOnly && db && !id.startsWith('l')) { try { await db.collection('sketches').doc(id).delete(); } catch (e) { flash('Could not delete that sketch'); } return; }
  saveLocal(loadLocal().filter(s => s.id !== id)); drawList();
}
