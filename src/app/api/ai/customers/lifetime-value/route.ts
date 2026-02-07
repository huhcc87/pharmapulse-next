// POST /api/ai/customers/lifetime-value
// AI Customer Lifetime Value Prediction

import { NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { predictCustomerLTV } from "@/lib/ai/customer-lifetime-value";

const DEMO_TENANT_ID = 1;

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const {
      customerId,
      includeChurnPrediction,
      includeRecommendations,
      tenantId = DEMO_TENANT_ID,
    } = body;

    // Validate input
    if (!customerId) {
      return NextResponse.json(
        { error: "customerId is required" },
        { status: 400 }
      );
    }

    // Predict customer LTV
    const result = await predictCustomerLTV(
      {
        customerId,
        includeChurnPrediction,
        includeRecommendations,
      },
      tenantId
    );

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("Customer LTV prediction error:", error);
    return NextResponse.json(
      {
        error: "Failed to predict customer lifetime value",
        message: error.message,
      },
      { status: 500 }
    );
  }
}
