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
    features/           optional race systems plugged into the race loop: traffic, trains, parked, rockfall
  data/                 stages (one file each) and car/traffic definitions
  render/               three.js: renderer & quality, materials/shaders, world builders, vehicles,
                        trains, crossings, rocks, effects, camera, features.js (visual hooks)
  audio/                Web Audio synth (engine, crashes, horns, bells)
  ui/                   HUD, menu/flow (countdown, pause, results), input, storage
tests/                  golden simulation tests, scenarios, browser smoke test
tools/                  layout/terrain/benchmark tools
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

## Adding a stage

1. Copy a file in `src/data/stages/` (e.g. `ravenrock-gorge.js` for a section-built circuit, `summit-meadow.js`
   for a generated downhill) and add it to `src/data/stages/index.js`.
2. For `type: 'gorge'` circuits, describe the road as `segs` (straights and arcs in screen axes) with tags for the
   ground either side (`far`/`near` + `rampF`/`rampN`), `bridge`, `tunnel`, `jump`, `town`, `gallery`, `rockfall`,
   `kick: <m>` to put a kicker jump of that height at the start of a section (best on a crest before a descent),
   and `arch` for a scenery rock arch over the middle of a section. Stage `rockGap` spaces out falling rocks.
   Optional `river` and `rails` add the river and railways. See `src/core/types.js`.
3. Iterate with `npm run layout -- <n>` and `npm run terrain -- <n>` until the plan closes cleanly and nothing
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
