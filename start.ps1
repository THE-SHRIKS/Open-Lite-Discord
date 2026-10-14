# Windows / PowerShell entrypoint. Intentionally never approves phases for you.
$ErrorActionPreference = "Stop"
Write-Host "SIDEBAND engineering kit — NOT a built application" -ForegroundColor Cyan
python scripts/check_manifest.py
python scripts/loop.py status
Write-Host "Start with: python scripts/loop.py run --agent manual"
Write-Host "Or local loop: python scripts/loop.py run --agent codex-local --iterations 4"
