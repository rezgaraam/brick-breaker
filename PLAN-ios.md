# Plan: iOS app — remaining

Done: SwiftUI shell + WKWebView, SwiftData progress store, native stats sheet, haptics, package tests,
XCUITest for the bridge, App Store icon. See CLAUDE.md "iOS app". What is left:

1. Done: automatic signing via `ios/Signing.xcconfig`, team in gitignored `ios/Local.xcconfig` (free personal team).
2. Plug in the iPhone (Trust, Developer Mode on) and run `ios/run-device.sh`. Check once: audio obeys the silent switch, haptics on brick break, kill and relaunch keeps stars.
3. App Privacy: no network, no tracking -> "Data Not Collected". Encryption: already `ITSAppUsesNonExemptEncryption: false`.
4. TestFlight needs a paid Apple Developer Program team. Archive, upload, screenshots per required size from the simulator (`xcrun simctl io <udid> screenshot`).
