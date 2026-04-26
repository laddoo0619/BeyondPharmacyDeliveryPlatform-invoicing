"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { card, input, label, primaryButton, sectionTitle } from "@/lib/portalStyles";

export default function ZoneForm({ storeSlug }: { storeSlug: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const res = await fetch(`/api/${storeSlug}/zones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        price: parseFloat(formData.get("price") as string),
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(err.error || "Failed to create zone");
    } else {
      (e.target as HTMLFormElement).reset();
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div className={`${card} p-6`}>
      <h2 className={`${sectionTitle} mb-4`}>Add New Zone</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="bg-rose-50 text-rose-700 px-3 py-2 rounded-xl text-sm">{error}</div>}
        <div>
          <label className={label}>Zone Name</label>
          <input name="name" required placeholder="e.g., Surrey" className={input} />
        </div>
        <div>
          <label className={label}>Delivery Price ($)</label>
          <input name="price" type="number" step="0.01" min="0" required placeholder="4.25" className={input} />
        </div>
        <button type="submit" disabled={loading} className={primaryButton}>
          {loading ? "Adding..." : "Add Zone"}
        </button>
      </form>
    </div>
  );
}
