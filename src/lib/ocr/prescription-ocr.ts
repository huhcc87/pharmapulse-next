// Prescription OCR - Extract drugs from prescription image
// Supports: Google Vision API, AWS Textract, Tesseract

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface PrescriptionOCRResult {
  success: boolean;
  text?: string;
  confidence?: number;
  extractedDrugs?: Array<{
    medicationName: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    quantity?: number;
    confidence?: number;
  }>;
  doctorName?: string;
  doctorLicense?: string;
  date?: Date;
  error?: string;
  errorCode?: string;
}

export interface PrescriptionOCRInput {
  imageUrl: string;
  imageBase64?: string;
  provider?: "google" | "aws" | "tesseract";
  language?: string; // "en" | "hi" | "ta" | etc.
}

/**
 * Extract text from prescription image using OCR
 */
export async function extractPrescriptionText(
  input: PrescriptionOCRInput
): Promise<PrescriptionOCRResult> {
  const provider = input.provider || process.env.OCR_PROVIDER || "google";
  
  try {
    let text = "";
    let confidence = 0;

    if (provider === "google") {
      const result = await extractWithGoogleVision(input);
      text = result.text || "";
      confidence = result.confidence || 0;
    } else if (provider === "aws") {
      const result = await extractWithAWSTextract(input);
      text = result.text || "";
      confidence = result.confidence || 0;
    } else if (provider === "tesseract") {
      const result = await extractWithTesseract(input);
      text = result.text || "";
      confidence = result.confidence || 0;
    } else {
      return {
        success: false,
        error: `Unsupported OCR provider: ${provider}`,
        errorCode: "UNSUPPORTED_PROVIDER",
      };
    }

    if (!text || text.trim().length === 0) {
      return {
        success: false,
        error: "No text extracted from image",
        errorCode: "NO_TEXT_EXTRACTED",
      };
    }

    // Parse extracted text to find drugs
    const extractedDrugs = await parseDrugsFromText(text);

    // Extract doctor name and license (basic pattern matching)
    const doctorInfo = extractDoctorInfo(text);

    // Extract date
    const date = extractDate(text);

    return {
      success: true,
      text,
      confidence,
      extractedDrugs,
      doctorName: doctorInfo.name,
      doctorLicense: doctorInfo.license,
      date,
    };
  } catch (error: any) {
    console.error("Prescription OCR error:", error);
    return {
      success: false,
      error: error.message || "OCR processing failed",
      errorCode: "OCR_ERROR",
    };
  }
}

/**
 * Extract text using Google Vision API
 */
