import { randomUUID } from "node:crypto";
import type { Cart, CartLine, Order, Product, User } from "./types";
import { SEED_ORDERS, SEED_PRODUCTS, SEED_USERS } from "./seed";

type Store = {
  products: Map<string, Product>;
  users: Map<string, User>;
  orders: Map<string, Order>;
  carts: Map<string, Cart>;
};

declare global {
  var __CSH_STORE__: Store | undefined;
}

function createStore(): Store {
  return {
    products: new Map(SEED_PRODUCTS.map((p) => [p.id, { ...p }])),
    users: new Map(SEED_USERS.map((u) => [u.id, { ...u }])),
    orders: new Map(SEED_ORDERS.map((o) => [o.id, { ...o }])),
    carts: new Map(),
  };
}

function store(): Store {
  if (!globalThis.__CSH_STORE__) globalThis.__CSH_STORE__ = createStore();
  return globalThis.__CSH_STORE__;
}

// Products

export function listProducts(opts?: {
  category?: string;
  brand?: string;
  position?: string;
  hand?: string;
  minPriceCents?: number;
  maxPriceCents?: number;
  search?: string;
  onSale?: boolean;
}): Product[] {
  let items = Array.from(store().products.values());
  if (opts?.category) items = items.filter((p) => p.category === opts.category);
  if (opts?.brand) items = items.filter((p) => p.brand.toLowerCase() === opts.brand!.toLowerCase());
  if (opts?.position) items = items.filter((p) => p.position === opts.position);
  if (opts?.hand) items = items.filter((p) => p.hand === opts.hand);
  if (opts?.onSale) items = items.filter((p) => p.salePriceCents != null);
  if (opts?.minPriceCents != null) {
    items = items.filter((p) => currentPrice(p) >= opts.minPriceCents!);
  }
  if (opts?.maxPriceCents != null) {
    items = items.filter((p) => currentPrice(p) <= opts.maxPriceCents!);
  }
  if (opts?.search) {
    const q = opts.search.toLowerCase();
    items = items.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.brand.toLowerCase().includes(q),
    );
  }
  return items;
}

export function getProduct(id: string): Product | undefined {
  return store().products.get(id);
}

export function getProductBySlug(slug: string): Product | undefined {
  for (const p of store().products.values()) {
    if (p.slug === slug) return p;
  }
  return undefined;
}

export function currentPrice(p: Product): number {
  return p.salePriceCents ?? p.priceCents;
}

// Users

export function getUserByEmail(email: string): User | undefined {
  const lower = email.toLowerCase();
  for (const u of store().users.values()) {
    if (u.email.toLowerCase() === lower) return u;
  }
  return undefined;
}

export function getUser(id: string): User | undefined {
  return store().users.get(id);
}

export function createUser(input: {
  email: string;
  passwordHash: string;
  name: string;
}): User {
  const id = `u-${randomUUID().slice(0, 8)}`;
  const user: User = {
    id,
    email: input.email,
    passwordHash: input.passwordHash,
    name: input.name,
    role: "customer",
    createdAt: new Date().toISOString(),
  };
  store().users.set(id, user);
  return user;
}

// Cart

export function getCart(sessionId: string): Cart {
  const existing = store().carts.get(sessionId);
  if (existing) return existing;
  const fresh: Cart = { sessionId, lines: [], updatedAt: new Date().toISOString() };
  store().carts.set(sessionId, fresh);
  return fresh;
}

export function setCartLine(sessionId: string, line: CartLine): Cart {
  const cart = getCart(sessionId);
  const idx = cart.lines.findIndex((l) => l.productId === line.productId);
  if (line.quantity <= 0) {
    if (idx >= 0) cart.lines.splice(idx, 1);
  } else if (idx >= 0) {
    cart.lines[idx] = line;
  } else {
    cart.lines.push(line);
  }
  cart.updatedAt = new Date().toISOString();
  return cart;
}

export function clearCart(sessionId: string): void {
  store().carts.set(sessionId, {
    sessionId,
    lines: [],
    updatedAt: new Date().toISOString(),
  });
}

// Orders

export function listOrdersForUser(userId: string): Order[] {
  return Array.from(store().orders.values())
    .filter((o) => o.userId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getOrder(id: string): Order | undefined {
  return store().orders.get(id);
}

export function createOrder(order: Omit<Order, "id" | "createdAt">): Order {
  const id = `o-${Date.now().toString(36)}${randomUUID().slice(0, 4)}`;
  const full: Order = {
    ...order,
    id,
    createdAt: new Date().toISOString(),
  };
  store().orders.set(id, full);
  return full;
}

// Admin

export function listAllOrders(): Order[] {
  return Array.from(store().orders.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function listAllUsers(): User[] {
  return Array.from(store().users.values());
}
