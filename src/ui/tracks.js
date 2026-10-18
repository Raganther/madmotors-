import { G } from '../game.js';
import { STAGES } from '../data/stages/index.js';
import { VEHICLES, vehicleById } from '../data/vehicles.js';
import { paceOf, paceBand } from '../data/ratings.js';
import { trackOf } from '../render/world/index.js';
import { best } from './storage.js';
import { fmt } from './format.js';
import { drawTrackMap } from './trackmap.js';
import { $ } from './dom.js';

// Quick Race's track picker: one card per track, grouped by kind and terrain, each with its outline from above
// (ui/trackmap.js), its laps and surface, your best time, how well your car suits it, and its versions (night, rain)
// folded in as chips rather than cards of their own. The cards pick STAGES indexes; the rest is flow.js selectStage.
export const GROUPS = [
  ['downhill', 'Downhill runs', 'one way, start to finish'],
  ['tarmac', 'Tarmac circuits', 'grip, speed and jumps'],
  ['dirt', 'Dirt & gravel', 'rally: loose, rutted, muddy'],
  ['snow', 'Snow & ice', 'packed snow and black ice'],
  ['offpiste', 'Off-piste', 'find your own way between the gates'],
  ['boss', 'Ovals & boss tracks', 'the big events'],
  ['arena', 'Arenas', 'derby and demolition grounds'],
];
/** Which group stage s belongs to. */
export function groupOf(s) {
  if (s.arena) return 'arena';
  if (/^(Boss|Derby) track/.test(s.blurb || '')) return 'boss';
  if (/^Off-piste/.test(s.blurb || '')) return 'offpiste';
  if (!s.laps) return 'downhill';
  return s.surface === 'snow' ? 'snow' : s.surface === 'gravel' ? 'dirt' : 'tarmac';
}
const surfOf = s => s.surface === 'tarmac' ? 'tarmac' : 'loose';
const SURF_NAME = { tarmac: 'tarmac', gravel: 'gravel', snow: 'snow' };
/** The vehicles that suit stage s best: the three quickest there (measured, data/ratings.js). */
export function bestCarsFor(s, n = 3) { const sf = surfOf(s); return VEHICLES.slice().sort((a, b) => paceOf(a.id, null, sf) - paceOf(b.id, null, sf)).slice(0, n); }
/** Car id's pace band on stage s (D..S). */
export const bandOn = (id, s) => paceBand(paceOf(id, null, surfOf(s)));
// the cards: [{ base index, versions: [{ v: 'day' | 'night' | 'rain', i }] }] in their groups, built once
let cards = null;
function collect() {
  const byBase = new Map(), out = [];
  STAGES.forEach((s, i) => {
    const key = s.base || s.name; let c = byBase.get(key);
    if (!c) { c = { i, key, versions: [] }; byBase.set(key, c); out.push(c); }
    c.versions.push({ v: s.version || 'day', i });
  });
  return out;
}
export function buildTrackCards(onPick) {
  cards = collect();
  const root = $('stage-list'); root.innerHTML = '';
  for (const [g, name, about] of GROUPS) {
    const mine = cards.filter(c => groupOf(STAGES[c.i]) === g); if (!mine.length) continue;
    const h = document.createElement('h3'); h.className = 'tg-h'; h.innerHTML = `${name} <small>${about}</small>`; root.appendChild(h);
    const grid = document.createElement('div'); grid.className = 'tg-grid'; root.appendChild(grid);
    for (const c of mine) {
      const s = STAGES[c.i], b = document.createElement('button'); b.type = 'button'; b.className = 'tcard'; b.dataset.base = c.key;
      const vers = c.versions.length > 1 ? `<span class="tc-vers">${c.versions.map(v => `<span data-i="${v.i}">${v.v === 'day' ? 'Day' : v.v === 'night' ? 'Night' : 'Rain'}</span>`).join('')}</span>` : '';
      b.innerHTML = `<canvas aria-hidden="true"></canvas>${vers}<span class="tc-name">${s.name}</span><span class="tc-meta">${s.laps ? `Circuit · ${s.laps} laps` : 'Downhill'} · ${SURF_NAME[s.surface] || s.surface}</span><span class="tc-best"></span><span class="tc-fit"></span>`;
      b.addEventListener('click', e => { const v = e.target.closest('[data-i]'); onPick(v ? +v.dataset.i : (cards.find(x => x.key === c.key).cur ?? c.i)); });
      c.el = b; grid.appendChild(b);
    }
  }
  drawOutlines(); refreshTrackCards();
}
// the outlines: a few at a time, so the menu is up before every track has been laid out; only once the cards are on
// screen (a hidden canvas has no size), so Quick Race calls this again when it opens
let drawing = false;
export function drawOutlines() {
  if (!cards || drawing) return; drawing = true;
  const step = () => {
    const todo = cards.filter(c => !c.drawn && c.el.querySelector('canvas').clientWidth > 0).slice(0, 3);
    for (const c of todo) { c.drawn = true; try { drawTrackMap(c.el.querySelector('canvas'), trackOf(c.cur ?? c.i)); } catch (e) { /* no outline: the card still works */ } }
    if (todo.length) setTimeout(step, 30); else drawing = false;
  };
  setTimeout(step, 30);
}
/** Mark the selected stage, and refresh best times and how your car suits each track. */
export function refreshTrackCards() {
  if (!cards) return;
  const sel = G.stageSel ?? 0;
  for (const c of cards) {
    const on = c.versions.find(v => v.i === sel); if (on) c.cur = sel;
    const i = c.cur ?? c.i, s = STAGES[i], veh = G.stageCars[s.name] || G.defaultVehicle || 'coupe';
    c.el.classList.toggle('on', !!on);
    for (const ch of c.el.querySelectorAll('.tc-vers [data-i]')) ch.classList.toggle('on', +ch.dataset.i === i);
    c.el.querySelector('.tc-best').textContent = best[i] ? 'Best ' + fmt(best[i]) : '';
    const bd = bandOn(veh, s); c.el.querySelector('.tc-fit').innerHTML = `${vehicleById(veh).name}: <b class="b${bd}">${bd}</b> here`;
  }
  const s = STAGES[sel], v = vehicleById(G.vehicle), bd = bandOn(v.id, s), top = bestCarsFor(s);
  const el = $('veh-suit'); if (el) el.innerHTML = `On ${s.name} (${SURF_NAME[s.surface] || s.surface}) your ${v.name} is <b>${bd}</b>. Quickest here: ${top.map(t => t.name).join(', ')}.`;
}
