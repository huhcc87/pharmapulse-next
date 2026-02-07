// AI Cost Optimization & Forecasting API
// POST /api/billing/ai/cost-forecast

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { generateCostForecast } from "@/lib/ai/cost-optimization";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { forecastPeriod } = body;

    const tenantId = user.tenantId || "default";

    // Generate forecast
    const forecast = await generateCostForecast(
      tenantId,
      forecastPeriod || "MONTHLY"
    );

    // Save forecast
    const savedForecast = await prisma.aICostForecast.create({
      data: {
        tenantId,
        forecastDate: new Date(),
        forecastPeriod: forecastPeriod || "MONTHLY",
        predictedCostPaise: forecast.predictedCostPaise,
        currentCostPaise: forecast.currentCostPaise,
        previousCostPaise: forecast.previousCostPaise || null,
        subscriptionCostPaise: forecast.subscriptionCostPaise,
        creditsCostPaise: forecast.creditsCostPaise,
        addonsCostPaise: forecast.addonsCostPaise,
        isAnomaly: forecast.isAnomaly,
        anomalyReason: forecast.anomalyReason || null,
        budgetLimitPaise: forecast.budgetLimitPaise || null,
        budgetAlertLevel: forecast.budgetAlertLevel || null,
        optimizationSuggestions: forecast.optimizationSuggestions
          ? JSON.parse(JSON.stringify(forecast.optimizationSuggestions))
          : null,
        potentialSavingsPaise: forecast.potentialSavingsPaise || null,
        confidenceScore: forecast.confidenceScore,
        reasoning: forecast.reasoning || null,
      },
    });

    return NextResponse.json({
      success: true,
      forecast: {
        id: savedForecast.id,
        predictedCostPaise: forecast.predictedCostPaise,
        currentCostPaise: forecast.currentCostPaise,
        previousCostPaise: forecast.previousCostPaise,
        subscriptionCostPaise: forecast.subscriptionCostPaise,
        creditsCostPaise: forecast.creditsCostPaise,
        addonsCostPaise: forecast.addonsCostPaise,
        isAnomaly: forecast.isAnomaly,
        anomalyReason: forecast.anomalyReason,
        budgetLimitPaise: forecast.budgetLimitPaise,
        budgetAlertLevel: forecast.budgetAlertLevel,
        optimizationSuggestions: forecast.optimizationSuggestions,
        potentialSavingsPaise: forecast.potentialSavingsPaise,
        confidenceScore: forecast.confidenceScore,
        reasoning: forecast.reasoning,
      },
    });
  } catch (error: any) {
    console.error("Cost forecast API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/billing/ai/cost-forecast - Get forecast history
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = user.tenantId || "default";
    const searchParams = req.nextUrl.searchParams;
    const forecastPeriod = searchParams.get("forecastPeriod");
    const limit = parseInt(searchParams.get("limit") || "10");

    const where: any = { tenantId };
    if (forecastPeriod) {
      where.forecastPeriod = forecastPeriod;
    }

    const forecasts = await prisma.aICostForecast.findMany({
      where,
      orderBy: {
        forecastDate: "desc",
      },
      take: limit,
    });

    return NextResponse.json({
      forecasts: forecasts.map((f) => ({
        id: f.id,
        forecastDate: f.forecastDate,
        forecastPeriod: f.forecastPeriod,
        predictedCostPaise: f.predictedCostPaise,
        currentCostPaise: f.currentCostPaise,
        isAnomaly: f.isAnomaly,
        budgetAlertLevel: f.budgetAlertLevel,
        confidenceScore: f.confidenceScore,
      })),
    });
  } catch (error: any) {
    console.error("Get cost forecasts API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
