// AI Prescription Auto-Fill & Verification
// Enhanced prescription processing with auto-fill and verification

import { prisma } from "@/lib/prisma";
import { extractPrescriptionText, PrescriptionOCRResult } from "@/lib/ocr/prescription-ocr";

export interface PrescriptionAutofillRequest {
  imageUrl?: string;
  imageBase64?: string;
  ocrProvider?: "google" | "aws" | "tesseract";
  language?: string;
  customerId?: number;
  prescriptionId?: number;
}

export interface AutofilledDrug {
  extractedName: string;
  matchedDrugId?: number;
  matchedDrugName?: string;
  matchedDrugType?: "PRODUCT" | "DRUG_LIBRARY";
  dosage?: string;
  frequency?: string;
  duration?: string;
  quantity?: number;
  confidence: number;
  matchConfidence: number; // How confident we are in the match
  genericAlternatives?: Array<{
    id: number;
    name: string;
    type: "PRODUCT" | "DRUG_LIBRARY";
    priceDifference?: number; // Savings in percentage
  }>;
  dosageWarning?: {
    level: "INFO" | "WARNING" | "ERROR";
    message: string;
    standardDosage?: string;
  };
  isUnusualDosage?: boolean;
}

export interface PrescriptionAutofillResult {
  success: boolean;
  status: "COMPLETED" | "PARTIAL" | "FAILED";
  confidence: number;
  extractedDrugs: AutofilledDrug[];
  unmatchedDrugs: Array<{
    name: string;
    extractedText: string;
    suggestions?: string[];
  }>;
  doctorInfo?: {
    name?: string;
    license?: string;
    verified: boolean;
  };
  completenessScore: number;
  missingFields: string[];
  requiresReview: boolean;
  reviewReason?: string;
  genericSuggestions: Array<{
    originalDrug: string;
    alternatives: Array<{
      id: number;
      name: string;
      type: "PRODUCT" | "DRUG_LIBRARY";
      savings?: number;
    }>;
  }>;
  dosageWarnings: Array<{
    drug: string;
    level: "INFO" | "WARNING" | "ERROR";
    message: string;
  }>;
  autofillId?: number;
}

/**
 * Auto-fill prescription from image with drug library matching and verification
 */
