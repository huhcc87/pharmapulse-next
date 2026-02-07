// License Optimization Recommendations API
// POST /api/licensing/ai/optimize

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { analyzeLicenseOptimization } from "@/lib/licensing/license-optimization";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";

    // Analyze license optimization
    const optimization = await analyzeLicenseOptimization(tenantId);

    return NextResponse.json({
      success: true,
      optimization,
    });
  } catch (error: any) {
    console.error("License optimization API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
