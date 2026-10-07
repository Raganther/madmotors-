import { G } from '../game.js';
import { DUEL_GAP, PAINTS, PAINT_PRICE, SHOP, STARTERS, TIERS, allowed, awardTrophy, beaten, bossOf, buyCar, armoury, buyUpgrade, buyWeapon, canEnter, careerPlayer, fitGear, fitTyres, weaponLevel, careerDefs, eventById, eventMaxStars, eventOpen, eventStars, forSale, medals, newCareer, objText, paintCar, podiumOf, roundMask, roundsOf, scoreRace, selectCar, tierMaxStars, tierOf, tierOpen, tierStars, topTier, totalStars, upgLevel, upgradedVeh } from '../data/career.js';
import { scoreRound, standings } from '../data/leagues.js';
import { STAGES } from '../data/stages/index.js';
import { VEHICLES, vehicleById } from '../data/vehicles.js';
import { ranking } from '../core/sim/race.js';
import { derbyOrder } from '../core/modes/derby.js';
import { vehicleThumb } from '../render/thumbs.js';
import { showCar } from '../render/showcar.js';
import { PART_MAX, SLOTS, TYRE_KINDS, buildOf } from '../data/parts.js';
import { DISCIPLINES, discsOf, entryWhy } from '../data/disciplines.js';
import { ratingOf } from '../data/ratings.js';
import { DESTRUCT, FORMATS, formatOf } from '../data/formats.js';
import { scoreOrder } from '../data/scoring.js';
import { GEAR, GEAR_IDS, GEAR_PRICE, WEAPONS, WEAPON_MAX, WEAPON_PRICE } from '../data/weapons.js';
import { $ } from './dom.js';
import { fmt, ordinal } from './format.js';
import { statsHTML } from './garage.js';
import { loadCareer, saveCareer } from './storage.js';
import { race, startRace, toMenu } from './flow.js';

// Career (data/career.js): the menu's Career button. Pick a starter car, then the hub shows the four tiers and their
// events (cups, specials, the boss); an event screen lists its rounds with the stars earned and the objective; the
// garage holds your cars (upgrades, paint) and the showroom. While a career round is raced G.career is { ev, k } (the
// event id and round) and G.tally counts the player's big airs, drift boosts, weapon hits, wrecks and resets for the
// results (ui/flow.js handleEvents).
let S = loadCareer(), view = { v: 'hub', tier: 0 }, last = '';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const money = n => '$' + Math.round(n).toLocaleString('en-US');
const star = (on, fresh) => `<i class="cr-star${on ? ' on' : ''}${fresh ? ' new' : ''}">★</i>`;
const starsOf = (mask, fresh = 0) => [1, 2, 4].map(b => star(mask & b, fresh & b)).join('');
const stageIdx = name => STAGES.findIndex(s => s.name === name);
const isCup = ev => ev.kind === 'cup';
const cupRun = ev => (S.cups[ev.id]) || { id: ev.id, round: 0, pts: {}, results: [] };
const cupDone = (ev, run = cupRun(ev)) => isCup(ev) && run.round >= roundsOf(ev).length;
const store = s => { S = s; saveCareer(S); };
const MEDAL = ['Bronze', 'Silver', 'Gold'], TROPHY = ['', 'Gold', 'Silver', 'Bronze'];
/** The career state (for tests and the results screen). */
export const career = () => S;
/** What a single event is, in a few words. */
function kindText(ev) {
  if (ev.kind === 'trial') return 'Time trial';
  if (ev.kind === 'mode') return { showdown: 'Showdown', deuce: 'Deuce', tiebreak: 'Tiebreak', derby: 'Derby, derby cars only' }[ev.mode];
  if (ev.kind === 'onemake') return `One-make ${ev.format ? FORMATS[ev.format].name.toLowerCase() : 'race'}: ${vehicleById(ev.make).name}`;
  if (ev.kind === 'boss') return `Duel: ${ev.driver} in the ${vehicleById(ev.vehicle).name}`;
  if (ev.kind === 'final') return 'The final';
  const fmt = ev.format ? FORMATS[ev.format].name + ', ' : '';
  return ev.disc ? `${fmt}${DISCIPLINES[ev.disc].name} cars only${ev.maxPace ? `, pace ${ev.maxPace} or below` : ''}${ev.maxTough ? `, toughness ${ev.maxTough} or below` : ''}` : ev.format ? FORMATS[ev.format].name + ' cup' : 'Cup';
}

