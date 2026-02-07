// Tax Report Generation API
// GET /api/billing/tax/reports

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { generateTaxReport } from "@/lib/billing/tax-management";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";
    const searchParams = req.nextUrl.searchParams;
    const period = searchParams.get("period"); // YYYY-MM
    const gstin = searchParams.get("gstin");

    if (!period) {
      return NextResponse.json(
        { error: "period is required (YYYY-MM format)" },
        { status: 400 }
      );
    }

    const report = await generateTaxReport(tenantId, period, gstin || undefined);

    return NextResponse.json({
      report,
    });
  } catch (error: any) {
    console.error("Generate tax report API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
