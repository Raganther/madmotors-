import { G } from '../game.js';
import { $ } from './dom.js';
import { WORKSHOP_STAGE, WORKSHOP_TABS, YARD, YARD_AT, kitStage } from '../data/workshop.js';
import { STYLES, STYLE_IDS } from '../data/styles.js';
import { BREAKABLES } from '../data/breakables.js';
import { breakSpeed, massOf, toughOf } from '../core/sim/impact.js';
import { newBreakablesRace } from '../render/elements/breakables.js';
import { SANDBOXES } from '../data/sandboxes/index.js';
import { STAGES } from '../data/stages/index.js';
import { VEHICLES, vehicleById } from '../data/vehicles.js';
import { makeCar } from '../core/sim/car.js';
import { damageCar } from '../core/sim/damage.js';
import { ITEMS, ITEM_USES } from '../core/features/weapons.js';
import { GEAR, GEAR_IDS, WEAPONS } from '../data/weapons.js';
import { PANELS, PANEL_STEPS } from '../data/anatomy.js';
import { toggleOverlay } from '../render/overlay.js';
import * as flow from './flow.js';

// The Workshop (data/workshop.js has the tabs): a hub over the menu, and the live tabs, which are ordinary races on the
// Workshop loop with a panel of controls. The panel moves cars and hands out weapons directly (a test bench, like
// window.__dr); the simulation itself is the game's own, so what happens here is what happens in a race.
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const CSS = `
#ws-hub{position:fixed;inset:0;z-index:60;overflow-y:auto;background:rgba(16,20,40,.94);color:#E8ECF4;font:15px/1.4 system-ui,sans-serif;padding:20px 16px;box-sizing:border-box}
#ws-hub h1{font:700 26px Bungee,system-ui;margin:0 0 4px} #ws-hub p.sub{margin:0 0 16px;color:#9AA6C4}
#ws-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;max-width:1100px}
.ws-card{text-align:left;background:#1C2340;border:2px solid #2E3966;border-radius:12px;padding:12px;color:inherit;font:inherit;cursor:pointer}
.ws-card b{display:block;font-size:17px;margin-bottom:4px} .ws-card:hover:not(:disabled){border-color:#FFC72C}
.ws-card:disabled{opacity:.5;cursor:default} .ws-card small{display:block;margin-top:6px;color:#FFC72C}
#ws-els{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;max-width:1100px;margin-top:12px}
#ws-els button{text-align:left;background:#232B4E;border:0;border-radius:8px;padding:8px;color:inherit;font:inherit;cursor:pointer} #ws-els small{display:block;color:#9AA6C4}
.ws-top{display:flex;gap:8px;margin-bottom:14px;flex-wrap:wrap}
.ws-btn{background:#FFC72C;color:#1C2340;border:0;border-radius:8px;padding:7px 12px;font:600 14px system-ui;cursor:pointer}
.ws-btn.alt{background:#2E3966;color:#fff}
#ws-panel{position:fixed;left:12px;top:190px;z-index:40;width:270px;max-height:calc(100% - 200px);overflow-y:auto;background:rgba(16,20,40,.9);color:#E8ECF4;
  font:13px/1.35 system-ui,sans-serif;border-radius:12px;padding:10px;box-sizing:border-box}
#ws-panel h2{font:700 15px system-ui;margin:0 0 6px} #ws-panel label{display:block;margin:6px 0 2px;color:#9AA6C4}
#ws-panel select,#ws-panel input[type=range]{width:100%} #ws-panel .row{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
#ws-panel .row .ws-btn{padding:6px 9px;font-size:13px} #ws-panel .ws-btn.on{outline:2px solid #fff}
#ws-read{white-space:pre;font:12px/1.4 ui-monospace,Menlo,monospace;margin-top:8px} #ws-log{font:12px/1.35 ui-monospace,Menlo,monospace;margin-top:6px;color:#C9D2EA}
@media (max-width:700px){#ws-panel{top:auto;bottom:8px;right:8px;left:8px;width:auto;max-height:42%}}`;
let hub = null, panel = null, tick = 0;
const S = { tab: null, style: 'village', kind: 'concrete', outcome: null, scenario: 'tbone', kmh: 80, slow: false, item: 'missile', lv: 1, gear: '', refill: true, targets: 'dummies', auto: false, log: [], watch: [], snap: new Map() };

