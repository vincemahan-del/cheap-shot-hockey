# Shift-left engine → mabl platform primitives: evidence log

Running log of what building/operating the shift-left coverage engine
(`scripts/shift-left/`) reveals about mabl platform primitives that don't
exist yet. Purpose: validate — with concrete, dated evidence from a working
prototype — whether the needs hold, especially the **entity `annotations`**
idea (open-form JSON on every mabl entity, agent-writable via MCP/CLI,
persisted by ID, synced) that Dani independently proposed.

Each entry: the primitive, the workaround we're forced into, and the specific
moment in this experiment that proved the need. "Convergence" = a need we hit
from the engine side that matches a need Dani hit from the platform side
(without shared context — a stronger signal).

---

## P1 — Entity annotations (open-form JSON metadata, synced) — **CONVERGENCE**
**Need:** somewhere on a mabl entity (test, run, workspace, credential) to store
structured, agent-written metadata.

**Workarounds we're forced into:**
- `test-index.json` — a cached snapshot of each test's testids/routes/area.
  It's repo-local (only *my* agent sees it), goes stale, and needs a
  `coverage-auditor` refresh to stay current. It exists *only* because there's
  no queryable metadata field on a mabl test.
- `area-*` labels — structured meaning (the area a test covers) crammed into
  flat label strings, because labels are the only writable structured handle.

**Evidence (dated):**
- 2026-06-30 — The engine's *precise* impact can only name tests by re-deriving
  from the cached index; authoring a new test (`CSH-RT-INFO-UI-WarrantyPageDisplays`)
  did not make the engine "see" it until a manual index refresh. An annotation
  on the test (`{areas, coveredTestids, sourceTicket}`) would be read live by any
  agent — no cache, no refresh lag, no per-repo silo.

- 2026-06-30 — After a `coverage-auditor` refresh (index 35→38), the engine's
  *precise* impact correctly names the new warranty test for a `warranty/page.tsx`
  change. But note *how*: mabl's AI authored the test to navigate from the home
  footer link, so the test's recorded `url` is `/`, not `/warranty`. Route-based
  mapping alone would have misfiled it as the home page — the **testids**
  (`warranty-*`) are what produced `area=info`. Lesson: a mabl test's URL field is
  unreliable as coverage metadata; what it *actually verifies* (its testids) is the
  truth. An annotation stating `covers: [info]` / `coveredTestids: [...]` would be
  authoritative instead of inferred, and wouldn't depend on a refresh.

**Verdict so far:** STRONGLY SUPPORTED. The cache + label-overloading are pure
symptoms of this gap, and the URL-vs-testid mismatch shows even mabl's *existing*
metadata (the URL) can mislead — a declared annotation would settle it.

---

## P2 — Safe agent metadata writes (vs. editing test steps)
**Need:** a write surface an agent can update without risk of clobbering a test.

**Evidence (dated):**
- Editing a test's steps is last-write-wins to master (MABL-20580), which makes
  autonomous edits unsafe — so the engine deliberately keeps test-editing OUT of
  the automated path. Annotations are metadata, not steps, so they'd be a safe
  write surface and sidestep this entirely.

**Verdict so far:** SUPPORTED (this is *why* the triage/auto-edit half stays
proposal-only behind a human gate).

---

## P3 — MCP write parity (local vs cloud)
**Need:** the same write capabilities from the local/headless MCP as the cloud one.

**Evidence (dated):**
- 2026-06-30 — Label writes only work through the authenticated cloud MCP; the
  local/headless MCP can't (TAMD-176). In CI this is friction — the DoD check is
  read-only partly because of where writes are possible.

**Verdict so far:** SUPPORTED (operational friction, not a blocker).

---

## P4 — Credentials that carry context
**Need:** credentials annotated with persona / what they access / when an agent
should use them.

**Evidence (dated):**
- Authoring the warranty test required handing the agent a credentials story by
  hand; an agent can't read "this cred is the admin persona, use it for admin
  flows." Dani raised this exact example from the platform side. Same shape as P1
  (annotations on the credential entity).
