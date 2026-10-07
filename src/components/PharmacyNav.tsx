"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import logo from "@/assets/beyond-pharmacy-logo.png";

const sections = [
  { path: "dashboard", label: "Dashboard" },
  { path: "orders", label: "Orders" },
  { path: "recurring", label: "Recurring" },
  { path: "reminders", label: "Reminders" },
  { path: "pricing", label: "Pricing" },
  { path: "invoices", label: "Invoices" },
  { path: "users", label: "Users" },
];

const SPOKE_DASHBOARD_URL =
  "https://connect.spoke.com/orders?sortField=createdAt&sortDirection=descending";

const BRAND_NAME = "Beyond Pharmacy";

const stores = [
  { slug: "surrey", label: "Surrey" },
  { slug: "abbotsford", label: "Abbotsford" },
];

export default function PharmacyNav({
  storeSlug,
  storeName,
  basePath,
}: {
  storeSlug: string;
  storeName: string;
  // Where section links point. Defaults to the store's own routes; the
  // dev-only style guide passes "/dev" so its links stay on fixture screens.
  basePath?: string;
}) {
  const pathname = usePathname();
  const base = basePath ?? `/${storeSlug}`;

  const navItems = sections.map((s) => ({
    href: `${base}/${s.path}`,
    label: s.label,
  }));

  const otherStores = stores.filter((s) => s.slug !== storeSlug);

  // The logo spells "Beyond Pharmacy", so next to it only the rest of the
  // store's name is written out; the link's accessible name stays the full
  // store name. Phones keep today's text-only header.
  const brandSuffix = storeName.startsWith(BRAND_NAME)
    ? storeName.slice(BRAND_NAME.length).trim()
    : storeName;

  // Below xl the links take their own row inside the bar (same md
  // breakpoint as before) — with the logo, one row can't hold them at tablet
  // widths, and they must never run under Sign Out or off the screen.
  // The logo is 24px from xl: the bar is capped at the 1200px content width,
  // and at 28px the eight links no longer fit beside it.
  return (
    <nav className="sticky top-0 z-30 pt-2 sm:pt-3">
      <div className="mx-auto flex w-full max-w-content items-center justify-between gap-x-3 gap-y-1 rounded-full header-glass px-3 py-2 sm:px-5 md:flex-wrap md:rounded-mid xl:flex-nowrap xl:rounded-full">
        <div className="flex min-w-0 items-center gap-x-2 sm:gap-x-3">
          <Link
            href={`${base}/dashboard`}
            aria-label={storeName}
            className="flex min-w-0 items-center gap-2 text-sm font-extrabold leading-tight tracking-tight text-navy sm:shrink-0 sm:text-base"
          >
            <Image
              src={logo}
              alt=""
              priority
              className="hidden h-5 w-auto shrink-0 sm:block xl:h-6"
            />
            <span className="sm:hidden">{storeName}</span>
            {brandSuffix && <span className="hidden whitespace-nowrap sm:inline">{brandSuffix}</span>}
          </Link>
          {/* Store Switcher */}
          {otherStores.length > 0 && (
            <div className="flex items-center space-x-1">
              <span className="text-ghost">|</span>
              {otherStores.map((s) => (
                <Link
                  key={s.slug}
                  href={`/${s.slug}/dashboard`}
                  className="nav-link px-2 py-1 text-xs font-semibold text-muted transition-colors hover:text-navy sm:whitespace-nowrap"
                >
                  Switch to {s.label}
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="hidden md:flex order-last basis-full gap-1 xl:order-none xl:mr-auto xl:ml-3 xl:basis-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname.startsWith(item.href) ? "page" : undefined}
              className="nav-link whitespace-nowrap px-2 py-2 text-nav font-semibold text-navy xl:px-1.5"
            >
              {item.label}
            </Link>
          ))}
          <a
            href={SPOKE_DASHBOARD_URL}
            target="_blank"
            rel="noopener noreferrer"
            title="Open the Spoke orders dashboard (opens in a new tab)"
            className="nav-link whitespace-nowrap px-2 py-2 text-nav font-semibold text-navy xl:px-1.5"
          >
            Spoke
          </a>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="shrink-0 rounded-full bg-navy px-3 py-1.5 text-xs font-bold text-cream transition duration-(--hover-ms) ease-out hover:bg-navy-deep active:scale-(--press-scale) sm:px-4 sm:py-2 sm:text-sm"
        >
          Sign Out
        </button>
      </div>
    </nav>
  );
}
