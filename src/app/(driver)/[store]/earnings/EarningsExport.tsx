"use client";

import { primaryButtonFull } from "@/lib/portalStyles";

export default function EarningsExport({
  storeSlug,
  start,
  end,
}: {
  storeSlug: string;
  start: string;
  end: string;
}) {
  return (
    <a
      href={`/api/${storeSlug}/driver/earnings?start=${start}&end=${end}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`${primaryButtonFull} block text-center`}
    >
      Generate Record (CSV)
    </a>
  );
}
