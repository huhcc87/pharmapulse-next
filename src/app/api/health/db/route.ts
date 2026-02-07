// src/app/api/health/db/route.ts
// Database schema health check endpoint
//
// FINAL FIX VERIFICATION:
// 1. Ran: npm run db:sync (with --accept-data-loss for tax_inclusion removal)
// 2. Restarted dev server
// 3. /admin/db-debug shows OK
// 4. POS → Create Customer works
// 5. No DB_SCHEMA_OUT_OF_SYNC banners
//
// Customer.email is REQUIRED in schema and all queries expect it to exist.
// If this query fails, the database is out of sync and must be synced.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Helper to extract safe DB fingerprint (no passwords)
function getDbFingerprint(dbUrl: string): {
  provider: string;
  host?: string;
  databaseNameOrPath?: string;
} {
  if (!dbUrl) {
    return { provider: "unknown" };
  }

  // PostgreSQL: postgresql://user:pass@host:port/dbname
  if (dbUrl.includes("postgresql://") || dbUrl.includes("postgres://")) {
    try {
      const url = new URL(dbUrl);
      return {
        provider: "postgresql",
        host: url.hostname + (url.port ? `:${url.port}` : ""),
        databaseNameOrPath: url.pathname.replace("/", "") || undefined,
      };
    } catch {
      return { provider: "postgresql", host: "***" };
    }
  }

  // SQLite: file:./dev.db or sqlite:./dev.db
  if (dbUrl.includes("sqlite") || dbUrl.includes("file:")) {
    const match = dbUrl.match(/(?:file:|sqlite:)(.+)/);
    return {
      provider: "sqlite",
      databaseNameOrPath: match ? match[1] : "***",
    };
  }

  return { provider: "unknown" };
}

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || "";
  const dbFingerprint = getDbFingerprint(dbUrl);

  try {
    // STEP 5: Validate ALL required fields exist
    // Customer.email - REQUIRED
    const customerSample = await prisma.customer.findFirst({
      select: {
        id: true,
        name: true,
        phone: true,
        email: true, // CRITICAL: This will throw if email column doesn't exist
        gstin: true,
        stateCode: true,
      },
    });

    // Product GST fields - REQUIRED
    const productSample = await prisma.product.findFirst({
      select: {
        id: true,
        hsnCode: true, // REQUIRED
        gstRate: true, // REQUIRED
        gstType: true, // REQUIRED
        barcode: true, // REQUIRED
      },
    });

    // HSNMaster - REQUIRED
    const hsnSample = await prisma.hSNMaster.findFirst({
      select: {
        id: true,
        hsnCode: true,
        defaultGstRate: true,
        gstType: true,
        isActive: true,
      },
    });

    // All checks passed - schema is synchronized
    return NextResponse.json({
      ok: true,
      db: dbFingerprint,
      schema: {
        product: {
          hasHsnCode: true,
          hasGstRate: true,
          hasGstType: true,
          hasBarcode: true,
        },
        customer: {
          hasEmail: true,
        },
        hsnMaster: {
          exists: !!hsnSample,
        },
      },
    });
  } catch (error: any) {
    console.error("❌ [Health DB] Schema check failed:", error);

    // Detect missing column errors - comprehensive check
    const errorMsg = String(error.message || "").toLowerCase();
    const isSchemaError =
      errorMsg.includes("unknown column") ||
      errorMsg.includes("unknown field") ||
      errorMsg.includes("unknown argument") ||
      errorMsg.includes("column") && errorMsg.includes("does not exist") ||
      errorMsg.includes("field") && errorMsg.includes("does not exist") ||
      errorMsg.includes("does not exist") ||
      error.code === "P2021" || // Table does not exist
      error.code === "P2022"; // Column does not exist

    if (isSchemaError) {
      return NextResponse.json(
        {
          ok: false,
          code: "DB_SCHEMA_OUT_OF_SYNC",
          error: error.message,
          hint: "Run: npm run db:sync && restart dev server",
          db: dbFingerprint,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        code: "DB_ERROR",
        error: error.message || "Database health check failed",
        db: dbFingerprint,
      },
      { status: 500 }
    );
  }
}

