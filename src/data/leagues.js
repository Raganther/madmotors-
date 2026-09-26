// Leagues: a run of stages raced back to back for championship points (the menu's League button; ui/league.js).
// Stages are named, not numbered, so adding a stage never reshuffles a league. Every round is a Race against the same
// LEAGUE_RIVALS; points go by finishing place, and from round 2 the grid lines up in reverse championship order.
export const LEAGUES = [
  { id: 'rookie', name: 'Rookie Cup', blurb: 'The four downhill stages, top to bottom', stages: ['Summit Meadow', 'Pine Forest', 'Quarry Run', 'Village Descent'] },
  { id: 'circuit', name: 'Circuit Series', blurb: 'Classic circuits: switchbacks, viaducts, jumps and a waterfall', stages: ['Mountain Loop', 'Mountain Pass', 'Ravenrock Gorge', 'Red Mesa Canyon', 'Thunder Falls'] },
  { id: 'mud', name: 'Mud & Snow', blurb: 'Loose surfaces all the way: bring something with off-road grip', stages: ['Quarry Run', 'Bogwood Rally', 'Frostpeak', 'Glacier Rift'] },
  { id: 'wild', name: 'Wild Cup', blurb: 'The wildest tracks, each with an off-road shortcut to find', stages: ['Corkscrew Spire', 'Scrapyard Smash', 'Mesa Leap', 'Temple Ruins', 'Glacier Rift'] },
];
export const LEAGUE_POINTS = [10, 8, 6, 5, 4, 3, 2, 1];
export const LEAGUE_RIVALS = 7;
export const leagueById = id => LEAGUES.find(l => l.id === id);
/** A fresh league run: round 0, nobody on the board. */
export const newLeague = id => ({ id, round: 0, pts: {}, results: [] });
/** Score a round: `order` is the finishing order (driver names). Returns the new run (the old one is left alone). */
export function scoreRound(run, order) {
  const pts = { ...run.pts };
  order.forEach((n, i) => { pts[n] = (pts[n] || 0) + (LEAGUE_POINTS[i] || 0); });
  return { ...run, pts, round: run.round + 1, results: [...run.results, order.slice()] };
}
/** Championship order, best first: points, then most wins, then best last result. `names` adds drivers still on 0. */
export function standings(run, names = []) {
  const all = [...new Set([...Object.keys(run.pts), ...names])];
  const wins = n => run.results.filter(r => r[0] === n).length, last = n => { const r = run.results[run.results.length - 1]; const k = r ? r.indexOf(n) : -1; return k < 0 ? 99 : k; };
  return all.map(name => ({ name, pts: run.pts[name] || 0, wins: wins(name) })).sort((a, b) => b.pts - a.pts || b.wins - a.wins || last(a.name) - last(b.name));
}
export const leagueDone = run => run.round >= leagueById(run.id).stages.length;
