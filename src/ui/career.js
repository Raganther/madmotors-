import { G } from '../game.js';
import { SHOP, STARTERS, TIERS, awardTrophy, buyCar, careerDefs, eventById, eventMaxStars, eventStars, forSale, newCareer, objText, podiumOf, roundMask, roundsOf, scoreRace, selectCar, tierMaxStars, tierOf, tierOpen, tierStars, topTier, totalStars } from '../data/career.js';
import { scoreRound, standings } from '../data/leagues.js';
import { STAGES } from '../data/stages/index.js';
import { VEHICLES, vehicleById } from '../data/vehicles.js';
import { ranking } from '../core/sim/race.js';
import { vehicleThumb } from '../render/thumbs.js';
import { $ } from './dom.js';
import { ordinal } from './format.js';
import { statsHTML } from './garage.js';
import { loadCareer, saveCareer } from './storage.js';
import { race, startRace, toMenu } from './flow.js';

// Career (data/career.js): the menu's Career button. Pick a starter car, then the hub shows the four tiers and their
// events; an event screen lists its rounds with the stars earned and the objective; the garage holds your cars and
// the showroom. While a career round is raced G.career is { ev, k } (the event id and round) and G.tally counts the
// player's big airs, drift boosts, weapon hits, wrecks and resets for the results (ui/flow.js handleEvents).
let S = loadCareer(), view = { v: 'hub', tier: 0 };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const money = n => '$' + Math.round(n).toLocaleString('en-US');
const star = (on, fresh) => `<i class="cr-star${on ? ' on' : ''}${fresh ? ' new' : ''}">★</i>`;
const starsOf = (mask, fresh = 0) => [1, 2, 4].map(b => star(mask & b, fresh & b)).join('');
const stageIdx = name => STAGES.findIndex(s => s.name === name);
const cupRun = ev => (S.cups[ev.id]) || { id: ev.id, round: 0, pts: {}, results: [] };
const cupDone = (ev, run = cupRun(ev)) => run.round >= roundsOf(ev).length;
const store = s => { S = s; saveCareer(S); };
/** The career state (for tests and the results screen). */
export const career = () => S;

export function openCareer(v) { S = loadCareer(); v = v || (S ? view : { v: 'start' }); view = S ? v : { v: 'start' }; draw(); $('career').hidden = false; const f = $('career').querySelector('.cta, .cr-item, .cr-tab'); if (f) f.focus(); }
export function closeCareer() { $('career').hidden = true; $('career-btn').focus(); }
function draw() {
  $('cr-wallet').innerHTML = S ? `<b>${money(S.cash)}</b><span>${star(1)} ${totalStars(S)}</span>` : '';
  ({ start: drawStart, hub: drawHub, event: drawEvent, garage: drawGarage })[view.v]();
  pictures();
}
// car pictures load one at a time after the screen is drawn, so it opens straight away
function pictures() {
  const imgs = [...$('career').querySelectorAll('img[data-car]')]; let k = 0;
  const next = () => { if (k >= imgs.length) return; const im = imgs[k++]; try { im.src = vehicleThumb(vehicleById(im.dataset.car)); } catch (e) { /* no WebGL: the name is enough */ } setTimeout(next, 0); };
  next();
}
const carCard = (v, foot, cls = '') => `<div class="cr-car ${cls}"><img data-car="${v.id}" alt="" width="240" height="150"><b>${esc(v.name)}</b><span class="g-blurb">${esc(v.blurb)}</span><span class="g-stats">${statsHTML(v)}</span>${foot}</div>`;

// ---------- a new career: choose the starter ----------
function drawStart() {
  $('cr-title').textContent = 'Career'; $('cr-sub').textContent = 'Start in the Rookie tier with one cheap car. Win races for cash and stars: cash buys cars, stars open the next tier. Choose your first car.';
  $('cr-body').innerHTML = `<div class="cr-cars">${STARTERS.map(id => carCard(vehicleById(id), `<button type="button" class="cta" data-act="starter" data-id="${id}">Start with this</button>`)).join('')}</div>`;
  $('cr-actions').innerHTML = `<div class="btn-row"><button type="button" class="btn" data-act="close">Back</button></div>`;
}

