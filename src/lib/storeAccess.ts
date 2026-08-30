import { NextResponse } from "next/server";
import { auth } from "./auth";

interface StoreLike {
  id: string;
}

/**
 * Shared guard for store-scoped pharmacy endpoints: the store must exist, the
 * caller must be a pharmacy admin, AND — the part that is easy to forget — a
 * store-scoped admin must be acting on their OWN store rather than whichever
 * slug happens to be in the URL.
 */
export async function requireStoreAdmin<T extends StoreLike>(store: T | null) {
  if (!store) {
    return { error: NextResponse.json({ error: "Store not found" }, { status: 404 }) };
  }

  const session = await auth();
  if (!session?.user || session.user.role !== "PHARMACY_ADMIN") {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  // Admins without a storeId are super-admins and may act on any store.
  if (session.user.storeId && session.user.storeId !== store.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { store, session };
}
