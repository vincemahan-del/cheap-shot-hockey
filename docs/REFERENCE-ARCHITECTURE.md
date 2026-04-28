# Reference architecture — agentic SDLC

This is the architectural pattern. The walkthrough is in
[`docs/FORK-GUIDE.md`](FORK-GUIDE.md). The customer demo runbook is in
[`docs/SDLC-DEMO.md`](SDLC-DEMO.md).

## What this is

A reference implementation of an **agentic-by-default software delivery
lifecycle**: one prompt to Claude Code drives a Jira ticket all the way
to production, with mabl gating browser-layer correctness at the right
moments. The pipeline is mostly *workflow* (deterministic, gated, audit-
able) with *agents* only at the edges where the work is genuinely open-
ended (failure diagnosis, test authoring, code review).

This split — workflow for predictable gates, agents for open-ended
problems — is the central design principle. It comes directly from
Anthropic's published guidance on building agents.

## In one screen

```
┌──────────────────────────────────────────────────────────────────────┐
│  Claude Code (interactive)                                           │
│   • CLAUDE.md project conventions                                    │
│   • 3 subagents:  demo-orchestrator · pr-reviewer · mabl-test-author │
│   • MCP servers:  mabl · Jira · Slack · GitHub (gh)                  │
└──────────────────────────────────────────────────────────────────────┘
                               │ creates Jira ticket, branch, PR
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  GitHub Actions  (.github/workflows/mabl-sdlc.yml — primary CI)      │
│                                                                      │
│   PR  →  lint · security (advisory) → unit + 90% coverage gate →     │
│        → build                                                       │
│        → T1 newman smoke (Preview, vs Vercel preview deploy)         │
│        → mabl <PREFIX>-SMOKE-PR (Preview, type-smk,exec-pr)          │
│        → test-impact-analysis (advisory PR comment)                  │
│        → claude-code-action DoD                                      │
│                                                                      │
│   Branch protection: 5 required checks · auto-merge armed per PR     │
│                                                                      │
│   main push (after auto-merge) →                                     │
│        → Vercel prod deploy (auto)                                   │
│        → T1 newman smoke (Prod)                                      │
│        → mabl <PREFIX>-SMOKE-POSTDEPLOY (Prod)                       │
│        → on failure: recovery-agent (Read/Grep/Glob — advisory)      │
└──────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│  Notification fan-out  (scripts/ci-notify.sh at every gate)          │
│   • Slack: demo channel, root-level, [TICKET-XX] prefix              │
│   • Jira: gate-by-gate comment on the ticket                         │
│   • Auto-transition: To Do → In Progress (Stage 1 green)             │
│                      In Progress → Done (post-deploy green)          │
└──────────────────────────────────────────────────────────────────────┘
```

## The four-phase pipeline

