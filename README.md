# Downhill Rush

A top-down alpine racer in the spirit of *Ignition*: breakable barriers, car damage, traffic, trains at level
crossings, rockfall and a gorge circuit with viaducts. Three.js (r128), plain JavaScript, built with Vite into a
single self-contained HTML file.

Two modes: **Race** (first to the line) and **Showdown**, King of the Hill, Micro Machines style: the camera
follows the leader and zooms out to keep the pack in shot. The leader wears the crown and banks crown time while
holding it; the crown only changes hands on a clear pass. A car left off
the screen at full zoom blows up, pays the holder 2 s of its crown time and respawns behind or beside the leader.
Nothing ever stops; first to 60 s of crown time wins (or the most crown time at the finish).
The Showdown rules live in `src/core/modes/showdown.js`; `src/core/sim/view.js` uses the camera's exact screen
axes so what you see is what's judged.

Catch-up, in both modes: a car tucked in 3-20 m behind another gets a slipstream tow (`PHYS.DRAFT`), and once a
leader pulls clear (35 m, or 8 s holding the crown) leader hazards appear ~3 s ahead of it (`core/features/hazards.js`):
cows ambling across or an oil slick on one side, always behind a warning sign, always with a gap, 6-9 s apart.

Road cars (traffic and parked) are fragile: a racer hitting one at over 11 m/s (`SMASH_V` in `core/sim/collide.js`)
destroys it, launching the scorched shell into a tumble while the racer ploughs through with a little boost.

On phones (portrait or landscape) the left thumb points a steering wheel: the car turns to face, on screen, the way
the thumb points from the wheel's centre (`groundDir` in `core/sim/view.js`). The
right thumb rests on Gas: slide it down to drift, left to brake/reverse, without lifting it (`src/ui/input.js`).
"Steering: Wheel / Arrows" (menu and pause screen, touch devices only) swaps the wheel for left/right arrows;
slide between them without lifting. The choice is remembered.

## Quick start

```bash
npm install
npm run dev        # live-reloading game at http://localhost:5173
npm run build      # dist/index.html: one file with everything inlined (what gets published)
npm run check      # lint + tests: run before every commit
```

| Command | What it does |
| --- | --- |
| `npm test` | Golden simulation tests (Vitest, ~8 s) |
| `npm run lint` | ESLint: undefined names, and keeps `core/` free of rendering/DOM |
| `npm run e2e` | Builds, then loads and races every stage in headless Chromium; screenshots in `tests/e2e/shots/` |
| `npm run golden` | Re-records `tests/golden.json`: only when a change is *meant* to alter gameplay |
| `npm run layout -- 7` | Top-down plan of stage 7's road: heights, bridges, tunnels, river, railways, near-misses between road sections |
| `npm run terrain -- gorge` | Shaded relief map of a stage's terrain |
| `npm run bench -- 5 7` | Render-time benchmark for stages 5 and 7 (software renderer: compare runs, not absolute ms) |

Tool output goes to `tools/out/`.

## How the code is organised

```
index.html              page shell: HUD/menu markup and CSS
src/
  main.js               boot and the frame loop
  game.js               G: state that several modules write (world, state, shake, renderAlpha, ...)
  core/                 THE SIMULATION: pure JS, no three.js, no DOM (runs in Node for the tests)
    math.js constants.js types.js
    track/              road generation (downhill, circuit, gorge), terrain, rails, road queries
    sim/                car physics, AI, barriers, damage, collisions, race loop
    elements/           TRACK ELEMENTS: one module per reusable piece of road (bridge, tunnel, kick, gap, boost, town, ...)
    features/           race systems plugged into the race loop: traffic, trains, parked, rockfall, hazards
    modes/              game modes on top of a race (showdown)
  data/                 stages (one file each), sandboxes (a tiny loop per element), car/traffic definitions
  render/               three.js: renderer & quality, materials/shaders, world (terrain, road, barriers,
                        scenery), elements/ (each element's and feature's visuals), vehicles, effects,
                        camera, overlay.js (debug overlay)
  audio/                Web Audio synth (engine, crashes, horns, bells)
  ui/                   HUD, menu/flow (countdown, pause, results), input, storage
tests/                  golden simulation tests, scenarios, browser smoke test
tools/                  layout / terrain / sandbox / benchmark tools
```

### Rules that keep it maintainable

1. **`core/` and `data/` never touch rendering, UI or audio.** ESLint enforces it. The simulation produces
   state plus `events` on cars (`hit`, `smash`, `dent`, `wreck`, `trainhit`, ...); the renderer and audio read
   the state each frame and react to events in `ui/flow.js` → `handleEvents`.
2. **Behaviour is locked by the golden tests.** A refactor must leave `npm test` green. If a change is meant to
   alter gameplay, run `npm run golden` and say so in the commit message.
3. **Randomness:** gameplay randomness in features uses the race's seeded `R.rnd`, so races repeat exactly.
   Feature order in `core/features/index.js` fixes the order random numbers are drawn in: add new features at the end.
