// Subscription Upgrade/Downgrade API
// POST /api/billing/subscription/upgrade

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { upgradeSubscription } from "@/lib/billing/subscription-management";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { newPlan } = body;

    if (!newPlan) {
      return NextResponse.json(
        { error: "newPlan is required" },
        { status: 400 }
      );
    }

    const tenantId = user.tenantId || "default";

    const result = await upgradeSubscription(tenantId, newPlan);

    return NextResponse.json({
      success: true,
      newPlan: result.newPlan,
      proratedAmountPaise: result.proratedAmountPaise,
      effectiveDate: result.effectiveDate,
    });
  } catch (error: any) {
    console.error("Upgrade subscription API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
