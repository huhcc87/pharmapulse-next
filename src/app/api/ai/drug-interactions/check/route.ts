// POST /api/ai/drug-interactions/check
// Advanced drug interaction checking with patient-specific risk assessment

import { NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import {
  checkAdvancedDrugInteractions,
  getInteractionHistory,
} from "@/lib/ai/drug-interactions-advanced";

const DEMO_TENANT_ID = 1;

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const {
      drugs,
      patientInfo,
      context,
      tenantId = DEMO_TENANT_ID,
    } = body;

    // Validate input
    if (!drugs || !Array.isArray(drugs) || drugs.length < 2) {
      return NextResponse.json(
        { error: "At least 2 drugs are required" },
        { status: 400 }
      );
    }

    // Validate drug structure
    for (const drug of drugs) {
      if (!drug.name || typeof drug.name !== "string") {
        return NextResponse.json(
          { error: "Each drug must have a 'name' field" },
          { status: 400 }
        );
      }
    }

    // Check for advanced drug interactions
    const interactions = await checkAdvancedDrugInteractions(
      {
        drugs,
        patientInfo,
        context,
      },
      tenantId
    );

    // Determine if pharmacist acknowledgment required
    const requiresAcknowledgment = interactions.some(
      (i) => i.severity === "CONTRAINDICATED" || i.severity === "SEVERE"
    );

    // Get highest risk interaction
    const highestRisk = interactions.length > 0 ? interactions[0] : null;

    return NextResponse.json({
      success: true,
      interactions,
      requiresAcknowledgment,
      highestRisk,
      totalInteractions: interactions.length,
      summary: {
        contraindicated: interactions.filter((i) => i.severity === "CONTRAINDICATED").length,
        severe: interactions.filter((i) => i.severity === "SEVERE").length,
        moderate: interactions.filter((i) => i.severity === "MODERATE").length,
        mild: interactions.filter((i) => i.severity === "MILD").length,
      },
    });
  } catch (error: any) {
    console.error("Advanced drug interaction check error:", error);
    return NextResponse.json(
      {
        error: "Failed to check drug interactions",
        message: error.message,
      },
      { status: 500 }
    );
  }
}

// GET /api/ai/drug-interactions/check
// Get interaction history
export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get("patientId");
    const tenantId = Number(searchParams.get("tenantId")) || DEMO_TENANT_ID;
    const limit = Number(searchParams.get("limit")) || 50;

    if (!patientId) {
      return NextResponse.json(
        { error: "patientId is required" },
        { status: 400 }
      );
    }

    const history = await getInteractionHistory(
      Number(patientId),
      tenantId,
      limit
    );

    return NextResponse.json({
      success: true,
      history,
      count: history.length,
    });
  } catch (error: any) {
    console.error("Get interaction history error:", error);
    return NextResponse.json(
      {
        error: "Failed to get interaction history",
        message: error.message,
      },
      { status: 500 }
    );
  }
}
