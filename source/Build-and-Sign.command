#!/bin/bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUILD_DIR="$PROJECT_DIR/Build-164-$(date +%Y-%m-%d_%H-%M-%S)"
mkdir "$BUILD_DIR"
exec > >(tee "$BUILD_DIR/build.log") 2>&1
trap 'result=$?; if [ "$result" -ne 0 ]; then echo "Build stopped. No package is ready to upload. Send build.log from this folder for repair:"; echo "$BUILD_DIR"; /usr/bin/open "$BUILD_DIR"; read -r -p "Press Return to close." answer; fi' EXIT
[ "$(uname -s)" = Darwin ] || { echo 'Run this command on your Mac.'; exit 1; }
/usr/bin/xcrun --find swiftc >/dev/null
PYTHON="$(/usr/bin/xcrun --find python3)"
"$PYTHON" "$PROJECT_DIR/Checks/verify.py" "$PROJECT_DIR"
# Verify that this profile authorizes this app and has not expired.
/usr/bin/security cms -D -i "$PROJECT_DIR/Signing/AppStore.provisionprofile" > "$BUILD_DIR/profile.plist"
"$PYTHON" - "$BUILD_DIR/profile.plist" <<'PY'
import sys,plistlib,datetime
p=plistlib.load(open(sys.argv[1],'rb'))
assert p['Entitlements']['com.apple.application-identifier']=='5FLGQZSFD2.com.georgezajacek.composerstoolbox','Wrong provisioning profile'
assert p['ExpirationDate']>datetime.datetime.utcnow(),'Provisioning profile expired'
assert not p.get('ProvisionedDevices'),'Use the Mac App Store distribution profile'
print('App Store profile verified.')
PY
APP_IDENTITY=$(/usr/bin/security find-identity -v -p codesigning | /usr/bin/sed -n 's/.*"\(Apple Distribution:.*(5FLGQZSFD2)\)"/\1/p' | /usr/bin/head -1)
if [ -z "$APP_IDENTITY" ]; then
 APP_IDENTITY=$(/usr/bin/security find-identity -v -p codesigning | /usr/bin/sed -n 's/.*"\(3rd Party Mac Developer Application:.*(5FLGQZSFD2)\)"/\1/p' | /usr/bin/head -1)
fi
INSTALL_IDENTITY=$(/usr/bin/security find-identity -v -p basic | /usr/bin/sed -n 's/.*"\(3rd Party Mac Developer Installer:.*(5FLGQZSFD2)\)"/\1/p' | /usr/bin/head -1)
if [ -z "$INSTALL_IDENTITY" ]; then
 INSTALL_IDENTITY=$(/usr/bin/security find-identity -v -p basic | /usr/bin/sed -n 's/.*"\(Mac Installer Distribution:.*(5FLGQZSFD2)\)"/\1/p' | /usr/bin/head -1)
fi
[ -n "$APP_IDENTITY" ] && [ -n "$INSTALL_IDENTITY" ] || { echo 'The Apple application and installer signing identities must be available in this Mac’s Keychain.'; exit 1; }
APP="$BUILD_DIR/Composer's Toolbox.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
/usr/bin/ditto --norsrc --noextattr "$PROJECT_DIR/Resources" "$APP/Contents/Resources"
/bin/cp "$PROJECT_DIR/Info.plist" "$APP/Contents/Info.plist"
SDK="$(/usr/bin/xcrun --sdk macosx --show-sdk-path)"
for arch in arm64 x86_64; do
 echo "Compiling build 164 for ${arch}…"
 /usr/bin/xcrun --sdk macosx swiftc -swift-version 5 -O -sdk "$SDK" -target "${arch}-apple-macos13.0" -module-cache-path "$BUILD_DIR/module-cache-${arch}" -framework AppKit -framework WebKit "$PROJECT_DIR/Sources/main.swift" -o "$BUILD_DIR/ComposerToolbox-${arch}"
