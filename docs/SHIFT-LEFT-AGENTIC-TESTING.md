# Shift-Left Agentic Testing — Design Brief

**Status:** Draft for discussion · **Date:** 2026-06-29 · **Owner:** Vince Mahan
**Context:** A test-aware coding agent that, on every PR, maps mabl coverage to the change, runs the affected tests, triages failures (real bug vs. outdated test), and proposes the right test edits/additions — fully shift-left, mostly autonomous, human-checkpointed where it matters.

---

## 1. The vision in one paragraph

When a coding agent works a PR, it treats the **mabl workspace as a first-class input**: it figures out which tests cover the functionality being changed, runs them (**locally while iterating; in the cloud at the gate**), and for any failure decides *bug vs. stale test*. Real bug → fix code / fail the gate to a human. Stale test (the requirement legitimately changed) → propose the test edit on a branch for review. Coverage gap → propose a new test, labeled to the ticket. The goal is a closed loop that catches regressions **and** keeps the test suite current, without a human babysitting every step.

## 2. The loop (five phases)

1. **MAP** — resolve which existing tests cover the touched functionality; flag coverage gaps.
2. **PREDICT** *(best-effort, optional)* — reason about which covered tests the diff will likely break, before running.
3. **RUN** — execute the affected tests against the PR's preview deploy (source of truth).
4. **TRIAGE** — classify each failure: **real regression** vs. **intended change → stale test** vs. **flake/infra**.
5. **ACT** — bug → fix/halt; stale → propose test edit (on a branch); gap → author new test; record coverage + traceability.

## 3. The key architectural decision: placement (don't make it all "DoD")

A DoD/CI gate exists to **independently certify** safety. An agent that can both *run the gate* and *edit the tests* is a **self-certifying gate** — it can always go green by rewriting the assertion. So split the loop by property:

| Phase | Home | Why |
|---|---|---|
| ① Map / ② Predict / gap-suggest | **DoD** (pre-PR, advisory) | Cheap, shift-left; shipped as the area-coverage engine (`scripts/shift-left/audit.mjs`), which replaced the `mabl-suggest-tests.sh` heuristic (TAMD-187). |
| ③ Run affected (PR gate) | **CI gate** (`CSH-SMOKE-PR`) | Enforcement belongs in branch protection; evolve from fixed → diff-relevant set. |
| ③′ Run affected (dev inner loop) | **Local, pre-PR** (`mabl tests run --labels <area> --headless`) | Fast feedback, preserves cloud credits; over-inclusive + advisory, *not* a gate. |
| ④ Triage + ⑤ edit/create | **Separate proposing agent** (NOT a gate step) | Keeps the test-editor distinct from the gate; output = a reviewable branch diff. |
| Workspace-wide gap hunting / drift | **Nightly** (`type-rt`) | Doesn't need to block a PR. |
| Trivial selector drift | **mabl runtime** (auto-heal / Runtime Recovery Agent) | Already handled — don't rebuild. |

**Principle: the authority that enforces the gate must be separate from the authority that maintains the tests.** This repo already embodies it — the agentic-DoD check is analysis-only (`Read,Grep,Glob`, no `Edit/Write`), and the post-deploy recovery agent was deliberately *removed* in v1.

### Two execution tiers — the missing inner loop

The PR smoke gate is intentionally shallow. The **developer inner loop** needs its own execution tier — run **locally** for fast feedback and credit preservation, *before a PR exists*. This is the part that makes the workflow usable day-to-day, and the brief's biggest addition.

- **Inner loop (local, pre-PR) — intelligent selection + local run.** diff → map to `area-*` label(s) → `mabl tests run --labels <area> --headless` against `localhost:3000` (or a preview). Runs on the dev's machine, fast, and reserves cloud runner credits for the gate. Already wrapped here: `scripts/mabl-local-cli.sh` / `npm run test:mabl:browser:local`. Keep it **over-inclusive and advisory** — over-select rather than miss; it informs the dev, it does not gate.
- **Outer loop (cloud, PR / post-deploy) — authoritative.** `CSH-SMOKE-PR` + (future) diff-relevant cloud run; the set branch protection trusts.

**Cost model:** execution cost shifts to the dev's machine during iteration; cloud credits are spent only at the gate. *Caveats:* GenAI assertions still bill even locally (`--allow-billable-features`), and local runs need the app running + credentials resolvable. **Prior art for exactly this split:** Jest `--onlyChanged` / `nx affected` / Bazel tag filters / Launchable's local subset — fast affected-tests locally, full authority in CI. The selection map (leg ①) is shared by both tiers, so improving it helps the inner loop *and* the gate.

