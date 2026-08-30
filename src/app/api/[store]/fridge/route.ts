import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { resolveStore } from "@/lib/store";
import { getFridgeChecklist } from "@/lib/fridge";

async function requireStoreSession(storeSlug: string) {
  const store = await resolveStore(storeSlug);
  if (!store) {
    return { error: NextResponse.json({ error: "Store not found" }, { status: 404 }) };
  }

  const session = await auth();
  if (!session?.user || session.user.role !== "PHARMACY_ADMIN") {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  // Store-scoped admins may only touch their own store's fridge list.
  if (session.user.storeId && session.user.storeId !== store.id) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { store, session };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ store: string }> }
) {
  const { store: storeSlug } = await params;
  const access = await requireStoreSession(storeSlug);
  if (access.error) return access.error;

  const checklist = await getFridgeChecklist(access.store.id);
  return NextResponse.json(checklist);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ store: string }> }
) {
  const { store: storeSlug } = await params;
  const access = await requireStoreSession(storeSlug);
  if (access.error) return access.error;

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : null;
  const kind = body?.kind === "ORDER" || body?.kind === "DISPATCH" ? body.kind : null;
  const checked = body?.checked === true;

  if (!id || !kind) {
    return NextResponse.json(
      { error: "id and kind ('ORDER' | 'DISPATCH') are required" },
      { status: 400 }
    );
  }

  // Unticking is deliberately allowed — staff who tick the wrong row need a way
  // back, and a stale tick is worse than no tick for a fridge item.
  const data = {
    fridgeCheckedAt: checked ? new Date() : null,
    fridgeCheckedById: checked ? access.session.user.id : null,
  };

  // updateMany scopes the write to this store, so an id from another store
  // matches nothing rather than being updated.
  const result =
    kind === "ORDER"
      ? await prisma.order.updateMany({
          where: { id, storeId: access.store.id, hasFridgeItem: true },
          data,
        })
      : await prisma.externalDispatch.updateMany({
          where: { id, storeId: access.store.id, hasFridgeItem: true },
          data,
        });

  if (result.count === 0) {
    return NextResponse.json({ error: "Fridge item not found" }, { status: 404 });
  }

  const checklist = await getFridgeChecklist(access.store.id);
  return NextResponse.json(checklist);
}
