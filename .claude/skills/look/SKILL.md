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
- Big-scale noise reads as dirty stains; fine-scale, low-contrast grain reads as texture.
- Headless is SwiftShader and slow: wait with `waitForFunction`, never a fixed sleep.
