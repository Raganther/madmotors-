import { G } from '../game.js';
import { LEAGUES, LEAGUE_POINTS, leagueById, leagueDone, newLeague, scoreRound, standings } from '../data/leagues.js';
import { STAGES } from '../data/stages/index.js';
import { vehicleById } from '../data/vehicles.js';
import { ranking } from '../core/sim/race.js';
import { $ } from './dom.js';
import { ordinal } from './format.js';
import { openGarage, showVehicle, suited } from './garage.js';
import { loadLeagues, saveLeagues } from './storage.js';
import { race, refreshBest, selected, startRace, toMenu } from './flow.js';

// Leagues (data/leagues.js): pick one, choose a car for each round, race the rounds in order for points. A run in
// progress is kept per league in localStorage, so you can leave for the menu and carry on later. While a round is
// being raced G.league is that run: newRace (ui/flow.js) makes it a Race against the league field.
let runs = loadLeagues(), view = null;   // view: null = the list of leagues, else the id of the league shown
const stageIdx = name => STAGES.findIndex(s => s.name === name);
const carFor = name => G.stageCars[name] || G.defaultVehicle;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const runOf = id => runs[id] || newLeague(id);
const store = run => { runs[run.id] = run; saveLeagues(runs); };
const myPlace = run => standings(run, ['You']).findIndex(s => s.name === 'You') + 1;

