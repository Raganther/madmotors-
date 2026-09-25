---
name: ship
description: Verify, commit, push and publish Downhill Rush (check, e2e, golden, commit trailers, artifact publish). Use at the end of every change to this game, or when the user says ship/publish/push it.
---

# Ship a change

Run from the repo root. Stop and fix at the first failure; never commit red.

1. **Look at the diff**: `git status --short` and `git diff --stat`. Only the files you meant to change. Nothing in
   `dist/` or `tools/out/` (both ignored).
2. **`npm run check`**: lint, unit, golden and a production build. Must pass.
   - Golden changed (`git diff --stat tests/golden.json` shows lines) on a change that should be visual only → the
     change leaked into the simulation. Find out why; don't regenerate.
   - Gameplay meant to change → `npm run golden`, re-run check, and say "golden regenerated: <why>" in the commit.
3. **`npm run e2e`** when the change touches rendering, UI, a stage, an element, a vehicle or boot: every stage is
   raced headless and any console error fails it. Skip only for tool/doc/test-only changes, and say you skipped it.
4. **Commit** on the working branch (see the session's branch instructions; don't switch branches). Message: a
   short plain-English title of what a player would notice, a body with the why and anything golden-related, then the
   attribution trailers the session asks for.
5. **Push**: `git push -u origin <branch>`; retry on network errors only (2s, 4s, 8s, 16s).
6. **Publish**: `npm run build`, then publish `dist/index.html` with the Artifact tool to the game's existing artifact
   URL (`url` = the one in CLAUDE.md or earlier in the session). Never publish a new URL for the game.
7. **Tell the user** in plain words what changed for them, what was verified (check, e2e, screenshots) and anything
   you didn't verify. Send the screenshots that show the change.

## Traps we've hit
- Never revert an experiment with `git checkout -- <file>` or `git stash` while other edits are uncommitted: it
  silently takes those too. Undo by editing.
- Never `pkill -f <pattern>` where the pattern also matches your own command line: it kills your shell, and any
  commit queued behind it.