/** ?workshop or ?workshop=<tab>: which tab the page was opened on ('hub' for the bare link), or null. */
export function workshopParam() { const q = new URLSearchParams(location.search); return q.has('workshop') ? q.get('workshop') || 'hub' : null; }

/** Open the Workshop: its hub, or a tab straight away. */
export function openWorkshop(tab = 'hub') {
  if (!document.getElementById('ws-css')) { const st = document.createElement('style'); st.id = 'ws-css'; st.textContent = CSS; document.head.appendChild(st); }
  G.onWorkshopMenu = () => openWorkshop('hub');
  if (tab === 'hub' || !WORKSHOP_TABS.some(t => t.id === tab && !t.phase)) return showHub();
  closeHub();
  if (tab === 'cars') return import('./lab.js').then(m => m.startLab());
  if (tab === 'elements') return showHub(true);
  startLive(tab);
}
function showHub(elements = false) {
  endLive(); flow.toMenu(); $('menu').hidden = true;
  if (!hub) { hub = document.createElement('div'); hub.id = 'ws-hub'; document.body.appendChild(hub); }
  hub.hidden = false;
  hub.innerHTML = `<div class="ws-top"><button class="ws-btn" id="ws-exit" type="button">Back to the game</button></div><h1>Workshop</h1>
    <p class="sub">Try any part of the game on its own: cars, crashes, weapons, track pieces. Each tab has its own link: ?workshop=&lt;tab&gt;</p>
    <div id="ws-cards">${WORKSHOP_TABS.map(t => `<button class="ws-card" type="button" data-tab="${t.id}" ${t.phase ? 'disabled' : ''}><b>${esc(t.name)}</b>${esc(t.blurb)}${t.phase ? `<small>Arrives with roadmap phase ${t.phase}</small>` : ''}</button>`).join('')}</div>
    <div id="ws-els" ${elements ? '' : 'hidden'}>${Object.entries(SANDBOXES).map(([k, s]) => `<button type="button" data-sb="${k}"><b>${esc(k)}</b><small>${esc(s.blurb)}</small></button>`).join('')}</div>`;
  $('ws-exit').onclick = closeWorkshop;
  for (const b of hub.querySelectorAll('[data-tab]')) b.onclick = () => b.dataset.tab === 'elements' ? ($('ws-els').hidden = !$('ws-els').hidden) : openWorkshop(b.dataset.tab);
  for (const b of hub.querySelectorAll('[data-sb]')) b.onclick = () => openSandbox(b.dataset.sb);
}
function closeHub() { if (hub) hub.hidden = true; }
function closeWorkshop() { closeHub(); endLive(); G.onWorkshopMenu = null; $('menu').hidden = false; flow.selectStage(0); }
// an element sandbox: the stage list gets it as its last stage (as ?sandbox= does), raced with the debug readout
function openSandbox(name) {
  closeHub(); let i = STAGES.indexOf(SANDBOXES[name]); if (i < 0) { STAGES.push(SANDBOXES[name]); i = STAGES.length - 1; }
  G.workshop = { tab: 'elements', rivals: 3, weapons: false }; toggleOverlay(true); flow.startRace(i);
}

