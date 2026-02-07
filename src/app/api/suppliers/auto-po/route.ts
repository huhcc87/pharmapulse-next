// POST /api/suppliers/auto-po
// Auto-generate purchase orders from low stock alerts

import { NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { autoGeneratePO } from "@/lib/suppliers/supplier-management";

const DEMO_TENANT_ID = 1;

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { tenantId = DEMO_TENANT_ID } = body;

    // Auto-generate PO suggestions
    const suggestions = await autoGeneratePO(tenantId);

    return NextResponse.json({
      success: true,
      suggestions,
      count: suggestions.length,
    });
  } catch (error: any) {
    console.error("Auto PO generation error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate PO suggestions",
        message: error.message,
      },
      { status: 500 }
    );
  }
}
