import * as THREE from 'three';
import { G } from '../game.js';
import { STAGES } from '../data/stages/index.js';
import { BUILDINGS, BUILDING_TYPES } from '../data/structures.js';
import { HALF } from '../core/constants.js';
import { corners } from '../core/elements/structures.js';
import { PROPS, sculptAt, sculptDab } from '../core/track/edits.js';
import { pathFromTrack, samplePath } from '../core/track/path.js';
import { PIECES } from '../core/track/pieces.js';
import { LOOKS, generateStage } from '../core/track/generate.js';
import { LAND_STYLES } from '../core/track/ground.js';
import { buildTrack } from '../core/track/build.js';
import { pickGround } from '../render/notepins.js';
import { pcamera, scene } from '../render/renderer.js';
import { forgetTrack } from '../render/world/index.js';
import { $ } from './dom.js';
import { openViewer, setEditHooks, viewerState } from './viewer.js';

// The Track Studio: the Track viewer's Edit mode. Edit makes a copy of the stage on show (a draft: the stage itself is
// never touched) and the tools change it in place, in 3D:
//   Raise / Lower / Smooth / Flatten   brush the land (and the road over it: a hump, a jump, a dip), live as you drag
//   Place                             tap the ground to put a tree, a bush, a rock or a building there (the palette);
//                                     tap one you put there to turn it, size it or delete it, drag it to move it
//   Erase                             brush away scenery: the stage's own trees and rocks, and anything put there
//   Pieces                            set pieces on the road (core/track/pieces.js): tap the road for the picked one
//                                     (a kicker, a splash, wrecking balls, a tunnel...), tap one to size it, drag to move
//   New track                         Generate: a landscape, a lap on it and set pieces to meet the pillars
//                                     (core/track/generate.js), as a new draft to edit
//   Road                              the road's line as yellow points (core/track/path.js): drag one to move the road,
//                                     tap the road between them for another, tap one to lift or sink the road there
// Each change is data on the draft (stage.edits: core/track/edits.js), so the stage is rebuilt from it a moment after
// you let go and the report card follows. Undo / Redo, Test drive (Drive it) comes back here; drafts are kept in this
// browser and listed under the stage picker; Send to Claude puts one in the shared `tracks` collection (base "studio").
// Getting about is the viewer's: two fingers, right-drag or the View tool move the camera while a brush is picked.
const LS = 'downhill-rush-studio', TOOLS = ['view', 'raise', 'lower', 'smooth', 'flatten', 'road', 'pieces', 'place', 'erase'];
const HINT = { view: 'Move the view: drag, two fingers, wheel', raise: 'Drag to raise the land: under the road it lifts the road (a hump, a jump)', lower: 'Drag to dig the land down: dips, hollows, drops',
  smooth: 'Drag to smooth out bumps and steps', flatten: 'Drag to level the land at the height where you started', place: 'Tap the ground to put the picked thing there; tap one of yours to change it, drag it to move it',
  erase: 'Drag over trees, bushes and rocks to take them away',
  pieces: 'Pick a set piece, then tap the road to put it there; tap one to make it longer or shorter, drag it along the road to move it',
  road: 'Drag a yellow point to move the road; tap the road between points to add one; tap a point to raise, lower or delete it' };
const S = { on: false, tool: 'raise', size: 14, power: 0.5, kind: 'pine', drafts: [], draft: null, slot: -1, undo: [], redo: [], stroke: null, sel: null, drag: null, built: null, timer: 0, cursor: null, marks: null, driving: false, db: null, path: null, handles: null, pt: -1, piece: 'yump', psel: -1, pdrag: null, pmarks: null };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const clone = o => JSON.parse(JSON.stringify(o));
const stage = () => S.draft && S.draft.stage, edits = () => { const st = stage(); return st.edits || (st.edits = {}); };
const KIND_NAME = { ...PROPS, ...Object.fromEntries(BUILDING_TYPES.map(t => [t, BUILDINGS[t].name])) };

