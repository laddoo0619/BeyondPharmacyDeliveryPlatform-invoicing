"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Zone {
  id: string;
  name: string;
  price: number;
  isActive: boolean;
}

export default function ZoneList({ zones }: { zones: Zone[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [loading, setLoading] = useState(false);

  const updateZone = async (id: string, data: Record<string, unknown>) => {
    setLoading(true);
    await fetch(`/api/zones/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setLoading(false);
    setEditingId(null);
    router.refresh();
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      <div className="px-6 py-4 border-b">
        <h2 className="text-lg font-semibold">Delivery Zones</h2>
      </div>
      {zones.length === 0 ? (
        <div className="px-6 py-12 text-center text-gray-500">
          No delivery zones configured yet.
        </div>
      ) : (
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Zone
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {zones.map((zone) => (
              <tr key={zone.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  {zone.name}
                </td>
                <td className="px-6 py-4 text-sm">
                  {editingId === zone.id ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        step="0.01"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="w-24 px-2 py-1 border rounded text-sm"
                      />
                      <button
                        onClick={() =>
                          updateZone(zone.id, {
                            price: parseFloat(editPrice),
                          })
                        }
                        disabled={loading}
                        className="text-xs text-green-600 font-medium"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-xs text-gray-500"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <span className="text-gray-900">
                      ${zone.price.toFixed(2)}
                    </span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${
                      zone.isActive
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {zone.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm space-x-2">
                  <button
                    onClick={() => {
                      setEditingId(zone.id);
                      setEditPrice(zone.price.toString());
                    }}
                    className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                  >
                    Edit Price
                  </button>
                  <button
                    onClick={() =>
                      updateZone(zone.id, { isActive: !zone.isActive })
                    }
                    disabled={loading}
                    className="text-gray-600 hover:text-gray-800 text-xs font-medium"
                  >
                    {zone.isActive ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
