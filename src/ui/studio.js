import * as THREE from 'three';
import { G } from '../game.js';
import { STAGES } from '../data/stages/index.js';
import { BUILDINGS, BUILDING_TYPES } from '../data/structures.js';
import { HALF } from '../core/constants.js';
import { corners } from '../core/elements/structures.js';
import { PROPS, sculptAt, sculptDab } from '../core/track/edits.js';
import { pickGround } from '../render/notepins.js';
import { scene } from '../render/renderer.js';
import { forgetTrack } from '../render/world/index.js';
import { $ } from './dom.js';
import { openViewer, setEditHooks, viewerState } from './viewer.js';

// The Track Studio: the Track viewer's Edit mode. Edit makes a copy of the stage on show (a draft: the stage itself is
// never touched) and the tools change it in place, in 3D:
//   Raise / Lower / Smooth / Flatten   brush the land (and the road over it: a hump, a jump, a dip), live as you drag
//   Place                             tap the ground to put a tree, a bush, a rock or a building there (the palette);
//                                     tap one you put there to turn it, size it or delete it, drag it to move it
//   Erase                             brush away scenery: the stage's own trees and rocks, and anything put there
// Each change is data on the draft (stage.edits: core/track/edits.js), so the stage is rebuilt from it a moment after
// you let go and the report card follows. Undo / Redo, Test drive (Drive it) comes back here; drafts are kept in this
// browser and listed under the stage picker; Send to Claude puts one in the shared `tracks` collection (base "studio").
// Getting about is the viewer's: two fingers, right-drag or the View tool move the camera while a brush is picked.
const LS = 'downhill-rush-studio', TOOLS = ['view', 'raise', 'lower', 'smooth', 'flatten', 'place', 'erase'];
const HINT = { view: 'Move the view: drag, two fingers, wheel', raise: 'Drag to raise the land: under the road it lifts the road (a hump, a jump)', lower: 'Drag to dig the land down: dips, hollows, drops',
  smooth: 'Drag to smooth out bumps and steps', flatten: 'Drag to level the land at the height where you started', place: 'Tap the ground to put the picked thing there; tap one of yours to change it, drag it to move it',
  erase: 'Drag over trees, bushes and rocks to take them away' };
const S = { on: false, tool: 'raise', size: 14, power: 0.5, kind: 'pine', drafts: [], draft: null, slot: -1, undo: [], redo: [], stroke: null, sel: null, drag: null, built: null, timer: 0, cursor: null, marks: null, driving: false, db: null };
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
  $('st-undo').addEventListener('click', undo); $('st-redo').addEventListener('click', redo);
  $('st-rotl').addEventListener('click', () => turnSel(-15)); $('st-rotr').addEventListener('click', () => turnSel(15));
  $('st-smaller').addEventListener('click', () => sizeSel(1 / 1.2)); $('st-bigger').addEventListener('click', () => sizeSel(1.2));
  $('st-del').addEventListener('click', delSel);
  $('st-rename').addEventListener('click', rename); $('st-delete').addEventListener('click', delDraft);
  $('st-send').addEventListener('click', () => { $('st-sendform').hidden = !$('st-sendform').hidden; });
  $('st-sendgo').addEventListener('click', send);
  $('vw-drive').addEventListener('click', () => { if (S.on) S.driving = true; }, true);   // (before the viewer's own: a test drive comes back here)
  addEventListener('keydown', e => {
    if (!S.on || $('viewer').hidden || (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))) return;
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyZ') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyY') { e.preventDefault(); redo(); }
    else if (/^Digit[1-7]$/.test(e.code)) setTool(TOOLS[+e.code.slice(5) - 1]);
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
  S.built = clone((stage().edits || {}).sculpt || null); clearMarks();
  if (S.on) { G.editDrive = true; G.onEditorBack = () => { S.driving = false; openDraft(S.draft, true); }; }   // Drive it comes back to the studio
  ui();
}
function closed() { if (!S.driving) { G.editDrive = false; G.onEditorBack = null; } if (S.cursor) S.cursor.visible = false; $('st').hidden = true; }
// ---------- the panel ----------
function setTool(t) { S.tool = t; S.sel = null; ui(); status(HINT[t]); }
function ui() {
  const on = S.on && !!S.draft;
  $('st').hidden = !on; $('vw-edit').textContent = on ? 'Done' : 'Edit'; $('vw-edit').classList.toggle('on', on);
  if (!on) return;
  document.querySelectorAll('#st [data-st]').forEach(b => b.classList.toggle('on', b.dataset.st === S.tool));
  $('st-brush').hidden = !['raise', 'lower', 'smooth', 'flatten', 'erase'].includes(S.tool); $('st-size').value = String(Math.round(S.size)); $('st-power').value = String(Math.round(S.power * 10));
  $('st-palette').hidden = S.tool !== 'place'; document.querySelectorAll('#st-palette [data-kind]').forEach(b => b.classList.toggle('on', b.dataset.kind === S.kind));
  $('st-sel').hidden = !S.sel; if (S.sel) $('st-selname').textContent = KIND_NAME[S.sel.o.k || S.sel.o.type] || 'Selected';
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
  S.draft.at = new Date().toISOString(); saveDrafts(); ui();
  clearTimeout(S.timer); S.timer = setTimeout(() => { if (S.stroke || S.drag) { changed(ms); return; } forgetTrack(S.slot); G.forceBuild = true; openViewer(S.slot, { keep: true }); }, ms);
}
// ---------- pointers (the viewer passes on the ones the studio wants) ----------
function want(e) { return S.on && !!S.draft && S.tool !== 'view' && e.button === 0 && !e.shiftKey; }
function down(e) {
  const p = pickGround(e.clientX, e.clientY); if (!p) return;
  cursorAt(p);
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
  if (S.drag) { const moved = S.drag.moved, h = S.drag.hit; S.drag = null; if (moved) { if (h.house && onRoad(h.o)) { status('That puts it on the road: moved back.', true); undo(); return; } changed(); } ui(); return; }
  if (S.stroke) { endStroke(); changed(); }
}
function endStroke() { clearInterval(S.stroke.held); S.stroke = null; }
function cancel() { if (S.stroke) { endStroke(); changed(); } if (S.drag) { S.drag = null; changed(); } }
function hover(e) { if (!S.on || S.tool === 'view' || S.tool === 'place') { if (S.cursor) S.cursor.visible = false; return; } const p = pickGround(e.clientX, e.clientY); if (p) cursorAt(p); }
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
function sizeSel(k) { if (!S.sel || S.sel.house) return; remember(); S.sel.o.s = Math.round(Math.max(0.4, Math.min(3, (S.sel.o.s || 1) * k)) * 100) / 100; changed(); }
function delSel() { if (!S.sel) return; remember(); const E = edits(), o = S.sel.o; E.props = (E.props || []).filter(x => x !== o); E.houses = (E.houses || []).filter(x => x !== o); S.sel = null; changed(); }
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