// ---------- the hub: tiers and their events ----------
function drawHub() {
  const ti = Math.min(view.tier, TIERS.length - 1), T = TIERS[ti], open = tierOpen(S, ti), car = vehicleById(S.car);
  $('cr-title').textContent = 'Career'; $('cr-sub').textContent = `Driving the ${car.name}. ${S.races ? `${S.races} races, ${S.wins} wins, ${money(S.earned)} earned.` : 'Pick an event to start.'}`;
  const tabs = TIERS.map((t, i) => `<button type="button" class="cr-tab" data-act="tier" data-i="${i}" aria-pressed="${i === ti}"${tierOpen(S, i) ? '' : ' data-locked="1"'}><b>${esc(t.name)}</b><small>${tierOpen(S, i) ? `★ ${tierStars(S, t)}/${tierMaxStars(t)}` : 'Locked'}</small></button>`).join('');
  const lock = open ? '' : `<p class="cr-lock">Earn ${T.need} stars in ${esc(TIERS[ti - 1].name)} to open ${esc(T.name)} (you have ${tierStars(S, TIERS[ti - 1])}).</p>`;
  const items = T.events.map(ev => {
    const run = cupRun(ev), n = roundsOf(ev).length, tro = S.trophies[ev.id];
    const prog = cupDone(ev, run) ? `Finished ${ordinal(standings(run, ['You']).findIndex(s => s.name === 'You') + 1)}` : run.round ? `Round ${run.round + 1} of ${n}` : `${n} rounds`;
    return `<button type="button" class="cr-item lg-item" data-act="event" data-id="${ev.id}"${open ? '' : ' disabled'}><b>${esc(ev.name)}${tro ? ` <span class="cr-trophy t${tro}">${['', 'Gold', 'Silver', 'Bronze'][tro]}</span>` : ''}</b><span>${esc(ev.blurb)}</span>`
      + `<small>${roundsOf(ev).map(r => esc(r.stage)).join(' · ')}</small><em>${prog} · ★ ${eventStars(S, ev)}/${eventMaxStars(ev)}</em></button>`;
  }).join('');
  $('cr-body').innerHTML = `<div class="cr-tabs">${tabs}</div><p class="cr-tier">${esc(T.blurb)}. Rivals ${Math.round(T.skill * 100)}% sharp, prize money ×${T.pay}.</p>${lock}<div class="lg-list">${items}</div>`;
  $('cr-actions').innerHTML = `<button type="button" class="cta" data-act="garage">Garage &amp; showroom</button><div class="btn-row"><button type="button" class="btn" data-act="close">Back to the menu</button><button type="button" class="btn cr-quiet" data-act="restart">New career</button></div>`;
}

// ---------- an event: its rounds, stars and objectives, the standings ----------
function drawEvent() {
  const ev = eventById(view.id), run = cupRun(ev), done = cupDone(ev, run), T = TIERS[tierOf(ev)], table = standings(run, ['You']);
  $('cr-title').textContent = ev.name;
  $('cr-sub').textContent = `${T.name} tier · ${ev.blurb}. Points 10-8-6-5-4-3-2-1 each round; top three win a trophy. Every round: a star for a podium, one for the win, one for its objective.`;
  const rounds = roundsOf(ev).map((r, k) => {
    const res = run.results[k], place = res ? res.indexOf('You') + 1 : 0;
    return `<li class="${k === run.round && !done ? 'now' : ''}"><span class="lg-n">${k + 1}</span><span class="lg-st"><b>${esc(r.stage)}</b><small>${esc(objText(r.obj))}</small></span><span class="cr-stars">${starsOf(roundMask(S, ev, k))}</span><span class="lg-res">${place ? ordinal(place) : k === run.round ? 'Next' : ''}</span></li>`;
  }).join('');
  const rows = run.round ? table.map((s, i) => `<tr class="${s.name === 'You' ? 'me' : ''}"><td class="rp">${ordinal(i + 1)}</td><td>${esc(s.name)}${s.wins ? `<span class="rs">${s.wins} win${s.wins > 1 ? 's' : ''}</span>` : ''}</td><td class="rt">${s.pts} pts</td></tr>`).join('') : '';
  $('cr-body').innerHTML = `<ol class="lg-rounds cr-rounds">${rounds}</ol>${rows ? `<table class="lg-table">${rows}</table>` : ''}`;
  const car = vehicleById(S.car), next = roundsOf(ev)[run.round];
  $('cr-actions').innerHTML = `<button type="button" class="cr-drive" data-act="garage"><img data-car="${car.id}" alt="" width="120" height="75"><span><b>${esc(car.name)}</b><small>Change car</small></span></button>`
    + (done ? `<button type="button" class="cta" data-act="reset">Race it again</button>` : `<button type="button" class="cta" data-act="race">Race round ${run.round + 1}: ${esc(next.stage)}</button>`)
    + `<div class="btn-row">${run.round && !done ? `<button type="button" class="btn" data-act="reset">Start over</button>` : ''}<button type="button" class="btn" data-act="hub">All events</button></div>`;
}

