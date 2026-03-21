"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

export default function DriverNav({
  storeSlug,
  storeName,
}: {
  storeSlug: string;
  storeName?: string;
}) {
  return (
    <nav className="bg-green-600 px-4 py-2">
      <div className="max-w-lg mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-1">
          <Link
            href={`/${storeSlug}/deliveries`}
            className="text-base font-bold text-white px-3 py-2"
          >
            Deliveries
          </Link>
          <Link
            href={`/${storeSlug}/earnings`}
            className="text-sm text-green-100 hover:text-white font-medium px-3 py-2"
          >
            Earnings
          </Link>
          {storeName && (
            <span className="text-xs text-green-200 hidden sm:inline">{storeName}</span>
          )}
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-sm text-green-100 hover:text-white font-medium px-3 py-2"
        >
          Sign Out
        </button>
      </div>
    </nav>
  );
}
