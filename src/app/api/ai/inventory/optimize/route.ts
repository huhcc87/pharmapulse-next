// AI Inventory Optimization API
// POST /api/ai/inventory/optimize

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { analyzeInventoryOptimization } from "@/lib/ai/inventory-optimization";
import { prisma } from "@/lib/prisma";

const DEMO_TENANT_ID = 1;

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { productId, drugLibraryId, analysisTypes } = body;

    // Analyze inventory
    const analyses = await analyzeInventoryOptimization(
      productId ? parseInt(productId) : undefined,
      drugLibraryId ? parseInt(drugLibraryId) : undefined,
      DEMO_TENANT_ID
    );

    // Filter by requested analysis types if provided
    const filteredAnalyses = analysisTypes && Array.isArray(analysisTypes)
      ? analyses.filter((a) => analysisTypes.includes(a.analysisType))
      : analyses;

    // Save analyses to database
    for (const analysis of filteredAnalyses) {
      await prisma.aIInventoryAnalysis.create({
        data: {
          tenantId: DEMO_TENANT_ID,
          productId: analysis.productId || null,
          drugLibraryId: analysis.drugLibraryId || null,
          analysisDate: new Date(),
          analysisType: analysis.analysisType,
          suggestedReorderQty: analysis.suggestedReorderQty || null,
          reorderPoint: analysis.reorderPoint || null,
          safetyStock: analysis.safetyStock || null,
          leadTimeDays: analysis.leadTimeDays || null,
          deadstockRiskScore: analysis.deadstockRiskScore || null,
          daysToDeadstock: analysis.daysToDeadstock || null,
          predictedSaleDate: analysis.predictedSaleDate || null,
          expiryRiskScore: analysis.expiryRiskScore || null,
          daysToExpiry: analysis.daysToExpiry || null,
          recommendedDiscount: analysis.recommendedDiscount || null,
          suggestedBundleIds: analysis.suggestedBundleIds
            ? JSON.parse(JSON.stringify(analysis.suggestedBundleIds))
            : null,
          bundleScore: analysis.bundleScore || null,
          recommendedPricePaise: analysis.recommendedPricePaise || null,
          priceChangePercent: analysis.priceChangePercent || null,
          pricingReason: analysis.pricingReason || null,
          confidenceScore: analysis.confidenceScore || null,
          reasoning: analysis.reasoning || null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      analyses: filteredAnalyses,
    });
  } catch (error: any) {
    console.error("AI inventory optimization API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/ai/inventory/optimize - Get latest analyses
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const searchParams = req.nextUrl.searchParams;
    const productId = searchParams.get("productId");
    const drugLibraryId = searchParams.get("drugLibraryId");
    const analysisType = searchParams.get("analysisType");

    const where: any = {
      tenantId: DEMO_TENANT_ID,
    };

    if (productId) {
      where.productId = parseInt(productId);
    }

    if (drugLibraryId) {
      where.drugLibraryId = parseInt(drugLibraryId);
    }

    if (analysisType) {
      where.analysisType = analysisType;
    }

    const analyses = await prisma.aIInventoryAnalysis.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
      orderBy: {
        analysisDate: "desc",
      },
      take: 100,
    });

    return NextResponse.json({
      analyses: analyses.map((a) => ({
        id: a.id,
        product: a.product,
        analysisType: a.analysisType,
        analysisDate: a.analysisDate,
        suggestedReorderQty: a.suggestedReorderQty,
        reorderPoint: a.reorderPoint,
        deadstockRiskScore: a.deadstockRiskScore,
        expiryRiskScore: a.expiryRiskScore,
        recommendedDiscount: a.recommendedDiscount,
        confidenceScore: a.confidenceScore,
        reasoning: a.reasoning,
      })),
    });
  } catch (error: any) {
    console.error("Get AI inventory analyses API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
