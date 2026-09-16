#!/usr/bin/env python3
"""Validate the saved Mac-only release input. Does not claim a native runtime test."""
import hashlib,json,plistlib,re,sys
from pathlib import Path
root=Path(sys.argv[1]).resolve()
manifest=json.loads((root/'Checks/resource-manifest.json').read_text())
for name,expected in manifest['resources'].items():
 p=root/'Resources'/name
 assert p.is_file(),f'Missing resource: {name}'
 assert hashlib.sha256(p.read_bytes()).hexdigest()==expected,f'Changed resource: {name}'
info=plistlib.loads((root/'Info.plist').read_bytes())
assert info['CFBundleVersion']=='164'
assert info['CFBundleIdentifier']=='com.georgezajacek.composerstoolbox'
assert 'NSBonjourServices' not in info and 'NSLocalNetworkUsageDescription' not in info
ent=plistlib.loads((root/'Signing/entitlements.plist').read_bytes())
assert 'com.apple.security.network.server' not in ent
assert ent['com.apple.security.app-sandbox'] is True
swift=(root/'Sources/main.swift').read_text()
for forbidden in ['import Network','NWListener','CompanionReceiver','CompanionPanel','showCompanion','_comptool._tcp']:
 assert forbidden not in swift,f'Unexpected phone implementation: {forbidden}'
assert 'toolbox://toolbox/index.html' in swift,'Preserve the build 157 storage origin'
for p in (root/'Resources/dist').rglob('*'):
 if p.suffix in ('.js','.html'):
  s=p.read_text()
  for forbidden in ['ctCompanion','ct-companion-bridge','_comptool._tcp']:
   assert forbidden not in s,f'Phone integration remains in {p}'
for route in ['index.html','threes/index.html','infinity/index.html','time/index.html']:
 assert (root/'Resources/dist'/route).is_file()
# All scripts/styles referenced from the four entry pages must be included locally.
from urllib.parse import urlsplit,unquote
for route in ['index.html','threes/index.html','infinity/index.html','time/index.html']:
 p=root/'Resources/dist'/route
 for tag in re.findall(r'<(?:script|link)\b[^>]*>',p.read_text(),re.I):
  m=re.search(r'(?:src|href)=["\']([^"\']+)',tag)
  if not m:continue
  u=urlsplit(m[1])
  if u.scheme or u.netloc:continue
  target=(p.parent/unquote(u.path)).resolve()
  assert target.is_file(),f'Missing entry-page dependency: {route}: {m[1]}'
print(f'PASS: {len(manifest["resources"])} resource checksums, four routes, dependency files, build identity and Mac-only configuration.')
