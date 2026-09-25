import { G } from '../game.js';
import { screenOffset } from '../core/sim/view.js';
import { CP, SD, cpState, sdLeader, sdMult } from '../core/modes/showdown.js';
import { AudioSys } from '../audio/audio.js';
import { TAU, clamp } from '../core/math.js';
import { ranking } from '../core/sim/race.js';
import { roadH } from '../core/track/query.js';
import { $, isTouch } from './dom.js';
import { race } from './flow.js';
import { fmt, ordinal } from './format.js';
import { best } from './storage.js';

// ---------- HUD ----------
export function drawProfile(cv, tr, cars, dotR, cw, ch) {
  const dpr = Math.min(devicePixelRatio || 1, 2), w = cw || cv.clientWidth, h = ch || cv.clientHeight;
  if (!w || !h) return;
  if (!cw && cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const g = cv.getContext('2d');
  const span = tr.loopN || tr.N;
  // the profile line itself never changes during a race: draw it once to an offscreen canvas and just stamp it
  if (cars && !(cv._cache && cv._cache.tr === tr && cv._cache.w === cv.width && cv._cache.h === cv.height)) {
    const off = document.createElement('canvas'); off.width = cv.width; off.height = cv.height;
    cv._cache = { tr, w: cv.width, h: cv.height, off }; drawProfile(off, tr, null, dotR, w, h);
  }
  g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  if (cars) g.drawImage(cv._cache.off, 0, 0, w, h);
  let mn = Infinity, mx = -Infinity; for (let i = 0; i < span; i += 4) { mn = Math.min(mn, tr.H[i]); mx = Math.max(mx, tr.H[i]); }
  const pad = dotR + 2, X = s => pad + s / (span - 1) * (w - 2 * pad), Y = v => pad + (1 - (v - mn) / (mx - mn)) * (h - 2 * pad);
  if (!cars) {
  g.beginPath(); g.moveTo(X(0), h); for (let i = 0; i < span; i += 6) g.lineTo(X(i), Y(tr.H[i])); g.lineTo(X(span - 1), Y(tr.H[span - 1])); g.lineTo(X(span - 1), h); g.closePath();
  g.fillStyle = 'rgba(255,255,255,0.1)'; g.fill();
  g.beginPath(); for (let i = 0; i < span; i += 6) { i ? g.lineTo(X(i), Y(tr.H[i])) : g.moveTo(X(i), Y(tr.H[i])); } g.strokeStyle = '#FFC72C'; g.lineWidth = 2; g.stroke();
  if (tr.loopN) {
    g.fillStyle = 'rgba(255,255,255,0.55)'; for (let i = 0; i < span; i += 3) if (tr.bridge[i]) g.fillRect(X(i) - 1, Y(tr.H[i]) + 2, 2, 3);
    g.fillStyle = 'rgba(10,12,24,0.85)'; for (let i = 0; i < span; i += 2) if (tr.tunnel[i]) g.fillRect(X(i) - 1, Y(tr.H[i]) - 5, 2, 5);
  }
  const fx = X(tr.loopN ? tr.startIdx : tr.finishIdx); g.fillStyle = '#fff'; for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) if ((r + c) % 2 === 0) g.fillRect(fx + c * 3, 2 + r * 3, 3, 3);
  g.fillRect(fx, 2, 1, h - 4);
  return;
  }
  const order = cars.slice().sort((a, b) => (a.isPlayer ? 1 : 0) - (b.isPlayer ? 1 : 0));
  for (const c of order) {
    const s = tr.loopN ? ((c.progress % span) + span) % span : clamp(c.progress, 0, tr.N - 1), x = X(s), y = Y(c.pr.i >= tr.NM ? c.y : roadH(tr, s));   // on a branch: its own height
    g.beginPath(); g.arc(x, y, c.isPlayer ? dotR + 1.5 : dotR, 0, TAU); g.fillStyle = '#' + c.def.color.toString(16).padStart(6, '0'); g.fill();
    g.lineWidth = c.isPlayer ? 2.5 : 1.5; g.strokeStyle = c.isPlayer ? '#FFFFFF' : '#1C2340'; g.stroke();
  }
}
G.standingsKey = '';
export function setTxt(id, v) { const el = $(id); if (el._t !== v) { el._t = v; el.textContent = v; } }
export function updateHUD(dt) {
  if (!race || G.state === 'menu') return;
  G.hudTick -= dt; G.profileTick -= dt;
  const P = race.player;
  if (G.profileTick <= 0) { G.profileTick = 0.05; drawProfile($('profile'), G.world.tr, race.cars, 4); }
  if (G.hudTick > 0) return; G.hudTick = 1 / 30;
  const sd = race.sd;
  $('sd-panel').hidden = !sd; $('hud').classList.toggle('sd', !!sd); $('pos').hidden = !!sd; $('standings').hidden = !!sd; $('best').hidden = !!sd;
  if (sd) updateShowdownHUD(sd, P);
  else $('edge').className = '';
  const order = ranking(race), place = order.indexOf(P) + 1;
  setTxt('pos-n', String(place)); setTxt('pos-suf', ordinal(place).slice(-2));
  const key = order.map(c => c.name).join();
  if (key !== G.standingsKey) {
    G.standingsKey = key;
    // a big field: the top three, then you and whoever is either side of you
    const show = order.length <= 6 ? order.map((c, i) => i) : [...new Set([0, 1, 2, place - 2, place - 1, place].filter(i => i >= 0 && i < order.length))].sort((a, b) => a - b);
    $('standings').innerHTML = show.map((i, n) => (n && i > show[n - 1] + 1 ? '<li class="gap">&middot;&middot;&middot;</li>' : '') +
      `<li class="${order[i].isPlayer ? 'me' : ''}"><span class="st-p">${i + 1}</span><span class="chip" style="background:#${order[i].def.color.toString(16).padStart(6, '0')}"></span>${order[i].name}</li>`).join('');
  }
  setTxt('time', fmt(P.finished ? P.finishTime : race.time));
  if (sd) {
    const lap = G.world.tr.loopN ? ` · Lap ${Math.min(G.world.tr.laps, P.lap + 1)}/${G.world.tr.laps}` : '';
    const gate = sd.gate && sd.gate.open && isFinite(sd.gate.s) ? ` · gate ${Math.max(0, Math.round(sd.gate.s - P.progress))} m` : '';
    $('lap').hidden = true; setTxt('sd-title', sd.kind === 'crown' ? `Crown · first to ${SD.TARGET}s${lap}` : `First to ${CP.TARGET[sd.kind]}, two clear${gate}`);
  }
  else if (G.world.tr.loopN) { const L = G.world.tr.laps; $('lap').hidden = false; setTxt('lap', P.finished ? 'Finished' : (P.lap + 1 === L ? 'Final lap' : `Lap ${P.lap + 1} of ${L}`)); } else $('lap').hidden = true;
  const b = best[G.world.idx]; setTxt('best', b ? 'Best ' + fmt(b) : 'No best time yet');
  setTxt('speed', String(Math.round(Math.hypot(P.vx, P.vz) * 4.1)));
  const charge = P.boost > 0 ? 1 : clamp(P.driftT / 1.6, 0, 1);
  { const wv = (charge * 100).toFixed(0) + '%', bf = $('boost-fill'); if (bf._w !== wv) { bf._w = wv; bf.style.width = wv; } } $('boost-fill').classList.toggle('live', P.boost > 0 || P.driftT > 0.6);
  for (const z of ['f', 'b', 'l', 'r']) { const d = P.dmg[z], el = $('dz-' + z), f = d < 0.05 ? '' : `hsl(${Math.round(46 - 42 * d)} 92% ${Math.round(58 - 6 * d)}%)`; if (el._f !== f) { el._f = f; el.style.fill = f; } }
  const wrong = P.wrongT > 1;
  $('warn').textContent = wrong ? 'Wrong way' : (P.stuckT > 3 ? (isTouch ? 'Stuck? Tap Reset' : 'Stuck? Press R to reset') : '');
  $('warn').hidden = !(wrong || P.stuckT > 3);
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
