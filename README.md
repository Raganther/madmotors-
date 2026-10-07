# Downhill Rush

A top-down alpine racer in the spirit of *Ignition*: breakable barriers, car damage, traffic, trains at level
crossings, rockfall and a gorge circuit with viaducts. Three.js (r128), plain JavaScript, built with Vite into a
single self-contained HTML file.

Four modes: **Race** (first to the line, against 1 to 18 rivals: the menu's Rivals setting), **Deuce** and
**Tiebreak** (checkpoint gates, below) and **Showdown**, King of the Hill, Micro Machines style: the camera
follows the leader and zooms out to keep the pack in shot. The leader wears the crown and banks crown time while
holding it; the crown only changes hands on a clear pass. A car left off
the screen at full zoom blows up, pays the holder 2 s of its crown time and respawns behind or beside the leader.
Nothing ever stops; first to 60 s of crown time wins (or the most crown time at the finish).
The Showdown rules live in `src/core/modes/showdown.js`; `src/core/sim/view.js` uses the camera's exact screen
axes so what you see is what's judged.

**Deuce** and **Tiebreak** use the same pack rules (camera on the leader, blow up off the screen, rejoin behind the
leader) with checkpoint gates instead of crown time: a gate stands on one side of the road ahead, and the first car to
drive *through* it scores (a leader on the wrong line can miss it). Win by two, like tennis: Deuce is first to 4
(3-3 is deuce, then advantage), Tiebreak first to 7. The rules are in the same file (`R.sd.kind`, `CP`).

**Weapons** (menu: Weapons on/off, every mode; `src/core/features/weapons.js`): drive through a **?** crate with
nothing in hand to get one of five weapons, which rises out of your roof: a homing missile, a machine gun (a burst of
tracers), an oil slick (two, dropped behind), a shockwave (blows the cars round you away and cuts their engines) and a
harpoon (hooks the car ahead: you're reeled in, they're held back). F fires. Crates are offered up the road to every
racer on its own timer, more often the further back it is, and what you get depends on your position (the back gets
missiles and harpoons, the front oil and shockwaves). Q swings a door into the car beside you (the side is picked
for you). The AI uses all of it. On touch there are Fire and Door buttons; a gamepad uses B and the bumpers.
Weapons have levels and cars carry gear (`src/data/weapons.js`; a race def's `wpn: { lv, gear }`): each level swaps
some of the core's `WPN` numbers (a longer gun burst, wider slicks, glue at level 3, a bigger shockwave, a longer tow,
twin missiles). Gear works by itself: flares draw off a missile locked on to you, a shield soaks up the next hit, a
magnet pulls crates in from across the road. Five vehicles find a **signature weapon** in crates too (`SIGNATURES`):
the fire engine's water cannon, the mixer's cement trail, the police car's stinger, the monster truck's crush (a leap
that slams whoever is near when it lands) and the ice cream van's jingle (everyone in earshot stutters). In the career
they're bought per car in the garage's Armoury; rivals carry the tier's level, bosses a shield. The Workshop's Weapons
range fires any weapon at any level at targets with any gear; `npm run balance -- --level 2` prices a level.

**Leagues** (menu: Leagues; `src/data/leagues.js`, `src/ui/league.js`): a championship over a named run of stages
(Rookie Cup, Circuit Series, Mud & Snow, Wild Cup), raced as Races against a fixed field of seven. Points go
10-8-6-5-4-3-2-1 by finishing place; from round 2 the grid lines up in reverse championship order, so the leader
starts at the back. Progress is kept per league in localStorage; leave for the menu and carry on later.

**Career** (menu: Career; `src/data/career.js`, `src/ui/career.js`): the progression mode. Pick a cheap starter
(Muscle Coupe, Rally Hatch or Tuk-Tuk) and climb four tiers, Rookie, Club, Pro and Legend, then the Elite tier. Each tier holds events
(cups of 3-6 rounds scored like a league): a Road, a Rally, an Off-road and a Derby series and an Oddball cup (`SERIES`;
the low tiers cap a series at a pace band), open cups, specials and a boss. Every race pays cash by finishing place plus style bonuses (big air, drift
boosts, weapon hits, a clean race) and earns up to three stars: a podium, a win, and the round's objective (so many
drift boosts or big airs, weapon hits, a clean run). Stars open each tier's boss; cash buys cars in the showroom, which
stocks more cars as tiers open. Rivals drive cars that belong in the tier and get sharper tier by tier
(`TIERS[].skill`), and from Club on their cars carry upgrades (`TIERS[].upg`: level 1 in Club up to 3 in Legend).
Your cars take upgrades too: parts in seven slots, three levels each (`SLOTS` in `src/data/parts.js`; see "Upgrade
parts" below), bought per car in the garage; they multiply the vehicle's `veh` handling, so stock cars fall behind as
you climb. Some cups are for one discipline (see "Disciplines and ratings" below), so a garage of one car can't win
everything.
Each tier also has specials (a time trial for bronze/silver/gold stars against `par`, a Showdown, Deuce or Tiebreak
against three rivals, a one-make race where everyone gets the same stock car) and a **boss**: a duel with a star
driver in their signature car, a notch sharper than the field. Enough stars in the tier open the boss;
beating the boss wins you their car and a purse and opens the next tier. After the Legend boss, the final (Champion
of Champions: all four bosses at once) pays for the gold limo and the title. The bosses race on their own tracks:
Brannigan's Monster Truck in the Monster Stadium (a dirt oval of kickers, whoops and mud), Moreau's Formula Racer on
the Old Town GP street circuit, Achterberg's Rocket Car on the Salt Flats.
**Elite** (opened by the final) is a season: every Elite race scores 10-8-6-5-4-3-2-1 for every car in it, and when
every Elite event is done the top three are paid (`SEASON_CASH`), the result goes in the career's titles and the next
season starts. Fields are twelve cars (eight in a derby), each rival's engine, tyres and suspension picked so its pace
on the event's surface is within `ELITE.GAP` % of your car's (`ratedLevel`), so a faster car meets better-built rivals.
Some rivals have a personality (`persona` on a race def): a **blocker** moves across to cover whoever closes from
behind (`core/sim/ai.js`), a **bomber** fires sooner and at more (`core/features/weapons.js`). The **nemesis** (one
of `NEMESES`, named when Elite opens) is in every Elite race, sharper and fully built, blocks the player and bombs;
the career keeps your record against them. A Champion can **prestige** (`prestige()`): start again at Rookie with
every car and its parts, against rivals `PRESTIGE.SKILL` sharper and a parts level better per prestige (up to 3), for
`PRESTIGE_PAY` more prize money. The garage's paint shop resprays a car
(`PAINTS`) for a fee; the player's career car wears it in the race. A cup's top three win a trophy (paid once per step up). Career races always have weapons on;
Quick Race and Leagues are untouched. The state is one localStorage entry (`downhill-rush-career`).
`npm run career` races every career round with the AI at a casual and a good player's skill and prints places,
stars and cash: tune `TIERS`, prices and payouts against it.

**Rookie circuits** (stages 19-22: Sunday Park, Harbour Sprint, Hay Bale Farm, Village Green): four flat, forgiving
laps for the Rookie Cup, each teaching one thing (steering and braking, the drift boost, gravel and small kickers, the
weapons on a figure of eight over its own stone bridge). They set `soft: true`, which puts hay bales instead of tyre
walls on tight bends, so a mistake costs a second. The four downhill runs moved up to Club as the Downhill Classic
cup. A stage's `river` can take a `color` (a lighter tint for a pond or the sea).

**Derby** (stages 23-26: Scrapyard Bowl, Mud Pit, The Stadium, and the Banger Oval): `src/core/modes/derby.js`, the
mode `createRace(W, defs, { mode: 'derby' })`. No laps, no finish line: a wrecked car is out for good (a shell to drive
round), damage doesn't mend (and is scaled by `DERBY.DMG` so a fight lasts), the last car running wins, and at the time
limit the survivors rank by damage. The derby AI (`derbyControl`) picks a target (near, battered, or whoever hit it
last), drives at it with a little lead, keeps off the walls and steers round the runs inside the arena, circles away
while badly hurt (not in the endgame), breaks off for a run-up when two cars only chase each other's tails, and backs
off when it's shoving at walking pace. A wrecked car stays where it died as a scorched shell till the end (you can
still ram it and shove it); your Reset is hidden once you're out and the camera watches whoever wrecked you. An
**arena** is a stage with `arena: { ring, shape, walls, ramps, pits, props }` (`src/core/elements/arena.js`) on a small
circuit tagged `open: 'field'`: a flat floor of any outline (`shape`, points in the segs' screen axes round the
circuit's middle: bays, necks, lobes; none = a circle) walled with an unbreakable kind (tyres, a concrete wall, hay
bales), `walls` runs of the same inside it (islands, wedges, alleys), earth `ramps` (placed with a direction, or a
number at random), mud and water `pits` (a dip that drives as mud or a ford) and breakable props on the floor; the
circuit is only where the cars line up, so keep the walls off the grid (lower right of the loop). `arenaWall`,
`arenaOut` and `inArena` answer where a point is. Scrapyard Bowl is a lopsided yard with a car-stack island, pockets
and a crusher bay up a neck; Mud Pit a kidney of a field split by a hedge, with wallows and a pond to jump; The
Stadium a figure of eight with a jump each way in the neck. Any stage with an arena is raced as a derby, from the menu too. The Banger Oval is a derby
*track*: a short oval for banger races (data/formats.js). The camera follows you (high and back for the open floor); the HUD shows the cars
left, the clock and your health. In the career, every tier has a derby series and derbies are specials from Club up, for Derby cars (data/disciplines.js:
toughness B or better). `npm run derby` plays every arena at two skills; the Workshop's Derby arena tab (`?workshop=derby&arena=stadium`) starts one.

