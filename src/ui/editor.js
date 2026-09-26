import { G } from '../game.js';
import { STAGES } from '../data/stages/index.js';
import { ELEMENTS } from '../core/elements/index.js';
import { buildTrack } from '../core/track/build.js';
import { closeLoop, freeze, sketch } from '../core/track/editing.js';
import { forgetTrack } from '../render/world/index.js';
import { $ } from './dom.js';
import { startRace } from './flow.js';

// The track editor (menu: Track editor). Start from one of the circuits (or a plain oval), edit it section by
// section on a plan of the lap: straights and curves, their heights, the ground either side and the pieces of road
// on them (jumps, bridges, tunnels, mud, dirt, whoops, ice, wrecking balls...). "Close the loop" makes the lap meet
// its start line again; "Test drive" races it straight away; "Send to Claude" puts it in the artifact's database
// ("tracks") for Claude to turn into a real stage. Drafts are kept in this browser as you go.
const DRAFT = 'downhill-rush-editor';
const GROUND = ['far', 'near', 'rampF', 'rampN'];
// pieces offered as toggles: tag -> value when switched on (numbers get a box to tune them)
const DEFAULTS = { jump: true, kick: 2.2, yump: 2.4, whoops: 0.6, bridge: true, tunnel: true, town: true, gallery: true, rockfall: true, arch: true, gap: true, boost: true, falls: true,
  drawbridge: 0, mill: true, logs: true, mud: true, ice: true, dirt: true, hammers: 3 };
const LABEL = { kick: 'kicker', yump: 'crest jump', whoops: 'whoops', jump: 'auto jumps', hammers: 'wrecking balls', gap: 'gap to jump', rockfall: 'rockfall', mud: 'mud', drawbridge: 'drawbridge', logs: 'log piles', mill: 'sawmill', falls: 'waterfall', boost: 'boost pads' };
const TAGS = ELEMENTS.flatMap(e => Object.entries(e.tags || {})).filter(([t]) => t in DEFAULTS);
const OVAL = { name: 'My track', blurb: 'A track made in the editor', type: 'gorge', laps: 3, seed: 1234, surface: 'tarmac', hillAmp: 3, jumps: 0, armco: true,
  segs: [['s', 120, 0, {}], ['a', 40, 180, 0, {}], ['s', 120, 0, {}], ['a', 40, 180, 0, {}]] };
