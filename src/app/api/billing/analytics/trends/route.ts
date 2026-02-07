// Billing Analytics - Spending Trends API
// GET /api/billing/analytics/trends

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { getSpendingTrends } from "@/lib/billing/billing-analytics";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";
    const searchParams = req.nextUrl.searchParams;
    const period = searchParams.get("period") as "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY" || "MONTHLY";
    const months = parseInt(searchParams.get("months") || "12");

    const trends = await getSpendingTrends(tenantId, period, months);

    return NextResponse.json({
      trends,
    });
  } catch (error: any) {
    console.error("Get spending trends API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