export function openCareer(v) { S = loadCareer(); v = v || (S ? view : { v: 'start' }); view = S ? v : { v: 'start' }; draw(); $('career').hidden = false; const f = $('career').querySelector('.cta, .cr-item, .cr-tab'); if (f) f.focus({ preventScroll: true }); $('cr-body').scrollTop = 0; }
export function closeCareer() { $('career').hidden = true; $('career-btn').focus(); }
function draw(fitted = false) {
  $('cr-wallet').innerHTML = S ? `<b>${money(S.cash)}</b><span>${star(1)} ${totalStars(S)}</span>` : '';
  ({ start: drawStart, hub: drawHub, event: drawEvent, garage: drawGarage, car: drawCar })[view.v](fitted);
  if (view.v !== last) { $('cr-body').scrollTop = 0; last = view.v; }
  pictures();
}
// the livery a car wears in the career: its paint job if it has one
const skinned = id => { const v = vehicleById(id), own = S && S.cars[id], p = own && PAINTS[own.paint]; return { ...v, ...(p ? { color: p.color, accent: p.accent } : {}), build: buildOf(own) }; };   // with its parts on
// car pictures load one at a time after the screen is drawn, so it opens straight away
function pictures() {
  const imgs = [...$('career').querySelectorAll('img[data-car]')]; let k = 0;
  const next = () => { if (k >= imgs.length) return; const im = imgs[k++]; try { im.src = vehicleThumb(im.dataset.stock ? vehicleById(im.dataset.car) : skinned(im.dataset.car)); } catch (e) { /* no WebGL: the name is enough */ } setTimeout(next, 0); };
  next();
}
// a car's card: picture, name, class chips, stat bars (with your upgrades on a car you own), then `foot` (buttons)
// a car's disciplines and its ratings (data/disciplines.js, data/ratings.js), with its parts on if it's yours
const own = id => S && S.cars[id] ? buildOf(S.cars[id]) : null;
const rateChip = id => { const r = ratingOf(id, own(id)); return `<span class="cr-rate" title="Pace: ${r.tarmac > 0 ? '+' : ''}${r.tarmac}% on tarmac, ${r.loose > 0 ? '+' : ''}${r.loose}% on loose ground against the stock coupe. Toughness: ${r.tough}× the coupe (D C B A S)">Pace <b class="b${r.bands.tarmac}">${r.bands.tarmac}</b>/<b class="b${r.bands.loose}">${r.bands.loose}</b> Tough <b class="b${r.bands.tough}">${r.bands.tough}</b></span>`; };
const chips = id => discsOf(id, own(id)).map(k => `<span class="cr-cls">${DISCIPLINES[k].name}</span>`).join('') + rateChip(id);
const pips = (L, max = PART_MAX) => Array.from({ length: max }, (_, i) => `<i class="cr-pip${i < L ? ' on' : ''}"></i>`).join('');
const upgSum = id => { const on = S && S.cars[id] ? SLOTS.filter(u => upgLevel(S, id, u.id)) : []; return on.length ? `<span class="cr-upgs">${on.map(u => `<span title="${esc(u.looks[upgLevel(S, id, u.id) - 1])}">${u.name}${pips(upgLevel(S, id, u.id))}</span>`).join('')}</span>` : ''; };
const carCard = (v, foot, cls = '', note = '') => `<div class="cr-car ${cls}"><img data-car="${v.id}" alt="" width="240" height="150"><b>${esc(v.name)}</b><span class="cr-chips">${chips(v.id)}${note}</span>`
  + `<span class="g-blurb">${esc(v.blurb)}</span><span class="g-stats">${statsHTML({ ...v, veh: upgradedVeh(v.id, S && S.cars[v.id]) })}</span>${upgSum(v.id)}${foot}</div>`;

// ---------- a new career: choose the starter ----------
function drawStart() {
  $('cr-title').textContent = 'Career'; $('cr-sub').textContent = 'Start in the Rookie tier with one cheap car. Win races for cash and stars: cash buys cars and upgrades, stars open each tier\'s boss, and beating the boss opens the next tier. Choose your first car.';
  $('cr-body').innerHTML = `<div class="cr-cars">${STARTERS.map(id => carCard(vehicleById(id), `<button type="button" class="cta" data-act="starter" data-id="${id}">Start with this</button>`)).join('')}</div>`;
  $('cr-actions').innerHTML = `<div class="btn-row"><button type="button" class="btn" data-act="close">Back</button></div>`;
}

