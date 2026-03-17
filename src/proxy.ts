import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const VALID_STORE_SLUGS = ["surrey", "abbotsford"];
const ADMIN_SECTIONS = ["dashboard", "orders", "recurring", "pricing", "invoices", "users"];
const DRIVER_SECTIONS = ["deliveries", "deliver"];

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role;
  const storeSlug = req.auth?.user?.storeSlug;

  // Public routes
  if (pathname === "/login" || pathname.startsWith("/api/auth") || pathname === "/api/health") {
    if (isLoggedIn && pathname === "/login") {
      // Redirect to root which will show store selector or redirect driver
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  }

  // Require auth for everything else
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Root page — allow through (it handles store selection/redirect)
  if (pathname === "/") {
    return NextResponse.next();
  }

  // Extract store slug from path: /surrey/dashboard → "surrey"
  const pathParts = pathname.split("/").filter(Boolean);
  const pathStore = pathParts[0];

  // API routes with store — validate store slug
  if (pathname.startsWith("/api/") && pathParts.length >= 2) {
    const apiStore = pathParts[1]; // /api/[store]/...
    if (VALID_STORE_SLUGS.includes(apiStore)) {
      // For driver API access, verify store matches their assigned store
      if (role === "DRIVER" && storeSlug && apiStore !== storeSlug) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }
      return NextResponse.next();
    }
    // Non-store API routes (e.g., /api/auth) pass through
    return NextResponse.next();
  }

  // Validate store slug in path
  if (!VALID_STORE_SLUGS.includes(pathStore)) {
    // Redirect to root for store selection
    return NextResponse.redirect(new URL("/", req.url));
  }

  const section = pathParts[1]; // e.g., "dashboard", "deliveries"

  // Pharmacy admin routes
  if (ADMIN_SECTIONS.includes(section)) {
    if (role !== "PHARMACY_ADMIN") {
      // Drivers can't access admin routes — redirect to their store's deliveries
      const driverStore = storeSlug || pathStore;
      return NextResponse.redirect(new URL(`/${driverStore}/deliveries`, req.url));
    }
    return NextResponse.next();
  }

  // Driver routes
  if (DRIVER_SECTIONS.includes(section)) {
    if (role !== "DRIVER") {
      // Admins can't access driver routes — redirect to that store's dashboard
      return NextResponse.redirect(new URL(`/${pathStore}/dashboard`, req.url));
    }
    // Verify driver is accessing their own store
    if (storeSlug && pathStore !== storeSlug) {
      return NextResponse.redirect(new URL(`/${storeSlug}/deliveries`, req.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads).*)"],
};
