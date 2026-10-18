#!/bin/sh
# Build, sign, install and launch on the connected physical iPhone/iPad.
# One-time: Xcode > Settings > Accounts signed in; ios/Local.xcconfig has DEVELOPMENT_TEAM; iPhone plugged in,
# trusted, Developer Mode on. Free (personal) teams: the app stops opening after 7 days, rerun this script.
set -e
cd "$(dirname "$0")"
[ -f Local.xcconfig ] || { echo "missing ios/Local.xcconfig: echo 'DEVELOPMENT_TEAM = <team id>' > ios/Local.xcconfig"; exit 1; }
mkdir -p build
xcrun devicectl list devices --json-output build/devices.json >/dev/null 2>&1 || true
DEV=$(python3 -I -c "import json,sys
d=json.load(open(sys.argv[1]))['result']['devices']
p=[x for x in d if x.get('hardwareProperties',{}).get('reality')=='physical']
print(p[0]['identifier'] if p else '')" build/devices.json)
[ -n "$DEV" ] || { echo "no physical device found: plug in the iPhone, unlock it, tap Trust, then rerun"; exit 1; }
echo "device: $DEV"
xcodegen generate --quiet
xcodebuild build -project BrickBreaker.xcodeproj -scheme BrickBreaker -destination 'generic/platform=iOS' \
  -derivedDataPath build -allowProvisioningUpdates -quiet
xcrun devicectl device install app --device "$DEV" build/Build/Products/Debug-iphoneos/BrickBreaker.app
xcrun devicectl device process launch --device "$DEV" com.rezgaraam.BrickBreaker \
  || echo "If launch was refused: on the iPhone, Settings > General > VPN & Device Management > trust your Apple ID, then open the app."
