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
