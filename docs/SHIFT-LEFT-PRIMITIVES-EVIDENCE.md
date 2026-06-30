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

**Verdict so far:** SUPPORTED via convergence; not yet stress-tested in this repo.

---

_Append entries below as the experiment surfaces more. Keep it dated and tied to
a concrete moment, not speculation._
