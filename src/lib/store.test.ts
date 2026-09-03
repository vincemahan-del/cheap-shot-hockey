import { describe, it, expect, beforeEach } from "vitest";
import {
  listProducts,
  getProduct,
  getProductBySlug,
  currentPrice,
  getUserByEmail,
  getUser,
  createUser,
  updateUserPassword,
  createOrder,
  getOrder,
  listOrdersForUser,
  listOrdersByGuestEmail,
  listAllOrders,
  listAllUsers,
  addToCart,
  setCartLine,
  getCart,
  clearCart,
} from "./store";

// Reset the global store between tests so they don't leak state.
beforeEach(() => {
  (globalThis as unknown as { __CSH_STORE__: undefined }).__CSH_STORE__ =
    undefined;
});

describe("product queries", () => {
  it("lists all seeded products", () => {
    expect(listProducts().length).toBeGreaterThan(20);
  });

  it("filters by category", () => {
    const sticks = listProducts({ category: "sticks" });
    expect(sticks.length).toBeGreaterThan(0);
    expect(sticks.every((p) => p.category === "sticks")).toBe(true);
  });

  it("filters by brand (case-insensitive)", () => {
    expect(listProducts({ brand: "apex" }).length).toBeGreaterThan(0);
    expect(listProducts({ brand: "APEX" }).length).toBeGreaterThan(0);
  });

  it("filters by onSale", () => {
    const sale = listProducts({ onSale: true });
    expect(sale.every((p) => p.salePriceCents != null)).toBe(true);
  });

  it("full-text searches name/description/brand", () => {
    expect(listProducts({ search: "velocity" }).length).toBeGreaterThan(0);
    expect(listProducts({ search: "nope-nothing-matches" })).toHaveLength(0);
  });

  it("respects price range filters", () => {
    const cheap = listProducts({ maxPriceCents: 2000 });
    expect(cheap.every((p) => currentPrice(p) <= 2000)).toBe(true);
    const premium = listProducts({ minPriceCents: 20000 });
    expect(premium.length).toBeGreaterThan(0);
    expect(premium.every((p) => currentPrice(p) >= 20000)).toBe(true);
  });

  it("getProduct / getProductBySlug work and return undefined for misses", () => {
    const one = listProducts()[0];
    expect(getProduct(one.id)?.id).toBe(one.id);
    expect(getProductBySlug(one.slug)?.slug).toBe(one.slug);
    expect(getProduct("nope")).toBeUndefined();
    expect(getProductBySlug("nope")).toBeUndefined();
  });

  it("currentPrice prefers salePriceCents when present", () => {
    const onSale = listProducts({ onSale: true })[0];
    expect(currentPrice(onSale)).toBe(onSale.salePriceCents);
  });

  it("currentPrice falls back to regular price when not on sale", () => {
    const notOnSale = listProducts().find((p) => p.salePriceCents == null);
    expect(notOnSale).toBeDefined();
    expect(currentPrice(notOnSale!)).toBe(notOnSale!.priceCents);
  });
});

