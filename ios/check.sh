#!/bin/sh
# Gate for the iOS shell: package tests, then a simulator build of the app.
set -e
cd "$(dirname "$0")"
(cd BrickBreakerCore && swift test 2>&1 | tail -3)
xcodegen generate --quiet
xcodebuild build -project BrickBreaker.xcodeproj -scheme BrickBreaker -destination 'generic/platform=iOS Simulator' -derivedDataPath build -quiet 2>&1 | grep -E 'error:' && exit 1
echo "ok: package tests passed, app builds for the simulator"
# UI test (bridge end to end) when a simulator is already booted: xcrun simctl boot <udid> first.
UDID=$(xcrun simctl list devices booted | grep -o '[0-9A-F-]\{36\}' | head -1)
[ -z "$UDID" ] && { echo "skip: no booted simulator for the UI test"; exit 0; }
if xcodebuild test -project BrickBreaker.xcodeproj -scheme BrickBreaker -destination "id=$UDID" -derivedDataPath build > build/uitest.log 2>&1; then
  echo "ok: UI test passed on $UDID (page -> native bridge)"
else
  grep -E 'error:' build/uitest.log | head -5; echo "FAIL: UI test, see ios/build/uitest.log"; exit 1
fi
