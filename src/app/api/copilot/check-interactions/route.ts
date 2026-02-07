// POST /api/copilot/check-interactions
// Check drug interactions and generate counseling points

import { NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { checkInteractions, getDuplicateTherapyWarnings } from "@/lib/copilot/interactions";
import { generateCounselingPoints } from "@/lib/copilot/counseling";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const {
      drugNames,
      patientAge,
      allergies,
      useAI = false, // Default to rules-only for cost/performance
    } = body;

    if (!drugNames || !Array.isArray(drugNames) || drugNames.length === 0) {
      return NextResponse.json(
        { error: "drugNames array is required" },
        { status: 400 }
      );
    }

    // Check interactions
    const interactions = await checkInteractions(drugNames, {
      useAI,
      patientAge,
      allergies,
    });

    // Check duplicate therapy
    const duplicates = getDuplicateTherapyWarnings(drugNames);

    // Generate counseling points for each drug
    const counselingPoints = await Promise.all(
      drugNames.map(async (drug: string) => {
        const points = await generateCounselingPoints(drug, undefined, undefined, {
          useAI,
        });
        return {
          drug,
          ...points,
        };
      })
    );

    // Determine if pharmacist acknowledgment required
    const requiresAcknowledgment = interactions.some(
      (i) => i.severity === "HIGH"
    );

    return NextResponse.json({
      interactions,
      duplicates,
      counselingPoints,
      requiresAcknowledgment,
      summary: {
        totalInteractions: interactions.length,
        highSeverity: interactions.filter((i) => i.severity === "HIGH").length,
        mediumSeverity: interactions.filter((i) => i.severity === "MEDIUM").length,
        lowSeverity: interactions.filter((i) => i.severity === "LOW").length,
        duplicates: duplicates.length,
      },
    });
  } catch (error: any) {
    console.error("Check interactions error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check interactions" },
      { status: 500 }
    );
  }
}