- 2026-06-30 — **Empirical.** A real failed run (`csh-auth-login-valid-credentials`,
  `J12oeg6vbVaUhUDhi4PUIg-jr`) was a credential-resolution failure: `app.defaults.username`
  didn't substitute on Preview, so a placeholder was typed instead of an email and
  login failed. mabl's own `analyze_failure` recommended "reviewing the data-seeding
  logic or variable scope settings." If the credential carried its resolution
  context/persona as an annotation, the agent (and the test) could self-diagnose
  rather than typing a placeholder.

**Verdict so far:** SUPPORTED — now with empirical backing, not just convergence.

---

## P5 — Failure triage that persists (bug vs stale test) — **CONVERGENCE**
**Need:** classify a failure as a real regression vs a stale/misconfigured test, and
persist that verdict where any agent can read it.

**What already exists in mabl:** `analyze_failure` (post-hoc AI root-cause) and the
Runtime Recovery Agent (`testNeedsUpdate` / `repairNotes`) already produce a root
cause and a bug-vs-config classification. The triage half of the vision is NOT
net-new AI.

**Evidence (dated):**
- 2026-06-30 — Ran `analyze_failure` on the real failed run above
  (`J12oeg6vbVaUhUDhi4PUIg-jr`): it returned synopsis "incorrect credential variable
  substitution," explicitly classified it a "**recurring test configuration issue**"
  (i.e. stale/config, NOT an app regression), and gave next steps. So the
  bug-vs-stale call is available today.

**The gap this experiment shows is missing:**
1. **Orchestration** — the engine *selects* affected tests but doesn't yet run them
   → call `analyze_failure` on failures → surface the verdict in the PR/agent loop.
   (Kept out of the *autonomous* path on purpose — see P2 / the self-certifying-gate
   rule; the verdict should *propose*, a human disposes.)
2. **Persistence** — the verdict is generated on-demand and ephemeral. Dani's
   example #2, "detailed breakdown on test runs as to what happened and how it was
   identified," is exactly where it belongs: an annotation on the test run, so any
   agent reads "known recurring credential flake" instead of re-deriving it.

**Verdict so far:** SUPPORTED + CONVERGENCE. Triage = orchestration + persistence,
not a missing brain.

---

## VERDICT — after Acts 1–2 + edge probes (2026-06-30)

**Does it work?** Yes, end-to-end on real PRs: gap detection (the uncovered
`/warranty` page was flagged), test selection (a `ProductCard` change → `area-catalog`,
10 precise / 17 area-level, correctly **no** BROAD), auto-derived `area-*` labels (the
authored warranty test carries `area-info` with no hand-tagging), the full
author → index → precise-select loop, and the deterministic test-impact comment now
firing on UI-only PRs (TAMD-190). The testid join also beat route-mapping (the warranty
test's URL is `/`, yet it classified as `info` via its testids).

**Do the primitive needs hold — does this prove them?** Yes, and the strongest one
converges from four independent angles:

| Primitive | Status | Independent evidence in this experiment |
|---|---|---|
| **P1 entity annotations** | STRONGLY PROVEN | the stale repo-local index cache; `area-*` labels overloaded as a metadata store; the misleading test `url`; the ephemeral triage verdict — all four are the *same* missing field |
| P2 safe metadata writes | SUPPORTED | last-write-wins-to-master keeps autonomous test edits out of the path; annotations are a safe write surface |
| P3 MCP write parity | SUPPORTED | label writes only via the cloud MCP, not local |
| P4 creds carry context | SUPPORTED (empirical) | a real failure was credential non-resolution; analyze_failure pointed at credential/variable scope |
| P5 triage that persists | SUPPORTED + CONVERGENCE | analyze_failure already classifies bug-vs-stale; the verdict has nowhere to live |

**Headline:** Dani proposed entity `annotations` from the platform side without seeing
this build; the engine hit the same wall from the implementation side. That
independent convergence is the result — **this prototype is a working proof-of-need
for entity annotations**, with P2–P5 as corroborating, lower-order needs.

---

_Append entries below as the experiment surfaces more. Keep it dated and tied to
a concrete moment, not speculation._
