"use client";

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
      className="block w-full text-center bg-green-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-green-700"
    >
      Generate Record (CSV)
    </a>
  );
}
