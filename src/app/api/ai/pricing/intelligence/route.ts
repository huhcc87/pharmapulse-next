// POST /api/ai/pricing/intelligence
// AI Price Intelligence & Competitor Analysis

import { NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { analyzePriceIntelligence } from "@/lib/ai/price-intelligence";

const DEMO_TENANT_ID = 1;

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const {
      productId,
      drugLibraryId,
      includeCompetitors,
      includeDPCO,
      tenantId = DEMO_TENANT_ID,
    } = body;

    // Validate input
    if (!productId && !drugLibraryId) {
      return NextResponse.json(
        { error: "Either productId or drugLibraryId is required" },
        { status: 400 }
      );
    }

    // Analyze price intelligence
    const result = await analyzePriceIntelligence(
      {
        productId,
        drugLibraryId,
        includeCompetitors,
        includeDPCO,
      },
      tenantId
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("Price intelligence analysis error:", error);
    return NextResponse.json(
      {
        error: "Failed to analyze price intelligence",
        message: error.message,
      },
      { status: 500 }
    );
  }
}
