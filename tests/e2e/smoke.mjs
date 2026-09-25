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
// the Rivals setting: a full field of 14 (one of every vehicle), then down to a single rival; the meshes follow
{
  await page.evaluate(() => window.__dr.flow.toMenu()); await page.evaluate(() => { document.getElementById('garage').hidden = true; });
  for (const [btn, want] of [['#rivals-more', 14], ['#rivals-less', 2]]) {
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
    const sp = r('#speed-block'); return ['#time', '.hud-btns', '#best'].filter(q => hit(sp, r(q))); });
  if (clash.length) errors.push('phone HUD: speed block overlaps ' + clash.join(', '));
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
