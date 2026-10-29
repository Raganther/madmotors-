import { $ } from './dom.js';

// Backup (menu: Backup): everything this copy of the game keeps outside the code, in one file, to carry to another
// artifact (another Claude account, a new publish) or just to keep. A new artifact starts empty: its browser storage is
// its own (it has its own address) and so is its shared database. In the file:
//   storage   every browser-storage key of the game (downhill-rush-*): settings, car picks, best times, the Career
//             save, the League, Studio drafts, sketch drafts, notes kept offline
//   db        the artifact's shared collections (DB below): notes and Claude's replies, sketches, Studio drafts and every
//             version, Asset Lab notes, tracks from the old editors
//   assets    the pictures and files those point to (a note's screenshot, a sketch's picture and strokes, a big draft),
//             as base64, keyed by their old asset id
// Import merges, never wipes: lists of drafts and notes join by id, best times keep the better of each, a database doc
// that's already there is left alone; settings and the Career / League saves take the backup's (it says so first).
// Assets go up again and the docs are pointed at their new ids. Export saves through the page's downloads permission
// (or copies to the clipboard); Import reads a file or a paste. Comments on the artifact page in claude.ai are the
// platform's, not the page's: they can't come along.
const DB = ['notes', 'sketches', 'studio', 'studioVersions', 'assetNotes', 'tracks'];
const PREFIX = 'downhill-rush', KIND = 'mad-motors-backup', ASSET = /^[0-9a-f]{32}$/;
const MERGE_BY_ID = ['downhill-rush-studio', 'downhill-rush-sketches', 'downhill-rush-notes'], BEST = 'downhill-rush-best-v1';
let pending = null;
const use = name => (window.claude && window.claude.use ? window.claude.use(name).catch(() => null) : Promise.resolve(null));
const pl = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const say = (t, bad = false) => { const el = $('bk-status'); el.textContent = t; el.classList.toggle('bad', bad); };

