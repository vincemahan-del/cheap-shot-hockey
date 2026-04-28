# Recovery-agent eval harness

Frozen-fixture eval suite for `scripts/recovery-agent/index.js`. Answers
the customer question *"how do you know it works?"* with a number.

## What it does

Each fixture in `fixtures/<scenario>/` is a snapshot of what the
recovery agent's `./logs/` directory would look like for one specific
failure shape. The runner:

1. Sets up env vars to point the agent at that fixture's logs
2. Spawns `scripts/recovery-agent/index.js`
3. Reads the agent's output JSON (`recovery-result.json`)
4. Compares it to `fixtures/<scenario>/expected.json` (the rubric)
5. Reports per-fixture pass/fail + aggregate score

If all fixtures pass: exit 0. If any fail: exit 1, with the specific
rubric mismatches printed.

## Fixtures

| Scenario | Expected decision | Tests for |
| --- | --- | --- |
| `clean-revert` | revert | Single recent merge introduces a CSS-class rename, smart-heal fails, previous runs all green → mechanical revert |
| `demo-toggle` | page-human (looks_like_demo_toggle) | `/api/health` returns 503 with `mode:broken`, recent merge couldn't cause a global 503 → demo toggle, not regression |
| `mabl-flake` | page-human (looks_like_flake) | No deploy since last green, 94% historical pass rate, only commit is patch eslint-config bump → flake, retry |
| `multi-commit-confusion` | page-human (low confidence) | 5 commits in 30 min, three could plausibly cause auth 500 → can't isolate, page human |
| `forward-fix-obvious` | forward-fix | Single commit added `MABL_TIMEOUT_MS` reference but didn't define the env var → mechanical fix, not revert |

## Running locally

Requires `ANTHROPIC_API_KEY` in env (the harness invokes the real
Agent SDK, no stubbing).

```bash
export ANTHROPIC_API_KEY=sk-ant-...
node evals/recovery-agent/run.js
```

Each fixture takes ~10-30s (one Claude call + tool iterations). All
five together is typically ~1-2 min.

## Adding a fixture

1. Create `fixtures/<scenario-name>/` with these files:
   - `gha-run.log` — what `gh run view --log-failed` would output
   - `recent-commits.txt` — `git log --oneline -10`
   - `last-commit.txt` — `git show --stat HEAD`
   - `build-info.json` — live `/api/build-info` response (or error)
   - `health.json` — live `/api/health` response (or error)
   - `mabl-plan-run.json` — mabl plan-run details (or `{"note":"..."}`)
2. Add `expected.json` with this shape:
   ```json
   {
     "scenario": "<name>",
     "description": "1-2 sentences explaining the right behavior",
     "rubric": {
       "decision": "revert | forward-fix | page-human",
       "confidence_acceptable": ["high", "medium"],
       "looks_like_flake": false,
       "looks_like_demo_toggle": false,
       "suggested_revert_sha_required": false,
       "suggested_revert_sha_must_match": null,
       "suggested_fix_summary_required": false,
       "reasoning_must_mention_any_of": ["keyword1", "keyword2"]
     }
   }
   ```
3. Re-run the suite to verify.

## Rubric semantics

- `decision`: must match exactly
- `confidence_acceptable`: actual must be in this list (set to `["low", "medium", "high"]` if you don't care)
- `looks_like_flake`, `looks_like_demo_toggle`: boolean equality
- `suggested_revert_sha_required: true`: actual must be non-null
- `suggested_revert_sha_must_match`: actual's first 7 chars must match this value's first 7 (full SHA matching is too strict; agents may write the merge commit's short or long form)
- `suggested_fix_summary_required: true`: actual must be non-null
- `reasoning_must_mention_any_of`: case-insensitive substring match against actual reasoning; at least one keyword must hit

## CI

`.github/workflows/recovery-agent-evals.yml` runs this suite:

- On push or PR that touches `scripts/recovery-agent/**` or `evals/recovery-agent/**`
- On a nightly cron (catches drift if Claude model behavior changes)
- Skips with a noop if `ANTHROPIC_API_KEY` isn't set as a repo secret

## Known limitations (v1)

- **No variance tracking.** Each fixture runs once per CI cycle.
  Real evals would run each fixture 3-5 times and check consistency.
- **No adversarial fixtures.** No prompt-injection-in-logs cases, no
  malformed-JSON cases. The agent's fail-safe behavior on those is
  documented but not yet eval-tested.
- **No orchestrator evals.** The interactive Claude Code subagents
  (`demo-orchestrator`, `pr-reviewer`, `mabl-test-author`) aren't
  eval'd here — they need a different harness because they're
  human-prompt-driven.

These are sequenced as v2 follow-ups to TAMD-106.
