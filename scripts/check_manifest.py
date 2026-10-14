#!/usr/bin/env python3
"""Static packaging checks without external dependencies or model/API calls."""
import json
from pathlib import Path
root=Path(__file__).resolve().parent.parent
j=json.loads((root/'tasks.json').read_text())
assert j['schema']==1
assert len(j['tasks'])>=25
assert j['phases']==['P0','P1','P2','P3','P4','P5']
assert [x['id'] for x in j['tasks']]==[f"{x['phase']}-{i:02d}" for i,x in enumerate(j['tasks'],1)]
assert all(x['status']=='pending' for x in j['tasks'])
assert all(x['acceptance'] and x['commands'] and x['required_files'] for x in j['tasks'])
assert sorted(set(x['phase'] for x in j['tasks']))==j['phases']
for t in j['tasks']:
    assert all(x and '..' not in x for x in t['required_files'])
for p in ['AGENTS.md','README.md','docs/PRODUCT.md','docs/ARCHITECTURE.md','docs/LOCAL_API.md','docs/SCHEMA.md','docs/SECURITY.md','docs/TEST_PLAN.md','docs/DEMO_AND_RELEASE.md','docs/REA_RESEARCH_PROTOCOL.md','design/VISUAL_DIRECTION.md','scripts/loop.py']:
    assert (root/p).stat().st_size > 200, p
print(f"Verified kit manifest: {len(j['tasks'])} ordered stories, {len(j['phases'])} phase gates, core documents exist.")
