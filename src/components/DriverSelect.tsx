"use client";

import { memo } from "react";

interface Driver {
  id: string;
  name: string;
}

interface Props {
  drivers: Driver[];
  value: string;
  onChange: (id: string) => void;
  autoFilledFromZone: boolean;
}

function DriverSelectInner({ drivers, value, onChange, autoFilledFromZone }: Props) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Assign Driver</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        <option value="">No driver (assign later)</option>
        {drivers.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      {autoFilledFromZone && (
        <p className="mt-1 text-xs text-blue-600">Auto-filled from zone default</p>
      )}
    </div>
  );
}

export const DriverSelect = memo(DriverSelectInner);