This pattern mirrors [mabl's published architecture](https://www.mabl.com/blog/how-we-built-a-system-for-ai-agents-to-ship-real-code-across-75-repos) for shipping AI-assisted code across 75+ repos. Same shape, packaged for customer adoption with two extensions (recovery agent + eval harness) that mabl's posts don't cover.

| Phase | What happens | Surface | Human gate? |
| --- | --- | --- | --- |
| **1. Analysis** | Read ticket, scan `CLAUDE.md`, identify affected files, surface open questions | Interactive Claude Code (orchestrator subagent) | No — agent autonomous |
| **2. Planning** | Detect blast radius (path-based + LOC); for high-risk changes, emit a structured plan to Jira and pause | Interactive Claude Code + `scripts/orchestrator-plan/` | **Yes for high-blast-radius changes** |
| **3. Implementation** | Code changes, pre-PR DoD (coverage gate, mabl impact analysis), commit, push, PR opened, auto-merge armed | Interactive Claude Code → GHA pipeline | No — gated by CI |
| **4. Review** | 5 required CI checks (lint, security, unit, build, T1, mabl), AI code review, **mandatory human approval at merge** | GHA pipeline + branch protection + reviewer policy | **Yes at merge** |

Plan-mode (Phase 2) is path-based in v1 — matches `src/lib/auth/**`, `src/app/api/openapi/**`, `.github/workflows/**`, agent system prompts, and the shared data layer. v2 will add confidence-signal detection (open-question count, breaking-change flags, scope assessment) per mabl's published pattern.

## Where workflows end and agents begin

| Surface | Type | Why this type |
| --- | --- | --- |
| Lint, unit tests, coverage gate, build, newman smoke | Workflow | Deterministic, predictable, auditable. No reason to use an agent. |
| mabl plan execution | Workflow (with AI inside the tests) | The trigger is workflow; the smart-locator healing inside mabl is agentic — but at the test-execution layer, not the gate layer. |
| Branch protection + auto-merge | Workflow | Pure rule evaluation. |
| Jira lifecycle transitions (To Do → In Progress → Done) | Workflow | Triggered by gate transitions; rule-based. |
| Slack/Jira gate notifications | Workflow | Templated messages, deterministic composition. |
| **Failure diagnosis** (recovery-agent) | **Agent** | Open-ended: which gate failed, why, is it flake, is it the toggle, does this need revert or forward-fix? Different every time. |
| **Test authoring** (mabl-test-author subagent) | **Agent** | Plain-English description of a flow → test plan with assertions. Open-ended. |
| **Convention review** (pr-reviewer subagent) | **Agent** | "Does this match the codebase's conventions?" requires context that's hard to express as rules. |
| **Ticket-to-prod orchestration** (demo-orchestrator subagent) | **Agent** | The work the human prompt describes is open-ended — ticket creation, branch naming, code change, PR body, Slack kickoff format. |

## Anthropic best practices encoded here

The pattern follows these published Anthropic principles:

1. **Start with the simplest workflow; only add agents where measurably needed.** Most of the pipeline is workflow because workflow is enough. Agents appear at three points only: orchestration (interactive), test authoring (interactive), and failure diagnosis (autonomous, narrow).

2. **Tool design matters as much as model choice.** The recovery agent's `allowedTools: ['Read', 'Grep', 'Glob']` is enforced at the SDK boundary, not at the prompt level. Customers asking "wait, AI just merges to prod?" get a concrete answer: *no, by tool sandbox*.

3. **Test agents in a sandboxed environment with extensive guardrails.** The recovery agent runs with a 5-minute hard timeout, a task-budget advisory limit, and a fail-safe `page-human` default for any error path (missing API key, malformed JSON output, exception).

4. **File-based memory + CLAUDE.md project conventions.** The orchestrator subagent reads `CLAUDE.md` for project conventions on every invocation — single source of truth that stays in git.

5. **Subagents with separate context windows for context isolation.** Three subagents handle distinct flows; each gets its own context window so a long orchestration session doesn't poison the test-authoring subagent's reasoning.

6. **MCP for tool exposure.** Slack, Jira, mabl, and GitHub are exposed as MCP servers — customers can swap in their own MCP servers without changing the agent code.

## What's autonomous vs what needs a human

Honest split. Customers will press on this.

| Surface | Autonomous? | Needs a human? |
| --- | --- | --- |
| GHA workflow + branch protection + auto-merge | Yes | No |
| Slack + Jira posts at every gate | Yes (via webhook + bot token) | No |
| Jira lifecycle transitions | Yes | No |
| Vercel (or equivalent) deploy on main push | Yes | No |
| Recovery agent diagnosis on post-deploy failure | Yes (read-only sandbox) | No |
| **Initial prompt that starts the orchestrator** | **No** | **Yes** |
| **Acting on the recovery agent's recommendation** (revert PR, fix, etc.) | **No** (deliberate sandbox) | **Yes** |
| Test authoring | Yes (when invoked from interactive Claude Code) | The invocation needs a human |
| Convention review (pr-reviewer subagent) | Yes (when invoked) | The invocation needs a human |

The **interactive Claude Code subagents** need a human prompt to start
them, but everything they kick off is autonomous past that point. For
true headless ticket-to-prod (Jira webhook → orchestrator runs without
a human), the subagent system prompts port to **Agent SDK `query()`**
calls invoked from a webhook handler. That's a separate piece of work.

## Failure modes the architecture is designed for

- **A code regression catches in PR-gate mabl** → the merge button stays
  red, ci-notify posts `:rotating_light:` with mabl's screenshot link.
  Auto-merge stays armed; merge fires when CI re-greens.
- **A code regression escapes to post-deploy** → recovery agent
  diagnoses, posts a recommendation, a human acts. Prod stays broken
  until the human acts — by design, because autonomous prod mutations
  are out of scope for v1.
- **mabl flake** → recovery agent flags `looks_like_flake: true`,
  recommends `page-human`. A retry might pass.
- **The demo `?demo=broken` toggle is on** → recovery agent flags
  `looks_like_demo_toggle: true`, recommends `page-human` with a hint
  to flip the toggle back. (Demo-specific, but the pattern of
  detecting "this isn't really broken, it's intentional" generalizes
  to maintenance windows, scheduled downtime, etc.)
- **`ANTHROPIC_API_KEY` not configured** → recovery agent emits a
  fail-safe `page-human` and exits 0. The architecture works without
  the key; only the live diagnosis loop is gated on it.

## Cost-control: the `MABL_CLOUD_GATE` toggle

mabl cloud runs cost money per PR + per main push. Customers will have different cost profiles, especially during dev iteration or feature build-out where per-PR browser verification isn't worth the bill.

The architecture exposes a single repo variable, `MABL_CLOUD_GATE`:

| Value | Behavior |
| --- | --- |
| `enabled` (or missing) | Default. mabl cloud runs fire on every PR + main push. |
| `disabled` | mabl jobs skip the cloud trigger and exit success. ci-notify posts a clear "paused" message. T1 newman API smoke (local CLI) remains the always-on review surface. |

```bash
# pause cloud runs (cost-control mode)
gh variable set MABL_CLOUD_GATE --body "disabled" --repo OWNER/REPO

# reenable
gh variable set MABL_CLOUD_GATE --body "enabled" --repo OWNER/REPO
```

The toggle is a **repo variable** (not a secret) so it surfaces in run logs and is auditable. No code changes required to flip it. Customers fork and inherit this toggle as part of the reference architecture; it's not specific to this demo.

## What's NOT in v1

The reference architecture deliberately leaves these out for v1 to
keep the surface understandable. Each is a known follow-up:

- **Pluggable notification transports** (Teams, just-Jira, just-GitHub)
  — Slack-only in v1.
- **Recovery agent action surface** — diagnose-only in v1; v2 extracts
  narrow custom MCP tools (`open_revert_pr`, `comment_jira`) so the
  agent can act with sandboxing enforced at the SDK boundary.
- **Plan mode "AI proposes, human disposes"** — for high-blast-radius
  changes (auth, payments, schema migrations) the orchestrator should
  post a plan to Jira and wait for approval before executing.
- **Cost + cycle-time receipt** — a final Slack post per ticket with
  lead time, agent tokens, GHA minutes, and mabl minutes. ROI story.
- **Eval harness** for the orchestrator — Anthropic's "don't ship
  agents you can't measure" advice.
- **Feature-flag wrap by default** — orchestrator wraps net-new UI
  behind a flag, ships at 0%, ramps via follow-up PR.
- **Sigstore / SBOM** — supply-chain attestation; mention only.

These are sequenced in `docs/SDLC-DEMO.md` "Optional enhancements" and
described in conversation history (M5-M8 from the customer-deployable
plan).

## Reading order for a new fork

1. [`docs/REFERENCE-ARCHITECTURE.md`](REFERENCE-ARCHITECTURE.md) (this doc) — what the pattern is and why
2. [`docs/FORK-GUIDE.md`](FORK-GUIDE.md) — how to deploy it on your stack
3. [`docs/SDLC-DEMO.md`](SDLC-DEMO.md) — how to demo it once you have it running
4. [`docs/MCP-NARRATION-PLAYBOOK.md`](MCP-NARRATION-PLAYBOOK.md) — the canonical event format for Slack/Jira posts
5. `CLAUDE.md` (root) — project conventions the agents read
6. `.claude/agents/*.md` — the three Claude Code subagent system prompts
7. `scripts/recovery-agent/system-prompt.md` — the failure-recovery agent's narrow charter
