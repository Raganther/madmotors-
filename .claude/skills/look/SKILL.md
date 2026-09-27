---
name: look
description: Change how Downhill Rush looks (materials, shaders, colours, textures, lighting, effects, car bodies) and prove it with before/after screenshots and the render benchmark. Use for any visual tweak or graphics request, e.g. "the ground looks too blotchy", "cars look flat".
---

# Visual changes

Visual work is judged by eye, so the loop is: screenshot → change → screenshot the same spots → compare.

1. **Find the spots that show the problem**, with `npm run shot -- <stage> [metres ...] [--vehicle id]`
   (from the start line; 5 points over a lap by default; `--debug` adds the overlay). Pick 2-3 stages
   with different surfaces: tarmac (Summit Meadow 1, Ravenrock 7), gravel/dirt (Quarry Run 3, Bogwood 10), desert
   (Red Mesa 8). Copy the "before" PNGs out of `tools/out/` (it's overwritten each run).
2. **Find where it's drawn.** Map in README "How the code is organised". Common homes:
   - shared shader hooks: `src/render/materials.js` (`withCutaway` options: cut, cloud, grain, water; uniforms in `FX`)
   - ground `render/world/terrain.js`, road `render/world/road.js`, car bodies `render/carmodels.js` +
     `render/carpaint.js`, traffic `render/vehicles.js`, garage pictures `render/thumbs.js`, quality `render/renderer.js`
   - element visuals `src/render/elements/<name>.js`; track wear `render/elements/wear.js`
3. **Change as little as possible**, one knob at a time, and prefer a shared hook over per-object hacks. Anything
   costly must turn off on Graphics: Low (`applyQuality` in `render/renderer.js`).
4. **Same shots again**, view before and after side by side (Read the PNGs), and judge honestly: better, and not
   worse anywhere else (check a stage you didn't target too).
5. **Cost:** `npm run bench -- <n>` before and after on one busy stage. SwiftShader numbers are only comparable
   with each other; state the % change. More than ~10% needs a reason, or a Low-quality off switch.
6. Rendering-only work must leave golden unchanged. Then `/ship`, sending the before/after screenshots.

## Traps we've hit
- Anything expensive built per call (PMREM environments, render targets, canvases) must be cached; rebuilding it per
  garage picture timed the page out.
- Strong direct light on shiny paint washes car tops white: keep paint roughness around 0.6.
- Specular highlights (Phong `specular`, low roughness) on a flat, level surface flood the whole patch white: the
  camera is orthographic, so every point sees the sun's reflection at once. Paint glints into the texture instead.
  To find an object on screen, `npm run shot -- <n> <m> --eval "...recolour it red..."`.
- Big-scale noise reads as dirty stains; fine-scale, low-contrast grain reads as texture.
- Headless is SwiftShader and slow: wait with `waitForFunction`, never a fixed sleep.
- Dense one-line code: never append a `// comment` to a line and then more statements after it. Everything after the
  `//` is gone (it silently killed the camera zoom once, the weapon-mount recoil another time). Put the comment on
  its own line, or use `/* */`. After an edit to a one-liner, check the setting it touches still does something.
- A mesh only darkens in shade with `receiveShadow`; `castShadow` alone lets it throw a shadow while staying lit in
  others' (cars sat bright under trees until render/vehicles.js `inShade`). New objects that move through shade need both.
- Car bodies come in two levels (render/carmodels.js): the faceted far body and a rounded near body swapped in when a
  car is big on screen (vehicles.js `pickDetail`). Change a car's shape in its builder and both follow; a new
  `K.part` geometry should be given as `detail => geometry` so it gets a near version. Price the near bodies with
  `RIVALS=13 CAM=behind DETAIL=near node tools/bench.mjs 7`. Rounded boxes need exact normals (`roundBox` sets them):
  averaged ones streak big flat panels. The sawtooth on the ice-cream van's back is shadow-map aliasing, not normals.
