# How to run the engineering loop

## Manual first run
```
python scripts/check_manifest.py
python scripts/loop.py status
python scripts/loop.py next
python scripts/loop.py run --agent manual
```
Copy `agent/current-task-prompt.md` into your code agent. After it modifies this repo:
```
python scripts/loop.py verify
```
It checks required nonempty files and runs the exact commands listed in `tasks.json`. A failed command blocks status. The executor appends factual results in progress.md.

## Local autonomous agent
When a capable model and Ollama are installed, configure Codex to use the local Ollama provider and confirm a manual test outside this kit. Then run:
```
python scripts/loop.py run --agent codex-local --iterations 4
```
The runner starts a FRESH agent process each story, passes story and contracts via stdin, collects the result, runs checks and moves to the next one only when checks pass. It deliberately does not launch an agent with unrestricted system permissions, does not allow remote-model use by default and does not publish online.

If using Codex with a cloud-hosted model, require explicit acknowledgement:
```
python scripts/loop.py run --agent codex-cloud --iterations 1 --allow-remote-agent
```
Remote inference sends code/context externally and therefore is NOT a strict local-only inference choice. Application runtime remains offline/local if the implementation complies with its contract.

## Phases and signoff
When all stories of a phase complete, inspect the running application, tests and screenshots. Approve personally, with evidence:
```
python scripts/loop.py approve --phase P0 --note "Workspace scripts, DB migration and auth routes tested locally"
```
Run again. P1 requires visual review. P3 requires separate clients, reconnect and authorization checks. P5 requires LAN/offline release evidence. The runner cannot verify aesthetic originality, security, compliance or design quality by machine file checks alone.

## Failures and model limitations
Check `agent/agent-output.log` (ignored by Git) and progress.md for exact errors. Do not force task status to complete. A local model running on limited VRAM may fail on full-stack development; use shorter iterations and improve prompts or hand tasks to a more capable coding model only if the privacy tradeoff is acceptable. The runner has no built-in guarantee of finishing all stories.

## Verify overall completion
```
python scripts/loop.py status
npm run verify:all
```
Human review of screenshots, two clients and offline runtime remains mandatory. Task completion != production readiness.
