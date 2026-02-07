// Set Default Payment Method API
// POST /api/billing/payment-methods/[id]/set-default

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { setDefaultPaymentMethod } from "@/lib/billing/payment-methods";

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

    const paymentMethod = await setDefaultPaymentMethod(tenantId, id);

    return NextResponse.json({
      success: true,
      paymentMethod: {
        id: paymentMethod.id,
        isDefault: paymentMethod.isDefault,
      },
    });
  } catch (error: any) {
    console.error("Set default payment method API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
