# Track design: the vision

A working document. We collect ideas here before we build, so every new track (and every rework of an old one) starts
from a fleshed-out picture of what it is, what happens on it and why it's fun. Add to it freely; nothing here is
built until a track's page is agreed.

## 1. Where we are

We've spent most of our effort on things every track shares: handling, cars, weapons, damage, weather, wear, the
water. The tracks themselves haven't had the same attention, and it shows:

- **A road with things on it, not a place.** Most stages are a ribbon of road through a landscape (meadow, forest,
  mesa, snow), with elements dropped along it: a kicker here, a tunnel there. You rarely feel you're racing *through*
  somewhere: a temple, a harbour, a town.
- **Few signature moments.** A good lap has two or three moments you remember and look forward to (the leap, the
  collapsing bridge, the drive through the market). Many of ours have one, or none.
- **Not much moves.** Swinging wrecking balls, the drawbridge, the ferry and trains exist, but most tracks are still.
- **Destruction is barely used.** We have destructible buildings in four materials (timber, brick, stone,
  concrete), with holes shaped like the car, furniture inside and roofs that fall in, plus breakable fences, gates,
  crates and concrete chicanes. Only Wrecking Row and Demolition Yard use buildings, and no track is *designed around*
  smashing through things.
- **The themes repeat.** Lots of grass, rock and tarmac. Nothing like Egypt, a jungle, a boardwalk or a dockyard.

**Measured** (`npm run report`, 2026-10-28; the same card is in the Track viewer): of 39 race stages, five meet six
of the seven measurable pillars (Wrecking Row, Village Hill, Building Site, Old Town GP and its night version) and
three meet none (Salt Flats and its night version, Sunday Park). The commonest misses: nothing that moves (28
stages), nothing to smash (26), a quiet stretch of more than 15 s (25), fewer than three moments of two kinds (20)
and no route choice (19). The mountain stages (Mountain Pass, Mountain Loop, Pine Forest) go 36-61 s with nothing
but corners.

Games like Micro Machines and the phone "Mini Motors"-style racers work because each track is a *themed playground*:
a pyramid you drive up the side of, boarded bridges over a jungle river, a pier over the sea. That's the bar.

## 2. Pillars: what every track must have

1. **A place with a story.** One theme, said in a sentence ("a jungle temple being swallowed by the river"), and
   everything on the track belongs to it.
2. **Three signature moments a lap.** Big, readable from the top-down camera, each different in kind: a jump, a
   piece of destruction, a hazard that moves, a route choice.
3. **Rhythm.** Fast-slow-fast. Flowing sections, then a technical one, then a payoff. No long stretches where nothing
   happens.
4. **Choices.** At least one risk/reward split per lap: a shortcut that's quicker but harder, or only open to some
   cars (heavy ones smash through, light ones squeeze round).
5. **The lap changes.** What happens on lap 1 shapes lap 3: walls knocked down stay down, bridges wear through, ruts
   deepen, the line dries in the rain. Racing the same track should feel different by the end.
6. **Readable from above.** Corners visible early, the racing line clear, landmarks to know where you are, colour
   contrast between road, edges and hazards. Big moments framed for the camera.
7. **Built from the kit.** Reuse elements first (README table); a new element only when a theme truly needs one, and
   then it goes back into the kit for every track.

## 3. Destruction: designing around it

Destruction shouldn't be scenery that happens to break; it should be a *route-maker* and a *weapon*. Patterns:

- **The breach.** A building (or wall) blocks the shortest line. Heavy or fast cars smash a hole through it; once
  it's open it stays open for everyone, for the rest of the race. Lap 1 is a gamble, lap 3 is a highway.
- **The collapse.** A structure that comes down after enough hits (or a weapon) and lands *across* the road, turning
  a fast line into rubble to weave through, or forcing the field onto the other route.
- **The topple.** Tall things (a water tower, a chimney, an obelisk, a crane) that fall when hit at the base,
  dropping across the track in a set direction. A trap you spring on the cars behind.
- **The smash lane.** A row of soft targets (market stalls, crates, fences, hay) along a stretch: hitting them
  costs a little speed but scores in career destruction events and throws debris at the cars behind.
- **Weapon targets.** Structures placed so a mortar or missile can bring them down in front of a rival: a weapon
  that changes the track, not just hits a car.
- **The arena.** Demolition Yard's idea scaled up: a whole town to flatten, for score.

Questions this raises for the tech: should destruction persist between laps everywhere (it does today), how much
rubble the cars can push, and whether the AI should learn which breaches are open (it already handles breakable
shortcut mouths).

## 4. Theme bank

Each theme with the set pieces it suggests. **Existing** marks a kit element we already have; **new** marks something
we'd need to build.

### Pyramids (Egypt)
Sand, sandstone, palms, a river with feluccas.
- Drive *up* the side of a pyramid on a ramp and leap off the top (kick, ground ramps: existing; pyramid shape: new
  scenery).
- A tomb tunnel through the pyramid whose roof collapses after a few laps (tunnel: existing; collapse: new).
- An obelisk that topples across the road when hit (topple: new).
- A bazaar street of stalls and awnings to smash through (stall buildings, breakables: existing).
- Ferry across the Nile (ferry: existing).

### Jungle temple
Dense trees, a brown river, vines, stone ruins being reclaimed.
- Rope-and-plank bridges that sag and break plank by plank (crumble: existing; sag and rope look: new).
- A waterfall the road runs behind (falls: existing, reworked).
- A temple you drive through, its stone pillars breakable by heavy cars (stone buildings: existing; pillars: new).
- River fords and mud (mud, water splash: existing).
- Rolling-boulder trap (rockfall: existing, reworked to roll down a ramp).

