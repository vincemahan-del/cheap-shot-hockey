// Postgres-backed user persistence (Neon).
//
// This module is the I/O wrapper for users when a database is configured. It
// is activated by `store.ts` only when DATABASE_URL / POSTGRES_URL is present
// (see `postgresEnabled` in orders-db.ts). When absent, `store.ts` uses its
// in-memory Map instead, so local dev and the unit suite are unchanged.
//
// Why this exists: `globalThis.__CSH_STORE__` is a per-Lambda in-memory map.
// A user registered on Lambda A is invisible to Lambda B, so a *form login*
// (POST /api/auth/login → getUserByEmail) for a freshly-registered user is
// flaky across Vercel's serverless instances. Registration itself already
// survives via the signed `csh_auth` cookie (see session.ts), but logging the
// same user back in through the form needs a shared source of truth. Orders
// solved the identical problem with Neon (TAMD-159); users follow that pattern
// so a unique-user-per-test-run login flow is reliable against preview/prod.
//
// Excluded from coverage in vitest.config.ts (same rationale as orders-db.ts /
// session.ts / the cookie wrappers): it talks to an external service and can't
// be unit tested without a live DB. It's validated via the live API tests.
//
// Scope: users only. Products stay seeded in-memory; carts/recent-orders stay
// in cookies; orders live in orders-db.ts.
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { User } from "./types";
import { SEED_USERS } from "./seed";

let _sql: NeonQueryFunction<false, false> | null = null;
function sql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
    if (!url) throw new Error("users-db: no DATABASE_URL/POSTGRES_URL configured");
    _sql = neon(url);
  }
  return _sql;
}

// Run schema creation + seed exactly once per cold start.
let _ready: Promise<void> | null = null;
function ready(): Promise<void> {
  if (!_ready) _ready = ensureSchema();
  return _ready;
}

async function ensureSchema(): Promise<void> {
  const db = sql();
  await db`
    CREATE TABLE IF NOT EXISTS users (
      id            text PRIMARY KEY,
      email         text NOT NULL,
      password_hash text NOT NULL,
      name          text NOT NULL,
      role          text NOT NULL,
      created_at    timestamptz NOT NULL
    )`;
  // Case-insensitive uniqueness on email — matches getUserByEmail's lower() match
  // and the register route's duplicate guard.
  await db`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email))`;

  // Seed the demo + admin users so form login keeps working in prod parity with
  // in-memory mode. Idempotent: ON CONFLICT keeps any existing row untouched.
  for (const seed of SEED_USERS) {
    await db`
      INSERT INTO users (id, email, password_hash, name, role, created_at)
      VALUES (${seed.id}, ${seed.email}, ${seed.passwordHash}, ${seed.name}, ${seed.role}, ${seed.createdAt})
      ON CONFLICT (id) DO NOTHING`;
  }
}

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  role: string;
  created_at: string;
};

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    name: row.name,
    role: row.role as User["role"],
    createdAt: new Date(row.created_at).toISOString(),
  };
}

// ---- public API (matches the in-memory user functions in store.ts) ----

export async function getUserByEmail(email: string): Promise<User | undefined> {
  await ready();
  const rows = (await sql()`
    SELECT * FROM users WHERE lower(email) = lower(${email}) LIMIT 1
  `) as UserRow[];
  return rows.length ? rowToUser(rows[0]) : undefined;
}

export async function getUser(id: string): Promise<User | undefined> {
  await ready();
  const rows = (await sql()`SELECT * FROM users WHERE id = ${id} LIMIT 1`) as UserRow[];
  return rows.length ? rowToUser(rows[0]) : undefined;
}

export async function createUser(user: User): Promise<User> {
  await ready();
  await sql()`
    INSERT INTO users (id, email, password_hash, name, role, created_at)
    VALUES (${user.id}, ${user.email}, ${user.passwordHash}, ${user.name}, ${user.role}, ${user.createdAt})`;
  return user;
}

export async function listAllUsers(): Promise<User[]> {
  await ready();
  const rows = (await sql()`SELECT * FROM users ORDER BY created_at`) as UserRow[];
  return rows.map(rowToUser);
}
