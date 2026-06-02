"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/portalStyles";

const sections = [
  { path: "dashboard", label: "Dashboard" },
  { path: "orders", label: "Orders" },
  { path: "recurring", label: "Recurring" },
  { path: "pricing", label: "Pricing" },
  { path: "invoices", label: "Invoices" },
  { path: "users", label: "Users" },
];

const SPOKE_DASHBOARD_URL =
  "https://connect.spoke.com/orders?sortField=createdAt&sortDirection=descending";

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
    <nav className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 px-4 py-3 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <div className="flex items-center space-x-3">
            <Link href={`/${storeSlug}/dashboard`} className="text-xl font-bold tracking-tight text-[#1e3a8a]">
              {storeName}
            </Link>
            {/* Store Switcher */}
            {otherStores.length > 0 && (
              <div className="flex items-center space-x-1">
                <span className="text-slate-300">|</span>
                {otherStores.map((s) => (
                  <Link
                    key={s.slug}
                    href={`/${s.slug}/dashboard`}
                    className="text-xs text-slate-400 hover:text-[#1e3a8a] font-medium px-2 py-1 rounded-full hover:bg-sky-50 transition-colors"
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
                className={cn(
                  "px-3 py-2 rounded-full text-sm font-semibold transition-colors",
                  pathname.startsWith(item.href)
                    ? "bg-[#6f8f72]/12 text-[#1e3a8a]"
                    : "text-slate-500 hover:text-[#1e3a8a] hover:bg-white"
                )}
              >
                {item.label}
              </Link>
            ))}
            <a
              href={SPOKE_DASHBOARD_URL}
              target="_blank"
              rel="noopener noreferrer"
              title="Open the Spoke orders dashboard (opens in a new tab)"
              className="px-3 py-2 rounded-full text-sm font-semibold transition-colors text-slate-500 hover:text-[#1e3a8a] hover:bg-white"
            >
              Spoke
            </a>
          </div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-sm text-slate-500 hover:text-rose-600 font-semibold"
        >
          Sign Out
        </button>
      </div>
    </nav>
  );
}
