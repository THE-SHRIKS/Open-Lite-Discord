#!/usr/bin/env bash
set -euo pipefail
printf '%s\n' 'SIDEBAND engineering kit — NOT a built application'
python3 scripts/check_manifest.py
python3 scripts/loop.py status
printf '%s\n' 'Start: python3 scripts/loop.py run --agent manual'
printf '%s\n' 'Local coding loop: python3 scripts/loop.py run --agent codex-local --iterations 4'
