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
export const BREAKABLE_KINDS = Object.keys(BREAKABLES);