// ---------- the hub: tiers and their events ----------
function eventItem(ev, open) {
  const n = roundsOf(ev).length, tro = S.trophies[ev.id], ok = open && eventOpen(S, ev), ti = tierOf(ev);
  let prog;
  if (isCup(ev)) { const run = cupRun(ev); prog = cupDone(ev, run) ? `Finished ${ordinal(standings(run, ['You']).findIndex(s => s.name === 'You') + 1)}` : run.round ? `Round ${run.round + 1} of ${n}` : `${n} rounds`; }
  else if (ev.kind === 'trial') prog = S.best && S.best[ev.id] ? `Best ${fmt(S.best[ev.id])}` : 'Not run yet';
  else if (ev.kind === 'boss' || ev.kind === 'final') prog = beaten(S, ev) ? 'Beaten' : ok ? 'Ready' : ev.kind === 'boss' ? `Needs ★ ${ev.need} in ${TIERS[ti].name} (you have ${tierStars(S, TIERS[ti])})` : `Beat ${bossOf(TIERS[ti]).driver} first`;
  else prog = roundMask(S, ev, 0) ? 'Raced' : 'One race';
  const cls = ev.kind === 'boss' || ev.kind === 'final' ? ' cr-boss' : isCup(ev) ? '' : ' cr-special';
  return `<button type="button" class="cr-item lg-item${cls}" data-act="event" data-id="${ev.id}"${ok ? '' : ' disabled'}><b>${esc(ev.name)}${tro ? ` <span class="cr-trophy t${tro}">${TROPHY[tro]}</span>` : ''}${beaten(S, ev) ? ' <span class="cr-trophy t1">Beaten</span>' : ''}</b>`
    + `<span class="cr-kind">${esc(kindText(ev))}</span><span>${esc(ev.blurb)}</span><small>${roundsOf(ev).map(r => esc(r.stage)).join(' · ')}</small><em>${prog} · ★ ${eventStars(S, ev)}/${eventMaxStars(ev)}</em></button>`;
}
function drawHub() {
  const ti = Math.min(view.tier, TIERS.length - 1), T = TIERS[ti], open = tierOpen(S, ti), car = vehicleById(S.car);
  $('cr-title').textContent = S.champion ? 'Career · Champion' : 'Career';
  $('cr-sub').textContent = `${S.champion ? 'Champion of Champions! ' : ''}Driving the ${car.name}. ${S.races ? `${S.races} races, ${S.wins} wins, ${money(S.earned)} earned.` : 'Pick an event to start.'}`;
  const tabs = TIERS.map((t, i) => `<button type="button" class="cr-tab" data-act="tier" data-i="${i}" aria-pressed="${i === ti}"${tierOpen(S, i) ? '' : ' data-locked="1"'}><b>${esc(t.name)}</b><small>${tierOpen(S, i) ? `★ ${tierStars(S, t)}/${tierMaxStars(t)}` : 'Locked'}</small></button>`).join('');
  const prevBoss = ti > 0 && bossOf(TIERS[ti - 1]);
  const lock = open ? '' : `<p class="cr-lock">Beat ${esc(prevBoss.driver)}, the ${esc(TIERS[ti - 1].name)} boss, to open ${esc(T.name)}.</p>`;
  const group = (title, evs) => evs.length ? `<h3 class="cr-h">${title}</h3><div class="lg-list">${evs.map(ev => eventItem(ev, open)).join('')}</div>` : '';
  $('cr-body').innerHTML = `<div class="cr-tabs">${tabs}</div><p class="cr-tier">${esc(T.blurb)}. Rivals ${Math.round(T.skill * 100)}% sharp${T.upg ? `, their cars at upgrade level ${T.upg}` : ', stock cars'}; prize money ×${T.pay}.</p>${lock}`
    + group('Cups', T.events.filter(isCup)) + group('Specials', T.events.filter(e => ['trial', 'mode', 'onemake'].includes(e.kind))) + group(ti === TIERS.length - 1 ? 'Boss and final' : 'Boss', T.events.filter(e => e.kind === 'boss' || e.kind === 'final'));
  $('cr-actions').innerHTML = `<button type="button" class="cta" data-act="garage">Garage &amp; showroom</button><div class="btn-row"><button type="button" class="btn" data-act="close">Back to the menu</button><button type="button" class="btn cr-quiet" data-act="restart">New career</button></div>`;
}

