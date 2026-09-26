// The garage: every vehicle the player can pick (the menu's Vehicle button). model = its body (render/carmodels.js),
// colours its livery, and its handling next to the standard car (1 = standard):
//   accel  engine pull          top   top speed (air drag)      grip  cornering grip
//   off    off-road (gravel, grass, mud: pull, grip and rolling drag there)          im  1 / weight (bumps)
// hw / hl: half width / half length of its hitbox (default the standard car's). Rivals keep their own cars; if you pick
// one of theirs, that rival takes your usual coupe. The coupe is the standard car: no handling changes at all.
export const VEHICLES = [
  { id: 'coupe', name: 'Muscle Coupe', model: 'coupe', color: 0xFFC72C, accent: 0x1C2340, blurb: 'The all-rounder. Big engine, fat tyres, no surprises.' },
  { id: 'hatch', name: 'Rally Hatch', model: 'hatch', color: 0xE0402F, accent: 0xFFFFFF, veh: { accel: 1.06, top: 0.96, grip: 1.02, off: 1.12, im: 1.05 }, blurb: 'A 70s stage hero: quick off the line and happy on dirt.' },
  { id: 'wedge', name: 'Group B Wedge', model: 'wedge', color: 0x2F7DE0, accent: 0xFFC72C, veh: { accel: 1.03, top: 1.03, grip: 1.03, off: 0.92, im: 1 }, blurb: 'Low, fast, planted on tarmac. Hates the rough stuff.' },
  { id: 'buggy', name: 'Trophy Buggy', model: 'buggy', color: 0x2FB36B, accent: 0xFFFFFF, veh: { accel: 1.0, top: 0.97, grip: 0.97, off: 1.25, im: 1.1 }, blurb: 'Long-travel suspension and knobblies: flies over the rough.' },
  { id: 'monster', name: 'Monster Truck', model: 'monster', color: 0x7A3FD1, accent: 0x9BE22E, hw: 1.2, hl: 1.9, veh: { accel: 0.98, top: 0.96, grip: 0.95, off: 1.3, im: 0.55 }, blurb: 'Wheels taller than you. Rolls over anything, including rivals.' },
  { id: 'formula', name: 'Formula Racer', model: 'formula', color: 0xD8203A, accent: 0xF4F4F0, veh: { accel: 1.03, top: 1.02, grip: 1.06, off: 0.8, im: 1.35 }, blurb: 'An open-wheel missile. Glued to tarmac, lost on gravel.' },
  { id: 'rocket', name: 'Rocket Car', model: 'rocket', color: 0x2A2D38, accent: 0xFF6A1A, veh: { accel: 0.95, top: 1.07, grip: 0.9, off: 0.86, im: 0.95 }, blurb: 'A jet on wheels. The fastest thing here, if you can stop it.' },
  { id: 'hotrod', name: 'Hot Rod', model: 'hotrod', color: 0x111111, accent: 0xFF5A1E, veh: { accel: 1.05, top: 0.98, grip: 0.88, off: 0.9, im: 1 }, blurb: 'Blower on the bonnet, flames on the sides, tail out everywhere.' },
  { id: 'police', name: 'Interceptor', model: 'police', color: 0x1B2A4A, accent: 0xF4F4F0, veh: { accel: 1.01, top: 1.01, grip: 0.98, off: 0.95, im: 0.9 }, blurb: 'Pursuit-tuned and heavy. Lights on, everyone move over.' },
  { id: 'kart', name: 'Go-Kart', model: 'kart', color: 0x19B5D8, accent: 0xFFE04A, hw: 0.85, hl: 1.3, veh: { accel: 1.14, top: 0.95, grip: 1.12, off: 0.92, im: 1.7 }, blurb: 'Tiny, twitchy and grippy. Corners like a dream, bounces off everyone.' },
  { id: 'tuktuk', name: 'Tuk-Tuk', model: 'tuktuk', color: 0x2FA84F, accent: 0xFFD21F, hw: 0.9, veh: { accel: 1.1, top: 0.95, grip: 0.96, off: 1.02, im: 1.6 }, blurb: 'Three wheels, a canopy and a lot of heart. Mind the corners.' },
  { id: 'icecream', name: 'Ice Cream Van', model: 'icecream', color: 0xF6B8D0, accent: 0x6ED3E8, hl: 2.1, veh: { accel: 1.0, top: 0.97, grip: 0.97, off: 1.0, im: 0.6 }, blurb: 'Slow, top-heavy and absolutely unstoppable in a crash.' },
  { id: 'firetruck', name: 'Fire Engine', model: 'firetruck', color: 0xD7261E, accent: 0xE8E8E8, hw: 1.1, hl: 2.3, veh: { accel: 1.0, top: 0.97, grip: 0.97, off: 1.0, im: 0.42 }, blurb: 'The heaviest thing on the hill. Ladder, sirens, no brakes.' },
  { id: 'rover', name: 'Moon Rover', model: 'rover', color: 0xE7E3D6, accent: 0xE8A23A, veh: { accel: 0.98, top: 0.96, grip: 1.04, off: 1.3, im: 0.85 }, blurb: 'Six wheels, a dish and a gold-foil body. Mud? What mud.' },
  { id: 'hover', name: 'Hovercraft', model: 'hover', color: 0x19A7A0, accent: 0xFF6A3D, hw: 1.15, hl: 1.95, veh: { accel: 1.02, top: 1.0, grip: 0.84, off: 1.32, im: 1.2 }, blurb: 'Rides on air: mud, snow and water are all the same to it. Corners? Eventually.' },
  { id: 'snowcat', name: 'Snowcat', model: 'snowcat', color: 0xF07C1E, accent: 0x2B2F3A, hw: 1.25, hl: 1.95, veh: { accel: 0.97, top: 0.95, grip: 1.03, off: 1.34, im: 0.6 }, blurb: 'Tracks, a blade and a beacon. Crawls up anything, never in a hurry on tarmac.' },
  { id: 'limo', name: 'Stretch Limo', model: 'limo', color: 0x16161A, accent: 0xD9B44A, hl: 2.7, veh: { accel: 0.97, top: 1.08, grip: 0.9, off: 0.86, im: 0.55 }, blurb: 'Six metres of gold trim. Flies down a straight, turns like a cruise ship.' },
  { id: 'sidecar', name: 'Sidecar Bike', model: 'sidecar', color: 0xC8102E, accent: 0xF4F4F0, hw: 1.15, veh: { accel: 1.13, top: 0.98, grip: 0.97, off: 0.95, im: 1.5 }, blurb: 'A big-bore bike and a brave passenger. Rockets off the line, bounces off everything.' },
  { id: 'mixer', name: 'Cement Mixer', model: 'mixer', color: 0xF2C12E, accent: 0xE8E8E8, hw: 1.05, hl: 2.5, veh: { accel: 0.96, top: 0.97, grip: 0.96, off: 1.02, im: 0.4 }, blurb: 'The drum never stops turning. Neither does it, once it gets going.' }
];
export const vehicleById = id => VEHICLES.find(v => v.id === id) || VEHICLES[0];