4. **Physics runs at a fixed 120 Hz** (`STEP`); cars are drawn interpolated between steps (`G.renderAlpha`).

## Track elements (solve once, use anywhere)

Every reusable piece of a stage is a **track element**: one module in `src/core/elements/` for what it does to the
road and the race, and an entry with the same name in `src/render/elements/` for how it looks. A stage only *uses*
elements, by tagging its sections (`{ bridge: true }`, `{ kick: 2.4 }`) or setting stage options (`rails`, `rockGap`).

| element | section tags / stage options | what it does |
|---|---|---|
| ground | `far` `near` `rampF` `rampN` | terrain either side (drops, cliffs, rock faces, guard rails) |
| rails | `rails` | railway lines; level crossings where they meet the road |
| jump | `jump`, `jumps` | automatic jumps on long straights |
| kick | `kick: <m>` | a kicker jump at the start of the section |
| bridge | `bridge`, `viaduct` | road on a deck; steel bridge or stone viaduct |
| tunnel | `tunnel` | bored tunnel (the see-through window opens in long ones) |
| town | `town` | street with bollards, houses, parked cars |
| gallery | `gallery` | roofed rock gallery on a ledge |
| rockfall | `rockfall`, `rockGap` | boulders fall across the road |
| arch | `arch` | scenery rock arch |
| gap | `gap` | a void to jump (fall in and you respawn on the far side) |
| boost | `boost` | boost pads across the road |
| ferry | `ferry` | a barge carries the cars across water between two docks (moves in `features/ferry.js`) |

A core element can declare `tags`, `stageKeys`, per-sample `channels`, a `section()` hook, build phases (`heights`,
`walls`, `wallsLate`, `wallsLast`), `track()` to add fields to the built track, and `markers()` saying where it is (see
the header of `src/core/elements/index.js`). `buildTrack` validates every stage against the registry, so a misspelt
tag or option fails with the list of valid ones, and a section that comes out backwards fails with its index.

### Debugging an element

- **Sandbox:** `src/data/sandboxes/` has a tiny loop per element. Play one with `?sandbox=<name>` (it's added as the
  last stage), or run `npm run sandbox -- <name>` (or `all`): four AI cars lap it and it reports lap times, air time,
  and any wrecks, respawns or hazard hits next to the element that caused them, plus a layout map.
- **Overlay:** press the backquote key (`` ` ``), or open with `?debug`. It shows the centre line coloured by element,
  barrier types as coloured ticks, every element's marker labelled in the world, and a live readout of your car
  (sample, lateral offset, surface, air, slipstream, oil, barriers here, next element ahead).
- **Layout map:** `npm run layout -- <n|sandbox:name>` labels every element's markers.

## Adding a track element

1. `src/core/elements/<name>.js`: declare its tags/options and whichever hooks it needs; add it to `ELEMENTS` in
   `src/core/elements/index.js` (order = build order: add new ones at the end unless it must run earlier).
2. If it moves or acts during a race (a barge, a drawbridge), add a race feature in `src/core/features/` too.
3. `src/render/elements/<name>.js` for its visuals and an entry in `RENDER_ELEMENTS` (`build`, `newRace`, `update`).
4. A sandbox in `src/data/sandboxes/index.js` and its expected markers in `tests/elements.test.js`.
5. `npm run sandbox -- <name>`, play `?sandbox=<name>&debug`, then `npm run check`.

## Adding a stage

1. Copy a file in `src/data/stages/` (e.g. `ravenrock-gorge.js` for a section-built circuit, `summit-meadow.js`
   for a generated downhill) and add it to `src/data/stages/index.js`.
2. For `type: 'gorge'` circuits, describe the road as `segs` (straights and arcs in screen axes), tagging sections
   with track elements (table above). Optional `river` and `rails` add the river and railways. See `src/core/types.js`.
3. Iterate with `npm run layout -- <n>`, `npm run terrain -- <n>` and `npm run sandbox -- <n>` until the plan closes cleanly and nothing
   overlaps by accident, then play it with `npm run dev`.
4. `npm run golden` to record the new stage, then `npm run check`.

## Adding a race feature (a new hazard or system)

1. **Simulation:** `src/core/features/<name>.js` exporting a `feature` object with any of
   `init(R, W)`, `vehicles(R)`, `move(R, W, dt, all, racing)`, `spawn(R, W, dt)`, `after(R, W, dt)`;
   add it to the end of `FEATURES` in `core/features/index.js`. Push events onto cars for effects.
2. **Visuals:** an entry in `src/render/features.js` with any of `init()`, `build(group, tr, terr, stage)`,
   `newRace(r)`, `update(dt, now, fxDt)`.
3. **Stage data:** switch it on from the stage (a tag, a list, a flag).
4. Add a scenario to `tests/scenarios.js` if it has rules worth locking down.

## Publishing

`npm run build` and publish `dist/index.html` (a single file, ~660 KB, no external scripts). `dist/` is not committed.
