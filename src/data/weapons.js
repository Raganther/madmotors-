// Weapon modules (F6): levels, gear and signature weapons. Pure data: core/features/weapons.js plays them, the career
// sells them (data/career.js), the Workshop's Weapons range tries every one at every level.
// A car's weapons come on its race def as `wpn: { lv: { missile: 2, ... }, gear: 'shield' }` (missing = level 1, no
// gear); a vehicle with a signature weapon (SIGNATURES) finds it in crates too. Level 1 is the weapon as it always was.
export const WEAPON_MAX = 3;
/** Every weapon: what it is and what each level adds. `fx` is per level (1..3): numbers that replace core WPN's. */
export const WEAPONS = {
  missile: { name: 'Missile', blurb: 'Locks on to the car ahead and knocks it flying', looks: ['Homing missile', 'Quicker lock', 'Twin missiles'], fx: [{}, { TURN: 5.4 }, { TURN: 5.4, TWIN: 1 }] },
  gun: { name: 'Machine gun', blurb: 'A burst of rounds straight ahead; each hit costs speed', looks: ['3 s burst', '4 s burst', '5 s burst'], fx: [{}, { GUN_T: 4 }, { GUN_T: 5 }] },
  oil: { name: 'Oil', blurb: 'Two slicks behind you: the tail steps out', looks: ['Oil slicks', 'Wider slicks', 'Glue: slicks that grab too'], fx: [{}, { OIL_R: 3.4 }, { OIL_R: 3.4, GLUE: 0.75 }] },
  pulse: { name: 'Pulse', blurb: 'A shockwave that blows everyone near away', looks: ['13 m wave', '16 m wave', '19 m wave'], fx: [{}, { PULSE_R: 16 }, { PULSE_R: 19 }] },
  harpoon: { name: 'Harpoon', blurb: 'Hooks the car ahead and reels you in', looks: ['2.2 s tow', '3 s tow', '3.8 s tow'], fx: [{}, { TOW_T: 3 }, { TOW_T: 3.8 }] },
  // signature weapons: only their own vehicle finds them (SIGNATURES)
  water: { name: 'Water cannon', sig: true, blurb: 'A jet ahead that shoves cars aside and soaks their grip', looks: ['2.5 s jet', '3.2 s jet', '4 s jet'], fx: [{}, { WATER_T: 3.2 }, { WATER_T: 4 }] },
  cement: { name: 'Cement trail', sig: true, blurb: 'Wet cement behind you: anyone in it bogs down', looks: ['1.6 s trail', '2.2 s trail', '2.8 s trail'], fx: [{}, { CEMENT_T: 2.2 }, { CEMENT_T: 2.8 }] },
  stinger: { name: 'Stinger', sig: true, blurb: 'A spike strip across the road behind you', looks: ['Catches 2 cars', 'Catches 3', 'Catches 4'], fx: [{}, { STINGER_HITS: 3 }, { STINGER_HITS: 4 }] },
  crush: { name: 'Crush', sig: true, blurb: 'Leap and land on whoever is near', looks: ['7 m slam', '9 m slam', '11 m slam'], fx: [{}, { CRUSH_R: 9 }, { CRUSH_R: 11 }] },
  jingle: { name: 'Jingle', sig: true, blurb: 'The chimes: everyone near stutters and slows for the van', looks: ['22 m tune', '25 m tune', '28 m tune'], fx: [{}, { JINGLE_R: 25 }, { JINGLE_R: 28 }] },
};
export const WEAPON_IDS = Object.keys(WEAPONS);
/** Vehicle id -> its signature weapon. */
export const SIGNATURES = { firetruck: 'water', mixer: 'cement', police: 'stinger', monster: 'crush', icecream: 'jingle' };
/** Gear: one fitted per car, it works by itself (no button). */
export const GEAR = {
  flares: { name: 'Flares', blurb: 'A missile locked on to you goes for the flares instead (recharges in 20 s)' },
  shield: { name: 'Shield', blurb: 'Soaks up the next weapon hit (recharges in 18 s)' },
  magnet: { name: 'Magnet', blurb: 'Pulls in weapon crates from further across the road' },
};
export const GEAR_IDS = Object.keys(GEAR);
export const WEAPON_PRICE = [0, 2500, 6000], GEAR_PRICE = 3000;   // level 2, level 3; a piece of gear
/** The level of weapon `it` in loadout w (a def's `wpn`). */
export const levelOf = (w, it) => Math.max(1, Math.min(WEAPON_MAX, (w && w.lv && w.lv[it]) || 1));
/** Loadout from an owned-car record ({ wl, gear }), or null when it's all level 1 and no gear. */
export function loadoutOf(own) {
  if (!own) return null;
  const lv = {}; for (const id of WEAPON_IDS) if (own.wl && own.wl[id] > 1) lv[id] = Math.min(WEAPON_MAX, own.wl[id]);
  const out = {}; if (Object.keys(lv).length) out.lv = lv; if (own.gear && GEAR[own.gear]) out.gear = own.gear;
  return Object.keys(out).length ? out : null;
}
