# docs/archive/

Point-in-time deliverables kept for trend comparison + historical
reference. Not part of the evergreen documentation set.

## When to put a doc here

- **Snapshot audits** — `audits/DEMO-READINESS-<DATE>.md`,
  architecture-audit outputs, etc. These describe the repo's state at a
  specific moment and stop being accurate immediately afterward.
- **Superseded runbooks** — older runbook docs explicitly replaced by a
  current canonical version. Keep them for narration patterns or
  historical context.

## Layout

```
docs/archive/
  audits/         # snapshot audit outputs, dated by filename
  runbooks/       # superseded long-form runbooks
```

## Important

Archived docs are NOT linked from the evergreen doc graph (CLAUDE.md,
REFERENCE-ARCHITECTURE.md, README.md). Cross-references to archived
docs should be removed or rewritten to point at the current canonical
replacement.

Don't delete archived docs — keeping them in-repo preserves their
content for diff / trend / `git log -p` searches.