export async function autofillPrescription(
  request: PrescriptionAutofillRequest,
  tenantId: number = 1
): Promise<PrescriptionAutofillResult> {
  const startTime = Date.now();

  try {
    // Step 1: Extract text from prescription image
    if (!request.imageUrl && !request.imageBase64) {
      return {
        success: false,
        status: "FAILED",
        confidence: 0,
        extractedDrugs: [],
        unmatchedDrugs: [],
        completenessScore: 0,
        missingFields: ["Prescription image"],
        requiresReview: true,
        reviewReason: "No image provided",
        genericSuggestions: [],
        dosageWarnings: [],
      };
    }

    const ocrResult = await extractPrescriptionText({
      imageUrl: request.imageUrl,
      imageBase64: request.imageBase64,
      provider: request.ocrProvider,
      language: request.language,
    });

    if (!ocrResult.success || !ocrResult.extractedDrugs) {
      return {
        success: false,
        status: "FAILED",
        confidence: ocrResult.confidence || 0,
        extractedDrugs: [],
        unmatchedDrugs: [],
        completenessScore: 0,
        missingFields: ["Drug extraction failed"],
        requiresReview: true,
        reviewReason: ocrResult.error || "OCR extraction failed",
        genericSuggestions: [],
        dosageWarnings: [],
      };
    }

    // Step 2: Match extracted drugs with drug library
    const autofilledDrugs: AutofilledDrug[] = [];
    const unmatchedDrugs: Array<{
      name: string;
      extractedText: string;
      suggestions?: string[];
    }> = [];

    for (const extractedDrug of ocrResult.extractedDrugs) {
      const matchResult = await matchDrugWithLibrary(
        extractedDrug.medicationName,
        tenantId
      );

      if (matchResult.matched) {
        // Verify dosage
        const dosageVerification = await verifyDosage(
          matchResult.drugId!,
          matchResult.drugType!,
          extractedDrug.dosage,
          extractedDrug.frequency,
          extractedDrug.duration
        );

        // Get generic alternatives
        const genericAlternatives = await getGenericAlternatives(
          matchResult.drugId!,
          matchResult.drugType!,
          tenantId
        );

        autofilledDrugs.push({
          extractedName: extractedDrug.medicationName,
          matchedDrugId: matchResult.drugId,
          matchedDrugName: matchResult.drugName,
          matchedDrugType: matchResult.drugType,
          dosage: extractedDrug.dosage,
          frequency: extractedDrug.frequency,
          duration: extractedDrug.duration,
          quantity: extractedDrug.quantity,
          confidence: ocrResult.confidence || 70,
          matchConfidence: matchResult.confidence,
          genericAlternatives: genericAlternatives.length > 0 ? genericAlternatives : undefined,
          dosageWarning: dosageVerification.warning,
          isUnusualDosage: dosageVerification.isUnusual,
        });
      } else {
        // Try to get suggestions for unmatched drugs
        const suggestions = await getDrugSuggestions(
          extractedDrug.medicationName,
          tenantId
        );

        unmatchedDrugs.push({
          name: extractedDrug.medicationName,
          extractedText: extractedDrug.medicationName,
          suggestions: suggestions.length > 0 ? suggestions : undefined,
        });
      }
    }

    // Step 3: Verify doctor information
    const doctorInfo = {
      name: ocrResult.doctorName,
      license: ocrResult.doctorLicense,
      verified: false,
    };

    if (ocrResult.doctorLicense) {
      doctorInfo.verified = await verifyDoctorLicense(ocrResult.doctorLicense);
    }

    // Step 4: Calculate completeness score
    const completeness = calculateCompletenessScore({
      hasDoctorName: !!ocrResult.doctorName,
      hasDoctorLicense: !!ocrResult.doctorLicense,
      hasDate: !!ocrResult.date,
      hasDrugs: autofilledDrugs.length > 0,
      allDrugsMatched: unmatchedDrugs.length === 0,
    });

    // Step 5: Collect dosage warnings
    const dosageWarnings = autofilledDrugs
      .filter((d) => d.dosageWarning)
      .map((d) => ({
        drug: d.matchedDrugName || d.extractedName,
        level: d.dosageWarning!.level,
        message: d.dosageWarning!.message,
      }));

    // Step 6: Collect generic suggestions
    const genericSuggestions = autofilledDrugs
      .filter((d) => d.genericAlternatives && d.genericAlternatives.length > 0)
      .map((d) => ({
        originalDrug: d.matchedDrugName || d.extractedName,
        alternatives: d.genericAlternatives!,
      }));

    // Step 7: Determine if review is required
    const requiresReview =
      unmatchedDrugs.length > 0 ||
      dosageWarnings.some((w) => w.level === "ERROR") ||
      completeness.score < 70 ||
      autofilledDrugs.some((d) => d.matchConfidence < 70);

    const reviewReason = requiresReview
      ? unmatchedDrugs.length > 0
        ? "Unmatched drugs found"
        : dosageWarnings.some((w) => w.level === "ERROR")
        ? "Dosage errors detected"
        : completeness.score < 70
        ? "Prescription incomplete"
        : "Low confidence matches"
      : undefined;

    // Step 8: Save autofill result to database
    const autofillRecord = await prisma.aIPrescriptionAutofill.create({
      data: {
        tenantId,
        prescriptionId: request.prescriptionId,
        ocrText: ocrResult.text,
        ocrConfidence: ocrResult.confidence,
        ocrProvider: request.ocrProvider || "google",
        autoFillStatus: autofilledDrugs.length === ocrResult.extractedDrugs.length ? "COMPLETED" : unmatchedDrugs.length > 0 ? "PARTIAL" : "FAILED",
        autoFillConfidence: ocrResult.confidence,
        extractedDrugs: ocrResult.extractedDrugs,
        matchedDrugs: autofilledDrugs,
        unmatchedDrugs: unmatchedDrugs.length > 0 ? unmatchedDrugs : undefined,
        extractedDoctorName: ocrResult.doctorName,
        extractedDoctorLicense: ocrResult.doctorLicense,
        doctorVerified: doctorInfo.verified,
        dosageVerified: dosageWarnings.filter((w) => w.level === "ERROR").length === 0,
        dosageWarnings: dosageWarnings.length > 0 ? dosageWarnings : undefined,
        unusualDosages: autofilledDrugs.filter((d) => d.isUnusualDosage).map((d) => ({
          drug: d.matchedDrugName || d.extractedName,
          dosage: d.dosage,
          frequency: d.frequency,
        })),
        genericSuggestions: genericSuggestions.length > 0 ? genericSuggestions : undefined,
        completenessScore: completeness.score,
        missingFields: completeness.missingFields,
        requiresReview,
        reviewReason,
        processingTimeMs: Date.now() - startTime,
      },
    });

    return {
      success: true,
      status: autofilledDrugs.length === ocrResult.extractedDrugs.length ? "COMPLETED" : unmatchedDrugs.length > 0 ? "PARTIAL" : "FAILED",
      confidence: ocrResult.confidence || 70,
      extractedDrugs: autofilledDrugs,
      unmatchedDrugs,
      doctorInfo,
      completenessScore: completeness.score,
      missingFields: completeness.missingFields,
      requiresReview,
      reviewReason,
      genericSuggestions,
      dosageWarnings,
      autofillId: autofillRecord.id,
    };
  } catch (error: any) {
    console.error("Prescription autofill error:", error);
    return {
      success: false,
      status: "FAILED",
      confidence: 0,
      extractedDrugs: [],
      unmatchedDrugs: [],
      completenessScore: 0,
      missingFields: ["Processing error"],
      requiresReview: true,
      reviewReason: error.message || "Autofill processing failed",
      genericSuggestions: [],
      dosageWarnings: [],
    };
  }
}

