// node tools/split.mjs [dist|dist-lab]: the published page in two files. The build inlines everything into one HTML
// file (handy locally and for the e2e), but an artifact page has a size limit (~4.7 MB) that the Blender packs
// outgrow, so for publishing the module script moves to game.js beside the page (published with `files`):
// <dir>/publish/index.html + <dir>/publish/game.js.
import fs from 'node:fs';
import path from 'node:path';
const dir = process.argv[2] || 'dist', html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const open = '<script type="module" crossorigin>', a = html.indexOf(open), b = html.indexOf('</script>', a);
if (a < 0 || b < 0) throw new Error('no inline module script in ' + dir);
const out = path.join(dir, 'publish'); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'game.js'), html.slice(a + open.length, b));
fs.writeFileSync(path.join(out, 'index.html'), html.slice(0, a) + '<script type="module" src="game.js"></script>' + html.slice(b + '</script>'.length));
const kb = f => Math.round(fs.statSync(path.join(out, f)).size / 1024);
console.log(`${out}: index.html ${kb('index.html')} KB, game.js ${kb('game.js')} KB`);