### Boardwalk and pier
A seaside town, a long wooden pier, a fairground.
- Boarded track over the sea on stilts, with gaps between sections to jump (gap, kick: existing; boardwalk deck:
  new).
- A pier end that collapses into the sea on the last lap (crumble: existing, bigger).
- Through the fairground: under a rollercoaster, round the dodgems, past a Ferris wheel that turns (scenery: new).
- Beach-hut smash lane (sheds: existing).

### Dockyard
Containers, cranes, ships, a swing bridge.
- Stacked containers to weave through or smash (new: container breakables, stacks that topple).
- Gantry cranes swinging a load across the road (hammers: existing, reskinned).
- A swing or bascule bridge between quays (drawbridge: existing).
- A route through a warehouse (warehouse building: existing).

### Wild West
A frontier town, a canyon, a mine.
- Main street: drive through the saloon (in the front, out the back), past the water tower you can topple.
- Mine tunnel with cart rails and timber supports that give way (tunnel, rails: existing; supports: new).
- Canyon leaps and a rope bridge (gap, crumble: existing).

### Building site
Half-built towers, scaffolding, cranes, mud.
- Drive up ramps onto an unfinished floor and drop off the edge.
- Scaffolding that collapses when hit (new).
- Concrete chicanes, mud, dumper trucks (chicane, mud: existing; moving dumpers: new).

### Castle and siege
A medieval town, a castle on a hill, a moat.
- Drawbridge over the moat (drawbridge: existing).
- Breach the castle wall in something heavy for a shortcut through the courtyard (stone walls: existing).
- Market square with stalls; a catapult flinging rocks onto the road (rockfall: existing, reskinned).

### Volcano
Black rock, lava, ash.
- Lava channels that flow across the road on a cycle (new: timed hazard, like the drawbridge).
- Rockfall from the crater (existing).
- Jumps over lava gaps (gap: existing).

More to think about: a frozen lake with ice that cracks; suburbia (gardens, fences, swimming pools); a factory or
steelworks; an airport (runway sprint, through a hangar); rooftops; a haunted village at night.

## 5. How we design tracks together

A loop that's quick to go round, so we can try ideas instead of arguing about them:

1. **Look.** Open the track in the **Track viewer** (menu, or "View in 3D" from the Track editor and the Terrain
   builder): fly round it, fly the lap at race speed, or let the cars race it and ride along. Its report card sits
   beside it: lap time, flat-out share, corners, the numbered moments, and the pillars it meets or misses.
2. **Say.** Tap Note and drop notes on the spots that need changing ("a jump here", "this straight is dull", "a
   shortcut through this barn"); they land with Claude with a picture of the view. Bigger ideas go on the Sketch pad;
   a whole new layout in the Track editor or the Terrain builder (Send to Claude).
3. **Change.** Claude answers each note, changes the track, and checks the card (`npm run report -- <stage>`): the
   misses it was asked to fix should turn to passes.
4. **Look again.** The published game has the new version; the notes turn green with Claude's reply.

The card measures what can be measured. Whether a track is a *place*, whether it reads from above and whether it's
fun are for us to judge in the viewer and by driving it.

## 6. A track's page (the template)

Every new track gets a page in this document, filled in and agreed before we build.

- **Name and one-line story.**
- **Theme and mood:** five words, colours, time of day, weather.
- **Type:** circuit (laps, target lap time 45 to 90 s) or downhill run.
- **The lap in acts:** 3 or 4 sections, what each feels like (fast, technical, payoff).
- **Signature moments:** the three, and which kit elements (existing or new) make them.
- **Routes:** each split, what it rewards and who it suits (heavy, light, grippy, quick).
- **Destruction plan:** what breaks, which pattern (breach, collapse, topple, smash lane), and how it changes later
  laps.
- **Surfaces and weather:** tarmac, dirt, mud, snow; any rain or night version.
- **Cars it favours:** which classes and why; where it sits in career tiers.
- **Sketch:** a plan drawn in the Track editor or the Sketch pad (they land with Claude), or described.
- **Report card target:** the pillars it must pass (`npm run report`), and the lap time it aims for.
- **New things to build:** elements, scenery, sounds.

## 7. First candidates

Three to prototype first, each showing off something different:

1. **Pyramid Run** (desert circuit): the pyramid ramp leap, the tomb tunnel that caves in, the bazaar smash lane.
   It shows the "place, not a road" idea and needs one big new piece of scenery.
2. **Jungle Crossing** (rally, dirt and mud): plank bridges wearing through, the river, the temple breach. It builds
   on systems we have (crumble, mud, ruts, water) and the rain version would be brutal.
3. **Dockside Dash** (tarmac circuit): containers to smash and topple, swinging crane loads, a swing bridge. It's the
   destruction showcase.

We could also rework a few existing tracks along these lines (Village Descent could become a town you drive
*through*; Scrapyard Smash could gain topples and collapses).

## 8. Questions to settle together

- Which themes excite you most? Rank them, or add your own.
- How long should a lap be? Shorter and busier (45 s) or longer with more variety (90 s)?
- How destructive should the default race be? Should every track have at least one breach or collapse, or keep
  destruction for some tracks?
- Should destruction persist across laps everywhere, or reset per lap on some tracks?
- Downhill runs: keep them, rework them into point-to-point stages with these themes, or drop them?
- How far should each track lean into one car type (a rally stage for rally cars, a big-truck stage), versus being
  fair for everyone?
- Do you want night and rain versions of the new tracks from the start?
- Any reference tracks or games you'd like us to look at (screenshots welcome through the Sketch pad)?
