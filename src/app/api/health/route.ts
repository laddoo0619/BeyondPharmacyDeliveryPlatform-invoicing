import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    // Test database connection. This endpoint is public (used as a HEAD-request
    // connectivity probe), so it must never include user data or config values.
    await prisma.user.count();

    return NextResponse.json({
      status: "ok",
      database: "connected",
      env: {
        hasDbUrl: !!process.env.DATABASE_URL,
        hasDirectUrl: !!process.env.DIRECT_URL,
        hasAuthSecret: !!process.env.AUTH_SECRET,
        hasAuthUrl: !!process.env.AUTH_URL,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Unknown error",
        env: {
          hasDbUrl: !!process.env.DATABASE_URL,
          hasDirectUrl: !!process.env.DIRECT_URL,
          hasAuthSecret: !!process.env.AUTH_SECRET,
          hasAuthUrl: !!process.env.AUTH_URL,
        },
      },
      { status: 500 }
    );
  }
}
