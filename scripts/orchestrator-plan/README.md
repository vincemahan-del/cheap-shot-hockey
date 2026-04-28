# Orchestrator plan-mode

The "AI proposes, human disposes" gate. When the orchestrator subagent
is about to open a PR for a change that touches a **high-blast-radius**
surface, it pauses, builds a plan, posts it to Jira for human review,
and waits for explicit approval before continuing.

This closes the customer objection: *"wait, AI just merges to prod?"*
Answer: *"no — high-risk changes pause for a human, by deterministic
detection rules, before the agent even opens the PR."*

## What's in here

| File | Purpose |
| --- | --- |
| [`detect-blast-radius.js`](detect-blast-radius.js) | Pure deterministic detector. Reads `git diff --numstat <base>` and emits structured JSON: `{blast_radius, reasons, diff_summary, files_by_category}`. No LLM calls. |
| [`post-plan.sh`](post-plan.sh) | Deterministic Jira poster. Takes plan body on stdin + ticket key as arg, posts as a wiki-markup comment with a "Plan-mode review" header and Approved/Reject reply instructions. |

## High-blast-radius categories (v1)

| Category | Path patterns | Why it's high-risk |
| --- | --- | --- |
| `auth` | `src/lib/auth*`, `src/lib/session*`, `src/app/api/auth/**` | Authentication mistakes are quiet, customer-affecting, and often security-sensitive |
| `api_contract` | `src/app/api/openapi/**`, `mabl/postman/**` | Breaking the contract breaks every API consumer including mabl tests |
| `ci_infra` | `.github/workflows/**`, `scripts/ci-notify.sh`, `scripts/install-git-hooks.sh` | A bad workflow change can lock the entire team out of merging |
| `agents` | `scripts/recovery-agent/**`, `scripts/orchestrator-plan/**`, `.claude/agents/**`, `evals/recovery-agent/**` | Agent system-prompt regressions are extremely hard to detect without evals |
| `store` | `src/lib/store.ts`, `src/lib/seed.ts`, `src/lib/types.ts` | Shared data layer — every page/route depends on these |
| LOC threshold | total `git diff --numstat` lines > 200 | Large changes are hard to review thoroughly, even when path categories are low-risk |

If **any** of the above hits, blast radius is `high`. Otherwise it's `low`.

## Usage from the orchestrator

The flow inserted into [`.claude/agents/demo-orchestrator.md`](../../.claude/agents/demo-orchestrator.md):

```
1. Create Jira ticket
2. Branch off main
3. Make code change
4. → run blast-radius detector ←
   if blast_radius == "high":
     a. Build a plan covering: intent, change summary, risk areas,
        rollback plan, test coverage
     b. Post plan to Jira via post-plan.sh
     c. STOP. Tell the user the plan was posted; ask them to read it
        in Jira and reply with "Approved" or "Reject: <reason>"
   if blast_radius == "low":
     continue to step 5
5. Run pre-PR DoD (coverage, mabl impact)
6. Commit + push + PR
```

Manual invocation for debugging:

```bash
# Run the detector against current uncommitted changes vs main
node scripts/orchestrator-plan/detect-blast-radius.js --base main

# Custom LOC threshold (e.g. for a strict change)
node scripts/orchestrator-plan/detect-blast-radius.js --base main --loc-threshold 100

# Post a plan manually
echo "Intent: ...
Change summary: ...
Risk areas: ..." | scripts/orchestrator-plan/post-plan.sh TAMD-NNN
```

## Plan structure (recommended)

The plan body the orchestrator emits should follow this shape — the
human reviewer scans it in seconds:

```
h2. Intent
1-2 sentences. What problem is this solving?

h2. Change summary
Bullet list of what's being modified. Reference file paths.

h2. Blast-radius reasons
Copy from detector output: `reasons` array.

h2. Risk areas
Specific things that could go wrong. Auth bypass? Schema migration?
Breaking API change? Be honest.

h2. Test coverage
Which existing tests cover this? What new tests are being added?

h2. Rollback plan
If this ships and breaks prod: `git revert <merge-sha>` is enough?
Or does it need a forward-fix?

h2. Approval requested from
Who should approve? (Inferred from CODEOWNERS or stated explicitly.)
```

## v1 limitations

- **Approval is interactive in Claude Code.** The plan posts to Jira
  for the audit trail, but the actual "approved" reply happens in the
  Claude Code session, not via a Jira workflow transition. v2 wires
  the orchestrator to poll for a "Plan Approved" Jira transition.
- **No CODEOWNERS integration.** The plan doesn't auto-`@`-mention
  reviewers based on which paths are touched. v2 reads `.github/CODEOWNERS`.
- **Blast-radius rules are repo-specific.** Customers forking will
  edit `HIGH_BLAST_PATTERNS` in `detect-blast-radius.js` to match
  their codebase's risk surfaces. The pattern is portable; the
  specific paths aren't.
- **Detector runs against working-tree changes**, so it must be
  invoked AFTER the change is made but BEFORE commit/push. The
  orchestrator handles this sequencing.

## CI integration (none, by design)

The detector is *not* wired into the CI pipeline. It runs in the
orchestrator's interactive flow, before the PR exists. Once the PR is
open, the standard 5-required-check gate is the autonomous review.
Plan-mode is the *pre-PR* checkpoint; CI is the *post-PR* checkpoint.
Two different surfaces with two different purposes.