// ---------- the live tabs ----------
const kitStages = {};
function startLive(tab) {
  const q = new URLSearchParams(location.search), st = tab === 'kit' ? (kitStages[S.style] = kitStages[S.style] || kitStage(S.style)) : WORKSHOP_STAGE;   // the kit tab: the loop with a town in the chosen style
  let i = STAGES.indexOf(st); if (i < 0) { STAGES.push(st); i = STAGES.length - 1; }
  const car = q.get('car'); if (car && vehicleById(car) && !S.car) S.car = car;
  if (tab === 'kit' && STYLES[q.get('style')] && !S.styled) { S.styled = true; if (S.style !== q.get('style')) { S.style = q.get('style'); return startLive(tab); } }
  if (S.car) G.stageCars[st.name] = S.car;   // the Workshop loop's own pick (selectStage applies it)
  S.tab = tab; S.log = []; S.watch = []; S.snap = new Map();
  G.workshop = { tab, rivals: tab === 'weapons' ? 3 : 1, weapons: tab === 'weapons', onEvent };
  flow.startRace(i);
  const ready = () => { if (flow.race && G.world.idx === i && G.state === 'countdown') { G.countdown = 0.25; G.hintTimer = 0; setup(); } else setTimeout(ready, 50); };
  ready(); drawPanel();
  clearInterval(tick); tick = setInterval(update, 100);
}
function endLive() { clearInterval(tick); if (panel) panel.hidden = true; if (G.workshop) toggleOverlay(false); G.workshop = null; }
function setup() { if (S.tab === 'crash') runCrash(); else if (S.tab === 'destruct') runYard(); else if (S.tab === 'kit') { R().autoPlayer = S.auto = true; rivals()[0].hold = true; } else lineUp(); }
const R = () => flow.race, P = () => flow.race.player, kmh = c => Math.round(Math.hypot(c.vx, c.vz) * 3.6);
const rivals = () => R().cars.filter(c => !c.isPlayer);
/** Put car `c` on the road at sample `idx`, `lat` m across, turned `dyaw`, moving at `v` m/s; `fresh` repairs it. */
function place(c, idx, lat, v, dyaw = 0, fresh = true) {
  const n = makeCar(G.world.W, idx, lat, c.def);
  for (const k of ['x', 'y', 'z', 'yaw', 'pr', 'gx', 'gz', 'onGround', 'airT', 'progress', 'lastGood', 'lap', 'spin', 'vf', 'vr', 'offT', 'stuckT', 'wrongT', 'ghost', 'boost', 'driftT', 'squash']) c[k] = n[k];
  c.yaw += dyaw; c.vx = Math.sin(c.yaw) * v; c.vz = Math.cos(c.yaw) * v; c.vy = 0; c.px = c.x; c.py = c.y; c.pz = c.z; c.pyaw = c.yaw;
  if (fresh) { c.dmg = { f: 0, b: 0, l: 0, r: 0 }; c.panels = {}; c.wreckT = 0; c.events.push({ t: 'repair' }); }
}
// ----- crash test: the first rival is the target, held where the scenario puts it
const SCENARIOS = { tbone: 'Into a car side-on', rear: 'Into the back of a car', headon: 'Head-on: both moving', wall: 'Into the Armco at 25°' };
function runCrash() {
  const s0 = G.world.tr.startIdx + 10, v = S.kmh / 3.6, T = rivals()[0], Pc = P();
  place(Pc, s0, 0, v, S.scenario === 'wall' ? 0.44 : 0); Pc.hold = v;
  if (S.scenario === 'tbone') place(T, s0 + 40, 0, 0, Math.PI / 2);
  else if (S.scenario === 'rear') place(T, s0 + 40, 0, 0);
  else if (S.scenario === 'headon') place(T, s0 + 70, 0, v, Math.PI);
  else place(T, s0 + 250, 3, 0);
  T.hold = S.scenario === 'headon' ? v : true;
  S.impact = null; S.lastV = v; S.runAt = R().time; log(`${SCENARIOS[S.scenario]} at ${S.kmh} km/h (${vehicleById(G.vehicle).name})`);
}
// ----- destruction yard: the Workshop loop's row of breakables (data/workshop.js YARD), all rebuilt for each run
function runYard() {
  const r = R(), tr = G.world.tr, k = YARD.indexOf(S.kind), v = S.kmh / 3.6;
  for (const o of r.brk) o.broken = false; r.chunks.length = 0; newBreakablesRace();
  place(P(), tr.startIdx + YARD_AT + k * 50 - 45, 0, v); P().hold = v;
  const T = rivals()[0]; place(T, tr.startIdx + 60, 3, 0); T.hold = true;   // the other car parked out of the way
  S.impact = null; S.lastV = v; S.runAt = r.time; S.outcome = null;
  const bs = breakSpeed(P(), S.kind);
  log(`${BREAKABLES[S.kind].name} at ${S.kmh} km/h (${vehicleById(G.vehicle).name}: ${bs < Infinity ? 'breaks it from ' + Math.ceil(bs * 3.6) + ' km/h' : 'too light ever to break it'})`);
}
// ----- weapons range: rivals held in a row ahead as dummies, or driving the loop
function lineUp() {
  const s0 = G.world.tr.startIdx + 10, dummies = S.targets === 'dummies';
  place(P(), s0, 0, dummies ? 0 : 15); P().hold = false; R().autoPlayer = S.auto;
  rivals().forEach((c, k) => { place(c, s0 + 45 + k * 30, [-2.5, 0, 2.5][k % 3], dummies ? 0 : 15); c.hold = dummies; });
}
function give(it) { const w = P().wpn; if (!w) return; w.item = it; w.uses = ITEM_USES[it]; arm(); }
// the level on the player's weapons and the gear on the targets (data/weapons.js), straight onto the race's cars
function arm() { const w = P().wpn; if (!w) return; w.load = { lv: Object.fromEntries(ITEMS.map(k => [k, S.lv])) }; for (const c of rivals()) if (c.wpn) c.wpn.gear = S.gear || null; }
const HITS = { 'missile-hit': 'Missile', 'bullet-hit': 'Bullet', 'oil-hit': 'Oil', 'pulse-hit': 'Shockwave', 'harpoon-hit': 'Harpoon', 'door-hit': 'Door' };
function onEvent(c, e) {
  if (S.tab === 'destruct' && c.isPlayer) {
    if (e.t === 'break') { S.outcome = 'broke'; log(`Smashed through the ${BREAKABLES[e.kind].name.toLowerCase()} at ${Math.round(e.v * 3.6)} km/h`); }
    if (e.t === 'hit' && e.kind && !S.outcome) { S.outcome = 'bounced'; log(`Bounced off the ${BREAKABLES[e.kind].name.toLowerCase()} at ${Math.round(e.v * 3.6)} km/h`); }
  }
  if (S.tab === 'crash' || S.tab === 'destruct') {
    if (e.t === 'dent' && e.v > 3) log(`${c.isPlayer ? 'You' : c.name}: ${e.zone} dent ${Math.min(100, Math.round(e.amt * 100))}% at ${Math.round(e.v * 3.6)} km/h`);
    if (e.t === 'wreck') log(`${c.isPlayer ? 'You' : c.name}: wrecked`);
    if (e.t === 'destroyed' || e.t === 'takedown') log(`${c.isPlayer ? 'You' : c.name}: ${e.t}`);
  } else if (HITS[e.t] && !c.isPlayer && R().cars[e.from ?? e.by] === P()) {
    if (e.t === 'bullet-hit' && S.watch.some(w => w.c === c && w.what === 'Bullet' && R().time - w.t0 < 1)) return;   // one line per burst
    const was = S.snap.get(c) || { v: kmh(c), d: c.dmg };   // as it was before the hit (events arrive after the step that landed it)
    S.watch.push({ c, what: HITS[e.t], t0: R().time, v0: was.v, d0: { ...was.d } });
  }
}
function log(s) { S.log.unshift(s); S.log.length = Math.min(S.log.length, 8); const el = $('ws-log'); if (el) el.innerHTML = S.log.map(esc).join('<br>'); }

