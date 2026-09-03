# Delinea → mabl credential rotation-sync POC

**Audience:** customers who store Shared System ID passwords in a PAM vault
(Delinea Secret Server, CyberArk, AWS Secrets Manager) and need mabl's
role-based login tests to survive password rotation.

**The claim this POC proves:** mabl's credential store does not compete with
the vault — the vault stays the system of record, and a small post-rotation
hook keeps the matching mabl credential in sync via mabl's public API
(`PATCH /credentials/{id}`). No secret is ever hand-copied after initial setup.

## Architecture

```
┌────────────────────┐   1. rotate password    ┌──────────────────────┐
│  Delinea Secret     │ ──────────────────────▶ │  Target system       │
│  Server (simulated  │                         │  (cheap-shot-hockey  │
│  by rotate-shared-  │                         │  Shared System ID)   │
│  id.sh)             │   2. sync new secret    ├──────────────────────┤
│                     │ ──────────────────────▶ │  mabl credential     │
└────────────────────┘   PATCH /credentials/{id}│  (write-only store)  │
                                                └──────────────────────┘
                          3. mabl login test runs green with the
                             rotated secret — zero test maintenance
```

In production the "hook" is a Delinea post-rotation event script (Secret
Server supports these natively). Here `scripts/delinea/rotate-shared-id.sh`
plays both Delinea's rotation and the hook.

## Pieces

| Piece | Path | Role |
|---|---|---|
| Shared System ID | `svc-roletest@cheapshot.test` | The role-testing account whose password rotates. Seeded demo users are **never** rotatable (`isSeedProtectedEmail`). |
| App-side rotation | `POST /api/test/rotate-password` | Token-guarded (`TEST_SEED_TOKEN`, same guard as seed-user; 404s when unset — inert in prod). Simulates Delinea rotating the target system. |
| Setup | `scripts/delinea/setup-poc.sh` | Ensures the user + mabl credential exist, then runs one rotation to converge. |
| Rotation hook | `scripts/delinea/rotate-shared-id.sh` | Rotate app password → `PATCH` the mabl credential. `--skip-sync` = negative control. |
| Verification | `mabl tests run --credentials-id <id> --headless` | Credential-driven login test proves the sync. |

## Prereqs

- `.env.local`: `TEST_SEED_TOKEN` (already present) and `MABL_API_TOKEN` — a
  workspace API key that can read/write credentials.
- Local dev server running (`npm run dev`), mabl CLI authenticated.
- `jq`, `openssl`.

## Demo arc (5 minutes)

Live asset IDs: test `CSH-DELINEA-POC-CredentialLogin` = `fmQlMzir9JLDobmIn0q8KA-j`
(labels `delinea-poc`, `TAMD-209`), credential = `uwRgYtVhIilwFizqFoJAYg-c`.
`--allow-billable-features` is required so the test's GenAI assertion executes
in CLI runs.

```bash
# 0. One-time setup: user + credential + first sync
./scripts/delinea/setup-poc.sh

# 1. Baseline: credential-driven login test is green
mabl tests run --id fmQlMzir9JLDobmIn0q8KA-j --credentials-id uwRgYtVhIilwFizqFoJAYg-c \
  --url http://localhost:3000 --headless --allow-billable-features

# 2. The pain: Delinea rotates, nobody syncs mabl → test fails
./scripts/delinea/rotate-shared-id.sh --skip-sync
mabl tests run --id fmQlMzir9JLDobmIn0q8KA-j --credentials-id uwRgYtVhIilwFizqFoJAYg-c \
  --url http://localhost:3000 --headless --allow-billable-features   # ← red: login rejected

# 3. The fix: rotation hook syncs mabl in the same breath → green again
./scripts/delinea/rotate-shared-id.sh
mabl tests run --id fmQlMzir9JLDobmIn0q8KA-j --credentials-id uwRgYtVhIilwFizqFoJAYg-c \
  --url http://localhost:3000 --headless --allow-billable-features   # ← green
```

Talking point at step 2: this failure is exactly what every rotation cycle
does to UI test suites when the vault and the test tool don't talk. The fix
is ~10 lines in the rotation hook.

## Cloud demo arc (the better show — runs in mabl cloud against prod)

