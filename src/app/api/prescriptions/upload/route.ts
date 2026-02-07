// Prescription Image Upload API
// POST /api/prescriptions/upload
// Upload prescription image to storage (S3, Cloudinary, or local)

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type (images only)
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File must be an image" },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File size must be less than 10MB" },
        { status: 400 }
      );
    }

    // Convert file to base64 for storage/processing
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    // TODO: Upload to cloud storage (S3, Cloudinary, etc.)
    // For now, return base64 data URL
    // In production, upload to S3/Cloudinary and return public URL

    const STORAGE_PROVIDER = process.env.STORAGE_PROVIDER || "local";

    let imageUrl: string;

    if (STORAGE_PROVIDER === "s3") {
      // TODO: Upload to S3
      // imageUrl = await uploadToS3(file, buffer);
      imageUrl = dataUrl; // Placeholder
    } else if (STORAGE_PROVIDER === "cloudinary") {
      // TODO: Upload to Cloudinary
      // imageUrl = await uploadToCloudinary(file, buffer);
      imageUrl = dataUrl; // Placeholder
    } else {
      // Local storage or return base64
      // For now, return base64 (can be stored in database or processed directly)
      imageUrl = dataUrl;
    }

    return NextResponse.json({
      success: true,
      imageUrl,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });
  } catch (error: any) {
    console.error("Prescription upload API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
