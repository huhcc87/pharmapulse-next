// AI Prescription Validity Checker API
// POST /api/ai/prescription/validate

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { validatePrescription } from "@/lib/ai/prescription-validity";
import { prisma } from "@/lib/prisma";

const DEMO_TENANT_ID = 1;

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { prescriptionId } = body;

    if (!prescriptionId) {
      return NextResponse.json(
        { error: "prescriptionId is required" },
        { status: 400 }
      );
    }

    // Validate prescription
    const validation = await validatePrescription(
      parseInt(prescriptionId),
      DEMO_TENANT_ID
    );

    // Save validation result to database
    const savedValidation = await prisma.aIPrescriptionValidation.create({
      data: {
        tenantId: DEMO_TENANT_ID,
        prescriptionId: parseInt(prescriptionId),
        validationDate: new Date(),
        authenticityScore: validation.authenticityScore,
        authenticityReasons: validation.authenticityReasons
          ? JSON.parse(JSON.stringify(validation.authenticityReasons))
          : null,
        doctorName: validation.doctorName || null,
        doctorLicenseNumber: validation.doctorLicenseNumber || null,
        doctorVerified: validation.doctorVerified,
        doctorVerificationSource: validation.doctorVerificationSource || null,
        prescriptionAge: validation.prescriptionAge || null,
        isExpired: validation.isExpired,
        expiryReason: validation.expiryReason || null,
        handwritingConsistency: validation.handwritingConsistency || null,
        signatureMatch: validation.signatureMatch || null,
        hasStamp: validation.hasStamp || null,
        hasSeal: validation.hasSeal || null,
        stampQuality: validation.stampQuality || null,
        duplicatePrescriptionIds: validation.duplicatePrescriptionIds
          ? JSON.parse(JSON.stringify(validation.duplicatePrescriptionIds))
          : null,
        duplicateScore: validation.duplicateScore || null,
        isValid: validation.isValid,
        riskLevel: validation.riskLevel,
        validationReason: validation.validationReason || null,
        requiresReview: validation.requiresReview,
      },
    });

    return NextResponse.json({
      success: true,
      validation: {
        id: savedValidation.id,
        authenticityScore: validation.authenticityScore,
        doctorVerified: validation.doctorVerified,
        doctorVerificationSource: validation.doctorVerificationSource,
        prescriptionAge: validation.prescriptionAge,
        isExpired: validation.isExpired,
        isValid: validation.isValid,
        riskLevel: validation.riskLevel,
        requiresReview: validation.requiresReview,
        validationReason: validation.validationReason,
        authenticityReasons: validation.authenticityReasons,
        duplicatePrescriptionIds: validation.duplicatePrescriptionIds,
      },
    });
  } catch (error: any) {
    console.error("AI prescription validation API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/ai/prescription/validate - Get validation history
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const searchParams = req.nextUrl.searchParams;
    const prescriptionId = searchParams.get("prescriptionId");
    const riskLevel = searchParams.get("riskLevel");

    const where: any = {
      tenantId: DEMO_TENANT_ID,
    };

    if (prescriptionId) {
      where.prescriptionId = parseInt(prescriptionId);
    }

    if (riskLevel) {
      where.riskLevel = riskLevel;
    }

    const validations = await prisma.aIPrescriptionValidation.findMany({
      where,
      include: {
        prescription: {
          select: {
            id: true,
            doctorName: true,
            date: true,
          },
        },
      },
      orderBy: {
        validationDate: "desc",
      },
      take: 100,
    });

    return NextResponse.json({
      validations: validations.map((v) => ({
        id: v.id,
        prescription: v.prescription,
        authenticityScore: v.authenticityScore,
        doctorVerified: v.doctorVerified,
        prescriptionAge: v.prescriptionAge,
        isExpired: v.isExpired,
        isValid: v.isValid,
        riskLevel: v.riskLevel,
        requiresReview: v.requiresReview,
        validationDate: v.validationDate,
      })),
    });
  } catch (error: any) {
    console.error("Get prescription validations API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
