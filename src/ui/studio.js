import * as THREE from 'three';
import { G } from '../game.js';
import { STAGES } from '../data/stages/index.js';
import { BUILDINGS, BUILDING_TYPES } from '../data/structures.js';
import { HALF, ROAD_WIDTH } from '../core/constants.js';
import { corners } from '../core/elements/structures.js';
import { KIT_PIECES, PAINTS, PROPS, STREETS, editsDiff, paintDab, sculptAt, sculptDab } from '../core/track/edits.js';
import { pathFromTrack, samplePath } from '../core/track/path.js';
import { PIECES } from '../core/track/pieces.js';
import { generateStage } from '../core/track/generate.js';
import { LAND_STYLES } from '../core/track/ground.js';
import { LOOK_KEYS, THEMES, walledTown } from '../core/track/themes.js';
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
// Send to Claude shares the draft as a version (the `studio` collection, below); Claude's own versions come back as a
// banner (Take it), History lists every version.
//   Road                              the road's line as yellow points (core/track/path.js): drag one to move the road,
//                                     tap the road between them for another, tap one to lift or sink the road there
// Each change is data on the draft (stage.edits: core/track/edits.js), so the stage is rebuilt from it a moment after
// you let go and the report card follows. Undo / Redo, Test drive (Drive it) comes back here; drafts are kept in this
// browser and listed under the stage picker; Send to Claude puts one in the shared `tracks` collection (base "studio").
// Getting about is the viewer's: two fingers, right-drag or the View tool move the camera while a brush is picked.
const LS = 'downhill-rush-studio', TOOLS = ['view', 'raise', 'lower', 'smooth', 'flatten', 'paint', 'road', 'pieces', 'streets', 'place', 'walls', 'erase'];
const HINT = { view: 'Move the view: drag, two fingers, wheel', raise: 'Drag to raise the land: under the road it lifts the road (a hump, a jump)', lower: 'Drag to dig the land down: dips, hollows, drops',
  smooth: 'Drag to smooth out bumps and steps', flatten: 'Drag to level the land at the height where you started', place: 'Pick something (or a mix) and tap or drag on the ground: Count paints many at once. With Count 1, tap one of yours to turn, size or delete it, drag it to move it',
  erase: 'Drag over trees, bushes and rocks to take them away',
  paint: 'Pick a ground and brush it on: meadow, forest floor, dirt, sand, snow, tundra, rock, mud (off the road it drives like it: mud bogs you down, snow slides). Grass takes paint off',
  streets: 'Draw a street, lane, track or footpath off the road (cobbles or paving paint a square). Tap one to line it with houses or delete it',
  walls: 'Draw a line on the ground for a wall, hedge or fence; end it where you began to close a ring. Where it crosses the road it leaves a gap (a stone wall gets an arch). Tap a wall to delete its run',
  pieces: 'Pick a set piece, then tap the road to put it there; tap one to make it longer or shorter, drag it along the road to move it',
  road: 'Drag a yellow point to move the road; tap the road between points to add one; tap a point to raise, lower or delete it. Road width sets how wide the whole road is' };
const S = { on: false, tool: 'raise', size: 14, power: 0.5, kind: 'pine', drafts: [], draft: null, slot: -1, undo: [], redo: [], stroke: null, sel: null, drag: null, built: null, timer: 0, cursor: null, marks: null, driving: false, db: null, remote: new Map(), path: null, handles: null, pt: -1, paintKind: 'meadow', streetKind: 'street', ssel: -1, wallKind: 'wall', wline: null, brush: { count: 1, spread: 12, scale: 1, variety: 0.5, spacing: 4 }, eraseF: 'all', piece: 'yump', psel: -1, pdrag: null, pmarks: null };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const clone = o => JSON.parse(JSON.stringify(o));
const stage = () => S.draft && S.draft.stage, edits = () => { const st = stage(); return st.edits || (st.edits = {}); };
// what the asset brush puts down: scenery (PROPS), buildings, street pieces, and mixes of them (kind: weight)
const STREET = Object.keys(KIT_PIECES).filter(k => !KIT_PIECES[k].len);
const MIXES = {
  forest: { name: 'Pine forest', mix: { pine: 6, fir: 3, bush: 1 } }, woods: { name: 'Woodland', mix: { tree: 5, autumn: 1, bush: 3 } }, autumnwood: { name: 'Autumn wood', mix: { autumn: 5, tree: 2, bush: 2 } },
  orchard: { name: 'Blossom', mix: { blossom: 4, tree: 1, bush: 1 } }, rocky: { name: 'Rocky ground', mix: { rock: 5, boulder: 2, bush: 1 } }, desert: { name: 'Desert scrub', mix: { cactus: 3, rock: 2, bush: 1 } },
  village: { name: 'Village', mix: { cottage: 3, house: 2, shed: 1 } }, town: { name: 'Town', mix: { house: 2, terrace: 2, shop: 1, flats: 1 } }, farm: { name: 'Farm', mix: { barn: 1, shed: 2, hay: 2 } },
  streetset: { name: 'Street furniture', mix: { post: 2, bin: 1, bench: 1, postbox: 1 } }, castle: { name: 'Castle town', mix: { cottage: 3, tavern: 2, stall: 2, house: 1 } },
};
const KIND_NAME = { ...PROPS, ...Object.fromEntries(BUILDING_TYPES.map(t => [t, BUILDINGS[t].name])), ...Object.fromEntries(STREET.map(k => [k, KIT_PIECES[k].name])), ...Object.fromEntries(Object.entries(MIXES).map(([k, m]) => ['mix:' + k, m.name])), 'stamp:walledtown': 'Walled town (tap the road)' };
const catOf = k => PROPS[k] ? 'prop' : BUILDINGS[k] ? 'house' : KIT_PIECES[k] ? 'kit' : null;

