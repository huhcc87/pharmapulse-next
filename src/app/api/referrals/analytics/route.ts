// Referral Analytics API
// GET /api/referrals/analytics?customerId=123

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { getReferralAnalytics } from "@/lib/referrals/referral-manager";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const searchParams = req.nextUrl.searchParams;
    const customerId = searchParams.get("customerId");

    if (!customerId) {
      return NextResponse.json(
        { error: "customerId is required" },
        { status: 400 }
      );
    }

    const analytics = await getReferralAnalytics(
      parseInt(customerId),
      user.tenantId || 1
    );

    return NextResponse.json({
      success: true,
      analytics,
    });
  } catch (error: any) {
    console.error("Referral analytics API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
