# Build 164 checkpoint

Authoritative content: `source/` (78 files).

Lineage: user-supplied `Composers-Toolbox-Build-163-Review-4.zip` → hidden native verification and explicit report handling → quarantine cleanup using macOS `/usr/bin/xattr` → build number increment to 164 after Apple rejected reuse of 163.

Application Resources were preserved byte-for-byte throughout these repairs. The original 60-resource manifest remains in `source/Checks/resource-manifest.json`. `source/FILE-SHA256SUMS.txt` records all other source files; it excludes itself.

Local validation: source resource verifier passed, shell syntax passed, ZIP integrity passed. During GitHub upload, the returned Git blob SHA of every source file was compared with its locally computed Git blob SHA.

User-reported release state: build 164 ready for internal testing. No independent App Store Connect access was used to confirm this status. Signed .pkg and Mac-generated logs remain on the user's Mac, not in this checkpoint. App Store review approval is not claimed.

Rebuild: download this repository, open source/, run Build-and-Sign.command on the signing Mac. Future Apple uploads may require a higher build number. Preserve this checkpoint before making future changes.
