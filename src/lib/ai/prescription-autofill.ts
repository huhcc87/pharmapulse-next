// src/lib/ai/prescription-autofill.ts
// AI Prescription Auto-Fill & Verification
// Enhanced prescription processing with auto-fill and verification

import { prisma } from "@/lib/prisma";
import { extractPrescriptionText } from "@/lib/ocr/prescription-ocr";
import { Prisma } from "@prisma/client";

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
  matchConfidence: number;
  genericAlternatives?: Array<{
    id: number;
    name: string;
    type: "PRODUCT" | "DRUG_LIBRARY";
    priceDifference?: number;
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

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
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

    const provider = request.ocrProvider || "google";
    const language = request.language;

    const ocrPayload = request.imageUrl
      ? ({
          imageUrl: request.imageUrl,
          imageBase64: request.imageBase64,
          provider,
          language,
        } as unknown)
      : ({
          imageBase64: request.imageBase64!,
          provider,
          language,
        } as unknown);

    const ocrResult = await extractPrescriptionText(
      ocrPayload as Parameters<typeof extractPrescriptionText>[0]
    );

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
        const dosageVerification = await verifyDosage(
          matchResult.drugId!,
          matchResult.drugType!,
          extractedDrug.dosage,
          extractedDrug.frequency,
          extractedDrug.duration
        );

        // ✅ Schema-safe: no relations required
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
          genericAlternatives:
            genericAlternatives.length > 0 ? genericAlternatives : undefined,
          dosageWarning: dosageVerification.warning,
          isUnusualDosage: dosageVerification.isUnusual,
        });
      } else {
        const suggestions = await getDrugSuggestions(extractedDrug.medicationName);
        unmatchedDrugs.push({
          name: extractedDrug.medicationName,
          extractedText: extractedDrug.medicationName,
          suggestions: suggestions.length > 0 ? suggestions : undefined,
        });
      }
    }

    const doctorInfo = {
      name: ocrResult.doctorName,
      license: ocrResult.doctorLicense,
      verified: false,
    };

    if (ocrResult.doctorLicense) {
      doctorInfo.verified = await verifyDoctorLicense(ocrResult.doctorLicense);
    }

    const completeness = calculateCompletenessScore({
      hasDoctorName: !!ocrResult.doctorName,
      hasDoctorLicense: !!ocrResult.doctorLicense,
      hasDate: !!ocrResult.date,
      hasDrugs: autofilledDrugs.length > 0,
      allDrugsMatched: unmatchedDrugs.length === 0,
    });

    const dosageWarnings = autofilledDrugs
      .filter((d) => d.dosageWarning)
      .map((d) => ({
        drug: d.matchedDrugName || d.extractedName,
        level: d.dosageWarning!.level,
        message: d.dosageWarning!.message,
      }));

    const genericSuggestions = autofilledDrugs
      .filter((d) => d.genericAlternatives && d.genericAlternatives.length > 0)
      .map((d) => ({
        originalDrug: d.matchedDrugName || d.extractedName,
        alternatives: d.genericAlternatives!,
      }));

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

    const autoFillStatus: "COMPLETED" | "PARTIAL" | "FAILED" =
      autofilledDrugs.length === ocrResult.extractedDrugs.length
        ? "COMPLETED"
        : unmatchedDrugs.length > 0
        ? "PARTIAL"
        : "FAILED";

    const unusualDosages = autofilledDrugs
      .filter((d) => d.isUnusualDosage)
      .map((d) => ({
        drug: d.matchedDrugName || d.extractedName,
        dosage: d.dosage,
        frequency: d.frequency,
      }));

    const autofillRecord = await prisma.aIPrescriptionAutofill.create({
      data: {
        tenantId,
        prescriptionId: request.prescriptionId,

        ocrText: ocrResult.text,
        ocrConfidence: ocrResult.confidence,
        ocrProvider: provider,

        autoFillStatus,
        autoFillConfidence: ocrResult.confidence,

        extractedDrugs: asJson(ocrResult.extractedDrugs),
        matchedDrugs: asJson(autofilledDrugs),
        unmatchedDrugs: unmatchedDrugs.length > 0 ? asJson(unmatchedDrugs) : undefined,

        extractedDoctorName: ocrResult.doctorName,
        extractedDoctorLicense: ocrResult.doctorLicense,
        doctorVerified: doctorInfo.verified,

        dosageVerified: dosageWarnings.filter((w) => w.level === "ERROR").length === 0,
        dosageWarnings: dosageWarnings.length > 0 ? asJson(dosageWarnings) : undefined,

        unusualDosages: unusualDosages.length > 0 ? asJson(unusualDosages) : undefined,
        genericSuggestions: genericSuggestions.length > 0 ? asJson(genericSuggestions) : undefined,

        completenessScore: completeness.score,
        missingFields: completeness.missingFields,
        requiresReview,
        reviewReason,
        processingTimeMs: Date.now() - startTime,
      },
    });

    return {
      success: true,
      status: autoFillStatus,
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
      reviewReason: error?.message || "Autofill processing failed",
      genericSuggestions: [],
      dosageWarnings: [],
    };
  }
}

/**
 * Match drug name with drug library
 * (Schema-safe: does not assume genericName exists)
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
  // Exact brandName match
  const exactMatch = await prisma.drugLibrary.findFirst({
    where: {
      brandName: { equals: drugName, mode: "insensitive" },
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

  // Fuzzy brandName token match
  const token = (drugName.split(" ")[0] ?? drugName).trim();
  const fuzzyMatch = await prisma.drugLibrary.findFirst({
    where: {
      brandName: { contains: token, mode: "insensitive" },
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

  // Product fallback
  const productMatch = await prisma.product.findFirst({
    where: { name: { contains: token, mode: "insensitive" } },
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

  return { matched: false, confidence: 0 };
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
  if (!dosage && !frequency) {
    return {
      warning: { level: "WARNING", message: "Dosage or frequency not specified" },
      isUnusual: false,
    };
  }

  const dosageNum = parseFloat(dosage || "0");
  if (Number.isFinite(dosageNum) && dosageNum > 1000) {
    return {
      warning: { level: "ERROR", message: "Dosage appears unusually high - please verify" },
      isUnusual: true,
    };
  }

  return { isUnusual: false };
}

/**
 * Generic alternatives
 *
 * Your schema does not expose DrugLibrary -> formulation -> brands relations,
 * so we return [] for now (safe + compiles).
 *
 * If you share your DrugLibrary model fields/relations, I’ll implement real generic lookup.
 */
async function getGenericAlternatives(
  drugId: number,
  drugType: "PRODUCT" | "DRUG_LIBRARY",
  tenantId: number
): Promise<
  Array<{
    id: number;
    name: string;
    type: "PRODUCT" | "DRUG_LIBRARY";
    priceDifference?: number;
  }>
> {
  return [];
}

/**
 * Get drug suggestions for unmatched drugs
 */
async function getDrugSuggestions(drugName: string): Promise<string[]> {
  const key = drugName.length >= 4 ? drugName.substring(0, 4) : drugName;

  const suggestions = await prisma.drugLibrary.findMany({
    where: {
      brandName: { contains: key, mode: "insensitive" },
    },
    take: 5,
  });

  return suggestions.map((s) => s.brandName);
}

/**
 * Verify doctor license (MCI format)
 */
async function verifyDoctorLicense(license: string): Promise<boolean> {
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
}): { score: number; missingFields: string[] } {
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

  return { score: Math.max(0, score), missingFields };
}