**Boss tracks** (stages 27-29: Monster Stadium, Old Town GP, Salt Flats): one each for the bosses' cars. A floodlit
dirt oval with two big kickers, whoops, a mud pit and crates on the back straight (seven laps, about 18 s each); a
street circuit of square corners between Armco and houses with a fast chicane; a speed course on a salt lake, two
straights with boost pads and sweepers you can almost take flat. They're in the series too.

**Special tracks** (stages 36-37): **Building Site**, a dirt lap round a half-built estate (a fenced cut through the
foundations that heavy cars smash open, a spoil-heap kicker, two wrecking balls on the demolition block, a mud wallow,
pallets of crates at the roadside), and **Seafront**, a tarmac lap with boost pads along the promenade by the sea, a cut
along the sand round the pier, the harbour's lifting bridge and the old town. Both are in the career's oddball cups.
The stage list (`src/data/stages/index.js` LIST) is append only, versions included, so a stage's number never moves.

**Track versions** (stages 30-35, `src/data/versions.js`): a stage at night or in the rain, made from the stage itself
(`versionOf(stage, 'night' | 'rain')`): same road, seed and set pieces, new light and colours, and the weather element's
options (`core/elements/weather.js`). `wet: 0..1` takes `WET.GRIP` (20%) off the tyres' hold on the road (not on grass,
mud, fords or ice, which are as slick as they get) and lowers the AI's corner speeds to match; `rain` draws streaks and
`night` moonlight, a pool of headlight ahead of every racer and a red glow behind (`render/elements/weather.js`). Which
versions are raced is the `[name, version]` entries of `LIST` in `src/data/stages/index.js` (`VERSIONED`); the career uses them by name ("Ravenrock Gorge in the Rain").

