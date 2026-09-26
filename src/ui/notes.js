import { G } from '../game.js';
import { STAGES } from '../data/stages/index.js';
import { pickGround, setPins, snapView } from '../render/notepins.js';
import { $ } from './dom.js';
import { race } from './flow.js';

// Notes on the track, for Claude: in a race, Note (or N) freezes the action; tap a spot on the track, type what you
// want changed there, and it's saved with the stage, the distance from the start line and a picture of the view.
// Saved to the artifact's database ("notes" collection) where Claude reads them and answers (the `reply` field);
// the answer shows in the list and the pin turns green. Without the database (a saved copy of the page) notes are
// kept in this browser and "Copy notes" puts them on the clipboard to paste to Claude.
const LOCAL = 'downhill-rush-notes';
let db = null, assets = null, notes = [], draft = null, from = null, localOnly = true;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const stageOfWorld = () => G.world && G.world.stage;
function metresOf(tr, i) { const N0 = tr.loopN; return Math.round(N0 ? ((i - tr.startIdx) % N0 + N0) % N0 : i - tr.startIdx); }
function loadLocal() { try { return JSON.parse(localStorage.getItem(LOCAL) || '[]') || []; } catch (e) { return []; } }
function saveLocal() { try { localStorage.setItem(LOCAL, JSON.stringify(notes)); } catch (e) { } }
export function initNotes() {
  notes = loadLocal(); refresh();
  $('note-btn').addEventListener('click', () => G.noteMode ? exitNotes() : enterNotes());
  $('note-btn2').addEventListener('click', () => { $('pause').hidden = true; enterNotes(true); });
  $('notes-btn').addEventListener('click', openList); $('note-list-btn').addEventListener('click', openList);
  $('note-done').addEventListener('click', exitNotes);
  $('note-save').addEventListener('click', saveDraft); $('note-cancel').addEventListener('click', cancelDraft);
  $('notes-close').addEventListener('click', () => { $('notes').hidden = true; });
  $('notes-copy').addEventListener('click', copyAll);
  $('notes-body').addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (b) delNote(b.dataset.del); });
  $('game').addEventListener('pointerdown', e => { if (G.noteMode && !draft) { e.preventDefault(); place(e.clientX, e.clientY); } });   // the canvas lives in #game (made later, at boot)
  // the database, when this page runs inside claude.ai; until (unless) it answers, notes stay local
  if (window.claude && window.claude.use) {
    window.claude.use('db').then(d => {
      if (!d) return; db = d; localOnly = false;
      db.collection('notes').onSnapshot(s => { notes = s.docs.map(x => ({ id: x.id, ...x.data() })); refresh(); }, () => { db = null; localOnly = true; notes = loadLocal(); refresh(); });
    });
    window.claude.use('assets').then(a => { assets = a; });
  }
}
export function enterNotes(fromPause = false) {
  if (!race || !G.world || (G.state !== 'racing' && G.state !== 'countdown' && G.state !== 'paused')) return;
  from = fromPause ? 'pause' : G.state; G.state = 'paused'; G.noteMode = true;
  $('note-bar').hidden = false; $('note-btn').textContent = 'Done'; refresh();
}
export function exitNotes() {
  if (!G.noteMode) return;
  cancelDraft(); G.noteMode = false; $('note-bar').hidden = true; $('note-btn').textContent = 'Note'; setPins([]);
  if (from === 'pause') $('pause').hidden = false; else { G.state = from || 'racing'; G.lastT = performance.now() / 1000; }
}
function place(cx, cy) {
  const p = pickGround(cx, cy); if (!p) return;
  const st = stageOfWorld(), tr = G.world.tr;
  draft = { stage: st.name, stageIdx: G.world.idx, metres: metresOf(tr, p.i), lat: Math.round(p.lat * 10) / 10, x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1) };
  pinsFor(draft); snapView().then(b => { if (draft) draft.blob = b; });
  const side = Math.abs(p.lat) < 6 ? 'on the road' : `${Math.round(Math.abs(p.lat) - 6)} m off the ${p.lat > 0 ? 'right' : 'left'} of the road`;
  $('note-where').textContent = `${st.name}, ${draft.metres} m from the start, ${side}`;
  $('note-text').value = ''; $('note-form').hidden = false; $('note-text').focus();
}
function cancelDraft() { draft = null; $('note-form').hidden = true; if (G.noteMode) pinsFor(null); }
async function saveDraft() {
  const text = $('note-text').value.trim(); if (!draft || !text) { $('note-text').focus(); return; }
  const d = draft; draft = null; $('note-form').hidden = true;
  const P = race && race.player, note = { stage: d.stage, stageIdx: d.stageIdx, metres: d.metres, lat: d.lat, x: d.x, y: d.y, z: d.z, text,
    camera: G.camMode, zoom: G.camZoom, vehicle: G.vehicle, playerMetres: P ? metresOf(G.world.tr, P.pr.i) : null, at: new Date().toISOString(), status: 'open' };
  if (!localOnly && db) {
    try {
      if (assets && d.blob) { try { note.shot = (await assets.upload(d.blob, { type: 'image/jpeg' })).id; } catch (e) { /* the note matters more than the picture */ } }
      await db.collection('notes').doc('n' + Date.now().toString(36)).set(note); flash('Note saved for Claude'); return;
    } catch (e) { flash('Could not save to the shared notes; kept on this device'); }
  }
  notes.push({ id: 'l' + Date.now().toString(36), ...note }); saveLocal(); refresh(); flash('Note saved on this device: copy it from Notes');
}
async function delNote(id) {
  if (!localOnly && db && !id.startsWith('l')) { try { await db.collection('notes').doc(id).delete(); } catch (e) { flash('Could not delete that note'); } return; }
  notes = notes.filter(n => n.id !== id); saveLocal(); refresh();
}
function flash(t) { const el = $('note-toast'); el.textContent = t; el.hidden = false; clearTimeout(flash.t); flash.t = setTimeout(() => { el.hidden = true; }, 2600); }
function numbered() { const by = {}; return notes.slice().sort((a, b) => (a.at || '').localeCompare(b.at || '')).map(n => ({ ...n, n: (by[n.stage] = (by[n.stage] || 0) + 1) })); }
function pinsFor(extra) {
  if (!G.noteMode) return;
  const st = stageOfWorld(), list = numbered().filter(n => st && n.stage === st.name).map(n => ({ n: n.n, x: n.x, y: n.y, z: n.z, done: !!n.reply || n.status === 'done' }));
  if (extra) list.push({ n: '+', x: extra.x, y: extra.y, z: extra.z, done: false });
  setPins(list);
}
function refresh() {
  pinsFor(draft);
  const st = stageOfWorld(), here = st ? notes.filter(n => n.stage === st.name).length : 0;
  $('note-count').textContent = here ? `${here} note${here > 1 ? 's' : ''} on this stage` : 'No notes on this stage yet';
  if (!$('notes').hidden) drawList();
}
function openList() { drawList(); $('notes').hidden = false; }
function drawList() {
  const all = numbered(), byStage = STAGES.map(s => s.name).filter(n => all.some(x => x.stage === n));
  $('notes-sub').textContent = localOnly ? 'Kept on this device (the page is not connected to the shared notes): copy them and paste them to Claude.' : 'Shared with Claude: it reads these and answers here.';
  $('notes-copy').hidden = !all.length;
  $('notes-body').innerHTML = all.length ? byStage.map(name => `<h3>${esc(name)}</h3><ol class="nl">${all.filter(x => x.stage === name).map(x =>
    `<li class="${x.reply || x.status === 'done' ? 'done' : ''}"><span class="nl-n">${x.n}</span><span class="nl-t"><b>${x.metres} m</b> ${esc(x.text)}${x.reply ? `<em>Claude: ${esc(x.reply)}</em>` : ''}</span><button type="button" class="nl-del" data-del="${esc(x.id)}" aria-label="Delete note">✕</button></li>`).join('')}</ol>`).join('')
    : '<p>No notes yet. In a race, press Note (or N), tap a spot on the track and say what you would change there.</p>';
}
function copyAll() {
  const txt = numbered().map(n => `${n.stage} #${n.n} at ${n.metres} m (lat ${n.lat}): ${n.text}`).join('\n');
  (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => flash('Notes copied: paste them to Claude'), () => { prompt('Copy these notes:', txt); });
}
