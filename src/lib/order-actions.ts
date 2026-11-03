import type { OrderStatus, User } from "./types";

export type OrderActionKey = "cancel" | "track" | "return" | "receipt" | "refund";
export type RequestActionKey = Exclude<OrderActionKey, "receipt">;

export const ORDER_ACTION_LABELS: Record<OrderActionKey, string> = {
  cancel: "Cancel order",
  track: "Track shipment",
  return: "Start a return",
  receipt: "Download receipt (PDF)",
  refund: "Issue refund",
};

export const ORDER_REQUEST_CONFIRMATIONS: Record<RequestActionKey, string> = {
  cancel: "We received your request to cancel this order.",
  track: "We received your request for tracking details.",
  return: "We received your request to start a return.",
  refund: "Refund request recorded for this order.",
};

const BY_STATUS: Record<OrderStatus, OrderActionKey[]> = {
  pending: ["cancel", "receipt"],
  paid: ["cancel", "receipt"],
  shipped: ["track", "receipt"],
  delivered: ["return", "receipt"],
  cancelled: [],
};

const ADMIN_EXTRA: Record<OrderStatus, OrderActionKey[]> = {
  pending: [],
  paid: ["refund"],
  shipped: ["refund"],
  delivered: ["refund"],
  cancelled: [],
};

/** Actions offered on an order, by status and viewer role (null = guest). */
export function orderActions(
  status: OrderStatus,
  role: User["role"] | null,
): OrderActionKey[] {
  const base = BY_STATUS[status] ?? [];
  return role === "admin" ? [...base, ...(ADMIN_EXTRA[status] ?? [])] : [...base];
}

/** The requested action if this status and role allow it; otherwise null. */
export function allowedRequest(
  requested: string | null | undefined,
  status: OrderStatus,
  role: User["role"] | null,
): RequestActionKey | null {
  if (!requested || requested === "receipt") return null;
  const actions = orderActions(status, role);
  return actions.includes(requested as OrderActionKey) ? (requested as RequestActionKey) : null;
}
