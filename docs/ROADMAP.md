# Roadmap

The plan agreed for the next stretch of work. Update the status table at the end of every phase.

## Status

| Phase | What | Status |
|---|---|---|
| F0 | Roadmap in the repo | done |
| F1 | Workshop test hub | done: hub, Cars (the Asset Lab), Crash test, Weapons range, Track elements; Destruction yard and Scenery kit tabs wait for F3/F4 |
| F2 | Car anatomy: panels, hinges, health | next |
| F3 | Toughness and breakable scenery | planned |
| F4 | World kit: towns from rules + style packs | planned |
| F5 | Visible, swappable upgrade parts | planned |
| F6 | Weapon modules: levels, loadouts, signature weapons | planned |
| G1 | Disciplines and ratings | planned |
| G2 | Events and scoring from data | planned |
| G3 | Derby: mode, arenas, AI | planned |
| G4 | Economy and pacing dashboard | planned |
| G5 | Career v2 structure | planned |
| G6 | Content waves | planned |


## Context
Career mode works: tiers, cups, upgrades, bosses and the Rookie circuits. The next step widens it into a richer game:
- **More content:** more cars in families per discipline, upgrades you can see, weapon upgrades, special tracks for
  bosses and oddball vehicles, and a destruction derby discipline mixed into racing.
- **Systems to support it:** breakable scenery that changes the race, cars that come apart panel by panel, towns
  and other scenery built from reusable pieces, and a test hub for trying any of it without the career loop.

The ethos is **solve once, use anywhere**. So the work splits into two layers:
- **Foundations:** what the game is made of.
- **Game:** how races and the career use those foundations.

Each foundation is built once as a data-driven module with a test bench, and the game layer only composes them.

Decisions already made by the user:
- Derby gets **arenas** (an open bowl with no laps) **and** derby-style tracks.
- **Breakable scenery affects the race:** it can block a line, open a shortcut or leave debris.

What exploring the code found:
- **Car damage** in core is 4 zones (`c.dmg {f,b,l,r}`, `src/core/sim/damage.js` `damageCar`).
- **Car bodies** are one or two dentable boxes, plus a few loose parts: bumper, wing, struts, heads, tails, cabin,
  wheels (`src/render/carmodels.js` `kit`/`MODELS`).
- **`breakApart`** (`src/render/effects/pieces.js`) only throws a hard-coded list of parts, so the body stays whole.
- **Hinges:** the only one is the fake doors in `swingDoors` (`src/render/vehicles.js`).
- **Upgrades** change handling only; nothing changes visually.
- **There is no toughness stat.**
- **Scenery collision** covers only round obstacles in `terr.obst` (`core/track/obstacles.js`,
  `core/sim/obstacles.js`), plus road-side walls with HP (`core/sim/barriers.js` `BAR_HP`).
- **Houses** have no collision.
- **Towns** only work on circuits (`core/elements/town.js` `if (!gorge) return`).
- **Weapons:** the numbers are global (`WPN`, inline `damageCar` constants) and the visuals are hard-coded per item
  (`render/weapons.js`).
- **Finishing a race** is hard-coded to progress in `raceStep`, and a wrecked car always respawns.
- **The Asset Lab** (`src/ui/lab.js`) and **sandboxes** (`src/data/sandboxes`) already exist, routed at `src/main.js`
  ~100.
- **Career saves** only load `v: 1` (`src/ui/storage.js`).

## Principles (every phase)
- **Simulation decides, render draws.** Everything that affects the race is deterministic in `src/core` (`R.rnd`,
  new `FEATURES` appended at the end). The render only reacts to `car.events`.
- **Data in, behaviour in code.** Panels, parts, styles, disciplines and events are tables in `src/data`. Blender
  packs supply shapes, parts and pivots, and the Classic path keeps working.
- **Every new system gets three things:**
  - a Workshop tab to look at it and play with it;
  - a headless tool that measures it;
  - a test that locks it.
- **Golden runs stay green unless a phase means to change behaviour.** When it does, regenerate them and say so in
  the commit.
- **One phase = one PR off `main`,** shipped with `/ship` (`npm run check`, `npm run e2e`, publish). Skills are updated
  when a phase changes how something is built.

## Layer 1: Foundations

### F0. The roadmap in the repo
- Commit this plan as `docs/ROADMAP.md`, with phase status, so it outlives the session.
- Update it at the end of every phase.

