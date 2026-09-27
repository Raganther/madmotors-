// Close-ups of vehicles (near bodies forced on), front three-quarter clean and rear with some dirt, HUD hidden:
//   npm run build && node tools/closeup.mjs <out dir> <vehicle id ...>    (writes <id>-front.png, <id>-rear.png)
import { chromium } from 'playwright';
import path from 'node:path';
const out = process.argv[2], veh = process.argv.slice(3);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 900, height: 560 } });
await p.goto('file://' + path.resolve('dist/index.html')); await p.waitForFunction(() => window.__dr && window.__dr.G.world);
for (const v of veh) for (const [ang, tag, dirt] of [[0.55, 'warm', 0], [0.55, 'front', 0], [2.6, 'rear', 0.3]]) {   // the first render of a new race misses the car: warm up
  if (tag === 'warm' && v !== veh[0]) continue;
  await p.evaluate(([v, ang, dirt]) => {
    const d = window.__dr, G = d.G; window.requestAnimationFrame = () => 0; document.querySelectorAll('body *').forEach(e => { if (!e.querySelector('canvas') && e.tagName !== 'CANVAS') e.style.visibility = 'hidden'; }); G.vehicle = G.defaultVehicle = v; G.stageCars = {}; G.camMode = 'behind'; G.carDetail = 'near'; G.rivals = 0; d.flow.startRace(0); d.step(0.3);
    const c = d.race.player, vis = d.carVis[d.race.cars.indexOf(c)]; if (vis.dirt) { vis.dirt.amt = dirt; vis.dirt.mat.opacity = Math.min(0.95, dirt * 1.3); vis.dirt.wmat.opacity = Math.min(0.97, dirt * 3); }
    const P = vis.root.position, a = c.yaw + ang, r = 5.2;
    const cam3 = d.pcamera; cam3.position.set(P.x + Math.sin(a) * r, P.y + 1.6, P.z + Math.cos(a) * r); cam3.fov = 40; cam3.updateProjectionMatrix(); cam3.lookAt(P.x, P.y + 0.7, P.z); d.renderFrame();
  }, [v, ang, dirt]);
  if (tag !== 'warm') await p.screenshot({ path: `${out}/${v}-${tag}.png` });
}
await b.close();
