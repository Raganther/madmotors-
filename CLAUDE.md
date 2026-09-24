# Notes for Claude

Top-down racer, three.js r128, plain JS modules, Vite. Read README.md for the layout and how to add stages/features.

## Commands
- `npm run check`: lint + golden tests. Run before every commit; must pass.
- `npm run e2e`: production build + headless browser run of every stage (no console errors allowed).
- `npm run layout -- <n>` / `npm run terrain -- <n>`: inspect a stage's road plan / terrain before playing it.
- `npm run bench -- <n>`: render benchmark (SwiftShader here, so only compare against a previous run).
- Headless Chromium lives at /opt/pw-browsers (don't `playwright install`); pass `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`.

## Rules
- `src/core` and `src/data` must stay free of three.js/DOM/`render`/`ui`/`audio`/`game.js` (ESLint enforces). The simulation talks to the rest only through state and `car.events`.
- Golden tests lock exact behaviour. Refactors must keep them green. For intended gameplay changes run `npm run golden` and state it in the commit message.
- Race features draw randomness from `R.rnd`; keep `FEATURES` order stable and append new ones.
- Cross-module mutable app state goes on `G` (src/game.js), not new loose `let`s shared between modules.
- `window.__dr` (src/debug.js) exposes `G`, `core`, `flow` and `step(secs)` for browser tests; the game doesn't use it.
- Match the surrounding style: short explanatory comments on the non-obvious bits, dense one-line helpers are normal here.
- Publish by building and publishing `dist/index.html` to the existing artifact (same URL); dist is not committed.
