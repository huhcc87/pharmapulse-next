// AI Credit Usage Optimization API
// POST /api/billing/ai/credit-optimization

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { analyzeCreditOptimization } from "@/lib/ai/credit-optimization";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";

    // Analyze credit optimization
    const optimization = await analyzeCreditOptimization(tenantId);

    // Save analysis
    const savedOptimization = await prisma.aICreditOptimization.create({
      data: {
        tenantId,
        analysisDate: new Date(),
        predictedUsage: optimization.predictedUsage ?? 0,
        currentBalance: optimization.currentBalance,
        daysUntilDepletion: optimization.daysUntilExhaustion ?? null,
        wastedCredits: 0, // Calculate from wasteAlerts if needed
        wasteReasons: optimization.wasteAlerts && optimization.wasteAlerts.length > 0
          ? JSON.parse(JSON.stringify(optimization.wasteAlerts))
          : null,
        optimalPurchaseDate: optimization.optimalPurchaseTiming === "NOW" 
          ? new Date() 
          : optimization.optimalPurchaseTiming === "LATER"
          ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
          : null,
        recommendedPurchaseAmount: optimization.recommendedTopUpAmount ?? null,
        confidenceScore: 75.0, // Default confidence score
        reasoning: optimization.reasoning || null,
      },
    });

    return NextResponse.json({
      success: true,
      optimization: {
        id: savedOptimization.id,
        predictedUsage: optimization.predictedUsage,
        currentBalance: optimization.currentBalance,
        monthlyGrant: optimization.monthlyGrant,
        daysUntilExhaustion: optimization.daysUntilExhaustion,
        isWasteDetected: optimization.isWasteDetected,
        wasteAlerts: optimization.wasteAlerts,
        optimalPurchaseTiming: optimization.optimalPurchaseTiming,
        recommendedTopUpAmount: optimization.recommendedTopUpAmount,
        reasoning: optimization.reasoning,
      },
    });
  } catch (error: any) {
    console.error("Credit optimization API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/billing/ai/credit-optimization - Get optimization analysis
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";

    const optimization = await prisma.aICreditOptimization.findFirst({
      where: {
        tenantId,
      },
      orderBy: {
        analysisDate: "desc",
      },
    });

    if (!optimization) {
      return NextResponse.json(
        { error: "Optimization analysis not found" },
        { status: 404 }
      );
    }

    // Convert optimalPurchaseDate to timing string
    let optimalPurchaseTiming: "NOW" | "LATER" | "NOT_NEEDED" = "NOT_NEEDED";
    if (optimization.optimalPurchaseDate) {
      const daysDiff = Math.ceil(
        (optimization.optimalPurchaseDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      optimalPurchaseTiming = daysDiff <= 1 ? "NOW" : "LATER";
    }

    return NextResponse.json({
      optimization: {
        id: optimization.id,
        predictedUsage: optimization.predictedUsage,
        currentBalance: optimization.currentBalance,
        daysUntilExhaustion: optimization.daysUntilDepletion,
        isWasteDetected: (optimization.wasteReasons as any)?.length > 0 || false,
        wasteAlerts: optimization.wasteReasons as any,
        optimalPurchaseTiming,
        recommendedTopUpAmount: optimization.recommendedPurchaseAmount,
        reasoning: optimization.reasoning,
      },
    });
  } catch (error: any) {
    console.error("Get credit optimization API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