// ---------- an event: its rounds, stars and objectives, the standings ----------
function starLabels(ev, k, n) {
  if (ev.kind === 'trial') return medals(ev.par).map((x, i) => `${MEDAL[i]} ${fmt(x)}`);
  return [n > 2 ? `Podium (top ${podiumOf(n)})` : `Within ${DUEL_GAP} s of ${ev.driver || 'the winner'}`, ev.kind === 'boss' ? `Beat ${ev.driver}` : 'Win', objText(roundsOf(ev)[k].obj)];
}
function drawEvent() {
  const ev = eventById(view.id), run = cupRun(ev), cup = isCup(ev), done = cupDone(ev, run), T = TIERS[tierOf(ev)];
  $('cr-title').textContent = ev.name;
  const rules = cup ? 'Points 10-8-6-5-4-3-2-1 each round; top three win a trophy. Every round: a star for a podium, one for the win, one for its objective.'
    : ev.kind === 'trial' ? 'No rivals: a star for each medal time.'
      : ev.kind === 'boss' ? `One on one. ${ev.driver}'s ${vehicleById(ev.vehicle).name} carries upgrade level ${T.upg}, and the driver is sharper than the field. Win for the ${vehicleById(ev.vehicle).name}, a purse and the next tier.`
        : ev.kind === 'final' ? 'Seven rivals, all four bosses among them, every car fully upgraded. Win for the gold Stretch Limo and the title.'
          : ev.kind === 'onemake' ? `Everyone drives a stock ${vehicleById(ev.make).name}: we lend you one. Stars: podium, win, objective.`
            : ev.mode === 'derby' ? 'Six cars, no laps: a wrecked car is out, the last one running wins (at the bell, the least damaged). Stars: a podium, the win, the objective.'
              : 'Stars: a podium (top two of four), the win, the objective.';
  const F = FORMATS[formatOf(ev)], fmtRule = F.weight.destruct > 0 ? ` ${F.name}: placed on race points plus ${F.weight.destruct}× destruction points (${(P => `a rival wrecked ${P.wreck}, a panel torn off ${P.panel}, a fence or gate smashed ${P.smash}, a road car taken out ${P.takedown}`)({ ...DESTRUCT, ...F.pts })}), and paid for both.` : '';
  $('cr-sub').textContent = `${T.name} tier · ${kindText(ev)}. ${ev.blurb}. ${rules}${fmtRule}`;
  const rounds = roundsOf(ev).map((r, k) => {
    const res = run.results[k], place = cup && res ? res.indexOf('You') + 1 : 0, labels = starLabels(ev, k, careerDefs(S, ev).length);
    const sub = ev.kind === 'trial' ? `${labels.join(' · ')}${S.best && S.best[ev.id] ? ` · best ${fmt(S.best[ev.id])}` : ''}` : objText(r.obj);
    return `<li class="${cup && k === run.round && !done ? 'now' : ''}"><span class="lg-n">${k + 1}</span><span class="lg-st"><b>${esc(r.stage)}</b><small>${esc(sub)}</small></span><span class="cr-stars">${starsOf(roundMask(S, ev, k))}</span><span class="lg-res">${place ? ordinal(place) : cup && k === run.round ? 'Next' : ''}</span></li>`;
  }).join('');
  const table = standings(run, ['You']), rows = cup && run.round ? table.map((s, i) => `<tr class="${s.name === 'You' ? 'me' : ''}"><td class="rp">${ordinal(i + 1)}</td><td>${esc(s.name)}${s.wins ? `<span class="rs">${s.wins} win${s.wins > 1 ? 's' : ''}</span>` : ''}</td><td class="rt">${s.pts} pts</td></tr>`).join('') : '';
  const rival = ev.kind === 'boss' ? `<div class="cr-rival"><img data-car="${ev.vehicle}" data-stock="1" alt="" width="240" height="150"><span><b>${esc(ev.driver)}</b><small>${esc(vehicleById(ev.vehicle).name)}${beaten(S, ev) ? ' · beaten' : ' · the prize'}</small></span></div>` : '';
  $('cr-body').innerHTML = `${rival}<ol class="lg-rounds cr-rounds">${rounds}</ol>${rows ? `<table class="lg-table">${rows}</table>` : ''}`;
  const lent = ev.make ? vehicleById(ev.make) : null, car = lent || vehicleById(S.car), ok = canEnter(S, ev), fits = Object.keys(S.cars).filter(id => allowed(ev, id, own(id)));
  const next = roundsOf(ev)[cup ? Math.min(run.round, roundsOf(ev).length - 1) : 0];
  const why = ok ? '' : `<p class="cr-lock">${esc(ev.name)} is ${esc(entryWhy(ev, S.car, own(S.car)))}: ${fits.length ? 'pick one of yours in the garage' : 'buy one in the showroom'}.</p>`;
  const drive = lent ? `<div class="cr-drive"><img data-car="${lent.id}" data-stock="1" alt="" width="120" height="75"><span><b>${esc(lent.name)}</b><small>Lent for this race, stock</small></span></div>`
    : `<button type="button" class="cr-drive" data-act="garage"><img data-car="${car.id}" alt="" width="120" height="75"><span><b>${esc(car.name)}</b><small>${ok ? 'Change car' : 'Not allowed here: change car'}</small></span>${upgSum(car.id)}</button>`;
  const go = cup ? (done ? `<button type="button" class="cta" data-act="reset"${ok ? '' : ' disabled'}>Race it again</button>` : `<button type="button" class="cta" data-act="race"${ok ? '' : ' disabled'}>Race round ${run.round + 1}: ${esc(next.stage)}</button>`)
    : `<button type="button" class="cta" data-act="race"${ok ? '' : ' disabled'}>${roundMask(S, ev, 0) || beaten(S, ev) ? 'Race again' : 'Race'}: ${esc(next.stage)}</button>`;
  $('cr-actions').innerHTML = why + drive + go + `<div class="btn-row">${cup && run.round && !done ? '<button type="button" class="btn" data-act="reset">Start over</button>' : ''}<button type="button" class="btn" data-act="hub">All events</button></div>`;
}

