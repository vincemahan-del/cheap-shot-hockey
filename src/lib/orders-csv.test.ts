import { describe, it, expect } from "vitest";
import { buildOrdersCsv } from "./orders-csv";
import type { Order } from "./types";

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "o-1001",
    userId: "u-001",
    guestEmail: null,
    lines: [
      { productId: "p-stk-001", name: "Apex Velocity Pro Stick", unitPriceCents: 19999, quantity: 1 },
      { productId: "p-acc-002", name: "Stick Tape", unitPriceCents: 599, quantity: 2 },
    ],
    subtotalCents: 21197,
    taxCents: 1696,
    shippingCents: 0,
    totalCents: 22893,
    status: "paid",
    shippingAddress: {
      name: "Demo Customer",
      street: "12 Rink Road",
      city: "Minneapolis",
      state: "MN",
      postalCode: "55401",
      country: "US",
    },
    createdAt: "2026-03-12T09:12:00.000Z",
    ...overrides,
  };
}

describe("buildOrdersCsv", () => {
  it("emits the header row first", () => {
    const csv = buildOrdersCsv([]);
    expect(csv.split("\r\n")[0]).toBe(
      "Order ID,Date,Customer,Status,Items,Subtotal,Tax,Shipping,Total",
    );
  });

  it("empty order list yields just the header (plus trailing newline)", () => {
    expect(buildOrdersCsv([])).toBe(
      "Order ID,Date,Customer,Status,Items,Subtotal,Tax,Shipping,Total\r\n",
    );
  });

  it("renders an order row with summed items and formatted money", () => {
    const row = buildOrdersCsv([makeOrder()]).split("\r\n")[1];
    // items = 1 + 2 = 3; money via formatPrice
    expect(row).toBe("o-1001,2026-03-12T09:12:00.000Z,u-001,paid,3,$211.97,$16.96,$0.00,$228.93");
  });

  it("uses guestEmail as the customer for guest orders", () => {
    const row = buildOrdersCsv([
      makeOrder({ userId: null, guestEmail: "guest@x.test" }),
    ]).split("\r\n")[1];
    expect(row).toContain(",guest@x.test,");
  });

  it("falls back to 'guest' when there is no user or guest email", () => {
    const row = buildOrdersCsv([makeOrder({ userId: null, guestEmail: null })]).split("\r\n")[1];
    expect(row).toContain(",guest,");
  });

  it("quotes money values that contain a thousands comma (RFC 4180)", () => {
    // $1,403.98 contains a comma → must be wrapped in quotes
    const row = buildOrdersCsv([makeOrder({ totalCents: 140398 })]).split("\r\n")[1];
    expect(row.endsWith(',"$1,403.98"')).toBe(true);
  });

  it("separates rows with CRLF and ends on a newline", () => {
    const csv = buildOrdersCsv([makeOrder(), makeOrder({ id: "o-1002" })]);
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv.split("\r\n").filter(Boolean)).toHaveLength(3); // header + 2 rows
  });
});
