# Product brief: a coverage engine for mabl, and what it reveals about the platform

**Author:** Vince Mahan · **Audience:** Product + Engineering
**Status:** working prototype, validated end-to-end on a live repo (`cheap-shot-hockey`)
**Companion docs:** [`SHIFT-LEFT-PRIMITIVES-EVIDENCE.md`](./SHIFT-LEFT-PRIMITIVES-EVIDENCE.md) (dated evidence log) · [`SHIFT-LEFT-AGENTIC-TESTING.md`](./SHIFT-LEFT-AGENTIC-TESTING.md) (design brief)

## Executive summary

I built a deterministic engine that does for mabl what a code-coverage report does for unit tests: it maps an application's surfaces to the mabl tests that cover them, so on any change you can answer *which tests cover this* and *what did I just ship that nothing tests*. It runs advisory in three places — the PR comment, our agentic definition-of-done check, and a local pre-push hook — off one shared map.

This session I ran it end-to-end on real feature PRs. It worked: it caught an uncovered page, drove the loop to a labeled, green mabl test, and correctly selected the regression set for a second change. It also bit back — the live run surfaced a real bug in my own CI, which I fixed.

The headline isn't the engine. It's what building it exposed: **almost every place the engine is "held together with tape" maps to a mabl platform primitive that doesn't exist yet.** The strongest of those — an open-form, synced `annotations` field on mabl entities — was independently proposed by Dani on the platform side *with no knowledge of this build*, while I'd been faking it from the implementation side. That convergence is the core result. **This prototype is a working proof-of-need for entity annotations.** Two of the corroborating needs are already GA-blocker tickets (MABL-20580, MABL-20586); annotations is the net-new ask.

## The problem I was solving

mabl is black-box. There's no code-level coverage signal, so the question every team actually has — "for this change, which tests matter, and what's untested?" — has no clean answer. People run the whole smoke suite and hope. If we want an agentic SDLC where a coding agent runs the *right* tests and reasons about gaps, that map has to exist first. So I built the map, against our `cheap-shot-hockey` demo storefront (Next.js, full SDLC, already instrumented for mabl).

## What I built

A small, version-controlled engine (`scripts/shift-left/`):

- **`coverage.map.yml`** — the manifest. A controlled vocabulary of 9 areas (catalog, checkout, orders, auth, admin, deployments, i18n, team-orders, info), each tied to its routes, components, `data-testid` prefixes, and i18n namespaces. Plus non-area buckets: `core` (shared/cross-cutting → forces broad impact), `excluded` (promo/demo chrome), `platform` (API smoke).
- **`engine.mjs` / `audit.mjs`** — the logic and CLI. Three outputs:
  - **impact** — given a diff, the mabl tests it hits: *precise* (tests touching a changed testid), *area-level* (tests in the impacted domain), and a CORE/BROAD flag when shared code changes. Leads with a plain-English `▶ Recommendation`.
  - **guard** — sweeps the repo and fails if any surface (route/component/testid/namespace) isn't classified. The "you shipped something untracked" alarm.
  - **reconcile** — derives the `area-*` labels mabl uses to group/run tests, from the same map. Add-only — it never removes a human-set label.
- **`test-index.json`** — a cached snapshot of the live mabl test list (id, name, testids, routes, derived area), rebuilt by a `coverage-auditor` subagent that pulls from the workspace.
- **Unit tests** — 15, covering the derivation rules (longest-prefix precedence, verifies-not-transit, i18n-via-query, etc.).

### How the mapping works

The join key is `data-testid`. Every interactive element in the app has one (a repo convention, enforced in our DoD), and mabl tests select by those same testids. So a testid is one stable name living in both the code and the test. The manifest buckets testid prefixes into areas. A testid rolls up to an area; a mabl test rolls up to the areas of whatever testids its steps touch; a code change rolls up the same way. That's the entire join.

Two things fall out: I can name the tests a change impacts, and I can **derive `area-*` labels from the testids a test actually uses** — so labels stay true instead of rotting, and "run all catalog tests" means it.

It's deterministic (no LLM in the engine) and advisory — it never blocks a merge today.

## What happened this session (the live test)

I ran two acts on real PRs.

**Act 1 — gap detection (TAMD-189).** I added a `/warranty` page and deliberately shipped it with no test. The engine caught it: the guard failed on the new route plus 15 new `warranty-*` testids, and impact reported it "instrumented but UNCOVERED → author a test." I then closed the loop: classified `/warranty` into the `info` area, authored a mabl test through the cloud MCP, and it landed labeled `TAMD-189` + `area-info` (the area label applied automatically), then **ran green**. After a `coverage-auditor` index refresh (35 → 38 tests), the engine's precise impact now names that test for any future `/warranty` change.

