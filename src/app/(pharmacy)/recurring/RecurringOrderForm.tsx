"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface Zone {
  id: string;
  name: string;
  price: number;
}

export default function RecurringOrderForm({ zones }: { zones: Zone[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const res = await fetch("/api/recurring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientName: formData.get("patientName"),
        patientPhone: formData.get("patientPhone"),
        deliveryAddress: formData.get("deliveryAddress"),
        deliveryCity: formData.get("deliveryCity"),
        deliveryPostalCode: formData.get("deliveryPostalCode"),
        deliveryZoneId: formData.get("deliveryZoneId"),
        instructions: formData.get("instructions"),
        dayOfWeek: parseInt(formData.get("dayOfWeek") as string),
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(err.error || "Failed to create");
    } else {
      (e.target as HTMLFormElement).reset();
      router.refresh();
    }
    setLoading(false);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <h2 className="text-lg font-semibold mb-4">New Recurring Order</h2>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>
        )}
        <input
          name="patientName"
          required
          placeholder="Patient Name"
          className="w-full px-3 py-2 border rounded-lg text-sm"
        />
        <input
          name="patientPhone"
          placeholder="Phone (optional)"
          className="w-full px-3 py-2 border rounded-lg text-sm"
        />
        <input
          name="deliveryAddress"
          required
          placeholder="Address"
          className="w-full px-3 py-2 border rounded-lg text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            name="deliveryCity"
            required
            placeholder="City"
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
          <input
            name="deliveryPostalCode"
            required
            placeholder="Postal Code"
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>
        <select
          name="deliveryZoneId"
          required
          className="w-full px-3 py-2 border rounded-lg text-sm"
        >
          <option value="">Select zone...</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name} — ${z.price.toFixed(2)}
            </option>
          ))}
        </select>
        <select
          name="dayOfWeek"
          className="w-full px-3 py-2 border rounded-lg text-sm"
          defaultValue="1"
        >
          {DAYS.map((day, i) => (
            <option key={i} value={i}>{day}</option>
          ))}
        </select>
        <textarea
          name="instructions"
          rows={2}
          placeholder="Instructions (optional)"
          className="w-full px-3 py-2 border rounded-lg text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Creating..." : "Create Recurring Order"}
        </button>
      </form>
    </div>
  );
}
