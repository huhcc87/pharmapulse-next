// Billing Analytics - Cost Breakdown API
// GET /api/billing/analytics/breakdown

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { getCostBreakdown, getUsageCostCorrelation, getForecastingData } from "@/lib/billing/billing-analytics";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";
    const searchParams = req.nextUrl.searchParams;
    const type = searchParams.get("type"); // breakdown, correlation, forecast
    const period = searchParams.get("period") as "MONTHLY" | "QUARTERLY" | "YEARLY" || "MONTHLY";

    if (type === "breakdown") {
      const breakdown = await getCostBreakdown(tenantId, period);
      return NextResponse.json({ breakdown });
    } else if (type === "correlation") {
      const correlation = await getUsageCostCorrelation(tenantId, period);
      return NextResponse.json({ correlation });
    } else if (type === "forecast") {
      const forecast = await getForecastingData(tenantId);
      return NextResponse.json({ forecast });
    } else {
      // Return all
      const [breakdown, correlation, forecast] = await Promise.all([
        getCostBreakdown(tenantId, period),
        getUsageCostCorrelation(tenantId, period),
        getForecastingData(tenantId),
      ]);

      return NextResponse.json({
        breakdown,
        correlation,
        forecast,
      });
    }
  } catch (error: any) {
    console.error("Get billing analytics API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
