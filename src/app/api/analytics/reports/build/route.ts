// POST /api/analytics/reports/build
// Build custom report

import { NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { buildCustomReport, ReportConfig } from "@/lib/analytics/report-builder";

const DEMO_TENANT_ID = 1;

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { config, tenantId = DEMO_TENANT_ID } = body;

    if (!config || !config.fields || !Array.isArray(config.fields)) {
      return NextResponse.json(
        { error: "Invalid report configuration" },
        { status: 400 }
      );
    }

    // Build report
    const result = await buildCustomReport(config as ReportConfig, tenantId);

    return NextResponse.json({
      success: true,
      report: result,
    });
  } catch (error: any) {
    console.error("Report build error:", error);
    return NextResponse.json(
      {
        error: "Failed to build report",
        message: error.message,
      },
      { status: 500 }
    );
  }
}
