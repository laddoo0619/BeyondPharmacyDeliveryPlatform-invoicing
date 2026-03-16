"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const sections = [
  { path: "dashboard", label: "Dashboard" },
  { path: "orders", label: "Orders" },
  { path: "recurring", label: "Recurring" },
  { path: "pricing", label: "Pricing" },
  { path: "invoices", label: "Invoices" },
  { path: "users", label: "Users" },
];

const stores = [
  { slug: "surrey", label: "Surrey" },
  { slug: "abbotsford", label: "Abbotsford" },
];

export default function PharmacyNav({
  storeSlug,
  storeName,
}: {
  storeSlug: string;
  storeName: string;
}) {
  const pathname = usePathname();

  const navItems = sections.map((s) => ({
    href: `/${storeSlug}/${s.path}`,
    label: s.label,
  }));

  const otherStores = stores.filter((s) => s.slug !== storeSlug);

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <div className="flex items-center space-x-3">
            <Link href={`/${storeSlug}/dashboard`} className="text-xl font-bold text-blue-600">
              {storeName}
            </Link>
            {/* Store Switcher */}
            {otherStores.length > 0 && (
              <div className="flex items-center space-x-1">
                <span className="text-gray-300">|</span>
                {otherStores.map((s) => (
                  <Link
                    key={s.slug}
                    href={`/${s.slug}/dashboard`}
                    className="text-xs text-gray-400 hover:text-blue-600 font-medium px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                  >
                    Switch to {s.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="hidden md:flex space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname.startsWith(item.href)
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-sm text-gray-600 hover:text-red-600 font-medium"
        >
          Sign Out
        </button>
      </div>
    </nav>
  );
}
