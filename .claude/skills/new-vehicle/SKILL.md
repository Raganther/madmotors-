---
name: new-vehicle
description: Add a new player vehicle to the Downhill Rush garage (3D body model, livery, handling stats, balance check, garage picture). Use when the user asks for new cars, trucks, karts or any vehicle to drive.
argument-hint: <vehicle idea(s)>
---

# New vehicle

Read README "Adding a vehicle". A vehicle is a body builder (`MODELS.<name>` in `src/render/carmodels.js`) plus a
data entry (`src/data/vehicles.js`). The rest (garage card, picture, stat bars, race line-up) follows automatically.

## 1. Character first
One line each: what it is, what it's good at, what it's bad at, and the one visual detail that makes it
recognisable from the top-down camera at speed (silhouette and colour, not small parts). It should not overlap an
existing vehicle's role (list: `src/data/vehicles.js`).

## 2. Body (`src/render/carmodels.js`)
- Copy the closest existing builder and follow the kit it uses: outline, `K.wheels`, the damage parts every model
  provides, materials from `carMat(kind, color)` (`paint`, `glass`, `chrome`, `rubber`, `trim`; `render/carpaint.js`),
  and `bakeAO` on the body geometry. Livery comes from the entry's `color` / `accent`.
- Moving parts (spinning props, flashing lights, bobbing antennas) go in `anim(v, c, now)`; keep it cheap.
- Size to the hitbox: if the body is much wider or longer than the standard car, set `hw` / `hl` on the entry.

## 3. Handling (`src/data/vehicles.js`)
- `veh: { accel, top, grip, off, im }` next to the standard car (1 = standard; `im` = 1 / weight). Strengths are
  paid for elsewhere: rough rule, the multipliers' product stays near 1 and anything above 1.15 has a clear weakness.
- `npm test`: a test races every vehicle alone on a tarmac and a dirt stage and wants lap times within 10% of the
  coupe with no respawn. If it fails, tune the stats, not the test.

## 4. Look at it
- `npm run shot -- <stage> --vehicle <id>` on a tarmac and a dirt stage: readable from the race camera? Damage and
  dirt show? Wheels on the ground?
- The garage: `npm run shot -- garage` (top and bottom of the list, once every picture is drawn). A blank or
  missing picture means something throws or is too slow in `render/thumbs.js`.
- `npm run e2e` races every vehicle.

## 5. Ship
Adding a vehicle changes no stage's golden run (rivals keep their cars); if golden changes, find out why. `/ship`,
sending a garage screenshot and one in-race shot per new vehicle.
