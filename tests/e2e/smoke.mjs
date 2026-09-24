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
    d.step(6);
    return { stage: d.G.world.stage.name, t: d.race.time.toFixed(1), progress: Math.round(d.race.player.progress) };
  });
  await page.screenshot({ path: path.join(outDir, `stage${i + 1}.png`) });
  console.log(`stage ${i + 1} ${info.stage}: raced ${info.t}s, player progress ${info.progress}`);
  // the real loop was stubbed out for this stage; reload for the next one
  await page.goto('file://' + file); await page.waitForFunction(() => window.__dr && window.__dr.G.world, null, { timeout: 30000 });
}
// Showdown on a downhill stage and on the gorge: play until at least one round is scored (a tight pack can take a while)
for (const i of [0, 6, 7]) {
  await page.goto('file://' + file); await page.waitForFunction(() => window.__dr && window.__dr.G.world, null, { timeout: 30000 });
  await page.evaluate(i => { window.__dr.flow.setMode('showdown'); window.__dr.flow.startRace(i); }, i);
  await page.waitForFunction(i => window.__dr.G.world.idx === i && window.__dr.race && window.__dr.race.sd, i, { timeout: 30000 });
  const info = await page.evaluate(() => {
    const d = window.__dr; window.requestAnimationFrame = () => 0;
    d.G.state = 'racing'; d.race.phase = 'racing'; d.race.autoPlayer = true;
    for (let k = 0; k < 300 && d.race.sd.rounds === 0 && d.race.sd.phase !== 'over'; k++) d.step(0.5);
    d.step(0.2);
    return { stage: d.G.world.stage.name, rounds: d.race.sd.rounds, phase: d.race.sd.phase, lights: d.race.sd.lights.join('/'), panel: !document.getElementById('sd-panel').hidden, view: d.race.sd.view };
  });
  await page.screenshot({ path: path.join(outDir, `showdown${i + 1}.png`) });
  console.log(`showdown ${info.stage}: ${info.rounds} round(s), phase ${info.phase}, lights ${info.lights}, panel ${info.panel}, view ${info.view.hw.toFixed(1)}x${info.view.hh.toFixed(1)}`);
  if (!info.rounds || !info.panel) errors.push('showdown did not score a round / show its panel on ' + info.stage);
}
await page.evaluate(() => window.__dr.flow.setMode('race'));
// Touch controls on a landscape phone, two thumbs at once: drag the wheel, hold the pedal, slide down to drift, left to brake
{
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const tp = await ctx.newPage(); tp.on('pageerror', e => errors.push(e.message));
  await tp.goto('file://' + file); await tp.waitForFunction(() => window.__dr && window.__dr.G.world, null, { timeout: 30000 });
  await tp.evaluate(() => window.__dr.flow.startRace(0));
  await tp.waitForFunction(() => window.__dr.race && !document.getElementById('touch').hidden, null, { timeout: 30000 });
  await tp.evaluate(() => { window.__dr.G.state = 'racing'; window.__dr.race.phase = 'racing'; });
  const cdp = await ctx.newCDPSession(tp), box = id => tp.evaluate(id => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, id);
  const w = await box('wheel'), p = await box('pedal');
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], id) => ({ x, y, id })) });
  // frames are slow under SwiftShader, so wait (up to 3 s) for the player's inputs to reach the expected state
  const expect = async (name, pred, arg = null, timeout = 3000) => { const ok = await tp.waitForFunction(pred, arg, { timeout }).then(() => true, () => false); checks.push([name, ok]); };
  // point-to-steer: the car ends up facing (on screen) the way the thumb points from the wheel's centre
  const facing = ([ax, ay]) => { const P = window.__dr.race.player, [sx, sy] = window.__dr.core.screenOffset(P.x + Math.sin(P.yaw), P.y, P.z + Math.cos(P.yaw), P); return (sx * ax + sy * ay) / (Math.hypot(sx, sy) * Math.hypot(ax, ay)) > 0.9; };
  const checks = [];
  await touch('touchStart', [[w.x, w.y], [p.x, p.y]]);
  await touch('touchMove', [[w.x + 50, w.y], [p.x, p.y]]);
  await expect('gas', () => { const r = window.__dr.race.player.inp; return r.throttle === 1 && !r.handbrake && !r.brake; });
  await expect('point right: car turns to face right', facing, [1, 0], 10000);
  await touch('touchMove', [[w.x - 35, w.y - 35], [p.x, p.y]]);
  await expect('point up-left: car turns to face up-left', facing, [-1, 1], 10000);
  await touch('touchMove', [[w.x - 35, w.y - 35], [p.x, p.y + 45]]);
  await expect('slide down drifts', () => { const r = window.__dr.race.player.inp; return r.throttle === 1 && r.handbrake === 1; });
  await touch('touchMove', [[w.x - 35, w.y - 35], [p.x - 45, p.y]]);
  await expect('slide left brakes', () => { const r = window.__dr.race.player.inp; return r.brake === 1 && r.throttle === 0 && !r.handbrake; });
  await touch('touchEnd', []);
  await expect('release', () => { const r = window.__dr.race.player.inp; return !r.throttle && !r.brake && !r.handbrake && Math.abs(r.steer) < 0.05; });
  await tp.screenshot({ path: path.join(outDir, 'touch-landscape.png') });
  for (const [name, ok] of checks) { console.log(`touch ${name}: ${ok ? 'ok' : 'FAILED'}`); if (!ok) errors.push('touch control check failed: ' + name); }
  await ctx.close();
}
await browser.close();
if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('smoke test passed');
