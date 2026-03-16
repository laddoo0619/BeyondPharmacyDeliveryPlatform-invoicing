import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role;

  // Public routes
  if (pathname === "/login" || pathname.startsWith("/api/auth")) {
    if (isLoggedIn && pathname === "/login") {
      const redirectUrl = role === "DRIVER" ? "/deliveries" : "/dashboard";
      return NextResponse.redirect(new URL(redirectUrl, req.url));
    }
    return NextResponse.next();
  }

  // Require auth for everything else
  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Pharmacy admin routes
  if (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/orders") ||
    pathname.startsWith("/recurring") ||
    pathname.startsWith("/pricing") ||
    pathname.startsWith("/invoices") ||
    pathname.startsWith("/users")
  ) {
    if (role !== "PHARMACY_ADMIN") {
      return NextResponse.redirect(new URL("/deliveries", req.url));
    }
  }

  // Driver routes
  if (pathname.startsWith("/deliveries") || pathname.startsWith("/deliver")) {
    if (role !== "DRIVER") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads).*)"],
};
