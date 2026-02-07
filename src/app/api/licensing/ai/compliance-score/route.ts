// AI License Compliance Monitor API
// GET /api/licensing/ai/compliance-score

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { analyzeLicenseCompliance } from "@/lib/ai/license-compliance";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";

    // Get license
    const license = await prisma.license.findUnique({
      where: { tenantId },
    });

    if (!license) {
      return NextResponse.json(
        { error: "License not found" },
        { status: 404 }
      );
    }

    // Analyze compliance
    const compliance = await analyzeLicenseCompliance(tenantId, license.id);

    // Save analysis
    await prisma.aILicenseCompliance.create({
      data: {
        tenantId,
        licenseId: license.id,
        analysisDate: new Date(),
        predictedUsage: compliance.predictedUsage || null,
        currentUsage: compliance.currentUsage,
        usageLimit: compliance.usageLimit,
        daysToExceedLimit: compliance.daysToExceedLimit || null,
        complianceScore: compliance.complianceScore,
        riskLevel: compliance.riskLevel,
        deviceViolations: compliance.deviceViolations,
        ipViolations: compliance.ipViolations,
        recentViolations: compliance.recentViolations
          ? JSON.parse(JSON.stringify(compliance.recentViolations))
          : null,
        recommendedTier: compliance.recommendedTier || null,
        costSavings: compliance.costSavings || null,
        reasoning: compliance.reasoning || null,
      },
    });

    return NextResponse.json({
      success: true,
      compliance,
    });
  } catch (error: any) {
    console.error("License compliance API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
