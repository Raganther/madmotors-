import { BREAKABLES } from '../../data/breakables.js';

// ---------- impact: what a car hits things with ----------
// A car's mass is 1 / im (the coupe is 1; the mixer 2.5), times its ram (an upgrade). Its impact on something is mass
// times its speed into it. Breakable things (data/breakables.js) give way when the impact reaches their hp, and only
// to cars of at least their minMass: heavy vehicles smash what light ones bounce off. Toughness (veh.tough) is the other
// side: it divides the damage a car takes (core/sim/damage.js).
export const massOf = c => (1 / (c.im || 1)) * ((c.veh && c.veh.ram) || 1);
export const impactOf = (c, vn) => massOf(c) * vn;
export const toughOf = c => (c.veh && c.veh.tough) || 1;
/** Would car c, hitting `kind` at vn m/s, break it? */
export function breaks(c, kind, vn) { const K = BREAKABLES[kind]; return massOf(c) >= K.minMass && impactOf(c, vn) >= K.hp; }
/** The slowest it breaks `kind` at (m/s), or Infinity if it never can. */
export function breakSpeed(c, kind) { const K = BREAKABLES[kind]; return massOf(c) >= K.minMass ? K.hp / massOf(c) : Infinity; }
