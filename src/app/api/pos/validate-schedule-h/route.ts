// Validate Schedule H Drug Compliance
// POST /api/pos/validate-schedule-h
// Used by UI to validate Schedule H drugs before checkout

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { validateScheduleHDrugs } from "@/lib/compliance/schedule-h";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { lineItems, prescriptionId, customerId } = body;

    if (!lineItems || !Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json(
        { error: "lineItems array is required" },
        { status: 400 }
      );
    }

    // Get prescription if provided
    let prescription = null;
    if (prescriptionId) {
      prescription = await prisma.prescription.findUnique({
        where: { id: Number(prescriptionId) },
        include: { lines: true },
      });
    }

    // Validate Schedule H compliance
    const validation = await validateScheduleHDrugs({
      lineItems,
      prescriptionId: prescriptionId ? Number(prescriptionId) : undefined,
      prescriptionLines: prescription?.lines.map(line => ({
        drugLibraryId: line.drugLibraryId || undefined,
        productId: line.productId || undefined,
        medicationName: line.medicationName,
        quantity: line.quantity,
      })),
      customerId: customerId ? Number(customerId) : undefined,
    });

    return NextResponse.json({
      isValid: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings,
      requiresPrescription: !validation.isValid && validation.errors.some(e => e.message.includes("prescription")),
    });
  } catch (error: any) {
    console.error("Schedule H validation error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
