"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";

export default function DriverNav() {
  return (
    <nav className="bg-green-600 px-4 py-3">
      <div className="max-w-lg mx-auto flex items-center justify-between">
        <Link href="/deliveries" className="text-lg font-bold text-white">
          Deliveries
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-sm text-green-100 hover:text-white font-medium"
        >
          Sign Out
        </button>
      </div>
    </nav>
  );
}