/**
 * Match drug name with drug library
 */
async function matchDrugWithLibrary(
  drugName: string,
  tenantId: number
): Promise<{
  matched: boolean;
  drugId?: number;
  drugName?: string;
  drugType?: "PRODUCT" | "DRUG_LIBRARY";
  confidence: number;
}> {
  // Try exact match first
  const exactMatch = await prisma.drugLibrary.findFirst({
    where: {
      OR: [
        { brandName: { equals: drugName, mode: "insensitive" } },
        { genericName: { equals: drugName, mode: "insensitive" } },
      ],
    },
  });

  if (exactMatch) {
    return {
      matched: true,
      drugId: exactMatch.id,
      drugName: exactMatch.brandName,
      drugType: "DRUG_LIBRARY",
      confidence: 95,
    };
  }

  // Try fuzzy match
  const fuzzyMatch = await prisma.drugLibrary.findFirst({
    where: {
      OR: [
        { brandName: { contains: drugName.split(" ")[0], mode: "insensitive" } },
        { genericName: { contains: drugName.split(" ")[0], mode: "insensitive" } },
      ],
    },
  });

  if (fuzzyMatch) {
    return {
      matched: true,
      drugId: fuzzyMatch.id,
      drugName: fuzzyMatch.brandName,
      drugType: "DRUG_LIBRARY",
      confidence: 70,
    };
  }

  // Try Product table
  const productMatch = await prisma.product.findFirst({
    where: {
      name: { contains: drugName.split(" ")[0], mode: "insensitive" },
    },
  });

  if (productMatch) {
    return {
      matched: true,
      drugId: productMatch.id,
      drugName: productMatch.name,
      drugType: "PRODUCT",
      confidence: 75,
    };
  }

  return {
    matched: false,
    confidence: 0,
  };
}

