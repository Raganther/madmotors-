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
// Showdown on a downhill stage and on the gorge: play until at least one round is scored
for (const i of [0, 6]) {
  await page.goto('file://' + file); await page.waitForFunction(() => window.__dr && window.__dr.G.world, null, { timeout: 30000 });
  await page.evaluate(i => { window.__dr.flow.setMode('showdown'); window.__dr.flow.startRace(i); }, i);
  await page.waitForFunction(i => window.__dr.G.world.idx === i && window.__dr.race && window.__dr.race.sd, i, { timeout: 30000 });
  const info = await page.evaluate(() => {
    const d = window.__dr; window.requestAnimationFrame = () => 0;
    d.G.state = 'racing'; d.race.phase = 'racing'; d.race.autoPlayer = true;
    for (let k = 0; k < 90 && d.race.sd.rounds === 0 && d.race.sd.phase !== 'over'; k++) d.step(0.5);
    d.step(0.2);
    return { stage: d.G.world.stage.name, rounds: d.race.sd.rounds, phase: d.race.sd.phase, lights: d.race.sd.lights.join('/'), panel: !document.getElementById('sd-panel').hidden, view: d.race.sd.view };
  });
  await page.screenshot({ path: path.join(outDir, `showdown${i + 1}.png`) });
  console.log(`showdown ${info.stage}: ${info.rounds} round(s), phase ${info.phase}, lights ${info.lights}, panel ${info.panel}, view ${info.view.hw.toFixed(1)}x${info.view.hh.toFixed(1)}`);
  if (!info.rounds || !info.panel) errors.push('showdown did not score a round / show its panel on ' + info.stage);
}
await page.evaluate(() => window.__dr.flow.setMode('race'));
await browser.close();
if (errors.length) { console.error('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('smoke test passed');
