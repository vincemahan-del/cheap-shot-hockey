// Postgres-backed order persistence (Neon).
//
// This module is the I/O wrapper for orders when a database is configured. It
// is activated by `store.ts` only when DATABASE_URL / POSTGRES_URL is present
// (see `postgresEnabled`). When absent, `store.ts` uses its in-memory Map
// instead, so local dev and the unit suite are unchanged.
//
// Excluded from coverage in vitest.config.ts (same rationale as session.ts /
// the cookie wrappers): it talks to an external service and can't be unit
// tested without a live DB. It's validated via the live API/DB seeding tests.
//
// Scope is intentionally orders-only. Products/users stay seeded in-memory and
// carts/recent-orders stay in cookies.
import { randomUUID } from "node:crypto";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { Order, OrderLine, OrderStatus } from "./types";
import { SEED_ORDERS } from "./seed";

/** True when a Postgres connection string is configured (and we're not in a unit-test run). */
export function postgresEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL) && !process.env.VITEST;
}

let _sql: NeonQueryFunction<false, false> | null = null;
function sql(): NeonQueryFunction<false, false> {
  if (!_sql) {
    const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
    if (!url) throw new Error("orders-db: no DATABASE_URL/POSTGRES_URL configured");
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
    CREATE TABLE IF NOT EXISTS orders (
      id                   text PRIMARY KEY,
      user_id              text,
      guest_email          text,
      subtotal_cents       integer NOT NULL,
      tax_cents            integer NOT NULL,
      shipping_cents       integer NOT NULL,
      total_cents          integer NOT NULL,
      status               text NOT NULL,
      shipping_name        text NOT NULL,
      shipping_street      text NOT NULL,
      shipping_city        text NOT NULL,
      shipping_state       text NOT NULL,
      shipping_postal_code text NOT NULL,
      shipping_country     text NOT NULL,
      created_at           timestamptz NOT NULL
    )`;
  await db`
    CREATE TABLE IF NOT EXISTS order_lines (
      id               bigserial PRIMARY KEY,
      order_id         text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id       text NOT NULL,
      name             text NOT NULL,
      unit_price_cents integer NOT NULL,
      quantity         integer NOT NULL
    )`;
  await db`CREATE INDEX IF NOT EXISTS idx_orders_user ON orders (user_id)`;
  await db`CREATE INDEX IF NOT EXISTS idx_orders_guest ON orders (lower(guest_email))`;
  await db`CREATE INDEX IF NOT EXISTS idx_order_lines_order ON order_lines (order_id)`;

  // Seed the demo order(s) so /orders and /admin show parity with in-memory mode.
  for (const seed of SEED_ORDERS) {
    const existing = await db`SELECT 1 FROM orders WHERE id = ${seed.id}`;
    if (existing.length === 0) {
      await insertOrderRow(seed);
    }
  }
}

async function insertOrderRow(order: Order): Promise<void> {
  const db = sql();
  const a = order.shippingAddress;
  await db.transaction([
    db`INSERT INTO orders (
         id, user_id, guest_email, subtotal_cents, tax_cents, shipping_cents,
         total_cents, status, shipping_name, shipping_street, shipping_city,
         shipping_state, shipping_postal_code, shipping_country, created_at
       ) VALUES (
         ${order.id}, ${order.userId}, ${order.guestEmail}, ${order.subtotalCents},
         ${order.taxCents}, ${order.shippingCents}, ${order.totalCents}, ${order.status},
         ${a.name}, ${a.street}, ${a.city}, ${a.state}, ${a.postalCode}, ${a.country},
         ${order.createdAt}
       )
       ON CONFLICT (id) DO NOTHING`,
    ...order.lines.map(
      (l) =>
        db`INSERT INTO order_lines (order_id, product_id, name, unit_price_cents, quantity)
           VALUES (${order.id}, ${l.productId}, ${l.name}, ${l.unitPriceCents}, ${l.quantity})`,
    ),
  ]);
}

// ---- row mapping ----

type OrderRow = {
  id: string;
  user_id: string | null;
  guest_email: string | null;
  subtotal_cents: number;
  tax_cents: number;
  shipping_cents: number;
  total_cents: number;
  status: string;
  shipping_name: string;
  shipping_street: string;
  shipping_city: string;
  shipping_state: string;
  shipping_postal_code: string;
  shipping_country: string;
  created_at: string;
};

function rowToOrder(row: OrderRow, lines: OrderLine[]): Order {
  return {
    id: row.id,
    userId: row.user_id,
    guestEmail: row.guest_email,
    lines,
    subtotalCents: row.subtotal_cents,
    taxCents: row.tax_cents,
    shippingCents: row.shipping_cents,
    totalCents: row.total_cents,
    status: row.status as OrderStatus,
    shippingAddress: {
      name: row.shipping_name,
      street: row.shipping_street,
      city: row.shipping_city,
      state: row.shipping_state,
      postalCode: row.shipping_postal_code,
      country: row.shipping_country,
    },
    // Normalize Postgres timestamptz back to an ISO string (matches in-memory format).
    createdAt: new Date(row.created_at).toISOString(),
  };
}

async function linesFor(orderIds: string[]): Promise<Map<string, OrderLine[]>> {
  const byOrder = new Map<string, OrderLine[]>();
  if (orderIds.length === 0) return byOrder;
  const db = sql();
  const rows = (await db`
    SELECT order_id, product_id, name, unit_price_cents, quantity
    FROM order_lines WHERE order_id = ANY(${orderIds}) ORDER BY id
  `) as Array<{
    order_id: string;
    product_id: string;
    name: string;
    unit_price_cents: number;
    quantity: number;
  }>;
  for (const r of rows) {
    const line: OrderLine = {
      productId: r.product_id,
      name: r.name,
      unitPriceCents: r.unit_price_cents,
      quantity: r.quantity,
    };
    const list = byOrder.get(r.order_id);
    if (list) list.push(line);
    else byOrder.set(r.order_id, [line]);
  }
  return byOrder;
}

async function hydrate(rows: OrderRow[]): Promise<Order[]> {
  const lineMap = await linesFor(rows.map((r) => r.id));
  return rows.map((r) => rowToOrder(r, lineMap.get(r.id) ?? []));
}

// ---- public API (matches the in-memory order functions in store.ts) ----

export async function createOrder(order: Omit<Order, "id" | "createdAt">): Promise<Order> {
  await ready();
  const full: Order = {
    ...order,
    id: `o-${Date.now().toString(36)}${randomUUID().slice(0, 4)}`,
    createdAt: new Date().toISOString(),
  };
  await insertOrderRow(full);
  return full;
}

export async function getOrder(id: string): Promise<Order | undefined> {
  await ready();
  const rows = (await sql()`SELECT * FROM orders WHERE id = ${id}`) as OrderRow[];
  if (rows.length === 0) return undefined;
  return (await hydrate(rows))[0];
}

export async function listOrdersForUser(userId: string): Promise<Order[]> {
  await ready();
  const rows = (await sql()`
    SELECT * FROM orders WHERE user_id = ${userId} ORDER BY created_at DESC
  `) as OrderRow[];
  return hydrate(rows);
}

export async function listOrdersByGuestEmail(email: string): Promise<Order[]> {
  await ready();
  const rows = (await sql()`
    SELECT * FROM orders WHERE lower(guest_email) = lower(${email}) ORDER BY created_at DESC
  `) as OrderRow[];
  return hydrate(rows);
}

export async function listAllOrders(): Promise<Order[]> {
  await ready();
  const rows = (await sql()`SELECT * FROM orders ORDER BY created_at DESC`) as OrderRow[];
  return hydrate(rows);
}