### F1. The Workshop: one test hub
- **Route:** `?workshop[=tab]`, next to `?lab` in `src/main.js`, as a new `src/ui/workshop.js` with tabs:
  - **Cars:** today's Asset Lab turntable, moved over from `ui/lab.js` (`?lab` keeps working as an alias).
  - **Crash:** any car into a wall, or another car, at a chosen speed.
  - **Weapons range:** a small loop with dummy cars and AI cars; pick a weapon and level; slow motion; readout of the
    time lost per hit.
  - **Destruction yard:** drive or launch any car at fences, barriers and walls.
  - **Kit:** an empty lot to place scenery pieces and style packs.
  - **Elements:** the existing sandboxes list.
- **Live races** use the real `createRace`/`raceStep` on small built-in stages, like the sandboxes do. The Lab's
  duplicated damage buttons (`lab.js` 81-84) are replaced by calls to the real `damageCar`/`updateCarDamageVis` path.
- **Tools:** `npm run shot -- workshop:<tab>` and an e2e pass that opens each tab with no console errors.
- **Done when:** every tab opens straight from its link on the published game, and the e2e passes.

### F2. Car anatomy: panels, hinges, health
- **`src/data/anatomy.js`** (pure data, readable by core and render). A standard panel list:
  - `bonnet`, `boot`, `fbumper`, `rbumper`, `doorL`, `doorR`, `roof`, `wheelFL..RR`, `chassis`.
  - Per panel: the zone it belongs to, its health, its hinge (`front`/`rear`/`side`/`none`), and the steps it goes
    through: bend → open → off.
- **Core:** `damageCar` also spreads each hit across panels in `c.panels` by where it lands, and emits
  `panel-bend`/`panel-open`/`panel-off` events.
  - Zones keep driving the physics, so golden runs don't change.
  - A lost wheel only affects handling in a later, deliberate change.
  - `healCar` mends panels the same way it mends zones.
- **Render:**
  - Builders return `panels {id: Object3D with a hinge pivot}`, and `dentMesh` dents only the panel that was hit.
  - `updateCarDamageVis` plays the bend/open/off steps from the panel table. The magic numbers move into the table.
  - `breakApart` throws every panel and leaves the burnt chassis on its axles.
  - `mergeStatic` must leave panels unmerged.
- **Classic path:**
  - A new `K.bodyPanels(outline)` helper in `carmodels.js` cuts the existing body box into bonnet, boot, roof and door
    meshes. All 19 Classic cars get panels without being rebuilt by hand.
  - Door bashing uses the real doors instead of `swingDoors`.
- **Blender path:**
  - `blender/cars.py` `finish(...)` roles get `panels` + `hinge` pivots (`rbumper` gets a role).
  - Rebuild with `npm run assets`.
  - The contract test in `tests/assets.test.js` requires every panel on every car (both providers).
- **Skills:** `/new-vehicle` and `/blender` gain the anatomy contract.
- **Done when:**
  - In Workshop → Crash, every car in both providers bends, opens and drops each panel, and its death leaves a bare
    frame.
  - Golden runs are unchanged.

### F3. Toughness and breakable scenery (behaviour)
- **Hit energy:** `src/core/sim/impact.js`.
  - Energy = ½ · m · v², where m = 1/`im`, times `ram` (upgrade).
  - Each car gets a new stat `veh.tough` (default 1), which divides the damage it takes in `damageCar`.
- **Breakables in core:**
  - Extend `terr.obst` entries with `kind`, `hp`, and a box footprint (`hw`, `hl`, `yaw`) for fences, walls, stalls and
    houses. The circle path stays for trees.
  - What breaks is recorded in race state (`R.broken`), never in `terr`, which is shared.
  - Debris that matters becomes a dynamic body, using the same pattern as `rockfall.js` `R.rocks`. It blocks, slows,
    or gets pushed.
  - A new feature, `breakables`, is appended to `FEATURES`. `collideObstacles` also runs on the road where breakables
    sit.
- **Walls:**
  - A `BAR_HP` concrete type: only cars above an energy threshold break it.
  - The fence and hay types get their thresholds from the same energy rule.
- **Breach element** (`core/elements/breach.js` + render + sandbox): a breakable fence or gate across the mouth of a
  `branches` shortcut.
  - Heavy cars smash through; light cars bounce off.
  - The AI only takes it if its energy clears the threshold.
