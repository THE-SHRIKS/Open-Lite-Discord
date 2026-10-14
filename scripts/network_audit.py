#!/usr/bin/env python3
"""Heuristic scan for accidental third-party URLs in generated app source.
Does not replace an offline runtime browser network audit. No network calls.
"""
from pathlib import Path
import re
import sys
ROOT=Path(__file__).resolve().parent.parent
SCAN_ROOTS=[ROOT/'apps',ROOT/'packages']
ALLOWED=('http://127.0.0.1','http://localhost','https://127.0.0.1','https://localhost','http://[::1]','https://[::1]')
TEXT_EXT={'.ts','.tsx','.js','.jsx','.css','.html','.json','.mjs'}
pattern=re.compile(r'https?://[^\s\"\'\x60<>)]+',re.I)
problems=[]
for root in SCAN_ROOTS:
    if not root.exists(): continue
    for p in root.rglob('*'):
        if not p.is_file() or p.suffix not in TEXT_EXT or any(q in p.parts for q in ('node_modules','dist','build','coverage')): continue
        text=p.read_text(encoding='utf-8',errors='replace')
        for m in pattern.finditer(text):
            url=m.group(0)
            # Comments/docs, npm metadata and namespace URLs may generate false positives.
            if not url.startswith(ALLOWED):
                problems.append((str(p.relative_to(ROOT)),url[:140]))
if problems:
    print('REVIEW REQUIRED: external URL literals found (some may be non-runtime comments):')
    for file,url in problems[:100]:print(' -',file,url)
    sys.exit(1)
print('Static URL audit: no non-local URL literals found. Still verify browser Network tab offline.')
