import { describe, it, expect } from "vitest";
import { allowedRequest, orderActions } from "./order-actions";
import type { OrderStatus } from "./types";

describe("orderActions", () => {
  const cases: [OrderStatus, string[], string[]][] = [
    ["pending", ["cancel", "receipt"], ["cancel", "receipt"]],
    ["paid", ["cancel", "receipt"], ["cancel", "receipt", "refund"]],
    ["shipped", ["track", "receipt"], ["track", "receipt", "refund"]],
    ["delivered", ["return", "receipt"], ["return", "receipt", "refund"]],
    ["cancelled", [], []],
  ];

  it.each(cases)("%s: customer and admin actions", (status, customer, admin) => {
    expect(orderActions(status, "customer")).toEqual(customer);
    expect(orderActions(status, "admin")).toEqual(admin);
  });

  it("treats a guest like a customer", () => {
    expect(orderActions("paid", null)).toEqual(["cancel", "receipt"]);
  });
});

describe("allowedRequest", () => {
  it("accepts an action the status allows", () => {
    expect(allowedRequest("track", "shipped", "customer")).toBe("track");
  });

  it("ignores an action the status does not allow", () => {
    expect(allowedRequest("cancel", "shipped", "customer")).toBeNull();
    expect(allowedRequest("return", "cancelled", "admin")).toBeNull();
  });

  it("only lets an admin request a refund", () => {
    expect(allowedRequest("refund", "delivered", "customer")).toBeNull();
    expect(allowedRequest("refund", "delivered", null)).toBeNull();
    expect(allowedRequest("refund", "delivered", "admin")).toBe("refund");
  });

  it("ignores missing, unknown and receipt values", () => {
    expect(allowedRequest(undefined, "paid", "customer")).toBeNull();
    expect(allowedRequest("teleport", "paid", "admin")).toBeNull();
    expect(allowedRequest("receipt", "paid", "customer")).toBeNull();
  });
});
