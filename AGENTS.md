---
last-verified: 2026-05-22
verifies: [".github/workflows/claude.yml", ".github/workflows/claude-agentic-dod.yml", "scripts/llm/check-tool-surface.mjs"]
---

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Agent rules — cheap-shot-hockey

Behavioral rules for all Claude agents (CLI, GitHub app, Agent SDK) working in this repo.
Read CLAUDE.md first for project context. These rules govern *how* to operate.

## Definition of done (enforced, not advisory)

Every PR that touches `src/` must satisfy all three before the branch is pushed:

1. `npm run test:coverage` — all metrics ≥ 90%. If coverage drops, write the missing tests. Do not fake coverage to hit the number.
2. `git diff --name-only main | ./scripts/mabl-suggest-tests.sh` — if existing mabl tests match changed files, list them in the PR description under "Test impact".
3. New UI pages or API routes → create a mabl test via MCP (`plan_new_test` → `create_mabl_test_cloud`) and cut a follow-up Jira ticket. Note both in the PR description.

## Tool selection

- Use MCP tools (`mcp__mabl__*`, `mcp__atlassian__*`) for all mabl and Jira operations — never raw curl unless the MCP tool doesn't exist for the operation.
- Use `gh` CLI for all GitHub operations (PRs, issues, checks) — not raw GitHub API.
- Use `scripts/ci-notify.sh` format for any CI notification messages — never invent a different format.
- Use `scripts/mabl-deployment.sh` to trigger mabl plan runs from the CLI — not raw curl against `/events/deployment`.

## Commit and branch discipline

- One Jira ticket per distinct piece of work. Bug found while fixing TAMD-N? New ticket, not TAMD-N.
- Branch naming: `TAMD-<N>/<short-slug>` (e.g. `TAMD-88/shipping-mabl-test`)
- Commit prefix: `TAMD-<N>: ` matching the branch ticket
- Never amend a commit that has been pushed. Create a new one.
- Auto-merge every PR immediately after opening: `gh pr merge <N> --auto --merge --delete-branch`

## Error handling

- Tool call fails → retry once with adjusted parameters, then surface the error to the user with what you tried and why it failed.
- Coverage gate fails and you can't identify the right tests → say so explicitly. Do not write trivial tests that hit lines without asserting behavior.
- mabl test creation fails → cut a Jira ticket to track the gap, note it in the PR body, and continue.
- CI gate fails → use `mcp__mabl__analyze_failure` to triage before escalating to the user.

## Data safety rules

- Never change seed credentials (`demo@cheapshot.test / demo1234`, `admin@cheapshot.test / admin1234`).
- Never move cart or recent-orders state out of cookies into the in-memory store.
- Never require authentication for checkout.
- Always reset demo mode after any test that flips it: `./scripts/demo-toggle.sh normal`.
- `?demo=broken` makes production return 503s — treat resetting this as urgent if left on.

## Narration (ticket-to-prod demos)

Follow `docs/MCP-NARRATION-PLAYBOOK.md` exactly when narrating CI events to Slack/Jira.
Key invariants: one thread per Jira ticket, kickoff at channel level only, all subsequent posts as thread replies, forward mabl's native Slack posts into the thread.

## Agentic surface — hardened gates

Three Claude-driven jobs run on this repo. They are intentionally narrow.
`scripts/llm/check-tool-surface.mjs` runs in the lint gate on every PR and
fails the merge if any of these contracts regress.

### 1. `@claude` action (`.github/workflows/claude.yml`)
- Trigger: a comment containing `@claude` on an issue, PR, or review.
- **Author gate**: only `OWNER`, `MEMBER`, or `COLLABORATOR` associations
  pass the `authorize` job. Drive-by comments from random GitHub users
  silently no-op.
- **Default tools**: read-only (`Read,Glob,Grep,WebFetch,WebSearch` plus
  read-only `mcp__mabl__*` and `mcp__atlassian__*`).
- **Write mode**: requires the comment to contain `/claude write` AND the
  commenter to be `OWNER` or `MEMBER`. Adds `Edit,Write,Bash(npm run *),
  Bash(git *),Bash(gh *)` and the mabl/atlassian *create_* tools.
- **Model**: `claude-opus-4-7` pinned via `--model` in `claude_args`.
- **Action**: SHA-pinned to `anthropics/claude-code-action@<40-char SHA>`,
  never `@beta` or `@v1`.

### 2. Definition-of-done check (`.github/workflows/claude-agentic-dod.yml`)
- Trigger: PR opened, synchronized, or reopened against `main`.
- **Same-repo only**: fork-head PRs are skipped (no secrets exposure).
- **Analysis-only**: tools are `Read,Glob,Grep` + tightly scoped
  `Bash(npm run *)`, `Bash(git diff *)`, `Bash(./scripts/mabl-suggest-tests.sh *)`
  + read-only `mcp__mabl__*` / `mcp__atlassian__*`. No `Edit`, no `Write`,
  no `*_create_*` — gaps are listed in the PR comment, not fixed in place.
- Same model and action pinning as `@claude`.

### 3. No autonomous post-deploy recovery agent in v1
v1 deliberately does NOT include an LLM-driven recovery agent on
post-deploy failure. A real prod-side failure fires the deterministic
"Prod post-deploy failed" Slack notification and stops; humans
triage. An earlier implementation (read-only `Read,Grep,Glob` tools,
SDK `query()` loop, structured JSON recommendation, cost receipt) is
preserved at git tag `archive/recovery-agent-and-receipts-v1` and can
be reinstated by a fork that has an `ANTHROPIC_API_KEY` available.

### What `scripts/llm/check-tool-surface.mjs` enforces
- Action references are SHA-pinned (40-char hex).
- `--model` is present and looks pinned (no `@latest`, `@beta`, `@v1`).
- `READ_ONLY_TOOLS` and `DOD_ANALYSIS_TOOLS` contain no `Edit`, `Write`,
  `mcp__*__create_*`, `mcp__*__add_jira_comment`, `mcp__mabl__plan_new_test`,
  `mcp__mabl__run_mabl_test_cloud`, or bare `Bash` (without paren-restricted args).
- `claude.yml` has an `author_association` gate with `OWNER`, `MEMBER`,
  `COLLABORATOR`, and the `/claude write` escalation phrase.
- `claude-agentic-dod.yml` restricts to same-repo PRs.

**If you intentionally widen the surface, update `check-tool-surface.mjs`
in the same PR so the contract stays explicit and reviewable.**
