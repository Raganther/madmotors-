---
name: new-stage
description: Design and build a new Downhill Rush stage/track (a new circuit or downhill run with its theme, terrain and set pieces), reusing existing track elements first. Use when the user asks for a new track, stage, course, rally or level, e.g. "/new-stage desert rally with river crossings".
argument-hint: <theme and what should happen on it>
---

# New stage

A stage is **data**: one file in `src/data/stages/` that picks a road shape, a look and a list of track elements.
New behaviour belongs in elements (`/new-element`), never special cases for this stage.

## 1. Design (in chat, briefly, before code)
- One sentence: what makes it different from the stages we have (`npm run layout` lists them; README table).
- The run as beats: start, 4-8 set pieces, finish. For each beat name the **existing element** that does it
  (README "Track elements" table: jump, kick, yump, whoops, mud / `mud: 'water'`, bridge, viaduct, tunnel, town,
  gallery, rockfall, arch, gap, boost, ferry, falls, drawbridge, mill/logs, rails, branches).
- Anything no element covers → a new element (`/new-element`), built and sandboxed first. Say so.
- Choose the base: `type: 'gorge'` (a hand-laid circuit of `segs`; most flexible; copy `bogwood-rally.js` or
  `thunder-falls.js`) or a generated downhill `plan` (copy `summit-meadow.js`). Fields are in `src/core/types.js`.
- If the user gave the whole brief and said to decide, decide; otherwise confirm the beats first.

## 2. Build
1. New file in `src/data/stages/`, header comment describing the run like the others; add it to the end of
   `src/data/stages/index.js` (existing stage numbers must not move).
2. `segs` (gorge): `['s', length, endHeight, tags]` and `['a', radius, degrees (+ = left), endHeight, tags]`; ground
   tags (`far`/`near`, `rampF`/`rampN`) shape the terrain each side. Close the loop with `{ toB: n }` / `{ toA: 0 }`
   the way the existing gorge stages do. Share tag objects (`const wood = {...}`) like `bogwood-rally.js`.
3. Look: `surface`, `light` (sun, sky, haze, grade), `colors`, `trees`, `rocks`, `bushes`, `village`. Borrow a
   palette from the nearest stage and shift it; make it recognisably its own at a glance.
4. Features switch on from the stage (traffic, trains, parked, rockfall, hazards...): only where they fit the theme.

## 3. Iterate until it's clean (the stage is not done before all of these)
- `npm run layout -- <n>` → `tools/out/layout-<n>.svg`: the plan closes, nothing crosses by accident, and the
  report of close passes lists only the ones you meant (bridges over, tunnels under). `buildTrack` errors say how far
  off a closure or branch is: fix the segs, not the error.
- `npm run terrain -- <n>` → `tools/out/terrain-<n>.png`: banks and cliffs where intended, no road buried or floating.
- `npm run sandbox -- <n>`: four AI cars lap it. Lap times sane and similar across cars (existing circuits: 37 s
  Bogwood x3 laps up to 120 s Ravenrock x2; aim for a race of 2-4 minutes), no wrecks or respawns except where the design wants them (a gap), air where the jumps are.
- `npm run shot -- <n>` (and `npm run shot -- <n> <metres> ...` at each set piece): look at every beat from the
  player's seat. Is it readable at speed? Does it look like the theme? Read the PNGs, don't just generate them.
- Play-feel sanity: it should be finishable by the AI on every vehicle class that matters (`--vehicle monster`,
  `kart`), and the first 20 s should already show off what the stage is about.

## 4. Lock and ship
- `npm run golden` (a new stage adds golden entries: say so in the commit), then `/ship` (check + e2e + publish).
- Tell the user: the stage number and name, the beats, which elements it reuses and anything new, and send 2-4
  screenshots of the set pieces.
