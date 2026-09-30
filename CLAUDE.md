# Notes for Claude

Top-down racer, three.js r128, plain JS modules, Vite. Read README.md for the layout and how to add stages/features.

## Commands
- `npm run check`: lint + tests (golden included) + a production build. Run before every commit; must pass.
- `npm run e2e`: production build + headless browser run of every stage (no console errors allowed).
- `npm run layout -- <n>` / `npm run terrain -- <n>`: inspect a stage's road plan / terrain before playing it (`sandbox:<name>` works too).
- `npm run sandbox -- <name|all>`: AI laps of an element sandbox, with what went wrong where. Browser: `?sandbox=<name>&debug`; backquote toggles the debug overlay.
- `npm run shot -- <n|sandbox:name|garage> [metres ...] [--vehicle id] [--debug]`: screenshots from the player's seat (AI drives to each distance) → tools/out/. Look at them.
- `npm run balance`: every vehicle's pace vs the coupe on tarmac and loose stages, and what each weapon costs its victim (~1 s per use). Run after touching handling or weapon numbers.
- `npm run bench -- <n>`: render benchmark (SwiftShader here, so only compare against a previous run). `MODELS=classic|blender` (also for `shot`) sets the Models setting: price Blender assets against Classic with `RIVALS=13`.
- `npm run assets [ids]`: build the Blender assets headless (installs `bpy` if missing; ~1 min per car) → `src/assets/gen/` (commit it) and previews in `blender/out/`. Look at them: `npm run labshot -- <ids>` (Blender beside Classic), and the Asset Lab (`?lab`, `npm run lab`; published on its own at https://claude.ai/artifact/YbX3XQF3kMha8K6a6GgdMj, whose db also holds `assetNotes`).
- Headless Chromium lives at /opt/pw-browsers (don't `playwright install`); pass `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`.

## Notes from the user
The published game has a Note button (N): the user taps a spot on a track and types what they'd change. Notes land in
the artifact's database: `ArtifactData` `list` of collection `notes` on the artifact URL (under Rules) (fields: stage, metres from the
start line, lat, x/y/z, text, camera, status, and `shot`, an asset id: `Artifact` `read` with `path` = that id to see
their view). Go to the spot with `npm run shot -- "<stage>" <metres>`. Answer each by `update` on `notes/<id>` with
`{ reply: "...", status: "done" }`: the reply shows in the game's Notes list and the pin turns green.

The menu's Track editor lets the user lay out a circuit (an existing gorge stage or a blank oval) and "Send to Claude":
those land in collection `tracks` (name, base, closes, message, `stage` = the stage object with `segs`, `comments` =
pins the user dropped on the plan `{ n, text, sec, metres, off, a, b }`, `notes` = per-section notes `{ sec, text }`;
sections are numbered from 1). The user can also draw a track freehand (base "drawn"): it's their design, so follow
the shape and read every comment and note as the brief for that spot. Turn one into a real stage with `/new-stage`
(its segs are already frozen metres; keep them, add the look and the set pieces the comments ask for), then `update`
`tracks/<id>` with `{ reply, status: "done" }`.

The Asset Lab's Notes box lands in collection `assetNotes` (asset, pack, provider = blender|classic, text): in the
game artifact's db when opened from the game's menu, in the lab artifact's db when opened on its own. Check both;
answer the same way (`{ reply, status: "done" }`), rebuild with `npm run assets -- <pack>`.

## Skills (.claude/skills)
`/new-stage`, `/new-element`, `/new-vehicle`, `/new-feature`, `/look` (visual changes), `/blender` (Blender assets), `/ship` (verify, commit, push, publish). Each holds the workflow, the done-checks and traps we've hit; the README holds the how. When you hit a new trap, add it to the skill it belongs to.

## Rules
- `src/core` and `src/data` must stay free of three.js/DOM/`render`/`ui`/`audio`/`game.js` (ESLint enforces). The simulation talks to the rest only through state and `car.events`.
- Golden tests lock exact behaviour. Refactors must keep them green. For intended gameplay changes run `npm run golden` and state it in the commit message.
- Race features draw randomness from `R.rnd`; keep `FEATURES` order stable and append new ones.
- New pieces of road are track elements: `src/core/elements/<name>.js` + `src/render/elements/<name>.js` + a sandbox (README "Adding a track element"). Don't special-case them in circuit.js or buildWorld.
- Cross-module mutable app state goes on `G` (src/game.js), not new loose `let`s shared between modules.
- `window.__dr` (src/debug.js) exposes `G`, `core`, `flow` and `step(secs)` for browser tests; the game doesn't use it.
- Match the surrounding style: short explanatory comments on the non-obvious bits, dense one-line helpers are normal here.
- Visual assets have two providers: Blender packs (`src/assets/gen`, from `blender/`) and the Classic code builders. Code that
  draws one asks `blenderPack` / `sceneryPack` / `kitPack` and must keep its Classic path working (Models: Classic, and
  Auto on Graphics: Low). Behaviour (damage, animation, collisions) stays in code; a pack brings shapes, parts and pivots.
- Publish by building and publishing `dist/index.html` to the existing artifact, https://claude.ai/artifact/VWoYkDJ6JEu65zXEbELwwC
  (pass it as `url`; it keeps its db + assets capabilities); dist is not committed. The user's notes and tracks live
  in that artifact's database. When assets or the lab change, also `npm run lab` and publish `dist-lab/index.html` to the
  lab artifact above. Work on a branch off `main` and merge back by pull request.
