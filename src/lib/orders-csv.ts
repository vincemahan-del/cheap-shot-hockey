import type { Order } from "./types";
import { formatPrice } from "./format";

// Pure CSV builder for the admin orders export (see
// /api/admin/orders/export). Kept here — no I/O — so it's unit-tested and
// the route stays a thin shell, same split as receipt-pdf.ts.

const HEADER = [
  "Order ID",
  "Date",
  "Customer",
  "Region",
  "Status",
  "Items",
  "Subtotal",
  "Tax",
  "Shipping",
  "Total",
] as const;

/**
 * RFC 4180 field escaping: wrap in double quotes when the value contains a
 * comma, quote, or newline, and double any embedded quotes. Money values
 * carry thousands commas (e.g. "$1,403.98"), so they get quoted here.
 */
function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Build an RFC 4180 CSV export of orders for the admin dashboard. */
export function buildOrdersCsv(orders: Order[]): string {
  const rows = orders.map((o) => {
    const customer = o.userId ?? o.guestEmail ?? "guest";
    const items = o.lines.reduce((n, l) => n + l.quantity, 0);
    return [
      o.id,
      o.createdAt,
      customer,
      o.region.toUpperCase(),
      o.status,
      String(items),
      formatPrice(o.subtotalCents, o.region),
      formatPrice(o.taxCents, o.region),
      formatPrice(o.shippingCents, o.region),
      formatPrice(o.totalCents, o.region),
    ]
      .map(csvField)
      .join(",");
  });
  // Trailing CRLF so the file ends on a newline (RFC 4180 friendly).
  return [HEADER.join(","), ...rows].join("\r\n") + "\r\n";
}
