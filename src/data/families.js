// Car families (G6): cars built from a shared chassis instead of by hand. A family is a set of chassis numbers; a car
// in it overrides a few and adds extras. Both providers read the same numbers: the Classic builder
// (render/families.js) and the Blender generator (blender/chassis.py, which gets them as JSON from tools/assets.sh), so
// a new car in a family is a data entry plus its garage line in data/vehicles.js.
// Game axes, metres: x right, y up, z forward (front +z). The hitbox is the standard car's (half 1.0 x 1.78, + 0.35
// for bodywork).
//   L      half length of the body              W     body width              base / deck   underside and top of the body
//   nose / tail   how far the bonnet / boot drop at the ends
//   cab    the glasshouse: zf, zr (front and back of it at the base), roof (roof height), rake (how far the screen leans
//          back, m), taper (roof width / base width); open: no roof (a roadster), bed: an open load bed from zr back
//   wheels [x, front z, rear z, radius, width]   knobbly: off-road tyres
//   bumper 'chrome' | 'black' | 'bar' (a push bar)   wing: 0 none, 1 a lip, 2 a big wing on stands
//   extras  named add-ons both builders know: sign (a taxi's roof sign), box (a roof box), rack (a roof rack), lamps
//           (a light pod), tyres (spare tyres in the bed), cage (a roll cage), plates (bolted-on armour plates), flaps
//           (mud flaps), pipes (side exhausts), helmet (the driver's head, for open cars)
export const FAMILIES = {
  saloon: { L: 1.92, W: 1.86, base: 0.36, deck: 0.98, nose: 0.1, tail: 0.06, cab: { zf: 0.55, zr: -0.95, roof: 1.5, rake: 0.38, taper: 0.86 }, wheels: [0.92, 1.18, -1.2, 0.38, 0.3], bumper: 'chrome', wing: 0, extras: [] },
  sports: { L: 1.95, W: 1.96, base: 0.28, deck: 0.78, nose: 0.14, tail: 0.02, cab: { zf: 0.25, zr: -0.85, roof: 1.18, rake: 0.5, taper: 0.8 }, wheels: [0.96, 1.25, -1.2, 0.38, 0.38], bumper: 'black', wing: 1, extras: [] },
};
/** The cars built from a family: id (= the model), family, and the chassis numbers it changes. */
export const FAMILY_CARS = {
  taxi: { family: 'saloon', extras: ['sign'] },
  estate: { family: 'saloon', cab: { zr: -1.62, roof: 1.52 }, wheels: [0.94, 1.2, -1.22, 0.4, 0.32], bumper: 'black', extras: ['box', 'lamps', 'flaps'] },
  pickup: { family: 'saloon', base: 0.62, deck: 1.22, cab: { zf: 0.4, zr: -0.45, roof: 1.78 }, bed: true, wheels: [1.0, 1.25, -1.2, 0.52, 0.4], knobbly: true, bumper: 'bar', extras: ['tyres', 'lamps'] },
  stockcar: { family: 'saloon', bumper: 'bar', extras: ['cage', 'plates'] },
  gt: { family: 'sports', W: 2.0, wing: 2, extras: ['pipes'] },
  roadster: { family: 'sports', L: 1.82, cab: { zf: 0.15, zr: -0.5, roof: 1.0 }, open: true, wheels: [0.94, 1.18, -1.1, 0.36, 0.32], bumper: 'chrome', wing: 0, extras: ['helmet'] },
};
/** The full chassis for family car id: the family's numbers with the car's on top. */
export function chassisOf(id) {
  const c = FAMILY_CARS[id]; if (!c) return null;
  const F = FAMILIES[c.family];
  return { ...F, ...c, cab: { ...F.cab, ...(c.cab || {}) }, extras: c.extras || F.extras };
}
export const FAMILY_IDS = Object.keys(FAMILY_CARS);
