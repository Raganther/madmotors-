// A scripted scene on the production build, for looking at something that a race rarely shows on cue (a car through
// a building, a collapse): `node tools/scene.mjs <stage|sandbox:name> <script.js> [--vehicle id] [--camera c]`.
// The script is the body of an async function (d, shot) run in the page: d is window.__dr, shot(name) saves
// tools/out/scene-<name>.png. DIST=<dir> uses a build elsewhere. Exits 1 on page errors.
import { chromium } from 'playwright';
import path from 'node:path';
import { readFileSync, mkdirSync } from 'node:fs';
import { stageFromArg } from './stage-arg.js';
import { STAGES } from '../src/core/index.js';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const vehicle = opt('vehicle', 'coupe'), camMode = opt('camera', 'classic'), rivals = +opt('rivals', 3), [which, file] = args, sb = which.startsWith('sandbox:') ? which.slice(8) : null;
const idx = sb ? STAGES.length : stageFromArg(which), q = new URLSearchParams(); if (sb) q.set('sandbox', sb);
mkdirSync('tools/out', { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 620 } }), errs = [];
page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_CERT|net::/.test(m.text())) errs.push(m.text()); else if (m.type() === 'log') console.log('page:', m.text()); });
await page.exposeFunction('__shot', async name => { const f = `tools/out/scene-${name}.png`; await page.screenshot({ path: f }); console.log(f); });
await page.goto('file://' + path.resolve((process.env.DIST || 'dist') + '/index.html') + '?' + q);
await page.waitForFunction(() => window.__dr && window.__dr.G.world, null, { timeout: 30000 });
await page.evaluate(([i, v, n, cm]) => { const G = window.__dr.G; G.vehicle = G.defaultVehicle = v; G.stageCars = {}; G.rivals = n; G.mode = 'race'; G.camMode = cm; window.__dr.flow.startRace(i); }, [idx, vehicle, rivals, camMode]);
await page.waitForFunction(i => window.__dr.race && window.__dr.G.world.idx === i, idx, { timeout: 30000 });
await page.evaluate(() => { const d = window.__dr; window.requestAnimationFrame = () => 0; d.G.state = 'racing'; d.race.phase = 'racing'; d.G.hintTimer = 0; for (const e of ['hint', 'countdown']) document.getElementById(e).hidden = true; });
const body = readFileSync(file, 'utf8');
await page.evaluate(async js => { const d = window.__dr; await (0, eval)('(async (d, shot) => {' + js + '})')(d, window.__shot); }, body);
if (errs.length) console.log('page errors:\n  ' + errs.join('\n  '));
await browser.close(); process.exit(errs.length ? 1 : 0);
