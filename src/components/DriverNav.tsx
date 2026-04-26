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
    <nav className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 px-4 py-2 backdrop-blur-xl">
      <div className="max-w-lg mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-1">
          <Link
            href={`/${storeSlug}/deliveries`}
            className="text-base font-bold text-[#1e3a8a] px-3 py-2"
          >
            Deliveries
          </Link>
          <Link
            href={`/${storeSlug}/earnings`}
            className="text-sm text-slate-500 hover:text-[#1e3a8a] font-semibold px-3 py-2"
          >
            Earnings
          </Link>
          {storeName && (
            <span className="text-xs text-slate-400 hidden sm:inline">{storeName}</span>
          )}
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-sm text-slate-500 hover:text-rose-600 font-semibold px-3 py-2"
        >
          Sign Out
        </button>
      </div>
    </nav>
  );
}
