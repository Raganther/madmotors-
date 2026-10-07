// The career pacing dashboard (G4): `npm run dashboard` turns tools/out/career.json (from `npm run career -- --upg tier
// --json`) into tools/out/pacing.html, a page published as its own artifact. Per tier: how a casual (skill 0.88) and a
// good (0.95) player place and win, how fast they earn, how many races a purchase takes, and their car's pace against
// the field's; each figure against the targets in TARGETS (red when it misses).
import { readFileSync, writeFileSync } from 'node:fs';
import { CAR_BASE, COST_TABLE, PART1 } from './dashboard-data.js';

export const TARGETS = { casual: { place: [3, 4.2], win: [0, 0.25] }, good: { place: [1.4, 2.6], win: [0.3, 0.6] }, nextCar: 6 };
const data = JSON.parse(readFileSync('tools/out/career.json', 'utf8')), rows = data.report;
const tiers = [...new Set(rows.map(r => r.tier))];
const by = (t, sk) => rows.find(r => r.tier === t && r.skill === sk) || null;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const money = n => '$' + Math.round(n).toLocaleString('en-US');
const ok = (v, [a, b]) => v >= a && v <= b;
const chip = (good, text, why) => `<span class="chip ${good ? 'ok' : 'off'}" title="${esc(why)}"><i aria-hidden="true">${good ? '✓' : '!'}</i>${esc(text)}</span>`;
// one tier's card: verdicts, figures, and the cash line for both skills
function tierCard(t) {
  const c = by(t, 0.88), g = by(t, 0.95); if (!c || !g) return '';
  const pct = x => Math.round(x * 100) + '%';
  const verdicts = [
    chip(ok(c.avgPlace, TARGETS.casual.place), `Casual ${c.avgPlace.toFixed(1)} avg`, `Target: casual player averages ${TARGETS.casual.place.join('-')}th`),
    chip(ok(c.winRate, TARGETS.casual.win), `Casual wins ${pct(c.winRate)}`, `Target: casual wins at most ${pct(TARGETS.casual.win[1])}`),
    chip(ok(g.avgPlace, TARGETS.good.place), `Good ${g.avgPlace.toFixed(1)} avg`, `Target: good player averages ${TARGETS.good.place.join('-')}th`),
    chip(ok(g.winRate, TARGETS.good.win), `Good wins ${pct(g.winRate)}`, `Target: good player wins ${pct(TARGETS.good.win[0])}-${pct(TARGETS.good.win[1])}`),
    c.nextCar ? chip(c.racesToNextCar !== null && c.racesToNextCar <= TARGETS.nextCar, c.racesToNextCar === null ? 'Next tier car: not reached' : `Next tier car in ${c.racesToNextCar} races`, `Target: a casual player buys the next tier's cheapest car (${money(c.nextCar)}) within ${TARGETS.nextCar} races`) : '',
  ].join('');
  const stat = (k, v, sub) => `<div class="stat"><dt>${k}</dt><dd>${v}</dd>${sub ? `<small>${sub}</small>` : ''}</div>`;
  return `<section class="tier" aria-labelledby="h-${t}"><header><h2 id="h-${t}">${esc(t)}</h2><span class="car">driving the ${esc(c.car)} at the tier's upgrade level</span></header>
  <div class="chips">${verdicts}</div>
  <dl class="stats">${stat('Earned per race', `${money(c.perRace)} <span class="vs">/ ${money(g.perRace)}</span>`, 'casual / good')}
  ${stat('Races per level-1 part', (PART1 / c.perRace).toFixed(1), 'casual, ' + money(PART1) + ' a part')}
  ${stat('Your pace vs the field', Math.abs(c.paceGap) < 0.05 ? 'level' : `${c.paceGap > 0 ? '+' : ''}${c.paceGap.toFixed(1)}%`, Math.abs(c.paceGap) < 0.05 ? 'with the field\'s average car' : c.paceGap > 0 ? 'of a lap slower than the field\'s average car' : 'of a lap quicker than the field\'s average car')}
  ${stat('Podiums', `${c.podiums}/${c.races} <span class="vs">/ ${g.podiums}/${g.races}</span>`, 'casual / good')}</dl>
  <figure class="chart" data-tier="${esc(t)}"><figcaption>Bank balance after each race (from ${money(c.cash[0])})</figcaption><div class="plot" role="img" aria-label="Cash over the ${esc(t)} tier for a casual and a good player"></div></figure>
  <details><summary>Places race by race</summary><div class="tablewrap"><table><thead><tr><th scope="col">Race</th>${c.places.map((_, i) => `<th scope="col">${i + 1}</th>`).join('')}</tr></thead>
  <tbody><tr><th scope="row">Casual</th>${c.places.map(p => `<td>${p}</td>`).join('')}</tr><tr><th scope="row">Good</th>${g.places.map(p => `<td>${p}</td>`).join('')}</tr></tbody></table></div></details></section>`;
}
const page = `<title>Career Pacing</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Barlow:wght@400;500&family=JetBrains+Mono:wght@400;600&display=swap">
<style>
/* layout: a pit-wall board, one card per tier, verdicts first, then the numbers, then the cash trace */
:root { --bg: #f4f5f7; --panel: #ffffff; --ink: #1c2340; --ink-2: #4a5170; --muted: #7d8399; --line: #dfe2ea; --accent: #ffc72c;
  --s1: #2a78d6; --s2: #eb6834; --ok: #1f7a3a; --ok-bg: #e3f3e7; --off: #b3261e; --off-bg: #fbe6e4;
  --display: 'Barlow Condensed', 'Arial Narrow', sans-serif; --body: 'Barlow', system-ui, sans-serif; --mono: 'JetBrains Mono', ui-monospace, monospace; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #12152a; --panel: #1c2036; --ink: #eef0f7; --ink-2: #c2c6d8; --muted: #8d93ab; --line: #2f3552; --s1: #3987e5; --s2: #d95926; --ok: #7fd49a; --ok-bg: #173523; --off: #ff8f86; --off-bg: #3d1c1c; color-scheme: dark } }
:root[data-theme="dark"] { --bg: #12152a; --panel: #1c2036; --ink: #eef0f7; --ink-2: #c2c6d8; --muted: #8d93ab; --line: #2f3552; --s1: #3987e5; --s2: #d95926; --ok: #7fd49a; --ok-bg: #173523; --off: #ff8f86; --off-bg: #3d1c1c; color-scheme: dark }
body { background: var(--bg); color: var(--ink); font: 15px/1.5 var(--body); }
main { max-width: 1100px; margin: 0 auto; padding-inline: 16px; padding-block: 28px 48px; display: grid; gap: 20px; }
.top { display: grid; gap: 6px; border-bottom: 4px solid var(--accent); padding-bottom: 14px; }
h1 { font: 700 2.4rem/1 var(--display); letter-spacing: .02em; margin: 0; text-transform: uppercase; text-wrap: balance; }
.top p { margin: 0; color: var(--ink-2); max-width: 70ch; }
.meta { font: 12px var(--mono); color: var(--muted); }
.legend { display: flex; gap: 16px; flex-wrap: wrap; font-size: 13px; color: var(--ink-2); }
.legend span::before { content: ''; display: inline-block; width: 14px; height: 3px; border-radius: 2px; margin-right: 6px; vertical-align: middle; background: var(--c); }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 480px), 1fr)); gap: 16px; }
.tier { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 16px; display: grid; gap: 12px; min-width: 0; }
.tier header { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
h2 { font: 700 1.6rem/1 var(--display); text-transform: uppercase; margin: 0; letter-spacing: .03em; }
.car { color: var(--muted); font-size: 13px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { display: inline-flex; align-items: center; gap: 5px; font: 600 12px var(--body); padding: 3px 8px; border-radius: 999px; }
.chip i { font-style: normal; font-weight: 700; }
.chip.ok { background: var(--ok-bg); color: var(--ok); } .chip.off { background: var(--off-bg); color: var(--off); }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin: 0; }
.stat { display: grid; gap: 2px; } .stat dt { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.stat dd { margin: 0; font: 600 1.2rem var(--mono); font-variant-numeric: tabular-nums; } .stat .vs { color: var(--muted); font-size: .85rem; } .stat small { color: var(--muted); font-size: 12px; }
figure { margin: 0; display: grid; gap: 4px; } figcaption { font-size: 12px; color: var(--ink-2); }
.plot { position: relative; } .plot svg { display: block; width: 100%; height: auto; overflow: visible; }
.plot .axis { fill: var(--muted); font: 11px var(--mono); } .plot .grid line { stroke: var(--line); }
.tip { position: absolute; pointer-events: none; background: var(--ink); color: var(--panel); font: 12px var(--mono); padding: 6px 8px; border-radius: 6px; white-space: nowrap; transform: translate(-50%, -110%); }
details summary { cursor: pointer; color: var(--ink-2); font-size: 13px; } details summary:focus-visible { outline: 2px solid var(--accent); }
.tablewrap { overflow-x: auto; } table { border-collapse: collapse; font: 12px var(--mono); font-variant-numeric: tabular-nums; margin-top: 6px; }
th, td { padding: 3px 6px; text-align: center; border-bottom: 1px solid var(--line); } th[scope=row] { text-align: left; font-family: var(--body); }
.targets { font-size: 13px; color: var(--ink-2); display: grid; gap: 4px; } .targets b { color: var(--ink); }
@media (prefers-reduced-motion: no-preference) { .plot path.line { transition: stroke-width .15s; } }
</style>
<main>
  <div class="top"><h1>Career Pacing</h1>
    <p>Every round of every tier, raced by the game's own simulation with the AI in your seat: a casual player (skill 0.88) and a good one (0.95), each in the tier's natural car at the tier's upgrade level. Money is measured from a fresh start in each tier.</p>
    <div class="meta">${esc(data.at.slice(0, 16).replace('T', ' '))} UTC · npm run career -- --upg tier --json</div>
    <div class="legend"><span style="--c: var(--s1)">Casual (0.88)</span><span style="--c: var(--s2)">Good (0.95)</span></div></div>
  <div class="targets"><div><b>Targets.</b> Casual: averages ${TARGETS.casual.place.join('-')}th and wins at most ${Math.round(TARGETS.casual.win[1] * 100)}%. Good: averages ${TARGETS.good.place.join('-')}th and wins ${TARGETS.good.win.map(x => Math.round(x * 100)).join('-')}%. A casual player buys the next tier's cheapest car within ${TARGETS.nextCar} races. Car prices: ${CAR_BASE.map(money).join(', ')} base by tier; parts ${COST_TABLE}.</div></div>
  <div class="grid">${tiers.map(tierCard).join('')}</div>
</main>
<script>
const DATA = ${JSON.stringify(rows.map(r => ({ tier: r.tier, skill: r.skill, cash: r.cash })))};
const W = 460, H = 170, P = { l: 52, r: 12, t: 10, b: 24 };
document.querySelectorAll('figure.chart').forEach(fig => {
  const t = fig.dataset.tier, series = [0.88, 0.95].map((sk, i) => ({ sk, name: sk === 0.88 ? 'Casual' : 'Good', color: i ? 'var(--s2)' : 'var(--s1)', cash: (DATA.find(d => d.tier === t && d.skill === sk) || { cash: [] }).cash }));
  const n = Math.max(...series.map(s => s.cash.length)), max = Math.max(...series.flatMap(s => s.cash)) * 1.05, x = i => P.l + i / Math.max(1, n - 1) * (W - P.l - P.r), y = v => H - P.b - v / max * (H - P.t - P.b);
  const step = Math.pow(10, Math.floor(Math.log10(max / 3))), tick = Math.ceil(max / 4 / step) * step, ticks = []; for (let v = 0; v <= max; v += tick) ticks.push(v);
  const fmt = v => v >= 1000 ? '$' + (v / 1000).toFixed(v % 1000 ? 1 : 0) + 'k' : '$' + v;
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '"><g class="grid">' + ticks.map(v => '<line x1="' + P.l + '" x2="' + (W - P.r) + '" y1="' + y(v) + '" y2="' + y(v) + '"/>').join('') + '</g>';
  s += ticks.map(v => '<text class="axis" x="' + (P.l - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end">' + fmt(v) + '</text>').join('');
  s += '<text class="axis" x="' + P.l + '" y="' + (H - 6) + '">start</text><text class="axis" x="' + (W - P.r) + '" y="' + (H - 6) + '" text-anchor="end">race ' + (n - 1) + '</text>';
  for (const se of series) { s += '<path class="line" d="' + se.cash.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join('') + '" fill="none" stroke="' + se.color + '" stroke-width="2" stroke-linejoin="round"/>';
    const k = se.cash.length - 1; if (k >= 0) s += '<circle cx="' + x(k) + '" cy="' + y(se.cash[k]) + '" r="4" fill="' + se.color + '" stroke="var(--panel)" stroke-width="2"/>'; }
  s += '<line class="cross" x1="0" x2="0" y1="' + P.t + '" y2="' + (H - P.b) + '" stroke="var(--muted)" stroke-dasharray="3 3" visibility="hidden"/><rect x="' + P.l + '" y="0" width="' + (W - P.l - P.r) + '" height="' + H + '" fill="transparent"/></svg><div class="tip" hidden></div>';
  const plot = fig.querySelector('.plot'); plot.innerHTML = s;
  const svg = plot.querySelector('svg'), cross = svg.querySelector('.cross'), tip = plot.querySelector('.tip');
  svg.addEventListener('pointermove', e => { const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * W, i = Math.max(0, Math.min(n - 1, Math.round((px - P.l) / (W - P.l - P.r) * (n - 1))));
    cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i)); cross.setAttribute('visibility', 'visible');
    tip.hidden = false; tip.style.left = (x(i) / W * 100) + '%'; tip.style.top = '20px';
    tip.textContent = (i ? 'After race ' + i : 'Start') + ': ' + series.map(se => se.name + ' ' + (se.cash[i] !== undefined ? '$' + se.cash[i].toLocaleString('en-US') : '-')).join(' · '); });
  svg.addEventListener('pointerleave', () => { tip.hidden = true; cross.setAttribute('visibility', 'hidden'); });
});
</script>`;
writeFileSync('tools/out/pacing.html', page);
console.log('wrote tools/out/pacing.html');
