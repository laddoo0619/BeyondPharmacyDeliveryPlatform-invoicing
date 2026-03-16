"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UserForm({ storeSlug }: { storeSlug: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const res = await fetch(`/api/${storeSlug}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        email: formData.get("email"),
        password: formData.get("password"),
        role: formData.get("role"),
        phone: formData.get("phone"),
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(err.error || "Failed to create user");
    } else {
      setSuccess("User created successfully");
      (e.target as HTMLFormElement).reset();
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <h2 className="text-lg font-semibold mb-4">Create New User</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
        {success && <div className="bg-green-50 text-green-700 px-3 py-2 rounded text-sm">{success}</div>}
        <input name="name" required placeholder="Full Name" className="w-full px-3 py-2 border rounded-lg text-sm" />
        <input name="email" type="email" required placeholder="Email" className="w-full px-3 py-2 border rounded-lg text-sm" />
        <input name="password" type="password" required placeholder="Password" minLength={6} className="w-full px-3 py-2 border rounded-lg text-sm" />
        <input name="phone" placeholder="Phone (optional)" className="w-full px-3 py-2 border rounded-lg text-sm" />
        <select name="role" required className="w-full px-3 py-2 border rounded-lg text-sm">
          <option value="DRIVER">Driver</option>
          <option value="PHARMACY_ADMIN">Pharmacy Admin</option>
        </select>
        <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {loading ? "Creating..." : "Create User"}
        </button>
      </form>
    </div>
  );
}
