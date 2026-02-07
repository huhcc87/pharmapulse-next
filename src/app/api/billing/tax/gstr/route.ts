// GSTR Filing API
// GET /api/billing/tax/gstr - Generate GSTR filing data
// POST /api/billing/tax/gstr - Submit GSTR filing

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { generateGSTRFilingData, submitGSTRFiling } from "@/lib/billing/tax-management";

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

    if (!gstin) {
      return NextResponse.json(
        { error: "gstin is required" },
        { status: 400 }
      );
    }

    const filingData = await generateGSTRFilingData(tenantId, period, gstin);

    return NextResponse.json({
      filingData,
    });
  } catch (error: any) {
    console.error("Generate GSTR filing data API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { period, gstin } = body;

    if (!period || !gstin) {
      return NextResponse.json(
        { error: "period and gstin are required" },
        { status: 400 }
      );
    }

    const tenantId = user.tenantId || "default";

    // Generate filing data
    const filingData = await generateGSTRFilingData(tenantId, period, gstin);

    // Submit filing
    const result = await submitGSTRFiling(tenantId, filingData);

    return NextResponse.json({
      success: result.success,
      filingId: result.filingId,
      message: result.message,
    });
  } catch (error: any) {
    console.error("Submit GSTR filing API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
