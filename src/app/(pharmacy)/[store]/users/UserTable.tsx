"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  store: { name: string } | null;
}

export default function UserTable({
  users,
  storeSlug,
}: {
  users: UserRow[];
  storeSlug: string;
}) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete driver "${userName}"? This will deactivate their account and unassign their pending deliveries.`)) {
      return;
    }

    setDeletingId(userId);
    try {
      const res = await fetch(`/api/${storeSlug}/users`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to delete driver");
      } else {
        router.refresh();
      }
    } catch {
      alert("Network error. Please try again.");
    }
    setDeletingId(null);
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="px-6 py-4 border-b">
        <h2 className="text-lg font-semibold">All Users</h2>
      </div>
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Store</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 text-sm font-medium text-gray-900">{user.name}</td>
              <td className="px-6 py-4 text-sm text-gray-500">{user.email}</td>
              <td className="px-6 py-4">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${user.role === "PHARMACY_ADMIN" ? "bg-blue-100 text-blue-800" : "bg-green-100 text-green-800"}`}>
                  {user.role === "PHARMACY_ADMIN" ? "Admin" : "Driver"}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {user.store?.name || "All Stores"}
              </td>
              <td className="px-6 py-4">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${user.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>
                  {user.isActive ? "Active" : "Inactive"}
                </span>
              </td>
              <td className="px-6 py-4">
                {user.role === "DRIVER" && user.isActive && (
                  <button
                    onClick={() => handleDelete(user.id, user.name)}
                    disabled={deletingId === user.id}
                    className="text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                  >
                    {deletingId === user.id ? "Deleting..." : "Delete"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
