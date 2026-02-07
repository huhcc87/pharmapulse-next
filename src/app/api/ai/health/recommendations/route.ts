// AI Customer Health Advisor API
// GET /api/ai/health/recommendations?customerId=123
// POST /api/ai/health/symptoms - Analyze symptoms

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { generateHealthRecommendations, analyzeSymptoms } from "@/lib/ai/customer-health-advisor";

const DEMO_TENANT_ID = 1;

// GET /api/ai/health/recommendations - Get personalized health recommendations
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const searchParams = req.nextUrl.searchParams;
    const customerId = searchParams.get("customerId");

    if (!customerId) {
      return NextResponse.json(
        { error: "customerId is required" },
        { status: 400 }
      );
    }

    const recommendations = await generateHealthRecommendations(
      parseInt(customerId),
      DEMO_TENANT_ID
    );

    return NextResponse.json({
      success: true,
      recommendations,
    });
  } catch (error: any) {
    console.error("Health recommendations API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/ai/health/symptoms - Analyze symptoms
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    const body = await req.json();
    const { symptoms, customerId, patientAge } = body;

    if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
      return NextResponse.json(
        { error: "symptoms array is required" },
        { status: 400 }
      );
    }

    // Analyze symptoms
    const analysis = await analyzeSymptoms(symptoms, patientAge);

    return NextResponse.json({
      success: true,
      analysis,
    });
  } catch (error: any) {
    console.error("Symptom analysis API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
