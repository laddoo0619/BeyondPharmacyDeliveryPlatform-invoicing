"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

export default function DriverNav({
  storeSlug,
  storeName,
  basePath,
}: {
  storeSlug: string;
  storeName?: string;
  // Defaults to the store's own routes; the dev-only style guide passes "/dev".
  basePath?: string;
}) {
  const base = basePath ?? `/${storeSlug}`;
  const pathname = usePathname();
  const links = [
    { href: `${base}/deliveries`, label: "Deliveries" },
    { href: `${base}/earnings`, label: "Earnings" },
  ];
  return (
    <nav className="sticky top-0 z-30 px-4 pt-3">
      <div className="max-w-lg mx-auto flex items-center justify-between rounded-full bg-header px-2 py-1.5 shadow-lift backdrop-blur-[16px] backdrop-saturate-[1.3]">
        <div className="flex items-center space-x-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname.startsWith(link.href) ? "page" : undefined}
              className="nav-link px-3 py-2 text-nav font-bold text-navy"
            >
              {link.label}
            </Link>
          ))}
          {storeName && (
            <span className="text-xs font-semibold text-muted hidden sm:inline">{storeName}</span>
          )}
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="shrink-0 rounded-full bg-navy px-4 py-2 text-sm font-bold text-cream transition duration-[220ms] ease-out hover:bg-navy-deep active:scale-[0.97]"
        >
          Sign Out
        </button>
      </div>
    </nav>
  );
}
