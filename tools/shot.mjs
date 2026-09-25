// Screenshots from the player's seat on the production build (run `npm run build` first). The player car drives
// itself (AI) to each race distance and the frame is saved, so wear, mud and dirt have built up the way they would.
//   node tools/shot.mjs <stage|sandbox:name> [metres ...] [--vehicle id] [--debug] [--w 1100 --h 620]
//   --eval '<js>' runs in the page once the race is built (window.__dr as d), e.g. to recolour something to find it
//   node tools/shot.mjs garage              the garage, top and bottom, once every vehicle's picture is drawn
// Stage is a 1-based number or (part of) its name. Metres are from the start line (1 sample = 1 m; past one lap on a circuit is lap 2).
// Default: 5 points spread over the first lap. Files go to tools/out/shot-<id>-<m>.png. Exits 1 on page errors.
import { chromium } from 'playwright';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { stageFromArg } from './stage-arg.js';
import { STAGES } from '../src/core/index.js';
import { SANDBOXES } from '../src/data/sandboxes/index.js';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const flag = k => { const i = args.indexOf('--' + k); if (i < 0) return false; args.splice(i, 1); return true; };
const evalJs = opt('eval', ''), vehicle = opt('vehicle', 'coupe'), W = +opt('w', 1100), H = +opt('h', 620), debug = flag('debug');
const [which = '', ...marks] = args, sb = which.startsWith('sandbox:') ? which.slice(8) : null;
if (sb && !SANDBOXES[sb]) throw new Error(`no sandbox "${sb}"; sandboxes: ${Object.keys(SANDBOXES).join(', ')}`);
const garage = which === 'garage';
const idx = garage ? 0 : sb ? STAGES.length : stageFromArg(which), id = sb ? 'sandbox-' + sb : String(idx + 1);
const q = new URLSearchParams(); if (sb) q.set('sandbox', sb); if (debug) q.set('debug', '');
mkdirSync('tools/out', { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: W, height: H } }), errs = [];
page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_CERT|net::/.test(m.text())) errs.push(m.text()); });
await page.goto('file://' + path.resolve('dist/index.html') + '?' + q); await page.waitForFunction(() => window.__dr && window.__dr.G.world, null, { timeout: 30000 });
if (garage) {
  await page.click('#veh-btn');
  await page.waitForFunction(() => [...document.querySelectorAll('#garage-grid img')].every(i => i.complete && i.naturalWidth), null, { timeout: 120000 });
  for (const end of ['top', 'bottom']) {
    await page.evaluate(e => { const g = document.getElementById('garage-grid'); g.scrollTop = e === 'top' ? 0 : g.scrollHeight; }, end);
    const file = `tools/out/shot-garage-${end}.png`; await page.screenshot({ path: file }); console.log(file);
  }
  if (errs.length) console.log('page errors:\n  ' + errs.join('\n  '));
  await browser.close(); process.exit(errs.length ? 1 : 0);
}
await page.evaluate(([i, v]) => { window.__dr.G.vehicle = v; window.__dr.flow.startRace(i); }, [idx, vehicle]);
await page.waitForFunction(i => window.__dr.race && window.__dr.G.world.idx === i, idx, { timeout: 30000 });
const info = await page.evaluate(() => {
  const d = window.__dr; window.requestAnimationFrame = () => 0;   // we drive the frames
  d.G.state = 'racing'; d.race.phase = 'racing'; d.race.autoPlayer = true; d.G.hintTimer = 0;
  for (const e of ['hint', 'countdown']) document.getElementById(e).hidden = true;
  const tr = d.G.world.tr; return { name: d.G.world.stage.name, s0: tr.startIdx, len: tr.loopN || tr.finishIdx - tr.startIdx };
});
if (evalJs) await page.evaluate(js => { const d = window.__dr; (0, eval)('(d) => {' + js + '}')(d); }, evalJs);
const pts = marks.length ? marks.map(Number) : [0.1, 0.3, 0.5, 0.7, 0.9].map(f => Math.round(f * info.len));
for (const m of pts) {
  const got = await page.evaluate(tgt => {
    const d = window.__dr, P = d.race.player; let n = 0;
    while (P.progress < tgt - 30 && n++ < 60000) { for (let k = 0; k < 4; k++) { d.flow.savePrev(); d.core.raceStep(d.race, d.core.STEP, d.G.world.W); } d.flow.handleEvents(); }   // fast: sim only
    while (P.progress < tgt && n++ < 60000) d.step(1 / 60);                                                                                                      // last stretch drawn, so the camera and effects catch up
    if (d.G.world.W.wear) d.G.world.W.wear.ver++;
    d.CUT.car.value.set(P.x, P.y, P.z); d.CUT.r.value = d.G.world.cover[d.G.world.tr.bi(P.pr.i)] ? 8.5 : 0;   // the see-through window, as the game loop sets it
    d.step(0.2); return Math.round(P.progress - d.G.world.tr.startIdx);
  }, info.s0 + m);
  const file = `tools/out/shot-${id}-${m}.png`; await page.screenshot({ path: file }); console.log(`${file}  (${info.name}, ${got} m)`);
}
if (errs.length) console.log('page errors:\n  ' + errs.join('\n  '));
await browser.close(); process.exit(errs.length ? 1 : 0);
