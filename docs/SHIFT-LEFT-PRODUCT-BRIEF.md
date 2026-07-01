# Product brief: a coverage engine for mabl, and what it reveals about the platform

**Author:** Vince Mahan · **Audience:** Product + Engineering
**Status:** working prototype — the core gap→classify→author→run→select loop is validated end-to-end on a live repo (`cheap-shot-hockey`); the triage half is not built
**Companion docs:** [SHIFT-LEFT-PRIMITIVES-EVIDENCE.md](https://github.com/vincemahan-del/cheap-shot-hockey/blob/main/docs/SHIFT-LEFT-PRIMITIVES-EVIDENCE.md) (dated evidence log) · [SHIFT-LEFT-AGENTIC-TESTING.md](https://github.com/vincemahan-del/cheap-shot-hockey/blob/main/docs/SHIFT-LEFT-AGENTIC-TESTING.md) (design brief)

## Executive summary

I built a deterministic engine that does for mabl what a code-coverage report does for unit tests: it maps an application's surfaces to the mabl tests that cover them, so on any change you can answer *which tests cover this* and *what did I just ship that nothing tests*. It runs advisory in three places — the PR comment, my agentic definition-of-done check, and a local pre-push hook — off one shared map.

This session I ran it end-to-end on real feature PRs. It worked: it caught an uncovered page, drove the loop to a labeled, green mabl test, and correctly selected the regression set for a second change. It also bit back — the live run surfaced a real bug in my own CI, which I fixed.

The headline isn't the engine. It's what building it exposed: **almost every place the engine is "held together with tape" maps to a mabl platform primitive that doesn't exist yet.** The strongest of those — an open-form, synced `annotations` field on mabl entities — was independently proposed by Dani on the platform side *with no knowledge of this build*, while I'd been faking it from the implementation side. That convergence is the core result. **This prototype is a working proof-of-need for entity annotations.** Two of the corroborating needs are already GA-blocker tickets ([MABL-20580](https://mabl.atlassian.net/browse/MABL-20580), [MABL-20586](https://mabl.atlassian.net/browse/MABL-20586)); annotations is the net-new ask.

## The problem I was solving

mabl is black-box. There's no code-level coverage signal, so the question every team actually has — "for this change, which tests matter, and what's untested?" — has no clean answer. People run the whole smoke suite and hope. If I want an agentic SDLC where a coding agent runs the *right* tests and reasons about gaps, that map has to exist first. So I built the map, against my `cheap-shot-hockey` demo storefront (Next.js, full SDLC, already instrumented for mabl).

Selecting tests by what changed isn't a new idea — Meta's Predictive Test Selection, `nx affected`, and `jest --onlyChanged` all do it, backed by a real code-coverage graph. What's different here is doing it against mabl's *black-box* surface, where no such graph exists: the `data-testid`s are the only bridge between the code and the tests. I'm not claiming the concept is novel — I'm claiming the black-box application is useful, and that building it is a sharp probe of what the platform can't do yet.

## What I built

A small, version-controlled engine ([`scripts/shift-left/`](https://github.com/vincemahan-del/cheap-shot-hockey/tree/main/scripts/shift-left)):

- **[`coverage.map.yml`](https://github.com/vincemahan-del/cheap-shot-hockey/blob/main/scripts/shift-left/coverage.map.yml)** — the manifest. A controlled vocabulary of 9 areas (catalog, checkout, orders, auth, admin, deployments, i18n, team-orders, info), each tied to its routes, components, `data-testid` prefixes, and i18n namespaces. Plus non-area buckets: `core` (shared/cross-cutting → forces broad impact), `excluded` (promo/demo chrome), `platform` (API smoke).
- **[`engine.mjs`](https://github.com/vincemahan-del/cheap-shot-hockey/blob/main/scripts/shift-left/engine.mjs) / [`audit.mjs`](https://github.com/vincemahan-del/cheap-shot-hockey/blob/main/scripts/shift-left/audit.mjs)** — the logic and CLI. Three outputs:
  - **impact** — given a diff, the mabl tests it hits: *precise* (tests touching a changed testid), *area-level* (tests in the impacted domain), and a CORE/BROAD flag when shared code changes. Leads with a plain-English `▶ Recommendation`.
  - **guard** — sweeps the repo and fails if any surface (route/component/testid/namespace) isn't classified. The "you shipped something untracked" alarm.
  - **reconcile** — derives the `area-*` labels mabl uses to group/run tests, from the same map. Add-only — it never removes a human-set label.
- **[`test-index.json`](https://github.com/vincemahan-del/cheap-shot-hockey/blob/main/scripts/shift-left/test-index.json)** — a cached snapshot of the live mabl test list (id, name, testids, routes, derived area), rebuilt by the `coverage-auditor` subagent (below).
- **The [`coverage-auditor`](https://github.com/vincemahan-del/cheap-shot-hockey/blob/main/.claude/agents/coverage-auditor.md) subagent** — a repo-level Claude Code subagent (spec'd in [`docs/AREA-COVERAGE-AUDIT.md`](https://github.com/vincemahan-del/cheap-shot-hockey/blob/main/docs/AREA-COVERAGE-AUDIT.md)) that operates the engine against *live* mabl: it pulls the current test list from the workspace, rebuilds the index, runs the audit (guard / coverage / reconcile), and writes the derived `area-*` labels back onto the tests (add-only, via the cloud MCP). It's the "operate it over time" half — what keeps the map fresh and the labels true, and it's how the auto-labeling actually lands on a test. (In this session it refreshed the index 35 → 38 after the new warranty test.)
- **[Unit tests](https://github.com/vincemahan-del/cheap-shot-hockey/blob/main/scripts/shift-left/audit.test.mjs)** — 17, covering the derivation rules (longest-prefix precedence, verifies-not-transit, i18n-via-query, surface-coverage math).

### How the mapping works

The join key is `data-testid`. Every interactive element in the app has one (a repo convention, enforced in my DoD), and mabl tests select by those same testids. So a testid is one stable name living in both the code and the test. The manifest buckets testid prefixes into areas. A testid rolls up to an area; a mabl test rolls up to the areas of whatever testids its steps touch; a code change rolls up the same way. That's the entire join — at two granularities: a testid *prefix* is a component (`product-card-`, `warranty-`), and a set of prefixes is an area (domain). So impact reports both — *precise* tests that touch a component testid you changed, and *area-level* tests in the same domain. One deliberate rule keeps it honest: a test earns an area only from testids it actually asserts or interacts with, not from pages it merely passes through — a checkout test that navigates past `/products` without touching a catalog testid does **not** count as catalog coverage (there's a unit test pinning exactly this).

Two things fall out: I can name the tests a change impacts, and I can **derive `area-*` labels from the testids a test actually uses** — so labels stay true instead of rotting, and "run all catalog tests" means it.

**Where the determinism actually is** (worth being precise, because "deterministic" gets thrown around): the *engine* — the map plus the impact/guard/reconcile logic — is pure, deterministic, and unit-tested. No model decides what covers what. LLMs sit *around* it: the agentic definition-of-done check and the `coverage-auditor` subagent *run* the engine and act on its output, but the labels they apply are the engine's derivation (add-only), and anything the engine can't derive from testids is **flagged for a human, not guessed** — that's exactly what happened this session when the auditor declined to auto-apply `area-catalog` to `CSH-LOCALE-MATRIX` (a route-only match with no testid evidence). Authoring a test is the one genuinely generative step, and it's human-reviewed. And the whole thing is advisory — it never blocks a merge today.

**Scope, stated plainly:** the testid join is a *UI* technique. API tests carry no testids, so they're classified by route and by label (the `platform`/`api-smoke` buckets), and the surface-coverage % below is a *UI-surface* number. Mapping API coverage precisely is out of scope for the testid join.

## What happened this session (the live test)

I ran two acts on real PRs.

**Act 1 — gap detection ([TAMD-189](https://mabl.atlassian.net/browse/TAMD-189)).** I added a [`/warranty` page](https://github.com/vincemahan-del/cheap-shot-hockey/blob/main/src/app/warranty/page.tsx) and deliberately shipped it with no test. The engine caught it: the guard failed on the new route plus 15 new `warranty-*` testids, and impact reported it "instrumented but UNCOVERED → author a test." I then closed the loop: classified `/warranty` into the `info` area, authored a mabl test through the cloud MCP, and it landed labeled `TAMD-189` + `area-info` (the area label applied automatically), then **ran green**. After a `coverage-auditor` index refresh (35 → 38 tests), the engine's precise impact now names that test for any future `/warranty` change.

**Act 2 — selection ([TAMD-192](https://mabl.atlassian.net/browse/TAMD-192)).** A change to the [`ProductCard`](https://github.com/vincemahan-del/cheap-shot-hockey/blob/main/src/components/ProductCard.tsx) component. The engine selected `area-catalog` — 10 precise, 17 area-level — with **no BROAD**, correctly, because a component isn't shared/core. That's the "run the right regression set" behavior.

**What broke, and what I learned.** Two things, both useful:

- The live run found a real CI bug ([TAMD-190](https://mabl.atlassian.net/browse/TAMD-190)): the deterministic test-impact comment was *silent on UI-only PRs*. Our `unit` job is gated on `src/lib` changes, and `test-impact` depended on it, so a pages-only PR skipped the comment entirely — exactly the case the engine is for. I fixed it (`if: !cancelled()` + a conditional coverage row) and it self-validated on its own PR. Act 2 then exercised the fix in anger.
- The `/warranty` merge briefly stalled because Vercel skipped building a branch-update *merge commit*, so the mabl gate had no preview URL to test. Not an engine issue — deploy plumbing — but a good reminder that the friction in this kind of workflow is rarely where you expect.

The broader lesson: **test it in CI, not just locally.** Two real defects (this one and an earlier `.mabl`-artifact flood) only surfaced on actual PRs.

## What worked

- Gap detection, on a real PR, carried by the DoD comment.
- Selection that distinguishes precise from area-level and correctly withholds BROAD for a component change.
- Auto-derived `area-*` labels landing on a real authored test with no hand-tagging.
- The full loop: gap → classify → author → green → indexed → precise selection.
- The testid join beating route-mapping: mabl authored the warranty test to navigate via the footer link, so its recorded URL is `/` — route-based mapping would have misfiled it as the home page; the testids are what classified it as `info`. (This is also evidence that a test's URL field is unreliable as coverage metadata.)

## What didn't (honest limits)

- **i18n granularity is whole-file** ([TAMD-193](https://mabl.atlassian.net/browse/TAMD-193)). Editing one string in `messages/en.json` recommends the *full* suite, because the engine maps the whole file's namespaces and the file contains core ones. It's *safe* (over-selection never misses a regression) but noisy, and noise erodes trust in the recommendation — which matters more if I ever make it blocking.
- **The test index is a cached snapshot.** A newly authored test isn't "seen" until the `coverage-auditor` refresh runs.
- **Selection is approximate.** It's black-box underneath — there's no true code-to-test coverage — so it stays advisory by design.
- **No triage.** The engine tells you *which* tests to run, not whether a failure is a real regression or a stale test. (More on this below — it's less missing than I expected.)
- **A workflow that edits its own file can't validate itself.** When I changed the DoD workflow, its own check refused to run on that PR (the action won't run a modified copy of its own workflow) — so its first live run is always the *next* PR. Worth knowing for anyone building CI-side agent checks.
- **Proven in principle, not at scale.** This ran against 38 tests and 244 testids in one well-instrumented repo. Two things scale with the app, and I haven't stress-tested either: the `data-testid` discipline (the join is only as good as the instrumentation — sloppy or missing testids blind it), and the manifest itself. The guard flags *new* unclassified surfaces automatically, but a human still decides which area they belong to. On a large app with lots of churn, that manifest upkeep is the real cost, and it's exactly the kind of derived metadata that would live better on the mabl entities than in a repo file (see the platform signal).

## Labels: the execution control plane

Labels are how mabl decides *what to run*. Per mabl's own docs, a deployment event
"triggers all plans that match specified labels," and the CI/CD guidance is explicit:
"use test labels to run a group of tests for a deployment event." Labels aren't
decoration — they're the dispatch layer. The engine's job is to feed that layer the
right inputs.

### The label axes in this workspace
28 distinct labels are in use across the workspace, pulled live (the coverage index tracks the
38 enabled browser tests; the full set including API and disabled tests is ~47). They fall on a
few orthogonal axes:

- **Domain — `area-*`** (8): `area-catalog`, `area-checkout`, `area-orders`, `area-auth`, `area-admin`, `area-deployments`, `area-i18n`, `area-info` — *what the test covers.* (`area-team-orders` exists in the map but on no test yet — that's the 0%-coverage gap; the label appears once the first team-orders test is authored.)
- **Tier — `type-*`** (3): `type-smk` (smoke), `type-rt` (regression), `type-api` — *how deep.*
- **Timing — `exec-*`** (2): `exec-pr`, `exec-postdeploy` — *when it runs.*
- **Layer / smoke** (2): `api-smoke`, `ui-smoke` — API vs UI smoke.
- **Data-seeding** (3): `seed-db`, `seed-api`, `dt-demo` — how the test gets its data.
- **Traceability — Jira keys** (4): `TAMD-173`, `TAMD-180`, `TAMD-189` (+ the `TAMD-173-diagnostic` label) — *why it exists.*
- **Descriptive** (6): `demo`, `csv`, `pdf`, `download-assertion`, `repro`, `i18n-failing-evidence` — free-form.

Plans dispatch on the *intersection*: `type-smk,exec-pr` → the PR smoke; `type-rt,area-catalog`
→ catalog regression; `type-rt` → the nightly full suite.

### What's automated, and what isn't (deliberately)
- **Auto — the domain axis (`area-*`).** The engine derives these from the testids a test
  touches and applies them add-only (never clobbering a human label). It's cheap: in mabl,
  label/metadata edits consume **0 credits** and don't count toward authoring/automator billing.
- **Semi-auto — the ticket key (`TAMD-*`).** Applied at authoring time by the agent, per my DoD.
- **Manual, on purpose — tier (`type-*`) and timing (`exec-*`).** These encode *risk policy*,
  not facts about the code. Whether something is smoke vs regression, and when it should run,
  is a human judgment. Code can tell you a test's *domain*; it can't tell you how much you
  should care. So the engine derives the one axis it legitimately can (domain) and leaves the
  risk axes to people. That boundary is the point — remove the toil, don't overreach into policy.

### Where this goes: targeted testing to balance risk and credit
mabl meters cloud execution in credits, and the ladder is steep:

| Run | Credits |
|---|---|
| Local / CI-environment run | **0** |
| API cloud run | 0.1 |
| Browser cloud run (desktop) | 1 (1.5 with visual) |
| Mobile cloud run | 5 (5.5 with visual) |
| `analyze_failure` summary | **0** |
| Test authoring / label writes | **0** |

The expensive unit is the cloud browser/mobile run. mabl's own guidance already says to stage
execution (cheap API first, expensive browser second) to conserve credits. The engine makes that
staging *change-aware* instead of fixed:

- **Inner loop (local, 0 credits):** the engine maps a diff to `area-catalog` →
  `mabl tests run --labels type-rt,area-catalog` locally, before the PR. Fast feedback, no burn.
- **PR gate (cloud, targeted):** run the diff-relevant area plan instead of the whole smoke —
  spend credits proportional to blast radius. A single-component change runs that area; a
  CORE/BROAD change runs wide (the risk warrants the spend).
- **Deployment events:** a deploy that touches area-X fires the area-X plan by label match.
- **Nightly (cloud, full):** `type-rt` everything — the comprehensive backstop, scheduled when
  credit timing doesn't compete with iteration.

Labels become a *risk dial*: the human-set depth/timing axes set the policy; the engine-derived
domain axis + the impact selection decide where to point it on each change.

### Pressure test (against mabl's docs + roadmap)
- **The mechanism already exists.** Label-driven plans + deployment events are how mabl CI/CD
  works today — this isn't a new runner, just a better selector feeding it.
- **The credit argument is mabl's own.** "Organizing tests into plans to conserve credit
  consumption" via staged execution is documented guidance; this makes it targeted.
- **Triage is free.** `analyze_failure` summaries consume 0 credits — wiring failure-triage into
  the loop adds orchestration, not execution cost.
- **Labeled credentials is already being built** ([MABL-20401](https://mabl.atlassian.net/browse/MABL-20401) / [MABL-20407](https://mabl.atlassian.net/browse/MABL-20407), active epics) — so the
  credentials-carry-context primitive (P4) isn't hypothetical; it's in development.
- **Honest dependencies:**
  - It needs area-scoped plans wired to deployment triggers. In this repo, PR-time area plans were
    *removed* (collapsed to a fixed smoke), so "make selection authoritative" means re-introducing
    area plans or dynamic label dispatch — real work, not free.
  - "Only enabled plans configured to run on deployment are triggered" — the plumbing has preconditions.
  - Label tooling has rough edges on branches ([MABL-20506](https://mabl.atlassian.net/browse/MABL-20506): branch label dropdowns / bulk-add), and
    label *writes* are cloud-MCP-only (P3 / [MABL-20586](https://mabl.atlassian.net/browse/MABL-20586)) — so the auto-labeling pipeline leans on the cloud path.
- **Not a coverage-dashboard rehash.** mabl's account/coverage dashboards measure run history and
  pass-rate; the surface-coverage % here measures code instrumentation touched by tests — a
  different denominator.

## The platform signal — and how it ties to Dani's idea

This is the part for this group. Dani floated giving every mabl entity an open-form JSON `annotations` field — agent-writable via CLI/MCP, persisted by ID, instantly synced — with examples like test-version descriptions, test-run breakdowns, and credential notes. She reasoned to it from "what should entities carry." I'd reasoned to the same place from "what do I need to make this work, and why is it taped together." Neither of us had seen the other's thinking.

Every workaround in the engine is a symptom of a missing primitive:

| Primitive | Status | Evidence from this experiment |
|---|---|---|
| **Entity annotations** (open JSON, synced) | **Strongly proven — net-new ask** | Four independent symptoms of the *same* gap: the stale repo-local index cache; `area-*` labels overloaded as a metadata store; the misleading test URL; the ephemeral triage verdict (below). All of it wants a place to live *on the entity*. |
| Safe agent metadata writes | Supported — **already GA-blocker ([MABL-20580](https://mabl.atlassian.net/browse/MABL-20580))** | Editing a test's steps is last-write-wins to master, so autonomous edits aren't safe — I keep editing out of the automated path. Annotations are metadata, not steps, so they'd be a safe write surface. [MABL-20580](https://mabl.atlassian.net/browse/MABL-20580) ("Edits: versioning & conflict resolution / no silent overwrite") is open and flagged GA-blocker; Dani is a co-reporter. |
| MCP write parity (local vs cloud) | Supported — **already GA-blocker ([MABL-20586](https://mabl.atlassian.net/browse/MABL-20586))** | Label writes only work through the authenticated cloud MCP; the local/headless one can't. [MABL-20586](https://mabl.atlassian.net/browse/MABL-20586) ("MCP parity & cross-surface consistency") is open and GA-blocker — it also notes the agent changing a visit URL to `@web.defaults.url` unprompted, which corroborates the unreliable-URL finding. |
| Credentials that carry context | Supported (empirical) | A real failed run was a credential non-resolution (`app.defaults.username` didn't substitute on Preview); mabl's own `analyze_failure` recommended reviewing credential/variable scope. If the credential carried its persona/access as an annotation, the agent could self-diagnose instead of typing a placeholder. |
| Failure triage that persists | Supported + convergence | See below. |

**The triage finding is the one I'd highlight.** I assumed the "bug vs. stale test" half of the vision was a big net-new build. It isn't. I ran `analyze_failure` on a real failed run and it returned a root cause *and a classification* — it called the failure a "recurring test configuration issue," not an app regression, and pointed at the credential variable. So the triage brain already exists in the platform (alongside the Runtime Recovery Agent's repair signals). What's missing is two things: **orchestration** (wire selection → run → analyze_failure → surface the verdict) and **persistence** — the verdict is generated on demand and then gone. Dani's "detailed breakdown on test runs as to what happened and how it was identified" is exactly where it should live. Same missing primitive, again.

## Pressure test (objections I'd expect, and my answers)

- *"This only works because your demo is perfectly instrumented."* Partly fair. The join depends on disciplined `data-testid` coverage and a maintained manifest. The demo enforces that by convention; real customer apps vary. The honest scope: the *technique* is sound and the labels-derive-themselves property is real, but adoption effort scales with how well an app is instrumented. That's an argument *for* annotations, not against — declared metadata reduces the inference burden.
- *"Isn't this just labels / `identify_coverage_gaps`?"* No. Labels are the storage hack I'm forced into; the engine *derives* them. `identify_coverage_gaps` is black-box and has no code-to-test join — it can't tell you a specific code change's precise tests. The delta is the repo-side join.
- *"Approximate selection will miss a regression."* Yes, it can — which is why it's advisory and over-selects (the safe failure mode). I will not make it blocking until I've measured its false-positive rate on real PRs, the same way I promoted CodeQL.
- *"You're generalizing a platform need from one repo and one conversation."* Correct, and I won't overstate it: this is a directional, qualitative proof-of-need, not a quantitative study. What gives it weight is that the need shows up from four independent angles in the engine, two of those needs are already GA-blocker tickets, and the headline primitive was reached independently by someone reasoning purely about the platform. That's a strong signal to investigate, not a finished business case.
- *"Why keep authoring out of the automation?"* Deliberate. Whatever enforces the gate must not also write the tests, or it can turn a red check green by rewriting the assertion. Authoring stays agent-*assisted* and human-reviewed.
- *"There's an LLM (the coverage-auditor) writing labels to my test suite — how is that safe?"* The label *values* are the engine's deterministic derivation; the subagent only applies them, add-only, and flags anything it can't derive from testids rather than guessing (it declined to auto-label `CSH-LOCALE-MATRIX` this session). The model orchestrates and executes — it doesn't decide coverage. The one generative step, authoring a test, is human-reviewed.
- *"Does any of this work for API tests?"* No — the testid join is UI-only. API tests carry no testids; they're classified by route and label (`platform` / `api-smoke`), and the coverage % is a UI-surface number. Precise API-change → API-test mapping isn't something this technique does today.

## What I'm asking Product + Engineering to consider

1. **Entity annotations** — the open-form, synced, agent-writable metadata field. This is the net-new primitive, and the one that collapses the most workarounds (the cache, the label-overloading, the misleading URL, the lost triage verdict).
2. **A safe agent write surface** for metadata that isn't test steps — already in scope via [MABL-20580](https://mabl.atlassian.net/browse/MABL-20580); annotations satisfy it cleanly.
3. **MCP write parity** between local and cloud — already in scope via [MABL-20586](https://mabl.atlassian.net/browse/MABL-20586).
4. **Context-carrying credentials.**
5. A reframing worth internalizing: **failure triage is an orchestration + persistence problem, not a missing brain** — `analyze_failure` already classifies; it just needs to be wired into the change loop and given somewhere to persist.

## Roadmap (my side)

- Promote the coverage guard from advisory to blocking once its false-positive rate holds on real PRs ([TAMD-188](https://mabl.atlassian.net/browse/TAMD-188)).
- Build a triage-orchestration POC: selection → run affected → `analyze_failure` → *propose* a bug-vs-stale verdict behind a human gate.
- Fix the i18n granularity noise ([TAMD-193](https://mabl.atlassian.net/browse/TAMD-193)).

## Evidence (real output)

Everything below is verbatim from the live runs this session — not mock-ups.

### The coverage report — `node scripts/shift-left/audit.mjs`

```
══════════════ area-coverage-audit ══════════════
swept: 38 routes · 24 lib · 15 components · 8 msg-namespaces · 244 testids · 38 tests

── GUARD (every surface classified?) ──
  ✓ 100% classified — guard passes

── COVERAGE by area ──
  feature surface coverage: 72/228 instrumented testids touched by ≥1 test (32%)
  (surface = an element is exercised by a test; not execution/branch coverage — mabl is black-box)
  ✓  area-catalog      17 test(s) · 15/49 testids ( 31%)
  ✓  area-checkout      7 test(s) · 11/33 testids ( 33%)
  ✓  area-orders       11 test(s) · 11/20 testids ( 55%)
  ✓  area-auth         11 test(s) · 14/20 testids ( 70%)
  ✓  area-admin         1 test(s) ·  2/ 6 testids ( 33%)
  ✓  area-deployments   2 test(s) ·  9/29 testids ( 31%)
  ✓  area-i18n          6 test(s) ·  2/ 4 testids ( 50%)
  ✗ ZERO  area-team-orders   0 test(s) ·  0/12 testids (  0%)
  ✓  area-info          1 test(s) ·  8/55 testids ( 15%)
  zero-coverage areas: area-team-orders

── RECONCILE (add-only) ──
  CSH-LOCALE-MATRIX        ADD area-catalog
  CSH-RT-ADMIN-UI-OrdersCsvVisualDownloadAssertion  review(keep) area-orders
  CSH-CHP-CHECKOUT-UI-SeededOrderConfirmation        review(keep) area-checkout
  (review = current label not testid-derivable — content-verified; kept, never auto-removed)
```

**On the coverage %:** this is *surface* coverage — the share of instrumented elements
(`data-testid`s) that at least one mabl test touches. It is **not** execution/branch
coverage; mabl is black-box, so there's no line trace, and a touched element isn't a
fully-exercised one. Stated that way it's defensible, and it's the honest ceiling: 32%
means two-thirds of the instrumented surface has *no* test on it at all. `area-team-orders`
is the sharpest case — a whole domain (the team-orders form flow) at 0%, surfaced
unprompted; `area-info` at 15% reflects content pages with many testids and few tests.

One precision note on the denominator: 228 counts *distinct instrumented testids* — a templated family like `product-card-${slug}` counts once, not once per product — and only elements that actually carry a `data-testid`. Anything not instrumented isn't in the denominator at all. So it's coverage *of the instrumented surface*, not of the app in some absolute sense. That's the honest scope, and it's why the number is a floor for "what's demonstrably exercised," not a grade.

### Act 1 — the engine catching the uncovered page (from the PR's DoD comment)

```
audit.mjs --guard FAILS on this PR (manifest gap):
  Unclassified route:   /warranty
  Unclassified testids (15): warranty-page, warranty-breadcrumbs, warranty-heading,
    warranty-coverage, warranty-coverage-defects, warranty-coverage-terms,
    warranty-row-sticks, warranty-row-skates, warranty-row-protective,
    warranty-exclusions, warranty-exclusions-list, warranty-claims, …
  Precise (changed testid): 0 tests — the 15 warranty-* testids are instrumented but UNCOVERED.
```

### Act 2 — selection on a component change (verbatim test-impact PR comment)

```
▶ Recommendation: run the area-catalog regression set (17 test(s)) — 10 of them precise.

  src/components/ProductCard.tsx  ->  area (catalog)

impacted areas: area-catalog              ← no CORE/BROAD; ProductCard is a component, not core

precise — tests that touch a data-testid you changed (4 prefixes): 10 test(s)
  CSH-RT-CATALOG-UI-LowStockBadgeDisplays, CSH-QUEBEC, CSH-REGION-DETECTION,
  CSH-I18N-TAX, CSH-I18N-CURRENCY, dt-demo-catalog-category,
  csh-checkout-authenticated-uses-saved-context, csh-checkout-paid-shipping-under-99,
  csh-checkout-guest-golden-path, CSH-CHP-CHECKOUT-UI-CustomerPlacesOrderEndToEnd
area-level — every test in the impacted domain (1 area): 17 test(s)
```

### The triage verdict already exists — `analyze_failure` on a real failed run

```
synopsis:  "Login test failed due to incorrect credential variable substitution"
Root cause: app.defaults.username was not substituted in the email field — the input
            "[plan credentials placeholder]" was entered instead of a valid email,
            so authentication failed. This is a recurring test configuration issue.
Next steps: ensure valid credentials resolve for app.defaults.username on Preview;
            review the data-seeding logic / variable scope settings.
```

mabl classified this itself as a **test-configuration** issue (stale/config), not an
app regression — the bug-vs-stale call, made by the platform today. What's missing is
wiring it into the change loop and a place to persist the verdict.

## Appendix — trail and artifacts

- **Shipped this session (all merged to `main`):** [TAMD-187](https://mabl.atlassian.net/browse/TAMD-187) (retire the legacy heuristic; one engine across DoD + pre-push + CI), [TAMD-189](https://mabl.atlassian.net/browse/TAMD-189) (Act 1, `/warranty`), [TAMD-190](https://mabl.atlassian.net/browse/TAMD-190) (test-impact on UI PRs), [TAMD-191](https://mabl.atlassian.net/browse/TAMD-191) (index refresh), [TAMD-192](https://mabl.atlassian.net/browse/TAMD-192) (Act 2, selection), [TAMD-194](https://mabl.atlassian.net/browse/TAMD-194) (evidence consolidation), [TAMD-195](https://mabl.atlassian.net/browse/TAMD-195) (this brief). Logged: [TAMD-193](https://mabl.atlassian.net/browse/TAMD-193) (i18n granularity). Tracked: [TAMD-188](https://mabl.atlassian.net/browse/TAMD-188) (advisory → blocking).
- **Confirmed platform refs:** [MABL-20580](https://mabl.atlassian.net/browse/MABL-20580) (edits versioning/no-silent-overwrite, GA-blocker), [MABL-20586](https://mabl.atlassian.net/browse/MABL-20586) (MCP parity, GA-blocker).
- **Repo:** [vincemahan-del/cheap-shot-hockey](https://github.com/vincemahan-del/cheap-shot-hockey).
- **The engine:** [scripts/shift-left/](https://github.com/vincemahan-del/cheap-shot-hockey/tree/main/scripts/shift-left) — manifest, engine, audit, unit tests.
- **Evidence log:** [docs/SHIFT-LEFT-PRIMITIVES-EVIDENCE.md](https://github.com/vincemahan-del/cheap-shot-hockey/blob/main/docs/SHIFT-LEFT-PRIMITIVES-EVIDENCE.md) — dated, with the full primitives table and the verdict.
- **Design brief:** [docs/SHIFT-LEFT-AGENTIC-TESTING.md](https://github.com/vincemahan-del/cheap-shot-hockey/blob/main/docs/SHIFT-LEFT-AGENTIC-TESTING.md).