export function initStudio() {
  try { S.drafts = JSON.parse(localStorage.getItem(LS) || '[]') || []; } catch (e) { S.drafts = []; }
  $('vw-edit').addEventListener('click', () => S.on ? leave() : enter());
  document.querySelectorAll('#st [data-st]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.st)));
  palette();
  $('st-theme').innerHTML = '<option value="">Theme: the stage\'s own</option>' + Object.entries(THEMES).map(([k, T]) => `<option value="${k}">Theme: ${esc(T.name)}</option>`).join('');
  $('st-theme').addEventListener('change', e => applyTheme(e.target.value));
  for (const [id, key, f] of [['st-acount', 'count', v => v], ['st-aspread', 'spread', v => v], ['st-asize', 'scale', v => v / 10], ['st-avar', 'variety', v => v / 10], ['st-aspace', 'spacing', v => v]]) $(id).addEventListener('input', e => { S.brush[key] = f(+e.target.value); ui(); });
  $('st-erasef').addEventListener('change', e => { S.eraseF = e.target.value; });
  $('st-paints').innerHTML = Object.entries(PAINTS).concat([['grass', { name: 'Grass (no paint)', col: 0x6E9E4B }]]).map(([k, P]) => `<button type="button" data-paint="${k}"><i style="background:#${(P.col || (k === 'dirt' ? 0x8F7352 : 0x8E8C84)).toString(16).padStart(6, '0')}"></i>${esc(P.name)}</button>`).join('');
  $('st-paints').addEventListener('click', e => { const b = e.target.closest('[data-paint]'); if (b) { S.paintKind = b.dataset.paint; ui(); } });
  $('st-streetkind').innerHTML = Object.entries(STREETS).map(([k, P]) => `<option value="${k}">${esc(P.name)} (${P.w} m)</option>`).join(''); $('st-streetkind').value = 'street';
  $('st-streetkind').addEventListener('change', e => { S.streetKind = e.target.value; });
  $('st-line').addEventListener('click', lineStreet); $('st-sdel').addEventListener('click', () => { if (S.ssel < 0) return; remember(); edits().streets.splice(S.ssel, 1); S.ssel = -1; changed(); });
  $('st-roadw').addEventListener('input', e => { $('st-roadw-read').textContent = e.target.value + ' m'; });
  $('st-roadw').addEventListener('change', e => { const v = +e.target.value; remember(); if (v === ROAD_WIDTH) delete stage().width; else stage().width = v; status(`The road is ${v} m wide now${v < ROAD_WIDTH ? ': tighter racing, harder to pass' : v > ROAD_WIDTH ? ': room to race side by side' : ''}.`); changed(0); });
  $('st-wallkind').innerHTML = Object.entries(KIT_PIECES).filter(([, P]) => P.len).map(([k, P]) => `<option value="${k}">${esc(P.name)}</option>`).join('');
  $('st-wallkind').addEventListener('change', e => { S.wallKind = e.target.value; });
  $('st-palette').addEventListener('click', e => { const b = e.target.closest('[data-kind]'); if (b) { S.kind = b.dataset.kind; S.sel = null; ui(); } });
  $('st-size').addEventListener('input', e => { S.size = +e.target.value; });
  $('st-power').addEventListener('input', e => { S.power = +e.target.value / 10; });
  $('st-pieces').innerHTML = Object.entries(PIECES).map(([k, P]) => `<button type="button" data-piece="${k}"><i style="background:${P.color}"></i>${esc(P.name)}</button>`).join('');
  $('st-pieces').addEventListener('click', e => { const b = e.target.closest('[data-piece]'); if (b) { S.piece = b.dataset.piece; S.psel = -1; ui(); } });
  $('vw-new').addEventListener('click', () => { $('st-gen').hidden = !$('st-gen').hidden; });
  $('st-gen-style').innerHTML = Object.entries(LAND_STYLES).map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('');
  $('st-gen-look').innerHTML = Object.entries(THEMES).map(([k, T]) => `<option value="${k}">${esc(T.name)}</option>`).join('');
  $('st-gen-look').addEventListener('change', e => { const T = THEMES[e.target.value]; $('st-gen-style').value = T.land; $('st-gen-surf').value = T.surface; });
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
    else if (/^Digit[0-9]$/.test(e.code) && !e.altKey) setTool(TOOLS[(+e.code.slice(5) + 9) % 10]);
    else if (e.code === 'BracketLeft') { S.size = Math.max(4, S.size / 1.25); ui(); } else if (e.code === 'BracketRight') { S.size = Math.min(80, S.size * 1.25); ui(); }
    else if ((e.code === 'Delete' || e.code === 'Backspace') && S.sel) delSel();
  });
  if (window.claude && window.claude.use) window.claude.use('db').then(d => {
    if (!d) return; S.db = d;
    d.collection('studio').onSnapshot(q => { S.remote = new Map(q.docs.map(x => [x.id, x.data()])); syncRemote(); }, () => { });
  });
  $('st-take').addEventListener('click', takeClaude); $('st-leave').addEventListener('click', () => { $('st-claude').hidden = true; });
  $('st-hist').addEventListener('click', history);
  $('st-history').addEventListener('click', e => { const b = e.target.closest('[data-ver]'); if (b) openVersion(+b.dataset.ver); });
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
// ---------- sharing with Claude: the `studio` collection ----------
// studio/<draft id> = { name, base, v, by: 'you' | 'claude', at, note, changes, status } is the draft's latest version;
// studioVersions/<id>-<v> = { draft, v, by, at, note, changes, stage | asset } holds each version whole (a stage over
// ~200 KB goes up as a JSON asset). Send writes the next version; Claude answers with one of its own (by: 'claude'),
// which shows here as a banner to take or leave; History lists them all. Drafts made on another device turn up too.
const big = st => JSON.stringify(st).length > 200000;
async function send() {
  if (!S.draft) return; const d = S.draft, msg = $('st-msg').value.trim();
  if (!S.db) { const txt = JSON.stringify({ name: d.name, from: d.base, stage: d.stage, message: msg }); (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => status('Not connected to the shared database here: the track is copied, paste it to Claude.'), () => status('Not connected here: use the published game to send it.', true)); return; }
  const R = S.remote.get(d.id), v = Math.max(d.v || 0, (R && R.v) || 0) + 1, at = new Date().toISOString(), changes = d.shared ? editsDiff(d.shared, d.stage) : ['a new track'];
  try {
    const ver = { draft: d.id, v, by: 'you', at, note: msg, changes };
    if (big(d.stage)) { const a = await window.claude.use('assets'); if (!a) throw { code: 'too big to send here' }; ver.asset = (await a.upload(new Blob([JSON.stringify(d.stage)], { type: 'application/json' }))).id; } else ver.stage = d.stage;
    await S.db.doc(`studioVersions/${d.id}-${v}`).set(ver);
    await S.db.doc(`studio/${d.id}`).set({ name: d.name.replace(/^✎ /, ''), base: d.base, v, by: 'you', at, note: msg, changes, status: 'sent' });
    d.v = v; d.shared = clone(d.stage); delete d.pending; saveDrafts();
    $('st-msg').value = ''; $('st-sendform').hidden = true; status(`Sent to Claude as version ${v}. Ask Claude to look at it: its answer comes back here.`); ui();
  } catch (err) { status('Could not send it (' + (err.code || err.message || 'error') + '); try again in a moment.', true); }
}
async function versionStage(id, v) {
  const snap = await S.db.doc(`studioVersions/${id}-${v}`).get(); if (!snap.exists) return null; const x = snap.data();
  if (x.stage) return x.stage; if (x.asset) { const r = await fetch('/_blob/' + x.asset); return r.ok ? r.json() : null; } return null;
}
// what the shared store holds: new drafts come in, Claude's answers wait on theirs
async function syncRemote() {
  for (const [id, R] of S.remote) {
    let d = S.drafts.find(x => x.id === id);
    if (!d) {   // made or sent from another device, or made by Claude
      const st = await versionStage(id, R.v).catch(() => null); if (!st) continue;
      d = { id, name: '✎ ' + R.name, base: R.base, stage: st, at: R.at, v: R.v, shared: clone(st), made: R.by }; st.name = d.name; S.drafts.push(d); saveDrafts();
      if (R.by === 'claude') status(`Claude made you a track: "${R.name}". It's under My tracks.`);
    } else if (R.v > (d.v || 0) && R.by === 'claude') d.pending = { v: R.v, note: R.note || '', changes: R.changes || [] };
  }
  ui(); claudeBanner();
}
function claudeBanner() {
  const d = S.draft, P = d && viewerState.idx === S.slot && d.pending;
  $('st-claude').hidden = !P; if (!P) return;
  $('st-claude-text').textContent = `Claude's version ${P.v}${P.note ? ': ' + P.note : ''}`;
  $('st-claude-changes').textContent = P.changes.length ? P.changes.join('; ') : '';
}
async function takeClaude() {
  const d = S.draft, P = d && d.pending; if (!P) return;
  const st = await versionStage(d.id, P.v).catch(() => null); if (!st) { status('Could not fetch Claude\'s version; try again in a moment.', true); return; }
  d.prev = d.stage; st.name = d.name; d.stage = st; d.v = P.v; d.shared = clone(st); delete d.pending; saveDrafts(); S.undo = []; S.redo = [];
  openDraft(d, true); status(`Claude's version ${P.v} is in. History has your earlier ones.`);
}
async function history() {
  const d = S.draft, box = $('st-history'); if (!d) return;
  if (!box.hidden) { box.hidden = true; return; }
  if (!S.db) { box.hidden = false; box.innerHTML = '<p>History needs the shared database (the published game).</p>'; return; }
  box.hidden = false; box.innerHTML = '<p>Loading...</p>';
  try {
    const q = await S.db.collection('studioVersions').where('draft', '==', d.id).get(), L = q.docs.map(x => x.data()).sort((a, b) => b.v - a.v);
    box.innerHTML = L.length ? L.map(x => `<div class="st-ver"><b>v${x.v} · ${x.by === 'claude' ? 'Claude' : 'you'}</b> <small>${esc(new Date(x.at).toLocaleString())}</small>${x.note ? `<p>${esc(x.note)}</p>` : ''}${(x.changes || []).length ? `<small>${esc(x.changes.join('; '))}</small>` : ''}<button type="button" data-ver="${x.v}">Open this one</button></div>`).join('') : '<p>Nothing sent yet: Send to Claude starts the history.</p>';
  } catch (err) { box.innerHTML = `<p>Could not load the history (${esc(err.code || 'error')}).</p>`; }
}
async function openVersion(v) {
  const d = S.draft, st = await versionStage(d.id, v).catch(() => null); if (!st) { status('Could not fetch that version.', true); return; }
  remember(); d.prev = d.stage; st.name = d.name; d.stage = st; saveDrafts(); $('st-history').hidden = true; openDraft(d, true); status(`Version ${v} is open (Undo goes back).`);
}
// the viewer's hooks: the stage picker lists the drafts; a pick opens one
function options(idx) {
  if (!S.drafts.length) return null;
  const cur = idx === S.slot && S.draft ? 'd:' + S.draft.id : null;
  return { skip: S.slot, value: cur, html: `<optgroup label="My tracks (Studio drafts)">${S.drafts.map(d => `<option value="d:${esc(d.id)}">${esc(d.name)}${d.pending ? ' \u2022 new from Claude' : ''}</option>`).join('')}</optgroup>` };
}
function pick(v) { const d = S.drafts.find(x => 'd:' + x.id === v); if (d) { S.undo = []; S.redo = []; openDraft(d); } }
function opened(idx) {
  if (idx !== S.slot || !S.draft) { if (S.on) leave(); $('vw-edit').hidden = false; $('vw-edit').textContent = 'Edit'; $('st-claude').hidden = true; return; }
  S.built = clone((stage().edits || {}).sculpt || null); clearMarks(); S.path = null; palette();
  { const tr = G.world.tr, N = tr.loopN || tr.N; let k = 0; for (let i = 0; i < N; i++) k = Math.max(k, Math.abs(tr.ks[i])); if (S.on && k > 1 / 9) status('The road turns very tightly somewhere: a hairpin under 9 m across. Cars may struggle there.', true); }
  if (S.on) { G.editDrive = true; G.onEditorBack = () => { S.driving = false; openDraft(S.draft, true); }; }   // Drive it comes back to the studio
  ui(); claudeBanner();
}
function closed() { if (!S.driving) { G.editDrive = false; G.onEditorBack = null; } if (S.cursor) S.cursor.visible = false; $('st').hidden = true; $('st-claude').hidden = true; if (S.handles) S.handles.clear(); if (S.pmarks) S.pmarks.clear(); }
// ---------- the panel ----------
function setTool(t) { S.tool = t; S.sel = null; S.pt = -1; S.psel = -1; S.ssel = -1; ui(); status(t === 'pieces' && !G.world.tr.loopN ? 'Set pieces go on circuits: this is a downhill run.' : HINT[t]); }
function ui() {
  const on = S.on && !!S.draft; drawHandles(); drawPieces();
  $('st').hidden = !on; $('vw-edit').textContent = on ? 'Done' : 'Edit'; $('vw-edit').classList.toggle('on', on);
  if (!on) return;
  document.querySelectorAll('#st [data-st]').forEach(b => b.classList.toggle('on', b.dataset.st === S.tool));
  $('st-brush').hidden = !['raise', 'lower', 'smooth', 'flatten', 'paint', 'erase'].includes(S.tool); $('st-paints').hidden = S.tool !== 'paint'; document.querySelectorAll('#st-paints [data-paint]').forEach(b => b.classList.toggle('on', b.dataset.paint === S.paintKind)); $('st-size').value = String(Math.round(S.size)); $('st-power').value = String(Math.round(S.power * 10));
  $('st-palette').hidden = $('st-abrush').hidden = S.tool !== 'place'; $('st-erase').hidden = S.tool !== 'erase'; $('st-walls').hidden = S.tool !== 'walls'; $('st-streets').hidden = S.tool !== 'streets'; $('st-roadwbox').hidden = S.tool !== 'road'; $('st-roadw').value = String(stage().width || ROAD_WIDTH); $('st-roadw-read').textContent = (stage().width || ROAD_WIDTH) + ' m'; $('st-ssel').hidden = !(S.tool === 'streets' && S.ssel >= 0 && (edits().streets || [])[S.ssel]);
  { const B = S.brush; $('st-acount').value = B.count; $('st-aspread').value = B.spread; $('st-asize').value = Math.round(B.scale * 10); $('st-avar').value = Math.round(B.variety * 10); $('st-aspace').value = B.spacing;
    $('st-abrush-read').textContent = B.count === 1 ? `One at a time (drag for a row, ${B.spacing} m apart)` : `${B.count} at a time across ${B.spread * 2} m, ${B.spacing} m apart`; } document.querySelectorAll('#st-palette [data-kind]').forEach(b => b.classList.toggle('on', b.dataset.kind === S.kind));
  const rp = S.tool === 'road' && S.pt >= 0, pp = S.tool === 'pieces' && S.psel >= 0 && !!(edits().pieces || [])[S.psel];
  $('st-pieces').hidden = S.tool !== 'pieces'; document.querySelectorAll('#st-pieces [data-piece]').forEach(b => b.classList.toggle('on', b.dataset.piece === S.piece));
  $('st-sel').hidden = !S.sel && !rp && !pp;
  if (pp) { const q = edits().pieces[S.psel], P = PIECES[q.k]; $('st-selname').textContent = `${P.name}, ${q.len || P.len} m, ${((q.s - G.world.tr.startIdx) % G.world.tr.loopN + G.world.tr.loopN) % G.world.tr.loopN} m round the lap`; } if (S.sel) $('st-selname').textContent = KIND_NAME[S.sel.o.k || S.sel.o.type] || 'Selected';
  if (rp) $('st-selname').textContent = `Road point ${S.pt + 1}` + (roadPath().pts[S.pt][2] ? ` (road ${roadPath().pts[S.pt][2] > 0 ? 'up' : 'down'} ${Math.abs(roadPath().pts[S.pt][2])} m)` : '');
  $('st-rotl').hidden = $('st-rotr').hidden = rp || pp; $('st-smaller').textContent = rp ? 'Road down' : pp ? 'Shorter' : '\u2212'; $('st-bigger').textContent = rp ? 'Road up' : pp ? 'Longer' : '+'; $('st-del').textContent = rp ? 'Delete point' : 'Delete'; $('st-start').hidden = !rp || !roadPath().closed || S.pt === 0;
  drawHandles();
  $('st-undo').disabled = !S.undo.length; $('st-redo').disabled = !S.redo.length;
  $('st-name').textContent = S.draft.name; $('st-theme').value = edits().theme || '';
}
function status(t, bad = false) { const el = $('st-status'); el.textContent = t; el.classList.toggle('bad', bad); }
// ---------- changes: undo, redo, rebuild ----------
// undo keeps the whole draft (a theme changes its look as well as its edits)
function setStage(st) { st.name = S.draft.name; S.draft.stage = st; STAGES[S.slot] = st; }
function remember() { S.undo.push(JSON.stringify(stage())); if (S.undo.length > 40) S.undo.shift(); S.redo = []; }
function undo() { if (!S.undo.length) return; S.redo.push(JSON.stringify(stage())); setStage(JSON.parse(S.undo.pop())); S.sel = null; changed(0); }
function redo() { if (!S.redo.length) return; S.undo.push(JSON.stringify(stage())); setStage(JSON.parse(S.redo.pop())); S.sel = null; changed(0); }
/** The draft changed: keep it, and rebuild the stage from it in a moment (another change in the meantime waits for it). */
function changed(ms = 350) {
  if (!S.stroke && !S.drag) {   // a change that won't build (a building left on the road, a road that can't be laid) is taken back
    try { buildTrack(clone(stage())); } catch (err) { if (S.undo.length) setStage(JSON.parse(S.undo.pop())); status('That won\'t work: ' + err.message.replace(/^[^:]*: /, ''), true); S.sel = null; S.pt = -1; ui(); return; }
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
  if (S.tool === 'streets') { const j = streetHit(p); if (j >= 0) { S.ssel = j; ui(); status(`${STREETS[edits().streets[j].k].name}: line it with houses, or delete it.`); return; } S.ssel = -1; S.wline = [[p.x, p.z]]; drawWallLine(); return; }
  if (S.tool === 'walls') { const hit = hitTest(p); if (hit && hit.kit && hit.o.run) { S.sel = hit; ui(); status('A wall: Delete takes its whole run away.'); return; } S.sel = null; S.wline = [[p.x, p.z]]; drawWallLine(); return; }
  if (S.tool === 'place') {
    const hit = S.brush.count === 1 ? hitTest(p) : null;
    if (hit) { S.sel = hit; S.drag = { hit, moved: false }; ui(); return; }
    S.sel = null; remember(); S.stroke = { last: p, n: 0, asset: true }; assetDab(p, true); return;
  }
  remember();
  S.stroke = { last: p, to: p.y, held: setInterval(() => { if (S.stroke && S.tool !== 'erase' && S.tool !== 'paint') dab(S.stroke.last); }, 70) }; dab(p);   // held still, the brush keeps working (a mountain)
}
function move(e) {
  const p = pickGround(e.clientX, e.clientY); if (!p) return;
  cursorAt(p);
  if (S.drag && S.drag.pt !== undefined) { roadMove(p); return; }
  if (S.pdrag) { pieceMove(p); return; }
  if (S.wline) { const L = S.wline[S.wline.length - 1]; if (Math.hypot(p.x - L[0], p.z - L[1]) >= 2) { S.wline.push([p.x, p.z]); drawWallLine(); } return; }
  if (S.drag) {
    if (!S.drag.moved) { remember(); S.drag.moved = true; }
    S.drag.hit.o.x = Math.round(p.x * 10) / 10; S.drag.hit.o.z = Math.round(p.z * 10) / 10; mark(S.drag.hit.o); return;
  }
  if (!S.stroke) return;
  if (S.stroke.asset) { const L = S.stroke.last, step = S.brush.count === 1 ? Math.max(1.5, S.brush.spacing) : Math.max(S.brush.spacing, S.brush.spread * 0.8); if (Math.hypot(p.x - L.x, p.z - L.z) >= step) { assetDab(p, false); S.stroke.last = p; } return; }
  const L = S.stroke.last, d = Math.hypot(p.x - L.x, p.z - L.z), step = Math.max(1.5, S.size * 0.25);
  if (d < step) return;
  for (let t = step; t <= d; t += step) dab({ x: L.x + (p.x - L.x) * t / d, z: L.z + (p.z - L.z) * t / d });
  S.stroke.last = p;
}
function up() {
  if (S.wline) { const pts = S.wline; S.wline = null; drawWallLine(); if (S.tool === 'streets') buildStreet(pts); else buildWall(pts); return; }
  if (S.pdrag) { const m = S.pdrag.moved; S.pdrag = null; if (m) changed(); ui(); return; }
  if (S.drag && S.drag.pt !== undefined) { const m = S.drag.moved; S.drag = null; if (m) changed(); ui(); return; }
  if (S.drag) { const moved = S.drag.moved, h = S.drag.hit; S.drag = null; if (moved) { if (h.house && onRoad(h.o)) { status('That puts it on the road: moved back.', true); undo(); return; } changed(); } ui(); return; }
  if (S.stroke) { const a = S.stroke.asset, n = S.stroke.n; endStroke(); if (a && !n) { S.undo.pop(); return; } if (a) status(`${n === 1 ? KIND_NAME[S.lastKind] || 'One' : n} put down. ${S.brush.count === 1 ? 'Tap one to turn it, size it or delete it.' : 'Undo takes the whole stroke back.'}`); changed(); }
}
function endStroke() { clearInterval(S.stroke.held); S.stroke = null; }
function cancel() { if (S.wline) { S.wline = null; drawWallLine(); } if (S.stroke) { endStroke(); changed(); } if (S.drag) { S.drag = null; changed(); } }
function hover(e) { if (!S.on || S.tool === 'view' || (S.tool === 'place' && S.brush.count === 1) || S.tool === 'road' || S.tool === 'pieces' || S.tool === 'walls' || S.tool === 'streets') { if (S.cursor) S.cursor.visible = false; return; } const p = pickGround(e.clientX, e.clientY); if (p) cursorAt(p); }
// ---------- brushes ----------
function dab(p) {
  const E = edits(), r = S.size;
  if (S.tool === 'erase') {
    const f = S.eraseF, inR = o => Math.hypot(o.x - p.x, o.z - p.z) <= r, PK = { trees: ['pine', 'fir', 'tree', 'autumn', 'blossom', 'cactus'], rocks: ['rock', 'boulder'], bushes: ['bush'] };
    if (f !== 'buildings') (E.clears || (E.clears = [])).push([Math.round(p.x * 10) / 10, Math.round(p.z * 10) / 10, Math.round(r * 10) / 10].concat(f === 'all' ? [] : [f]));   // the stage's own scenery too
    if (E.props && (f === 'all' || PK[f])) E.props = E.props.filter(o => !(inR(o) && (f === 'all' || PK[f].includes(o.k))));
    if (E.houses && (f === 'all' || f === 'buildings')) E.houses = E.houses.filter(o => !inR(o));
    if (E.kit && (f === 'all' || f === 'street')) E.kit = E.kit.filter(o => !inR(o));
    return;
  }
  if (S.tool === 'paint') {   // the cells, and the ground's colours under the brush straight away (the rebuild blends them properly)
    paintDab(E.paint || (E.paint = { cell: 4, d: {} }), S.paintKind, p.x, p.z, r);
    const P = PAINTS[S.paintKind], col = new THREE.Color(P ? P.col || (S.paintKind === 'dirt' ? stage().colors.dirt : stage().colors.rock) : stage().colors.grassA), tmp = new THREE.Color();
    G.world.terrainMesh.traverse(o => { if (!o.isMesh || !o.geometry.attributes.color) return; const a = o.geometry.attributes.position.array, c = o.geometry.attributes.color.array; let hit = false;
      for (let i = 0; i < a.length; i += 3) { const d = Math.hypot(a[i] - p.x, a[i + 2] - p.z); if (d > r) continue; tmp.setRGB(c[i], c[i + 1], c[i + 2]).lerp(col, 0.85); c[i] = tmp.r; c[i + 1] = tmp.g; c[i + 2] = tmp.b; hit = true; }
      if (hit) o.geometry.attributes.color.needsUpdate = true; });
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
/** The kind to put down next: the picked one, or one of a mix by its weights. */
function nextKind() { const M = S.kind.startsWith('mix:') && MIXES[S.kind.slice(4)]; if (!M) return S.kind; const e = Object.entries(M.mix), tot = e.reduce((t, [, w]) => t + w, 0); let r = Math.random() * tot; for (const [k, w] of e) { if ((r -= w) <= 0) return k; } return e[0][0]; }
const roadGap = (x, z) => { const q = G.world.tr.nearest(x, z); return q ? q.d : Infinity; };
/** One dab of the asset brush at p: count things scattered over its spread (exact: one, right there), each kept off the
 *  road and spacing metres from the rest, sized and shaded by the brush's size and variety. */
function assetDab(p, exact) {
  if (S.kind === 'stamp:walledtown') { if (exact) stampTown(p); return; }
  const E = edits(), B = S.brush, tr = G.world.tr, n = B.count, R = n === 1 ? 0 : B.spread;
  for (let k = 0, tries = 0; k < n && tries < n * 6; tries++) {
    const a = Math.random() * Math.PI * 2, rr = R * Math.sqrt(Math.random()), x = Math.round((p.x + Math.cos(a) * rr) * 10) / 10, z = Math.round((p.z + Math.sin(a) * rr) * 10) / 10;
    const kind = nextKind(), cat = catOf(kind); if (!cat) continue;
    const vary = 1 + (Math.random() * 2 - 1) * 0.35 * B.variety, sp = B.spacing;
    let o = null;
    if (cat === 'house') {
      const T = BUILDINGS[kind], f = faceTo(x, z);
      o = { type: kind, x, z, f }; if (onRoad(o)) continue;
      if ((E.houses || []).some(h => Math.hypot(h.x - x, h.z - z) < (Math.max(T.w, T.d) + Math.max(BUILDINGS[h.type].w, BUILDINGS[h.type].d)) / 2 + sp * 0.5)) continue;
      (E.houses || (E.houses = [])).push(o);
    } else if (cat === 'kit') {
      if (roadGap(x, z) < HALF + 1 || (E.kit || []).some(h => Math.hypot(h.x - x, h.z - z) < sp)) continue;
      const q = tr.nearest(x, z); o = { k: kind, x, z, yaw: q ? Math.round(tr.th[q.i] * 180 / Math.PI) : 0 }; (E.kit || (E.kit = [])).push(o);   // lined up with the road
    } else {
      const s = Math.round(Math.max(0.4, Math.min(3, B.scale * vary)) * 100) / 100;
      if (roadGap(x, z) < HALF + 1.5 + (kind === 'boulder' ? 2 * s : 0) || (n > 1 || !exact) && (E.props || []).some(h => Math.hypot(h.x - x, h.z - z) < sp)) continue;
      o = { k: kind, x, z, s, ry: Math.round(Math.random() * 628) / 100 }; if (B.variety > 0) o.t = Math.round((Math.random() * 2 - 1) * B.variety * 100) / 100;
      (E.props || (E.props = [])).push(o);
    }
    k++; S.stroke.n++; S.lastKind = kind; if (S.stroke.n < 400) mark(o);
    if (exact && n === 1) { S.sel = { o, house: cat === 'house', kit: cat === 'kit' }; ui(); }
  }
  if (exact && !S.stroke.n) status(n === 1 ? 'Too close to the road (or to another one): try a little further off.' : 'No room there: further from the road, or less spacing.', true);
}
function hitTest(p) {
  const E = edits();
  for (const o of (E.houses || []).slice().reverse()) { const T = BUILDINGS[o.type], f = (o.f || 0) * Math.PI / 180, dx = p.x - o.x, dz = p.z - o.z, u = dx * Math.sin(f) + dz * Math.cos(f), v = dx * Math.cos(f) - dz * Math.sin(f); if (Math.abs(u) < T.d / 2 + 1 && Math.abs(v) < T.w / 2 + 1) return { o, house: true }; }
  for (const o of (E.kit || []).slice().reverse()) { const P = KIT_PIECES[o.k], yw = (o.yaw || 0) * Math.PI / 180, dx = p.x - o.x, dz = p.z - o.z, along = dx * Math.sin(yw) + dz * Math.cos(yw), off = dx * Math.cos(yw) - dz * Math.sin(yw); if (Math.abs(along) < (P.len ? (o.w || 4) : P.w) / 2 + 1 && Math.abs(off) < P.d / 2 + 1.2) return { o, kit: true }; }
  let best = null, bd = Infinity; for (const o of E.props || []) { const d = Math.hypot(o.x - p.x, o.z - p.z); if (d < Math.max(2.5, 1.6 * (o.s || 1) * (o.k === 'boulder' ? 2.6 : 1)) && d < bd) { bd = d; best = { o, house: false }; } }
  return best;
}
function turnSel(deg) { if (!S.sel) return; remember(); const o = S.sel.o; if (S.sel.kit) o.yaw = ((o.yaw || 0) + deg + 360) % 360; else if (S.sel.house) { o.f = ((o.f || 0) + deg + 360) % 360; if (onRoad(o)) { undo(); status('Turned that way it would stand on the road.', true); return; } } else o.ry = Math.round(((o.ry || 0) + deg * Math.PI / 180) * 100) / 100; changed(); }
function sizeSel(k) { if (S.tool === 'road' && S.pt >= 0) { liftPt(k > 1 ? 1 : -1); return; } if (S.tool === 'pieces' && S.psel >= 0) { lenPiece(k > 1 ? 10 : -10); return; } if (S.sel && S.sel.kit) { const P = KIT_PIECES[S.sel.o.k]; if (!P.len || S.sel.o.run) return; remember(); S.sel.o.w = Math.round(Math.max(1, Math.min(30, (S.sel.o.w || 4) * k)) * 10) / 10; changed(); return; } if (!S.sel || S.sel.house) return; remember(); S.sel.o.s = Math.round(Math.max(0.4, Math.min(3, (S.sel.o.s || 1) * k)) * 100) / 100; changed(); }
function delSel() { if (S.tool === 'road' && S.pt >= 0) { delPt(); return; } if (S.tool === 'pieces' && S.psel >= 0) { remember(); edits().pieces.splice(S.psel, 1); S.psel = -1; changed(); return; } if (!S.sel) return; remember(); const E = edits(), o = S.sel.o; E.props = (E.props || []).filter(x => x !== o); E.houses = (E.houses || []).filter(x => x !== o); E.kit = (E.kit || []).filter(x => x !== o && !(o.run && x.run === o.run)); S.sel = null; changed(); }
// ---------- what's drawn for the studio: the brush ring, and a marker on a change until the rebuild shows it ----------
function cursorAt(p) {
  if (!S.cursor) {
    S.cursor = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xFFC72C, transparent: true, opacity: 0.9, depthTest: false }));
    S.cursor.renderOrder = 21; scene.add(S.cursor);
  }
  const r = S.tool === 'place' ? (S.brush.count === 1 ? 2 : S.brush.spread) : S.size; S.cursor.visible = S.on && S.tool !== 'view' && S.tool !== 'road' && S.tool !== 'pieces'; S.cursor.scale.set(r, 1, r); S.cursor.position.set(p.x, p.y + 0.4, p.z);
  S.cursor.material.color.set(S.tool === 'paint' ? 0xFFFFFF : S.tool === 'lower' ? 0x4AA8E8 : S.tool === 'erase' ? 0xFF6A5A : S.tool === 'smooth' || S.tool === 'flatten' ? 0xFFFFFF : 0xFFC72C);
}
function mark(o) {
  if (!S.marks) { S.marks = new THREE.Group(); scene.add(S.marks); }
  let m = S.marks.children.find(c => c.userData.o === o);
  const KP = o.k && KIT_PIECES[o.k];
  if (!m) { const T = BUILDINGS[o.type]; m = new THREE.Mesh(T ? new THREE.BoxGeometry(T.w, 3 * T.floors, T.d) : KP ? new THREE.BoxGeometry(KP.d + 0.2, KP.h, KP.len ? o.w || 4 : KP.w) : new THREE.ConeGeometry(1.2 * (o.s || 1), 4 * (o.s || 1), 8), new THREE.MeshBasicMaterial({ color: 0xFFC72C, transparent: true, opacity: 0.45 })); m.userData.o = o; S.marks.add(m); }
  const y = G.world.terr.at(o.x, o.z); m.position.set(o.x, y + (BUILDINGS[o.type] ? 1.5 * BUILDINGS[o.type].floors : KP ? KP.h / 2 : 2 * (o.s || 1)), o.z); m.rotation.y = BUILDINGS[o.type] ? (o.f || 0) * Math.PI / 180 : KP ? (o.yaw || 0) * Math.PI / 180 : 0;
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
  const theme = $('st-gen-look').value, look = STAGES.find(s => s.name === THEMES[theme].look) || STAGES[0], seed = 1 + Math.floor(Math.random() * 9999);
  status('Making a track...'); $('st-gen-go').disabled = true;
  setTimeout(() => {
    let st = null; try { st = generateStage({ style: $('st-gen-style').value, length: $('st-gen-len').value, surface: $('st-gen-surf').value, look, seed, name: 'New track', theme }); } catch (e) { console.error(e); }
    $('st-gen-go').disabled = false;
    if (!st) { status('That landscape didn\'t take a road this time: try again, or another style.', true); return; }
    let n = 1, nm = '\u270E New track'; while (S.drafts.some(d => d.name === nm)) nm = `\u270E New track ${++n}`; st.name = nm;
    const d = { id: 'd' + Date.now().toString(36), name: nm, base: look.name, stage: st, at: new Date().toISOString(), made: 'generated' };
    S.drafts.push(d); saveDrafts(); S.undo = []; S.redo = []; $('st-gen').hidden = true;
    S.on = true; openDraft(d); status(`A new ${THEMES[theme].name.toLowerCase()} track: ${LAND_STYLES[$('st-gen-style').value]} with ${st.edits.pieces.length} set pieces${(st.edits.kit || []).length ? ', a walled town' : st.edits.houses.length ? ' and houses to smash' : ''}. Edit away.`); S.wallKind = THEMES[theme].wall; palette();
  }, 30);
}
// ---------- walls (a run of the world kit's boundary pieces) ----------
/** A line drawn on the ground becomes a run of wall: pieces of up to 5 m along it (so a car smashes a piece, not the
 *  lot), a gap where it crosses the road (and an arch over the road for a stone wall on a circuit), a ring when it ends
 *  where it began. Each piece carries the run's id, so the run goes as one. */
