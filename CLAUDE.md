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
node bench.js "$CHROMIUM" "$PWD/index.html"   # frame-time check: level 100, 20 balls, 3x DPR, 4x CPU throttle
ios/run-device.sh                 # iOS on a plugged-in iPhone: sign (team in gitignored ios/Local.xcconfig), install, launch
ios/check.sh                      # iOS: package tests (swift test) + simulator build (+ UI tests and audits if a sim is booted)
```

Check a gate's exit code directly (`ios/check.sh > log 2>&1; echo $?`), never through `| tail`: a pipe once
hid a failing gate and a broken commit was pushed.

iOS from the CLI: `cd ios && xcodegen generate` (the .xcodeproj is gitignored, regenerate after editing
`project.yml`), then build with `-destination 'generic/platform=iOS Simulator' -derivedDataPath build` and
install with `xcrun simctl install <udid> build/Build/Products/Debug-iphonesimulator/BrickBreaker.app`.
On this machine xcodebuild does not resolve concrete simulators by name, so use the generic destination
plus `simctl` rather than `-destination name=...`.

Headless render of a given level (Playwright's cached Chromium, no npm package needed):

```bash
BIN=~/Library/Caches/ms-playwright/chromium_headless_shell-*/chrome-headless-shell-mac-arm64/chrome-headless-shell
sed 's|^applyLang();.*|applyLang();level=99;loadLevel();|' index.html > /tmp/lvl.html   # level index, 0-based
$BIN --headless --disable-gpu --hide-scrollbars --window-size=340,600 --virtual-time-budget=500 --screenshot=/tmp/lvl.png file:///tmp/lvl.html
```

## Web app files

The repo root is the site: https://rezgaraam.github.io/brick-breaker/ (GitHub Pages from `master`, `.nojekyll`
present; pushing `master` is the deploy). `manifest.webmanifest` +
`icon-192.png`/`icon-512.png` make it installable (`docs/` holds the README screenshots, also served); `sw.js` is a network-first cache, so a deploy shows on
the next load with no version bump, and the cache only answers when the network fails. Bump `CACHE` in
`sw.js` only when its `FILES` list changes. Registration and the screen wake lock in `index.html` are
behind `?.` and try/catch so `file://` and the headless test stay quiet.

## iOS app (`ios/`)

Native shell around the same `index.html`; the file is a bundle resource referenced from `project.yml`,
never copied into git. Two parts, per the stack-ios shape:

- `BrickBreakerCore` Swift package: `LevelResult` (SwiftData `@Model`, one row per cleared level: stars,
  best score), `ProgressStore` (upsert that only raises stars/score, `reset()`, and `seedScript()` which
  emits the JS that primes the page's localStorage from the database), `GameMessage` (parses what the page
  posts; malformed bodies are dropped). Tested with Swift Testing on macOS: `swift test` in that folder.
