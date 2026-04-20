import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { listAllOrders, listAllUsers, listProducts } from "@/lib/store";
import { formatPrice } from "@/lib/format";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "admin") {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-3xl font-bold">403</h1>
        <p className="mt-2 text-[color:var(--muted)]" data-testid="admin-forbidden">
          This page requires admin access.
        </p>
      </div>
    );
  }

  const orders = listAllOrders();
  const users = listAllUsers();
  const products = listProducts();
  const revenue = orders.reduce((s, o) => s + o.totalCents, 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-bold" data-testid="admin-heading">
        Admin dashboard
      </h1>
      <p className="mb-6 text-sm text-[color:var(--muted)]">
        Not linked from public nav. Use this to show mabl coverage-gap demos.
      </p>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Orders" value={String(orders.length)} testId="stat-orders" />
        <Stat label="Revenue" value={formatPrice(revenue)} testId="stat-revenue" />
        <Stat label="Users" value={String(users.length)} testId="stat-users" />
        <Stat label="Products" value={String(products.length)} testId="stat-products" />
      </div>
      <section>
        <h2 className="mb-2 text-xl font-bold">Recent orders</h2>
        <div className="overflow-hidden rounded-lg border border-[color:var(--border)]">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--surface-2)] text-left text-xs uppercase text-[color:var(--muted)]">
              <tr>
                <th className="px-3 py-2">Order</th>
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody data-testid="admin-orders-table">
              {orders.map((o) => (
                <tr
                  key={o.id}
                  data-testid={`admin-order-${o.id}`}
                  className="border-t border-[color:var(--border)]"
                >
                  <td className="px-3 py-2 font-mono">{o.id}</td>
                  <td className="px-3 py-2">{o.userId}</td>
                  <td className="px-3 py-2 capitalize">{o.status}</td>
                  <td className="px-3 py-2 text-right">{formatPrice(o.totalCents)}</td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-[color:var(--muted)]">
                    No orders yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId: string;
}) {
  return (
    <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-4">
      <div className="text-xs uppercase text-[color:var(--muted)]">{label}</div>
      <div className="mt-1 text-2xl font-bold" data-testid={testId}>
        {value}
      </div>
    </div>
  );
}
