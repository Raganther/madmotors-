---
name: new-feature
description: Add a new race system or hazard to Downhill Rush (something that moves or happens during a race: traffic, trains, rockfall, a moving bridge, weather, track wear). Use when the user wants a new hazard, dynamic event or race-wide system, or when a new track element needs per-race state.
argument-hint: <what happens during the race>
---

# New race feature

Read README "Adding a race feature" and look at a similar feature in `src/core/features/` first (`drawbridge.js`
for a timed cycle, `wear.js` for a per-sample grid, `rockfall.js` for spawned hazards, `traffic.js` for extra cars).

## Rules that make or break it
- **Append** to `FEATURES` in `src/core/features/index.js`; never reorder. The order fixes the order of random
  draws, and golden replays depend on it.
- **Randomness only from `R.rnd`**. Never `Math.random`, `Date.now` or frame time in `src/core`.
- **Core is pure**: no three.js, DOM, render, ui, audio or game.js in `src/core` (ESLint enforces). Talk to the
  rest through state on `W` / `R` and `car.events` (`c.events.push({ t: 'name', ... })`); `ui/flow.js`
  `handleEvents` turns events into sound and effects.
- Fixed step: it runs at 120 Hz with `dt`; anything the renderer shows smoothly reads state, not event timing.
- Switched on by stage data (a tag, a list, a flag); a stage that doesn't use it must behave exactly as before, and
  golden must prove it (only stages that use it change).

## Build
1. `src/core/features/<name>.js` exporting `feature` with the hooks it needs: `init(R, W)`, `vehicles(R)`,
   `move(R, W, dt, all, racing)`, `spawn(R, W, dt)`, `after(R, W, dt)`.
2. AI: if it blocks or endangers the road, make the AI see it (how `drawbridge` and `rockfall` do) and check with
   `npm run sandbox`.
3. Visuals: `src/render/elements/<name>.js` plus an entry in `RENDER_ELEMENTS` (`src/render/elements/index.js`;
   hooks `init`, `build(group, tr, terr, stage)`, `newRace(r)`, `update(dt, now, fxDt)`), reading `G.world.W`;
   sounds via `AudioSys` from events.
4. A scenario in `tests/scenarios.js` if it has rules worth locking (it opens on time, it respawns you, it never
   blocks the start).

## Prove and ship
- `npm run sandbox -- <stage or sandbox>`: events show up where expected, AI isn't stuck or wrecked by it.
- `npm run shot -- <stage> <metres> ...` at the moments it happens.
- `npm run golden` only for the stages that use it (check the diff lists only those), say so in the commit, `/ship`.
