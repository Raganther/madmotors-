---
name: new-vehicle
description: Add a new player vehicle to the Downhill Rush garage (3D body model, livery, handling stats, balance check, garage picture). Use when the user asks for new cars, trucks, karts or any vehicle to drive.
argument-hint: <vehicle idea(s)>
---

# New vehicle

Read README "Adding a vehicle". A vehicle is a body builder (`MODELS.<name>` in `src/render/carmodels.js`) plus a
data entry (`src/data/vehicles.js`). The rest (garage card, picture, stat bars, race line-up) follows automatically.

**Faster: a family car.** If it's a variation on a shape we have (a saloon, a sports car), add it to a family in
`src/data/families.js` instead of writing a builder: both providers draw it from the chassis numbers (README "A car
in a family"). Write a builder only for a shape no family covers, or start a new family.

## 1. Character first
One line each: what it is, what it's good at, what it's bad at, and the one visual detail that makes it
recognisable from the top-down camera at speed (silhouette and colour, not small parts). It should not overlap an
existing vehicle's role (list: `src/data/vehicles.js`).

## 2. Body (`src/render/carmodels.js`)
- Copy the closest existing builder and follow the kit it uses: outline, `K.wheels`, the damage parts every model
  provides, materials from `carMat(kind, color)` (`paint`, `glass`, `chrome`, `rubber`, `trim`; `render/carpaint.js`),
  and `bakeAO` on the body geometry. Livery comes from the entry's `color` / `accent`.
- **Anatomy (panels):** the body's biggest painted dentable panel (an unrotated `K.panel`, at least 2.2 m long and
  1.2 m wide) is its shell: `render/anatomy.js` cuts it into a bonnet, a boot and two doors on hinges by itself, and
  core damage bends, opens and tears them off (`data/anatomy.js`). So make the main body ONE painted box covering
  the car, not a stack of slabs, and keep it unrotated. A vehicle with no closed shell (open wheels, a frame) goes in
  `NO_PANELS`; the e2e run fails if a car gets panels it shouldn't, or none when it should. Check them in the Workshop:
  Cars tab, "Panels" button (bend, open, off), and the Crash test.
- **Insides (the reference: Rally Hatch and Muscle Coupe).** Every car with panels must open onto something: an engine
  under one lid, a front boot or a luggage bay under the other, seats, a dash and a wheel behind the doors.
  `render/anatomy.js` draws all of it from the shell, so the work is: say where the engine is (`ENGINE` in
  `src/data/anatomy.js`, by model: front is the default; a mid-engined supercar or racer is `mid`, an engine over the
  back axle `rear`), list an open cockpit that draws its own seats in `OPEN_COCKPIT`, and make sure the shell is deep
  enough under each lid (the engine shrinks to fit, then turns into a flat engine; a lid lying on the floor leaves
  the bay bare). Check with `npm run bays -- <id> --shots <dir>` and look at the pictures beside `hatch` and `coupe`:
  nothing poking through a shut lid, no bay showing the road, the engine at the right end. The e2e fails a car with
  panels and no engine.
- **The full set, as on the hatch and the coupe:** panels that bend, open and tear off; an engine, a boot and seats under
  them; a `bumper`, `wing` and `struts` that knock loose; `heads` and `tails` that light and break; dents and dirt on
  the shell; upgrade parts that sit on the body; and all of it on both providers (a Blender pack for the body, the
  Classic builder kept working). Check each in the Workshop Cars tab and the Asset Lab with Blender and Classic.
- **Upgrade parts** (`render/parts.js`) mount from the body's own shape: the tallest point along it (bonnet, boot),
  its widest (sills, ram bar), the cabin's box (roll cage) and the panels. Check a Full build in the Workshop Cars tab
  (both providers): a part floating clear of the body or buried in it means the body's top or cabin is unusual.
- Moving parts (spinning props, flashing lights, bobbing antennas) go in `anim(v, c, now)`; keep it cheap.
- **Weight and toughness:** `im` (1 / weight) also sets what it can smash (mass x speed, `core/sim/impact.js`) and
  `tough` divides the damage it takes. Run `npm run destruct` and check it lands where its role says (a truck through
  concrete, a kart not through a gate).
- Size to the hitbox: if the body is much wider or longer than the standard car, set `hw` / `hl` on the entry.

## 3. Handling (`src/data/vehicles.js`)
- `veh: { accel, top, grip, off, im }` next to the standard car (1 = standard; `im` = 1 / weight). Strengths are
  paid for elsewhere: rough rule, the multipliers' product stays near 1 and anything above 1.15 has a clear weakness.
- `npm test`: a test races every vehicle alone on a tarmac and a dirt stage and wants lap times within 10% of the
  coupe with no respawn. If it fails, tune the stats, not the test.

Put it in its disciplines (`src/data/disciplines.js`: Road, Rally, Off-road, Heavy, Oddball; Derby comes from its
toughness) and run `npm run ratings`, then commit `src/data/ratings-data.js` (tests/ratings.test.js fails until you do).

Give it an AI driver: an entry at the end of `MORE_RIVALS` in `src/data/cars.js` (name, number, skill), so a full
field (Rivals at max) has one of every vehicle; the full-field test checks that.

## 4. Look at it
- `npm run shot -- <stage> --vehicle <id>` on a tarmac and a dirt stage: readable from the race camera? Damage and
  dirt show? Wheels on the ground?
- The garage: `npm run shot -- garage` (top and bottom of the list, once every picture is drawn). A blank or
  missing picture means something throws or is too slow in `render/thumbs.js`.
- `npm run e2e` races every vehicle.

## 5. Ship
Adding a vehicle changes no stage's golden run (rivals keep their cars); if golden changes, find out why. `/ship`,
sending a garage screenshot and one in-race shot per new vehicle.

## Traps
- The insides are sized from the shell, not authored, so a body that looks fine shut can open onto nothing: a wedge
  nose with no depth, a mid-engined car showing a V8 under its front bonnet. `npm run bays` after every body change
  (all of them: it takes a few minutes), not just the new car's.
- A bigger garage means a bigger full field (Rivals at max): tests/elements.test.js and the e2e count it, and the grid
  must fit before the start line (core/sim/race.js gridSlots closes the rows up past five).
- The Asset Lab lists cars by vehicle id (`npm run labshot -- taxi`), not by pack id (`car-taxi`).
- A family car's Blender pack must stay inside the car budget (tests/assets.test.js): busy extras (spare tyres) want
  few vertices.
- A body may have no wing (or bumper): render code that knocks parts about must check for them (render/vehicles.js
  updateCarDamageVis). Unit tests don't build meshes; the e2e's Elite race and a damaged full field catch it.
