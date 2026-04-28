# Cheap Shot Hockey

> Fake hockey equipment store. Real demo value. Built to showcase mabl against both UI and API surfaces — *and* to serve as a forkable reference architecture for an agentic SDLC.

Cheap Shot Hockey is a full-stack Next.js demo app designed for customer demonstrations of [mabl](https://www.mabl.com/). It ships with a storefront UI, a JSON REST API, an OpenAPI 3.1 spec, and a set of toggleable failure modes so you can drive believable demos of UI test auto-healing, API contract testing, and intelligent failure analysis — all from a single Vercel deploy.

This repo also doubles as a **reference architecture for agentic ticket-to-prod**: one prompt to Claude Code drives a Jira ticket through GHA gates (lint → coverage → build → newman → mabl smoke → branch protection → auto-merge → Vercel → post-deploy verification → recovery agent on failure) without further human input. See [`docs/REFERENCE-ARCHITECTURE.md`](docs/REFERENCE-ARCHITECTURE.md) for the pattern, [`docs/FORK-GUIDE.md`](docs/FORK-GUIDE.md) for the 90-min "fork and deploy on your own stack" walkthrough, and [`docs/SDLC-DEMO.md`](docs/SDLC-DEMO.md) for the customer-demo runbook.

---

## What's in the box

### UI surface (demo journeys)

| Route | Purpose | Good for demo-ing |
| --- | --- | --- |
| `/` | Home, featured deals, category grid | Smoke tests, hero/CTA assertions |
| `/products` | Catalog with category, position, brand, search filters | Dynamic content, filter UI, data-driven tests |
| `/products/[slug]` | Product detail page | URL/slug assertions, add-to-cart |
| `/cart` | Cart view with quantity controls | Stateful UI, optimistic updates |
| `/checkout` | Login-gated checkout form | Form validation, auth redirect |
| `/orders` | Order history (login-gated) | Auth flows, table assertions |
| `/orders/[id]` | Order detail + confirmation banner | Post-purchase verification |
| `/login`, `/register`, `/account` | Auth | Credential handling, session persistence |
| `/admin` | Admin dashboard (not linked from nav) | **Coverage-gap demos** — show mabl discovering un-tested routes |

### API surface

All routes live under `/api/*` and return JSON. The OpenAPI 3.1 spec is served at `/api/openapi` so mabl can import it and scaffold API tests automatically.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/health` | Liveness check |
| GET | `/api/openapi` | OpenAPI 3.1 spec |
| GET | `/api/products` | List products (supports `?category`, `?brand`, `?position`, `?hand`, `?q`, `?onSale`, `?minPriceCents`, `?maxPriceCents`) |
| GET | `/api/products/{id}` | Fetch by id or slug |
| GET / POST / DELETE | `/api/cart` | Read, mutate, clear the current session's cart |
| GET / POST | `/api/orders` | List user's orders / place a new order |
| GET | `/api/orders/{id}` | Fetch a single order |
| POST | `/api/auth/login` | Log in |
| POST | `/api/auth/logout` | Log out |
| POST | `/api/auth/register` | Create an account |
| GET | `/api/auth/me` | Current session user |
| GET | `/api/admin/orders` | Admin-only list of all orders |

### Demo credentials (seeded)

| Email | Password | Role |
| --- | --- | --- |
| `demo@cheapshot.test` | `demo1234` | customer |
| `admin@cheapshot.test` | `admin1234` | admin |

---

## Running locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

The data layer is in-memory — restarting the server resets seed data, which is perfect for repeatable demos. If you need to reset mid-demo, just restart the dev server.

## Deploying

Push the repo to GitHub, import it on Vercel, accept defaults. No environment variables are required for demo use. The single deploy serves both the UI and the API at the same origin — no CORS configuration needed for mabl.

If you want stable cookie signing in production, set `AUTH_SECRET` to any random string.

---

## Demo modes: driving failures on demand

Append a `?demo=<mode>` query param to any page. The mode sticks for 60 minutes via cookie, so you can navigate freely. Append `?demo=normal` to reset.

| Mode | Effect |
| --- | --- |
| `normal` | Default — everything works |
| `slow` | API endpoints add a 2.5s delay before responding |
| `flaky` | 25% of API calls stall, 15–20% return 503 |
| `broken` | API endpoints return 503 every time |

**Example:** visit `http://localhost:3000/products?demo=flaky` and run a mabl test — watch the suite pick up the intermittent behavior.

Under the hood, middleware (`src/middleware.ts`) translates the query param into an `X-Demo-Mode` request header; each API route checks that header via `src/lib/demo.ts`.

---

## Using this with mabl

### 1. Point mabl at your deployment

Create an environment in mabl with:

- **Application URL:** `https://<your-vercel-domain>`
- **API base URL:** `https://<your-vercel-domain>/api`
- **Credentials:** `demo@cheapshot.test` / `demo1234`

### 2. Import the API spec

In the mabl API test section, use "Import from OpenAPI" and paste:
`https://<your-vercel-domain>/api/openapi`

You should get endpoint scaffolding for every route above.

### 3. Suggested starter journeys

**UI — golden path:**
1. Home → click "Shop the deals"
2. Catalog → filter by category `sticks`
3. Click the first product card
4. Add to cart
5. Open cart → proceed to checkout
6. Log in with demo credentials
7. Fill shipping address → place order
8. Assert on order confirmation banner

**UI — auth + orders:**
1. Go straight to `/orders` (should redirect to login)
2. Log in
3. Assert order `o-1001` from seed data is visible

**API — smoke:**
- GET `/api/health` → 200
- GET `/api/products` → `count > 0`
- GET `/api/products/apex-velocity-pro-stick` → specific product shape

**API — auth chain:**
1. POST `/api/auth/login` with demo creds → 200 + session cookie
2. GET `/api/auth/me` → returns user
3. POST `/api/cart` `{ productId: "p-stk-001", quantity: 1 }` → 200
4. POST `/api/orders` with shipping address → 201
5. GET `/api/orders` → includes the order just created

**API ↔ UI chained:**
1. Create an order via `POST /api/orders`
2. Open `/orders/<id>` in the UI
3. Assert the order total on-screen matches the API response total

### 4. Demo the failure modes

Use the demo modes to show:
- **Auto-healing under latency** — run a UI test with `?demo=slow`
- **Flake detection** — run the same suite 5× with `?demo=flaky` and watch mabl cluster the failures
- **Failure analysis** — run with `?demo=broken` and let mabl's `analyze_failure` attribute the 503s

### 5. The `/admin` coverage-gap demo

The `/admin` route is intentionally not linked from the public navigation. Use it to demonstrate how mabl's crawler (or a `mabl-coverage-gap` skill) can discover routes your journeys don't cover.

---

## Architecture quick reference

```
src/
├── app/                     Next.js App Router
│   ├── api/                 REST endpoints
│   └── (pages)/             UI routes
├── components/              React components (server + client)
├── lib/
│   ├── types.ts             Shared types
│   ├── seed.ts              Products, users, orders fixtures
│   ├── store.ts             In-memory data store (singleton)
│   ├── session.ts           Cookie-based auth
│   ├── auth-crypto.ts       HMAC signing + password hashing
│   ├── demo.ts              Demo-mode behavior
│   ├── format.ts            Price, category display helpers
│   └── api.ts               JSON response helpers
└── middleware.ts            Translates ?demo= query into X-Demo-Mode header
```

## License

Demo project — do what you want with it.
