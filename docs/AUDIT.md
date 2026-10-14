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