function update() {
  if (!G.workshop || !R() || !panel) return;
  if (S.slow) G.slowmo = 1e6; else if (G.slowmo > 100) G.slowmo = 0;
  const r = R(), Pc = P(), bar = d => (d * 100).toFixed(0).padStart(3) + '%';
  const step = (p, d) => { let k = -1; p.steps.forEach((t, i) => { if (d >= t) k = i; }); return k < 0 ? '' : ' ' + PANEL_STEPS[k]; };
  const pan = c => PANELS.filter(p => c.panels && c.panels[p.id] > 0.005).map(p => `${p.id} ${Math.round(c.panels[p.id] * 100)}%${step(p, c.panels[p.id])}`).join(', ');
  const dmg = c => `${c.isPlayer ? 'You' : c.name} ${kmh(c)} km/h${c.wreckT > 0 ? '  WRECKED' : ''}\n  front ${bar(c.dmg.f)}  back ${bar(c.dmg.b)}\n  left  ${bar(c.dmg.l)}  right ${bar(c.dmg.r)}${pan(c) ? '\n  ' + pan(c) : ''}`;
  if (S.tab === 'crash' || S.tab === 'destruct') {
    const v = Math.hypot(Pc.vx, Pc.vz);
    if (!S.impact && S.lastV - v > 2.5 && r.time - S.runAt < 6) S.impact = { at: Math.round(S.lastV * 3.6), after: Math.round(v * 3.6) };
    S.lastV = v;
    if (Pc.hold && (S.impact || r.time - S.runAt > 4)) Pc.hold = false;   // after the crash, it's yours to drive
    const T = rivals()[0]; if (S.scenario === 'headon' && T.hold && S.impact) T.hold = true;
    const imp = S.impact ? `impact at ${S.impact.at} km/h, ${S.impact.after} km/h after` : 'no impact yet';
    $('ws-read').textContent = S.tab === 'destruct' ? [dmg(Pc), (S.outcome ? S.outcome.toUpperCase() + ': ' : '') + imp, `mass ${massOf(Pc).toFixed(2)}, toughness ${toughOf(Pc)}`].join('\n') : [dmg(Pc), dmg(rivals()[0]), imp].join('\n');
  } else if (S.tab === 'kit') {
    const kit = r.brk.filter(o => BREAKABLES[o.kind].kit), by = {}; for (const o of kit) if (o.broken) by[o.kind] = (by[o.kind] || 0) + 1;
    $('ws-read').textContent = `${STYLES[S.style].name} town: ${kit.filter(o => o.kind === 'house').length} houses, ${kit.length} pieces\nyou ${kmh(Pc)} km/h\nbroken: ${Object.entries(by).map(([k, n]) => `${n} ${k}`).join(', ') || 'nothing yet'}`;
  } else {
    for (const c of rivals()) S.snap.set(c, { v: kmh(c), d: { ...c.dmg } });
    if (S.refill && Pc.wpn && !Pc.wpn.item) give(S.item);
    S.watch = S.watch.filter(w => {   // a second after the hit: what it did to their speed and their worst-hit zone
      if (r.time - w.t0 < 1) return true;
      const d = Math.max(...Object.keys(w.d0).map(z => w.c.dmg[z] - w.d0[z]));
      log(`${w.what} → ${w.c.name}: ${w.v0} → ${kmh(w.c)} km/h, damage +${Math.round(d * 100)}%`); return false;
    });
    $('ws-read').textContent = `holding: ${Pc.wpn && Pc.wpn.item ? Pc.wpn.item + ' x' + Pc.wpn.uses : 'nothing'}\n` + rivals().map(dmg).join('\n');
  }
}
function drawPanel() {
  if (!panel) { panel = document.createElement('div'); panel.id = 'ws-panel'; document.body.appendChild(panel); }
  panel.hidden = false;
  const carSel = `<label>Car</label><select id="ws-car">${VEHICLES.map(v => `<option value="${v.id}" ${v.id === G.vehicle ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select>`;
  const common = `<div class="row"><button class="ws-btn alt ${S.slow ? 'on' : ''}" id="ws-slow" type="button">Slow motion</button><button class="ws-btn alt" id="ws-hub-btn" type="button">Workshop</button></div>`;
  if (S.tab === 'crash') panel.innerHTML = `<h2>Crash test</h2>${carSel}<label>Into</label><select id="ws-scn">${Object.entries(SCENARIOS).map(([k, n]) => `<option value="${k}" ${k === S.scenario ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <label>Speed: <b id="ws-kmh">${S.kmh}</b> km/h</label><input id="ws-speed" type="range" min="20" max="200" step="5" value="${S.kmh}">
    <div class="row"><button class="ws-btn" id="ws-run" type="button">Run</button><button class="ws-btn alt" id="ws-fix" type="button">Repair</button><button class="ws-btn alt" id="ws-wreck" type="button">Wreck it</button></div>${common}<div id="ws-read"></div><div id="ws-log"></div>`;
  else if (S.tab === 'kit') panel.innerHTML = `<h2>Scenery kit</h2><label>Style</label><div class="row">${STYLE_IDS.map(k => `<button class="ws-btn alt ${k === S.style ? 'on' : ''}" data-st="${k}" type="button">${STYLES[k].name}</button>`).join('')}</div>
    ${carSel}<div class="row"><button class="ws-btn alt ${S.auto ? 'on' : ''}" id="ws-auto" type="button">Autopilot</button><button class="ws-btn alt ${G.camMode === 'heli' ? 'on' : ''}" id="ws-heli" type="button">Heli view</button></div>
    <p style="margin:6px 0 0;color:#9AA6C4">Turn the autopilot off and drive into the town: fences, gates, hedges and bins give way, walls need a heavy car, houses don't.</p>${common}<div id="ws-read"></div><div id="ws-log"></div>`;
  else if (S.tab === 'destruct') panel.innerHTML = `<h2>Destruction yard</h2>${carSel}<label>Into</label><select id="ws-kind">${YARD.map(k => `<option value="${k}" ${k === S.kind ? 'selected' : ''}>${BREAKABLES[k].name}</option>`).join('')}</select>
    <label>Speed: <b id="ws-kmh">${S.kmh}</b> km/h</label><input id="ws-speed" type="range" min="20" max="200" step="5" value="${S.kmh}">
    <div class="row"><button class="ws-btn" id="ws-run" type="button">Run</button><button class="ws-btn alt" id="ws-fix" type="button">Repair</button></div>${common}<div id="ws-read"></div><div id="ws-log"></div>`;
  else panel.innerHTML = `<h2>Weapons range</h2>${carSel}<label>Weapon</label><div class="row">${ITEMS.map(it => `<button class="ws-btn alt ${it === S.item ? 'on' : ''}" data-it="${it}" type="button">${esc(flow.ITEM_NAME[it])}</button>`).join('')}</div>
    <label>Level</label><div class="row">${[1, 2, 3].map(L => `<button class="ws-btn alt ${L === S.lv ? 'on' : ''}" data-lv="${L}" type="button">${L}: ${esc(WEAPONS[S.item].looks[L - 1])}</button>`).join('')}</div>
    <label>Targets' gear</label><div class="row">${['', ...GEAR_IDS].map(g => `<button class="ws-btn alt ${g === S.gear ? 'on' : ''}" data-gear="${g}" type="button">${g ? GEAR[g].name : 'None'}</button>`).join('')}</div>
    <div class="row"><button class="ws-btn" id="ws-fire" type="button">Fire (F)</button><button class="ws-btn alt ${S.refill ? 'on' : ''}" id="ws-refill" type="button">Endless ammo</button></div>
    <label>Targets</label><div class="row"><button class="ws-btn alt ${S.targets === 'dummies' ? 'on' : ''}" data-tg="dummies" type="button">Dummies</button><button class="ws-btn alt ${S.targets === 'racing' ? 'on' : ''}" data-tg="racing" type="button">Rivals racing</button><button class="ws-btn alt ${S.auto ? 'on' : ''}" id="ws-auto" type="button">Autopilot</button></div>
    <div class="row"><button class="ws-btn alt" id="ws-line" type="button">Line up again</button></div>${common}<div id="ws-read"></div><div id="ws-log"></div>`;
  $('ws-car').onchange = e => { S.car = e.target.value; startLive(S.tab); };
  $('ws-slow').onclick = () => { S.slow = !S.slow; $('ws-slow').classList.toggle('on', S.slow); };
  $('ws-hub-btn').onclick = () => openWorkshop('hub');
  if (S.tab === 'kit') {
    for (const b of panel.querySelectorAll('[data-st]')) b.onclick = () => { S.style = b.dataset.st; startLive('kit'); };
    $('ws-auto').onclick = () => { S.auto = !S.auto; R().autoPlayer = S.auto; drawPanel(); };
    $('ws-heli').onclick = () => { G.camMode = G.camMode === 'heli' ? 'classic' : 'heli'; drawPanel(); };
  } else if (S.tab === 'destruct') {
    $('ws-kind').onchange = e => { S.kind = e.target.value; runYard(); };
    $('ws-speed').oninput = e => { S.kmh = +e.target.value; $('ws-kmh').textContent = S.kmh; };
    $('ws-run').onclick = runYard;
    $('ws-fix').onclick = () => { for (const c of R().cars) { c.dmg = { f: 0, b: 0, l: 0, r: 0 }; c.panels = {}; c.wreckT = 0; c.events.push({ t: 'repair' }); } };
  } else if (S.tab === 'crash') {
    $('ws-scn').onchange = e => { S.scenario = e.target.value; runCrash(); };
    $('ws-speed').oninput = e => { S.kmh = +e.target.value; $('ws-kmh').textContent = S.kmh; };
    $('ws-run').onclick = runCrash;
    $('ws-fix').onclick = () => { for (const c of R().cars) { c.dmg = { f: 0, b: 0, l: 0, r: 0 }; c.panels = {}; c.wreckT = 0; c.events.push({ t: 'repair' }); } };
    $('ws-wreck').onclick = () => { const c = P(); damageCar(c, c.x + Math.sin(c.yaw) * 2, c.z + Math.cos(c.yaw) * 2, 80, 2, -Math.sin(c.yaw), -Math.cos(c.yaw)); };
  } else {
    for (const b of panel.querySelectorAll('[data-it]')) b.onclick = () => { S.item = b.dataset.it; give(S.item); drawPanel(); };
    for (const b of panel.querySelectorAll('[data-lv]')) b.onclick = () => { S.lv = +b.dataset.lv; arm(); drawPanel(); };
    for (const b of panel.querySelectorAll('[data-gear]')) b.onclick = () => { S.gear = b.dataset.gear; arm(); drawPanel(); };
    for (const b of panel.querySelectorAll('[data-tg]')) b.onclick = () => { S.targets = b.dataset.tg; lineUp(); drawPanel(); };
    $('ws-fire').onclick = () => { if (!P().wpn.item) give(S.item); P().inp.fire = true; };
    $('ws-refill').onclick = () => { S.refill = !S.refill; drawPanel(); };
    $('ws-auto').onclick = () => { S.auto = !S.auto; R().autoPlayer = S.auto; drawPanel(); };
    $('ws-line').onclick = lineUp;
  }
  log(S.log.shift() || (S.tab === 'crash' ? 'Pick a car, a crash and a speed, then Run' : S.tab === 'destruct' ? 'Pick a car, a thing to hit and a speed, then Run' : 'Pick a weapon and fire: hits show here'));
}
