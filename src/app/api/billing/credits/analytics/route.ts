// Credit Usage Analytics API
// GET /api/billing/credits/analytics

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { getCreditUsageAnalytics } from "@/lib/billing/credit-management";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";
    const searchParams = req.nextUrl.searchParams;
    const period = searchParams.get("period") as "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY" || "MONTHLY";

    const analytics = await getCreditUsageAnalytics(tenantId, period);

    return NextResponse.json({
      analytics,
    });
  } catch (error: any) {
    console.error("Get credit analytics API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
