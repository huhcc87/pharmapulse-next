// POST /api/suppliers/compare
// Compare vendors for a product

import { NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { compareVendors } from "@/lib/suppliers/supplier-management";

const DEMO_TENANT_ID = 1;

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const {
      productId,
      drugLibraryId,
      tenantId = DEMO_TENANT_ID,
    } = body;

    if (!productId && !drugLibraryId) {
      return NextResponse.json(
        { error: "Either productId or drugLibraryId is required" },
        { status: 400 }
      );
    }

    // Compare vendors
    const comparison = await compareVendors(
      productId,
      drugLibraryId,
      tenantId
    );

    return NextResponse.json({
      success: true,
      comparison,
    });
  } catch (error: any) {
    console.error("Vendor comparison error:", error);
    return NextResponse.json(
      {
        error: "Failed to compare vendors",
        message: error.message,
      },
      { status: 500 }
    );
  }
}
