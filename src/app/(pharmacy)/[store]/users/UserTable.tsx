"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  card,
  input,
  sectionTitle,
  statusBadgeClasses,
  tableHeader,
  tableRow,
} from "@/lib/portalStyles";

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
    <div className={`${card} overflow-hidden`}>
      <div className="px-6 py-4 border-b">
        <h2 className={sectionTitle}>All Users</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className={tableHeader}>
            <tr>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3">Role</th>
              <th className="px-6 py-3">Store</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className={tableRow}>
              <td className="px-6 py-4 text-sm font-semibold text-[#1e3a8a]">{user.name}</td>
              <td className="px-6 py-4 text-sm text-slate-500">{user.email}</td>
              <td className="px-6 py-4">
                <span className={statusBadgeClasses(user.role === "PHARMACY_ADMIN" ? "ADMIN" : "DRIVER")}>
                  {user.role === "PHARMACY_ADMIN" ? "Admin" : "Driver"}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-slate-500">
                {user.store?.name || "All Stores"}
              </td>
              <td className="px-6 py-4">
                <span className={statusBadgeClasses(user.isActive ? "ACTIVE" : "INACTIVE")}>
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
                        className="text-sm text-[#6f8f72] hover:text-[#5f7d62] font-semibold disabled:opacity-50"
                      >
                        Change Password
                      </button>
                      {user.role === "DRIVER" && (
                        <button
                          onClick={() => handleDelete(user.id, user.name)}
                          disabled={deletingId === user.id || changingPasswordId === user.id}
                          className="text-sm text-rose-600 hover:text-rose-800 font-semibold disabled:opacity-50"
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
                          className={`${input} py-1 w-36`}
                        />
                        <button
                          onClick={() => handleChangePassword(user.id)}
                          disabled={savingPassword}
                          className="text-sm bg-[#6f8f72] text-white px-3 py-1 rounded-xl hover:bg-[#5f7d62] disabled:opacity-50"
                        >
                          {savingPassword ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={() => { setChangingPasswordId(null); setNewPassword(""); }}
                          disabled={savingPassword}
                          className="text-sm text-slate-500 hover:text-[#1e3a8a] font-semibold disabled:opacity-50"
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
    </div>
  );
}