function buildWall(raw) {
  if (raw.length < 2) return;
  const tr = G.world.tr, E = edits(), first = raw[0], last = raw[raw.length - 1];
  const pts = raw.slice(); if (raw.length > 4 && Math.hypot(last[0] - first[0], last[1] - first[1]) < 8) pts.push(first);   // a ring
  // even steps of ~5 m along the line
  const seq = [pts[0]]; let carry = 0;
  for (let i = 1; i < pts.length; i++) { const [ax, az] = pts[i - 1], [bx, bz] = pts[i], d = Math.hypot(bx - ax, bz - az); let s0 = 5 - carry; while (s0 <= d) { seq.push([ax + (bx - ax) * s0 / d, az + (bz - az) * s0 / d]); s0 += 5; } carry = d - (s0 - 5); }
  if (Math.hypot(pts[pts.length - 1][0] - seq[seq.length - 1][0], pts[pts.length - 1][1] - seq[seq.length - 1][1]) > 1) seq.push(pts[pts.length - 1]);
  const run = 'w' + Date.now().toString(36), add = [], arches = [];
  for (let i = 1; i < seq.length; i++) {
    const [ax, az] = seq[i - 1], [bx, bz] = seq[i], mx = (ax + bx) / 2, mz = (az + bz) / 2, w = Math.hypot(bx - ax, bz - az);
    const near = [[ax, az], [mx, mz], [bx, bz]].map(([x, z]) => tr.nearest(x, z)).filter(Boolean), q = near.reduce((a, b) => (a && a.d < b.d ? a : b), null);
    if (q && q.d < HALF + 1.5) { if ((S.wallKind === 'wall' || S.wallKind === 'castlewall') && tr.loopN && !arches.some(a => Math.abs(a - tr.bi(q.i)) < 15)) arches.push(tr.bi(q.i)); continue; }   // the road goes through: a gap
    add.push({ k: S.wallKind, x: Math.round(mx * 10) / 10, z: Math.round(mz * 10) / 10, yaw: Math.round(Math.atan2(bx - ax, bz - az) * 1800 / Math.PI) / 10, w: Math.round(w * 10) / 10, run });
  }
  if (!add.length) { status('That line is all road: draw it beside the road (it may cross it).', true); return; }
  if (S.wallKind === 'castlewall') {   // towers at the ends, every ~30 m along, and either side of the road where it goes through
    const tw = (x, z) => { const q = tr.nearest(x, z); if (!q || q.d > HALF + 4) add.push({ k: 'tower', x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, yaw: 0, run }); };
    seq.forEach(([x, z], k) => { if (k === 0 || k === seq.length - 1 || k % 6 === 0) tw(x, z); });
    for (const b of arches) for (const sd of [-1, 1]) tw(tr.xs[b] + tr.rx[b] * sd * (HALF + 4.5), tr.zs[b] + tr.rz[b] * sd * (HALF + 4.5));
  }
  remember(); (E.kit || (E.kit = [])).push(...add);
  for (const b of arches) if (!(E.pieces || []).some(q => q.k === 'arch' && Math.abs(q.s - b) < 20)) (E.pieces || (E.pieces = [])).push({ s: Math.max(0, b - 5), k: 'arch' });
  status(`${add.length * 5 > 60 ? 'A long run' : 'A run'} of ${KIT_PIECES[S.wallKind].name.toLowerCase()}, ${Math.round(add.reduce((t, o) => t + o.w, 0))} m${arches.length ? ', with an arch where it crosses the road' : ''}.`);
  for (const o of add.slice(0, 200)) mark(o); changed();
}
function drawWallLine() {
  if (!S.wmesh) { S.wmesh = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xFFFFFF, depthTest: false })); S.wmesh.renderOrder = 22; scene.add(S.wmesh); }
  const L = S.wline || [], terr = G.world.terr, pos = [];
  for (const [x, z] of L) pos.push(x, terr.at(x, z) + 1.2, z);
  S.wmesh.geometry.dispose(); S.wmesh.geometry = new THREE.BufferGeometry(); S.wmesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); S.wmesh.visible = L.length > 1;
}
// ---------- themes (core/track/themes.js) ----------
/** The asset palette: the theme's own mixes first, then everything by kind. */
function palette() {
  const T = S.draft && THEMES[(stage().edits || {}).theme], group = (title, keys) => `<b>${title}</b>` + keys.map(k => `<button type="button" data-kind="${k}">${esc(KIND_NAME[k])}</button>`).join('');
  $('st-palette').innerHTML = (T ? group(`${T.name} theme`, T.mixes.map(k => 'mix:' + k).concat(T.stamp ? ['stamp:' + T.stamp] : [])) : '') + group('Mixes', Object.keys(MIXES).map(k => 'mix:' + k))
    + group('Castle', ['stamp:walledtown', 'keep', 'tavern', 'tower']) + group('Trees and rocks', Object.keys(PROPS)) + group('Buildings', BUILDING_TYPES.filter(k => k !== 'keep' && k !== 'tavern')) + group('Street', STREET.filter(k => k !== 'tower'));
  document.querySelectorAll('#st-palette [data-kind]').forEach(b => b.classList.toggle('on', b.dataset.kind === S.kind));
}
/** Dress the draft in a theme: the look of its stage (colours, light, scenery), its wall, its palette. Undo takes it back. */
function applyTheme(key) {
  if (!S.draft) return; remember(); const st = stage(), E = edits();
  if (!key) { delete E.theme; status('The stage\'s own look is kept as it is now (Undo for the theme before).'); changed(0); return; }
  const T = THEMES[key], look = STAGES.find(x => x.name === T.look);
  if (look) for (const k of LOOK_KEYS) { if (look[k] !== undefined) st[k] = clone(look[k]); else delete st[k]; }
  E.theme = key; S.wallKind = T.wall; $('st-wallkind').value = T.wall; palette();
  status(`${T.name} theme: ${T.look}'s colours and light, its mixes first in Assets${T.stamp ? ', and the walled town to stamp on the road' : ''}.`); changed(0);
}
/** The Castle's walled town round the road where you tapped. */
function stampTown(p) {
  const tr = G.world.tr, q = tr.nearest(p.x, p.z); if (!q || q.d > 45) { status('Tap on (or near) the road: the town is built round it.', true); return; }
  const T = walledTown(tr, tr.bi(q.i), { seed: Math.floor(Math.random() * 9999) }), E = edits();
  (E.kit || (E.kit = [])).push(...T.kit); (E.houses || (E.houses = [])).push(...T.houses); (E.pieces || (E.pieces = [])).push(...T.pieces);
  S.stroke.n += T.kit.length + T.houses.length; S.lastKind = 'stamp:walledtown';
  status(`A walled town: ${T.kit.filter(o => o.k === 'castlewall').length * 5} m of wall, ${T.kit.filter(o => o.k === 'tower').length} towers, ${T.houses.length} buildings${T.pieces.length ? ' and gates over the road' : ''}.`);
}
// ---------- streets (core/track/edits.js STREETS) ----------
const segPt = (x, z, a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], L = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / L)); return [a[0] + dx * t, a[1] + dz * t]; };
/** Which way a building at (x, z) should face: towards the nearer of the race road and the Studio's streets (degrees). */
function faceTo(x, z) {
  const tr = G.world.tr, q = tr.nearest(x, z); let best = q ? [tr.xs[q.i], tr.zs[q.i]] : null, bd = q ? q.d : Infinity;
  for (const S2 of edits().streets || []) for (let i = 1; i < S2.pts.length; i++) { const p = segPt(x, z, S2.pts[i - 1], S2.pts[i]), d = Math.hypot(p[0] - x, p[1] - z); if (d < bd) { bd = d; best = p; } }
  return best ? Math.round(Math.atan2(best[0] - x, best[1] - z) * 180 / Math.PI) : 0;
}
function streetHit(p) { const L = edits().streets || []; for (let j = L.length - 1; j >= 0; j--) { const w = (L[j].w || STREETS[L[j].k].w) / 2 + 1.5; for (let i = 1; i < L[j].pts.length; i++) { const q = segPt(p.x, p.z, L[j].pts[i - 1], L[j].pts[i]); if (Math.hypot(q[0] - p.x, q[1] - p.z) < w) return j; } } return -1; }
/** A line drawn on the ground as a street: its points every ~4 m. */
function buildStreet(raw) {
  if (raw.length < 2) return; const pts = [raw[0]];
  for (const q of raw) { const L = pts[pts.length - 1]; if (Math.hypot(q[0] - L[0], q[1] - L[1]) >= 4) pts.push(q); }
  const end = raw[raw.length - 1], L = pts[pts.length - 1]; if (Math.hypot(end[0] - L[0], end[1] - L[1]) > 1) pts.push(end);
  if (pts.length < 2) { status('Draw it a little longer.', true); return; }
  remember(); const E = edits(); (E.streets || (E.streets = [])).push({ k: S.streetKind, pts: pts.map(([x, z]) => [Math.round(x * 10) / 10, Math.round(z * 10) / 10]) }); S.ssel = E.streets.length - 1;
  let len = 0; for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  status(`A ${STREETS[S.streetKind].name.toLowerCase()}, ${Math.round(len)} m. Tap it to line it with houses.`); changed();
}
/** Houses both sides of the picked street, facing it, every ~15 m (the theme's mix, or a village). */
function lineStreet() {
  const E = edits(), st = (E.streets || [])[S.ssel]; if (!st) return;
  const T = THEMES[E.theme], mix = MIXES[(T && T.mixes.find(m => ['castle', 'village', 'town'].includes(m))) || 'village'].mix, types = Object.entries(mix).flatMap(([k, w]) => BUILDINGS[k] ? Array(w).fill(k) : []);
  remember(); const w = (st.w || STREETS[st.k].w) / 2; let n = 0, next = 6, run = 0;   // a house every 15 m along it (each side)
  for (let i = 1; i < st.pts.length; i++) {
    const [ax, az] = st.pts[i - 1], [bx, bz] = st.pts[i], L = Math.hypot(bx - ax, bz - az) || 1e-6, tx = (bx - ax) / L, tz = (bz - az) / L;
    for (; next < run + L; next += 15) {
      const s = next - run;
      for (const sd of [-1, 1]) {
        const type = types[Math.floor(Math.random() * types.length)], B = BUILDINGS[type], off = w + B.d / 2 + 2.5, x = ax + tx * s - tz * sd * off, z = az + tz * s + tx * sd * off;
        const o = { type, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10, f: Math.round(Math.atan2(-(-tz * sd), -(tx * sd)) * 180 / Math.PI) };
        const onStreet = st.pts.some((q, k) => k > 0 && (pq => Math.hypot(pq[0] - o.x, pq[1] - o.z))(segPt(o.x, o.z, st.pts[k - 1], q)) < w + Math.min(B.w, B.d) / 2 + 1);   // (the inside of a bend)
        if (onStreet || onRoad(o) || (E.houses || []).some(h => Math.hypot(h.x - o.x, h.z - o.z) < (Math.max(B.w, B.d) + Math.max(BUILDINGS[h.type].w, BUILDINGS[h.type].d)) / 2)) continue;
        (E.houses || (E.houses = [])).push(o); mark(o); n++;
      }
    }
    run += L;
  }
  if (!n) { S.undo.pop(); status('No room along it for houses (the road, or houses already there).', true); return; }
  status(`${n} houses along it, facing the street.`); changed();
}
