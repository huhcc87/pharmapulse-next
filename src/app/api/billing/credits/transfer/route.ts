// Credit Transfer API
// POST /api/billing/credits/transfer

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { transferCredits } from "@/lib/billing/credit-management";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { toTenantId, credits, reason } = body;

    if (!toTenantId || !credits) {
      return NextResponse.json(
        { error: "toTenantId and credits are required" },
        { status: 400 }
      );
    }

    const fromTenantId = user.tenantId || "default";

    const result = await transferCredits(fromTenantId, {
      fromTenantId,
      toTenantId,
      credits,
      reason,
    });

    return NextResponse.json({
      success: true,
      transferId: result.transferId,
    });
  } catch (error: any) {
    console.error("Transfer credits API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
