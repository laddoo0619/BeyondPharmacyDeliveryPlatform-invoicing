"use client";

import { memo } from "react";
import { input, label } from "@/lib/portalStyles";

interface Driver {
  id: string;
  name: string;
}

interface Props {
  drivers: Driver[];
  value: string;
  onChange: (id: string) => void;
  autoFilledFromZone: boolean;
  required?: boolean;
}

function DriverSelectInner({ drivers, value, onChange, autoFilledFromZone, required }: Props) {
  return (
    <div>
      <label className={label}>Assign Driver{required ? " *" : ""}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={input}
        required={required}
      >
        <option value="">
          {required ? "Select driver..." : "No driver (assign later)"}
        </option>
        {drivers.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      {autoFilledFromZone && (
        <p className="mt-1 text-xs font-medium text-[#6f8f72]">Auto-filled from zone default</p>
      )}
    </div>
  );
}

export const DriverSelect = memo(DriverSelectInner);
