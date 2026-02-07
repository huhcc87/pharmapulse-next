// POST /api/ai/prescription/autofill
// AI Prescription Auto-Fill & Verification

import { NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { autofillPrescription } from "@/lib/ai/prescription-autofill";

const DEMO_TENANT_ID = 1;

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const {
      imageUrl,
      imageBase64,
      ocrProvider,
      language,
      customerId,
      prescriptionId,
      tenantId = DEMO_TENANT_ID,
    } = body;

    // Validate input
    if (!imageUrl && !imageBase64) {
      return NextResponse.json(
        { error: "Either imageUrl or imageBase64 is required" },
        { status: 400 }
      );
    }

    // Auto-fill prescription
    const result = await autofillPrescription(
      {
        imageUrl,
        imageBase64,
        ocrProvider,
        language,
        customerId,
        prescriptionId,
      },
      tenantId
    );

    return NextResponse.json({
      ...result,
    });
  } catch (error: any) {
    console.error("Prescription autofill error:", error);
    return NextResponse.json(
      {
        error: "Failed to autofill prescription",
        message: error.message,
      },
      { status: 500 }
    );
  }
}
