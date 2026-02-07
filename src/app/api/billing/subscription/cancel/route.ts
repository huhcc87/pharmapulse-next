// Subscription Cancellation API
// POST /api/billing/subscription/cancel

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { cancelSubscription } from "@/lib/billing/subscription-management";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { reason } = body;

    const tenantId = user.tenantId || "default";

    const result = await cancelSubscription(tenantId, reason);

    return NextResponse.json({
      success: true,
      retentionOffers: result.retentionOffers,
    });
  } catch (error: any) {
    console.error("Cancel subscription API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