Same three acts, but each run is a **cloud run**: the audience sees the mabl
results page, per-step screenshots, and the GenAI assertion's reasoning
instead of terminal output.

**One-time enablement:**

1. Set `TEST_SEED_TOKEN` in Vercel (Production env) using the **same value**
   as `.env.local` (the scripts source `.env.local`, so the values must
   match), then redeploy. This deliberately arms the token-guarded rotation
   endpoint in prod — acceptable for a fake demo store.
2. Create the prod demo identity + its own per-environment credential
   (credentials are not environment-aware, so prod gets its own — which is
   the recommended pattern anyway):

```bash
APP_URL=https://cheap-shot-hockey.vercel.app \
SHARED_ID_EMAIL=svc-role-demo@cheapshot.test \
CRED_NAME="CSH Shared System ID (Delinea POC Prod)" \
./scripts/delinea/setup-poc.sh
```

Add `CRED_CLOUD_ONLY=true` to create the credential **write-only** (cloud
runs only — the strongest security posture; see hardening notes below).

**The arc** (note the prod credential ID from setup; export the three vars
above in the demo shell so the rotate script targets prod):

```bash
# Act 1 — baseline green: cloud run, then open the run link in the mabl app
mabl tests run-cloud --id fmQlMzir9JLDobmIn0q8KA-j \
  --credentials-id <prod-cred-id> \
  --app-url https://cheap-shot-hockey.vercel.app --no-prompt

# Act 2 — the pain: Delinea rotates, nobody syncs mabl
./scripts/delinea/rotate-shared-id.sh --skip-sync
# (optional, visceral: try logging into the store UI with the old password — rejected)
mabl tests run-cloud ... same command ...   # ← red; show the failed login screenshot in mabl

# Act 3 — the fix: the rotation hook syncs mabl in the same breath
./scripts/delinea/rotate-shared-id.sh
mabl tests run-cloud ... same command ...   # ← green again
```

Narration for act 2's failure: "this is every rotation cycle in your suite
today — now watch the hook version." In production the hook is a Delinea
Secret Server post-rotation event script; this repo's script is those same
~10 lines.

## Production hardening notes (say these out loud)

- **Use cloud-only credentials + "Require cloud credentials".** The API
  documents `GET /credentials?with_secrets=true` as returning decrypted
  secrets for regular (non-cloud) credentials under sufficient permissions;
  a `cloud_only: true` credential can **never** be read back — writes only —
  and the workspace setting enforces cloud-only for every caller including
  API keys. Observed in this workspace (2026-09-03): even the Workspace-admin
  key got no secrets back with `with_secrets=true`, and `PATCH` works fine on
  a cloud-only credential — so rotation-sync loses nothing by going cloud-only.
  Set `CRED_CLOUD_ONLY=true` on `setup-poc.sh` to create the credential
  write-only (proven: credential `nOMor1gaiX08xEACPWRRJA-c`).
  (Trade-off: cloud-only creds don't work in the Trainer or local
  `mabl tests run` — use a regular credential for the localhost demo arc,
  cloud-only for the cloud/prod arc.)
- **Scope + expire the API key.** The hook's mabl API key should be dedicated,
  minimally scoped, and carry an expiration date (supported since 2026-03).
  Store *that* key in Delinea too.
- **One credential per role per environment.** Shared System IDs map 1:1 to
  mabl credentials; name them for the role, not the person.
- **Known product gaps** (candid): no native vault integration yet
  (CyberArk/AWS Secrets Manager requests are on the uncommitted backlog);
  one credential per test (multi-user journeys need workarounds); credentials
  are not environment-aware. File vault asks through the product portal —
  they aggregate.

## Status / verified

Full arc proven live 2026-09-03: setup (`POST /credentials` 201) → baseline
run green (24.6s) → `--skip-sync` rotation → run red (stale credential) →
synced rotation (`PATCH /credentials/{id}`) → run green (14.1s).

Operational notes:
- The mabl API key must be the **Workspace admin** type — it is the only
  workspace key type with `credentials.write`. A CLI-type key gets a 403
  naming the missing permission.
- The test's cloud generation baked the observed greeting ("Hi, Demo") into
  an assertion; the Shared System ID account is therefore named
  `Demo SharedSystemID` (first name renders the same greeting). Override with
  `SHARED_ID_NAME` if regenerating with different assertions.