**A car for each stage:** the garage remembers your pick for the selected stage (by stage name, `G.stageCars`), and
the last pick is the default for stages with none yet. The stage list shows each stage's car, the garage tags the
vehicles that suit the stage (off-road stats on gravel and snow, speed and grip on tarmac), and the league screen has a
car button per round.

**Effects and damage** (`src/render/effects/`): particles come in two kinds (`particles.js`): soft, see-through
puffs for smoke, dust, spray and flame (one point sprite each, swelling as they fade, thinned out when the screen is
already busy) and small solid lumps for things with weight (mud clods, oil, embers). A wrecked car breaks apart:
`breakApart` in `pieces.js` throws its real wheels, bumper, wing and lights down the road and the shell drops onto its
belly until it's repaired; `flingPiece` knocks off a single part (a bumper on a big hit, the wheel on a side stove in).
It's meant for a destruction derby too. Dirt builds up on the wheels (thickest there) as well as the body (`dirt.js`).

Catch-up, in both modes: a car tucked in 3-20 m behind another gets a slipstream tow (`PHYS.DRAFT`), and once a
leader pulls clear (35 m, or 8 s holding the crown) leader hazards appear ~3 s ahead of it (`core/features/hazards.js`):
cows ambling across or an oil slick on one side, always behind a warning sign, always with a gap, 6-9 s apart.

Road cars (traffic and parked) are fragile: a racer hitting one at over 11 m/s (`SMASH_V` in `core/sim/collide.js`)
destroys it, launching the scorched shell into a tumble while the racer ploughs through with a little boost.

On phones (portrait or landscape) the left thumb points a steering wheel: the car turns to face, on screen, the way
the thumb points from the wheel's centre (`groundDir` in `core/sim/view.js`). The
right thumb rests on Gas: slide it down to drift, left to brake/reverse, without lifting it (`src/ui/input.js`).
"Steering: Wheel / Arrows" (menu and pause screen, touch devices only) swaps the wheel for left/right arrows;
slide between them without lifting. The choice is remembered. Fire and Door sit right above Gas: slide the Gas thumb
up onto Fire to fire without letting off (`src/ui/input.js`); the Fire button shows what you hold and flashes red on
a missile lock. Phones get a slim standings list (the leader, the car ahead, you).

