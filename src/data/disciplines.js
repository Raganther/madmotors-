import { bandRank, ratingOf } from './ratings.js';

// Disciplines (G1): what kind of racing a car is built for. They replace the career's old classes. Five are by
// vehicle (a car can be in more than one); Derby is earned: any car whose toughness (data/ratings.js, with its
// parts: a roll cage and armour count) is band B or better.
// An event's entry is { disc, maxPace?, maxTough? }: a car must be in the discipline and, when the event caps it, no
// better than that band in pace (on the discipline's surface) or toughness.
//   surface  which pace counts for the discipline: 'tarmac', 'loose', or 'pace' (the car's better one)
export const DISCIPLINES = {
  road: { name: 'Road', blurb: 'road cars built for tarmac', surface: 'tarmac', cars: ['coupe', 'wedge', 'formula', 'rocket', 'hotrod', 'police', 'limo', 'kart', 'sidecar', 'taxi', 'gt', 'roadster'] },
  rally: { name: 'Rally', blurb: 'quick on tarmac and gravel alike', surface: 'loose', cars: ['hatch', 'wedge', 'buggy', 'tuktuk', 'police', 'estate'] },
  offroad: { name: 'Off-road', blurb: 'mud, snow and open country', surface: 'loose', cars: ['buggy', 'monster', 'rover', 'hover', 'snowcat', 'hatch', 'pickup'] },
  heavy: { name: 'Heavy', blurb: 'trucks, vans and limos', surface: 'pace', cars: ['monster', 'icecream', 'firetruck', 'snowcat', 'limo', 'mixer'] },
  oddball: { name: 'Oddball', blurb: 'karts, trikes, bikes and stranger things', surface: 'pace', cars: ['kart', 'tuktuk', 'icecream', 'hover', 'sidecar', 'rocket', 'rover', 'taxi'] },
  derby: { name: 'Derby', blurb: 'tough enough to trade blows (toughness B or better)', surface: 'pace', minTough: 'B' },
};
export const DISC_IDS = Object.keys(DISCIPLINES);
/** Is vehicle id (with build b) in discipline d? */
export function inDisc(d, id, b) {
  const D = DISCIPLINES[d]; if (!D) return false;
  if (D.cars) return D.cars.includes(id);
  return bandRank(ratingOf(id, b).bands.tough) >= bandRank(D.minTough);
}
/** The disciplines vehicle id (with build b) is in. */
export const discsOf = (id, b) => DISC_IDS.filter(d => inDisc(d, id, b));
/** Can vehicle id with build b enter an event with entry e ({ disc, maxPace, maxTough }; none = open to all)? */
export function entryOK(e, id, b) {
  if (!e || !e.disc) return true;
  if (!inDisc(e.disc, id, b)) return false;
  const r = ratingOf(id, b), surf = DISCIPLINES[e.disc].surface;
  if (e.maxPace && bandRank(r.bands[surf]) > bandRank(e.maxPace)) return false;
  if (e.maxTough && bandRank(r.bands.tough) > bandRank(e.maxTough)) return false;
  return true;
}
/** Why vehicle id with build b can't enter (for the UI), or ''. */
export function entryWhy(e, id, b) {
  if (entryOK(e, id, b)) return '';
  const D = DISCIPLINES[e.disc], r = ratingOf(id, b);
  if (!inDisc(e.disc, id, b)) return `for ${D.name} cars (${D.blurb})`;
  if (e.maxPace && bandRank(r.bands[D.surface]) > bandRank(e.maxPace)) return `capped at pace ${e.maxPace} (yours is ${r.bands[D.surface]})`;
  return `capped at toughness ${e.maxTough} (yours is ${r.bands.tough})`;
}
