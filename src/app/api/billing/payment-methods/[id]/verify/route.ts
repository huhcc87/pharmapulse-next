// Verify Payment Method API
// POST /api/billing/payment-methods/[id]/verify

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { verifyPaymentMethod } from "@/lib/billing/payment-methods";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";
    const resolvedParams = await params;
    const { id } = resolvedParams;

    const paymentMethod = await verifyPaymentMethod(tenantId, id);

    return NextResponse.json({
      success: true,
      paymentMethod: {
        id: paymentMethod.id,
        verifiedAt: paymentMethod.verifiedAt,
      },
    });
  } catch (error: any) {
    console.error("Verify payment method API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
