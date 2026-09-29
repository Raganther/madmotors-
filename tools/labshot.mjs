// npm run labshot -- [ids ...] [--race]: the Asset Lab's studio view of each asset, Blender beside Classic, one sheet per
// run: tools/out/labshot.png (and one PNG per asset and provider). Builds first (npm script).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2), race = args.includes('--race'), far = args.includes('--far'), ids = args.filter(a => !a.startsWith('--'));
const out = path.resolve('tools/out'); fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 900, height: 620 } }), errs = [];
p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_CERT|net::|fonts/.test(m.text())) errs.push(m.text()); });
await p.goto('file://' + path.resolve('dist/index.html') + '?lab'); await p.waitForSelector('#lab-list [data-id]');
await p.addStyleTag({ content: '#lab-side,#lab-bar,#lab-notes{display:none!important}' });
await p.evaluate(() => document.getElementById('lab-spin').click());
if (race) await p.evaluate(() => document.getElementById('lab-cam').click());
if (far) await p.evaluate(() => document.getElementById('lab-lod').click());
const all = await p.evaluate(() => [...document.querySelectorAll('#lab-list [data-id]')].map(b => b.dataset.id));
const cells = [];
for (const id of ids.length ? ids : all) {
  const row = [];
  for (const pr of ['blender', 'classic']) {
    await p.evaluate(([id, pr]) => { document.querySelector(`[data-id="${id}"]`).click(); const b = document.querySelector(`[data-p=${pr}]`); if (!b.disabled) b.click(); }, [id, pr]);
    await p.waitForTimeout(250); const f = path.join(out, `lab-${id}-${pr}.png`); await p.screenshot({ path: f }); row.push(f);
  }
  cells.push([id, row]);
}
const img = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const html = `<body style="margin:0;background:#222;color:#fff;font:14px sans-serif">${cells.map(([id, r]) => `<div style="display:flex;align-items:center"><div style="width:90px;padding:4px">${id}</div>${r.map(f => `<img src="${img(f)}" style="width:450px">`).join('')}</div>`).join('')}</body>`;
const sp = await b.newPage({ viewport: { width: 990, height: 300 } }); await sp.setContent(html); await sp.screenshot({ path: path.join(out, 'labshot.png'), fullPage: true });
console.log('tools/out/labshot.png', errs.length ? 'ERRORS: ' + errs.join(' | ') : ''); await b.close();
