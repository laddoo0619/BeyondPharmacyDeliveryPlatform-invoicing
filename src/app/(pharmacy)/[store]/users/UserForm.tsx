"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { card, cn, input, primaryButton, sectionTitle } from "@/lib/portalStyles";
import { BANNER_CLASSES } from "@/lib/statusTheme";

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
    <div className={`${card} p-6`}>
      <h2 className={`${sectionTitle} mb-4`}>Create New User</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <div role="alert" className={cn("px-3 py-2 rounded-row text-sm", BANNER_CLASSES.error)}>{error}</div>}
        {success && <div role="status" className={cn("px-3 py-2 rounded-row text-sm", BANNER_CLASSES.success)}>{success}</div>}
        <input name="name" required placeholder="Full Name" aria-label="Full Name" className={input} />
        <input name="email" type="email" required placeholder="Email" aria-label="Email" className={input} />
        <input name="password" type="password" required placeholder="Password" aria-label="Password" minLength={6} className={input} />
        <input name="phone" placeholder="Phone (optional)" aria-label="Phone (optional)" className={input} />
        <select name="role" required aria-label="Role" className={input}>
          <option value="DRIVER">Driver</option>
          <option value="PHARMACY_ADMIN">Pharmacy Admin</option>
        </select>
        <button type="submit" disabled={loading} className={`${primaryButton} w-full`}>
          {loading ? "Creating..." : "Create User"}
        </button>
      </form>
    </div>
  );
}