**Cameras** (C, or the menu / pause buttons; `src/render/camera.js`): the top-down orthographic views Classic,
Overhead, Low and Chase, and perspective views Behind (close behind the car), Follow, Heli, Bonnet and TV (trackside
cameras up the road). Zoom (Close, Near, Normal, Far) scales the view or the distance behind the car. Showdown, Deuce
and Tiebreak judge "off the screen" on the top-down view, so there the perspective views fall back to Chase.

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
| `npm run balance` | Vehicle pace vs the coupe on tarmac and loose stages; seconds each weapon costs its victim per use |
| `npm run dashboard` | The career pacing dashboard (`tools/out/pacing.html`) from `npm run career -- --upg tier --json` |
| `npm run derby -- [arena,...]` | A derby in each arena with the AI at a casual and a good skill: how long, who went out when, who won |
| `npm run ratings` | Measure every vehicle's pace (tarmac, loose) and toughness and how much each stat moves a lap → `src/data/ratings-data.js` (commit it; a test fails when it's stale) |
| `npm run destruct [-- kmh]` | What each vehicle can smash: the speed it breaks each breakable from, and a real run into each at a set speed |
| `npm run career -- [tier] [--car id] [--skill 0.88,0.95] [--v]` | Career pacing: every round of a tier raced by the AI at a casual and a good skill; places, stars, cash |
| `npm run bench -- 5 7` | Render-time benchmark for stages 5 and 7 (software renderer: compare runs, not absolute ms) |
| `npm run assets [ids]` | Builds the Blender assets headless (`blender/`) into `src/assets/gen/`; previews in `blender/out/` |
| `npm run labshot -- [ids]` | Asset Lab pictures, Blender beside Classic per asset → `tools/out/labshot.png` |
| `npm run lab` | The Asset Lab on its own: `dist-lab/index.html` (also `?lab`, `?workshop=cars`, or the Workshop's Cars tab) |

Tool output goes to `tools/out/`.

## How the code is organised

```
index.html              page shell: HUD/menu markup and CSS
src/
  main.js               boot and the frame loop
  game.js               G: state that several modules write (world, state, shake, renderAlpha, ...)
  core/                 THE SIMULATION: pure JS, no three.js, no DOM (runs in Node for the tests)
    math.js constants.js types.js
    track/              road generation (downhill, circuit, gorge), terrain, rails, road queries, obstacles.js
                        (trees, rocks, cacti, bushes: placed here from the stage seed so cars can hit them)
    sim/                car physics, AI, barriers, scenery hits (obstacles.js), damage, collisions, race loop
    elements/           TRACK ELEMENTS: one module per reusable piece of road (bridge, tunnel, kick, gap, boost, town, ...)
    features/           race systems plugged into the race loop: traffic, trains, parked, rockfall, hazards
    modes/              game modes on top of a race (showdown: King of the Hill, Deuce, Tiebreak)
  data/                 stages (one file each), sandboxes (a tiny loop per element), car/traffic definitions, leagues, career
  render/               three.js: renderer & quality, materials/shaders, world (terrain, road, barriers,
                        scenery: draws core's obstacles with world/shapes.js, spectators, houses), elements/ (each element's and feature's visuals), vehicles (racer bodies: carmodels.js, one builder per `model`; paint, glass, chrome and occlusion: carpaint.js; garage pictures: thumbs.js), effects,
                        camera, overlay.js (debug overlay)
  audio/                Web Audio synth (engine, crashes, horns, bells)
  ui/                   HUD, menu/flow (countdown, pause, results), garage, league, career, input, storage
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
| falls | `falls` | scenery waterfall arcing over the road off a cliff on the far side |
| drawbridge | `drawbridge: <s>` | a bascule bridge that rises every so often: jump it while it's low, wait while it's up (cycle in `features/drawbridge.js`) |
| mill | `mill`, `logs` | sawmill shed and log stacks; log piles along the road (scenery) |
| mud | `mud: true`, `mud: 'water'` | a mud bog or a water splash: less grip, more drag, spray from the wheels. Bogs rut as the race goes on: the ruts are firmer but tug at the wheels; cars leaving a bog lay a mud trail (`features/wear.js`) |
| whoops | `whoops: <m>` | a run of rolling bumps |
| yump | `yump: <m>` | a natural dirt crest jump (no painted ramp); `kick` is the painted one |
| dirt | `dirt: true` | a loose dirt track (gravel grip, no kerbs) on any stage; on a branch it's an off-road shortcut |
| breakables | `breach: '<kind>'` on a branch; stage `props: [{ kind, at, lat }]` | a fence, gate, hay, crates or concrete blocks across a shortcut's mouth (only cars heavy and fast enough smash through; the AI knows), or placed on the road |
| hammer | `hammers: <n>` | wrecking balls swinging across the road from gantries (hits in `features/hammers.js`); the AI times its run |
| ice | `ice: true` | an ice patch across the road: hardly any grip; the AI slows for it. Best on a snow stage |
| open | `open: 'field' \| 'forest' \| 'rocks' \| 'stream'`, `gate` | off-piste: a leg with no road (rolling ground, no barriers, no resets for leaving the line) through a meadow, a forest with gaps, a rock garden or a stream; `gate: true` puts a gate at the section's start. See "Off-piste" below |

A core element can declare `tags`, `stageKeys`, per-sample `channels`, a `section()` hook, build phases (`heights`,
`walls`, `wallsLate`, `wallsLast`), `track()` to add fields to the built track, and `markers()` saying where it is (see
the header of `src/core/elements/index.js`). `buildTrack` validates every stage against the registry, so a misspelt
tag or option fails with the list of valid ones, and a section that comes out backwards fails with its index.

### Snow stages

`surface: 'snow'` gives a packed-snow road (grip between gravel and grass; it packs into a firmer line as the race
goes on, like gravel), snow spray and a crust of snow on the cars instead of dust and mud, deep powder off the road, and
snow on the pines. Stage options that suit it: `snowfall: 0..1` (falling snow, off on Graphics: Low) and
`river: { ..., frozen: true }`. See `frostpeak.js`.

### Track wear (every stage)

`core/features/wear.js` gives every road a wear grid (0.5 m cells across, 1 m along) that the wheels wear in as the
race goes on, reset each race: ruts in mud (firmer, but they grab), grooves along the line on gravel (a touch more
grip), a rubbered-in line on tarmac (looks only), and a mud trail behind cars leaving a bog. Every wheel also leaves
fresh tyre tracks where it actually is (curved scuffs when drifting) on gravel, grass verges and mud, from the first
pass; on tarmac, skid marks do that job. `render/elements/wear.js`
draws it over the road; the bogs draw their own ruts. A new surface gets its wear from `WEAR.DIG` and its worn-in
grip from the `FIRM` table there.

### Branches (the road splits and joins again)

A `gorge` stage can add `branches: [{ from, to, name, share, segs }]`: an alternative route that leaves the main road
where main section `from` starts and rejoins it where section `to` starts. Its own `segs` must end exactly there
(position, heading and height, or `buildTrack` says how far off it is). `share` is the chance an AI car takes it.
Elements marked `onBranch` work on a branch (ground, kick, arch, boost, falls, mill, dirt, mud, whoops, yump, ice, breakables); the others throw if tagged there.
The five newest circuits each have an off-road shortcut built this way: a `dirt` branch with whoops, yumps, mud or ice
(Corkscrew Spire's goat track, Scrapyard Smash's crusher yard, Mesa Leap's wash, Glacier Rift's lake crossing, Temple
Ruins' path). Balance it with the AI: a shortcut should save a few seconds at most, and less on a loose-surface car.
The road graph (`src/core/track/route.js`) gives every track the same API: `tr.adv(i, d, alt)` steps along the road,
`tr.progOf(s)` maps a position to race progress, `tr.bi(i)` / `tr.u0(b)` convert between road and base samples, and
`tr.all0` lists every sample for drawing. Where the two roads run side by side the barriers between them open, their
heights meet, and a car belongs to whichever road it's clearly on. Try `?sandbox=branch`.

### Off-piste (open country and gates)

`core/elements/open.js`: a section tagged `open` has no road. Its centre line is only the route progress is measured
along; the ground rolls across it (terrain.js stops flattening for a road over `GATE.RAMP` m), cars drive the ground
itself (`groundAt`), there are no barriers, and the land either side is what the kind says (`track/obstacles.js`
`placeOpen`: forest trees are kept far enough apart that a car always fits between them; rock gardens are a few big
boulders among low rubble you drive over). A dirt trail (`tr.trail`, `TRAIL`) winds through every open leg, kept clear of
trees and boulders and driving like gravel: the flowing line, quicker than cutting across. Hitting scenery is forgiving
everywhere (`sim/obstacles.js` `FLOW`): a glancing touch slides you past with most of your speed, only pine trunks are
solid (their low branches just brush), and only a real head-on hit bounces you and dents the car. Gates (`gate: true`) must be
driven through in order, between the posts (`features/gates.js`): a car's progress stops just short of its next gate
until it takes it, so the standings, laps and finish all wait. With gates on a stage, leaving the road never resets
you (only getting lost, 140 m from the route, or stuck); in open country a reset puts you back where you were last going
well. The AI crosses open country with `sim/nav.js`: a distance field per waypoint (each gate, and each place an open
leg rejoins a road) over a 2 m grid, round trees and boulders and dearer up slopes; it follows the field, slows for
its bends and drives straight through a gate's mouth. `render/elements/open.js` draws the gates, the streams and the
arrow over the player's car pointing to the next gate. Stage 18, Open Country, is the example; `tests/offpiste.test.js`
locks the rules.

### Screenshots

`npm run shot -- <stage|sandbox:name> [metres ...] [--vehicle id] [--debug]` builds the game and saves frames from the
player's seat to `tools/out/`: the player car drives itself to each distance from the start line (default: five
points over a lap). `npm run shot -- garage` shoots the vehicle picker; `npm run shot -- workshop[:tab]` the Workshop.

### The world kit: towns from rules + a style

A stage's `towns: [{ style, at, len, side, steep }]` lays towns out along the road (`src/core/kit/layout.js`, run with
the terrain, so `terr.kit`): a pavement, then plot after plot along the frontage, each with a house at the back facing
the road, a drive in through a gate in the front boundary, a side boundary, a barn or a garden tree; every few plots a
side road closed at the end by something breakable; lamps, bins, benches and postboxes on the pavement. Plots that
would hit a road, a railway, a tunnel or too steep a slope are left out. `src/data/styles.js` holds the styles
(village, alpine, seaside, farm, desert, industrial): colours, roof shapes, plot sizes, what bounds a garden, what
closes a side road, what stands on the pavement. A new style is a new entry; the rules are shared. Everything you can
hit is a breakable (kit kinds in `data/breakables.js`: houses and barns never give way, picket fences snap, stone walls
need a heavy car), so towns join in F3's destruction. Trees and rocks keep out of the plots. `render/elements/kit.js`
draws a town as a handful of instanced batches. Village Green, Harbour Sprint, Hay Bale Farm and Village Descent use it;
the Workshop's Scenery kit tab shows every style.

### Dressing and suspension (looks only)

`src/render/world/dressing.js` scatters ground cover over the land either side of every road: grass tufts, flowers and
pebbles in the stage's colours (dry tufts on dirt, stones only on snow and salt). It also places roadside furniture
behind the barriers every ~30 m: advertising boards, marshal posts with flags, tyre stacks, cones (hay bales and oil
drums on dirt). It skips towns, open country, arenas and water. Everything is from the stage's seed and instanced; the
simulation never sees it, so golden is unchanged. Graphics: Low places a third of the cover.
`suspend()` in `src/render/vehicles.js` gives every wheel its own travel: it follows the ground under it (bumps,
whoops, kickers), hangs down in the air and tucks up on landing (longer travel on soft cars).

### Impact, toughness and breakables

One rule for what breaks: a car's impact is its mass (1 / `im`, times `veh.ram`, an upgrade) times its speed into
the thing (`core/sim/impact.js`). A breakable kind (`src/data/breakables.js`: crates, hay, fence, gate, concrete)
gives way when the impact reaches its `hp`, and only to cars of at least its `minMass`: the coupe bounces off concrete
at any speed, the monster truck goes through from 80 km/h, the mixer from 58. `veh.tough` is the other side: it divides
the damage a car takes. The `breakables` feature (appended to `FEATURES`, no random numbers) treats an intact one as a
solid box, breaks it for the rest of the race when hit hard enough (the car ploughs through, losing speed for how hard
it was), and leaves concrete's blocks on the road as chunks that get shoved about and slow you. Placed by the
`breakables` element: `breach` across a branch where it has pulled clear of the main road (the AI only takes a breached
shortcut once it's down or it can smash it), or stage `props`. `npm run destruct` tables every vehicle against every
kind; Workshop → Destruction yard drives any car into any of them.

### Car anatomy (panels)

Cars come apart panel by panel. `src/data/anatomy.js` lists the panels (bonnet, boot, two doors): the damage zone that
hits each, how hard (`k`), its hinge, and the damage at which it bends, swings open and tears off. The core
(`damageCar`) adds every hit to `c.panels` and puts the steps it crosses on the `dent` event (`e.panels`); physics
still runs on the four zones, so races and golden runs are unchanged. `src/render/anatomy.js` cuts each car's body
shell (its biggest painted, dentable mesh, either provider, both detail levels) along a few planes into those panels,
each a mesh on a hinge, with a dark tub inside the shell for the hole a missing panel leaves. Panels dent, take dirt,
flap when open, tear off as real pieces, swing for a door bash, and go with everything else when a car is wrecked
(it's stripped to the shell). Vehicles with no closed shell are listed in `NO_PANELS`. No per-car work: a new car
gets panels if its body is one painted box (or Blender part).

### Upgrade parts

An upgrade is a part you can see. `src/data/parts.js` has seven slots, three levels each: engine (scoop, side pipes,
supercharger), tyres (wider, then fat; road or gravel kind, swapped free), suspension (lift on long springs, and more
body travel in races), armour (sill, door and nose plates, window mesh), aero (lip, wing, big wing and splitter), ram
bar (nudge bar, bull bar, plough: `veh.ram`, what breaks scenery) and roll cage (hoop, roof bars, lamp pod:
`veh.tough`). Each slot's `fx` multiplies the vehicle's `veh`; `buildVeh` applies a build, the
`{ eng, tyr, ..., tyrKind }` record the career keeps per car (saves from before the parts load unchanged). A race def's
`build` is drawn by `src/render/parts.js`: anchors come from the body itself (a height profile along it, the cabin's
box, the panels), so every car of either provider takes every part, and a part on the bonnet, boot or a door rides on
that panel (it opens and flies off with it). Rivals show the tier's parts (engine, tyres, suspension). In the career
garage a car's upgrades screen is a turntable (`src/render/showcar.js`): a part goes on with the car up on jacks. Try
any part on any car in the Workshop's Cars tab.

### The economy and pacing

Every price and payout is on one sheet, `src/data/economy.js` (curves in `src/data/prices.js`). A car's price comes from
the tier whose showroom sells it and its measured ratings: `CAR_BASE[tier]` × (1 + `PACE_K` × how much quicker than the
coupe it is on its better surface + `TOUGH_K` × how much tougher), so nothing is priced by hand and a new car is priced
when its ratings are measured. Part and weapon levels each cost `COST_GROW` (2.5) times the level before. A car sells
for `RESALE` (60%) of its price and of everything spent on it (parts, weapon levels, gear) from the garage's Sell
button (never the car you're driving or your last). Payouts (place cash, style bonuses, destruction, trophies, medals,
purses) are scaled by the tier's `TIER_PAY`, the format's `FORMAT_PAY` and the prestige level (`PRESTIGE_PAY`).
`npm run career -- --upg tier --json` races every round of every tier with the AI in your seat at a casual (0.88) and a
good (0.95) skill, in the tier's natural car at the tier's upgrade level, and writes `tools/out/career.json`;
`npm run dashboard` turns it into `tools/out/pacing.html`, published as the Career Pacing artifact (https://claude.ai/artifact/VS53tnawm2stAUKFGZDxHn) (places, win rates,
cash after every race, races to the next tier's cheapest car and to a part, your pace against the field), every
figure against its target. `tests/economy.test.js` locks the curves and one target: six Rookie races at a casual
skill buy the cheapest Club car.

### Event formats and scoring

A career event names its `format` (`src/data/formats.js`; none means its kind's: a cup or one-make is a Race, a time
trial a Trial, a boss a Boss, a special its mode). Each format weighs **race** points (10-8-6-5-4-3-2-1 for the
finishing place) against **destruction** points (`DESTRUCT`: a rival wrecked or a panel torn off within 3 s of your hit,
a fence, gate or wall smashed, a road car taken out). A Race has no destruction weight, so its result is the finishing
order; a Banger race, a Demolition rally (smashed scenery worth more) and a Figure of eight re-sort the field by both,
and the career pays for the destruction too (`DESTRUCT_CASH`). `src/data/scoring.js` keeps the tally from car events for
every racer, for the game and for `npm run career`, which now simulates every format, Showdown and checkpoint specials
included; a derby series (`mode: 'derby'` on a cup) is a cup of derbies.

### Disciplines and ratings

Every car has two measured ratings, banded D C B A S (`src/data/ratings.js`): **pace** (% of lap time against the stock
coupe, on tarmac and on loose stages: solo AI laps) and **toughness** (the coupe is 1: damage it deals hitting a parked
car, over damage it takes in that crash and one into the Armco). `npm run ratings` measures them, and also how much a 10%
change in each handling stat moves a lap, which is how a build's parts move its pace; a roll cage and armour scale
its toughness the way the damage code uses them. The numbers live in `src/data/ratings-data.js` with a key of what they
were measured from: change a vehicle's handling, the physics or the damage numbers and `tests/ratings.test.js` asks for
a fresh `npm run ratings`.
Disciplines (`src/data/disciplines.js`) are what a car is for: Road, Rally, Off-road, Heavy and Oddball by vehicle, and
Derby earned by toughness B or better (so a roll cage can get a coupe in). A career event's entry is
`{ disc, maxPace?, maxTough? }`: the discipline, and optional caps on the bands. The garage, the career's cards and the
Workshop's Cars tab show both.

### The Workshop

One place to try any part of the game on its own, without a race or the career around it: the menu's Workshop button,
or `?workshop` (the hub) / `?workshop=<tab>`. Tabs live in `src/data/workshop.js`, the page in `src/ui/workshop.js`.
- **Cars** is the Asset Lab, with every upgrade part to fit (one press per level, or Full build). **Track elements** lists the sandboxes and races one with the debug readout.
- **Crash test** and **Weapons range** are real races on the Workshop loop (two flat straights with Armco) with a panel
  that places the cars: any car into a parked car, an oncoming one or the Armco at a set speed, or any weapon at
  parked dummies or racing rivals, with damage per zone, speeds and slow motion. Add `&car=<id>` to pick the car.
- Test cars use the car's `hold` flag (`true` parked, a number: driven straight at that speed); the race sets no
  other input for them. Nothing else sets it, so races and golden runs are untouched.
- **Destruction yard**: any car into crates, hay, a fence, a gate or concrete blocks (a row of `props` on the loop's far
  straight) at a set speed: what breaks, the speed after, mass and toughness.
- **Scenery kit**: the loop with a town in any style along both straights (`?workshop=kit&style=seaside`): drive or fly
  round it, smash its fences and gates.
- Each roadmap phase adds its tab: a new system gets a Workshop tab, a
  headless tool and a test. The e2e run drives the hub, both live tabs and a sandbox.

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
   with track elements (table above). Optional `river` (with `logs: n` drifting down it) and `rails` add the river and railways. See `src/core/types.js`.
3. Iterate with `npm run layout -- <n>`, `npm run terrain -- <n>` and `npm run sandbox -- <n>` until the plan closes cleanly and nothing
   overlaps by accident, then play it with `npm run dev`.
4. `npm run golden` to record the new stage, then `npm run check`.

In the game, the menu's **Track editor** (`src/ui/editor.js`, geometry in `src/core/track/editing.js`) edits the same
`segs` on a plan view: pick a section, change its length / radius / turn / height / element tags, "Close the loop"
(sets the last corner so the lap turns whole circles, then stretches two straights to land on the start), and
"Test drive" installs it as a temporary stage. "Send to Claude" stores it in the artifact's `tracks` collection.
"Draw my own" starts a blank plan: the Draw tool turns a freehand stroke into straights and curves
(`editing.js` `fromStroke`: simplify, round each corner off with an arc, close it if it ends near its start), and
dragging from the open end carries the track on. The Comment tool pins notes anywhere on the plan, and each section
has a note box; both go to Claude with the track.

## Adding a vehicle

1. A body builder in `src/render/carmodels.js` (`MODELS.<name>`): outline, wheels (`K.wheels`), the damage parts, and
   optionally `anim(v, c, now)` for moving parts. Every `K.box` also gets a rounded close-up version automatically;
   pass other part geometry as `detail => geometry` (`sph`, `cyl`) so it has one too.
2. An entry in `src/data/vehicles.js`: name, blurb, livery, and handling next to the standard car (`accel`, `top`,
   `grip`, `off`, `im`; hitbox `hw`/`hl`). The garage lists it, with its picture and stat bars.
3. An AI rival to drive it in bigger fields: an entry in `MORE_RIVALS` (`src/data/cars.js`; the menu's Rivals setting goes
   up to 3 + that many).
   Put it in its disciplines (`src/data/disciplines.js`) and run `npm run ratings` (commit `src/data/ratings-data.js`).
   Upgrade parts (`src/render/parts.js`) fit any body without per-car work: check a full build in the Workshop's Cars tab.
4. `npm run check`: a test races every vehicle alone on a tarmac and a dirt stage and wants it within 10% of the coupe.

**A car in a family** (the quick way, G6): a car can be built from a shared chassis instead of by hand. `src/data/
families.js` holds the families (`saloon`, `sports`: length, width, deck, nose and tail drop, the glasshouse, wheels,
bumper, wing) and `FAMILY_CARS`, each car the few numbers it changes plus named extras (a taxi sign, a roof box, a
light pod, spare tyres in a load bed, a cage, armour plates, mud flaps, side pipes, an open cockpit with the driver).
The Classic body is `src/render/families.js`, the Blender one `blender/chassis.py`, both from the same numbers
(`tools/assets.sh` hands them to Blender as JSON), so a new family car is: its `FAMILY_CARS` entry, its garage line
in `src/data/vehicles.js` (model = its id), steps 3 and 4 above, then `npm run assets -- car-<id>` and a look in the
Asset Lab (`npm run labshot -- <id>`: Blender beside Classic). A new extra goes in both builders. The first wave: City
Cab, Rally Estate, Ranch Pickup and Banger (saloon), GT Racer and Roadster (sports).

## Blender assets (the asset lab)

Every visual asset can come from two providers: the **Classic** builders (code: `render/carmodels.js`,
`render/world/shapes.js`, ...) and **Blender**. The menu's Models setting picks Blender, Classic, or Auto (Blender
unless Graphics is on Low); Classic always stays as the fallback and the light option.

```
blender/          the lab: Python run by headless Blender (the `bpy` module; `npm run assets` installs it)
  kit.py          shared modelling kit (loft, superellipse sections, rounded boxes, booleans, decals by ray-cast,
                  palette materials) and the packer; previews (Cycles) to blender/out/
  cars.py         car designs (DESIGNS: one function per model, all 19) and finish(): far level, roles for the game
  scenery.py      instanced scenery (scn-*): pines (+ snow), broadleaf trees, bushes, rocks, cacti, country houses,
                  spectators; several shapes each (parts crown0, crown1...), shading and details in vertex colours
  pieces.py       kit pieces (kit-*): tunnel portals (fitted to the bore), bridge/viaduct pier shafts and caps, gate
                  posts and pennants, street lamps, barrier pieces (tyre, post, armco rail, hay bale)
  build.py        builds designs, writes src/assets/gen/<id>.js, index.js and manifest.json
src/assets/gen/   GENERATED packs (committed so the game builds without Blender)
src/render/assets/index.js   registry: blenderPack(id) (null = use Classic), decodePack, the Models setting
src/render/assets/cars.js    a racer from its pack: parts, damage hooks, wheels, RIGS for moving parts
src/render/assets/scenery.js scenery and kit geometries for instancing (sceneryPack / kitPack; each user keeps its Classic shape)
src/ui/lab.js     the Asset Lab page (the Workshop's Cars tab)
```

- **A pack** is shapes only: named parts, one mesh per palette material (`paint` and `accent` take the livery), two
  levels of detail (`hi` near, `lo` far), each part stored relative to its **pivot** (`at`: the object's `pivot`
  property in Blender, else its middle), so the game can knock, swing or spin it about the right point. Positions are
  int16 (1/8000 m), normals int8, base64. `meta` names the roles: for a car `wheels` `[x, z, r, width]`, `dent`
  (parts that dent), `bumper`, `wing`, `struts`, `cabin` (its glass cracks), `number` `[size, y, z]`, `knobbly`, `hub`, `soft`.
- **Behaviour stays in code.** Damage, collisions and animation are the game's; moving parts are animated by a rig
  (`RIGS[model]` in `render/assets/cars.js`) that finds them by name, like the Classic builders' `anim` (the police
  lights, the ice-cream cone, the mixer's drum, the sidecar passenger...). Effects stay code too (the rocket's flame).
  Wheels are the game's own (`K.wheels`, from `meta.wheels`). Authored
  loops (keyframes) are baked to data and played by the game.
- **Scenery** keeps the game's placement, tints, sway and hits: a pack only replaces the shape. Its parts sit at the
  model's origin (`pack(..., origin=True)`), carry their shading in vertex colours that the instance colour multiplies,
  and come in variants the game deals out by obstacle index. Houses are modelled at `meta.size` and scaled to their
  plot. The village streets (`elements/town.js`) stay procedural: they are laid out plot by plot.
- **Kit pieces** work the same way: `render/elements/tunnel.js` (portals), `bridge.js` (piers: a shaft scaled to each,
  a cap on top), `open.js` (gates), `town.js` (lamps) and `world/barriers.js` ask `kitPack(id)` and keep their Classic
  shapes without it. Track-shaped things (road, decks, bores, headwalls) stay procedural.
- **Baked occlusion:** every pack's vertex colours carry ambient occlusion baked by Cycles (`kit.bake_ao`, one value per
  vertex so the packer still welds; a car's preview wheels shade its arches; a model's variants bake apart). The game
  skips its own height-based occlusion for a part that has colours.
- **Near-only detail:** car parts named `mirror*` (wing mirrors) have no far version: `meta.near` lists them and the
  game shows them with the close-up bodies only.
- **Authored loops:** `kit.wave_loop(o, n, f, fps)` keys n poses on Blender's timeline (shape keys); the packer samples
  them into the part's `frames`, the decoder turns them into morph targets and `playLoop(mesh, t)` plays them (the
  gate pennants; the limo's flag, faster with speed). Loops live on the near level only, so a looping part uses it at
  any distance. Keep looping parts small: Blender can't decimate a mesh with shape keys.
- Game axes: x right, y up, z forward (+z is the front). Blender is Z-up: `kit.B(x, y, z)` converts.
- `tests/assets.test.js` holds the contract: every manifest entry is bundled, decodes, has both levels with matching
  part names, fits its triangle/size budget and, for a car, fits its hitbox and names its damage parts. The e2e run
  opens the lab and builds every asset with each provider.
- **The Asset Lab** (`?lab`, the Workshop's Cars tab, or `npm run lab` for a page of its own): every asset on a
  turntable, Blender vs Classic, near/far, wireframe, triangles and draw calls, any stage's light, studio or race
  view, paint colour; cars can be dented, lose bumper and wing, have their panels bent, opened and taken off, and be repaired. Its notes go to the artifact's
  database, collection `assetNotes` (`asset`, `provider`, `text`; answer with `reply` + `status: 'done'`).
- Adding one: a design in `blender/<family>.py`, `npm run assets -- <id>`, look at `blender/out/<id>-34.png` and in the
  lab, then the game-side builder picks it up by id. See the `/blender` skill.

## Adding a race feature (a new hazard or system)

1. **Simulation:** `src/core/features/<name>.js` exporting a `feature` object with any of
   `init(R, W)`, `vehicles(R)`, `move(R, W, dt, all, racing)`, `spawn(R, W, dt)`, `after(R, W, dt)`;
   add it to the end of `FEATURES` in `core/features/index.js`. Push events onto cars for effects.
2. **Visuals:** `src/render/elements/<name>.js` and an entry in `RENDER_ELEMENTS` (`src/render/elements/index.js`)
   with any of `init()`, `build(group, tr, terr, stage)`, `newRace(r)`, `update(dt, now, fxDt)`.
3. **Stage data:** switch it on from the stage (a tag, a list, a flag).
4. Add a scenario to `tests/scenarios.js` if it has rules worth locking down.

## Publishing

`npm run build` makes `dist/index.html`, one file with everything inlined (the e2e and the tools use it). An artifact page
has a size limit (about 4.7 MB) that the Blender packs outgrow, so `node tools/split.mjs dist` moves the script out to
`dist/publish/game.js` beside `dist/publish/index.html`, and both are published (the page with `game.js` as a supporting
file). `dist/` is not committed.
