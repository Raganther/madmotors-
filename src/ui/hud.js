import { G } from '../game.js';
import { screenOffset } from '../core/sim/view.js';
import { CP, SD, cpState, sdLeader, sdMult } from '../core/modes/showdown.js';
import { WPN, wv } from '../core/features/weapons.js';
import { GEAR, levelOf } from '../data/weapons.js';
import { AudioSys } from '../audio/audio.js';
import { clamp } from '../core/math.js';
import { ranking } from '../core/sim/race.js';
import { $, isTouch } from './dom.js';
import { ITEM_NAME, race } from './flow.js';
import { derbyOrder, health } from '../core/modes/derby.js';
import { fmt, ordinal } from './format.js';
import { best } from './storage.js';
import { drawRaceMap } from './trackmap.js';

// ---------- HUD ----------
G.standingsKey = '';
export function setTxt(id, v) { const el = $(id); if (el._t !== v) { el._t = v; el.textContent = v; } }
export function updateHUD(dt) {
  if (!race || G.state === 'menu') return;
  G.hudTick -= dt; G.profileTick -= dt;
  const P = race.player;
  if (G.profileTick <= 0) { G.profileTick = 0.05; drawRaceMap($('trackmap'), G.world.tr, race.cars); }
  if (G.hudTick > 0) return; G.hudTick = 1 / 30;
  const sd = race.sd;
  $('sd-panel').hidden = !sd; $('hud').classList.toggle('sd', !!sd); $('pos').hidden = !!sd; $('standings').hidden = !!sd; $('best').hidden = !!sd;
  if (sd) updateShowdownHUD(sd, P);
  else $('edge').className = '';
  const order = race.derby ? derbyOrder(race) : ranking(race), place = order.indexOf(P) + 1;
  setTxt('pos-n', String(place)); setTxt('pos-suf', ordinal(place).slice(-2));
  const key = order.map(c => c.name).join() + isTouch;
  if (key !== G.standingsKey) {
    G.standingsKey = key;
    // a big field: the top three, then you and whoever is either side of you; on a phone just the leader, the car
    // you're chasing and you
    const pick = isTouch ? [0, place - 2, place - 1] : order.length <= 6 ? order.map((c, i) => i) : [0, 1, 2, place - 2, place - 1, place];
    const show = [...new Set(pick.filter(i => i >= 0 && i < order.length))].sort((a, b) => a - b);
    $('standings').innerHTML = show.map((i, n) => (n && i > show[n - 1] + 1 ? '<li class="gap">&middot;&middot;&middot;</li>' : '') +
      `<li class="${order[i].isPlayer ? 'me' : ''}"><span class="st-p">${i + 1}</span><span class="chip" style="background:#${order[i].def.color.toString(16).padStart(6, '0')}"></span>${order[i].name}</li>`).join('');
  }
  setTxt('time', fmt(P.finished ? P.finishTime : race.time));
  if (sd) {
    const lap = G.world.tr.loopN ? ` · Lap ${Math.min(G.world.tr.laps, P.lap + 1)}/${G.world.tr.laps}` : '';
    const gate = sd.gate && sd.gate.open && isFinite(sd.gate.s) ? ` · gate ${Math.max(0, Math.round(sd.gate.s - P.progress))} m` : '';
    $('lap').hidden = true; setTxt('sd-title', sd.kind === 'crown' ? `Crown · first to ${SD.TARGET}s${lap}` : `First to ${CP.TARGET[sd.kind]}, two clear${gate}`);
  }
  else if (race.derby) {   // a derby (core/modes/derby.js): how many are left, the clock, your health
    const D = race.derby, left = race.cars.filter(c => !c.out).length;
    if (race.demo) { const S = race.st, up = S ? S.blds.filter(o => !o.collapsed).length : 0, pts = race.demo.pts[race.cars.indexOf(P)]; $('lap').hidden = false; setTxt('lap', `${pts} pts · ${up} standing · ${fmt(Math.max(0, D.time - D.t)).replace(/\.\d+$/, '')}${P.out ? ' · out' : ''}`); }
    else { $('lap').hidden = false; setTxt('lap', P.out ? `Out · ${left} left` : `Derby · ${left} left · ${fmt(Math.max(0, D.time - D.t))} · you ${Math.round(100 * health(P))}%`); }
  }
  else if (G.world.tr.loopN) {
    const L = G.world.tr.laps, GT = G.world.tr.gates, per = GT ? GT.length / L : 0, gate = GT && !P.finished ? ` · Gate ${(P.gateK || 0) % per + 1}/${per}` : '';   // off-piste: which gate is next this lap
    $('lap').hidden = false; setTxt('lap', P.finished ? 'Finished' : (P.lap + 1 === L ? 'Final lap' : `Lap ${P.lap + 1} of ${L}`) + gate);
  } else $('lap').hidden = true;
  const b = best[G.world.idx]; setTxt('best', b ? 'Best ' + fmt(b) : 'No best time yet');
  setTxt('speed', String(Math.round(Math.hypot(P.vx, P.vz) * 4.1)));
  const charge = P.boost > 0 ? 1 : clamp(P.driftT / 1.6, 0, 1);
  { const wv = (charge * 100).toFixed(0) + '%', bf = $('boost-fill'); if (bf._w !== wv) { bf._w = wv; bf.style.width = wv; } } $('boost-fill').classList.toggle('live', P.boost > 0 || P.driftT > 0.6);
  for (const z of ['f', 'b', 'l', 'r']) { const d = P.dmg[z], el = $('dz-' + z), f = d < 0.05 ? '' : `hsl(${Math.round(46 - 42 * d)} 92% ${Math.round(58 - 6 * d)}%)`; if (el._f !== f) { el._f = f; el.style.fill = f; } }
  // weapons: what you're holding (and how many), a flashing warning while a missile is homing in on you
  if (race.weapons && P.wpn) {
    const W = P.wpn, pi = race.cars.indexOf(P), lock = race.missiles.some(m => m.tgt === pi) || race.cars.some(o => o !== P && o.wpn && o.wpn.lockTgt === pi && o.wpn.lockK > 0.35), el = $('wpn'), it = W.item;
    const aiming = it === 'missile' && !(W.gunT > 0) ? (W.lockK >= 1 ? ' · LOCKED' : W.lockTgt >= 0 ? ' · locking' : ' · no target') : '';   // the missile's lock (core lockedOn)
    const act = W.gunT > 0 ? ['gun', W.gunT, wv(P, 'gun', 'GUN_T')] : W.waterT > 0 ? ['water', W.waterT, wv(P, 'water', 'WATER_T')] : W.cementT > 0 ? ['cement', W.cementT, wv(P, 'cement', 'CEMENT_T')] : W.jingleT > 0 ? ['jingle', W.jingleT, WPN.JINGLE_T] : null, firing = !!act;
    const gear = W.gear ? ` · ${GEAR[W.gear].name}${W.gear === 'magnet' ? '' : (W.gear === 'shield' ? W.shieldT : W.flareT) > 0 ? ' ' + Math.ceil(W.gear === 'shield' ? W.shieldT : W.flareT) + 's' : ' ready'}` : '';
    el.hidden = false; el.className = lock ? 'lock' : it || firing ? '' : 'reload';
    setTxt('wpn-state', (lock ? (race.missiles.some(m => m.tgt === pi) ? 'Missile incoming!' : 'Locked on to you!') : firing ? ITEM_NAME[act[0]] + '!' : it ? ITEM_NAME[it] + (levelOf(W.load, it) > 1 ? ' L' + levelOf(W.load, it) : '') + (W.uses > 1 ? ` ×${W.uses}` : '') + aiming + (isTouch ? '' : ' · F') : 'Grab a ? crate') + gear);
    const fw = (firing ? 100 * act[1] / act[2] : it === 'missile' ? 100 * (W.lockK || 0) : it ? 100 : 0).toFixed(0) + '%', ff = $('wpn-fill'); if (ff._w !== fw) { ff._w = fw; ff.style.width = fw; }
    $('wpn-fire').classList.toggle('ready', !!it); $('wpn-fire').classList.toggle('lock', lock);
    setTxt('wpn-fire', it ? { missile: 'Missile', gun: 'Guns', oil: 'Oil', pulse: 'Pulse', harpoon: 'Hook', water: 'Water', cement: 'Cement', stinger: 'Stinger', crush: 'Crush', jingle: 'Jingle', mortar: 'Mortar', mine: 'Mines' }[it] : 'Fire');   // on touch the Fire button is the weapon panel: it says what you hold
  } else $('wpn').hidden = true;
  $('touch').classList.toggle('nowpn', !race.weapons);
  const wrong = P.wrongT > 1 && !race.derby, missed = P.gateMiss && !P.finished;
  $('warn').textContent = missed ? 'Missed a gate: follow the arrow back' : wrong ? 'Wrong way' : (P.stuckT > 3 && !P.out ? (isTouch ? 'Stuck? Tap Reset' : 'Stuck? Press R to reset') : '');
  $('warn').hidden = !(missed || wrong || P.stuckT > 3);
}
// checkpoint modes: each car's points as pips toward the target (a bar past it: it's two-clear time), and the call
function updateCheckpointHUD(sd, P) {
  const T = CP.TARGET[sd.kind], key = sd.points.join() + '|' + sd.kind;
  if (key !== G.sdKey) {
    G.sdKey = key;
    const hex = c => '#' + c.def.color.toString(16).padStart(6, '0'), top = Math.max(...sd.points);
    $('sd-rows').innerHTML = race.cars.map((c, k) => {
      const st = cpState(sd, k), tag = st === 'advantage' ? '<em>AD</em>' : st === 'deuce' ? '<em>D</em>' : '';
      return `<li class="${c.isPlayer ? 'me' : ''} ${sd.points[k] === top && top > 0 ? 'lead' : ''}"><span class="chip" style="background:${hex(c)}"></span><span class="nm">${c.name}</span><span class="nm-s">${c.name.slice(0, 3)}</span>` +
        `<span class="sd-bar"><b style="width:${(100 * Math.min(1, sd.points[k] / T)).toFixed(1)}%;background:${hex(c)}"></b></span><span class="sd-t">${sd.points[k]}${tag}</span></li>`;
    }).join('');
  }
  edgeGlow(sd, P);
}
function updateShowdownHUD(sd, P) {
  if (sd.kind !== 'crown') return updateCheckpointHUD(sd, P);
  const h = sd.holder, key = sd.crown.map(v => Math.floor(v * 4)).join() + '|' + h + '|' + sdMult(sd.streak);
  if (key !== G.sdKey) {
    G.sdKey = key;
    const hex = c => '#' + c.def.color.toString(16).padStart(6, '0'), m = sdMult(sd.streak);
    // crown time per car: a bar filling toward the target, seconds, and the holder's streak multiplier
    $('sd-rows').innerHTML = race.cars.map((c, k) => `<li class="${c.isPlayer ? 'me' : ''} ${k === h ? 'lead' : ''}"><span class="chip" style="background:${hex(c)}"></span><span class="nm">${c.name}</span><span class="nm-s">${c.name.slice(0, 3)}</span>` +
      `<span class="sd-bar"><b style="width:${(100 * sd.crown[k] / SD.TARGET).toFixed(1)}%;background:${hex(c)}"></b></span><span class="sd-t">${Math.floor(sd.crown[k])}s${k === h && m > 1 ? `<em>×${m}</em>` : ''}</span></li>`).join('');
  }
  edgeGlow(sd, P);
}
// glow on the screen edge you're about to drop off, stronger the closer the camera is to its zoom limit
function edgeGlow(sd, P) {
  const L = sdLeader(race), edge = $('edge').children, v = sd.view;
  if (sd.focus && v && sd.phase === 'run' && L !== P) {
    const tension = clamp((sd.scale - SD.ZMIN) / (SD.ZMAX - SD.ZMIN), 0, 1), [sx, sy] = screenOffset(P.x, P.y, P.z, sd.focus, race.camDir), a = t => clamp((t - 0.72) / 0.28, 0, 1) * (0.25 + 0.75 * tension);
    // last car with the camera maxed out: a ticking warning
    const last = race.cars.every(c => c === P || c.progress >= P.progress);
    if (last && tension > 0.9 && race.time > G.sdTick) { G.sdTick = race.time + 0.4; AudioSys.tone(1320, 0.06, 0.05, 'square'); }
    edge[0].style.opacity = a(-sx / v.hw); edge[1].style.opacity = a(sx / v.hw); edge[2].style.opacity = a(sy / v.hh); edge[3].style.opacity = a(-sy / v.hh);
  } else for (const e of edge) e.style.opacity = 0;
}
G.calloutTimer = 0;
export function callout(text) { const el = $('callout'); el.textContent = text; el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); el.hidden = false; G.calloutTimer = 1.3; }