export function initBackup() {
  $('backup-btn').addEventListener('click', () => { pending = null; $('bk-confirm').hidden = true; $('bk-paste').hidden = true; say(''); $('backup').hidden = false; });
  $('bk-close').addEventListener('click', () => { $('backup').hidden = true; });
  $('bk-export').addEventListener('click', exportFile);
  $('bk-copy').addEventListener('click', copyIt);
  $('bk-file').addEventListener('change', async e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f) readBackup(await f.text()); });
  $('bk-pastebtn').addEventListener('click', () => { $('bk-paste').hidden = !$('bk-paste').hidden; });
  $('bk-pastego').addEventListener('click', () => readBackup($('bk-pastetext').value));
  $('bk-go').addEventListener('click', () => { if (pending) importIt(pending); });
  $('bk-cancel').addEventListener('click', () => { pending = null; $('bk-confirm').hidden = true; say('Nothing changed.'); });
}
// ---------- export ----------
async function gather() {
  const out = { kind: KIND, v: 1, at: new Date().toISOString(), from: location.href.split('?')[0], storage: {}, db: {}, assets: {} };
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PREFIX)) out.storage[k] = localStorage.getItem(k); }
  const db = await use('db');
  if (db) for (const c of DB) {
    say(`Reading ${c}...`);
    try { const q = await db.collection(c).limit(1000).get(); out.db[c] = q.docs.map(d => ({ id: d.id, data: d.data() })); } catch (e) { out.db[c] = []; }
  }
  // the files the docs point to (any top-level field holding an asset id)
  const ids = new Set(); for (const c of Object.keys(out.db)) for (const d of out.db[c]) for (const v of Object.values(d.data || {})) if (typeof v === 'string' && ASSET.test(v)) ids.add(v);
  let n = 0;
  for (const id of ids) {
    say(`Packing pictures and files ${++n} of ${ids.size}...`);
    try { const r = await fetch('/_blob/' + id); if (!r.ok) continue; const b = await r.blob(); out.assets[id] = { type: b.type, b64: await b64(b) }; } catch (e) { /* a missing file: the doc still comes */ }
  }
  return out;
}
function b64(blob) { return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.onerror = rej; fr.readAsDataURL(blob); }); }
const fileName = () => `mad-motors-backup-${new Date().toISOString().slice(0, 10)}.json`;
function counts(b) {
  const L = k => { try { return (JSON.parse(b.storage[k] || '[]') || []).length; } catch (e) { return 0; } };
  const n = c => (b.db[c] || []).length, parts = [];
  if (n('notes')) parts.push(pl(n('notes'), 'note')); if (n('studio') || L('downhill-rush-studio')) parts.push(pl(Math.max(n('studio'), L('downhill-rush-studio')), 'Studio track'));
  if (n('sketches') || L('downhill-rush-sketches')) parts.push(pl(n('sketches') + L('downhill-rush-sketches'), 'sketch', 'sketches')); if (n('assetNotes')) parts.push(pl(n('assetNotes'), 'Asset Lab note'));
  if (n('tracks')) parts.push(pl(n('tracks'), 'older track send')); if (b.storage['downhill-rush-career']) parts.push('a Career save'); if (b.storage['downhill-rush-league']) parts.push('a League');
  try { const bt = Object.keys(JSON.parse(b.storage[BEST] || '{}')).length; if (bt) parts.push(pl(bt, 'best time')); } catch (e) { }
  const set = Object.keys(b.storage).filter(k => !MERGE_BY_ID.includes(k) && ![BEST, 'downhill-rush-career', 'downhill-rush-league', 'downhill-rush-sketch'].includes(k)).length; if (set) parts.push(pl(set, 'setting'));
  if (Object.keys(b.assets).length) parts.push(pl(Object.keys(b.assets).length, 'picture or file', 'pictures and files'));
  return parts.length ? parts.join(', ') : 'nothing yet';
}
async function exportFile() {
  const b = await gather(), text = JSON.stringify(b), dl = await use('downloads');
  if (!dl) { say(`Packed ${counts(b)}. Saving files isn't allowed here: use Copy instead.`, true); return; }
  try { await dl.save({ filename: fileName(), data: new Blob([text], { type: 'application/json' }) }); say(`Saved: ${counts(b)}. In the new copy of the game, open Backup and Import this file.`); }
  catch (e) { say(e && e.code === 'declined' ? 'Not saved.' : `Could not save the file (${(e && e.code) || 'error'}): try Copy instead.`, e && e.code !== 'declined'); }
}
async function copyIt() {
  const b = await gather(), text = JSON.stringify(b);
  try { await navigator.clipboard.writeText(text); say(`Copied: ${counts(b)} (${Math.round(text.length / 1024)} KB). Paste it into Import in the new copy, or into a file.`); }
  catch (e) { say('The clipboard is blocked here: use Export instead.', true); }
}
// ---------- import ----------
function readBackup(text) {
  let b; try { b = JSON.parse(text); } catch (e) { say('That isn\'t a backup file (it doesn\'t read as JSON).', true); return; }
  if (!b || b.kind !== KIND || typeof b.storage !== 'object') { say('That isn\'t a Mad Motors backup.', true); return; }
  b.db = b.db || {}; b.assets = b.assets || {}; pending = b;
  const replaces = ['downhill-rush-career', 'downhill-rush-league'].filter(k => b.storage[k] && localStorage.getItem(k)).map(k => k === 'downhill-rush-career' ? 'your Career save' : 'your League').join(' and ');
  $('bk-summary').textContent = `From ${new Date(b.at).toLocaleString()}: ${counts(b)}. It adds to what's here${replaces ? `, but replaces ${replaces} and your settings` : ' and takes its settings'}.`;
  $('bk-confirm').hidden = false; say('');
}
function mergeList(key, incoming) {
  let mine = [], theirs = []; try { mine = JSON.parse(localStorage.getItem(key) || '[]') || []; } catch (e) { } try { theirs = JSON.parse(incoming) || []; } catch (e) { }
  if (!Array.isArray(mine) || !Array.isArray(theirs)) return incoming;
  const have = new Set(mine.map(x => x && x.id)); return JSON.stringify(mine.concat(theirs.filter(x => x && !have.has(x.id))));
}
function mergeBest(incoming) {
  let mine = {}, theirs = {}; try { mine = JSON.parse(localStorage.getItem(BEST) || '{}') || {}; } catch (e) { } try { theirs = JSON.parse(incoming) || {}; } catch (e) { }
  for (const [k, v] of Object.entries(theirs)) if (typeof v === 'number' ? !(typeof mine[k] === 'number' && mine[k] <= v) : !(k in mine)) mine[k] = v;   // the better time of the two
  return JSON.stringify(mine);
}
async function importIt(b) {
  $('bk-go').disabled = true;
  try {
    for (const [k, v] of Object.entries(b.storage)) {
      if (!k.startsWith(PREFIX) || typeof v !== 'string') continue;
      localStorage.setItem(k, MERGE_BY_ID.includes(k) ? mergeList(k, v) : k === BEST ? mergeBest(v) : v);
    }
    const db = await use('db'), assets = await use('assets'), map = {}; let docs = 0, skipped = 0, files = 0;
    if (db) {
      const ids = Object.keys(b.assets);
      if (assets) for (const id of ids) {
        say(`Putting back pictures and files ${++files} of ${ids.length}...`);
        try { const a = b.assets[id], bin = Uint8Array.from(atob(a.b64), ch => ch.charCodeAt(0)); map[id] = (await assets.upload(new Blob([bin], { type: a.type || 'application/octet-stream' }))).id; } catch (e) { /* the doc comes anyway */ }
      }
      for (const c of DB) {
        const list = b.db[c] || []; if (!list.length) continue;
        let have = new Set(); try { have = new Set((await db.collection(c).limit(1000).get()).docs.map(d => d.id)); } catch (e) { }
        for (const d of list) {
          if (have.has(d.id)) { skipped++; continue; }
          const data = Object.fromEntries(Object.entries(d.data || {}).map(([k, v]) => [k, typeof v === 'string' && map[v] ? map[v] : v]));
          say(`Restoring ${c}: ${++docs}...`);
          try { await db.doc(`${c}/${d.id}`).set(data); } catch (e) { skipped++; }
        }
      }
    }
    say(`Imported: ${pl(docs, 'shared item')}${skipped ? ` (${skipped} already here)` : ''}${files ? `, ${pl(Object.keys(map).length, 'picture or file', 'pictures and files')}` : ''}${db ? '' : ' (no shared database here: only this browser\'s data came in)'}. Reloading...`);
    pending = null; setTimeout(() => location.reload(), 1600);   // settings, saves and drafts are read at start
  } catch (e) { console.error(e); say('The import stopped part way: ' + (e.message || e) + '. Running it again is safe (nothing is doubled).', true); }
  $('bk-go').disabled = false;
}
