// POST /api/insurance/upload-card
// Upload insurance card image

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // In production, upload to cloud storage (S3, Cloudinary, etc.)
    // For now, return a mock URL
    const imageUrl = `/uploads/insurance-cards/${Date.now()}-${file.name}`;

    // TODO: OCR extraction of card details
    // Use Tesseract.js or cloud OCR service

    return NextResponse.json({
      success: true,
      imageUrl,
      message: "Card uploaded successfully",
    });
  } catch (error: any) {
    console.error("Insurance card upload error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload card" },
      { status: 500 }
    );
  }
}
