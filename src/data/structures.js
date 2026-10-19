// Destructible buildings (core/elements/structures.js places them, core/kit/building.js lays each one out,
// core/features/structures.js breaks them, render/elements/structures.js draws them). A building is brick walls round
// rooms with furniture in them, under a roof in bays:
//   - Walls are grids of cells (CW x CH m, a few bricks each). A car hitting a wall spends its impact (mass x speed
//     into it, core/sim/impact.js) knocking cells out, the middle of its nose first, low first: a heavy, fast car
//     clears a hole the shape of its front (as tall as the car: ROWS) and carries on with what it had over; a light
//     one knocks out a few bricks and stops; what's left of its impact cracks the cells it hit (CRACK), so the next hit
//     gets further. A cell holds HOLE hp per CW / HOLE_W of width and BAND rows of height, so a car-sized hole costs the
//     material's hp. Below BREAK x that (less as the wall cracks) a hit only cracks it; minMass: lighter cars only crack it.
//   - Brickwork over a hole that has lost the cells under it and to both sides below falls in after it, so holes come
//     out as stepped arches, and the cells at a hole's edge go with it now and then (RAG): ragged, not square.
//   - Bays: the roof and the upper floors are in slices across the building (BAY m wide); a bay falls in when fewer
//     than BAY_FALL of the wall cells holding it up (the front and back walls under it and BAY_REACH m either side,
//     the end wall for an end bay, the bottom BAY_ROWS rows) are left, when the front or the back under it is down to
//     BAY_SIDE (nothing hangs off one wall), or when its neighbours are down and it has less than BAY_ALONE (nothing
//     juts out on its own); an end bay takes its end wall's upper storeys. All the bays down and the building is gone.
//   - Rubble: knocked-out brickwork throws lumps the car's way (one per LUMP_CELLS cells), a hole leaves a strip and a
//     fallen bay a heap (HEAP_TOP m high a storey, a real pile the cars ride over: features/dents.js heapOf); they all
//     drag at the wheels a little (STRIP_DRAG, HEAP_DRAG). A building that comes down
//     leaves up to LUMP.COLLAPSE smaller lumps strewn over its footprint; lumps stay for the race, shoved about by the cars.
//   - Furniture (FURNITURE) is loose: a car shoves it about and loses a little speed for it (FURN_SLOW), out of
//     the holes too.
// Upper floors make the walls stronger (FLOOR_HP per floor over one). Inner walls are lighter (INNER_HP).
export const STRUCT = {
  CW: 0.5, CH: 0.5, THICK: 0.45, INNER: 0.16, FLOOR: 3, FLOOR_HP: 0.12, INNER_HP: 0.35, WINDOW_HP: 0.35, DOOR_HP: 0.5,
  HOLE_W: 2.2, BAND: 4, BREAK: 0.75, CRACK: 0.55, RAG: 0.45, KEEP: 0.55, KEEP_MIN: 0.3,
  BAY: 3.2, BAY_FALL: 0.4, BAY_SIDE: 0.15, BAY_ALONE: 0.8, BAY_REACH: 1.6, BAY_ROWS: 6,
  LUMP_CELLS: 8, STRIP: 1.2, HEAP_DRAG: 0.45, HEAP_TOP: 0.75, STRIP_DRAG: 0.5, FURN_SLOW: 0.35, FURN_FRIC: 4.5,
  LUMP: { R: 0.5, MASS: 1.0, FRIC: 2.6, LIFE: 900, MAX: 180, COLLAPSE: 26 }   // thrown lumps: radius, mass, friction, life (s: the race), most at once, most a collapse leaves
};
/** How tall a hole car c knocks (rows of cells): taller and heavier vehicles more. */
export const rowsHit = mass => Math.max(2, Math.min(6, Math.ceil((1.1 + 0.5 * (mass - 1)) / STRUCT.CH)));
export const MATERIALS = {
  timber: { name: 'Timber', hp: 6, minMass: 0, color: 0x9A7148, rubble: 0x7E6040, sound: 'wood' },
  brick: { name: 'Brick', hp: 12, minMass: 0, color: 0xB0664A, rubble: 0x8E5A44, sound: 'metal' },
  stone: { name: 'Stone', hp: 18, minMass: 0.8, color: 0xA8A090, rubble: 0x8C857A, sound: 'metal' },
  concrete: { name: 'Concrete', hp: 28, minMass: 1.4, color: 0xB9B6AE, rubble: 0x9A978F, sound: 'metal' },
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
/** What a car-sized hole in a wall of `mat` costs (a building of `floors`): its material's hp, more for a taller building. */
export const holeHp = (mat, floors) => MATERIALS[mat].hp * (1 + STRUCT.FLOOR_HP * (floors - 1));
/** One cell's strength. */
export const cellHp = (mat, floors) => holeHp(mat, floors) * STRUCT.CW / STRUCT.HOLE_W / STRUCT.BAND;
// Furniture: half-length along the room (hl), half-depth (hw), height, mass (the coupe is 1), colours; `wall`: stands
// against the front or back of the room, `mid`: in the middle. ROOMS: what each kind of room has in it.
export const FURNITURE = {
  KINDS: {
    sofa: { hl: 0.95, hw: 0.45, h: 0.85, m: 0.5, c: [0x7A4A3A, 0x3E5A7A, 0x5E6E44, 0x8A7A5A], wall: true },
    armchair: { hl: 0.45, hw: 0.45, h: 0.85, m: 0.25, c: [0x7A4A3A, 0x8A5A6A, 0x4A6A5A] },
    table: { hl: 0.75, hw: 0.45, h: 0.75, m: 0.3, c: [0x8A5E3B, 0x6E4A2E], mid: true },
    chair: { hl: 0.22, hw: 0.22, h: 0.9, m: 0.08, c: [0x8A5E3B, 0x6E4A2E] },
    cabinet: { hl: 0.6, hw: 0.25, h: 0.6, m: 0.2, c: [0x5E4A3A, 0x2B2F3A], wall: true },
    bed: { hl: 1.0, hw: 0.75, h: 0.55, m: 0.55, c: [0xE8E2D4, 0xBFD0E0, 0xE0C0C0], wall: true },
    wardrobe: { hl: 0.6, hw: 0.3, h: 2.0, m: 0.5, c: [0x8A5E3B, 0xD8D0C0], wall: true },
    units: { hl: 1.2, hw: 0.3, h: 0.9, m: 0.6, c: [0xE8E4DA, 0x4A6A8A, 0x6A8A5A], wall: true },
    fridge: { hl: 0.32, hw: 0.32, h: 1.8, m: 0.5, c: [0xF2F2F0, 0xC8CCD0], wall: true },
    shelf: { hl: 1.0, hw: 0.25, h: 1.8, m: 0.4, c: [0x8A5E3B, 0x9AA0A8], wall: true },
    counter: { hl: 1.2, hw: 0.35, h: 1.0, m: 0.6, c: [0x8A5E3B, 0x5E6670], mid: true },
    bale: { hl: 0.6, hw: 0.45, h: 0.9, m: 0.4, c: [0xE2C265, 0xD7B657] },
    crate: { hl: 0.4, hw: 0.4, h: 0.8, m: 0.25, c: [0xB0834F, 0x9A7148] },
    pallet: { hl: 0.6, hw: 0.5, h: 1.1, m: 0.6, c: [0xB0834F, 0x6E8A4A, 0x4A6A8A] },
    barrel: { hl: 0.3, hw: 0.3, h: 0.9, m: 0.3, c: [0x3E5A7A, 0x8A3B2E, 0x5E6670] },
    bench: { hl: 0.9, hw: 0.35, h: 0.9, m: 0.45, c: [0x8A5E3B], wall: true },
    pew: { hl: 1.3, hw: 0.25, h: 0.9, m: 0.4, c: [0x6E4A2E] },
  },
  ROOMS: {
    living: ['sofa', 'armchair', 'table', 'chair', 'chair', 'cabinet'],
    kitchen: ['units', 'fridge', 'table', 'chair', 'chair'],
    bedroom: ['bed', 'wardrobe', 'cabinet'],
    shop: ['counter', 'shelf', 'shelf', 'shelf', 'crate'],
    shed: ['bench', 'barrel', 'crate'],
    stall: ['crate', 'crate'],
    barn: ['bale', 'bale', 'bale', 'bale', 'crate', 'barrel'],
    warehouse: ['pallet', 'pallet', 'pallet', 'pallet', 'shelf', 'shelf', 'crate', 'barrel'],
    chapel: ['pew', 'pew', 'pew', 'pew', 'pew', 'pew', 'table'],
  }
};