// ---------- the garage: your cars and the showroom ----------
function drawGarage() {
  $('cr-title').textContent = 'Garage'; $('cr-sub').textContent = 'Your cars and the showroom. New cars arrive in the showroom as you open each tier.';
  const mine = VEHICLES.filter(v => S.cars[v.id]), sale = forSale(S), top = topTier(S);
  const later = Object.keys(SHOP).filter(id => !S.cars[id] && SHOP[id].tier > top).sort((a, b) => SHOP[a].price - SHOP[b].price);
  const own = mine.map(v => carCard(v, v.id === S.car ? `<span class="cr-tag">Driving</span>` : `<button type="button" class="btn" data-act="drive" data-id="${v.id}">Drive this</button>`, v.id === S.car ? 'on' : '')).join('');
  const shop = sale.sort((a, b) => SHOP[a].price - SHOP[b].price).map(id => { const v = vehicleById(id), p = SHOP[id].price;
    return carCard(v, S.cash >= p ? `<button type="button" class="cta" data-act="buy" data-id="${id}">Buy · ${money(p)}</button>` : `<span class="cr-tag dim">${money(p)} · ${money(p - S.cash)} to go</span>`); }).join('');
  const soon = later.map(id => carCard(vehicleById(id), `<span class="cr-tag dim">${money(SHOP[id].price)} · opens in ${esc(TIERS[SHOP[id].tier].name)}</span>`, 'locked')).join('');
  $('cr-body').innerHTML = `<h3 class="cr-h">Your cars</h3><div class="cr-cars">${own}</div>${shop ? `<h3 class="cr-h">Showroom</h3><div class="cr-cars">${shop}</div>` : ''}${soon ? `<h3 class="cr-h">Coming later</h3><div class="cr-cars">${soon}</div>` : ''}`;
  $('cr-actions').innerHTML = `<div class="btn-row"><button type="button" class="cta" data-act="back">Done</button></div>`;
}

let back = { v: 'hub', tier: 0 };
function act(b) {
  const a = b.dataset.act;
  if (a === 'close') closeCareer();
  else if (a === 'starter') { store(newCareer(b.dataset.id)); view = { v: 'hub', tier: 0 }; draw(); }
  else if (a === 'tier') { view = { v: 'hub', tier: +b.dataset.i }; draw(); }
  else if (a === 'event') { view = { v: 'event', id: b.dataset.id }; draw(); }
  else if (a === 'hub') { view = { v: 'hub', tier: tierOf(eventById(view.id)) }; draw(); }
  else if (a === 'garage') { back = view; view = { v: 'garage' }; draw(); }
  else if (a === 'back') { view = back; draw(); }
  else if (a === 'drive') { store(selectCar(S, b.dataset.id)); draw(); }
  else if (a === 'buy') { const s = buyCar(S, b.dataset.id); if (s) { store(s); draw(); } }
  else if (a === 'race') raceRound(view.id);
  else if (a === 'reset') { const ev = eventById(view.id); store({ ...S, cups: { ...S.cups, [ev.id]: { id: ev.id, round: 0, pts: {}, results: [] } } }); if (b.classList.contains('cta')) raceRound(ev.id); else draw(); }
  else if (a === 'restart') { if (window.confirm('Start a new career? Your cars, cash and stars will be lost.')) { store(null); view = { v: 'start' }; draw(); } }
}
function raceRound(id) {
  const ev = eventById(id), run = cupRun(ev); if (cupDone(ev, run)) return;
  G.career = { ev: ev.id, k: run.round }; $('career').hidden = true;
  startRace(stageIdx(roundsOf(ev)[run.round].stage));
}
export function wireCareer() {
  $('career-btn').addEventListener('click', () => openCareer(S ? { v: 'hub', tier: topTier(S) } : { v: 'start' }));
  $('career').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && !b.disabled) act(b); });
  G.onCareerMenu = c => openCareer({ v: 'event', id: c.ev });   // leaving a career race comes back to its event
}

