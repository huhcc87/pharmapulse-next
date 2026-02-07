// AI-Powered Access Control API
// GET /api/security/ai/optimize-permissions - Get permission recommendations
// POST /api/security/ai/optimize-permissions - Apply recommendation

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { analyzePermissions, applyPermissionRecommendation } from "@/lib/ai/access-control";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";
    const searchParams = req.nextUrl.searchParams;
    const userId = searchParams.get("userId");

    // Analyze permissions
    const recommendations = await analyzePermissions(tenantId, userId || undefined);

    // Save recommendations
    for (const rec of recommendations) {
      await prisma.aIPermissionRecommendation.create({
        data: {
          tenantId,
          userId: rec.userId,
          recommendationType: rec.recommendationType,
          permission: rec.permission,
          currentStatus: rec.currentStatus,
          recommendedStatus: rec.recommendedStatus,
          confidenceScore: rec.confidenceScore,
          reasoning: rec.reasoning || null,
          isAnomalousUsage: rec.isAnomalousUsage || false,
          daysSinceLastUse: rec.daysSinceLastUse || null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      recommendations,
    });
  } catch (error: any) {
    console.error("Permission optimization API error:", error);
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
    const { recommendationId } = body;

    if (!recommendationId) {
      return NextResponse.json(
        { error: "recommendationId is required" },
        { status: 400 }
      );
    }

    const tenantId = user.tenantId || "default";
    const applied = await applyPermissionRecommendation(recommendationId, tenantId);

    if (!applied) {
      return NextResponse.json(
        { error: "Failed to apply recommendation" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Permission recommendation applied successfully",
    });
  } catch (error: any) {
    console.error("Apply permission recommendation API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
