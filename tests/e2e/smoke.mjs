// Browser smoke test on the production build: every stage loads, races for a few simulated seconds and renders,
// with no console errors. Screenshots go to tests/e2e/shots/ for a visual check.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('dist/index.html'), outDir = path.resolve('tests/e2e/shots');
fs.mkdirSync(outDir, { recursive: true });
const opts = { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] };
if (fs.existsSync('/opt/pw-browsers/chromium')) opts.executablePath = undefined;
const browser = await chromium.launch(opts);
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_CERT|net::/.test(m.text())) errors.push(m.text()); });
await page.goto('file://' + file);
await page.waitForFunction(() => window.__dr && window.__dr.G.world, null, { timeout: 30000 });
await page.screenshot({ path: path.join(outDir, 'menu.png') });
const n = await page.evaluate(() => window.__dr.core.STAGES.length);
for (let i = 0; i < n; i++) {
  await page.evaluate(i => window.__dr.flow.startRace(i), i);
  await page.waitForFunction(i => window.__dr.G.world && window.__dr.G.world.idx === i && window.__dr.race, i, { timeout: 30000 });
  const info = await page.evaluate(() => {
    const d = window.__dr; window.requestAnimationFrame = () => 0;
    d.G.state = 'racing'; d.race.phase = 'racing'; d.race.autoPlayer = true;
    d.step(6); for (let k = 0; k < 30; k++) d.step(1 / 60);   // a few drawn frames: the cars pick up dust on dirt stages
    const dirt = d.carVis.reduce((m, v) => Math.max(m, v.dirt ? v.dirt.amt : 0), 0), dirtStage = d.G.world.stage.surface !== 'tarmac';
    // see-through scenery only inside long covered stretches: off on open road, on inside a tunnel
    const cov = d.G.world.cover, N = cov.length, open = cov.findIndex(v => !v), tun = cov.findIndex(v => v);
    return { stage: d.G.world.stage.name, t: d.race.time.toFixed(1), progress: Math.round(d.race.player.progress), cov: cov[d.race.player.pr.i % N], open, tun, N, dirt, dirtStage };
  });
  await page.screenshot({ path: path.join(outDir, `stage${i + 1}.png`) });
  console.log(`stage ${i + 1} ${info.stage}: raced ${info.t}s, player progress ${info.progress}, covered stretch ${info.tun < 0 ? 'none' : 'from ' + info.tun}`);
  if (info.open < 0) errors.push('see-through is on along the whole of ' + info.stage);
  if (info.dirtStage && !(info.dirt > 0)) errors.push('cars did not get dusty on the dirt stage ' + info.stage);
  // the real loop was stubbed out for this stage; reload for the next one
  await page.goto('file://' + file); await page.waitForFunction(() => window.__dr && window.__dr.G.world, null, { timeout: 30000 });
}
// Showdown (King of the Hill) on a downhill stage, the gorge and the mesa: play until someone has banked 5 s of crown time
for (const i of [0, 6, 7]) {
  await page.goto('file://' + file); await page.waitForFunction(() => window.__dr && window.__dr.G.world, null, { timeout: 30000 });
  await page.evaluate(i => { window.__dr.flow.setMode('showdown'); window.__dr.flow.startRace(i); }, i);
  await page.waitForFunction(i => window.__dr.G.world.idx === i && window.__dr.race && window.__dr.race.sd, i, { timeout: 30000 });
  const info = await page.evaluate(() => {
    const d = window.__dr; window.requestAnimationFrame = () => 0;
    d.G.state = 'racing'; d.race.phase = 'racing'; d.race.autoPlayer = true;
    for (let k = 0; k < 60 && Math.max(...d.race.sd.crown) < 5 && d.race.sd.phase !== 'over'; k++) d.step(0.5);
    d.step(0.2);
    return { stage: d.G.world.stage.name, crown: d.race.sd.crown.map(v => v.toFixed(1)).join('/'), holder: d.race.sd.holder, phase: d.race.sd.phase, rows: document.querySelectorAll('#sd-rows .sd-bar').length, panel: !document.getElementById('sd-panel').hidden, view: d.race.sd.view };
  });
  await page.screenshot({ path: path.join(outDir, `showdown${i + 1}.png`) });
  console.log(`showdown ${info.stage}: crown ${info.crown} (holder ${info.holder}), phase ${info.phase}, panel ${info.panel} with ${info.rows} bars, view ${info.view.hw.toFixed(1)}x${info.view.hh.toFixed(1)}`);
  if (info.holder < 0 || !info.panel || info.rows !== 4) errors.push('showdown crown / panel missing on ' + info.stage);
}
await page.evaluate(() => window.__dr.flow.setMode('race'));
// the garage: pick each vehicle in turn, race it briefly: its body is built (moving parts too) and nothing errors
{
  await page.goto('file://' + file); await page.waitForFunction(() => window.__dr && window.__dr.G.world, null, { timeout: 30000 });
  await page.click('#veh-btn'); await page.waitForFunction(() => document.querySelectorAll('.g-card img[src^="data:"]').length > 13, null, { timeout: 60000 });
  const ids = await page.evaluate(() => [...document.querySelectorAll('.g-card')].map(b => b.dataset.id));
  for (const id of ids) {
    await page.click(`.g-card[data-id="${id}"]`);
    await page.evaluate(() => window.__dr.flow.startRace(9));
    await page.waitForFunction(() => window.__dr.race && window.__dr.G.world.idx === 9, null, { timeout: 30000 });
    const got = await page.evaluate(() => { const d = window.__dr; d.G.state = 'racing'; d.race.phase = 'racing'; d.race.autoPlayer = true; for (let k = 0; k < 20; k++) d.step(1 / 30); return { v: d.G.vehicle, model: d.carVis[2].def.model, pm: d.race.player.def.model }; });
    if (got.v !== id || got.model !== got.pm) errors.push(`garage: picked ${id}, raced ${got.pm} drawn as ${got.model}`);
    await page.evaluate(() => window.__dr.flow.toMenu()); await page.click('#veh-btn');
  }
  console.log(`garage: raced all ${ids.length} vehicles`);
}
// a car per stage: pick one on stage 3, another on stage 4; each comes back with its stage
{
  await page.click('#garage-done'); await page.evaluate(() => window.__dr.flow.toMenu());
  const pick = async (i, id) => { await page.evaluate(i => window.__dr.flow.selectStage(i), i); await page.click('#veh-btn'); await page.click(`.g-card[data-id="${id}"]`); await page.click('#garage-done'); };
  await pick(2, 'rover'); await pick(3, 'kart');
  const back = await page.evaluate(() => { window.__dr.flow.selectStage(2); const a = window.__dr.G.vehicle; window.__dr.flow.selectStage(3); return [a, window.__dr.G.vehicle, document.getElementById('best-2').textContent]; });
  if (back[0] !== 'rover' || back[1] !== 'kart' || !/Rover|rover/i.test(back[2])) errors.push('car per stage: ' + JSON.stringify(back));
  console.log(`car per stage: stage 3 ${back[0]}, stage 4 ${back[1]} ("${back[2]}")`);
}
// a league: open the Rookie Cup, race round 1 to the flag, the table scores it, Next starts round 2 with the leader at the back
{
  await page.evaluate(() => { localStorage.removeItem('downhill-rush-league'); window.__dr.flow.toMenu(); });
  await page.click('#league-btn'); await page.click('.lg-item[data-id="rookie"]');
  const cars = await page.$$eval('.lg-car', bs => bs.map(b => b.textContent));
  await page.click('#lg-actions .cta');
  await page.waitForFunction(() => window.__dr.race && window.__dr.G.world.idx === 0 && window.__dr.G.state === 'countdown', null, { timeout: 30000 });
  const n = await page.evaluate(() => { const d = window.__dr; d.G.state = 'racing'; d.race.phase = 'racing'; d.race.autoPlayer = true;
    for (let k = 0; k < 400 && !d.race.player.finished; k++) d.step(0.5); d.flow.showResults(); return d.race.cars.length; });   // the frame loop would show them
  const res = await page.evaluate(() => ({ shown: !document.getElementById('results').hidden, rows: document.querySelectorAll('#res-league tr').length, next: document.getElementById('next-btn').textContent, again: document.getElementById('again-btn').hidden }));
  if (n !== 8 || !res.shown || res.rows !== 8 || !/Next round: Pine Forest/.test(res.next) || !res.again) errors.push('league round 1: ' + JSON.stringify({ n, ...res }));
  await page.click('#next-btn');
  await page.waitForFunction(() => window.__dr.race && window.__dr.G.world.idx === 1, null, { timeout: 30000 });
  const grid = await page.evaluate(() => { const d = window.__dr, t = JSON.parse(localStorage.getItem('downhill-rush-league')).rookie; const lead = Object.entries(t.pts).sort((a, b) => b[1] - a[1])[0][0];
    return { round: d.G.league && d.G.league.round, last: d.race.cars[d.race.cars.length - 1].name, lead }; });
  if (grid.round !== 1 || grid.last !== grid.lead) errors.push('league round 2: ' + JSON.stringify(grid));
  await page.screenshot({ path: path.join(outDir, 'league-round2.png') });
  await page.evaluate(() => window.__dr.flow.toMenu()); await page.click('#league-btn');
  const prog = await page.$eval('.lg-item[data-id="rookie"] em', e => e.textContent); await page.click('.lg-item[data-id="rookie"]');
  await page.screenshot({ path: path.join(outDir, 'league.png') });
  if (!/Round 2 of 4/.test(prog)) errors.push('league list progress: ' + prog);
  const again = await page.$eval('#lg-actions .cta', b => b.textContent);
  if (!/round 2/.test(again)) errors.push('league screen after round 1: ' + again);
  await page.keyboard.press('Escape');
  console.log(`league: cars ${cars.join(', ')}; round 1 scored (${res.rows} in the table), round 2 grid ends with the leader ${grid.lead}; "${again}"`);
}
// the Rivals setting: a full field of 19 (one of every vehicle), then down to a single rival; the meshes follow
{
  await page.evaluate(() => window.__dr.flow.toMenu()); await page.evaluate(() => { document.getElementById('garage').hidden = true; });
  for (const [btn, want] of [['#rivals-more', 19], ['#rivals-less', 2]]) {
    while (await page.$eval(btn, b => !b.disabled)) await page.click(btn);
    await page.evaluate(() => window.__dr.flow.startRace(0)); await page.waitForFunction(() => window.__dr.race && window.__dr.G.world.idx === 0, null, { timeout: 30000 });
    const got = await page.evaluate(() => { const d = window.__dr; d.G.state = 'racing'; d.race.phase = 'racing'; d.race.autoPlayer = true; for (let k = 0; k < 30; k++) d.step(1 / 30);
      return { n: d.race.cars.length, vis: d.carVis.length, same: d.race.cars.every((c, k) => d.carVis[k].def.model === c.def.model), rows: document.querySelectorAll('#standings li:not(.gap)').length }; });
    if (got.n !== want || got.vis !== want || !got.same) errors.push(`rivals: wanted ${want} cars, raced ${got.n} with ${got.vis} meshes${got.same ? '' : ' (wrong bodies)'}`);
    if (got.rows > 6) errors.push(`rivals: the standings list ${got.rows} rows`);
    console.log(`rivals: ${got.n} cars raced, ${got.rows} rows in the standings`);
    await page.evaluate(() => window.__dr.flow.toMenu());
  }
}
// weapons: crates appear, F fires what you hold (each of the five), Q swings a door, the HUD follows
{
  await page.evaluate(() => window.__dr.flow.startRace(0)); await page.waitForFunction(() => window.__dr.race && window.__dr.G.world.idx === 0, null, { timeout: 30000 });
  await page.evaluate(() => { const d = window.__dr; d.G.state = 'racing'; d.race.phase = 'racing'; d.race.autoPlayer = false; d.step(3); });   // you fire, not the AI
  const used = [];
  for (const item of ['missile', 'gun', 'oil', 'pulse', 'harpoon']) {
    await page.evaluate(it => { const P = window.__dr.race.player; P.wpn.item = it; P.wpn.uses = 1; P.wpn.gunT = 0; }, item);
    const hud = await page.evaluate(() => { window.__dr.step(0.05); return document.getElementById('wpn-state').textContent; });
    await page.keyboard.press('KeyF');
    const ok = await page.evaluate(() => { const d = window.__dr; d.step(0.3); return !d.race.player.wpn.item; });
    used.push(item + (ok ? '' : ' (not fired)')); if (!ok || !/·|Missile|gun|Oil|Shock|Harpoon/.test(hud)) errors.push(`weapons: ${item} hud "${hud}" fired ${ok}`);
  }
  await page.keyboard.press('KeyQ');
  const got = await page.evaluate(() => { const d = window.__dr; d.step(0.1); return { crates: d.race.wpn.crates.length, door: d.race.player.wpn.doorCool > 0 }; });
  if (!got.door) errors.push('weapons: door did not swing');
  console.log(`weapons: fired ${used.join(', ')}; door swung; ${got.crates} crates on the road`);
  await page.evaluate(() => window.__dr.flow.toMenu());
}
// every camera: a Race draws from each (the perspective ones really are perspective), Showdown modes stay top-down
{
  await page.evaluate(() => window.__dr.flow.startRace(6)); await page.waitForFunction(() => window.__dr.race && window.__dr.G.world.idx === 6, null, { timeout: 30000 });
  const got = await page.evaluate(() => { const d = window.__dr, out = []; d.G.state = 'racing'; d.race.phase = 'racing'; d.race.autoPlayer = true; d.step(4);
    for (const m of ['classic', 'overhead', 'low', 'chase', 'behind', 'follow', 'heli', 'bonnet', 'tv']) { d.G.camMode = m; d.step(0.4); out.push([m, d.G.persp, d.G.camDir.every(Number.isFinite)]); }
    d.G.camMode = 'classic'; return out; });
  for (const [m, persp, ok] of got) if (!ok || persp !== ['behind', 'follow', 'heli', 'bonnet', 'tv'].includes(m)) errors.push(`camera ${m}: persp ${persp}, finite ${ok}`);
  console.log('cameras: ' + got.map(([m, p]) => m + (p ? '*' : '')).join(' ') + '  (* perspective)');
  await page.screenshot({ path: path.join(outDir, 'camera-tv.png') });
  await page.evaluate(() => window.__dr.flow.toMenu());
}
// the checkpoint modes: a Deuce match runs, the gate stands on the road and the HUD shows the points
{
  await page.click('.mode-btn[data-mode="deuce"]');
  await page.evaluate(() => window.__dr.flow.startRace(10)); await page.waitForFunction(() => window.__dr.race && window.__dr.G.world.idx === 10, null, { timeout: 30000 });
  const got = await page.evaluate(() => { const d = window.__dr; d.G.camMode = 'behind'; d.G.state = 'racing'; d.race.phase = 'racing'; d.race.autoPlayer = true; for (let k = 0; k < 90; k++) d.step(1 / 30);
    const flat = !d.G.persp; d.G.camMode = 'classic'; if (!flat) return { persp: true };
    return { kind: d.race.sd && d.race.sd.kind, gate: !!(d.race.sd && d.race.sd.gate), rows: document.querySelectorAll('#sd-rows li').length, title: document.getElementById('sd-title').textContent }; });
  if (got.kind !== 'deuce' || !got.gate || got.rows !== 4 || !/two clear/.test(got.title)) errors.push('deuce: ' + JSON.stringify(got));
  console.log(`deuce: ${got.rows} rows, "${got.title}"`);
  await page.evaluate(() => window.__dr.flow.toMenu()); await page.click('.mode-btn[data-mode="race"]');
}
// an element sandbox with the debug overlay: ?sandbox=<name>&debug loads it as the last stage and shows the readout
for (const sb of ['tunnel', 'town']) {
  await page.goto('file://' + file + `?sandbox=${sb}&debug`); await page.waitForFunction(() => window.__dr && window.__dr.G.world, null, { timeout: 30000 });
  const info = await page.evaluate(() => { const d = window.__dr; d.flow.startRace(d.core.STAGES.length - 1); return null; });
  await page.waitForFunction(() => window.__dr.race && window.__dr.G.world.stage.name.startsWith('Sandbox'), null, { timeout: 30000 });
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => ({ stage: window.__dr.G.world.stage.name, panel: (document.getElementById('dbg-panel') || {}).textContent || '' }));
  console.log(`sandbox ${r.stage}: overlay ${r.panel.split('\n')[0]}`);
  if (!r.panel.includes('Sandbox')) errors.push('debug overlay missing on sandbox ' + sb);
}
// the see-through window opens only inside long tunnels: check it live (real frame loop) in and out of the Mountain Pass tunnel
{
  await page.goto('file://' + file); await page.waitForFunction(() => window.__dr && window.__dr.G.world, null, { timeout: 30000 });
  const put = async (idx, inTunnel) => {
    await page.evaluate(([idx, inTunnel]) => { const d = window.__dr, tr = d.G.world.tr, cov = d.G.world.cover; let i = cov.findIndex(v => inTunnel ? v : false); if (!inTunnel) i = 60;
      if (inTunnel) i += 30; const P = d.race.player; d.G.state = 'racing'; d.race.phase = 'racing'; d.race.autoPlayer = true;
      P.x = tr.xs[i]; P.z = tr.zs[i]; P.y = tr.H[i]; P.yaw = tr.th[i]; P.vx = P.vz = 0; P.pr = d.core.project(tr, P.x, P.z, i, 3, 3); P.lastGood = i; }, [idx, inTunnel]);
    // the real loop eases the window open or shut; give it time to settle (software GL frames are slow)
    await page.waitForFunction(inT => { const r = window.__dr.CUT.r.value; return inT ? r > 4 : r < 1; }, inTunnel, { timeout: 15000 }).catch(() => {});
    return page.evaluate(() => window.__dr.CUT.r.value);
  };
  await page.evaluate(() => window.__dr.flow.startRace(5)); await page.waitForFunction(() => window.__dr.G.world.idx === 5 && window.__dr.race, null, { timeout: 30000 });
  const inside = await put(5, true), outside = await put(5, false);
  console.log(`see-through: ${inside.toFixed(2)} inside the Mountain Pass tunnel, ${outside.toFixed(2)} on open road`);
  if (!(inside > 4) || !(outside < 1)) errors.push(`see-through window wrong: ${inside} in tunnel, ${outside} outside`);
}
// Touch controls on a landscape phone, two thumbs at once: drag the wheel, hold the pedal, slide down to drift, left to brake
await page.goto('about:blank');   // park the desktop page so its render loop doesn't starve this one (software GL)
{
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const tp = await ctx.newPage(); tp.on('pageerror', e => errors.push(e.message));
  await tp.goto('file://' + file); await tp.waitForFunction(() => window.__dr && window.__dr.G.world, null, { timeout: 30000 });
  await tp.evaluate(() => window.__dr.flow.startRace(0));
  await tp.waitForFunction(() => window.__dr.race && !document.getElementById('touch').hidden, null, { timeout: 30000 });
  await tp.evaluate(() => { window.__dr.G.state = 'racing'; window.__dr.race.phase = 'racing'; });
  const cdp = await ctx.newCDPSession(tp), box = id => tp.evaluate(id => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, id);
  const w = await box('wheel'), p = await box('pedal');
  // phone HUD: the speedo sits under the timer, clear of it and of the Reset/Pause buttons
  const clash = await tp.evaluate(() => { const r = q => document.querySelector(q).getBoundingClientRect(), hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    const sp = r('#speed-block'), out = ['#time', '.hud-btns', '#best'].filter(q => hit(sp, r(q)));
    for (const q of ['#wpn-fire', '#wpn-door']) if (hit(r(q), r('#pedal'))) out.push(q + ' (on Gas)');
    if (r('#wpn-fire').bottom > r('#pedal').top + 1 || r('#wpn-fire').top < r('#pedal').top - 140) out.push('#wpn-fire (not just above Gas)');
    return out; });
  if (clash.length) errors.push('phone HUD: overlaps / misplaced: ' + clash.join(', '));
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
  // frames are slow under SwiftShader, so wait (up to 3 s) for the player's inputs to reach the expected state
  const expect = async (name, pred, arg = null, timeout = 3000) => { const ok = await tp.waitForFunction(pred, arg, { timeout }).then(() => true, () => false); checks.push([name, ok]); };
  // point-to-steer: the car ends up facing (on screen) the way the thumb points from the wheel's centre
  const facing = ([ax, ay]) => { const P = window.__dr.race.player, [sx, sy] = window.__dr.core.screenOffset(P.x + Math.sin(P.yaw), P.y, P.z + Math.cos(P.yaw), P); return (sx * ax + sy * ay) / (Math.hypot(sx, sy) * Math.hypot(ax, ay)) > 0.9; };
  // ...or, while it is still turning (a barrier can hold it straight for a while), steering hard toward that direction
  const steersToward = ([ax, ay]) => { const P = window.__dr.race.player, [gx, gz] = window.__dr.core.groundDir(ax, ay), err = window.__dr.core.wrapAngle(Math.atan2(gx, gz) - P.yaw);
    return Math.abs(err) < 0.3 || (Math.sign(P.inp.steer) === -Math.sign(err) * (P.vf < -1 ? -1 : 1) && Math.abs(P.inp.steer) > 0.5); };
  const checks = [];
  await touch('touchStart', [[w.x, w.y], [p.x, p.y]]);
  await touch('touchMove', [[w.x + 50, w.y], [p.x, p.y]]);
  await expect('gas', () => { const r = window.__dr.race.player.inp; return r.throttle === 1 && !r.handbrake && !r.brake; });
  await expect('point right: car turns to face right', facing, [1, 0], 10000);
  await touch('touchMove', [[w.x - 35, w.y - 35], [p.x, p.y]]);
  await expect('point up-left: car steers toward up-left', steersToward, [-1, 1], 3000);
  await touch('touchMove', [[w.x - 35, w.y - 35], [p.x, p.y + 45]]);
  await expect('slide down drifts', () => { const r = window.__dr.race.player.inp; return r.throttle === 1 && r.handbrake === 1; });
  await touch('touchMove', [[w.x - 35, w.y - 35], [p.x - 45, p.y]]);
  await expect('slide left brakes', () => { const r = window.__dr.race.player.inp; return r.brake === 1 && r.throttle === 0 && !r.handbrake; });
  // slide the Gas thumb up onto Fire: it fires, still on the gas
  await touch('touchMove', [[w.x - 35, w.y - 35], [p.x, p.y]]);
  await tp.evaluate(() => { const P = window.__dr.race.player; window.__dr.race.weapons = true; P.wpn.item = 'oil'; P.wpn.uses = 1; });
  await touch('touchMove', [[w.x - 35, w.y - 35], [p.x, p.y - 30]]); await touch('touchMove', [[w.x - 35, w.y - 35], [p.x, p.y - 70]]);
  await expect('slide up fires, gas still on', () => { const P = window.__dr.race.player; return !P.wpn.item && P.inp.throttle === 1; });
  await touch('touchEnd', []);
  await expect('release', () => { const r = window.__dr.race.player.inp; return !r.throttle && !r.brake && !r.handbrake && Math.abs(r.steer) < 0.05; });
  await tp.screenshot({ path: path.join(outDir, 'touch-landscape.png') });
  // steering option: switch to the arrows with the Steering button, hold left, slide across to right without lifting
  checks.push(['steering button shown on touch', await tp.evaluate(() => !document.getElementById('steer-btn').hidden)]);
  await tp.evaluate(() => document.getElementById('steer-btn2').click());
  checks.push(['arrows replace the wheel', await tp.evaluate(() => window.__dr.G.steer === 'arrows' && !document.getElementById('arrows').hidden && document.getElementById('wheel').hidden && localStorage.getItem('downhill-rush-steer') === 'arrows')]);
  const al = await tp.evaluate(() => [...document.querySelectorAll('#arrows i')].map(e => { const r = e.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }));
  await touch('touchStart', [al[0]]);
  await expect('left arrow steers left', () => window.__dr.race.player.inp.steer < -0.5);
  await touch('touchMove', [al[1]]);
  await expect('slide to right arrow steers right', () => window.__dr.race.player.inp.steer > 0.5);
  await tp.screenshot({ path: path.join(outDir, 'touch-arrows.png') });
  await touch('touchEnd', []);
  await expect('arrows released', () => Math.abs(window.__dr.race.player.inp.steer) < 0.05);
  for (const [name, ok] of checks) { console.log(`touch ${name}: ${ok ? 'ok' : 'FAILED'}`); if (!ok) errors.push('touch control check failed: ' + name); }
  await ctx.close();
}
await browser.close();
if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('smoke test passed');
