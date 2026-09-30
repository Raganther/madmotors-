---
name: blender
description: Make or change a Downhill Rush asset in Blender (a car body, tree, rock, house, spectator or kit piece) through the headless Blender lab, pack it for the game and check it in the Asset Lab. Use for "model X in Blender", "make the trees Blender", "the Blender hatch looks wrong".
argument-hint: <asset and what it should look like>
---

# Blender assets

Read README "Blender assets". The lab is Python run by headless Blender (`pip install bpy`, Python 3.11; `npm run
assets` installs it). Assets are shapes and named parts only; behaviour stays in the game's code.

## 1. Design
- Look at the Classic version first (Asset Lab `?lab`, or `npm run shot -- garage`) and keep what makes it readable
  from the race camera: silhouette and colour blocks, not small details.
- Keep the game's contract: for a car the same wheel positions and radius as its Classic builder, inside the hitbox
  (`hw`/`hl` in data/vehicles.js, default 1.0 x 1.78), the same damage parts (a front bumper, a rear wing or whatever
  falls off the back, lamps, tails, cabin glass) and any part its animation moves.

## 2. Build
1. A design function in `blender/<family>.py` (`@design`), using `kit.py` (loft/superellipse bodies, `rbox`, `cyl`,
   `cut` for booleans, `by_faces` to paint faces, `stripes` decals) and palette materials only (`kit.PALETTE`).
   Name parts for their role; set `o['pivot'] = (x, y, z)` (game coords) on a part that swings or spins about a
   hinge or axle; otherwise its pivot is its middle.
2. `finish(...)` with roles (cars) or `pack(...)` directly; a far level (`lo`) of about a third the triangles.
3. `npm run assets -- <id>` → read `blender/out/<id>-34.png` and `-top.png`. Budgets (tests/assets.test.js): a car
   ≤ 9000 near / 4500 far triangles, ≤ 260 KB.
4. Moving parts: a rig in `RIGS` (render/assets/cars.js) taking the parts by name, copying what the Classic `anim` does.

## 3. Check (not done before all of these)
- `npx vitest run tests/assets.test.js` (the contract), `npm run labshot -- <ids>`, then the Asset Lab (`npm run build`, open
  `dist/index.html?lab`): Blender vs Classic, near and far, wireframe, dent / knock bumper / knock wing / repair,
  race view. Screenshot it with playwright and look.
- In a race: `npm run shot -- <stage> --vehicle <id>` and `npm run shot -- garage`.
- Cost: `npm run bench -- <n>` with a full field, Blender vs Classic (Models setting) when adding many assets.
- `npm run check`, `npm run e2e` (it builds every asset in the lab with each provider), then `/ship`.

## Traps we've hit
- Parts must carry a pivot: a Blender part at the car's origin knocked "off" by rotating it swung the whole bumper away.
- Far copies are separate objects: Blender renames duplicates (`body.001`), so a far part carries `o['part']` = its
  near part's name; the contract test checks the names match.
- Painting stripes by face then decimating makes jagged edges: stripes are ray-cast decals on the finished body.
- Decimate after booleans/subdivision, never before; keep the far level from `lo_copy` (small parts stay as they are).
- Blender is Z-up, the game Y-up with +z forward: always go through `kit.B` / `kit.G`.
- Part names must be unique: Blender silently renames a duplicate (`lamp0.001`) and the meta would miss it; the packer
  now fails the build instead. Helpers that make several parts (`lamps`, `tails`, `rects`) take a `name`.
- Colouring faces with `by_faces` on a face a boolean cut (arches) splits into a fan of triangles gives a ragged
  patch: model a separate thin panel instead (the fire engine's lockers), or colour before the cut on a mesh with rows.
- Loft normals can face in: face rules test `abs(n[1])`, not `n[1]`.
- A new palette name needs a game colour (`HD_COL`) and, if it is a painted surface, `HD_KIND` in render/carmodels.js,
  or it renders as dark satin trim.
- `tests/assets.test.js` catches parts outside the hitbox (+0.35 m) and a cabin without glass: fix the design (move
  the part in, add a screen), not the tolerance.
- `npm run labshot -- <ids>` (tools/out/labshot.png) puts Blender beside Classic for each asset: read it every round.
- Cost so far: all 19 cars on a full field bench the same as Classic; the page grew ~2.6 MB (packs are base64 in the bundle).
  Scenery is instanced in hundreds: the near level cost 12-20% frame time on forest and village stages, so the game
  instances the far level unless Graphics is High. Bench `MODELS=classic` vs `blender` on stages 2, 4 and 18.
- Vertex colours over 1.0 wrapped round in a byte (black and purple patches): the packer clamps them now; keep shade
  functions in 0..1 anyway.
- A design function named like a builtin (`round`) shadows it for the whole module: name designs for what they are.
- Scenery taller than 4 m needs `q=4000` (the position step) in `pack`; the pack records it for the decoder.
- Snow, moss or anything lying on a surface must sit outside it: check the lab and a race shot, not just the numbers.
- `Object3D.clone()` copies `userData` through JSON: re-attach geometry references (the LOD pair) on a clone.
- Stripes and bands smear when chosen per vertex on shared edges: `vcol(o, f, per_face=True)`, or build the thing from
  separate pieces each with its own colour (the gate post is ten stacked bands).
- Anything placed in hundreds (barrier tyres and posts, spectators) must stay light: the first tyre (20x8 torus) cost
  Ravenrock ~10% frame time; 14x6 and 1-segment bevels brought it back to Classic's.
- A piece the game rotates itself (the gate pennant: a quarter turn) must be modelled in the Classic shape's plane.
- Kit/scenery parts all sit at the origin; give the pack `meta.lab` offsets so the Asset Lab lays them out.
- Baked AO per corner split every smooth vertex and doubled the packs: `bake_ao` averages it per vertex and rounds it.
  Parts that overlap at the origin (variants, a gate post and its pennant) must bake in separate groups.
- Loops (`wave_loop`) exist on the near level only: the instanced-scenery path picks the far level, so it has to take
  the near one for a looping part, and a car's looping part keeps its near geometry far off too.
- `window.__dr.step()` passes `now = 0` to car rigs: to test a rig's motion, call `v.anim(v, car, t)` with real times.