// ---------- the garage: your cars and the showroom ----------
function drawGarage() {
  const ev = back.v === 'event' ? eventById(back.id) : null, fit = id => ev && ev.disc ? (allowed(ev, id, own(id)) ? `<span class="cr-cls fit">Fits ${esc(ev.name)}</span>` : '') : '';
  $('cr-title').textContent = 'Garage'; $('cr-sub').textContent = `Your cars, their upgrades and paint, and the showroom. New cars arrive as you open each tier; bosses give you theirs.${ev && ev.disc ? ` ${ev.name} takes ${DISCIPLINES[ev.disc].name.toLowerCase()} cars only.` : ''}`;
  const mine = VEHICLES.filter(v => S.cars[v.id]), sale = forSale(S), top = topTier(S);
  const later = Object.keys(SHOP).filter(id => !S.cars[id] && SHOP[id].tier > top).sort((a, b) => SHOP[a].price - SHOP[b].price);
  const own = mine.map(v => carCard(v, `<span class="cr-btns">${v.id === S.car ? '<span class="cr-tag">Driving</span>' : `<button type="button" class="btn" data-act="drive" data-id="${v.id}">Drive this</button>`}<button type="button" class="btn" data-act="tune" data-id="${v.id}">Upgrades &amp; paint</button></span>`, v.id === S.car ? 'on' : '', fit(v.id))).join('');
  const shop = sale.sort((a, b) => SHOP[a].price - SHOP[b].price).map(id => { const v = vehicleById(id), p = SHOP[id].price;
    return carCard(v, S.cash >= p ? `<button type="button" class="cta" data-act="buy" data-id="${id}">Buy · ${money(p)}</button>` : `<span class="cr-tag dim">${money(p)} · ${money(p - S.cash)} to go</span>`, '', fit(id)); }).join('');
  const soon = later.map(id => carCard(vehicleById(id), `<span class="cr-tag dim">${money(SHOP[id].price)} · opens in ${esc(TIERS[SHOP[id].tier].name)}</span>`, 'locked')).join('');
  $('cr-body').innerHTML = `<h3 class="cr-h">Your cars</h3><div class="cr-cars">${own}</div>${shop ? `<h3 class="cr-h">Showroom</h3><div class="cr-cars">${shop}</div>` : ''}${soon ? `<h3 class="cr-h">Coming later</h3><div class="cr-cars">${soon}</div>` : ''}`;
  $('cr-actions').innerHTML = '<div class="btn-row"><button type="button" class="cta" data-act="back">Done</button></div>';
}

