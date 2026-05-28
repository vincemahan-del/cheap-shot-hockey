# Worked example — TAMD-152 ticket-to-prod run

> **Companion to [`SDLC-DEMO.md`](SDLC-DEMO.md).** The SDLC doc explains
> how the architecture is supposed to work. This doc is a real run that
> happened on **2026-05-28**, with every artifact linked so you can
> click through and inspect what each piece actually did.

## TL;DR

A small UX fix shipped from "create ticket" to "verified live on prod" in **5 minutes of lead time**, fully autonomous — **0 human touches**, **0 manual reruns**, 13/13 CI gates green, mabl post-deploy verification confirmed on real production. Total cost: **9 min 52 s** of GHA compute across 5 workflow runs.

## What shipped

[**TAMD-152**](https://mabl.atlassian.net/browse/TAMD-152) — *"Add free-shipping qualified state to cart progress indicator + extract logic to lib helper."*

Three files, +33 / −17 LOC:

- `src/lib/shipping.ts` *(new)* — pure helper returning `{ qualified, remainingCents, progressPercent }`
- `src/lib/shipping.test.ts` *(new)* — boundary tests
- `src/app/cart/page.tsx` *(modified)* — uses the helper, renders a persistent qualified-state element, standardizes `data-testid` naming

**Try it live:**

1. Add a single cheap item to your cart at <https://cheap-shot-hockey.vercel.app/products/coldfire-rookie-wood-stick>
2. Visit <https://cheap-shot-hockey.vercel.app/cart> — progress bar partially filled, `data-qualified="false"`
3. Add the <https://cheap-shot-hockey.vercel.app/products/apex-velocity-pro-stick> stick (over $99)
4. Reload `/cart` — progress bar full, `data-qualified="true"`, qualified-state element rendered

## Every stage, with links

| Stage | Result | Inspect |
|---|---|---|
| **Jira ticket** | [TAMD-152](https://mabl.atlassian.net/browse/TAMD-152) created · auto-transitioned To Do → In Progress → Done | Created via Atlassian MCP from the main agent; transitioned by [`scripts/ci-notify.sh`](../scripts/ci-notify.sh) |
| **Branch + PR** | `TAMD-152/free-shipping-progress` → [PR #130](https://github.com/vincemahan-del/cheap-shot-hockey/pull/130) | Auto-merge armed at open time via `gh pr merge 130 --auto --merge --delete-branch` |
| **Local DoD gates** | Coverage **96.08%** stmts · lint clean · blast-radius `low` (+33/−17, no high-risk surfaces) | Enforced by the [`demo-orchestrator`](../.claude/agents/demo-orchestrator.md) subagent per [`AGENTS.md`](../AGENTS.md) before push |
| **CI gates (13/13 green)** | All required checks passed | [mabl SDLC gate (PR)](https://github.com/vincemahan-del/cheap-shot-hockey/actions/runs/26583641560), [CodeQL](https://github.com/vincemahan-del/cheap-shot-hockey/actions/runs/26583641411), [Claude DoD analysis](https://github.com/vincemahan-del/cheap-shot-hockey/actions/runs/26583641564), [auto-fix](https://github.com/vincemahan-del/cheap-shot-hockey/actions/runs/26583641406), [blast-radius gate](https://github.com/vincemahan-del/cheap-shot-hockey/actions/runs/26583641410) |
| **Merge** | Commit [`0611a411`](https://github.com/vincemahan-del/cheap-shot-hockey/commit/0611a41159357ccdd1465ae3488f6f9381d6236f) at 15:18:53Z | GitHub merge commit |
| **Prod deploy** | Vercel auto-deployed, commit `0611a411` | <https://cheap-shot-hockey.vercel.app/api/build-info> confirms |
| **Post-deploy verify** | [mabl `CSH-SMOKE-POSTDEPLOY`](https://github.com/vincemahan-del/cheap-shot-hockey/actions/runs/26583923284) green in 1m 14s on real prod | Same gate format as PR, different env + label |
| **Slack narration** | [Kickoff post](https://mablhq.slack.com/archives/C0A321B477Y/p1779981334042459) + autoposts + `:receipt:` | `#vince-agentic-workflow-demos` |
| **Cycle-time receipt** | `lead=5m gha=9m 52s runs=5` | Computed by [`scripts/cycle-time-receipt.sh`](../scripts/cycle-time-receipt.sh) — fully deterministic, no LLM |
| **mabl coverage gap** | [TAMD-153](https://mabl.atlassian.net/browse/TAMD-153) cut to track new mabl test for the qualified-state transition | Follow-up tracked separately so it doesn't block the feature ship |
| **Live verification** | `data-qualified="false"` at $19.99 → `data-qualified="true"` at $199.99 | DevTools on <https://cheap-shot-hockey.vercel.app/cart> |

## How the pieces fit (the architecture story)

This isn't a monolithic "Claude does everything" loop. The architecture is **deterministic by default, agentic at specific decision points** — and the LLM scope is bounded by code, not by prompt.

### Deterministic (no LLM, no surprises)

Runs on every PR regardless of who or what opened it. Same gates a human PR would face.

- [`mabl SDLC gate`](../.github/workflows/mabl-sdlc.yml) — lint → security (`npm audit`) → unit + coverage → build → T1 newman Preview → T1 newman Prod → mabl `CSH-SMOKE-PR` (Preview)
- [`auto-fix`](../.github/workflows/auto-fix.yml) — runs `eslint --fix` on the PR branch; circuit breaker trips after 2 consecutive bot commits
- [`blast-radius gate`](../scripts/orchestrator-plan/detect-blast-radius.js) — flags high-risk paths (`src/lib/auth*`, `.github/workflows/**`, `>200 LOC`, etc.). This change was `low`, so no plan-mode approval was needed.
- [`CodeQL`](../.github/workflows/codeql.yml) — security-extended query suite; required since 2026-05-26 (TAMD-139)
- [`scripts/ci-notify.sh`](../scripts/ci-notify.sh) — same canonical event format on every Slack/Jira post; auto-transitions ticket status on first CI green + post-deploy success
- [`scripts/cycle-time-receipt.sh`](../scripts/cycle-time-receipt.sh) — per-ticket cost + friction receipt at ship time

### Agentic (LLM in the loop, narrow surface)

- [`demo-orchestrator`](../.claude/agents/demo-orchestrator.md) subagent drives the ticket → branch → DoD → push → PR → merge → narration flow
- [`Claude — agentic definition of done`](../.github/workflows/claude-agentic-dod.yml) is **analysis-only** — tools restricted to `Read, Glob, Grep, Bash(npm run *)`, no `Edit`/`Write`/`create_*`. The contract is enforced by [`scripts/llm/check-tool-surface.mjs`](../scripts/llm/check-tool-surface.mjs), which fails the lint gate if the tool surface regresses.
- [`mabl-test-author`](../.claude/agents/mabl-test-author.md) subagent reads `docs/MABL-AI-ASSERTION-PROMPT.md` and enforces a tiered assertion policy (no marketing-copy assertions, ever) when authoring new mabl tests.

### Plan-mode for high blast radius

If [`detect-blast-radius.js`](../scripts/orchestrator-plan/detect-blast-radius.js) flagged the diff as `high` (auth surfaces, CI infra, agent prompts, shared data layer, >200 LOC, removed exports, new dependencies, etc.), the orchestrator would have **paused, posted a structured plan to the Jira ticket, and waited for explicit human approval** before pushing. This change was `low` → fully autonomous.

This is the answer to the "AI just merges to prod?" objection: high-risk changes pause for a human checkpoint **by deterministic rule, not by prompt convention.**

## The cycle-time receipt — why it matters

Every shipped ticket gets a final `:receipt:` Slack post computed by `scripts/cycle-time-receipt.sh`. For TAMD-152:

```
lead=5m gha=9m 52s runs=5
```

What that captures, all auditable from the channel history:

- **Lead time** — PR-open to merged
- **GHA minutes** — total CI compute across every workflow run on the PR
- **CI attempts** — split by `failure` vs `success`; surfaces "this PR took 4 attempts" friction
- **Human touches** — review count + manual rerun count; says `fully autonomous` only when nothing humans did

ROI isn't a slide deck — it's a deterministic Slack message in channel history, trending over time.

## What this is NOT

To pre-empt the obvious objections:

- **Not "LLM merges to prod."** Branch protection still requires 7 checks. `scripts/llm/check-tool-surface.mjs` blocks merge if the LLM action contract widens.
- **Not "AI writes tests and you trust it blindly."** The mabl test contract is policy-enforced by the `mabl-test-author` subagent against `docs/MABL-AI-ASSERTION-PROMPT.md`. New mabl tests must be tier-tagged (STRUCTURAL or BUSINESS-LOGIC) and follow `CSH-<TYPE>-<MODULE>-<PLATFORM>-<Outcome>` naming.
- **Not "no humans needed."** Post-deploy failure is deliberately **not** autonomous in v1. If `CSH-SMOKE-POSTDEPLOY` fails on `main`, you get a Slack alert and a human triages. An earlier LLM-driven recovery agent is preserved at git tag `archive/recovery-agent-and-receipts-v1` and can be reinstated by a fork with `ANTHROPIC_API_KEY`.
- **Not magic.** Every gate is a real workflow file in `.github/workflows/` you can read. Every script is checked in. No hidden state.

## Reproduce it

You can run this same flow on any small change:

```bash
# In Claude Code, inside this repo:
# "ship a small change end-to-end through the agentic ticket-to-prod pipeline"
# The demo-orchestrator subagent will drive it.
```

For the customer-facing 20–30 min walkthrough, follow [`SDLC-DEMO.md`](SDLC-DEMO.md). For the post-deploy failure path (what happens when prod actually breaks), see the "Post-deploy failure response" section of [`CLAUDE.md`](../CLAUDE.md).

## Related docs

- [`SDLC-DEMO.md`](SDLC-DEMO.md) — current customer demo runbook (20–30 min)
- [`AGENTIC-SHIFT-LEFT.md`](AGENTIC-SHIFT-LEFT.md) — the architecture-level story (why agentic, not just AI-assisted)
- [`MERGE-POLICY.md`](MERGE-POLICY.md) — source of truth for required PR checks
- [`MABL-API-TESTS.md`](MABL-API-TESTS.md) — naming conventions and plan-label routing for mabl tests
- [`MABL-AI-ASSERTION-PROMPT.md`](MABL-AI-ASSERTION-PROMPT.md) — the tiered assertion policy
- [`CLAUDE-AGENTS.md`](CLAUDE-AGENTS.md) — how the three repo subagents (`demo-orchestrator`, `pr-reviewer`, `mabl-test-author`) work together
