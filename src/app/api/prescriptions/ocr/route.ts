// Prescription OCR API
// POST /api/prescriptions/ocr
// Upload prescription image and extract drugs using OCR

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { extractPrescriptionText } from "@/lib/ocr/prescription-ocr";
import { prisma } from "@/lib/prisma";

const DEMO_TENANT_ID = 1;

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { imageUrl, imageBase64, provider, customerId, language } = body;

    if (!imageUrl && !imageBase64) {
      return NextResponse.json(
        { error: "imageUrl or imageBase64 is required" },
        { status: 400 }
      );
    }

    // Extract text from image using OCR
    const ocrResult = await extractPrescriptionText({
      imageUrl,
      imageBase64,
      provider,
      language: language || "en",
    });

    if (!ocrResult.success) {
      return NextResponse.json(
        { error: ocrResult.error || "OCR processing failed", errorCode: ocrResult.errorCode },
        { status: 500 }
      );
    }

    // If customerId provided and drugs extracted, auto-create prescription
    if (customerId && ocrResult.extractedDrugs && ocrResult.extractedDrugs.length > 0) {
      try {
        // Match drugs with drug library
        const prescriptionLines = await Promise.all(
          ocrResult.extractedDrugs.map(async (drug) => {
            // Try to find in drug library
            const drugLibrary = await prisma.drugLibrary.findFirst({
              where: {
                brandName: {
                  contains: drug.medicationName.split(" ")[0],
                  mode: "insensitive",
                },
              },
            });

            return {
              drugLibraryId: drugLibrary?.id,
              medicationName: drug.medicationName,
              dosage: drug.dosage,
              frequency: drug.frequency,
              duration: drug.duration,
              quantity: drug.quantity || 1,
            };
          })
        );

        // Create prescription from OCR
        const prescription = await prisma.prescription.create({
          data: {
            tenantId: DEMO_TENANT_ID,
            customerId: Number(customerId),
            doctorName: ocrResult.doctorName,
            doctorLicense: ocrResult.doctorLicense,
            date: ocrResult.date || new Date(),
            status: "PENDING", // Needs verification
            imageUrl: imageUrl || undefined,
            ocrText: ocrResult.text,
            ocrProvider: provider || process.env.OCR_PROVIDER || "google",
            ocrConfidence: ocrResult.confidence ? parseFloat(ocrResult.confidence.toFixed(2)) : null,
            ocrProcessedAt: new Date(),
            isAutoCreated: true,
            lines: {
              create: prescriptionLines,
            },
          },
          include: {
            lines: true,
            customer: true,
          },
        });

        return NextResponse.json({
          success: true,
          ocr: {
            text: ocrResult.text,
            confidence: ocrResult.confidence,
            extractedDrugs: ocrResult.extractedDrugs,
            doctorName: ocrResult.doctorName,
            doctorLicense: ocrResult.doctorLicense,
            date: ocrResult.date,
          },
          prescription: {
            id: prescription.id,
            status: prescription.status,
            doctorName: prescription.doctorName,
            date: prescription.date,
            lines: prescription.lines,
            isAutoCreated: prescription.isAutoCreated,
          },
        });
      } catch (error: any) {
        // If prescription creation fails, still return OCR result
        console.error("Failed to create prescription from OCR:", error);
        return NextResponse.json({
          success: true,
          ocr: {
            text: ocrResult.text,
            confidence: ocrResult.confidence,
            extractedDrugs: ocrResult.extractedDrugs,
            doctorName: ocrResult.doctorName,
            doctorLicense: ocrResult.doctorLicense,
            date: ocrResult.date,
          },
          prescription: null,
          error: "OCR successful but prescription creation failed: " + error.message,
        });
      }
    }

    // Return OCR result only (no prescription creation)
    return NextResponse.json({
      success: true,
      ocr: {
        text: ocrResult.text,
        confidence: ocrResult.confidence,
        extractedDrugs: ocrResult.extractedDrugs,
        doctorName: ocrResult.doctorName,
        doctorLicense: ocrResult.doctorLicense,
        date: ocrResult.date,
      },
      prescription: null,
    });
  } catch (error: any) {
    console.error("Prescription OCR API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
