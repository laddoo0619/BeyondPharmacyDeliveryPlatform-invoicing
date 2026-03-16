"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Zone {
  id: string;
  name: string;
  price: number;
}

export default function NewOrderForm({ zones, storeSlug }: { zones: Zone[]; storeSlug: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedZoneId, setSelectedZoneId] = useState("");

  const selectedZone = zones.find((z) => z.id === selectedZoneId);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      patientName: formData.get("patientName") as string,
      patientPhone: formData.get("patientPhone") as string,
      deliveryAddress: formData.get("deliveryAddress") as string,
      deliveryCity: formData.get("deliveryCity") as string,
      deliveryPostalCode: formData.get("deliveryPostalCode") as string,
      deliveryZoneId: formData.get("deliveryZoneId") as string,
      instructions: formData.get("instructions") as string,
      scheduledDate: formData.get("scheduledDate") as string,
    };

    const res = await fetch(`/api/${storeSlug}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = await res.json();
      setError(err.error || "Failed to create order");
      setLoading(false);
    } else {
      router.push(`/${storeSlug}/orders`);
      router.refresh();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl bg-white p-6 rounded-lg shadow-sm border space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Patient Name *</label>
          <input name="patientName" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Patient Phone</label>
          <input name="patientPhone" type="tel" className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Address *</label>
        <input name="deliveryAddress" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
          <input name="deliveryCity" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code *</label>
          <input name="deliveryPostalCode" required className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Zone *</label>
          <select name="deliveryZoneId" required value={selectedZoneId} onChange={(e) => setSelectedZoneId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
            <option value="">Select zone...</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.id}>{zone.name} — ${zone.price.toFixed(2)}</option>
            ))}
          </select>
          {selectedZone && <p className="mt-1 text-sm text-green-600 font-medium">Delivery price: ${selectedZone.price.toFixed(2)}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date *</label>
          <input name="scheduledDate" type="date" required defaultValue={new Date().toISOString().split("T")[0]} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Instructions</label>
        <textarea name="instructions" rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="Leave at door, ring bell, etc." />
      </div>
      <div className="flex space-x-3 pt-4">
        <button type="submit" disabled={loading} className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {loading ? "Creating..." : "Create Order"}
        </button>
        <button type="button" onClick={() => router.back()} className="px-6 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
      </div>
    </form>
  );
}