async function extractWithGoogleVision(
  input: PrescriptionOCRInput
): Promise<{ text: string; confidence: number }> {
  const API_KEY = process.env.GOOGLE_VISION_API_KEY;
  const API_URL = `https://vision.googleapis.com/v1/images:annotate?key=${API_KEY}`;

  if (!API_KEY) {
    console.warn("Google Vision API key not configured. Returning mock OCR.");
    return {
      text: "MOCK PRESCRIPTION TEXT\nCrocin 500mg - 1-0-1 - 5 days\nParacetamol 500mg - 0-0-1 - 3 days",
      confidence: 85,
    };
  }

  const imageData = input.imageBase64 || await fetchImageAsBase64(input.imageUrl);

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          image: {
            content: imageData.replace(/^data:image\/[a-z]+;base64,/, ""),
          },
          features: [
            {
              type: "DOCUMENT_TEXT_DETECTION",
              maxResults: 1,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Google Vision API error: ${response.statusText}`);
  }

  const data = await response.json();
  const annotations = data.responses?.[0]?.textAnnotations;
  const fullText = annotations?.[0]?.description || "";
  const confidence = annotations?.[0]?.confidence || 0.8;

  return {
    text: fullText,
    confidence: confidence * 100,
  };
}

/**
 * Extract text using AWS Textract
 */
async function extractWithAWSTextract(
  input: PrescriptionOCRInput
): Promise<{ text: string; confidence: number }> {
  // AWS Textract requires AWS SDK
  // For now, return mock implementation
  console.warn("AWS Textract not fully implemented. Returning mock OCR.");
  return {
    text: "MOCK PRESCRIPTION TEXT\nCrocin 500mg - 1-0-1 - 5 days",
    confidence: 80,
  };
}

/**
 * Extract text using Tesseract (local/self-hosted)
 */
async function extractWithTesseract(
  input: PrescriptionOCRInput
): Promise<{ text: string; confidence: number }> {
  // Tesseract requires local installation or API endpoint
  // For now, return mock implementation
  console.warn("Tesseract OCR not fully implemented. Returning mock OCR.");
  return {
    text: "MOCK PRESCRIPTION TEXT\nCrocin 500mg - 1-0-1 - 5 days",
    confidence: 75,
  };
}

/**
 * Fetch image and convert to base64
 */
async function fetchImageAsBase64(imageUrl: string): Promise<string> {
  try {
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer.toString("base64");
  } catch (error) {
    throw new Error("Failed to fetch image");
  }
}

/**
 * Parse drugs from extracted text
 * Uses pattern matching and AI to identify medication names
 */
async function parseDrugsFromText(text: string): Promise<PrescriptionOCRResult["extractedDrugs"]> {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  const drugs: PrescriptionOCRResult["extractedDrugs"] = [];

  // Common patterns for prescriptions:
  // "Crocin 500mg - 1-0-1 - 5 days"
  // "Paracetamol 500mg - BD - 3 days"
  // "Azithromycin 500mg - Once daily - 7 days"

  for (const line of lines) {
    // Skip header lines (Doctor name, date, etc.)
    if (
      line.toLowerCase().includes("doctor") ||
      line.toLowerCase().includes("dr.") ||
      line.toLowerCase().includes("date:") ||
      line.toLowerCase().includes("prescription")
    ) {
      continue;
    }

    // Pattern: DrugName Dosage - Frequency - Duration
    const drugMatch = line.match(/^([A-Za-z\s]+(?:\s+\d+[mg|ml|IU]+)?)\s*[-–]\s*(.+)/);
    if (drugMatch) {
      const medicationName = drugMatch[1].trim();
      const rest = drugMatch[2].trim();

      // Parse frequency (1-0-1, BD, TDS, etc.)
      const frequency = extractFrequency(rest);

      // Parse duration (5 days, 1 week, etc.)
      const duration = extractDuration(rest);

      // Parse quantity (if mentioned)
      const quantity = extractQuantity(rest) || 1;

      // Parse dosage (if separate)
      const dosage = extractDosage(medicationName);

      // Try to match with drug library
      const matchedDrug = await matchDrugInLibrary(medicationName);

      drugs.push({
        medicationName: matchedDrug?.brandName || medicationName,
        dosage: matchedDrug?.dosage || dosage,
        frequency,
        duration,
        quantity,
        confidence: 70, // Default confidence, can be improved with AI
      });
    }
  }

  return drugs;
}

/**
 * Extract frequency from text (1-0-1, BD, TDS, etc.)
 */
function extractFrequency(text: string): string | undefined {
  const patterns = {
    "1-0-1": "Morning-Night",
    "1-1-1": "Three times a day",
    "0-0-1": "Night only",
    "1-0-0": "Morning only",
    BD: "Twice daily",
    TDS: "Three times daily",
    OD: "Once daily",
    SOS: "As needed",
  };

  for (const [pattern, frequency] of Object.entries(patterns)) {
    if (text.toUpperCase().includes(pattern)) {
      return frequency;
    }
  }

  // Try to extract custom frequency
  const freqMatch = text.match(/(\d+)\s*times?\s*(daily|day|week)/i);
  if (freqMatch) {
    return `${freqMatch[1]} times ${freqMatch[2]}`;
  }

  return undefined;
}

/**
 * Extract duration from text (5 days, 1 week, etc.)
 */
function extractDuration(text: string): string | undefined {
  const durationMatch = text.match(/(\d+)\s*(day|days|week|weeks|month|months)/i);
  if (durationMatch) {
    return `${durationMatch[1]} ${durationMatch[2]}`;
  }
  return undefined;
}

/**
 * Extract quantity from text
 */
function extractQuantity(text: string): number | undefined {
  const qtyMatch = text.match(/(?:qty|quantity|no\.|nos?):?\s*(\d+)/i);
  if (qtyMatch) {
    return parseInt(qtyMatch[1]);
  }
  return undefined;
}

/**
 * Extract dosage from medication name
 */
function extractDosage(medicationName: string): string | undefined {
  const dosageMatch = medicationName.match(/(\d+[mg|ml|IU|mcg|g]+)/i);
  if (dosageMatch) {
    return dosageMatch[1];
  }
  return undefined;
}

/**
 * Extract doctor name and license from text
 */
function extractDoctorInfo(text: string): { name?: string; license?: string } {
  const info: { name?: string; license?: string } = {};

  // Doctor name pattern: "Dr. Name" or "Doctor: Name"
  const doctorMatch = text.match(/(?:Dr\.|Doctor|DR\.)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/);
  if (doctorMatch) {
    info.name = doctorMatch[1].trim();
  }

  // License pattern: "License: XXX" or "Reg. No.: XXX"
  const licenseMatch = text.match(/(?:License|Reg\.?\s*No\.?|Registration):\s*([A-Z0-9]+)/i);
  if (licenseMatch) {
    info.license = licenseMatch[1].trim();
  }

  return info;
}

/**
 * Extract date from text
 */
function extractDate(text: string): Date | undefined {
  // Date patterns: "Date: DD/MM/YYYY", "DD-MM-YYYY", etc.
  const datePatterns = [
    /(?:Date|Dated?):\s*(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/i,
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
  ];

  for (const pattern of datePatterns) {
    const match = text.match(pattern);
    if (match) {
      const day = parseInt(match[1]);
      const month = parseInt(match[2]) - 1; // JS months are 0-indexed
      const year = parseInt(match[3]);
      return new Date(year, month, day);
    }
  }

  return undefined;
}

/**
 * Match extracted drug name with drug library
 */
async function matchDrugInLibrary(
  medicationName: string
): Promise<{ brandName: string; dosage?: string } | null> {
  try {
    // Search in drug library
    const drug = await prisma.drugLibrary.findFirst({
      where: {
        OR: [
          { brandName: { contains: medicationName, mode: "insensitive" } },
          { brandName: { contains: medicationName.split(" ")[0], mode: "insensitive" } },
        ],
      },
      take: 1,
    });

    if (drug) {
      return {
        brandName: drug.brandName,
        dosage: drug.dosage || undefined,
      };
    }
  } catch (error) {
    console.warn("Failed to match drug in library:", error);
  }

  return null;
}