export function initStudio() {
  try { S.drafts = JSON.parse(localStorage.getItem(LS) || '[]') || []; } catch (e) { S.drafts = []; }
  $('vw-edit').addEventListener('click', () => S.on ? leave() : enter());
  document.querySelectorAll('#st [data-st]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.st)));
  $('st-palette').innerHTML = Object.keys(KIND_NAME).map(k => `<button type="button" data-kind="${k}">${esc(KIND_NAME[k])}</button>`).join('');
  $('st-palette').addEventListener('click', e => { const b = e.target.closest('[data-kind]'); if (b) { S.kind = b.dataset.kind; S.sel = null; ui(); } });
  $('st-size').addEventListener('input', e => { S.size = +e.target.value; });
  $('st-power').addEventListener('input', e => { S.power = +e.target.value / 10; });
  $('st-pieces').innerHTML = Object.entries(PIECES).map(([k, P]) => `<button type="button" data-piece="${k}"><i style="background:${P.color}"></i>${esc(P.name)}</button>`).join('');
  $('st-pieces').addEventListener('click', e => { const b = e.target.closest('[data-piece]'); if (b) { S.piece = b.dataset.piece; S.psel = -1; ui(); } });
  $('vw-new').addEventListener('click', () => { $('st-gen').hidden = !$('st-gen').hidden; });
  $('st-gen-style').innerHTML = Object.entries(LAND_STYLES).map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('');
  $('st-gen-look').innerHTML = Object.entries(LOOKS).map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('');
  $('st-gen-go').addEventListener('click', generate); $('st-gen-x').addEventListener('click', () => { $('st-gen').hidden = true; });
  $('st-undo').addEventListener('click', undo); $('st-redo').addEventListener('click', redo);
  $('st-rotl').addEventListener('click', () => turnSel(-15)); $('st-rotr').addEventListener('click', () => turnSel(15));
  $('st-smaller').addEventListener('click', () => sizeSel(1 / 1.2)); $('st-bigger').addEventListener('click', () => sizeSel(1.2));
  $('st-del').addEventListener('click', delSel); $('st-start').addEventListener('click', startHere);
  $('st-rename').addEventListener('click', rename); $('st-delete').addEventListener('click', delDraft);
  $('st-send').addEventListener('click', () => { $('st-sendform').hidden = !$('st-sendform').hidden; });
  $('st-sendgo').addEventListener('click', send);
  $('vw-drive').addEventListener('click', () => { if (S.on) S.driving = true; }, true);   // (before the viewer's own: a test drive comes back here)
  addEventListener('keydown', e => {
    if (!S.on || $('viewer').hidden || (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))) return;
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') { e.preventDefault(); redo(); }
    else if (/^Digit[1-9]$/.test(e.code)) setTool(TOOLS[+e.code.slice(5) - 1]);
    else if (e.code === 'BracketLeft') { S.size = Math.max(4, S.size / 1.25); ui(); } else if (e.code === 'BracketRight') { S.size = Math.min(80, S.size * 1.25); ui(); }
    else if ((e.code === 'Delete' || e.code === 'Backspace') && S.sel) delSel();
  });
  if (window.claude && window.claude.use) window.claude.use('db').then(d => { S.db = d; });
  setEditHooks({ want, down, move, up, cancel, hover, opened, closed, options, pick });
}
// ---------- drafts ----------
function saveDrafts() { try { localStorage.setItem(LS, JSON.stringify(S.drafts)); } catch (e) { status('Could not save the draft in this browser (full?)', true); } }
/** Put draft d in the studio's stage slot and show it. */
function openDraft(d, keep = false) {
  S.draft = d; const st = d.stage;
  if (S.slot < 0) { S.slot = STAGES.length; STAGES.push(st); } else STAGES[S.slot] = st;
  forgetTrack(S.slot); G.forceBuild = true; openViewer(S.slot, { keep });
}
function enter() {
  const idx = viewerState.idx;
  if (!(idx === S.slot && S.draft)) {
    // a copy of the stage on show (a test drive's or another draft's included)
    const base = STAGES[idx], name = base.name.replace(/^✎ /, '');
    let n = 1, nm = '✎ ' + name; while (S.drafts.some(d => d.name === nm)) nm = `✎ ${name} ${++n}`;
    const st = clone(base); st.name = nm; st.edits = st.edits || {};
    const d = { id: 'd' + Date.now().toString(36), name: nm, base: name, stage: st, at: new Date().toISOString() };
    S.drafts.push(d); saveDrafts(); S.undo = []; S.redo = [];
    S.on = true; openDraft(d, true); status(`Editing a copy: "${nm}". ${base.name} itself stays as it is.`); return;
  }
  S.on = true; G.editDrive = true; G.onEditorBack = () => { S.driving = false; openDraft(S.draft, true); }; ui(); status(HINT[S.tool]);
}
function leave() { S.on = false; if (S.stroke) endStroke(); S.drag = S.sel = null; if (S.cursor) S.cursor.visible = false; clearMarks(); G.editDrive = false; G.onEditorBack = null; ui(); }
function rename() {
  if (!S.draft) return; const nm = prompt('Name this track', S.draft.name.replace(/^✎ /, '')); if (!nm) return;
  S.draft.name = S.draft.stage.name = '✎ ' + nm.slice(0, 40); saveDrafts(); openDraft(S.draft, true);
}
function delDraft() {
  if (!S.draft || !confirm(`Delete the draft "${S.draft.name}"? This can't be undone.`)) return;
  const base = STAGES.findIndex(s => s.name === S.draft.base);
  S.drafts = S.drafts.filter(d => d !== S.draft); saveDrafts(); S.draft = null; leave(); openViewer(Math.max(0, base));
}
async function send() {
  if (!S.draft) return; const msg = $('st-msg').value.trim();
  const doc = { name: S.draft.name.replace(/^✎ /, ''), base: 'studio', from: S.draft.base, stage: S.draft.stage, message: msg, at: new Date().toISOString(), status: 'sent' };
  if (!S.db) { const txt = JSON.stringify(doc); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => status('Not connected to the shared database here: the track is copied, paste it to Claude.'), () => status('Not connected here: use the published game to send it.', true)); return; }
  try { await S.db.collection('tracks').doc('t' + Date.now().toString(36)).set(doc); $('st-msg').value = ''; $('st-sendform').hidden = true; status('Sent to Claude. Ask Claude to look at your track.'); }
  catch (err) { status('Could not send it (' + (err.code || 'error') + '); try again in a moment.', true); }
}
// the viewer's hooks: the stage picker lists the drafts; a pick opens one
function options(idx) {
  if (!S.drafts.length) return null;
  const cur = idx === S.slot && S.draft ? 'd:' + S.draft.id : null;
  return { skip: S.slot, value: cur, html: `<optgroup label="My tracks (Studio drafts)">${S.drafts.map(d => `<option value="d:${esc(d.id)}">${esc(d.name)}</option>`).join('')}</optgroup>` };
}
function pick(v) { const d = S.drafts.find(x => 'd:' + x.id === v); if (d) { S.undo = []; S.redo = []; openDraft(d); } }
function opened(idx) {
  if (idx !== S.slot || !S.draft) { if (S.on) leave(); $('vw-edit').hidden = false; $('vw-edit').textContent = 'Edit'; return; }
  S.built = clone((stage().edits || {}).sculpt || null); clearMarks(); S.path = null;
  { const tr = G.world.tr, N = tr.loopN || tr.N; let k = 0; for (let i = 0; i < N; i++) k = Math.max(k, Math.abs(tr.ks[i])); if (S.on && k > 1 / 9) status('The road turns very tightly somewhere: a hairpin under 9 m across. Cars may struggle there.', true); }
  if (S.on) { G.editDrive = true; G.onEditorBack = () => { S.driving = false; openDraft(S.draft, true); }; }   // Drive it comes back to the studio
  ui();
}
function closed() { if (!S.driving) { G.editDrive = false; G.onEditorBack = null; } if (S.cursor) S.cursor.visible = false; $('st').hidden = true; if (S.handles) S.handles.clear(); if (S.pmarks) S.pmarks.clear(); }
// ---------- the panel ----------
function setTool(t) { S.tool = t; S.sel = null; S.pt = -1; S.psel = -1; ui(); status(t === 'pieces' && !G.world.tr.loopN ? 'Set pieces go on circuits: this is a downhill run.' : HINT[t]); }
function ui() {
  const on = S.on && !!S.draft; drawHandles(); drawPieces();
  $('st').hidden = !on; $('vw-edit').textContent = on ? 'Done' : 'Edit'; $('vw-edit').classList.toggle('on', on);
  if (!on) return;
  document.querySelectorAll('#st [data-st]').forEach(b => b.classList.toggle('on', b.dataset.st === S.tool));
  $('st-brush').hidden = !['raise', 'lower', 'smooth', 'flatten', 'erase'].includes(S.tool); $('st-size').value = String(Math.round(S.size)); $('st-power').value = String(Math.round(S.power * 10));
  $('st-palette').hidden = S.tool !== 'place'; document.querySelectorAll('#st-palette [data-kind]').forEach(b => b.classList.toggle('on', b.dataset.kind === S.kind));
  const rp = S.tool === 'road' && S.pt >= 0, pp = S.tool === 'pieces' && S.psel >= 0 && !!(edits().pieces || [])[S.psel];
  $('st-pieces').hidden = S.tool !== 'pieces'; document.querySelectorAll('#st-pieces [data-piece]').forEach(b => b.classList.toggle('on', b.dataset.piece === S.piece));
  $('st-sel').hidden = !S.sel && !rp && !pp;
  if (pp) { const q = edits().pieces[S.psel], P = PIECES[q.k]; $('st-selname').textContent = `${P.name}, ${q.len || P.len} m, ${((q.s - G.world.tr.startIdx) % G.world.tr.loopN + G.world.tr.loopN) % G.world.tr.loopN} m round the lap`; } if (S.sel) $('st-selname').textContent = KIND_NAME[S.sel.o.k || S.sel.o.type] || 'Selected';
  if (rp) $('st-selname').textContent = `Road point ${S.pt + 1}` + (roadPath().pts[S.pt][2] ? ` (road ${roadPath().pts[S.pt][2] > 0 ? 'up' : 'down'} ${Math.abs(roadPath().pts[S.pt][2])} m)` : '');
  $('st-rotl').hidden = $('st-rotr').hidden = rp || pp; $('st-smaller').textContent = rp ? 'Road down' : pp ? 'Shorter' : '\u2212'; $('st-bigger').textContent = rp ? 'Road up' : pp ? 'Longer' : '+'; $('st-del').textContent = rp ? 'Delete point' : 'Delete'; $('st-start').hidden = !rp || !roadPath().closed || S.pt === 0;
  drawHandles();
  $('st-undo').disabled = !S.undo.length; $('st-redo').disabled = !S.redo.length;
  $('st-name').textContent = S.draft.name;
}
function status(t, bad = false) { const el = $('st-status'); el.textContent = t; el.classList.toggle('bad', bad); }
// ---------- changes: undo, redo, rebuild ----------
function remember() { S.undo.push(JSON.stringify(stage().edits || {})); if (S.undo.length > 60) S.undo.shift(); S.redo = []; }
function undo() { if (!S.undo.length) return; S.redo.push(JSON.stringify(stage().edits || {})); stage().edits = JSON.parse(S.undo.pop()); S.sel = null; changed(0); }
function redo() { if (!S.redo.length) return; S.undo.push(JSON.stringify(stage().edits || {})); stage().edits = JSON.parse(S.redo.pop()); S.sel = null; changed(0); }
/** The draft changed: keep it, and rebuild the stage from it in a moment (another change in the meantime waits for it). */
function changed(ms = 350) {
  if (!S.stroke && !S.drag) {   // a change that won't build (a building left on the road, a road that can't be laid) is taken back
    try { buildTrack(clone(stage())); } catch (err) { if (S.undo.length) stage().edits = JSON.parse(S.undo.pop()); status('That won\'t work: ' + err.message.replace(/^[^:]*: /, ''), true); S.sel = null; S.pt = -1; ui(); return; }
  }
  S.draft.at = new Date().toISOString(); saveDrafts(); ui();
  clearTimeout(S.timer); S.timer = setTimeout(() => { if (S.stroke || S.drag) { changed(ms); return; } forgetTrack(S.slot); G.forceBuild = true; openViewer(S.slot, { keep: true }); }, ms);
}
// ---------- pointers (the viewer passes on the ones the studio wants) ----------
function want(e) { return S.on && !!S.draft && S.tool !== 'view' && e.button === 0 && !e.shiftKey; }
function down(e) {
  const p = pickGround(e.clientX, e.clientY); if (!p) return;
  cursorAt(p);
  if (S.tool === 'road') { roadDown(e, p); return; }
  if (S.tool === 'pieces') { pieceDown(p); return; }
  if (S.tool === 'place') {
    const hit = hitTest(p);
    if (hit) { S.sel = hit; S.drag = { hit, moved: false }; ui(); return; }
    S.sel = null; placeAt(p); return;
  }
  remember();
  S.stroke = { last: p, to: p.y, held: setInterval(() => { if (S.stroke && S.tool !== 'erase') dab(S.stroke.last); }, 70) }; dab(p);   // held still, the brush keeps working (a mountain)
}
function move(e) {
  const p = pickGround(e.clientX, e.clientY); if (!p) return;
  cursorAt(p);
  if (S.drag && S.drag.pt !== undefined) { roadMove(p); return; }
  if (S.pdrag) { pieceMove(p); return; }
  if (S.drag) {
    if (!S.drag.moved) { remember(); S.drag.moved = true; }
    S.drag.hit.o.x = Math.round(p.x * 10) / 10; S.drag.hit.o.z = Math.round(p.z * 10) / 10; mark(S.drag.hit.o); return;
  }
  if (!S.stroke) return;
  const L = S.stroke.last, d = Math.hypot(p.x - L.x, p.z - L.z), step = Math.max(1.5, S.size * 0.25);
  if (d < step) return;
  for (let t = step; t <= d; t += step) dab({ x: L.x + (p.x - L.x) * t / d, z: L.z + (p.z - L.z) * t / d });
  S.stroke.last = p;
}
function up() {
  if (S.pdrag) { const m = S.pdrag.moved; S.pdrag = null; if (m) changed(); ui(); return; }
  if (S.drag && S.drag.pt !== undefined) { const m = S.drag.moved; S.drag = null; if (m) changed(); ui(); return; }
  if (S.drag) { const moved = S.drag.moved, h = S.drag.hit; S.drag = null; if (moved) { if (h.house && onRoad(h.o)) { status('That puts it on the road: moved back.', true); undo(); return; } changed(); } ui(); return; }
  if (S.stroke) { endStroke(); changed(); }
}
function endStroke() { clearInterval(S.stroke.held); S.stroke = null; }
function cancel() { if (S.stroke) { endStroke(); changed(); } if (S.drag) { S.drag = null; changed(); } }
function hover(e) { if (!S.on || S.tool === 'view' || S.tool === 'place' || S.tool === 'road' || S.tool === 'pieces') { if (S.cursor) S.cursor.visible = false; return; } const p = pickGround(e.clientX, e.clientY); if (p) cursorAt(p); }
// ---------- brushes ----------
function dab(p) {
  const E = edits(), r = S.size;
  if (S.tool === 'erase') {
    (E.clears || (E.clears = [])).push([Math.round(p.x * 10) / 10, Math.round(p.z * 10) / 10, Math.round(r * 10) / 10]);
    if (E.props) E.props = E.props.filter(o => Math.hypot(o.x - p.x, o.z - p.z) > r);
    if (E.houses) E.houses = E.houses.filter(o => Math.hypot(o.x - p.x, o.z - p.z) > r);
    return;
  }
  const sc = E.sculpt || (E.sculpt = { cell: 4, d: {} }), terr = G.world.terr, built = S.built;
  const base = (x, z) => terr.at(x, z) - sculptAt(built, x, z);
  // the ground mesh moves with the brush straight away (the rebuild afterwards does it properly, the road included)
  const pts = []; const R = r + 8;
  G.world.terrainMesh.traverse(o => { if (!o.isMesh) return; const a = o.geometry.attributes.position.array; for (let i = 0; i < a.length; i += 3) if (Math.abs(a[i] - p.x) < R && Math.abs(a[i + 2] - p.z) < R) pts.push([o.geometry, i, sculptAt(sc, a[i], a[i + 2])]); });
  sculptDab(sc, S.tool, p.x, p.z, r, S.power, base, S.stroke ? S.stroke.to : 0);
  const geos = new Set();
  for (const [g, i, before] of pts) { const a = g.attributes.position.array; a[i + 1] += sculptAt(sc, a[i], a[i + 2]) - before; geos.add(g); }
  for (const g of geos) g.attributes.position.needsUpdate = true;
}
// ---------- placing ----------
function onRoad(o) {
  const tr = G.world.tr, T = BUILDINGS[o.type], b = { x: o.x, z: o.z, f: (o.f || 0) * Math.PI / 180, w: T.w, d: T.d };
  return corners(b).concat([[o.x, o.z]]).some(([x, z]) => { const q = tr.nearest(x, z); return q && q.d < HALF + 0.5; });
}
function placeAt(p) {
  const E = edits(), x = Math.round(p.x * 10) / 10, z = Math.round(p.z * 10) / 10;
  if (BUILDINGS[S.kind]) {
    const tr = G.world.tr, q = tr.nearest(x, z), f = q ? Math.round(Math.atan2(tr.xs[q.i] - x, tr.zs[q.i] - z) * 180 / Math.PI) : 0;   // the front faces the road
    const o = { type: S.kind, x, z, f };
    if (onRoad(o)) { status('Too close to the road: buildings go beside it (tap further off).', true); return; }
    remember(); (E.houses || (E.houses = [])).push(o); S.sel = { o, house: true };
  } else {
    if (G.world.tr.nearest(x, z) && G.world.tr.nearest(x, z).d < HALF + 0.5) { status('That\'s on the road: scenery goes beside it.', true); return; }
    remember(); const o = { k: S.kind, x, z, s: 1, ry: Math.round(Math.random() * 628) / 100 }; (E.props || (E.props = [])).push(o); S.sel = { o, house: false };
  }
  mark(S.sel.o); status(`${KIND_NAME[S.kind]} put there. Tap it to turn it or size it; tap the ground for another.`); changed();
}
function hitTest(p) {
  const E = edits();
  for (const o of (E.houses || []).slice().reverse()) { const T = BUILDINGS[o.type], f = (o.f || 0) * Math.PI / 180, dx = p.x - o.x, dz = p.z - o.z, u = dx * Math.sin(f) + dz * Math.cos(f), v = dx * Math.cos(f) - dz * Math.sin(f); if (Math.abs(u) < T.d / 2 + 1 && Math.abs(v) < T.w / 2 + 1) return { o, house: true }; }
  let best = null, bd = Infinity; for (const o of E.props || []) { const d = Math.hypot(o.x - p.x, o.z - p.z); if (d < Math.max(2.5, 1.6 * (o.s || 1) * (o.k === 'boulder' ? 2.6 : 1)) && d < bd) { bd = d; best = { o, house: false }; } }
  return best;
}
function turnSel(deg) { if (!S.sel) return; remember(); const o = S.sel.o; if (S.sel.house) { o.f = ((o.f || 0) + deg + 360) % 360; if (onRoad(o)) { undo(); status('Turned that way it would stand on the road.', true); return; } } else o.ry = Math.round(((o.ry || 0) + deg * Math.PI / 180) * 100) / 100; changed(); }
function sizeSel(k) { if (S.tool === 'road' && S.pt >= 0) { liftPt(k > 1 ? 1 : -1); return; } if (S.tool === 'pieces' && S.psel >= 0) { lenPiece(k > 1 ? 10 : -10); return; } if (!S.sel || S.sel.house) return; remember(); S.sel.o.s = Math.round(Math.max(0.4, Math.min(3, (S.sel.o.s || 1) * k)) * 100) / 100; changed(); }
function delSel() { if (S.tool === 'road' && S.pt >= 0) { delPt(); return; } if (S.tool === 'pieces' && S.psel >= 0) { remember(); edits().pieces.splice(S.psel, 1); S.psel = -1; changed(); return; } if (!S.sel) return; remember(); const E = edits(), o = S.sel.o; E.props = (E.props || []).filter(x => x !== o); E.houses = (E.houses || []).filter(x => x !== o); S.sel = null; changed(); }
// ---------- what's drawn for the studio: the brush ring, and a marker on a change until the rebuild shows it ----------
function cursorAt(p) {
  if (!S.cursor) {
    S.cursor = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xFFC72C, transparent: true, opacity: 0.9, depthTest: false }));
    S.cursor.renderOrder = 21; scene.add(S.cursor);
  }
  const r = S.tool === 'place' ? 2 : S.size; S.cursor.visible = S.on && S.tool !== 'view'; S.cursor.scale.set(r, 1, r); S.cursor.position.set(p.x, p.y + 0.4, p.z);
  S.cursor.material.color.set(S.tool === 'lower' ? 0x4AA8E8 : S.tool === 'erase' ? 0xFF6A5A : S.tool === 'smooth' || S.tool === 'flatten' ? 0xFFFFFF : 0xFFC72C);
}
function mark(o) {
  if (!S.marks) { S.marks = new THREE.Group(); scene.add(S.marks); }
  let m = S.marks.children.find(c => c.userData.o === o);
  if (!m) { const T = BUILDINGS[o.type]; m = new THREE.Mesh(T ? new THREE.BoxGeometry(T.w, 3 * T.floors, T.d) : new THREE.ConeGeometry(1.2 * (o.s || 1), 4 * (o.s || 1), 8), new THREE.MeshBasicMaterial({ color: 0xFFC72C, transparent: true, opacity: 0.45 })); m.userData.o = o; S.marks.add(m); }
  const y = G.world.terr.at(o.x, o.z); m.position.set(o.x, y + (BUILDINGS[o.type] ? 1.5 * BUILDINGS[o.type].floors : 2 * (o.s || 1)), o.z); m.rotation.y = BUILDINGS[o.type] ? (o.f || 0) * Math.PI / 180 : 0;
}
function clearMarks() { if (!S.marks) return; for (const m of S.marks.children.slice()) { S.marks.remove(m); m.geometry.dispose(); m.material.dispose(); } }
// ---------- the road (core/track/path.js) ----------
/** The draft's road points: its own once it has been changed, else a fresh set from the road as built (not kept until it changes). */
function roadPath() { const E = edits(); return E.path || S.path || (S.path = pathFromTrack(G.world.tr)); }
function keepPath() { const E = edits(); if (!E.path) E.path = clone(roadPath()); return E.path; }
const _v = new THREE.Vector3();
function ptY(q) { const tr = G.world.tr, n = tr.nearest(q[0], q[1]); return n && n.d < 8 ? tr.H[n.i] + 1.4 : G.world.terr.at(q[0], q[1]) + 1.4; }
function roadDown(e, p) {
  const P = roadPath().pts, W = innerWidth, H = innerHeight; let best = -1, bd = 26;
  P.forEach((q, k) => { _v.set(q[0], ptY(q), q[1]).project(pcamera); if (_v.z > 1) return; const d = Math.hypot((_v.x + 1) / 2 * W - e.clientX, (1 - _v.y) / 2 * H - e.clientY); if (d < bd) { bd = d; best = k; } });
  if (best >= 0) { S.pt = best; S.drag = { pt: best, moved: false }; ui(); return; }
  // on the road between two points: a new point there
  const path = roadPath(), sp = samplePath(path); let bj = -1, bdist = 10;
  for (let j = 0; j < sp.xs.length; j += 2) { const d = Math.hypot(sp.xs[j] - p.x, sp.zs[j] - p.z); if (d < bdist) { bdist = d; bj = j; } }
  if (bj < 0) { S.pt = -1; ui(); status('Tap a yellow point, or the road between two of them.'); return; }
  // which two points it lies between: the samples nearest each point, in order round the road
  const near = path.pts.map(q => { let b = 0, d0 = Infinity; for (let j = 0; j < sp.xs.length; j += 2) { const d = (sp.xs[j] - q[0]) ** 2 + (sp.zs[j] - q[1]) ** 2; if (d < d0) { d0 = d; b = j; } } return b; });
  let k = near.findIndex(j => j > bj); if (k < 0) k = path.pts.length;
  remember(); const E = keepPath(); E.pts.splice(k, 0, [Math.round(p.x * 10) / 10, Math.round(p.z * 10) / 10, 0]);
  S.pt = k; S.drag = { pt: k, moved: true }; ui();
}
function roadMove(p) {
  if (!S.drag.moved) { remember(); S.drag.moved = true; }
  const E = keepPath(), q = E.pts[S.drag.pt]; q[0] = Math.round(p.x * 10) / 10; q[1] = Math.round(p.z * 10) / 10; drawHandles();
}
function liftPt(d) { remember(); const q = keepPath().pts[S.pt]; q[2] = Math.max(-12, Math.min(12, (q[2] || 0) + d)); changed(); }
function delPt() {
  const P = roadPath(); if (P.pts.length <= (P.closed ? 4 : 2)) { status('A road needs at least ' + (P.closed ? 4 : 2) + ' points.', true); return; }
  remember(); keepPath().pts.splice(S.pt, 1); S.pt = -1; changed();
}
/** The lap starts at the picked point (the start line is a little after the first point: the big one). */
function startHere() { remember(); const E = keepPath(); E.pts = E.pts.slice(S.pt).concat(E.pts.slice(0, S.pt)); S.pt = 0; changed(); }
/** The points and the line through them, while the Road tool is out. */
function drawHandles() {
  const show = S.on && S.tool === 'road' && !!G.world;
  if (!S.handles) { S.handles = new THREE.Group(); scene.add(S.handles); }
  for (const c of S.handles.children.slice()) { S.handles.remove(c); c.geometry.dispose(); }
  if (!show) return;
  // the line the road will take: a thin ribbon over the ground (a GL line is a hair wide)
  const P = roadPath(), terr = G.world.terr, sp = samplePath(P), pos = [], idx = [], n = sp.xs.length;
  for (let j = 0; j < n; j += 2) {
    const a = Math.max(0, j - 2), b = Math.min(n - 1, j + 2), tx = sp.xs[b] - sp.xs[a], tz = sp.zs[b] - sp.zs[a], l = Math.hypot(tx, tz) || 1, w = Math.max(0.5, viewerState.dist * 0.004);
    const near = G.world.tr.nearest(sp.xs[j], sp.zs[j]), y = (near && near.d < 6 ? G.world.tr.H[near.i] : terr.at(sp.xs[j], sp.zs[j])) + 0.9;
    pos.push(sp.xs[j] - tz / l * w, y, sp.zs[j] + tx / l * w, sp.xs[j] + tz / l * w, y, sp.zs[j] - tx / l * w);
    const v = pos.length / 3 - 2; if (v >= 2) idx.push(v - 2, v - 1, v, v - 1, v + 1, v);
  }
  if (P.closed && pos.length > 6) { const v = pos.length / 3 - 2; idx.push(v, v + 1, 0, v + 1, 1, 0); }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); lg.setIndex(idx);
  if (!S.lineM) { S.lineM = new THREE.MeshBasicMaterial({ color: 0xFFC72C, depthTest: false, transparent: true, opacity: 0.75, side: THREE.DoubleSide }); S.dotM = new THREE.MeshBasicMaterial({ color: 0xFFC72C, depthTest: false }); S.dotSel = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, depthTest: false }); S.dotG = new THREE.SphereGeometry(1, 12, 8); }
  const line = new THREE.Mesh(lg, S.lineM); line.renderOrder = 22; S.handles.add(line);
  const sz = Math.max(0.9, viewerState.dist * 0.009);
  P.pts.forEach((q, k) => { const m = new THREE.Mesh(S.dotG.clone(), k === S.pt ? S.dotSel : S.dotM); m.scale.setScalar(k === 0 ? sz * 1.4 : sz); m.position.set(q[0], ptY(q), q[1]); m.renderOrder = 23; S.handles.add(m); });
}
// ---------- set pieces (core/track/pieces.js) ----------
/** The base sample of the road nearest (x, z) on a circuit, within 12 m of it (a finger's width at a distance), or -1. */
function roadSample(p) { const tr = G.world.tr; if (!tr.loopN) return -1; const q = tr.nearest(p.x, p.z); return q && q.d < 12 ? tr.bi(q.i) : -1; }
function pieceDown(p) {
  if (!G.world.tr.loopN) { status('Set pieces go on circuits: this is a downhill run.', true); return; }
  const b = roadSample(p); if (b < 0) { S.psel = -1; ui(); status('Tap the road to put a set piece on it.'); return; }
  const L = edits().pieces || [], hit = L.findIndex(q => b >= q.s - 4 && b <= q.s + (q.len || PIECES[q.k].len) + 4);
  if (hit >= 0) { S.psel = hit; S.pdrag = { off: b - L[hit].s, moved: false }; ui(); return; }
  remember(); const E = edits(); (E.pieces || (E.pieces = [])).push({ s: b, k: S.piece }); S.psel = E.pieces.length - 1;
  status(`${PIECES[S.piece].name} put on the road. Tap it to make it longer or shorter, drag it to move it.`); changed();
}
function pieceMove(p) {
  const b = roadSample(p); if (b < 0) return;
  if (!S.pdrag.moved) { remember(); S.pdrag.moved = true; }
  const q = edits().pieces[S.psel]; q.s = Math.max(0, b - S.pdrag.off); drawPieces();
}
function lenPiece(d) { const q = edits().pieces[S.psel]; remember(); q.len = Math.max(10, Math.min(300, (q.len || PIECES[q.k].len) + d)); changed(); }
/** Each set piece as a coloured stretch over the road, while the Pieces tool is out. */
function drawPieces() {
  if (!S.pmarks) { S.pmarks = new THREE.Group(); scene.add(S.pmarks); }
  for (const c of S.pmarks.children.slice()) { S.pmarks.remove(c); c.geometry.dispose(); c.material.dispose(); }
  if (!(S.on && S.tool === 'pieces' && G.world && G.world.tr.loopN)) return;
  const tr = G.world.tr, N = tr.loopN;
  (edits().pieces || []).forEach((q, n) => {
    const P = PIECES[q.k]; if (!P) return; const len = q.len || P.len, pos = [], idx = [];
    for (let i = q.s; i <= q.s + len; i += 2) { const k = i % N, w = 3.2; pos.push(tr.xs[k] - tr.rx[k] * w, tr.H[k] + 0.6, tr.zs[k] - tr.rz[k] * w, tr.xs[k] + tr.rx[k] * w, tr.H[k] + 0.6, tr.zs[k] + tr.rz[k] * w); const v = pos.length / 3 - 2; if (v >= 2) idx.push(v - 2, v - 1, v, v - 1, v + 1, v); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: P.color, transparent: true, opacity: n === S.psel ? 0.85 : 0.55, depthTest: false, side: THREE.DoubleSide })); m.renderOrder = 22; S.pmarks.add(m);
  });
}
// ---------- New track (core/track/generate.js) ----------
function generate() {
  const look = STAGES.find(s => s.name === LOOKS[$('st-gen-look').value]) || STAGES[0], seed = 1 + Math.floor(Math.random() * 9999);
  status('Making a track...'); $('st-gen-go').disabled = true;
  setTimeout(() => {
    let st = null; try { st = generateStage({ style: $('st-gen-style').value, length: $('st-gen-len').value, surface: $('st-gen-surf').value, look, seed, name: 'New track' }); } catch (e) { console.error(e); }
    $('st-gen-go').disabled = false;
    if (!st) { status('That landscape didn\'t take a road this time: try again, or another style.', true); return; }
    let n = 1, nm = '\u270E New track'; while (S.drafts.some(d => d.name === nm)) nm = `\u270E New track ${++n}`; st.name = nm;
    const d = { id: 'd' + Date.now().toString(36), name: nm, base: look.name, stage: st, at: new Date().toISOString(), made: 'generated' };
    S.drafts.push(d); saveDrafts(); S.undo = []; S.redo = []; $('st-gen').hidden = true;
    S.on = true; openDraft(d); status(`A new track: ${LAND_STYLES[$('st-gen-style').value]} with ${st.edits.pieces.length} set pieces${st.edits.houses.length ? ' and houses to smash' : ''}. Edit away.`);
  }, 30);
}