export function openLeagues(id = view) { view = id && leagueById(id) ? id : null; draw(); $('league').hidden = false; const f = $('league').querySelector('.cta, .lg-item'); if (f) f.focus(); }
export function closeLeagues() { $('league').hidden = true; $('league-btn').focus(); }
function draw() {
  const L = view && leagueById(view);
  if (!L) {
    $('lg-title').textContent = 'Leagues'; $('lg-sub').textContent = 'A championship over a run of stages. Points for every place, and you choose the car for each round.';
    $('lg-body').innerHTML = `<div class="lg-list">${LEAGUES.map(l => {
      const r = runs[l.id], n = l.stages.length;
      const prog = !r || !r.round ? 'Not started' : leagueDone(r) ? `Finished ${ordinal(myPlace(r))}${myPlace(r) === 1 ? ': champion!' : ''}` : `Round ${r.round + 1} of ${n} · you're ${ordinal(myPlace(r))} on ${r.pts.You || 0} pts`;
      return `<button type="button" class="lg-item" data-act="open" data-id="${l.id}"><b>${esc(l.name)}</b><span>${esc(l.blurb)}</span><small>${n} rounds: ${l.stages.map(esc).join(' · ')}</small><em>${prog}</em></button>`;
    }).join('')}</div>`;
    $('lg-actions').innerHTML = `<button type="button" class="btn" data-act="close">Back</button>`;
    return;
  }
  const run = runOf(L.id), done = leagueDone(run), table = standings(run, ['You']);
  $('lg-title').textContent = L.name;
  $('lg-sub').textContent = done ? (table[0].name === 'You' ? 'You are the champion!' : `${table[0].name} takes the title. You finished ${ordinal(myPlace(run))}.`)
    : `${L.blurb}. ${LEAGUE_POINTS.slice(0, 3).join(', ')}... points down to 8th; the leader starts at the back.`;
  const rounds = L.stages.map((name, k) => {
    const res = run.results[k], place = res ? res.indexOf('You') + 1 : 0, st = STAGES[stageIdx(name)], v = vehicleById(carFor(name)), good = suited(stageIdx(name)).includes(v.id);
    const state = res ? `${ordinal(place)} <small>+${LEAGUE_POINTS[place - 1] || 0}</small>` : k === run.round ? 'Next' : '';
    return `<li class="${k === run.round && !done ? 'now' : ''}"><span class="lg-n">${k + 1}</span><span class="lg-st"><b>${esc(name)}</b><small>${st.laps ? 'Circuit' : 'Downhill'}, ${st.surface}</small></span>`
      + `<button type="button" class="lg-car${good ? ' good' : ''}" data-act="car" data-i="${k}" title="Change the car for this round">${esc(v.name)}</button><span class="lg-res">${state}</span></li>`;
  }).join('');
  const rows = run.round ? table.map((s, i) => `<tr class="${s.name === 'You' ? 'me' : ''}"><td class="rp">${ordinal(i + 1)}</td><td>${esc(s.name)}${s.wins ? `<span class="rs">${s.wins} win${s.wins > 1 ? 's' : ''}</span>` : ''}</td><td class="rt">${s.pts} pts</td></tr>`).join('') : '';
  $('lg-body').innerHTML = `<ol class="lg-rounds">${rounds}</ol>${rows ? `<table class="lg-table">${rows}</table>` : ''}`;
  const next = L.stages[run.round];
  $('lg-actions').innerHTML = (done ? `<button type="button" class="cta" data-act="reset">Race it again</button>` : `<button type="button" class="cta" data-act="race">Race round ${run.round + 1}: ${esc(next)}</button>`)
    + `<div class="btn-row">${run.round && !done ? `<button type="button" class="btn" data-act="reset">Start over</button>` : ''}<button type="button" class="btn" data-act="list">All leagues</button></div>`;
}
// the garage for one round's stage: the pick is saved for that stage, then the menu's stage comes back
let pickFor = -1;
function chooseCar(k) {
  const i = stageIdx(leagueById(view).stages[k]); pickFor = i; G.stageSel = i; showVehicle(carFor(STAGES[i].name));
  $('league').hidden = true; openGarage('league-btn');
}
function garageClosed() {
  if (pickFor < 0) return;
  pickFor = -1; G.stageSel = selected; showVehicle(carFor(STAGES[selected].name)); refreshBest();
  openLeagues(view);
}
function raceRound() {
  const run = runOf(view); if (leagueDone(run)) return;
  store(run); G.league = run; $('league').hidden = true;
  startRace(stageIdx(leagueById(run.id).stages[run.round]));
}
export function wireLeagues() {
  G.onGarageClose = garageClosed;
  $('league-btn').addEventListener('click', () => openLeagues(null));
  $('league').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act;
    if (act === 'close') closeLeagues();
    else if (act === 'open') openLeagues(b.dataset.id);
    else if (act === 'list') openLeagues(null);
    else if (act === 'car') chooseCar(+b.dataset.i);
    else if (act === 'race') raceRound();
    else if (act === 'reset') { store(newLeague(view)); if (b.classList.contains('cta')) raceRound(); else draw(); }
  });
}
// ---------- the results screen during a league round ----------
/** Score the round just finished and show where the championship stands; called by showResults. */
export function leagueResults() {
  const lg = G.league; if (!lg || race.sd) return false;
  const L = leagueById(lg.id), before = lg, order = ranking(race).map(c => c.name), run = scoreRound(before, order);
  store(run); G.league = run;
  const got = n => (run.pts[n] || 0) - (before.pts[n] || 0), done = leagueDone(run);
  $('res-stage').textContent = `${L.name} · round ${before.round + 1} of ${L.stages.length}: ${G.world.stage.name}`;
  const rows = standings(run).map((s, i) => `<tr class="${s.name === 'You' ? 'me' : ''}"><td class="rp">${ordinal(i + 1)}</td><td>${esc(s.name)}<span class="rs">${ordinal(order.indexOf(s.name) + 1)} this round</span></td><td class="rt">${s.pts}<small> +${got(s.name)}</small></td></tr>`).join('');
  $('res-league').innerHTML = `<b>${done ? 'Final standings' : 'Championship'}</b><table class="lg-table">${rows}</table>`; $('res-league').hidden = false; $('res-table').hidden = true;   // one table: the round is in it
  $('next-btn').textContent = done ? (standings(run)[0].name === 'You' ? 'You are the champion!' : 'Final standings') : `Next round: ${L.stages[run.round]}`;
  $('again-btn').hidden = true; $('menu-btn').textContent = 'Leave for the menu';
  return true;
}
/** The results screen's Next button during a league: the next round, or the league screen once it's over. */
export function leagueNext() {
  const run = G.league; if (!run) return false;
  if (leagueDone(run)) { toMenu(); openLeagues(run.id); return true; }
  startRace(stageIdx(leagueById(run.id).stages[run.round]));
  return true;
}
/** Restore the results screen's normal buttons (after a league round). */
export function resetResultsUI() { $('res-league').hidden = true; $('res-table').hidden = false; $('again-btn').hidden = false; $('menu-btn').textContent = 'Choose stage'; }
