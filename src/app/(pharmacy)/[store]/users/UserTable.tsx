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
  const [changingPasswordId, setChangingPasswordId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const handleChangePassword = async (userId: string) => {
    if (newPassword.length < 6) {
      alert("Password must be at least 6 characters");
      return;
    }

    setSavingPassword(true);
    try {
      const res = await fetch(`/api/${storeSlug}/users`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, password: newPassword }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to change password");
      } else {
        alert("Password updated successfully");
        setChangingPasswordId(null);
        setNewPassword("");
      }
    } catch {
      alert("Network error. Please try again.");
    }
    setSavingPassword(false);
  };

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
                {user.isActive && (
                  <div className="space-y-2">
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setChangingPasswordId(changingPasswordId === user.id ? null : user.id);
                          setNewPassword("");
                        }}
                        disabled={savingPassword}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
                      >
                        Change Password
                      </button>
                      {user.role === "DRIVER" && (
                        <button
                          onClick={() => handleDelete(user.id, user.name)}
                          disabled={deletingId === user.id || changingPasswordId === user.id}
                          className="text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                        >
                          {deletingId === user.id ? "Deleting..." : "Delete"}
                        </button>
                      )}
                    </div>
                    {changingPasswordId === user.id && (
                      <div className="flex gap-2 items-center">
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="New password"
                          minLength={6}
                          className="px-2 py-1 border rounded text-sm w-36"
                        />
                        <button
                          onClick={() => handleChangePassword(user.id)}
                          disabled={savingPassword}
                          className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          {savingPassword ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={() => { setChangingPasswordId(null); setNewPassword(""); }}
                          disabled={savingPassword}
                          className="text-sm text-gray-600 hover:text-gray-800 font-medium disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
