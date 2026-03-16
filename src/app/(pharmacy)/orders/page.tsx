import { prisma } from "@/lib/db";
import Link from "next/link";
import OrderActions from "./OrderActions";

const statusColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  ASSIGNED: "bg-blue-100 text-blue-800",
  IN_TRANSIT: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = params.status;
  const page = parseInt(params.page || "1");
  const perPage = 20;

  const where = status ? { status } : {};

  const [orders, total, drivers] = await Promise.all([
    prisma.order.findMany({
      where,
      include: { assignedDriver: true, deliveryZone: true },
      orderBy: { scheduledDate: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.order.count({ where }),
    prisma.user.findMany({ where: { role: "DRIVER", isActive: true } }),
  ]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
        <Link
          href="/orders/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          + New Order
        </Link>
      </div>

      {/* Status Filter */}
      <div className="flex space-x-2 mb-4">
        <Link
          href="/orders"
          className={`px-3 py-1.5 rounded-full text-sm font-medium ${
            !status ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          All ({total})
        </Link>
        {["PENDING", "ASSIGNED", "IN_TRANSIT", "DELIVERED", "CANCELLED"].map(
          (s) => (
            <Link
              key={s}
              href={`/orders?status=${s}`}
              className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                status === s
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s.replace("_", " ")}
            </Link>
          )
        )}
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        {orders.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            No orders found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Patient
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Zone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Driver
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      {order.patientName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {order.deliveryAddress}, {order.deliveryCity}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(order.scheduledDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {order.deliveryZoneName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      ${order.priceAtCreation.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {order.assignedDriver?.name || "Unassigned"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          statusColors[order.status] || "bg-gray-100"
                        }`}
                      >
                        {order.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <OrderActions
                        orderId={order.id}
                        currentStatus={order.status}
                        currentDriverId={order.assignedDriverId}
                        drivers={drivers.map((d) => ({
                          id: d.id,
                          name: d.name,
                        }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t">
            <p className="text-sm text-gray-500">
              Page {page} of {totalPages} ({total} orders)
            </p>
            <div className="flex space-x-2">
              {page > 1 && (
                <Link
                  href={`/orders?page=${page - 1}${status ? `&status=${status}` : ""}`}
                  className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                >
                  Previous
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`/orders?page=${page + 1}${status ? `&status=${status}` : ""}`}
                  className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
