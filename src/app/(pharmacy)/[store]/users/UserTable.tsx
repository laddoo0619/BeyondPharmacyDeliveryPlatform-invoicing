"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ui/DialogsProvider";
import { useToast } from "@/components/ui/ToastProvider";
import {
  button,
  card,
  cn,
  dangerLinkButton,
  input,
  linkButton,
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
  const confirm = useConfirm();
  const toast = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [changingPasswordId, setChangingPasswordId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const handleChangePassword = async (userId: string) => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
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
        toast.error(err.error || "Failed to change password");
      } else {
        toast.success("Password updated successfully");
        setChangingPasswordId(null);
        setNewPassword("");
      }
    } catch {
      toast.error("Network error. Please try again.");
    }
    setSavingPassword(false);
  };

  const handleDelete = async (userId: string, userName: string) => {
    if (
      !(await confirm({
        message: `Are you sure you want to delete driver "${userName}"? This will deactivate their account and unassign their pending deliveries.`,
        tone: "danger",
      }))
    ) {
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
        toast.error(err.error || "Failed to delete driver");
      } else {
        router.refresh();
      }
    } catch {
      toast.error("Network error. Please try again.");
    }
    setDeletingId(null);
  };

  return (
    <div className={`${card} overflow-hidden`}>
      <div className="px-6 py-4 border-b border-hairline">
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
          <tbody className="divide-y divide-hairline">
            {users.map((user) => (
              <tr key={user.id} className={tableRow}>
              <td className="px-6 py-4 text-sm font-semibold text-navy">{user.name}</td>
              <td className="px-6 py-4 text-sm text-ink">{user.email}</td>
              <td className="px-6 py-4">
                <span className={statusBadgeClasses(user.role === "PHARMACY_ADMIN" ? "ADMIN" : "DRIVER")}>
                  {user.role === "PHARMACY_ADMIN" ? "Admin" : "Driver"}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-ink">
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
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      <button
                        onClick={() => {
                          setChangingPasswordId(changingPasswordId === user.id ? null : user.id);
                          setNewPassword("");
                        }}
                        disabled={savingPassword}
                        className={cn(linkButton, "text-sm")}
                      >
                        Change Password
                      </button>
                      {user.role === "DRIVER" && (
                        <button
                          onClick={() => handleDelete(user.id, user.name)}
                          disabled={deletingId === user.id || changingPasswordId === user.id}
                          className={cn(dangerLinkButton, "text-sm")}
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
                          aria-label={`New password for ${user.name}`}
                          minLength={6}
                          className={`${input} py-1 w-36`}
                        />
                        <button
                          onClick={() => handleChangePassword(user.id)}
                          disabled={savingPassword}
                          className={button("primary", "sm")}
                        >
                          {savingPassword ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={() => { setChangingPasswordId(null); setNewPassword(""); }}
                          disabled={savingPassword}
                          className="text-sm text-muted transition-colors duration-[220ms] hover:text-navy font-semibold disabled:opacity-50"
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
