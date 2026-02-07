// Complete Consultation API
// POST /api/telemedicine/consultations/[id]/complete - Complete consultation and generate e-prescription

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { completeConsultation } from "@/lib/telemedicine/consultation-manager";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const resolvedParams = await params;
    const consultationId = parseInt(resolvedParams.id);

    const body = await req.json();
    const { diagnosis, prescriptionLines } = body;

    if (!diagnosis) {
      return NextResponse.json(
        { error: "diagnosis is required" },
        { status: 400 }
      );
    }

    if (!prescriptionLines || !Array.isArray(prescriptionLines) || prescriptionLines.length === 0) {
      return NextResponse.json(
        { error: "prescriptionLines array is required" },
        { status: 400 }
      );
    }

    const result = await completeConsultation(
      consultationId,
      diagnosis,
      prescriptionLines,
      user.tenantId || 1
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Consultation completion failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      prescriptionId: result.prescriptionId,
      message: "Consultation completed and e-prescription generated",
    });
  } catch (error: any) {
    console.error("Complete consultation API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