- App target: `GameView` (WKWebView; injects the seed and `window.nativeLang` (the phone's language) at document
  start, forwards `webkit.messageHandlers.game` bodies, and calls the page's `autoPause()` on
  `willResignActiveNotification`; on `webViewWebContentProcessDidTerminate` it rebuilds the seed from the
  database and reloads, because user scripts are fixed strings and a WebKit auto-reload would replay the
  launch-time progress), `ContentView` (routes messages: record level, haptic via `sensoryFeedback`, open stats sheet;
  bumps `reloadToken` after a reset so the page re-seeds), `StatsView` (`@Query` over the same store,
  reset with confirmation). The database is the source of truth; the page's localStorage is a cache.

The bridge on the web side is `native(...)`, `inApp()` and `haptic()` in `index.html`; every call is a
no-op in a browser, so the web build never notices the shell. `BrickBreakerUITests` drives the real app on a
simulator: Progress button -> native sheet (the bridge), assisted play through buttons only, pause/resume, and a
launch with `-AppleLanguages (fr)` that expects both the page and the native sheet in French. Run them with `xcodebuild test ... -destination "id=<booted udid>"` (name-based destinations do not resolve here).

Signing: `ios/Signing.xcconfig` sets automatic signing and includes the gitignored `ios/Local.xcconfig`
(`DEVELOPMENT_TEAM`). Currently a free personal team: device installs expire after 7 days, no TestFlight.
`ios/run-device.sh` builds for the device's hardware UDID (not generic iOS), which is what registers a new
phone with the team. Release steps are in `PLAN-ios.md`.

## Architecture (all in index.html, read top to bottom)

- **Levels** are arrays of 56-char strings: `.` empty, `1` green, `2` two-hit, `#` steel (hp `Infinity`).
  All 100 are generated at load, deterministically from the index: `diff(i)` gives rows / two-hit share /
  canal width, `TEMPLATES[i % 5]` builds the map from a seeded `rng(i+1)`, every 12th level is a
  hand-drawn map from `SET` scaled 4x.
  **Every level is sealed in the 2-brick steel frame** (`seal()`): canal and room levels build it themselves with
  tall steel-walled canals; holes/bands/diamond/hand-drawn levels get it in the `LEVELS` builder with doorways
  through the bottom wall only (a tall canal's walls inside those patterns closed gaps to one brick row, which an
  8px ball cannot enter). Steel bands stay >=2 rows above the bottom wall for the same reason. Changing a template or `diff` changes every level that uses it,
  so re-run `node test.js` (it validates all 100) and render a few.
- **Grid state** is a flat array `grid[r*COLS+c]` of hp numbers (0 empty). `left` counts breakable bricks
  and drives the win check, so anything that removes a brick must decrement it.
- **Two stacked canvases.** Bricks live on `#bg`; `paint(i)` repaints a single cell when it changes. `#c` sits
  on top, is cleared every frame and holds only what moves (balls, paddle, pills, particles, combo text). Shake moves
  `#bg` with a CSS transform. Never draw or copy the brick layer per frame: blitting it at 3x DPR was measured
  as the frame-time bottleneck (38-56ms frames at 4-6x CPU throttle vs 17-18ms after the split).
- **Coordinates are logical 340x600** (`W`, `H`). `fit()` sizes both canvases' backing stores to the
  on-screen size in device pixels and sets a transform, so game code never sees device pixels. The `#wrap`
  div fills the screen while keeping the aspect ratio; everything else (HUD, chips, cards, menu) is HTML on top.
- **Collision**: balls move in <=3px substeps; `collide()` checks only the grid cells under the ball's
  bounding box. `hit()` returns a contact normal only when the ball is moving *into* the rect, and
  `bounce()` sets the sign of a velocity component rather than negating it, so a second overlap on the
  next substep is a no-op instead of a double bounce.
- **The rAF loop runs only while a level is on screen.** `loadLevel()` calls `wake()`; the loop stops itself
  when `state` becomes `menu` (the menu is static HTML). `fit()` computes `scaleK` instead of reading layout;
  use `scaleK` for logical-to-CSS-pixel conversion, never read element sizes per frame.
- **Game state** is a string: `menu` (level select) -> `ready` (ball riding the paddle) -> `play` ->
  `win` | `over`, plus `pause` (from ready/play; `pause()`/`resume()`, P or Escape, auto on `visibilitychange`
  and when the iOS app resigns active via `autoPause()`). `win`/`over`/`pause` show one HTML card (`showCard`)
  whose first button is the primary action. The loop stops in `menu` and `pause`. Timed effects live in
  `fx` (seconds left) and reset in `update()`. Ball speed is `base` = (`SPEED` + level) x `cfg.speed`; the slow/fast power-ups scale `base` (x0.7 / x1.35).
  `resetBall()` also resets `combo`, so a combo never carries into a new ball or level.
- **Power-ups** are the `POWERS` table: label -> `[pill color, effect fn]`. Add one by adding a row.
- **Settings** live in `cfg` (`localStorage.bb_cfg`: music, sfx, haptics, shake, speed (ball speed multiplier
  0.75/1/1.25/1.5, applied live via `baseSpeed()`), paddle 0=follow / >0=drag gain, assist, lang) behind a native `<dialog>`;
  `update()` pauses while it is open. Reset progress is a two-tap button: web clears localStorage and reloads,
  the iOS shell receives `{type:'reset'}` and clears SwiftData, then reloads the page.
- **Juice**: `jolt(n)` adds screen shake that `update()` decays (off under prefers-reduced-motion); each ball
  carries a short `trail`; `combo` counts bricks since the last paddle hit, scales score and is drawn on the
  playfield from 5 up. `burst()` throws confetti particles on a win (particles carry optional colour/size and draw above
  overlays). Music picks pattern and key from `SONGS` by level band (every 10 levels). Level 100 is a hand-built
  finale, special-cased where `LEVELS` is built.
- **Sound** is all synthesized: `SFX` table of `tone()`/`noise()` calls, `sfx(k)` guards mute, creates
  the `AudioContext` on first use and throttles brick sounds to one per 30ms. `music()` schedules a
  16-step pattern 100ms ahead of the audio clock from `update()`. Everything audio is inside try/catch so
  headless runs (no `AudioContext`) stay silent.
- Persistence: `localStorage.bb_stars` (JSON `{levelIndex: stars}`, level i unlocks when i-1 has a
  star), `localStorage.bb_best` (best score per level), `localStorage.bb_cfg` (settings) and `localStorage.bb_mute`. Inside the iOS app the
  first two are overwritten at every launch from SwiftData.

## Languages

`I18N` holds en, fr, de, es, fa (Persian is RTL: `applyLang()` sets `dir`). `t(key, ...args)`; values are
strings or functions. Static markup uses `data-t` (text) and `data-tl` (aria-label). Language = the setting,
else `window.nativeLang` (injected by the iOS shell from the phone), else the browser. `test.js` fails if a
language's key set or function arity differs from English, so add every new string to all five. The native
Progress screen uses `ios/BrickBreaker/Localizable.xcstrings` (same five languages, follows the phone).

## Accessibility

Everything a player taps outside the playfield is real HTML, never canvas-drawn: the level select (`goMenu()`
renders 100 `<button>`s with labels like "Level 4, 2 of 3 stars" / "locked"; the next one to play gets class
`next`), the icon chips (mute with `aria-pressed`, settings, Progress in the iOS app, pause), the settings rows
(44px `role=switch` buttons), the HUD (score, level, lives as `role=img` "3 lives") and the pause/win/over
cards. Sizes use `cqw` so they track the canvas scale. Game
events are announced through the `say()` aria-live region. The playfield is a canvas; **Assisted play**
(`cfg.assist`) makes it playable without steering: `assist()` moves the paddle under the lowest falling ball,
and a visible Launch button (`#go`) replaces tapping the field (the cards cover next level / retry). Pinch-zoom is allowed
everywhere except the canvases (`touch-action:none` only there). `AccessibilityAuditTests` runs Apple's `performAccessibilityAudit` on the menu,
settings, Progress sheet, ready screen and pause card; it must stay at zero findings. Accepted issues are filtered in the test with their reason (system toolbar
buttons and Dynamic Type; hit-area findings on non-interactive static text/images, which WebKit reports for
any plain page text); never filter by skipping audit types.

## Invariants the geometry depends on

- Every level: top 2 rows steel, 2 steel columns on both sides, an opening in the bottom wall; steel (hp
  `Infinity`) never breaks, fireball included. `test.js` checks all three on all 100 levels.
- Ball radius 4 (8px) vs 5px cells with 1px gaps: a passage must be >=2 cells wide. `test.js`
  flood-fills 2x2 windows of non-steel cells from below and fails on any brick an 8px ball cannot reach.
- Canvas is 340 wide so the side margins (`GX`=2, 3px right) are narrower than the ball; it cannot slip
  past the grid along the walls. Change `COLS`/`P`/`W` together or re-check this.
- Paddle top is at y=500 (`H-100`) so the thumb sits below it. The tallest levels (64 rows) end at y=406,
  leaving ~94px of reaction room; adding rows or lowering `GY` eats into that.
- Paddle bounce angle is clamped to 4..60 degrees off vertical. Below 4 the ball can lock into
  vertical loops; above 4 a straight shot up a 3-cell canal is impossible.

## test.js

Runs the game script in a `vm` context with a Proxy-stubbed 2D context. Any new browser API used in
`index.html` (e.g. `Image`, `fetch`, `document.createElement` of something new) needs a stub in the `g`
object or the test crashes at load. Game internals are exposed through the `G` object appended to the
script source; extend that getter list rather than restructuring the game for testability.
