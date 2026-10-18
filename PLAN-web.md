# Plan: Web app

`index.html` already is the app. Make it hosted, installable, offline-capable and phone-friendly. No bundler, no framework.

## 1. Host
1. GitHub Pages from `master`, root folder (repo Settings > Pages). URL: `https://<user>.github.io/<repo>/`.
2. Empty `.nojekyll` file so Pages serves files untouched.
   Check: open the URL on a phone and play a level.

## 2. Installable PWA
1. `manifest.webmanifest`: `name`, `short_name`, `start_url: "./"`, `display: "fullscreen"`, `orientation: "portrait"`,
   `background_color` and `theme_color` `#000`, icons 192 and 512 from one `icon.png` (generate it with a 10-line canvas script).
2. `sw.js` (~20 lines, no Workbox): cache-first for `index.html`, `manifest.webmanifest`, `icon.png`.
   Cache name carries a version string; bump it in the same commit as any `index.html` change.
3. Register in `index.html`: `navigator.serviceWorker?.register('sw.js')` inside try/catch.
4. `<link rel="manifest">`, `<meta name="theme-color">`, `<link rel="apple-touch-icon">` in the head.
   Check: Lighthouse PWA audit passes; reload in airplane mode works; "Add to Home Screen" on iOS Safari and Android Chrome.

## 3. Phone polish (edits in `index.html`, shared with the iOS plan)
1. `viewport-fit=cover` plus `env(safe-area-inset-*)` padding.
2. `overscroll-behavior: none` on `html` to block pull-to-refresh (`touch-action: none` already blocks zoom and scroll).
3. Keep the screen awake during play: `navigator.wakeLock?.request('screen')` on launch tap, inside try/catch.
4. Tab hidden mid-game: the loop already caps `dt` at 1/30 so returning is safe. Do nothing unless someone complains.
   Check: `node test.js` green, with a stub in `test.js` for any new API the game touches at load.

## 4. Deploy loop
- Push to `master` is the deploy.
- After each deploy: hard reload, DevTools > Application > Service Workers shows the new cache version.

## Skip
Bundler, TypeScript, backend, leaderboard, accounts, analytics, ads, a separate `web/` directory. The repo root is the site.
