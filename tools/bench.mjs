// Render benchmark on the production build (run `npm run build` first). Places the camera at 8 points around each
// stage and times full frames with the GPU synced. Uses software rendering, so compare runs with each other rather
// than reading the numbers as real frame times.
//   node tools/bench.mjs [stage ...]         (default: all stages)
import { chromium } from 'playwright';
import path from 'node:path';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const url = 'file://' + path.resolve('dist/index.html');
await page.goto(url); await page.waitForFunction(() => window.__dr && window.__dr.G.world, null, { timeout: 30000 });
const n = await page.evaluate(() => window.__dr.core.STAGES.length);
const stages = process.argv.length > 2 ? process.argv.slice(2).map(a => Number(a) - 1) : [...Array(n).keys()];
for (const si of stages) {
  await page.goto(url); await page.waitForFunction(() => window.__dr && window.__dr.G.world, null, { timeout: 30000 });
  await page.evaluate(i => window.__dr.flow.startRace(i), si);
  await page.waitForFunction(i => window.__dr.G.world.idx === i && window.__dr.race, si, { timeout: 30000 });
  const r = await page.evaluate(() => {
    const d = window.__dr, G = d.G; window.requestAnimationFrame = () => 0; G.state = 'racing'; d.race.phase = 'racing';
    const gl = document.querySelector('canvas').getContext('webgl2') || document.querySelector('canvas').getContext('webgl');
    const px = new Uint8Array(4), sync = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const tr = G.world.tr, c = d.race.player, N = tr.loopN || tr.N, ts = [];
    for (let k = 0; k < 8; k++) {
      const i = Math.floor((k + 0.5) / 8 * N); c.x = tr.xs[i]; c.z = tr.zs[i]; c.y = tr.H[i]; c.yaw = tr.th[i]; c.pr = d.core.project(tr, c.x, c.z, i, 3, 3);
      d.step(0); sync(); const t0 = performance.now(); for (let q = 0; q < 3; q++) { d.step(0); sync(); } ts.push((performance.now() - t0) / 3);
    }
    return { name: G.world.stage.name, avg: ts.reduce((a, b) => a + b) / ts.length, max: Math.max(...ts) };
  });
  console.log(`${String(si + 1).padStart(2)} ${r.name.padEnd(18)} avg ${r.avg.toFixed(0)} ms   max ${r.max.toFixed(0)} ms`);
}
await browser.close();
