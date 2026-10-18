# Plan: iOS app

Ship the same `index.html` inside a native shell. No rewrite, no Capacitor/Cordova.
A SpriteKit rewrite is only worth it if WKWebView stutters on a real device; a 2D canvas this size will not.

## 0. Decisions
- SwiftUI app, iOS 17+, one `WKWebView` loading `index.html` from the app bundle.
- `index.html` stays the single source of truth. An Xcode build phase copies `../index.html` into the bundle,
  so there is never a second copy in git.
- Progress stays in `localStorage` (WKWebView's default data store is persistent). No sync.

## 1. Project shell
1. `mkdir ios`, create the project with XcodeGen (`project.yml`) or Xcode > New Project. Commit the `.xcodeproj`.
   Target `BrickBreaker`: iPhone + iPad, portrait only, deployment target 17.0.
2. Build phase "Copy Web" (Run Script): `cp "$SRCROOT/../index.html" "$BUILT_PRODUCTS_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH/"`.
   Check: `index.html` is inside the built `.app`.
3. `GameView: UIViewRepresentable` around `WKWebView`:
   - `config.mediaTypesRequiringUserActionForPlayback = []` and `allowsInlineMediaPlayback = true` so WebAudio starts on the first tap.
   - `scrollView.isScrollEnabled = false`, `bounces = false`, `contentInsetAdjustmentBehavior = .never`.
   - `loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())`.
   - `.ignoresSafeArea()`, `.statusBarHidden()`, black background.
4. `ContentView` is just `GameView`.
   Check: runs in Simulator, tap launches the ball, sound plays, kill and relaunch keeps stars.

## 2. Fit the game to a phone (edits in `index.html`, shared with the web plan)
1. Viewport meta gets `viewport-fit=cover`; body padding uses `env(safe-area-inset-*)` so the paddle is not under the home bar.
2. Confirm the 9:16 canvas letterboxes black on 19.5:9 screens (body background is already `#000`).
3. Audio vs silent switch: set `AVAudioSession` category `.ambient` at app start so the game obeys the switch.
4. Haptics (optional): `window.webkit?.messageHandlers?.haptic?.postMessage(1)` on brick break, throttled like `sfx`;
   Swift side `WKScriptMessageHandler` -> `UIImpactFeedbackGenerator(style: .light)`.
5. Check: `node test.js` still green (every new browser API is behind `?.` or try/catch).

## 3. Ship
1. App icon 1024px (export from a canvas script: green brick grid with a canal). Launch screen: solid black.
2. App Privacy: no network, no tracking -> "Data Not Collected".
3. Archive, upload to TestFlight, take screenshots in Simulator for each required size.
4. Check on a real device: fresh install, play level 1 to 3 stars, mute, background and foreground, no audio glitch.

## Skip
Capacitor, Game Center, iCloud sync, IAP, ads, native rewrite, landscape.