let E = null, view = { s: 1, x: 0, y: 0 }, drag = null, EDIT_IDX = -1, db = null;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const clone = o => JSON.parse(JSON.stringify(o));
const gorges = () => STAGES.map((s, i) => [s, i]).filter(([s, i]) => s.type === 'gorge' && i !== EDIT_IDX && !s.name.startsWith('Sandbox'));
const tagsOf = sg => (sg[0] === 's' ? sg[3] : sg[4]) || (sg[0] === 's' ? (sg[3] = {}) : (sg[4] = {}));
export function initEditor() {
  $('editor-btn').addEventListener('click', () => openEditor());
  $('ed-exit').addEventListener('click', closeEditor);
  $('ed-base').addEventListener('change', e => { if (confirmLose()) load(e.target.value); else e.target.value = E.baseKey; });
  $('ed-name').addEventListener('input', e => { E.stage.name = e.target.value.slice(0, 40) || 'My track'; save(); });
  $('ed-laps').addEventListener('change', e => { E.stage.laps = Math.max(1, Math.min(9, Math.round(+e.target.value || 3))); save(); });
  $('ed-surface').addEventListener('change', e => { E.stage.surface = e.target.value; save(); });
  $('ed-keep').addEventListener('change', e => { E.keep = e.target.checked; save(); status(); });
  $('ed-close').addEventListener('click', () => { const r = closeLoop(E.stage.segs, E.stage.startHeading || 0); if (r.ok) { E.stage.segs = r.segs; changed(); } status(r.msg, !r.ok); });
  $('ed-drive').addEventListener('click', drive);
  $('ed-send').addEventListener('click', send);
  $('ed-sec').addEventListener('click', onSecClick); $('ed-sec').addEventListener('change', onSecInput);
  $('ed-list').addEventListener('click', e => { const li = e.target.closest('[data-n]'); if (li) select(+li.dataset.n); });
  const cv = $('ed-map');
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false }; });
  cv.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.hypot(dx, dy) > 5) drag.moved = true; view.x = drag.vx + dx; view.y = drag.vy + dy; draw(); });
  cv.addEventListener('pointerup', e => { if (drag && !drag.moved) pickAt(e.clientX, e.clientY); drag = null; });
  cv.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  $('ed-zoomin').addEventListener('click', () => { const r = cv.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.3); });
  $('ed-zoomout').addEventListener('click', () => { const r = cv.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.3); });
  $('ed-fit').addEventListener('click', () => { fit(); draw(); });
  addEventListener('resize', () => { if (!$('editor').hidden) { fit(); draw(); } });
  G.onEditorBack = () => openEditor(true);
  if (window.claude && window.claude.use) window.claude.use('db').then(d => { db = d; });
}
export function openEditor(back = false) {
  if (!E) { let d = null; try { d = JSON.parse(localStorage.getItem(DRAFT) || 'null'); } catch (e) { /* no draft */ } if (d && d.stage && d.stage.segs) E = d; else load(gorges()[0] ? 'stage:' + gorges()[0][0].name : 'oval', true); }
  G.editDrive = false; $('menu').hidden = true; $('editor').hidden = false;
  fillBase(); fillFields(); requestAnimationFrame(() => { if (!back || !view.fitted) fit(); draw(); list(); secPanel(); status(); });
}
function closeEditor() { $('editor').hidden = true; $('menu').hidden = false; }
function confirmLose() { return !E || !E.dirty || confirm('Start again from another track? Your changes to this one are kept only if you sent them to Claude.'); }
function fillBase() {
  $('ed-base').innerHTML = `<option value="oval">A plain oval</option>` + gorges().map(([s]) => `<option value="stage:${esc(s.name)}">${esc(s.name)}</option>`).join('');
  $('ed-base').value = E.baseKey;
}
function fillFields() { $('ed-name').value = E.stage.name; $('ed-laps').value = E.stage.laps || 3; $('ed-surface').value = E.stage.surface; $('ed-keep').checked = E.keep; }
function load(key, quiet) {
  let base = OVAL; if (key.startsWith('stage:')) { const st = STAGES.find(s => s.name === key.slice(6)); if (st) base = st; }
  const stage = clone(base); stage.segs = freeze(stage.segs, stage.startHeading || 0);
  if (base !== OVAL) stage.name = base.name + ' (edit)';
  E = { baseKey: key, base: base.name, stage, keep: true, sel: 0, dirty: false };
  if (!quiet) { fillFields(); fit(); changed(false); }
}
function save() { try { localStorage.setItem(DRAFT, JSON.stringify(E)); } catch (e) { /* full: fine, it's a draft */ } }
function changed(dirty = true) { if (dirty) E.dirty = true; save(); draw(); list(); secPanel(); status(); }
function select(n) { E.sel = Math.max(0, Math.min(E.stage.segs.length - 1, n)); draw(); list(); secPanel(); const li = $('ed-list').querySelector(`[data-n="${E.sel}"]`); if (li) li.scrollIntoView({ block: 'nearest' }); }
// ---------- the plan ----------
function sk() { return sketch(E.stage.segs, E.stage.startHeading || 0, 2); }
function fit() {
  const cv = $('ed-map'), r = cv.getBoundingClientRect(), k = sk(); if (!r.width) return;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const p of k.pts) { x0 = Math.min(x0, p.a); x1 = Math.max(x1, p.a); y0 = Math.min(y0, p.b); y1 = Math.max(y1, p.b); }
  view.s = Math.min((r.width - 40) / Math.max(40, x1 - x0), (r.height - 40) / Math.max(40, y1 - y0)); view.x = r.width / 2 - (x0 + x1) / 2 * view.s; view.y = r.height / 2 + (y0 + y1) / 2 * view.s; view.fitted = true;
}
const toScr = (a, b) => [view.x + a * view.s, view.y - b * view.s];
function zoomAt(cx, cy, f) { const r = $('ed-map').getBoundingClientRect(), x = cx - r.left, y = cy - r.top; view.x = x - (x - view.x) * f; view.y = y - (y - view.y) * f; view.s *= f; draw(); }
function pickAt(cx, cy) {
  const r = $('ed-map').getBoundingClientRect(), x = cx - r.left, y = cy - r.top, k = sk(); let best = -1, bd = 900;
  k.pts.forEach(p => { const [sx, sy] = toScr(p.a, p.b), d = (sx - x) ** 2 + (sy - y) ** 2; if (d < bd) { bd = d; best = p.sec; } });
  if (best >= 0) select(best);
}
function heightCol(h, lo, hi) { const t = hi > lo ? (h - lo) / (hi - lo) : 0.5; return `hsl(${210 - 185 * t},70%,${45 + 10 * t}%)`; }
function draw() {
  const cv = $('ed-map'), r = cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1); if (!r.width || !E) return;
  if (cv.width !== Math.round(r.width * dpr)) { cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, r.width, r.height);
  const k = sk(), segs = E.stage.segs; let lo = Infinity, hi = -Infinity; for (const p of k.pts) { lo = Math.min(lo, p.h); hi = Math.max(hi, p.h); }
  // grid, 50 m
  g.strokeStyle = 'rgba(255,255,255,.06)'; g.lineWidth = 1; const step = 50 * view.s;
  if (step > 8) { for (let x = view.x % step; x < r.width; x += step) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, r.height); g.stroke(); } for (let y = view.y % step; y < r.height; y += step) { g.beginPath(); g.moveTo(0, y); g.lineTo(r.width, y); g.stroke(); } }
  // the road, 12 m wide, coloured by height; the selected section outlined in yellow
  const wpx = Math.max(3, 12 * view.s); g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = '#FFC72C'; g.lineWidth = wpx + 8; g.beginPath(); let on = false;
  for (const p of k.pts) { const [x, y] = toScr(p.a, p.b); if (p.sec === E.sel) { on ? g.lineTo(x, y) : g.moveTo(x, y); on = true; } }
  g.stroke();
  for (let i = 1; i < k.pts.length; i++) { const p = k.pts[i - 1], q = k.pts[i], [x0, y0] = toScr(p.a, p.b), [x1, y1] = toScr(q.a, q.b); g.strokeStyle = heightCol(q.h, lo, hi); g.lineWidth = wpx; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
  // pieces on each section, section numbers, the start line, and the gap if the lap doesn't close
  g.font = '600 11px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  segs.forEach((sg, n) => {
    const st = k.starts[n], mid = k.pts[Math.min(k.pts.length - 1, Math.round((st.i + (k.starts[n + 1] ? k.starts[n + 1].i : k.pts.length - 1)) / 2))];
    const [sx, sy] = toScr(st.a, st.b); g.fillStyle = 'rgba(28,35,64,.85)'; g.beginPath(); g.arc(sx, sy, 8, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.fillText(String(n + 1), sx, sy);
    const tg = Object.keys(tagsOf(sg)).filter(t => t in DEFAULTS); if (!tg.length || !mid) return;
    const [mx, my] = toScr(mid.a, mid.b), txt = tg.map(t => LABEL[t] || t).join(', ');
    g.fillStyle = 'rgba(255,255,255,.9)'; const w = g.measureText(txt).width + 8; g.fillRect(mx - w / 2, my - 22, w, 14); g.fillStyle = '#1C2340'; g.fillText(txt, mx, my - 15);
  });
  const [s0x, s0y] = toScr(0, 0); g.fillStyle = '#fff'; g.fillRect(s0x - 4, s0y - 4, 8, 8); g.fillStyle = '#FFC72C'; g.fillText('START', s0x, s0y - 14);
  if (k.gap > 0.5) { const [ex, ey] = toScr(k.end.a, k.end.b); g.strokeStyle = '#E0402F'; g.setLineDash([6, 5]); g.lineWidth = 2; g.beginPath(); g.moveTo(ex, ey); g.lineTo(s0x, s0y); g.stroke(); g.setLineDash([]); }
  $('ed-legend').textContent = `height ${lo.toFixed(0)} m (blue) to ${hi.toFixed(0)} m (orange) · drag to move, wheel or +/- to zoom, tap a section to edit it`;
}
// ---------- sections ----------
function describe(sg) {
  const tg = tagsOf(sg), pieces = Object.keys(tg).filter(t => t in DEFAULTS).map(t => LABEL[t] || t);
  const shape = sg[0] === 's' ? `Straight ${Math.round(sg[1])} m` : `Curve r${Math.round(sg[1])} ${sg[2] > 0 ? 'left' : 'right'} ${Math.abs(Math.round(sg[2]))}°`;
  return `${shape}, to ${Math.round(sg[0] === 's' ? sg[2] : sg[3])} m${pieces.length ? ' · ' + pieces.join(', ') : ''}`;
}
function list() { $('ed-list').innerHTML = E.stage.segs.map((sg, n) => `<li data-n="${n}" class="${n === E.sel ? 'on' : ''}"><b>${n + 1}</b> ${esc(describe(sg))}</li>`).join(''); }
function num(id, label, v, min, max, stepv = 1, hint = '') { return `<label class="ed-f"><span>${label}${hint ? ` <small>${hint}</small>` : ''}</span><input type="number" data-f="${id}" value="${+(+v).toFixed(2)}" min="${min}" max="${max}" step="${stepv}"></label>`; }
function secPanel() {
  const n = E.sel, sg = E.stage.segs[n]; if (!sg) { $('ed-sec').innerHTML = ''; return; }
  const tg = tagsOf(sg), isS = sg[0] === 's';
  const chips = TAGS.map(([t, desc]) => `<button type="button" class="ed-chip${t in tg ? ' on' : ''}" data-tag="${t}" title="${esc(desc)}">${LABEL[t] || t}</button>`).join('');
  const vals = Object.keys(tg).filter(t => typeof tg[t] === 'number' && t in DEFAULTS).map(t => num('tag:' + t, LABEL[t] || t, tg[t], 0, 99, 0.1)).join('');
  $('ed-sec').innerHTML = `<div class="ed-head"><button type="button" data-a="prev" aria-label="Previous section">◀</button><b>Section ${n + 1} of ${E.stage.segs.length}</b><button type="button" data-a="next" aria-label="Next section">▶</button>
      <span class="ed-seg"><button type="button" data-a="toS" class="${isS ? 'on' : ''}">Straight</button><button type="button" data-a="toA" class="${isS ? '' : 'on'}">Curve</button></span></div>
    <div class="ed-grid">${isS ? num('len', 'Length', sg[1], 3, 800, 1, 'm') : num('R', 'Radius', sg[1], 8, 400, 1, 'm') + num('deg', 'Turn', sg[2], -300, 300, 1, '+ left, - right')}
      ${num('h', 'Height at the end', isS ? sg[2] : sg[3], -80, 200, 0.5, 'm')}${num('far', 'Ground up-screen', tg.far ?? 0, -120, 120, 1, 'm, + up')}${num('near', 'Ground camera side', tg.near ?? 0, -120, 120, 1, 'm, - drop')}</div>
    <div class="ed-chips">${chips}</div>${vals ? `<div class="ed-grid">${vals}</div>` : ''}
    ${'mud' in tg ? `<label class="ed-f ed-inline"><input type="checkbox" data-f="water" ${tg.mud === 'water' ? 'checked' : ''}> a water splash, not a mud bog</label>` : ''}
    <div class="ed-acts"><button type="button" data-a="addS">+ Straight after</button><button type="button" data-a="addA">+ Curve after</button><button type="button" data-a="up">Move up</button><button type="button" data-a="down">Move down</button><button type="button" data-a="del" class="ed-del">Delete</button></div>`;
}
function onSecClick(e) {
  const b = e.target.closest('button'); if (!b) return;
  const segs = E.stage.segs, n = E.sel, sg = segs[n];
  if (b.dataset.tag) { const tg = tagsOf(sg), t = b.dataset.tag; if (t in tg) delete tg[t]; else tg[t] = DEFAULTS[t]; changed(); return; }
  const a = b.dataset.a, h = sg ? (sg[0] === 's' ? sg[2] : sg[3]) : 0, tg = sg ? tagsOf(sg) : {};
  if (a === 'prev') return select(n - 1); if (a === 'next') return select(n + 1);
  if (a === 'toS' && sg[0] === 'a') segs[n] = ['s', Math.round(Math.abs(sg[1] * sg[2] * Math.PI / 180)) || 40, h, tg];
  else if (a === 'toA' && sg[0] === 's') segs[n] = ['a', 40, 90, h, tg];
  else if (a === 'addS') { segs.splice(n + 1, 0, ['s', 40, h, {}]); E.sel = n + 1; }
  else if (a === 'addA') { segs.splice(n + 1, 0, ['a', 40, 90, h, {}]); E.sel = n + 1; }
  else if (a === 'up' && n > 0) { [segs[n - 1], segs[n]] = [segs[n], segs[n - 1]]; E.sel = n - 1; }
  else if (a === 'down' && n < segs.length - 1) { [segs[n + 1], segs[n]] = [segs[n], segs[n + 1]]; E.sel = n + 1; }
  else if (a === 'del' && segs.length > 3) { segs.splice(n, 1); E.sel = Math.min(n, segs.length - 1); }
  else return;
  changed();
}
function onSecInput(e) {
  const f = e.target.dataset.f; if (!f) return;
  const sg = E.stage.segs[E.sel], tg = tagsOf(sg), v = +e.target.value;
  if (f === 'water') { tg.mud = e.target.checked ? 'water' : true; changed(); return; }
  if (!isFinite(v)) return;
  if (f === 'len') sg[1] = Math.max(3, v); else if (f === 'R') sg[1] = Math.max(8, v); else if (f === 'deg') sg[2] = Math.max(-300, Math.min(300, v));
  else if (f === 'h') sg[sg[0] === 's' ? 2 : 3] = v;
  else if (f === 'far' || f === 'near') { if (v) tg[f] = v; else delete tg[f]; }
  else if (f.startsWith('tag:')) tg[f.slice(4)] = v;
  changed();
}
// ---------- checking, driving, sending ----------
function built() {
  const st = clone(E.stage); if (!E.keep) { delete st.branches; delete st.rails; delete st.river; }
  for (const sg of st.segs) { const tg = tagsOf(sg); for (const t of GROUND) if (tg[t] === undefined) delete tg[t]; }
  return st;
}
function status(msg, bad) {
  const k = sk(), len = Math.round(k.lens.reduce((a, b) => a + b, 0)), open = k.gap > 0.6 || Math.abs(k.turn - Math.round(k.turn / 360) * 360) > 0.5;
  const el = $('ed-status');
  el.textContent = msg || (open ? `Lap ${len} m · open: the end is ${k.gap.toFixed(0)} m from the start${Math.abs(k.turn - Math.round(k.turn / 360) * 360) > 0.5 ? `, facing ${Math.round(k.turn - Math.round(k.turn / 360) * 360)}° off` : ''}. Close the loop to drive it.` : `Lap ${len} m · closes`);
  el.className = 'ed-status' + (bad || (!msg && open) ? ' bad' : '');
}
function drive() {
  const k = sk(); if (k.gap > 0.6) { status('The lap has to close before you can drive it: press Close the loop.', true); return; }
  const st = built(); st.blurb = st.blurb || 'Made in the editor';
  try { buildTrack(st); } catch (err) {
    if (st.branches && /branch/.test(err.message)) { status(`${err.message}. Untick "keep shortcuts & railway" to drive it without them.`, true); return; }
    status(err.message, true); return;
  }
  if (EDIT_IDX < 0) { EDIT_IDX = STAGES.length; STAGES.push(st); } else STAGES[EDIT_IDX] = st;
  forgetTrack(EDIT_IDX); G.forceBuild = true; G.editDrive = true;
  $('editor').hidden = true; startRace(EDIT_IDX);
}
async function send() {
  const k = sk(), msg = $('ed-msg').value.trim(), doc = { name: E.stage.name, base: E.base, closes: k.gap < 0.6, stage: built(), message: msg, at: new Date().toISOString(), status: 'sent' };
  if (!db) {
    const txt = JSON.stringify(doc);
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => status('Not connected to the shared database here: the track is copied, paste it to Claude.'), () => status('Not connected here: use the published game to send it.', true));
    return;
  }
  try { await db.collection('tracks').doc('t' + Date.now().toString(36)).set(doc); E.dirty = false; save(); status('Sent to Claude' + (msg ? ' with your message' : '') + '. Ask Claude to look at your track.'); $('ed-msg').value = ''; }
  catch (err) { status('Could not send it (' + (err.code || 'error') + '); try again in a moment.', true); }
}
