// Destructible buildings (core/elements/structures.js places them, core/features/structures.js breaks them,
// render/elements/structures.js draws them). A building is a ring of wall panels, each about STRUCT.PANEL m long, round
// an empty floor. A car's impact (mass x speed into the wall, core/sim/impact.js) against a panel:
//   - reaches what the panel has left (its material's hp, less the cracks it already has): the panel goes, and the car
//     ploughs on with the impact it had left over, so a heavy, fast car bursts through the front wall, crosses the room
//     and can go out through the back; a light one ends up inside, or bounces;
//   - doesn't, but is at least CHIP x hp: the panel cracks (keeps `CRACK` of the impact as damage), so a small car can
//     still batter its way through in a few runs, and every hit costs it;
//   - minMass: a material lighter cars can't break at all (they only crack it).
// Once COLLAPSE of a building's panels are down the whole thing comes down: every wall goes, the roof drops, and its
// footprint is a rubble heap that slows anything crossing it. Every broken panel throws rubble lumps (dynamic, shoved
// about, they slow whoever hits them) the way the car was going, and leaves a strip of rubble where it stood.
// A car wide enough to hit two panels of a wall at once pays for the first; the next ones in the same wall within
// 0.3 s cost it SAME of theirs (it's one hole). Upper floors make the walls stronger (FLOOR_HP per floor over one) and a collapse throws more rubble.
export const STRUCT = {
  PANEL: 2.6, THICK: 0.45, FLOOR: 3, FLOOR_HP: 0.12, SAME: 0.3, CHIP: 0.3, CRACK: 0.55, COLLAPSE: 0.42,
  KEEP: 0.55, KEEP_MIN: 0.3,                          // ploughing through: speed kept = max(KEEP_MIN, 1 - KEEP x what it took / impact)
  STRIP: 1.6, HEAP_DRAG: 1.1, STRIP_DRAG: 0.7,        // rubble on the ground: half-depth of a panel's strip (m); drag (1/s) on a heap and a strip
  LUMP: { R: 0.5, MASS: 1.0, FRIC: 2.6, LIFE: 120, MAX: 90 }   // thrown lumps: radius, mass, friction, life (s), most at once
};
export const MATERIALS = {
  timber: { name: 'Timber', hp: 11, minMass: 0, color: 0x9A7148, rubble: 0x7E6040, sound: 'wood' },
  brick: { name: 'Brick', hp: 22, minMass: 0, color: 0xB0664A, rubble: 0x8E5A44, sound: 'metal' },
  stone: { name: 'Stone', hp: 30, minMass: 0.9, color: 0xA8A090, rubble: 0x8C857A, sound: 'metal' },
  concrete: { name: 'Concrete', hp: 40, minMass: 1.4, color: 0xB9B6AE, rubble: 0x9A978F, sound: 'metal' },
};
// Building types: footprint w (along its front) x d, floors, material, the look (wall colours, roof). `open`: a front
// with no wall (a market stall, a car port): you can drive in.
export const BUILDINGS = {
  shed: { name: 'Shed', mat: 'timber', w: 6, d: 5, floors: 1, walls: [0x8A5E3B, 0x6E8A6A, 0x7A6A58], roof: 'flat', roofC: [0x4B4F55] },
  cottage: { name: 'Cottage', mat: 'brick', w: 9, d: 7, floors: 1, walls: [0xF3EBDD, 0xE9D3B4, 0xD9C7A3], roof: 'gable', roofC: [0x5B4A3E, 0x8C3B2E, 0x4B5563] },
  house: { name: 'House', mat: 'brick', w: 10, d: 8, floors: 2, walls: [0xF3EBDD, 0xBFA58A, 0xE7E0CF, 0xB0664A], roof: 'gable', roofC: [0x5B4A3E, 0x6E5A48, 0x8C3B2E] },
  terrace: { name: 'Terrace', mat: 'brick', w: 16, d: 8, floors: 2, walls: [0xB0664A, 0x9E5A44, 0xC27A5A], roof: 'gable', roofC: [0x4B5563, 0x5B4A3E] },
  shop: { name: 'Shop', mat: 'brick', w: 12, d: 9, floors: 2, walls: [0xF6F4EE, 0xBFE0EE, 0xF7E7B0], roof: 'flat', roofC: [0x6B7280], shop: true },
  barn: { name: 'Barn', mat: 'timber', w: 12, d: 14, floors: 2, walls: [0x9C3B2E, 0x8A5E3B], roof: 'gable', roofC: [0x4B4F55, 0x5B4A3E] },
  chapel: { name: 'Chapel', mat: 'stone', w: 9, d: 14, floors: 2, walls: [0xA8A090, 0xB8B0A0], roof: 'steep', roofC: [0x3A3F47] },
  warehouse: { name: 'Warehouse', mat: 'concrete', w: 18, d: 14, floors: 2, walls: [0x9CA3AB, 0xB7B2A6, 0x7E8790], roof: 'flat', roofC: [0x5E6670] },
  flats: { name: 'Flats', mat: 'concrete', w: 14, d: 10, floors: 4, walls: [0xC2B59B, 0xB9B6AE, 0xD0C8B8], roof: 'flat', roofC: [0x5E6670] },
  stall: { name: 'Market stall', mat: 'timber', w: 5, d: 3, floors: 1, walls: [0xD7261E, 0x2E6FB0, 0xE0B020], roof: 'flat', roofC: [0xF4F1EA], open: true },
};
export const BUILDING_TYPES = Object.keys(BUILDINGS);
/** A panel's full strength: its material's hp, more for a taller building. */
export const panelHp = (mat, floors) => MATERIALS[mat].hp * (1 + STRUCT.FLOOR_HP * (floors - 1));