## 4. The risk that makes-or-breaks it

**Reward hacking:** an agent that "fixes" a red gate by rewriting the test masks a real regression. The two triage errors are **not symmetric**:

- **False "stale" (really a bug)** → test edited green → **regression ships.** Catastrophic.
- **False "bug" (really stale)** → unnecessary human tap → mild cost.

So bias hard: the bar to *auto-edit a test* is very high (or never, for assertion-value changes); the bar to *tap a human* is very low.

## 5. Reviewer subagent + routing (the human-tap mechanism)

Add an **adversarial, independent** reviewer subagent (Anthropic's *evaluator-optimizer* pattern). It must:
- Be a **skeptic** — try to *refute* "stale"; default to "real regression / tap a human" under doubt.
- Review **two** things: (a) the bug-vs-stale **classification**, and (b) the **edit quality** — catch assertions that were *weakened* to pass (coverage-gutting).
- Route on **risk-tier + signal-agreement**, not a self-reported confidence scalar:

| Change type | Signals | Action |
|---|---|---|
| Selector drift, auto-heal validated | n/a | Auto-apply, log, no human |
| Assertion change, non-required test, **all signals agree**, coverage intact | high agreement | Auto-propose on branch; human optional |
| Assertion change on **required-gate** test · signals disagree · coverage shrinks · intent unclear | low/mixed | **Human, always** — case pre-assembled |

"Signal agreement" = editor says stale **+** mabl Runtime Recovery Agent says `testNeedsUpdate: true` **+** reviewer fails to refute **+** ticket intent matches. **Earn autonomy with data:** start human-heavy, log every (classification, edit, human verdict), widen the auto-band only once precision is proven (ties to the repo's cycle-time/receipt instinct).

## 6. Feasibility with mabl *today* (build / lean-on / wait-for)

Grounded in the mabl PM "MCP Capability Delta" (2026-06-29) and APEX-46.

| Leg | mabl-native primitive | Verdict |
|---|---|---|
| ① Map / coverage | `identify_coverage_gaps`, `search_mabl_tests`, `mabl_find_tests_using_flow`, `area-*` labels | **Lean on mabl** + the area-coverage engine (`scripts/shift-left/audit.mjs`, which superseded `mabl-suggest-tests.sh`). No code-level coverage (black-box) — approximate selection (see Meta TIA). |
| ② Predict | LLM over diff + `mabl_get_test_steps` | **Build** (light); inherently imperfect. |
| ③ Run affected (gate) | `run_mabl_test_cloud`, plans, `trigger_mabl_deployment` | **Lean on mabl** — full support today. |
| ③′ Run local (dev loop) | CLI `mabl tests run --headless --labels <area>` vs localhost/preview | **Lean on mabl** — `scripts/mabl-local-cli.sh` already wraps it; selection by `area-*` label. Caveat: GenAI assertions still bill. |
| ④ Triage | `analyze_failure`, `mabl_result_analysis_chat` (RAA), **`get_runtime_recovery_session`** (TRA → `testNeedsUpdate` + `repairNotes`) | **Lean on mabl** — richest, most differentiated area. Coding agent adds *intent* (ticket) to arbitrate. |
| ⑤ Edit / create | `mabl_authoring_edit` (TAA in-place; gated `AGENTIC_TEST_EDITING`); CLI `mabl agent authoring initiate --test-information '{test_id,…}'` | **Build via CLI today; wait for MCP** — see constraint below. |

**The one real constraint (mabl's own GA-blocker list):** every mutating MCP tool is **last-write-wins to `master`** — no `If-Match`/ETag, no branch isolation (a confirmed case of an agent clobbering a human's Trainer edit). MCP branch tools are **read-only** (no create/merge/delete). So a *safe, branch-isolated* edit step is **not cleanly MCP-native yet** — run it through the **CLI** (has branches; proven in this workspace) or the UI until these land:
- **MABL-20580** — versioning/conflict resolution on edits (GA blocker)
- **MABL-18073** — manage branches via MCP
- **MABL-20586** — MCP parity umbrella
- Also: `mabl_authoring_edit` is **flag-gated** (`AGENTIC_TEST_EDITING`) — enable per workspace to get MCP-native edit.

**Net:** the whole loop is buildable today in a CLI-capable environment (CI / Claude Code). The edit leg uses the CLI for branch isolation until the concurrency/branch tickets ship — which happens to match the safe design (propose-on-branch, human-approve).

## 7. Don't reinvent — the lineage to copy

- **Agent structure → Anthropic, *Building Effective Agents*.** Reviewer-with-feedback = **evaluator-optimizer**; coding agent driving sub-agents = **orchestrator-workers**; bug/stale/flake = **routing**. Rule: simplest thing that works — keep map/run as deterministic workflow, reserve the agent for triage/edit.
- **Which-tests-to-run → Meta Predictive Test Selection.** Learn from historical *(change → which tests failed)*; run ~⅓ of tests, catch 99.9% of regressions. Lesson: a *perfect static code→test map isn't required* — approximate selection + run + triage as the safety net. (Productized by Launchable; MS Azure DevOps ships TIA.)
- **Self-heal / drift-vs-break → mabl is ahead.** Selenium analog = Healenium; Playwright has none native. mabl's **Runtime Recovery Agent** already does the drift-vs-breakage call and emits `repairNotes` — feed straight into the edit. Don't rebuild.
- **Closest working examples — mabl-on-mabl:**
  - **`review-deployment-event` + `mabl-test-edit-verify` skills** (APEX-46): mabl's team already built this exact loop (deploy event → review → edit stale test → verify).
  - **"Daily Customer Issue Triage Automation"** (PM): a scheduled Claude routine — gather → score against a documented framework → auto-act on the top tier → route the rest to humans. Template for the triage step.
  - **This repo's own patterns:** circuit-breaker auto-fix (mirrors mabl's published auto-fix-agent), analysis-only DoD check, blast-radius plan-mode. Reuse as the guardrail substrate.

## 8. Doable-today path

1. **Selection + gaps (shared):** the area-coverage engine (`scripts/shift-left/audit.mjs`) — which replaced `mabl-suggest-tests.sh` and now classifies `messages/*` — backed by `identify_coverage_gaps` + `area-*` labels. This selection feeds the local pre-push hook, the agentic DoD, and the CI `test-impact` job from one source.
2. **Run locally (dev inner loop):** `mabl tests run --labels <selected-area> --headless` vs `localhost:3000` — fast, credit-light feedback while iterating (via `scripts/mabl-local-cli.sh`). Over-select; advisory only.
3. **Run affected (CI gate):** evolve `CSH-SMOKE-PR` from a fixed set → diff-relevant set — authoritative.
4. **Triage (proposing agent):** compose `analyze_failure` + RAA + TRA `repairNotes` as *evidence*; coding agent supplies *intent*; adversarial reviewer + scoring framework set the human-tap threshold.
5. **Edit (CLI, branch-isolated):** `mabl agent authoring initiate --test-information '{test_id,…}'` on a CLI branch → human approves diff → merge code + test together. Migrate to `mabl_authoring_edit` over MCP once `AGENTIC_TEST_EDITING` is on **and** MABL-20580/18073 ship.

**Sequencing constraint:** the TAA authors against the *live app*, so the order is **deploy preview → run → edit-on-branch against that preview → re-run → merge.** The test edit can't precede the code being observable.

## 9. Quality strategy & risks (what makes it real vs. a demo)

Validated on this repo (Phase 1b): the testid/route join is **~53% step-level joinable** (17% GenAI-viewport = route-only, 30% xpath/class/text = unjoinable); **61/228 testids (27%) referenced**, but that's a weak proxy — low partly *by design* (the assertion policy forbids asserting on grid/marketing). Trustworthy outputs = **uncovered routes** (`/shipping`, `/size-guide`, `/team-orders`) and **uncovered flows** (the `qty-*` cart-editing family). Even the code-side denominator needs **AST extraction, not grep** (templated `checkout-${field}` testids evaded the regex). Strategic additions:

1. **Oracle problem (deeper than reward-hacking).** Don't let the agent update a test to agree with whatever the code now does — that turns tests from *spec* into *change-detector*. Hard rule: a test edit must trace to an **intent artifact that predates the code** (ticket/AC); flag edits that make a test agree with code that has *no* requirement change.
2. **Weight coverage by risk × churn, not uniformly.** A gap on `/shipping` ≠ a gap on the payment path. Risk-map the surfaces (money/auth = P0) and overlay git churn; **high-churn × low-coverage is the danger zone** to rank — not raw %.
3. **Suite health is a precondition.** An agentic loop on a flaky suite amplifies noise and burns trust. Measure flake rate (`get_test_quality_report`), quarantine/fix first; make **flake a first-class triage outcome** (cheap rerun-to-confirm before bug-vs-stale).
4. **Bootstrap the substrate (the customer-scale unlock).** The join works only because testids are mandated here. When the agent hits an un-instrumented element, its action is to **propose the testid**. For messy customer apps the *first* deliverable is an "instrument your app" pass — not the coverage map.
5. **Route to the right check *type*.** A CSS diff → visual; a new page → a11y; an API/query change → perf. Exploit mabl's multi-modal edge; "which tests" → "which *kind* of check."
6. **Behavioral gaps, not just structural.** The coverage map is blind to scenarios nobody wrote (error/negative/edge/security). Pair it with scenario enumeration from the OpenAPI spec + flow structure (+ `identify_coverage_gaps`).
7. **Instrument ROI before building + design for trust.** Baseline cloud-minutes/PR, human-maintenance time/PR, escaped defects *now*. Shadow → suggest → act, earning each step with measured precision; every decision shows evidence; one-click "agent was wrong" → training signal.
8. **Auditability + provenance.** Deterministic join/path-map (pure, replayable); LLM only for the semantic tail + triage, with logged inputs. Tag agent-edited vs human-authored assertions (version history) and periodically re-validate agent-touched ones to prevent spec-rot.

**Delivery strategy:** don't build the general system. Build the *entire* loop for **one P0, high-churn, well-instrumented flow (checkout)** with the ROI metric instrumented; prove the number; then widen.

## 10. Open decisions (to pin before building)

1. **Authority boundary** — confirm: test edits are *proposals* (branch diff + human approval), never autonomous to master. (Currently also *enforced* by MABL-20580.)
2. **Anti-reward-hacking bar** — which are hard rules: ticket-intent link · human-approves-assertion-changes · TRA must independently say `testNeedsUpdate`?
3. **Scope of "tests"** — mabl only, or also vitest (`src/lib`) + newman?
4. **Where it runs** — pre-PR agent loop, CI gate, or both; and the per-PR run budget (ties to `MABL_CLOUD_GATE`).
5. **Success bar** — e.g. "every PR shows tests-run / pass-fail / gaps / proposed edits, with zero stale-test red herrings reaching a human."

## 11. Prototype build plan (decided 2026-06-30)

**Decision:** build a **working prototype** (not a staged demo) on cheap-shot-hockey, as a **general art-of-possible**. Every beat runs for real; the engine is whole-repo; the loop is *demonstrated* on the **checkout** slice (P0, money-math, well-instrumented). Anti-hype keystone: the prototype must **halt on a real bug**, not just turn tests green.

**Architecture — deterministic core + LLM only where it earns it:**
- **Selection engine (deterministic, no cloud):** AST-extract testids/routes from a diff and from `mabl_get_test_steps`; join → impacted tests + coverage/gap report. Pure, replayable. (Replaces the grep PoC; AST fixes the templated-testid miss.)
- **Local run (mabl CLI):** run the selected tests headless vs `localhost` — fast, credit-light.
- **Triage (LLM + mabl evidence):** classify bug vs stale vs flake using `analyze_failure` / Recovery Agent `repairNotes` as *evidence* + ticket/PR *intent*; intent-precedence rule (edit only if intent predates code).
- **Act (CLI TAA on a branch):** stale+intent → `mabl agent authoring initiate --test-information '{test_id,…}'` on a branch → human approves diff. Real bug → halt + evidence, test untouched.

**Two worked scenarios on checkout:** (A) free-shipping threshold $99→$150 (ticket-driven) → `shipping-under-99` test stale → agent proposes edit → approve → green. (B) tax-calc regression (no matching intent) → triage halts, surfaces evidence, leaves test alone.

**Build phases:** (1) selection engine + coverage/gap report — deterministic, free, the validated core; (2) wire local run; (3) triage + act with the two scenarios + the reviewer/intent guardrail. Lean on GA mabl surface only; CLI for the edit (not the flag-gated MCP path).

## Sources

- Anthropic — *Building Effective Agents*: https://www.anthropic.com/engineering/building-effective-agents
- Meta — *Predictive Test Selection*: https://engineering.fb.com/2018/11/21/developer-tools/predictive-test-selection/ · paper: https://arxiv.org/abs/1810.05286
- Launchable (productized TIA): https://www.launchableinc.com/eng/predictive-test-selection-efficient-software-test-execution/
- Internal (mabl): *MCP Capability Delta — What Agents Can and Can't Do via MCP* (PM); *Daily Customer Issue Triage Automation* (PM); MABL-20580, MABL-18073, MABL-20586, APEX-46.
