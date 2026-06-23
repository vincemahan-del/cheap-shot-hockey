import { NextResponse, type NextRequest } from "next/server";
import { getOrder } from "@/lib/store";
import { getCurrentUser } from "@/lib/session";
import { hasGuestOrder } from "@/lib/guest-orders";
import { findRecentOrder } from "@/lib/order-cookie";
import { forbidden, notFound } from "@/lib/api";
import { buildReceiptPdf } from "@/lib/receipt-pdf";

// pdf-lib generates the receipt in-process; pin to the Node.js runtime
// so this route never gets scheduled on the Edge runtime.
export const runtime = "nodejs";

// GET /api/orders/{id}/receipt — streams the order as a downloadable
// PDF receipt. Authorization mirrors GET /api/orders/{id}: the
// logged-in owner, an admin, or an anonymous caller on the device that
// placed the guest order (csh_guest_orders / recent-orders cookie).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const order = (await getOrder(id)) ?? (await findRecentOrder(id));
  if (!order) return notFound("order not found");

  const user = await getCurrentUser();
  const authorized =
    (user && (order.userId === user.id || user.role === "admin")) ||
    (await hasGuestOrder(id)) ||
    Boolean(await findRecentOrder(id));
  if (!authorized) return forbidden("you don't have access to this order");

  const pdf = await buildReceiptPdf(order);
  // Copy into a fresh ArrayBuffer-backed view: pdf-lib types its output
  // as Uint8Array<ArrayBufferLike>, which the DOM BodyInit/BlobPart
  // types reject (the backing buffer could in theory be shared).
  const body = new Uint8Array(pdf);
  return new NextResponse(new Blob([body], { type: "application/pdf" }), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="receipt-${order.id}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
