# T1 Local Gate — mabl-aligned smoke via newman

The **T1 gate** is the first of three agentic-shift-left quality gates.
It runs the mabl API smoke suite **locally** via
[newman](https://github.com/postmanlabs/newman) against the dev server
on `localhost:3000` before any `git push` or agentic code change.

## Why T1 exists

| Gate | Runs where | When | What runs |
| --- | --- | --- | --- |
| **T1** — local | Your laptop | Pre-push, agent self-check, explicit `npm run test:mabl:local` | 3 API smokes + E2E CHP (11 requests, 37 assertions, ~450ms) |
| **T2** — preview | mabl cloud | On PR push | Same 3 API smokes + UI CHP against Vercel preview URL |
| **T3** — post-deploy | mabl cloud | After prod deploy | Same smokes against production URL |

T1 gives the agent (or you) a < 1-second signal before the network
round-trip to CI. Same logical tests as T2, running directly against
your local dev server — so anything that passes T1 is expected to pass
T2 barring environment-specific bugs.

## Run it manually

```bash
# Default: localhost:3000
npm run test:mabl:local

# Against a Preview deploy (bypasses mabl cloud, useful for debugging)
npm run test:mabl:local:preview

# Custom base
./scripts/mabl-local-gate.sh --base https://some-env.example.com/api
```

Green result:

```
┌─────────────────────────┬──────────────────┬──────────────────┐
│              iterations │                1 │                0 │
│                requests │               11 │                0 │
│            test-scripts │               11 │                0 │
│              assertions │               37 │                0 │
│ total run duration: 450ms                                    │
│ average response time: 27ms [min: 8ms, max: 75ms]            │
└───────────────────────────────────────────────────────────────┘
```

## Install the pre-push hook

One-time per clone:

```bash
./scripts/install-git-hooks.sh
```

This writes `.git/hooks/pre-push` that runs `mabl-local-gate.sh` before
every push. If the dev server isn't running on `:3000` it skips
silently (mabl cloud T2 will catch any regression anyway).

**Emergency bypass** (still runs T2 in cloud):
```bash
git push --no-verify
```

## How the Claude agent uses it

When you ask Claude Code to make a change, it can self-gate before
suggesting a commit:

```
User: "Add free shipping threshold at $50 instead of $99"
Claude:  → edits shipping logic
         → runs `npm run test:mabl:local`
         → gate fails on totalCents assertion (expected 21599 got 21999)
         → realizes the tax calc changes when shipping changes
         → updates tax math
         → gate green
         → commits + pushes
```

The 450ms gate is inside Claude's normal edit-run-check loop — it
doesn't slow the agent down.

## Mapping to the mabl cloud layer

The `mabl/postman/csh-api-smoke.postman_collection.json` collection is
a **file-based mirror** of the mabl `CSH-SMOKE-API` plan. Same tests,
same assertions — the only difference is where they execute:

| Collection test | Mabl test in cloud | Cloud label set |
| --- | --- | --- |
| `CSH-SMK-HEALTH-API-ReturnsOkStatus` | same name | `type-smk, type-api, exec-pr, exec-postdeploy` |
| `CSH-SMK-BUILD-API-BuildInfoReflectsCommit` | same name | `type-smk, type-api, exec-pr, exec-postdeploy` |
| `CSH-CHP-01`–`CSH-CHP-09` (9 chained) | `CSH-CHP-CHECKOUT-API-CustomerPlacesOrderEndToEnd` | `type-chp, type-api, exec-pr, exec-postdeploy, exec-nightly` |

**No labels exist at the T1 layer** — newman is file-driven. Labels
enter the picture the moment CI dispatches to mabl cloud via
`scripts/mabl-deployment.sh --labels type-smk,exec-pr ...` (T2) or
`--labels type-smk,exec-postdeploy ...` (T3).

## Adding tests to the T1 gate

Two options:

1. **Append to the existing collection.** Edit
   `mabl/postman/csh-api-smoke.postman_collection.json`, add a new
   `item` with its `pm.test(...)` assertions, re-run
   `npm run test:mabl:local`. No other plumbing needed.

2. **Add a second collection** (when the gate gets too chatty):
   ```
   mabl/postman/
     csh-api-smoke.postman_collection.json        ← T1 default
     csh-api-regression.postman_collection.json   ← nightly-only
   ```
   Then pass `--collection mabl/postman/csh-api-regression...` to the
   gate script, or add a second npm script.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `❌ newman not found` | devDep not installed | `npm ci` |
| `❌ dev server unreachable at ...` | `npm run dev` isn't running | Start it; or use `--base <preview-url>` |
| CHP assertion `totalCents 21599` fails | Pricing, tax, or shipping math changed | Intentional? Update the assertion; unintentional? Real bug |
| `ECONNREFUSED` partway through | Dev server crashed mid-run | Check `npm run dev` logs |

## References

- `docs/MABL-API-TESTS.md` — T2/T3 cloud plan catalog
- `docs/MABL-UI-TESTS.md` — T2 UI layer
- `docs/AGENTIC-SHIFT-LEFT.md` — full T1→T2→T3 workflow narrative
- `scripts/mabl-local-gate.sh` — the runner
- `scripts/install-git-hooks.sh` — pre-push hook installer
- `mabl/postman/csh-api-smoke.postman_collection.json` — the T1 collection
