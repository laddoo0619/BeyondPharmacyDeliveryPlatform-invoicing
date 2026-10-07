"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { card, cn, ctaShadow, input, label, primaryButton, sectionTitle } from "@/lib/portalStyles";
import { BANNER_CLASSES } from "@/lib/statusTheme";

export default function ZoneForm({ storeSlug }: { storeSlug: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fieldId = useId();

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
        {error && <div role="alert" className={cn("px-3 py-2 rounded-row text-sm", BANNER_CLASSES.error)}>{error}</div>}
        <div>
          <label htmlFor={`${fieldId}-name`} className={label}>Zone Name</label>
          <input id={`${fieldId}-name`} name="name" required placeholder="e.g., Surrey" className={input} />
        </div>
        <div>
          <label htmlFor={`${fieldId}-price`} className={label}>Delivery Price ($)</label>
          <input id={`${fieldId}-price`} name="price" type="number" step="0.01" min="0" required placeholder="4.25" className={input} />
        </div>
        <button type="submit" disabled={loading} className={cn(primaryButton, ctaShadow)}>
          {loading ? "Adding..." : "Add Zone"}
        </button>
      </form>
    </div>
  );
}
