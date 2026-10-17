// What each car shows under its lids, both providers: which panels it has and whether render/anatomy.js filled the
// engine bay and the boot (userData.bay). npm run build first. --shots <dir> also saves each car with its lids open.
import { chromium } from 'playwright';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
const args = process.argv.slice(2), si = args.indexOf('--shots'), shots = si >= 0 ? args.splice(si, 2)[1] : null, ids = args;
if (shots) mkdirSync(shots, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 760, height: 520 } }), errs = [];
p.on('pageerror', e => errs.push(e.message));
await p.goto('file://' + path.resolve('dist/index.html') + '?lab'); await p.waitForSelector('#lab-list [data-id]');
await p.addStyleTag({ content: '#lab-side,#lab-bar,#lab-notes,#lab-stats,#lab-parts{display:none!important}' });
await p.evaluate(() => document.getElementById('lab-spin').click());
const { VEHICLES } = await import('../src/data/vehicles.js');
for (const v of ids.length ? VEHICLES.filter(v => ids.includes(v.id)) : VEHICLES) {
  const row = [v.id.padEnd(11)];
  for (const pr of ['blender', 'classic']) {
    const r = await p.evaluate(([id, pr]) => { const btn = document.querySelector(`[data-id="${id}"]`); if (!btn) return 'no lab entry'; btn.click(); const b = document.querySelector(`[data-p=${pr}]`); if (b.disabled) return '-'; b.click();
      const pan = document.getElementById('lab-pan'); if (pan.hidden) return 'no panels'; pan.click(); pan.click();
      const P = window.__labCur && window.__labCur.v.panels; return P ? Object.keys(P).join('+') + ' ' + ['bonnet', 'boot'].map(k => P[k] ? k + ':' + (P[k].userData.bay || 'EMPTY') + '/' + P[k].userData.room : '').filter(Boolean).join(' ') : '?'; }, [v.id, pr]);
    row.push(pr[0] + ' ' + r.padEnd(46));
    if (shots && r !== '-') {   // lids open, then every panel off (the insides) from the front and from high behind (the race view)
      const snap = async (tag, js) => { await p.evaluate(js); await p.waitForTimeout(tag ? 300 : 700); await p.screenshot({ path: `${shots}/${v.id}-${pr}${tag}.png` }); };
      await snap('', () => 0);
      if (!r.startsWith('no')) { await snap('-off', () => document.getElementById('lab-pan').click()); await snap('-top', () => document.getElementById('lab-cam').click()); await p.evaluate(() => document.getElementById('lab-cam').click()); }
    }
  }
  console.log(row.join(' '));
}
if (errs.length) console.log('page errors:\n  ' + errs.join('\n  '));
await b.close(); process.exit(errs.length ? 1 : 0);
