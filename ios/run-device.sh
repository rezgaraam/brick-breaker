#!/bin/sh
# Build, sign, install and launch on the connected physical iPhone/iPad.
# One-time: Xcode > Settings > Accounts signed in; ios/Local.xcconfig has DEVELOPMENT_TEAM; iPhone plugged in,
# trusted, Developer Mode on. Free (personal) teams: the app stops opening after 7 days, rerun this script.
set -e
cd "$(dirname "$0")"
[ -f Local.xcconfig ] || { echo "missing ios/Local.xcconfig: echo 'DEVELOPMENT_TEAM = <team id>' > ios/Local.xcconfig"; exit 1; }
mkdir -p build
xcrun devicectl list devices --json-output build/devices.json >/dev/null 2>&1 || true
# devicectl wants its own identifier; xcodebuild wants the hardware UDID. Building for the device itself (not
# generic iOS) is what lets -allowProvisioningUpdates register it with the team and mount its disk image.
set -- $(python3 -I -c "import json,sys
d=json.load(open(sys.argv[1]))['result']['devices']
p=[x for x in d if x.get('hardwareProperties',{}).get('reality')=='physical']
print(p[0]['identifier'],p[0]['hardwareProperties']['udid'] if p else '')" build/devices.json 2>/dev/null)
DEV=$1 UDID=$2
[ -n "$UDID" ] || { echo "no physical device found: plug in the iPhone, unlock it, tap Trust, then rerun"; exit 1; }
echo "device: $DEV (udid $UDID)"
xcodegen generate --quiet
xcodebuild build -project BrickBreaker.xcodeproj -scheme BrickBreaker -destination "id=$UDID" \
  -derivedDataPath build -allowProvisioningUpdates -allowProvisioningDeviceRegistration -quiet
xcrun devicectl device install app --device "$DEV" build/Build/Products/Debug-iphoneos/BrickBreaker.app
xcrun devicectl device process launch --device "$DEV" com.rezgaraam.BrickBreaker \
  || echo "If launch was refused: on the iPhone, Settings > General > VPN & Device Management > trust your Apple ID, then open the app."
