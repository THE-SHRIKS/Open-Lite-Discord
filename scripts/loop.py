#!/usr/bin/env python3
"""SIDEBAND one-story-per-turn engineering loop. Python stdlib only.

This orchestrates a coding agent; it does NOT generate an app by itself.
No cloud model is invoked unless --allow-remote-agent is explicitly passed.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STATE = ROOT / 'tasks.json'
PROGRESS = ROOT / 'progress.md'
PROMPT_PATH = ROOT / 'agent' / 'current-task-prompt.md'
OUTPUT_PATH = ROOT / 'agent' / 'agent-output.log'
VALID_STATUSES = {'pending', 'in_progress', 'complete'}


def state():
    data = json.loads(STATE.read_text(encoding='utf-8'))
    if data.get('schema') != 1 or not isinstance(data.get('tasks'), list):
        raise ValueError('Invalid tasks.json schema')
    return data


def save(data):
    tmp = STATE.with_suffix('.json.tmp')
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    tmp.replace(STATE)


def record(message):
    stamp = dt.datetime.now().astimezone().isoformat(timespec='seconds')
    with PROGRESS.open('a', encoding='utf-8') as f:
        f.write(f'\n### {stamp}\n{message.rstrip()}\n')


def pending_task(data):
    for item in data['tasks']:
        if item['status'] not in VALID_STATUSES:
            raise ValueError('Unrecognized task status')
        if item['status'] != 'complete':
            return item
    return None


def prior_approved(data, phase):
    phases = data['phases']
    if phase not in phases:
        raise ValueError('Unknown phase')
    idx = phases.index(phase)
    if idx == 0:
        return True
    previous = phases[idx - 1]
    return previous in data.get('approvals', {})


def gate_blocker(data, task):
    if not task:
        for phase in data['phases']:
            if phase not in data.get('approvals', {}):
                return phase
        return None
    if not prior_approved(data, task['phase']):
        phases = data['phases']
        return phases[phases.index(task['phase']) - 1]
    return None


def describe(task):
    return (f"{task['id']} | {task['title']}\n"
            f"{task['objective']}\n"
            + '\n'.join('  - '+x for x in task['acceptance']))


def prompt_for(task):
    seed = (ROOT / 'agent' / 'ITERATION_PROMPT.md').read_text(encoding='utf-8')
    checks = '\n'.join('  * '+c for c in task['commands'])
    return (seed + '\n\n## ASSIGNED STORY\n' + describe(task) +
            '\n\n## REQUIRED FILES\n' + '\n'.join('- '+p for p in task['required_files']) +
            '\n\n## MACHINE CHECKS\n' + checks +
            '\n\nIMPORTANT: One story per iteration; use original design and locally hosted app only. '
            'Do not approve phase gates, fabricate test results, publish, or alter task status.\n')


def check(task, timeout):
    errors = []
    out = []
    for relpath in task['required_files']:
        path = (ROOT / relpath).resolve()
        if not path.is_relative_to(ROOT.resolve()):
            errors.append(f'Unsafe path: {relpath}')
        elif not path.is_file() or path.stat().st_size == 0:
            errors.append(f'Missing or empty: {relpath}')
        else:
            out.append(f'FILE OK {relpath}')
    if errors:
        return False, out + errors
    for command in task['commands']:
        out.append(f'$ {command}')
        try:
            p = subprocess.run(command, cwd=ROOT, shell=True, text=True,
                               stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                               timeout=timeout, errors='replace')
        except subprocess.TimeoutExpired:
            errors.append(f'TIMEOUT after {timeout}s: {command}')
            break
        except OSError as e:
            errors.append(f'COMMAND ERROR {command}: {e}')
            break
        if p.stdout:
            out.append(p.stdout[-4000:])
        out.append(f'EXIT: {p.returncode}')
        if p.returncode != 0:
            errors.append(f'FAIL: {command}')
            break
    return not errors, out + errors


def show_status(data):
    for phase in data['phases']:
        ts = [t for t in data['tasks'] if t['phase'] == phase]
        done = sum(t['status'] == 'complete' for t in ts)
        a = 'APPROVED' if phase in data.get('approvals', {}) else 'not approved'
        print(f'{phase}: {done}/{len(ts)} implementation checks passed | {a}')
    t = pending_task(data)
    blocked = gate_blocker(data, t)
    if blocked:
        print(f'BLOCKED: human review/approval for {blocked} is required.')
    elif t:
        print(f'NEXT: {t["id"]} - {t["title"]}')
    else:
        print('All tasks complete. Review remaining phase approvals and final tests.')


def verify_current(data, seconds):
    t = pending_task(data)
    if t is None:
        print('No unfinished stories.'); return False
    if gate_blocker(data, t):
        print('Phase approval required before this story.'); return False
    print(f'Checking {t["id"]}: {t["title"]}', flush=True)
    success, results = check(t, seconds)
    print('\n'.join(results), flush=True)
    record(f'**{t["id"]} machine checks**: {"PASS" if success else "FAIL"}\n\n'
           + '\n'.join('    ' + line for line in results[-10:]))
    if success:
        t['status'] = 'complete'
        save(data)
        print(f'COMPLETE: {t["id"]} (machine checks only; phase review still required)')
    else:
        t['status'] = 'in_progress'
        save(data)
        print('INCOMPLETE: fix failed checks, then retry.')
    return success


def command_run(data, args):
    if args.agent.endswith('-cloud') and not args.allow_remote_agent:
        raise SystemExit('Cloud agent denied. Add --allow-remote-agent only if you accept remote model processing.')
    for i in range(args.iterations):
        data = state()
        t = pending_task(data)
        if t is None:
            show_status(data); return
        blocked = gate_blocker(data, t)
        if blocked:
            print(f'Phase {blocked} requires human review. Run: python scripts/loop.py approve --phase {blocked} --note "review evidence"')
            return
        prompt = prompt_for(t)
        PROMPT_PATH.parent.mkdir(parents=True, exist_ok=True)
        PROMPT_PATH.write_text(prompt, encoding='utf-8')
        t['status'] = 'in_progress'
        save(data)
        if args.agent == 'manual':
            print(f'Prompt written: {PROMPT_PATH.relative_to(ROOT)}')
            print(f'TASK: {t["id"]} - {t["title"]}\nPaste prompt into your coding agent; after implementation run: python scripts/loop.py verify')
            return
        if args.agent in ('codex-local', 'codex-cloud'):
            exe = 'codex'
            cmd = [exe, 'exec', '--sandbox', 'workspace-write']
            if args.agent == 'codex-local':
                cmd += ['--oss', '--local-provider', 'ollama']
            cmd += ['-']  # stdin carries prompt; avoids blocking extra stdin reads
        else:
            exe = 'claude'
            cmd = [exe, '-p', '--permission-mode', 'acceptEdits']
        if not shutil.which(exe):
            print(f'{exe} not found. Use manual mode or install/configure the requested CLI.')
            return
        print(f'ITERATION {i+1}/{args.iterations}: {t["id"]} via {args.agent}', flush=True)
        try:
            result = subprocess.run(cmd, input=prompt, cwd=ROOT, text=True,
                                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                    timeout=args.agent_timeout, errors='replace')
        except subprocess.TimeoutExpired:
            record(f'**{t["id"]}** agent timed out after {args.agent_timeout}s; no completion claim.')
            print('Agent timed out. Story remains in_progress; inspect repo and logs.')
            return
        except OSError as e:
            print(f'Agent failed to launch: {e}'); return
        OUTPUT_PATH.write_text(result.stdout or '', encoding='utf-8')
        print((result.stdout or '')[-1600:])
        if result.returncode:
            record(f'**{t["id"]}** agent exited nonzero ({result.returncode}). Fix before retry.')
            print('Agent returned nonzero; story remains in_progress.'); return
        print('Running mandatory checks...', flush=True)
        if not verify_current(state(), args.check_timeout):
            return
        time.sleep(.1)
    show_status(state())


def main():
    os.chdir(ROOT)
    parser = argparse.ArgumentParser(description='SIDEBAND engineering loop — one validated story at a time')
    sub = parser.add_subparsers(dest='action', required=True)
    sub.add_parser('status')
    sub.add_parser('next')
    v = sub.add_parser('verify'); v.add_argument('--check-timeout', type=int, default=600)
    r = sub.add_parser('run')
    r.add_argument('--agent', choices=['manual', 'codex-local', 'codex-cloud', 'claude-cloud'], default='manual')
    r.add_argument('--iterations', type=int, default=1)
    r.add_argument('--check-timeout', type=int, default=600)
    r.add_argument('--agent-timeout', type=int, default=3600)
    r.add_argument('--allow-remote-agent', action='store_true')
    a = sub.add_parser('approve')
    a.add_argument('--phase', required=True, choices=['P0','P1','P2','P3','P4','P5'])
    a.add_argument('--note', required=True)
    args = parser.parse_args()
    data = state()
    if args.action == 'status':
        show_status(data)
    elif args.action == 'next':
        t = pending_task(data)
        if t:
            print(describe(t))
        else:
            print('All implementation stories complete.')
        if gate_blocker(data,t):
            print('STOP: prior phase approval required.')
    elif args.action == 'verify':
        ok = verify_current(data, args.check_timeout)
        sys.exit(0 if ok else 1)
    elif args.action == 'run':
        if args.iterations < 1 or args.iterations > 100:
            raise SystemExit('--iterations must be 1..100')
        command_run(data,args)
    elif args.action == 'approve':
        if args.phase in data.get('approvals', {}):
            raise SystemExit('Already approved.')
        if len(args.note.strip()) < 15:
            raise SystemExit('Approval note must identify specific evidence (15+ characters).')
        if any(t['status'] != 'complete' for t in data['tasks'] if t['phase'] == args.phase):
            raise SystemExit('Cannot approve: phase tasks still incomplete.')
        if not prior_approved(data, args.phase):
            raise SystemExit('Approve earlier phases first.')
        data.setdefault('approvals', {})[args.phase] = dict(note=args.note,at=dt.datetime.now().astimezone().isoformat())
        save(data)
        record(f'**HUMAN PHASE APPROVAL {args.phase}**: {args.note}')
        print(f'Human approval recorded: {args.phase}')

if __name__ == '__main__':
    main()
