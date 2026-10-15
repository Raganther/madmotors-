# Audit (October 2026)

A pass over the whole game before the destruction work (D1 in the roadmap): what was checked, what was found, and
what was done about it.

## How it was checked
- `npm run check` (lint, 454 tests, golden, build): green at the start.
- `npm run sandbox -- all`: every element's sandbox lapped by four AI cars: no wrecks or respawns beside an element.
- `npm run e2e`: every stage raced headless; screenshots of every stage looked at.
- `npm run balance`: every weapon's cost to its victim per use.
- Code read through for the systems the work touched: breakables, the world kit, weapons, derby, the AI, the HUD.

## Findings

| What | Where | Status |
|---|---|---|
| Breakables were all-or-nothing: an impact either broke a thing or bounced off, nothing added up | core/features/breakables.js | Buildings now crack and the cracks add up (core/features/structures.js); breakables keep their rule |
| Houses and barns never broke (hp Infinity): a town was a wall with windows | data/breakables.js, kit | Every town's houses and barns are destructible buildings (brick, timber, stone or concrete by style) |
| Destruction left nothing behind but concrete chunks; smashed scenery didn't change later laps | core/features/breakables.js | Broken walls throw rubble lumps that stay on the road, leave strips and heaps that drag; a collapsed building is a heap for the race |
| Weapons never touched the scenery; a missile that missed fizzled harmlessly | core/features/weapons.js | Missiles, mines, the shockwave and the crush blast scenery: fences, crates, concrete, walls; a missile flying into a wall goes off there |
| Five standard weapons, none of them a trap | core/features/weapons.js | Proximity mines (three levels, in the career's armoury), balanced to ~0.75 s per use at level 1 |
| No set pieces that change over a race except breaches and towns | elements | Crumbling bridge (wears out plank by plank, heavy cars fastest), chicane (blocks to weave or smash) |
| No mode about scenery | modes | Demolition (score what you knock down against the clock), Demolition Yard, in the career (Club, Pro) |
| The touch Fire button never said what you hold (a `//` comment had swallowed the statement setting it, so phones, where the weapon panel is hidden, only ever saw "Fire") | src/ui/hud.js | Fixed |
| The e2e smoke test timed out taking screenshots whenever anything else ran beside it (SwiftShader on 4 CPUs) | tests/e2e/smoke.mjs | Page timeouts raised to 120 s; the ship skill says to run it alone |
| The AI's lane wander and a few other AI choices use `Math.random` (the tests seed it); races in the game don't replay exactly | core/sim/ai.js | Noted, not changed: golden runs seed it, and nothing needs replays yet |
| A per-sample array over the main road read on a branch gives `undefined` (a NaN trap for anything new) | elements | Guarded where it bit (chicane); recorded in the new-element skill |

## Numbers after the work
- `npm run demolition`: in Demolition Yard the AI brings down 12-13 of 16 buildings in two minutes at either skill;
  the monster truck scores most, the buggy least.
- `npm run sandbox -- structures | crumble | chicane`: clean AI laps; a heavy field wears a third of the timber bridge
  away in three laps, a field of coupes a handful of planks.
- Wrecking Row: about 57 s a lap; a mixer in the field opens the cottage short cut on lap 1.
- `npm run balance`: the other weapons unchanged; mines 0.75 s per use.
- Golden: every stage that existed before is unchanged; two new stages added.

# Second pass (October 2026, after the lock-on / mortar branch was merged)

## How it was checked
- `npm run sandbox -- all`, `npm run balance`, `npm run derby`, `npm run demolition`, `npm run career`, `npm run destruct`.
- Every stage's e2e screenshot on contact sheets; shots of the stages and set pieces that looked off.
- A memory pass over every stage (geometry, textures and shader programs stay flat across stage changes).

## Findings
| What | Where | Status |
|---|---|---|
| The merge lost a closing tag: results, Sketch pad and Track editor sat inside the hidden Terrain builder | index.html | Fixed |
| The other branch still had the touch Fire button's label swallowed by a comment | src/ui/hud.js | Fixed again |
| A graphics reset (out of GPU memory, mostly tablets) crashed the next stage build ("reading 'trim'") and Safari never says the graphics are back | render/renderer.js, ui/flow.js | Nothing is built while they're lost; reload when back or after 3 s; that session runs on Medium |
| Up to five WebGL contexts alive at once (race, garage turntable, thumbnails, Asset Lab, Terrain builder) | render/showcar.js, thumbs.js, ui/terrain-builder.js | Each lets its context go when done |
| A drawn loop ending exactly on its start was refused ("try a smoother line") | core/track/editing.js | Fixed (test added) |
| Stinger cost its victims nothing (-0.28 s a use); gun 0.54 s, shockwave 0.72 s against the ~1 s target | core/features/weapons.js | Stinger 0.70, gun 0.79, shockwave 0.98; hit bonus 15 -> 25 keeps Rookie pacing |
| Mines also digging craters doubled the holes on the road (mortar's share 3.2 s a use) | core/features/weapons.js | Mines don't dig; mortar 1.25 s |
| A water splash over falling ground hung in the air as a blue slab (Highland Rally's burn) | render/elements/mud.js | The sheet drops under ground that falls away |
| Dynamic Low looked across mountains at the car and straight along viaducts | render/camera.js | Picks a clear side, tilts up over hills, turns side on over bridges |
| The Terrain builder couldn't make bridges, tunnels or set pieces | ui/terrain-builder.js, core/track/ground.js | Road up / down and Pieces |

## Numbers after
- Vehicles within about +-6% of the coupe on tarmac and loose; derbies end 38-87 s with a winner; Demolition Yard 10/16 down.
- Weapons per use: missile 1.20, mortar 1.23, oil 1.08, harpoon 1.01, shockwave 0.98, water 0.98, cement 0.89, gun 0.79,
  mines 0.76, crush 0.72, stinger 0.70, jingle 1.48 s.
- New: Alpine Viaduct (stage 43), 51-53 s AI laps, no wrecks or resets.