describe("users", () => {
  it("finds seeded user by email (case-insensitive)", async () => {
    expect((await getUserByEmail("demo@cheapshot.test"))?.id).toBe("u-001");
    expect((await getUserByEmail("DEMO@cheapshot.test"))?.id).toBe("u-001");
  });

  it("returns undefined for unknown email", async () => {
    expect(await getUserByEmail("nobody@example.com")).toBeUndefined();
  });

  it("getUser by id works", async () => {
    expect((await getUser("u-001"))?.email).toBe("demo@cheapshot.test");
  });

  it("createUser persists a new record (defaults role to customer)", async () => {
    const u = await createUser({
      email: "new@x.test",
      passwordHash: "abc",
      name: "Newbie",
    });
    expect(u.id).toMatch(/^u-/);
    expect(u.role).toBe("customer");
    expect((await getUser(u.id))?.email).toBe("new@x.test");
  });

  it("createUser honors an explicit role", async () => {
    const u = await createUser({
      email: "boss@x.test",
      passwordHash: "abc",
      name: "Boss",
      role: "admin",
    });
    expect(u.role).toBe("admin");
  });

  it("listAllUsers includes seed + newly created", async () => {
    const before = (await listAllUsers()).length;
    await createUser({ email: "x@x.test", passwordHash: "a", name: "x" });
    expect((await listAllUsers()).length).toBe(before + 1);
  });

  it("updateUserPassword swaps the hash for an existing user", async () => {
    const u = await createUser({
      email: "svc-roletest@x.test",
      passwordHash: "old-hash",
      name: "Shared System ID",
    });
    const updated = await updateUserPassword(u.id, "new-hash");
    expect(updated?.passwordHash).toBe("new-hash");
    expect((await getUser(u.id))?.passwordHash).toBe("new-hash");
  });

  it("updateUserPassword returns undefined for an unknown id", async () => {
    expect(await updateUserPassword("u-nope", "hash")).toBeUndefined();
  });
});

describe("cart (in-memory helpers)", () => {
  it("addToCart creates + increments lines", () => {
    addToCart("s-1", { productId: "p-stk-001", quantity: 2 });
    addToCart("s-1", { productId: "p-stk-001", quantity: 3 });
    expect(getCart("s-1").lines[0].quantity).toBe(5);
  });

  it("setCartLine replaces absolute quantity", () => {
    setCartLine("s-2", { productId: "p-stk-001", quantity: 5 });
    setCartLine("s-2", { productId: "p-stk-001", quantity: 1 });
    expect(getCart("s-2").lines[0].quantity).toBe(1);
  });

  it("setCartLine with quantity 0 removes the line", () => {
    setCartLine("s-3", { productId: "p-stk-001", quantity: 3 });
    setCartLine("s-3", { productId: "p-stk-001", quantity: 0 });
    expect(getCart("s-3").lines).toHaveLength(0);
  });

  it("clearCart empties the cart", () => {
    addToCart("s-4", { productId: "p-stk-001", quantity: 2 });
    clearCart("s-4");
    expect(getCart("s-4").lines).toHaveLength(0);
  });
});

describe("orders", () => {
  it("createOrder returns an order with a stable id + createdAt", async () => {
    const o = await createOrder({
      userId: "u-001",
      guestEmail: null,
      lines: [{ productId: "p-stk-001", name: "X", unitPriceCents: 100, quantity: 1 }],
      subtotalCents: 100,
      taxCents: 8,
      shippingCents: 999,
      totalCents: 1107,
      region: "us",
      status: "paid",
      shippingAddress: {
        name: "T",
        street: "1 St",
        city: "Mpls",
        state: "MN",
        postalCode: "55401",
        country: "US",
      },
    });
    expect(o.id).toMatch(/^o-/);
    expect(o.createdAt).toBeTypeOf("string");
    expect((await getOrder(o.id))?.id).toBe(o.id);
  });

  it("listOrdersForUser returns seed order for u-001", async () => {
    expect((await listOrdersForUser("u-001")).length).toBeGreaterThan(0);
  });

  it("listOrdersByGuestEmail filters on guestEmail", async () => {
    await createOrder({
      userId: null,
      guestEmail: "guest@x.test",
      lines: [],
      subtotalCents: 0,
      taxCents: 0,
      shippingCents: 0,
      totalCents: 0,
      region: "us",
      status: "paid",
      shippingAddress: {
        name: "G",
        street: "1 St",
        city: "Mpls",
        state: "MN",
        postalCode: "55401",
        country: "US",
      },
    });
    expect((await listOrdersByGuestEmail("guest@x.test")).length).toBe(1);
    expect((await listOrdersByGuestEmail("nobody@x.test")).length).toBe(0);
  });

  it("listAllOrders returns everything", async () => {
    expect((await listAllOrders()).length).toBeGreaterThan(0);
  });
});