/**
 * Verify dosage against standard protocols
 */
async function verifyDosage(
  drugId: number,
  drugType: "PRODUCT" | "DRUG_LIBRARY",
  dosage?: string,
  frequency?: string,
  duration?: string
): Promise<{
  warning?: {
    level: "INFO" | "WARNING" | "ERROR";
    message: string;
    standardDosage?: string;
  };
  isUnusual: boolean;
}> {
  // Basic dosage verification (can be enhanced with drug database)
  // For now, check for common issues

  if (!dosage && !frequency) {
    return {
      warning: {
        level: "WARNING",
        message: "Dosage or frequency not specified",
      },
      isUnusual: false,
    };
  }

  // Check for unusually high dosages (basic heuristics)
  const dosageNum = parseFloat(dosage || "0");
  if (dosageNum > 1000) {
    return {
      warning: {
        level: "ERROR",
        message: "Dosage appears unusually high - please verify",
      },
      isUnusual: true,
    };
  }

  return {
    isUnusual: false,
  };
}

/**
 * Get generic alternatives for a drug
 */
async function getGenericAlternatives(
  drugId: number,
  drugType: "PRODUCT" | "DRUG_LIBRARY",
  tenantId: number
): Promise<Array<{
  id: number;
  name: string;
  type: "PRODUCT" | "DRUG_LIBRARY";
  priceDifference?: number;
}>> {
  if (drugType === "DRUG_LIBRARY") {
    // Find generic versions of the same formulation
    const drug = await prisma.drugLibrary.findUnique({
      where: { id: drugId },
      include: {
        formulation: {
          include: {
            brands: true,
          },
        },
      },
    });

    if (drug?.formulation) {
      // Get other brands of the same formulation (generics)
      const generics = await prisma.drugBrand.findMany({
        where: {
          formulationId: drug.formulation.id,
          id: { not: drug.brandId },
        },
        include: {
          packs: true,
        },
      });

      return generics.slice(0, 3).map((g) => ({
        id: g.id,
        name: g.name,
        type: "DRUG_LIBRARY" as const,
      }));
    }
  }

  return [];
}

/**
 * Get drug suggestions for unmatched drugs
 */
async function getDrugSuggestions(
  drugName: string,
  tenantId: number
): Promise<string[]> {
  // Try to find similar drug names
  const suggestions = await prisma.drugLibrary.findMany({
    where: {
      OR: [
        { brandName: { contains: drugName.substring(0, 4), mode: "insensitive" } },
        { genericName: { contains: drugName.substring(0, 4), mode: "insensitive" } },
      ],
    },
    take: 5,
  });

  return suggestions.map((s) => s.brandName);
}

/**
 * Verify doctor license (MCI format)
 */
async function verifyDoctorLicense(license: string): Promise<boolean> {
  // Basic MCI license format validation
  // Format: State code (2 letters) + 6-8 digits
  const mciPattern = /^[A-Z]{2}\d{6,8}$/i;
  return mciPattern.test(license);
}

/**
 * Calculate prescription completeness score
 */
function calculateCompletenessScore(data: {
  hasDoctorName: boolean;
  hasDoctorLicense: boolean;
  hasDate: boolean;
  hasDrugs: boolean;
  allDrugsMatched: boolean;
}): {
  score: number;
  missingFields: string[];
} {
  const missingFields: string[] = [];
  let score = 100;

  if (!data.hasDoctorName) {
    missingFields.push("Doctor name");
    score -= 10;
  }
  if (!data.hasDoctorLicense) {
    missingFields.push("Doctor license");
    score -= 10;
  }
  if (!data.hasDate) {
    missingFields.push("Prescription date");
    score -= 10;
  }
  if (!data.hasDrugs) {
    missingFields.push("Medications");
    score -= 30;
  }
  if (!data.allDrugsMatched) {
    score -= 20;
  }

  return {
    score: Math.max(0, score),
    missingFields,
  };
}
