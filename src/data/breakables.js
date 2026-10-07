// Breakable things (core/features/breakables.js decides, render/elements/breakables.js draws). What breaks one is the
// car's impact: its mass (1 / im, times a ram upgrade) times its speed into it (core/sim/impact.js). A kind breaks when
// the impact reaches `hp`; `minMass` keeps the light cars out (a coupe can hit a concrete block as fast as it likes:
// it bounces). Sizes are metres: `w` across the road, `d` deep, `h` tall. `chunks`: pieces that stay on the road as
// debris (they block and get shoved about), the rest flies off as scenery.
export const BREAKABLES = {
  crates: { name: 'Crates', hp: 6, minMass: 0, w: 3.2, d: 1.2, h: 1.2, chunks: 0, color: 0xB0834F },
  hay: { name: 'Hay bales', hp: 10, minMass: 0, w: 4.4, d: 1.3, h: 1.3, chunks: 0, color: 0xE2C265 },
  fence: { name: 'Wooden fence', hp: 16, minMass: 0, w: 6, d: 0.25, h: 1.2, chunks: 0, color: 0x9A7148 },
  gate: { name: 'Farm gate', hp: 24, minMass: 0.9, w: 6, d: 0.3, h: 1.4, chunks: 0, color: 0x8E9399 },
  concrete: { name: 'Concrete blocks', hp: 40, minMass: 1.6, w: 6, d: 0.8, h: 1.0, chunks: 3, color: 0xC9C6BE },
};
// The world kit's pieces (core/kit/layout.js lays them out per town, render/elements/kit.js draws them, `kit: true`):
// sizes come with each piece, these give how strong. Houses and barns never break (hp Infinity): you bounce off.
Object.assign(BREAKABLES, {
  house: { name: 'House', hp: Infinity, minMass: Infinity, kit: true },
  barn: { name: 'Barn', hp: Infinity, minMass: Infinity, kit: true },
  picket: { name: 'Picket fence', hp: 7, minMass: 0, kit: true },
  wall: { name: 'Stone wall', hp: 26, minMass: 1.3, kit: true },
  hedge: { name: 'Hedge', hp: 12, minMass: 0, kit: true },
  railing: { name: 'Railing', hp: 14, minMass: 0, kit: true },
  chain: { name: 'Chain-link fence', hp: 10, minMass: 0, kit: true },
  yardgate: { name: 'Garden gate', hp: 8, minMass: 0, kit: true },
  post: { name: 'Lamp post', hp: 16, minMass: 0, kit: true },
  bin: { name: 'Bin', hp: 2, minMass: 0, kit: true },
  bench: { name: 'Bench', hp: 4, minMass: 0, kit: true },
  postbox: { name: 'Postbox', hp: 22, minMass: 1, kit: true },
});
// A derby arena's wall ring (core/elements/arena.js): unbreakable, drawn as one ring by render/elements/arena.js.
Object.assign(BREAKABLES, {
  tyres: { name: 'Tyre wall', hp: Infinity, minMass: Infinity, w: 5, d: 1.4, h: 1.2, chunks: 0, color: 0x222428, arena: true },
  barrier: { name: 'Concrete wall', hp: Infinity, minMass: Infinity, w: 5, d: 0.9, h: 1.5, chunks: 0, color: 0xC9C6BE, arena: true },
  bales: { name: 'Bale wall', hp: Infinity, minMass: Infinity, w: 5, d: 1.5, h: 1.6, chunks: 0, color: 0xD9B85C, arena: true },
});
/** The stand-alone kinds (a breach, stage props, the Destruction yard); the kit's pieces and arena walls are placed by their own. */
export const BREAKABLE_KINDS = Object.keys(BREAKABLES).filter(k => !BREAKABLES[k].kit && !BREAKABLES[k].arena);