- **Render:** pooled debris (`effects/props.js`), a debris cap per Graphics level, and scorch/dust.
- **Tool:** `npm run destruct`, a headless table of every car × every breakable: does it break, at what speed, and what
  it costs the car.
- **Done when:**
  - The table shows the monster truck and mixer break concrete and the coupe doesn't.
  - The breach sandbox laps clean.
  - Existing stages' golden runs are unchanged (no breakables are placed on them yet).

### F4. World kit: towns and other scenery from rules + style packs
- **Layout:** `src/core/kit/layout.js` (deterministic, core).
  - Starting from the road frontage it lays out side-road stubs and junctions, plots, drives, gates, fences or walls,
    gardens, street furniture (lamps, post boxes, bins, bus shelter) and parked cars.
  - The output is a list of placed pieces with footprints and toughness, which feeds F3's breakables.
- **Styles:** `src/data/styles/*.js` (alpine, seaside, desert, farm, industrial). A style picks the house and wall
  types, colours and density.
- **Stage option:** `town: { style, size, at }` replaces today's `village`, and works on circuits **and** downhill
  stages (lift the gorge-only rule in `core/elements/town.js`).
  - Bollards stay where pavements meet the race road.
  - Side roads are short visual stubs that end in a breakable gate or barrier.
  - Houses become solid.
- **Blender kit pieces** (`blender/pieces.py`): fence panel, gate, garden wall, post box, bin, bus shelter, side-road
  junction, kerbed plot edge. Each goes into `kitPack`, with a Classic builder too.
- **Same layout engine, other uses:** farm (fields, hedges, barns), service park (marquees, tyre stacks), building site.
- **Retrofit** Ravenrock, Village Descent and Village Green (golden is regenerated for those, stated in the commit).
- **Done when:**
  - A Workshop → Kit lot shows each style.
  - Screenshots of the three retrofitted stages read as real villages.
  - The benchmark stays within budget.

