import { NextResponse } from "next/server";
import { listAllOrders } from "@/lib/store";
import { getCurrentUser } from "@/lib/session";
import { buildOrdersCsv } from "@/lib/orders-csv";
import { unauthorized, forbidden } from "@/lib/api";

export const runtime = "nodejs";

// GET /api/admin/orders/export — streams all orders as a downloadable CSV.
// Admin-only, mirroring the /admin dashboard's access check.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized("authentication required");
  if (user.role !== "admin") return forbidden("admin access required");

  const csv = buildOrdersCsv(await listAllOrders());
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="orders.csv"',
      "Cache-Control": "no-store",
    },
  });
}
