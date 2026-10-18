# Plan: iOS release

## Done

SwiftUI shell + WKWebView around `index.html`, SwiftData progress store, native Progress sheet (5 languages),
haptics, auto-pause on resign-active, package tests, UI tests + accessibility audits, App Store icon (source
`docs/icon.html`),
automatic signing with a gitignored team file, `ios/run-device.sh`. Installed and played on an iPhone 17 Pro
with a free personal team (7-day installs). See CLAUDE.md "iOS app".

## Ways to let other people play

| Option | Cost | Reach | Notes |
|---|---|---|---|
| Website / PWA | free | anyone, any device | live now; no haptics or native Progress sheet; progress stays in that browser |
| `ios/run-device.sh` on their phone | free | phones plugged into this Mac | 7-day expiry, 3 apps per phone on a free team |
| TestFlight | $99/yr | 100 internal, 10,000 external (public link) | first external build per version gets beta review (~1 day); builds expire after 90 days |
| Ad Hoc | $99/yr | 100 registered devices | needs each tester's device ID; 1-year profile |
| App Store | $99/yr | everyone | full review (~1-2 days) |

## TestFlight, then App Store

Blocked on the user: enroll in the Apple Developer Program ($99/yr, approval 1-2 days) and share the new team ID.

Prep that can be done before enrolling:
1. Version and build numbers: every upload needs a new `CFBundleVersion` (e.g. git commit count).
2. `ios/release.sh`: `xcodebuild archive` + `-exportArchive` (method app-store-connect, destination upload,
   `-allowProvisioningUpdates`), using the team from `ios/Local.xcconfig`.
3. Privacy policy page on GitHub Pages (no data collected; progress stays on the device).
4. TestFlight "What to Test" notes and beta description, in en/fr/de/es/fa.
5. A click-through checklist for App Store Connect.

After enrolling:
1. Put the new team ID in `ios/Local.xcconfig`.
2. App Store Connect -> Apps -> New App. The name must be unique on the whole store ("Brick Breaker" alone is
   taken). If bundle ID `com.rezgaraam.BrickBreaker` is unavailable (the free team may hold it), switch to e.g.
   `com.rezgaraam.brickbreaker.canals` in `ios/project.yml`.
3. `ios/release.sh`, wait 10-30 min for processing, test internally.
4. External group + public link, submit for beta review.
5. App Store: description, keywords, support URL, privacy policy URL, screenshots (iPhone 6.9", iPad 13"),
   age rating, category Games > Arcade, price Free, App Privacy "Data Not Collected"
   (`ITSAppUsesNonExemptEncryption` is already false). Submit for review.

Review risk: guideline 4.2 (repackaged website). Mitigations already in place: the game is bundled and works
offline, plus native SwiftData progress, a native Progress sheet and haptics. If rejected, add native features
(e.g. Game Center leaderboards, widgets) rather than arguing.

Not planned: iCloud sync (needs the paid team; add after release if wanted), Game Center, Android build.
