// Draw calls and triangles in one frame of a full race (14 cars), with and without the cars, and meshes per car.
// Every mesh is a draw call, twice when it casts a shadow: on real GPUs the count matters more than SwiftShader's
// frame times show. npm run build && node tools/drawcalls.mjs
import { chromium } from 'playwright';
import path from 'node:path';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 960, height: 540 } });
await p.goto('file://' + path.resolve('dist/index.html')); await p.waitForFunction(() => window.__dr && window.__dr.G.world);
const r = await p.evaluate(() => {
  const d = window.__dr, G = d.G, R = d.renderer; window.requestAnimationFrame = () => 0; G.rivals = 13; d.flow.startRace(1); d.step(0.5);
  const count = () => { R.info.autoReset = false; R.info.reset(); d.renderFrame(); const o = { calls: R.info.render.calls, tris: R.info.render.triangles }; R.info.autoReset = true; return o; };
  const out = { all: count() };
  let meshes = 0, dirt = 0; const perCar = []; d.carVis.forEach(v => { let n = 0; v.root.traverse(o => { if (o.isMesh && o.visible) n++; }); perCar.push(n); });
  out.meshesPerCar = perCar.slice(0, 4);
  d.carVis.forEach(v => { v.root.visible = false; }); out.noCars = count(); d.carVis.forEach(v => { v.root.visible = true; });
  out.programs = R.info.programs.length;
  return out;
});
console.log(JSON.stringify(r)); await b.close();
