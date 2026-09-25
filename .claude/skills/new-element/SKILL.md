---
name: new-element
description: Add a new reusable track element to Downhill Rush (a new kind of road piece or set piece: jump type, obstacle, surface patch, structure, scenery) with its core module, visuals, sandbox and tests. Use when a stage needs something no existing element does, or the user asks for a new obstacle/road feature.
argument-hint: <what the piece of road does>
---

# New track element (solve once, use anywhere)

Read README "Track elements", "Adding a track element" and the header of `src/core/elements/index.js` first.

## 1. Is it really new?
Check the README table. A variant of an existing element is an option on it (`mud: 'water'`, `kick: <m>`), not a
new element. Scenery that doesn't touch the road or race may only need a render element.

## 2. Build it (same name everywhere)
1. **Core** `src/core/elements/<name>.js`: `tags`/`stageKeys`, per-sample `channels`, and only the hooks it needs
   (`section`, `heights`, `walls`, `wallsLate`, `wallsLast`, `speeds`, `track`, `markers`). Add to `ELEMENTS` in
   `src/core/elements/index.js` at the end unless it must build earlier. `onBranch: true` only if it works on a
   branch (test it). No three.js/DOM/render/ui/audio/game.js here (ESLint enforces).
2. **Moves or acts during a race** (timers, moving parts, per-race state)? Add a race feature too (`/new-feature`).
3. **Surface** effects go through `SURF` (grip, drag, spray) rather than new physics paths.
4. **AI** must cope: if it needs a line, a speed or to wait, give it `speeds`/markers the AI already reads, and check it.
5. **Render** `src/render/elements/<name>.js` with `build(group, tr, terr, stage)` and, if needed, `newRace`,
   `update(dt, now)`; add to `RENDER_ELEMENTS`. Reuse `render/geometry.js` helpers and `withCutaway` materials;
   draw every sample via `tr.all0` so it works on branches; skip `tr.voidMask` samples.
6. **Sandbox** in `src/data/sandboxes/index.js` (a tiny loop showing it off, or add it to a themed one like
   `rally`), and its expected markers in `tests/elements.test.js`.
7. README: a row in the element table (and the sandbox list if new).

## 3. Prove it
- `npm run sandbox -- <sandbox>`: its marker is where you meant, AI laps are clean and similar, and the events it
  should cause show up (air, bumps, splashes). A wreck or respawn next to it is a bug unless intended.
- `npm run shot -- sandbox:<name> <metres> --debug`: see it from the player's seat with the overlay (marker label,
  surface readout). Also try `--vehicle monster` and `--vehicle kart` (biggest and smallest).
- Put it in a real stage only when the user asked for it; then `npm run golden` (say so in the commit).
- `/ship`.

## Traps we've hit
- In this code's dense one-liners, a `//` comment ends the line: code after it silently disappears (car dirt was
  dead for a release that way). Comments go at the end of a line, never in the middle.
- Circuits wrap: use `tr.loopN || tr.N` and `tr.nb0`/`tr.adv`, never `i + 1`, or it breaks at the start line.
- Randomness only from `R.rnd` (seeded) in features; `Math.random` breaks golden replays.
