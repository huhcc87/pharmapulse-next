// POST /api/rx/parse
// Parse prescription image/PDF using OCR

import { NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { MockOCRProvider, parsePrescriptionText } from "@/lib/ocr/mock-provider";

// In production, switch to actual OCR provider:
// import { TesseractOCRProvider } from "@/lib/ocr/tesseract-provider";
// const ocrProvider = new TesseractOCRProvider();

const ocrProvider = new MockOCRProvider();

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const mimeType = file.type;
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
    if (!allowedTypes.includes(mimeType)) {
      return NextResponse.json(
        { error: "Invalid file type. Supported: JPEG, PNG, PDF" },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size: 10MB" },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Run OCR
    let ocrResult;
    if (mimeType === "application/pdf") {
      ocrResult = await ocrProvider.parsePDF(buffer);
    } else {
      ocrResult = await ocrProvider.parseImage(buffer, mimeType);
    }

    // Parse prescription text
    const parsed = parsePrescriptionText(ocrResult);

    // Check confidence - if low, flag for manual review
    const needsReview = parsed.confidence < 0.6 || parsed.lines.some((l) => l.confidence < 0.5);

    return NextResponse.json({
      parsed,
      needsReview,
      ocrResult: {
        text: ocrResult.text,
        confidence: ocrResult.confidence,
      },
    });
  } catch (error: any) {
    console.error("Rx OCR parse error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to parse prescription" },
      { status: 500 }
    );
  }
}