### F5. Upgrades as visible, swappable parts
- **`src/data/parts.js`** replaces `UPGRADES`.
  - **Slots:** engine, tyres, suspension, armour, aero, ram, cage.
  - Each slot has levels and **sidegrades** (slicks / gravel / studded tyres).
  - Each part = stat effects (as today's `fx`) + panel health bonuses + toughness + a list of visual pieces fitted at
    named anchors (`bonnetTop`, `roof`, `front`, `rear`, `wheel`, `under`).
- **Anchors** come from the F2 anatomy: Blender meta, or the Classic bounding box as a fallback.
- **Garage:** a fitting animation (the car rises on jacks, the part swings in on its pivot), and suspension travel
  shows in races.
- **Thumbnails:** the `render/thumbs.js` cache key includes the car's build.
- **Career save:** goes to `v: 2`, with a migration of old saves in `ui/storage.js` (old levels map to parts).
- **Done when:**
  - The Workshop Cars tab can fit any part to any car (both providers).
  - `npm run career` pacing is no worse than today.
  - An old save loads.

### F6. Weapon modules
- **Constants:** lift every weapon number (including the inline `damageCar` constants) into `WPN`.
- **Per-car loadouts:** cars carry `weapons` in their defs (levels, uses, a bias to the pickup odds, a loadout slot),
  copied onto `c.wpn` in `init`.
- **Levels:**
  - missile: lock-on speed, then twin missiles;
  - gun: burst length;
  - oil: slick size, then glue;
  - pulse: radius;
  - harpoon: tow time.
- **Loadout items:** flares, shield, magnet.
- **Signature weapons:** fire truck water cannon, mixer cement trail, police stinger, monster truck crush, ice cream
  jingle. Each is appended to `ITEMS` with odds, `use()`, AI wants, a render module, a mount and a HUD entry.
- **Mounts:** placed at the anatomy's `roof` anchor instead of the bounding-box roof.
- **Balance:** `npm run balance` covers every level and signature weapon (target about 1 s per use).
- **Done when:** the Workshop range shows every weapon at every level, and the balance table is within target.

## Layer 2: Game

### G1. Disciplines and ratings
- **Disciplines:** Road, Rally, Off-road, Heavy, Oddball, Derby. They replace `CLASSES` in `career.js`, while
  `allowed()` keeps its shape.
- **Two ratings per car build, measured not guessed:**
  - **Pace rating** from `balance-vehicles` lap times on tarmac and loose stages.
  - **Toughness rating** from `npm run destruct` (F3).
  - Ratings are stored as a generated `src/data/ratings.json`, and a test fails if it's stale.
  - Bands run D → C → B → A → S.
- **Event entry:** `{disc, maxPace?, maxTough?}`.

### G2. Events and scoring from data
- **Event fields:** `format` (race, banger, demolition rally, figure of eight, derby, trial, boss) and
  `weight: {race, destruct}`.
- **Scoring:** `scoreRace` scores race points × weight + destruction points × weight.
  - Destruction points come from wrecks caused, panels removed and scenery broken, added to `G.tally`.
- `career-sim` simulates every format, including modes, which it skips today.

### G3. Derby: mode, arenas, AI
- **Mode:** `src/core/modes/derby.js`.
  - Lives in `R.derby`, branching in `createRace`/`raceStep` the way `R.sd` does.
  - No laps and a timer.
  - Wrecked cars are out (`c.out`; skip the respawn in `car.js` ~90).
  - Last car running wins, plus points.
- **Arena element:** built on `open.js`. An open bowl closed by a wall ring, with spawn points, ramps and breakables
  from F3.
  - The camera fits the action like Showdown's zoom-to-fit.
- **Derby AI:** picks a target (weakest, nearest, or whoever hit it last), steers at it with obstacle avoidance, and
  backs off when its own panels are low.
- **Content:**
  - 3 arenas: scrapyard bowl, farm mud pit, stadium.
  - 2 derby tracks: banger oval, crossover figure of eight.
  - A sandbox for each.
- **Done when:** derby races finish in the sim at both skill levels, and the e2e covers an arena.

### G4. Economy and the pacing dashboard
- **`src/data/economy.js`:** one sheet of curves.
  - Car price from rating.
  - Part cost rising by level.
  - Resale at about 60%.
  - Prize money by tier and format.
- **Selling cars** in the career garage.
- **`npm run career -- --json`** feeds a published **dashboard artifact** showing, per tier:
  - your rating against the rivals';
  - win rate at casual and good skill;
  - races needed per purchase;
  - cash over time.
- **Pacing tests:** for example, a casual player can afford the next tier's entry car after ≤ 6 races.

### G5. Career v2 structure
- **Tiers:** each tier gets Road, Rally, Off-road and Derby series plus an Oddball cup, with event entry by
  discipline and rating band.
- **Bosses** race on their own special tracks:
  - monster truck stadium;
  - Formula street circuit;
  - rocket salt flats.
- **Past Legend:**
  - **Elite tier:** difficulty from rival ratings, bigger fields (8–13), AI personalities (blocker, bomber) and a
    nemesis.
  - **Seasons:** championship points.
  - **Prestige:** start over with harder rules and keep the garage.

### G6. Content waves (repeatable once the above exists)
- **Car families:** one shared Blender chassis generator per family (`blender/chassis.py`, with params for wheelbase,
  roof, wings and ride height). About 20 new cars at first, each with a role line.
- **Special tracks:** boss and oddball tracks: building site, seafront, burning town.
- **Track versions:** reverse, night and weather versions of existing tracks.

## Order and dependencies
F0 → F1 → F2 → F3 → { F4, F5, F6 can run in any order } → G1 → G2 → G3 → G4 → G5 → G6
- F1 first: every later phase is checked in it.
- F2 before F3: car destruction needs panels.
- F2 before F5: parts mount on panels.
- F3 before F4: houses and fences are breakables.
- F3 before G1: the toughness rating needs `npm run destruct`.
- G3 needs F3, plus F2 for the derby visuals.

## Verification (each phase)
- **Checks:** `npm run check` (lint, tests, golden, build) and `npm run e2e` (every stage, plus every Workshop tab once
  F1 exists).
- **Tools:** the phase's own headless tool (`destruct`, `balance`, `career`, `sandbox`) shows its target numbers.
- **Visual changes:** screenshots from `npm run shot` / `npm run labshot`, before and after, which get looked at, plus
  `npm run bench` against the previous run.
- **Ship:** publish to https://claude.ai/artifact/VWoYkDJ6JEu65zXEbELwwC. Update `docs/ROADMAP.md` status, and tell
  the user what to try in the Workshop.

## Next step
F2: car anatomy, on its own PR. (F1 left the Asset Lab's own Dent/Knock buttons as they were; F2 replaces them with the real damage path.)
