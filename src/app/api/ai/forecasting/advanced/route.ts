// POST /api/ai/forecasting/advanced
// AI Demand Forecasting (Advanced)

import { NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { generateAdvancedDemandForecast } from "@/lib/ai/demand-forecasting-advanced";

const DEMO_TENANT_ID = 1;

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const {
      productId,
      drugLibraryId,
      forecastType,
      horizonDays,
      region,
      includeSeasonality,
      includeEvents,
      includeWeather,
      tenantId = DEMO_TENANT_ID,
    } = body;

    // Validate input
    if (!productId && !drugLibraryId) {
      return NextResponse.json(
        { error: "Either productId or drugLibraryId is required" },
        { status: 400 }
      );
    }

    // Generate advanced forecast
    const forecast = await generateAdvancedDemandForecast(
      {
        productId,
        drugLibraryId,
        forecastType,
        horizonDays,
        region,
        includeSeasonality,
        includeEvents,
        includeWeather,
      },
      tenantId
    );

    return NextResponse.json({
      success: true,
      forecast,
    });
  } catch (error: any) {
    console.error("Advanced demand forecasting error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate forecast",
        message: error.message,
      },
      { status: 500 }
    );
  }
}
