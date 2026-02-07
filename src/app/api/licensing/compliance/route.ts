// License Compliance Monitoring API
// GET /api/licensing/compliance

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { monitorLicenseCompliance } from "@/lib/licensing/license-compliance-monitoring";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";

    const monitoring = await monitorLicenseCompliance(tenantId);

    return NextResponse.json({
      monitoring,
    });
  } catch (error: any) {
    console.error("License compliance monitoring API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