// ---------- one car: upgrades and paint ----------
// the car on a turntable (render/showcar.js) instead of its picture: one canvas, kept across redraws, so a part being
// fitted plays out on it (jacks up, part on, back down)
let showCv = null, shownId = null;
function drawCar(fitted = false) {
  const v = vehicleById(view.id), own = S.cars[v.id], cur = own.paint ?? -1, hex = c => '#' + c.toString(16).padStart(6, '0'), kind = own.tyrKind || 'road';
  $('cr-title').textContent = v.name; $('cr-sub').textContent = 'Seven kinds of part, three levels each, and you can see every one on the car. Rivals upgrade too: their cars carry the tier\'s level on engine, tyres and suspension (Club 1, Pro 2, Legend 3).';
  const rows = SLOTS.map(u => {
    const L = upgLevel(S, v.id, u.id), p = u.price[L];
    const btn = L >= PART_MAX ? '<span class="cr-tag">Maxed</span>' : S.cash >= p ? `<button type="button" class="cta" data-act="upg" data-u="${u.id}">Level ${L + 1} · ${money(p)}</button>` : `<span class="cr-tag dim">Level ${L + 1} · ${money(p)}</span>`;
    const kinds = u.kinds ? `<span class="cr-kinds">${Object.entries(u.kinds).map(([k, t]) => `<button type="button" class="btn" data-act="tyres" data-k="${k}" aria-pressed="${k === kind}" title="${esc(t.blurb)}">${t.name}</button>`).join('')}</span>` : '';
    const has = L ? `Fitted: ${u.looks[L - 1]}` : 'Stock', next = L < PART_MAX ? ` · next: ${u.looks[L]}` : '';
    return `<li><span class="cr-u"><b>${u.name}</b><small>${esc(u.kinds ? TYRE_KINDS[kind].blurb : u.blurb)}</small><small class="cr-look">${esc(has + next)}</small>${kinds}</span><span class="cr-pips">${pips(L)}</span>${btn}</li>`;
  }).join('');
  // the armoury: weapon levels (the car's signature weapon too), and one piece of gear
  const arms = armoury(v.id).map(w => {
    const W = WEAPONS[w], L = weaponLevel(S, v.id, w), p = WEAPON_PRICE[L];
    const btn = L >= WEAPON_MAX ? '<span class="cr-tag">Maxed</span>' : S.cash >= p ? `<button type="button" class="cta" data-act="wpn" data-w="${w}">Level ${L + 1} · ${money(p)}</button>` : `<span class="cr-tag dim">Level ${L + 1} · ${money(p)}</span>`;
    return `<li><span class="cr-u"><b>${W.name}${W.sig ? ' <span class="cr-cls">Signature</span>' : ''}</b><small>${esc(W.blurb)}</small><small class="cr-look">${esc(W.looks[L - 1] + (L < WEAPON_MAX ? ' · next: ' + W.looks[L] : ''))}</small></span><span class="cr-pips">${pips(L, WEAPON_MAX)}</span>${btn}</li>`;
  }).join('');
  const gears = GEAR_IDS.map(g => { const has = (own.gears || []).includes(g), on = own.gear === g;
    return `<button type="button" class="btn" data-act="gear" data-g="${g}" aria-pressed="${on}" title="${esc(GEAR[g].blurb)}"${!has && S.cash < GEAR_PRICE ? ' disabled' : ''}>${GEAR[g].name}${has ? '' : ' · ' + money(GEAR_PRICE)}</button>`; }).join('');
  const sw = (i, c, a, name) => `<button type="button" class="cr-sw" data-act="paint" data-p="${i}" title="${esc(name)}" aria-pressed="${i === cur}"${i !== cur && S.cash < PAINT_PRICE ? ' disabled' : ''}><i style="background:${hex(c)}"></i><i style="background:${hex(a)}"></i></button>`;
  const paints = sw(-1, v.color, v.accent, 'Stock livery') + PAINTS.map((p, i) => sw(i, p.color, p.accent, p.name)).join('');
  $('cr-body').innerHTML = `<div class="cr-tune">${carCard(v, '', v.id === S.car ? 'on' : '').replace(/<img [^>]*>/, '<div class="cr-show"></div>')}<div><ul class="cr-urows">${rows}</ul><h3 class="cr-h">Armoury <small>weapon levels, and one piece of gear that works by itself</small></h3><ul class="cr-urows">${arms}</ul><div class="cr-kinds cr-gear">${gears}</div><small class="cr-gearnote">${esc(own.gear ? GEAR[own.gear].blurb : 'No gear fitted')}</small><h3 class="cr-h">Paint shop <small>${money(PAINT_PRICE)} a respray</small></h3><div class="cr-paints">${paints}</div></div></div>`;
  $('cr-actions').innerHTML = `<div class="btn-row">${v.id === S.car ? '' : `<button type="button" class="btn" data-act="drive" data-id="${v.id}">Drive this</button>`}<button type="button" class="cta" data-act="garage2">Back to the garage</button></div>`;
  if (!showCv) { showCv = document.createElement('canvas'); showCv.width = 360; showCv.height = 225; }
  $('cr-body').querySelector('.cr-show').appendChild(showCv);
  try { showCar(showCv, careerPlayer(S, v.id), fitted && shownId === v.id); shownId = v.id; } catch (e) { /* no WebGL: the stats are enough */ }
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
  else if (a === 'tune') { view = { v: 'car', id: b.dataset.id }; draw(); }
  else if (a === 'garage2') { view = { v: 'garage' }; draw(); }
  else if (a === 'upg') { const s = buyUpgrade(S, view.id, b.dataset.u); if (s) { store(s); draw(true); } }
  else if (a === 'wpn') { const s = buyWeapon(S, view.id, b.dataset.w); if (s) { store(s); draw(); } }
  else if (a === 'gear') { const s = fitGear(S, view.id, b.dataset.g); if (s) { store(s); draw(); } }
  else if (a === 'tyres') { const s = fitTyres(S, view.id, b.dataset.k); if (s) { store(s); draw(true); } }
  else if (a === 'paint') { const s = paintCar(S, view.id, +b.dataset.p); if (s) { store(s); draw(true); } }
  else if (a === 'drive') { store(selectCar(S, b.dataset.id)); draw(); }
  else if (a === 'buy') { const s = buyCar(S, b.dataset.id); if (s) { store(s); draw(); } }
  else if (a === 'race') raceRound(view.id);
  else if (a === 'reset') { const ev = eventById(view.id); store({ ...S, cups: { ...S.cups, [ev.id]: { id: ev.id, round: 0, pts: {}, results: [] } } }); if (b.classList.contains('cta')) raceRound(ev.id); else draw(); }
  else if (a === 'restart') { if (window.confirm('Start a new career? Your cars, cash and stars will be lost.')) { store(null); view = { v: 'start' }; draw(); } }
}
function raceRound(id) {
  const ev = eventById(id), run = cupRun(ev); if (cupDone(ev, run) || !eventOpen(S, ev) || !canEnter(S, ev)) return;
  const k = isCup(ev) ? run.round : 0;
  G.career = { ev: ev.id, k }; $('career').hidden = true;
  startRace(stageIdx(roundsOf(ev)[k].stage));
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
  return careerDefs(S, ev, isCup(ev) && run.round > 0 ? standings(run, careerDefs(S, ev).map(d => d.name)).map(s => s.name) : null);
}
/** The mode of the career round being raced: 'race', or a Showdown / checkpoint special's mode. */
/** The format of the career round being raced (data/formats.js). */
export const careerFormat = () => { const ev = G.career && eventById(G.career.ev); return ev ? formatOf(ev) : 'race'; };
export const careerMode = () => { const ev = G.career && eventById(G.career.ev); return ev && ev.kind === 'mode' ? ev.mode : 'race'; };
// the finishing order: a Race by the flag, a Showdown by crown time, a checkpoint match by points (as the results table)
function finishOrder() {
  const R = race; if (R.derby) return derbyOrder(R); if (!R.sd) return ranking(R);
  const by = R.sd.kind === 'crown' ? R.sd.crown : R.sd.points;
  return R.cars.map((c, k) => ({ c, v: by[k] })).sort((a, b) => b.v - a.v || b.c.progress - a.c.progress).map(x => x.c);
}
/** Score the career round just finished (called by showResults): stars, cash, the cup table, unlocks, prizes. */
export function careerResults() {
  const c = G.career; if (!c || !S) return false;
  const ev = eventById(c.ev), cup = isCup(ev), fid = formatOf(ev), pi = race.cars.indexOf(race.player), scored = scoreOrder(finishOrder(), race.cars, G.tally, fid), order = scored.map(x => x.c), place = order.indexOf(race.player) + 1, n = order.length, t = { ...G.tally, ...G.tally.d[pi] }, P = race.player;
  const w = order[0], gap = P.finished && w.finished ? P.finishTime - w.finishTime : -1;
  const tierWas = topTier(S), out = scoreRace(S, ev, c.k, place, n, { ...t, gap }, P.finished ? P.finishTime : 0); let s = out.state, trophy = 0, tcash = 0, run = null, done = false, cupPlace = 0;
  if (cup) {
    run = scoreRound(cupRun(ev), order.map(x => x.name)); s = { ...s, cups: { ...s.cups, [ev.id]: run } };
    done = cupDone(ev, run); cupPlace = standings(run).findIndex(x => x.name === 'You') + 1;
    if (done) { const a = awardTrophy(s, ev, cupPlace); s = a.state; tcash = a.cash; trophy = cupPlace <= 3 ? cupPlace : 0; }
  }
  store(s); G.career = { ...c, done: done || !cup };
  const opened = topTier(S) > tierWas ? TIERS[topTier(S)] : null, labels = starLabels(ev, c.k, n);
  $('res-stage').textContent = cup ? `${ev.name} · round ${c.k + 1} of ${roundsOf(ev).length}: ${G.world.stage.name}` : `${ev.name} · ${kindText(ev)}: ${G.world.stage.name}`;
  if (ev.kind === 'trial') $('res-title').textContent = P.finished ? `${fmt(P.finishTime)}${out.stars ? `: ${MEDAL[(out.stars & 4 ? 3 : out.stars & 2 ? 2 : 1) - 1]}` : ''}` : 'Time trial';
  const starsHTML = `<div class="cr-res-stars">${[1, 2, 4].map((b, i) => `<span class="${out.stars & b ? 'got' : ''}">${star(out.stars & b, out.fresh & b)}<small>${esc(labels[i])}</small></span>`).join('')}</div>`;
  const lines = out.lines.map(([l, v]) => `<tr><td>${esc(l)}</td><td class="rt">${money(v)}</td></tr>`).join('') + (tcash ? `<tr><td>${TROPHY[trophy]} trophy</td><td class="rt">${money(tcash)}</td></tr>` : '');
  const news = [
    done ? (cupPlace <= 3 ? `${TROPHY[cupPlace]} trophy: you finished the ${ev.name} ${ordinal(cupPlace)}!` : `You finished the ${ev.name} ${ordinal(cupPlace)}.`) : '',
    out.prize ? (ev.kind === 'final' ? `Champion of Champions! The gold ${vehicleById(out.prize).name} is yours.` : `You beat ${ev.driver}! The ${vehicleById(out.prize).name} is in your garage.`) : '',
    opened ? `${opened.name} tier open! New events and new cars in the showroom.` : '',
    ev.kind === 'boss' && !beaten(S, ev) ? `Beat ${ev.driver} to win the ${vehicleById(ev.vehicle).name} and open the next tier.` : '',
    FORMATS[fid].weight.destruct > 0 ? (m => `${FORMATS[fid].name}: placed on finish and destruction. You: ${m.race} for your finish, ${m.destruct} destruction points; the top car ${scored[0].c.name} (${scored[0].race} + ${scored[0].destruct}).`)(scored.find(x => x.c === P)) : '',
  ].filter(Boolean);
  $('res-career').innerHTML = `${starsHTML}<table class="cr-cash">${lines}<tr class="tot"><td>Total</td><td class="rt">${money(out.cash + tcash)}</td></tr></table><p class="cr-bank">Bank ${money(S.cash)}</p>${news.map(x => `<p class="cr-news">${esc(x)}</p>`).join('')}`;
  $('res-career').hidden = false; $('results').querySelector('.card').classList.add('cr-wide');
  if (cup) {
    const rows = standings(run).map((x, i) => `<tr class="${x.name === 'You' ? 'me' : ''}"><td class="rp">${ordinal(i + 1)}</td><td>${esc(x.name)}<span class="rs">${ordinal(order.findIndex(y => y.name === x.name) + 1)} this round</span></td><td class="rt">${x.pts}</td></tr>`).join('');
    $('res-league').innerHTML = `<b>${done ? 'Final standings' : 'Standings'}</b><table class="lg-table">${rows}</table>`; $('res-league').hidden = false; $('res-table').hidden = true;
    $('next-btn').textContent = done ? 'Back to Career' : `Next round: ${roundsOf(ev)[run.round].stage}`;
    $('again-btn').hidden = true;
  } else {
    $('next-btn').textContent = 'Back to Career'; $('again-btn').hidden = false; $('again-btn').textContent = 'Try again';
  }
  $('menu-btn').textContent = 'Career menu';
  return true;
}
/** The results screen's Next button during a career event: the next round, or back to the event screen. */
export function careerNext() {
  const c = G.career; if (!c) return false;
  const ev = eventById(c.ev), run = cupRun(ev);
  if (!isCup(ev) || cupDone(ev, run)) { toMenu(); return true; }   // toMenu brings the event screen back (G.onCareerMenu)
  G.career = { ev: ev.id, k: run.round }; startRace(stageIdx(roundsOf(ev)[run.round].stage));
  return true;
}
