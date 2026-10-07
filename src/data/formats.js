// Event formats (G2): how a career event is scored. An event names its `format` (none: by its kind, so a cup or a
// one-make is a race, a time trial a trial, a boss a boss, a mode its mode). Every format weighs two things:
//   race      league points for the finishing place (RACE_PTS)
//   destruct  destruction points for what the car did to the others and the scenery (DESTRUCT, per format `pts`)
// The result order is by race x weight.race + destruct x weight.destruct, so a format with no destruct weight is just
// the finishing order (data/scoring.js). Formats tagged `soon` need a mode that isn't built yet (Derby: G3).
export const RACE_PTS = [10, 8, 6, 5, 4, 3, 2, 1];
/** Destruction points: a rival wrecked or a panel torn off within 3 s of your hit, a breakable you smashed, a road car you took out. */
export const DESTRUCT = { wreck: 4, panel: 1, smash: 0.5, takedown: 2 };
export const FORMATS = {
  race: { name: 'Race', blurb: 'First past the flag wins', weight: { race: 1, destruct: 0 } },
  banger: { name: 'Banger race', blurb: 'Contact pays: points for your place and for every rival you wreck or strip of a panel', weight: { race: 1, destruct: 0.8 } },
  demolition: { name: 'Demolition rally', blurb: 'The scenery counts: fences, gates and walls smashed are points, as well as your place', weight: { race: 1, destruct: 0.8 }, pts: { smash: 1.2 } },
  figure8: { name: 'Figure of eight', blurb: 'Round the crossover: your place, plus points for the cars you take out at the cross', weight: { race: 1, destruct: 0.5 } },
  derby: { name: 'Derby', blurb: 'Last car running wins: wreck the rest', weight: { race: 0, destruct: 1 }, soon: true },
  trial: { name: 'Time trial', blurb: 'Alone against the clock', weight: { race: 1, destruct: 0 } },
  boss: { name: 'Boss duel', blurb: 'One on one with a star driver', weight: { race: 1, destruct: 0 } },
  showdown: { name: 'Showdown', blurb: 'Hold the lead to bank crown time', weight: { race: 1, destruct: 0 } },
  deuce: { name: 'Deuce', blurb: 'Checkpoints, first to 4, win by two', weight: { race: 1, destruct: 0 } },
  tiebreak: { name: 'Tiebreak', blurb: 'Checkpoints, first to 7, win by two', weight: { race: 1, destruct: 0 } },
};
/** An event's format id. */
export const formatOf = ev => ev.format || { trial: 'trial', boss: 'boss', final: 'boss', mode: ev.mode }[ev.kind] || 'race';
/** Destruction points for a car's tally d ({ wrecked, panels, smashed, takedowns }) in format f. */
export function destructPts(d, f) {
  const P = { ...DESTRUCT, ...(FORMATS[f] && FORMATS[f].pts) };
  return d.wrecked * P.wreck + d.panels * P.panel + d.smashed * P.smash + d.takedowns * P.takedown;
}
