# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Breakout/Arkanoid clone in one dependency-free file, `index.html` (plain Canvas 2D + JS, no build step).
The look it copies: a dense 56-column grid of 5px bricks, a sealed gray steel frame, and a steel-walled
"canal" the ball must fly up to eat the field from inside.

## Commands

```bash
open index.html        # run: no server needed, reload the tab after edits
node test.js           # the only test: DOM-stubbed smoke test, ~5s, exits non-zero on failure
```

Headless render of a given level (Playwright's cached Chromium, no npm package needed):

```bash
BIN=~/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-mac-arm64/chrome-headless-shell
sed 's/let level=Math.min(+localStorage.bb_level||0,LEVELS.length-1)/let level=1/' index.html > /tmp/lvl.html
$BIN --headless --disable-gpu --hide-scrollbars --window-size=340,600 --virtual-time-budget=500 --screenshot=/tmp/lvl.png file:///tmp/lvl.html
```

## Architecture (all in index.html, read top to bottom)

- **Levels** are arrays of 56-char strings: `.` empty, `1` green, `2` two-hit, `#` steel (hp `Infinity`).
  `field(rows, canals)` generates the sealed-frame levels; `scale()` blows 14-column hand-drawn maps up 4x.
  Adding a level = adding an entry to `LEVELS`; `test.js` validates every entry automatically.
- **Grid state** is a flat array `grid[r*COLS+c]` of hp numbers (0 empty). `left` counts breakable bricks
  and drives the win check, so anything that removes a brick must decrement it.
- **Bricks are drawn once** onto the offscreen canvas `bg`; `paint(i)` repaints a single cell. Every
  frame only blits `bg` then draws balls, paddle, pills, particles, HUD. Never draw bricks per frame.
- **Collision**: balls move in <=3px substeps; `collide()` checks only the grid cells under the ball's
  bounding box. `hit()` returns a contact normal only when the ball is moving *into* the rect, and
  `bounce()` sets the sign of a velocity component rather than negating it, so a second overlap on the
  next substep is a no-op instead of a double bounce.
- **Game state** is a string: `ready` (ball riding the paddle) -> `play` -> `win` | `over`; `tap()`
  advances it. Timed effects live in `fx` (seconds left) and reset in `update()`.
- **Power-ups** are the `POWERS` table: label -> `[pill color, effect fn]`. Add one by adding a row.
- Progress is `localStorage.bb_level` only.

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
