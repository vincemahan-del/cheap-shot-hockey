// Mock secrets-vault storage for the Delinea pull-model POC.
//
// Simulates the one behavior the pull model needs from a PAM vault (e.g.
// Delinea Secret Server): store the CURRENT username/password of a fixed
// Shared System ID, retrievable by secret id. The rotation script updates
// this store in the same breath it rotates the app password — playing the
// vault's own record of the secret. See docs/DELINEA-ROTATION-POC.md.
//
// Postgres-backed when DATABASE_URL/POSTGRES_URL is configured (so prod cloud
// runs see a consistent store across lambdas), in-memory otherwise — the same
// split as users (users-db.ts). Plaintext by design: this is a fake store
// simulating a vault, whose entire job is returning plaintext secrets to
// authorized callers.
//
// Excluded from unit coverage in vitest.config.ts (same rationale as
// users-db.ts): the pg path talks to an external service; validated by the
// live POC tests.
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { postgresEnabled } from "./orders-db";

export interface VaultSecret {
  id: string;
  username: string;
  password: string;
  updatedAt: string;
}

// ---- in-memory fallback (local dev) ----

declare global {
  var __CSH_VAULT__: Map<string, VaultSecret> | undefined;
}

function memoryVault(): Map<string, VaultSecret> {
  if (!globalThis.__CSH_VAULT__) globalThis.__CSH_VAULT__ = new Map();
  return globalThis.__CSH_VAULT__;
}

// ---- postgres path ----

let _sql: NeonQueryFunction<false, false> | null = null;
function sql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
    if (!url) throw new Error("vault-db: no DATABASE_URL/POSTGRES_URL configured");
    _sql = neon(url);
  }
  return _sql;
}

let _ready: Promise<void> | null = null;
function ready(): Promise<void> {
  if (!_ready) {
    _ready = (async () => {
      await sql()`
        CREATE TABLE IF NOT EXISTS vault_secrets (
          id         text PRIMARY KEY,
          username   text NOT NULL,
          password   text NOT NULL,
          updated_at timestamptz NOT NULL
        )`;
    })();
  }
  return _ready;
}

// ---- public API ----

export async function getVaultSecret(id: string): Promise<VaultSecret | undefined> {
  if (!postgresEnabled()) return memoryVault().get(id);
  await ready();
  const rows = (await sql()`
    SELECT * FROM vault_secrets WHERE id = ${id} LIMIT 1
  `) as { id: string; username: string; password: string; updated_at: string }[];
  if (!rows.length) return undefined;
  return {
    id: rows[0].id,
    username: rows[0].username,
    password: rows[0].password,
    updatedAt: new Date(rows[0].updated_at).toISOString(),
  };
}

export async function upsertVaultSecret(
  id: string,
  username: string,
  password: string,
): Promise<VaultSecret> {
  const secret: VaultSecret = {
    id,
    username,
    password,
    updatedAt: new Date().toISOString(),
  };
  if (!postgresEnabled()) {
    memoryVault().set(id, secret);
    return secret;
  }
  await ready();
  await sql()`
    INSERT INTO vault_secrets (id, username, password, updated_at)
    VALUES (${secret.id}, ${secret.username}, ${secret.password}, ${secret.updatedAt})
    ON CONFLICT (id) DO UPDATE
      SET username = ${secret.username}, password = ${secret.password}, updated_at = ${secret.updatedAt}`;
  return secret;
}
