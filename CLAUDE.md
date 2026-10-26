# Claude context — cheap-shot-hockey

A fake hockey store used to demonstrate a mabl-driven agentic development
lifecycle. Read [`docs/REFERENCE-ARCHITECTURE.md`](docs/REFERENCE-ARCHITECTURE.md)
for the pipeline. This is a public repo: no customer names, people, internal
hostnames or session links in code, commits, PRs or comments.

## Stack

Next.js 16 App Router + React 19 + TypeScript, Tailwind v4, Vercel (production
deploys from `main`), Postgres (Neon) for users and orders.

This is **not** the Next.js in your training data: APIs and conventions changed.
Read the relevant guide in `node_modules/next/dist/docs/` before writing code.

## Conventions

- Every interactive element gets a `data-testid` matching the pattern nearby
  (e.g. `add-to-cart-${productId}`).
- Carts and recent guest orders stay in cookies (`src/lib/cart-cookie.ts`,
  `src/lib/order-cookie.ts`); serverless instances don't share memory.
- Guest checkout stays; never require login to check out.
- Seeded demo accounts in `src/lib/seed.ts` (`demo@cheapshot.test`,
  `admin@cheapshot.test`) don't change.
- Keep brand names fake and product photos real (`public/product-photos/`).
- Comments only where the code can't say it.

## Work

- One TAMD Jira ticket per piece of work. Branch `TAMD-N/<slug>`, commits
  prefixed `TAMD-N: `.
- Use `/ship TAMD-N` (`.claude/skills/ship/`) to take a ticket to a PR.
- Before pushing: `npm run lint && npm test && npm run build`.
- Never apply `human-approved` or `test-impact-gate-exempt`, merge a mabl
  branch, or promote production. Those are the human's.
- Never start mabl cloud runs from the agent; CI starts them. Local CLI runs
  are free.

## Gates

Required on `main`: `lint`, `unit`, `build`, `dependency-review`, `CodeQL`,
`mabl-smoke`, `mabl-impact`, `human-approved`. `MABL_CLOUD_GATE=disabled`
pauses mabl cloud runs; the mabl jobs then pass and say "paused".

## mabl

Use the mabl skills plugin (`mabl@mabl`, enabled in `.claude/settings.json`):
`mabl-test-impact`, `mabl-test-authoring`, `mabl-test-coverage-design`,
`mabl-test-edit`, `mabl-test-edit-verify`, `mabl-version-compare`, `mabl-debug`.

| | ID |
|---|---|
| Workspace "Cheap Shot Hockey Demo" | `pXXgThbNi4HfQOpiZptHfw-w` |
| Application "Cheap Shot Hockey" | `OZqmshBkUfVSesWy49g1eQ-a` |
| Preview environment (default) | `TpuarWvfj1hOREDT0JGvjA-e` — pass the PR preview URL as the URL override |
| Production environment | `vwf8Vni5e7H0XTfT5hbi6w-e` |
| Local environment | `DmlIvADtF8jPDm9J7Bpshw-e` — http://localhost:3000 |
| Credential "Demo customer" | `JxWK20l5gOOFOtWjaJHfOg-c` |
| Credential "Admin user" | `cllS2frME2tXYwTOu5cJrw-c` |

Labels: `type-smk` + `exec-pr` / `exec-postdeploy` (smoke plans), `type-rt`
(full regression, nightly), `area-*` (app area), `exhibit` (fails on purpose;
never `type-rt`), and the ticket key on every test created for a ticket.

Test edits for a PR happen on the mabl branch with the same name as the git
branch (slashes included). CI passes `--auto-branch` with it, because mabl's
by-name branch lookup fails on `/`; creating an existing branch returns it.
branch. Failure triage: `analyze_mabl_failure` / `analyze_mabl_results` on the
run; "can we ship?": `check_release_readiness` on the deployment.
