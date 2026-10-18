# Plan: iOS app — remaining

Done: SwiftUI shell + WKWebView, SwiftData progress store, native stats sheet, haptics, package tests,
XCUITest for the bridge, App Store icon. See CLAUDE.md "iOS app". What is left needs an Apple developer team:

1. Set `DEVELOPMENT_TEAM` in `ios/project.yml` (settings.base), regenerate, open `ios/BrickBreaker.xcodeproj`.
2. Run on a real device once: audio obeys the silent switch, haptics on brick break, kill and relaunch keeps stars.
3. App Privacy: no network, no tracking -> "Data Not Collected". Encryption: already `ITSAppUsesNonExemptEncryption: false`.
4. Archive, upload to TestFlight, screenshots per required size from the simulator (`xcrun simctl io <udid> screenshot`).