// ---------- the race ----------
/** The race defs for the career round being raced (ui/flow.js newRace). */
export function careerRaceDefs() {
  const c = G.career, ev = eventById(c.ev), run = cupRun(ev);
  return careerDefs(S, ev, run.round > 0 ? standings(run, careerDefs(S, ev).map(d => d.name)).map(s => s.name) : null);
}
/** Score the career round just finished (called by showResults): stars, cash, the cup table, unlocks. */
export function careerResults() {
  const c = G.career; if (!c || !S || race.sd) return false;
  const ev = eventById(c.ev), order = ranking(race), place = order.indexOf(race.player) + 1, n = order.length, t = G.tally;
  const tierWas = topTier(S), out = scoreRace(S, ev, c.k, place, n, t); let s = out.state, trophy = 0, tcash = 0;
  const run = scoreRound(cupRun(ev), order.map(x => x.name)); s = { ...s, cups: { ...s.cups, [ev.id]: run } };
  const done = cupDone(ev, run), cupPlace = standings(run).findIndex(x => x.name === 'You') + 1;
  if (done) { const a = awardTrophy(s, ev, cupPlace); s = a.state; tcash = a.cash; trophy = cupPlace <= 3 ? cupPlace : 0; }
  store(s); G.career = { ...c, done };
  const opened = topTier(S) > tierWas ? TIERS[topTier(S)] : null, o = roundsOf(ev)[c.k].obj;
  $('res-stage').textContent = `${ev.name} · round ${c.k + 1} of ${roundsOf(ev).length}: ${G.world.stage.name}`;
  const labels = [`Podium (top ${podiumOf(n)})`, 'Win', objText(o)];
  const starsHTML = `<div class="cr-res-stars">${[1, 2, 4].map((b, i) => `<span class="${out.stars & b ? 'got' : ''}">${star(out.stars & b, out.fresh & b)}<small>${esc(labels[i])}</small></span>`).join('')}</div>`;
  const lines = out.lines.map(([l, v]) => `<tr><td>${esc(l)}</td><td class="rt">${money(v)}</td></tr>`).join('') + (tcash ? `<tr><td>${['', 'Gold', 'Silver', 'Bronze'][trophy]} trophy</td><td class="rt">${money(tcash)}</td></tr>` : '');
  const news = [done ? (cupPlace <= 3 ? `${['', 'Gold', 'Silver', 'Bronze'][cupPlace]} trophy: you finished the ${ev.name} ${ordinal(cupPlace)}!` : `You finished the ${ev.name} ${ordinal(cupPlace)}.`) : '', opened ? `${opened.name} tier open! New events and new cars in the showroom.` : ''].filter(Boolean);
  const rows = standings(run).map((x, i) => `<tr class="${x.name === 'You' ? 'me' : ''}"><td class="rp">${ordinal(i + 1)}</td><td>${esc(x.name)}<span class="rs">${ordinal(order.findIndex(y => y.name === x.name) + 1)} this round</span></td><td class="rt">${x.pts}</td></tr>`).join('');
  $('res-career').innerHTML = `${starsHTML}<table class="cr-cash">${lines}<tr class="tot"><td>Total</td><td class="rt">${money(out.cash + tcash)}</td></tr></table><p class="cr-bank">Bank ${money(S.cash)}</p>${news.map(x => `<p class="cr-news">${esc(x)}</p>`).join('')}`;
  $('res-career').hidden = false;
  $('res-league').innerHTML = `<b>${done ? 'Final standings' : 'Standings'}</b><table class="lg-table">${rows}</table>`; $('res-league').hidden = false; $('res-table').hidden = true;
  $('next-btn').textContent = done ? 'Back to Career' : `Next round: ${roundsOf(ev)[run.round].stage}`;
  $('again-btn').hidden = true; $('menu-btn').textContent = 'Career menu';
  return true;
}
/** The results screen's Next button during a career event: the next round, or back to the event screen. */
export function careerNext() {
  const c = G.career; if (!c) return false;
  const ev = eventById(c.ev), run = cupRun(ev);
  if (cupDone(ev, run)) { toMenu(); return true; }   // toMenu brings the event screen back (G.onCareerMenu)
  G.career = { ev: ev.id, k: run.round }; startRace(stageIdx(roundsOf(ev)[run.round].stage));
  return true;
}
