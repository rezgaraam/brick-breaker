# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Breakout/Arkanoid clone in one dependency-free file, `index.html` (plain Canvas 2D + JS, no build step).
The look it copies: a dense 56-column grid of 5px bricks, a sealed gray steel frame, and a steel-walled
"canal" the ball must fly up to eat the field from inside.

## Commands

```bash
open index.html        # run: no server needed, reload the tab after edits
node test.js           # the main test: DOM-stubbed smoke test, ~5s, exits non-zero on failure
python3 -m http.server 8000   # needed only to exercise the service worker (no SW on file://)
node pwa-check.js "$CHROMIUM" .   # PWA check: manifest, SW install, offline reload (see file header)
```

Headless render of a given level (Playwright's cached Chromium, no npm package needed):

```bash
BIN=~/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-mac-arm64/chrome-headless-shell
sed 's/let level=Math.min(+localStorage.bb_level||0,LEVELS.length-1)/let level=1/' index.html > /tmp/lvl.html
$BIN --headless --disable-gpu --hide-scrollbars --window-size=340,600 --virtual-time-budget=500 --screenshot=/tmp/lvl.png file:///tmp/lvl.html
```

## Web app files

The repo root is the site: https://rezgaraam.github.io/brick-breaker/ (GitHub Pages from `master`, `.nojekyll`
present; pushing `master` is the deploy). `manifest.webmanifest` +
`icon-192.png`/`icon-512.png` make it installable; `sw.js` is a network-first cache, so a deploy shows on
the next load with no version bump, and the cache only answers when the network fails. Bump `CACHE` in
`sw.js` only when its `FILES` list changes. Registration and the screen wake lock in `index.html` are
behind `?.` and try/catch so `file://` and the headless test stay quiet.

## Architecture (all in index.html, read top to bottom)

- **Levels** are arrays of 56-char strings: `.` empty, `1` green, `2` two-hit, `#` steel (hp `Infinity`).
  All 100 are generated at load, deterministically from the index: `diff(i)` gives rows / two-hit share /
  canal width, `TEMPLATES[i % 5]` builds the map from a seeded `rng(i+1)`, every 12th level is a
  hand-drawn map from `SET` scaled 4x. Changing a template or `diff` changes every level that uses it,
  so re-run `node test.js` (it validates all 100) and render a few.
- **Grid state** is a flat array `grid[r*COLS+c]` of hp numbers (0 empty). `left` counts breakable bricks
  and drives the win check, so anything that removes a brick must decrement it.
- **Bricks are drawn once** onto the offscreen canvas `bg`; `paint(i)` repaints a single cell. Every
  frame only blits `bg` then draws balls, paddle, pills, particles, HUD. Never draw bricks per frame.
- **Collision**: balls move in <=3px substeps; `collide()` checks only the grid cells under the ball's
  bounding box. `hit()` returns a contact normal only when the ball is moving *into* the rect, and
  `bounce()` sets the sign of a velocity component rather than negating it, so a second overlap on the
  next substep is a no-op instead of a double bounce.
- **Game state** is a string: `menu` (level select) -> `ready` (ball riding the paddle) -> `play` ->
  `win` | `over`; `tap()` advances it, the top bar / Escape returns to `menu`. Timed effects live in
  `fx` (seconds left) and reset in `update()`. Ball speed is `base` = `SPEED` + level.
- **Power-ups** are the `POWERS` table: label -> `[pill color, effect fn]`. Add one by adding a row.
- **Sound** is all synthesized: `SFX` table of `tone()`/`noise()` calls, `sfx(k)` guards mute, creates
  the `AudioContext` on first use and throttles brick sounds to one per 30ms. `music()` schedules a
  16-step pattern 100ms ahead of the audio clock from `update()`. Everything audio is inside try/catch so
  headless runs (no `AudioContext`) stay silent.
- Persistence: `localStorage.bb_stars` (JSON `{levelIndex: stars}`, level i unlocks when i-1 has a
  star) and `localStorage.bb_mute`.

## Invariants the geometry depends on

- Ball radius 4 (8px) vs 5px cells with 1px gaps: a passage must be >=2 cells wide. `test.js`
  flood-fills 2x2 windows of non-steel cells from below and fails on any brick an 8px ball cannot reach.
- Canvas is 340 wide so the side margins (`GX`=2, 3px right) are narrower than the ball; it cannot slip
  past the grid along the walls. Change `COLS`/`P`/`W` together or re-check this.
- Paddle bounce angle is clamped to 4..60 degrees off vertical. Below 4 the ball can lock into
  vertical loops; above 4 a straight shot up a 3-cell canal is impossible.

## test.js

Runs the game script in a `vm` context with a Proxy-stubbed 2D context. Any new browser API used in
`index.html` (e.g. `Image`, `fetch`, `document.createElement` of something new) needs a stub in the `g`
object or the test crashes at load. Game internals are exposed through the `G` object appended to the
script source; extend that getter list rather than restructuring the game for testability.