**Act 2 — selection (TAMD-192).** A change to the `ProductCard` component. The engine selected `area-catalog` — 10 precise, 17 area-level — with **no BROAD**, correctly, because a component isn't shared/core. That's the "run the right regression set" behavior.

**What broke, and what I learned.** Two things, both useful:

- The live run found a real CI bug (TAMD-190): the deterministic test-impact comment was *silent on UI-only PRs*. Our `unit` job is gated on `src/lib` changes, and `test-impact` depended on it, so a pages-only PR skipped the comment entirely — exactly the case the engine is for. I fixed it (`if: !cancelled()` + a conditional coverage row) and it self-validated on its own PR. Act 2 then exercised the fix in anger.
- The `/warranty` merge briefly stalled because Vercel skipped building a branch-update *merge commit*, so the mabl gate had no preview URL to test. Not an engine issue — deploy plumbing — but a good reminder that the friction in this kind of workflow is rarely where you expect.

The broader lesson: **test it in CI, not just locally.** Two real defects (this one and an earlier `.mabl`-artifact flood) only surfaced on actual PRs.

## What worked

- Gap detection, on a real PR, carried by the DoD comment.
- Selection that distinguishes precise from area-level and correctly withholds BROAD for a component change.
- Auto-derived `area-*` labels landing on a real authored test with no hand-tagging.
- The full loop: gap → classify → author → green → indexed → precise selection.
- The testid join beating route-mapping: mabl authored the warranty test to navigate via the footer link, so its recorded URL is `/` — route-based mapping would have misfiled it as the home page; the testids are what classified it as `info`. (This is also evidence that a test's URL field is unreliable as coverage metadata.)

## What didn't (honest limits)

- **i18n granularity is whole-file** (TAMD-193). Editing one string in `messages/en.json` recommends the *full* suite, because the engine maps the whole file's namespaces and the file contains core ones. It's *safe* (over-selection never misses a regression) but noisy, and noise erodes trust in the recommendation — which matters more if we ever make it blocking.
- **The test index is a cached snapshot.** A newly authored test isn't "seen" until the `coverage-auditor` refresh runs.
- **Selection is approximate.** It's black-box underneath — there's no true code-to-test coverage — so it stays advisory by design.
- **No triage.** The engine tells you *which* tests to run, not whether a failure is a real regression or a stale test. (More on this below — it's less missing than I expected.)
- **A workflow that edits its own file can't validate itself.** When I changed the DoD workflow, its own check refused to run on that PR (the action won't run a modified copy of its own workflow) — so its first live run is always the *next* PR. Worth knowing for anyone building CI-side agent checks.

## The platform signal — and how it ties to Dani's idea

This is the part for this group. Dani floated giving every mabl entity an open-form JSON `annotations` field — agent-writable via CLI/MCP, persisted by ID, instantly synced — with examples like test-version descriptions, test-run breakdowns, and credential notes. She reasoned to it from "what should entities carry." I'd reasoned to the same place from "what do I need to make this work, and why is it taped together." Neither of us had seen the other's thinking.

Every workaround in the engine is a symptom of a missing primitive:

| Primitive | Status | Evidence from this experiment |
|---|---|---|
| **Entity annotations** (open JSON, synced) | **Strongly proven — net-new ask** | Four independent symptoms of the *same* gap: the stale repo-local index cache; `area-*` labels overloaded as a metadata store; the misleading test URL; the ephemeral triage verdict (below). All of it wants a place to live *on the entity*. |
| Safe agent metadata writes | Supported — **already GA-blocker (MABL-20580)** | Editing a test's steps is last-write-wins to master, so autonomous edits aren't safe — I keep editing out of the automated path. Annotations are metadata, not steps, so they'd be a safe write surface. MABL-20580 ("Edits: versioning & conflict resolution / no silent overwrite") is open and flagged GA-blocker; Dani is a co-reporter. |
| MCP write parity (local vs cloud) | Supported — **already GA-blocker (MABL-20586)** | Label writes only work through the authenticated cloud MCP; the local/headless one can't. MABL-20586 ("MCP parity & cross-surface consistency") is open and GA-blocker — it also notes the agent changing a visit URL to `@web.defaults.url` unprompted, which corroborates the unreliable-URL finding. |
| Credentials that carry context | Supported (empirical) | A real failed run was a credential non-resolution (`app.defaults.username` didn't substitute on Preview); mabl's own `analyze_failure` recommended reviewing credential/variable scope. If the credential carried its persona/access as an annotation, the agent could self-diagnose instead of typing a placeholder. |
| Failure triage that persists | Supported + convergence | See below. |

**The triage finding is the one I'd highlight.** I assumed the "bug vs. stale test" half of the vision was a big net-new build. It isn't. I ran `analyze_failure` on a real failed run and it returned a root cause *and a classification* — it called the failure a "recurring test configuration issue," not an app regression, and pointed at the credential variable. So the triage brain already exists in the platform (alongside the Runtime Recovery Agent's repair signals). What's missing is two things: **orchestration** (wire selection → run → analyze_failure → surface the verdict) and **persistence** — the verdict is generated on demand and then gone. Dani's "detailed breakdown on test runs as to what happened and how it was identified" is exactly where it should live. Same missing primitive, again.

## Pressure test (objections I'd expect, and my answers)

- *"This only works because your demo is perfectly instrumented."* Partly fair. The join depends on disciplined `data-testid` coverage and a maintained manifest. The demo enforces that by convention; real customer apps vary. The honest scope: the *technique* is sound and the labels-derive-themselves property is real, but adoption effort scales with how well an app is instrumented. That's an argument *for* annotations, not against — declared metadata reduces the inference burden.
- *"Isn't this just labels / `identify_coverage_gaps`?"* No. Labels are the storage hack I'm forced into; the engine *derives* them. `identify_coverage_gaps` is black-box and has no code-to-test join — it can't tell you a specific code change's precise tests. The delta is the repo-side join.
- *"Approximate selection will miss a regression."* Yes, it can — which is why it's advisory and over-selects (the safe failure mode). I will not make it blocking until I've measured its false-positive rate on real PRs, the same way we promoted CodeQL.
- *"You're generalizing a platform need from one repo and one conversation."* Correct, and I won't overstate it: this is a directional, qualitative proof-of-need, not a quantitative study. What gives it weight is that the need shows up from four independent angles in the engine, two of those needs are already GA-blocker tickets, and the headline primitive was reached independently by someone reasoning purely about the platform. That's a strong signal to investigate, not a finished business case.
- *"Why keep authoring out of the automation?"* Deliberate. Whatever enforces the gate must not also write the tests, or it can turn a red check green by rewriting the assertion. Authoring stays agent-*assisted* and human-reviewed.

## What I'm asking Product + Engineering to consider

1. **Entity annotations** — the open-form, synced, agent-writable metadata field. This is the net-new primitive, and the one that collapses the most workarounds (the cache, the label-overloading, the misleading URL, the lost triage verdict).
2. **A safe agent write surface** for metadata that isn't test steps — already in scope via MABL-20580; annotations satisfy it cleanly.
3. **MCP write parity** between local and cloud — already in scope via MABL-20586.
4. **Context-carrying credentials.**
5. A reframing worth internalizing: **failure triage is an orchestration + persistence problem, not a missing brain** — `analyze_failure` already classifies; it just needs to be wired into the change loop and given somewhere to persist.

## Roadmap (my side)

- Promote the coverage guard from advisory to blocking once its false-positive rate holds on real PRs (TAMD-188).
- Build a triage-orchestration POC: selection → run affected → `analyze_failure` → *propose* a bug-vs-stale verdict behind a human gate.
- Fix the i18n granularity noise (TAMD-193).

## Appendix — trail and artifacts

- **Shipped this session (all merged to `main`):** TAMD-187 (retire the legacy heuristic; one engine across DoD + pre-push + CI), TAMD-189 (Act 1, `/warranty`), TAMD-190 (test-impact on UI PRs), TAMD-191 (index refresh), TAMD-192 (Act 2, selection), TAMD-194 (evidence consolidation), TAMD-195 (this brief). Logged: TAMD-193 (i18n granularity). Tracked: TAMD-188 (advisory → blocking).
- **Confirmed platform refs:** MABL-20580 (edits versioning/no-silent-overwrite, GA-blocker), MABL-20586 (MCP parity, GA-blocker).
- **Evidence log:** `docs/SHIFT-LEFT-PRIMITIVES-EVIDENCE.md` — dated, with the full primitives table and the verdict.
- **Design brief:** `docs/SHIFT-LEFT-AGENTIC-TESTING.md`.