done
/usr/bin/xcrun lipo -create "$BUILD_DIR/ComposerToolbox-arm64" "$BUILD_DIR/ComposerToolbox-x86_64" -output "$APP/Contents/MacOS/ComposerToolbox"
/bin/chmod 755 "$APP/Contents/MacOS/ComposerToolbox"
PACKAGE_ARCHS=$(/usr/bin/xcrun lipo -archs "$APP/Contents/MacOS/ComposerToolbox")
case " $PACKAGE_ARCHS " in *" arm64 "*) ;; *) echo 'Missing Apple silicon architecture'; exit 1;; esac
case " $PACKAGE_ARCHS " in *" x86_64 "*) ;; *) echo 'Missing Intel architecture'; exit 1;; esac
# Run the actual rebuilt WebKit app with isolated storage before distribution signing.
/usr/bin/codesign --force --sign - "$APP"
echo 'Checking all four instruments in native WebKit…'
if ! "$APP/Contents/MacOS/ComposerToolbox" --verify-release --report "$BUILD_DIR/native-checks.json"; then
 echo 'Native verification failed. See the report (if present) and build.log in this build folder.'
 exit 1
fi
[ -s "$BUILD_DIR/native-checks.json" ] || { echo 'Native verification exited without writing its report. The build is stopped; no upload package was made.'; exit 1; }
"$PYTHON" - "$BUILD_DIR/native-checks.json" <<'PY'
import sys,json
r=json.load(open(sys.argv[1]));assert r['pass'],'Native verification failed'
print('All four native pages loaded; local storage and absence of the phone bridge verified.')
PY
/bin/cp "$PROJECT_DIR/Signing/AppStore.provisionprofile" "$APP/Contents/embedded.provisionprofile"
/bin/chmod -R a+rX "$APP"
# Remove quarantine from every assembled file, including the copied profile,
# before applying the distribution signature. Any failure stops packaging.
"$PYTHON" - "$APP" <<'PYATTR'
import os, sys, subprocess
root = sys.argv[1]
paths = [root]
for directory, dirs, files in os.walk(root):
    paths.extend(os.path.join(directory, name) for name in dirs + files)
def attributes(path):
    return subprocess.run(['/usr/bin/xattr', path], check=True,
                          stdout=subprocess.PIPE, text=True).stdout.splitlines()
for path in paths:
    if 'com.apple.quarantine' in attributes(path):
        subprocess.run(['/usr/bin/xattr', '-d', 'com.apple.quarantine', path], check=True)
    if 'com.apple.quarantine' in attributes(path):
        raise RuntimeError('Quarantine remains: ' + path)
print('Assembled app verified free of quarantine attributes.')
PYATTR
/usr/bin/codesign --force --timestamp --sign "$APP_IDENTITY" --entitlements "$PROJECT_DIR/Signing/entitlements.plist" "$APP"
/usr/bin/codesign --verify --deep --strict --verbose=2 "$APP"
/usr/bin/codesign --display --entitlements :- "$APP" > "$BUILD_DIR/signed-entitlements.plist" 2> "$BUILD_DIR/codesign-details.txt"
"$PYTHON" - "$BUILD_DIR/signed-entitlements.plist" "$PROJECT_DIR/Signing/entitlements.plist" "$APP/Contents/Info.plist" <<'PY'
import sys,plistlib
actual=plistlib.load(open(sys.argv[1],'rb'));expected=plistlib.load(open(sys.argv[2],'rb'));info=plistlib.load(open(sys.argv[3],'rb'))
assert actual==expected,'Signed entitlements differ from the verified settings'
assert 'com.apple.security.network.server' not in actual
assert actual['com.apple.security.app-sandbox'] is True
assert info['CFBundleVersion']=='164'
assert 'NSBonjourServices' not in info and 'NSLocalNetworkUsageDescription' not in info
print('Distribution signature and Mac-only permissions verified.')
PY
PACKAGE="$BUILD_DIR/Composers-Toolbox-Mac-Only-Build-164.pkg"
/usr/bin/productbuild --component "$APP" /Applications --sign "$INSTALL_IDENTITY" "$PACKAGE"
/usr/sbin/pkgutil --check-signature "$PACKAGE"
echo 'Build 164 package created. Before upload, complete the Mac review checklist in TEST-RESULTS.txt.'
echo "$PACKAGE"
/usr/bin/open -R "$PACKAGE"
read -r -p 'Press Return to close.' answer
