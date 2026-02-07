// GET /api/suppliers/performance/[id]
// Get supplier performance metrics

import { NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { getSupplierPerformance } from "@/lib/suppliers/supplier-management";

const DEMO_TENANT_ID = 1;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const resolvedParams = await params;
    const supplierId = parseInt(resolvedParams.id);
    if (isNaN(supplierId)) {
      return NextResponse.json(
        { error: "Invalid supplier ID" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const tenantId = Number(searchParams.get("tenantId")) || DEMO_TENANT_ID;

    const performance = await getSupplierPerformance(supplierId, tenantId);

    return NextResponse.json({
      success: true,
      performance,
    });
  } catch (error: any) {
    console.error("Supplier performance error:", error);
    return NextResponse.json(
      {
        error: "Failed to get supplier performance",
        message: error.message,
      },
      { status: 500 }
    );
  }
}
