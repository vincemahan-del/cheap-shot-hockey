import { describe, it, expect } from "vitest";
import { PDFDocument } from "pdf-lib";
import { buildReceiptLines, buildReceiptPdf } from "./receipt-pdf";
import type { Order } from "./types";

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: "CSH-TEST-1",
    userId: null,
    guestEmail: "guest@cheapshot.test",
    lines: [
      { productId: "p1", name: "Apex Velocity Pro Stick", unitPriceCents: 24999, quantity: 1 },
      { productId: "p2", name: "Glacier Puck 6-Pack", unitPriceCents: 1500, quantity: 2 },
    ],
    subtotalCents: 27999,
    taxCents: 2240,
    shippingCents: 0,
    totalCents: 30239,
    region: "us",
    status: "paid",
    shippingAddress: {
      name: "Wayne Gretzky",
      street: "99 Centre Ice Ln",
      city: "Brantford",
      state: "ON",
      postalCode: "N3T",
      country: "CA",
    },
    createdAt: "2026-06-23T12:00:00.000Z",
    ...overrides,
  };
}

describe("buildReceiptLines", () => {
  it("renders the brand header, order id and status", () => {
    const lines = buildReceiptLines(makeOrder());
    expect(lines[0]).toBe("Cheap Shot Hockey - Receipt");
    expect(lines).toContain("Order CSH-TEST-1");
    expect(lines).toContain("Status: paid");
  });

  it("renders one line per item with quantity, name and line total", () => {
    const lines = buildReceiptLines(makeOrder());
    expect(lines).toContain("  1 x Apex Velocity Pro Stick   $249.99");
    // 2 x $15.00 = $30.00 line total
    expect(lines).toContain("  2 x Glacier Puck 6-Pack   $30.00");
  });

  it("renders the money summary with formatted totals", () => {
    const lines = buildReceiptLines(makeOrder());
    expect(lines).toContain("Subtotal: $279.99");
    expect(lines).toContain("Tax: $22.40");
    expect(lines).toContain("Total: $302.39");
  });

  it("shows FREE shipping when shipping is zero", () => {
    const lines = buildReceiptLines(makeOrder({ shippingCents: 0 }));
    expect(lines).toContain("Shipping: FREE");
  });

  it("shows the formatted shipping cost when shipping is charged", () => {
    const lines = buildReceiptLines(makeOrder({ shippingCents: 799 }));
    expect(lines).toContain("Shipping: $7.99");
  });

  it("includes the guest email line for guest orders", () => {
    const lines = buildReceiptLines(makeOrder({ guestEmail: "fan@example.com" }));
    expect(lines).toContain("Email: fan@example.com");
  });

  it("omits the email line when there is no guest email", () => {
    const lines = buildReceiptLines(makeOrder({ guestEmail: null }));
    expect(lines.some((l) => l.startsWith("Email:"))).toBe(false);
  });

  it("includes the full shipping address block", () => {
    const lines = buildReceiptLines(makeOrder());
    expect(lines).toContain("Ship to");
    expect(lines).toContain("  Wayne Gretzky");
    expect(lines).toContain("  99 Centre Ice Ln");
    expect(lines).toContain("  Brantford, ON N3T");
    expect(lines).toContain("  CA");
  });
});

describe("buildReceiptPdf", () => {
  it("returns a valid PDF byte stream", async () => {
    const bytes = await buildReceiptPdf(makeOrder());
    expect(bytes).toBeInstanceOf(Uint8Array);
    const head = new TextDecoder("latin1").decode(bytes.subarray(0, 8));
    expect(head.startsWith("%PDF-")).toBe(true);
    const tail = new TextDecoder("latin1").decode(bytes.subarray(-8));
    expect(tail).toContain("%%EOF");
  });

  it("loads back as a one-page PDF titled for the order", async () => {
    const bytes = await buildReceiptPdf(makeOrder());
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe("Receipt CSH-TEST-1");
  });

  it("embeds the order content into the document (more items -> larger file)", async () => {
    const small = await buildReceiptPdf(
      makeOrder({ lines: [{ productId: "p1", name: "One", unitPriceCents: 1000, quantity: 1 }] }),
    );
    const large = await buildReceiptPdf(
      makeOrder({
        lines: Array.from({ length: 40 }, (_, i) => ({
          productId: `p${i}`,
          name: `Product ${i}`,
          unitPriceCents: 1000,
          quantity: 1,
        })),
      }),
    );
    expect(large.length).toBeGreaterThan(small.length);
  });

  it("paginates when the line list overflows a single page", async () => {
    const manyLines = Array.from({ length: 80 }, (_, i) => ({
      productId: `p${i}`,
      name: `Product ${i}`,
      unitPriceCents: 1000,
      quantity: 1,
    }));
    const bytes = await buildReceiptPdf(makeOrder({ lines: manyLines }));
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });
});
