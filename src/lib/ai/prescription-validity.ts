// src/lib/ai/prescription-validity.ts
// AI Prescription Validity Checker
// Authenticity scoring, doctor verification, prescription age analysis
// Optimized for Indian market (MCI, state medical councils)

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface PrescriptionValidityResult {
  authenticityScore: number; // 0-100
  authenticityReasons?: string[];
  doctorName?: string;
  doctorLicenseNumber?: string;
  doctorVerified: boolean;
  doctorVerificationSource?: string; // MCI, State Medical Council
  prescriptionAge?: number; // Days since prescription date
  isExpired: boolean;
  expiryReason?: string;

  inferredSchedule?: "H" | "X";
  handwritingConsistency?: number; // 0-100
  signatureMatch?: number; // 0-100
  hasStamp?: boolean;
  hasSeal?: boolean;
  stampQuality?: number; // 0-100

  duplicatePrescriptionIds?: number[];
  duplicateScore?: number;

  isValid: boolean;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  validationReason?: string;
  requiresReview: boolean;
}

/**
 * Validate prescription authenticity
 */
export async function validatePrescription(
  prescriptionId: number,
  tenantId: number = 1
): Promise<PrescriptionValidityResult> {
  try {
    const prescription = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: {
        customer: true,
        lines: true, // ✅ no select fields that might not exist
      },
    });

    if (!prescription) throw new Error("Prescription not found");

    const result: PrescriptionValidityResult = {
      authenticityScore: 100,
      authenticityReasons: [],
      doctorVerified: false,
      isExpired: false,
      isValid: true,
      riskLevel: "LOW",
      requiresReview: false,
    };

    // 1) Doctor info
    if ((prescription as any).doctorName) {
      result.doctorName = (prescription as any).doctorName;

      const licenseMatch = String((prescription as any).doctorName).match(
        /\b([A-Z]{2}\d{6,8})\b/
      );
      if (licenseMatch) result.doctorLicenseNumber = licenseMatch[1];
    }

    // 2) Verify doctor license (mock for now)
    if (result.doctorLicenseNumber) {
      const verified = await verifyDoctorLicense(result.doctorLicenseNumber);
      result.doctorVerified = verified.found;
      result.doctorVerificationSource = verified.source;

      if (!verified.found) {
        result.authenticityScore -= 30;
        result.authenticityReasons?.push(
          "Doctor license number not found in medical council database"
        );
        result.riskLevel = "HIGH";
        result.requiresReview = true;
      }
    } else {
      result.authenticityScore -= 20;
      result.authenticityReasons?.push("Doctor license number not found in prescription");
      if (result.riskLevel === "LOW") result.riskLevel = "MEDIUM";
    }

    // 3) Age
    const prescriptionDate = (prescription as any).date || prescription.createdAt;
    const now = new Date();
    const ageInDays = Math.ceil(
      (now.getTime() - prescriptionDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    result.prescriptionAge = ageInDays;

    // Infer schedule from text (no schema field required)
    const schedule = inferScheduleFromPrescription(prescription);
    result.inferredSchedule = schedule;

    const maxAgeDays = schedule === "X" ? 30 : 180;

    if (ageInDays > maxAgeDays) {
      result.isExpired = true;
      result.expiryReason = `Prescription is ${ageInDays} days old. Maximum validity: ${maxAgeDays} days for Schedule ${schedule}`;
      result.authenticityScore -= 50;
      result.authenticityReasons?.push(result.expiryReason);
      result.isValid = false;
      result.riskLevel = "CRITICAL";
      result.requiresReview = true;
    } else if (ageInDays > maxAgeDays * 0.8) {
      result.authenticityScore -= 10;
      result.authenticityReasons?.push(
        `Prescription is ${ageInDays} days old. Will expire in ${maxAgeDays - ageInDays} days.`
      );
      if (result.riskLevel === "LOW") result.riskLevel = "MEDIUM";
    }

    // 4) Stamp heuristic via OCR text if present
    const ocrText = (prescription as any).ocrRawText as string | undefined;
    if (ocrText) {
      const hasStamp = /stamp|seal|clinic|hospital/i.test(ocrText);
      result.hasStamp = hasStamp;

      if (!hasStamp) {
        result.authenticityScore -= 10;
        result.authenticityReasons?.push("No clinic/hospital stamp detected");
        if (result.riskLevel === "LOW") result.riskLevel = "MEDIUM";
      } else {
        result.stampQuality = 85;
      }

      result.hasSeal = /seal/i.test(ocrText) || result.hasStamp;
    }

    // 5) Duplicate check (schema-safe line name extraction)
    const duplicates = await checkDuplicatePrescriptions(
      prescriptionId,
      prescription.customerId,
      tenantId
    );

    if (duplicates.length > 0) {
      result.duplicatePrescriptionIds = duplicates;
      result.duplicateScore = 70;
      result.authenticityScore -= 25;
      result.authenticityReasons?.push(
        `Found ${duplicates.length} similar prescriptions for this customer`
      );
      result.riskLevel = "HIGH";
      result.requiresReview = true;
    }

    // 6) Placeholder scores
    result.handwritingConsistency = 80;
    result.signatureMatch = 75;

    // 7) Final validity/risk
    if (result.authenticityScore < 50) {
      result.isValid = false;
      result.riskLevel = "CRITICAL";
    } else if (result.authenticityScore < 70) {
      result.isValid = true;
      if (result.riskLevel === "LOW") result.riskLevel = "HIGH";
      result.requiresReview = true;
    }

    // 8) Summary
    const issues = result.authenticityReasons?.filter(Boolean) ?? [];
    if (!result.isValid) {
      result.validationReason = `Prescription validation failed. Score: ${result.authenticityScore}/100. Issues: ${issues.join(
        ", "
      )}`;
    } else if (result.requiresReview) {
      result.validationReason = `Prescription validated with warnings. Score: ${result.authenticityScore}/100. Review recommended due to: ${issues.join(
        ", "
      )}`;
    } else {
      result.validationReason = `Prescription validated successfully. Score: ${result.authenticityScore}/100.`;
    }

    return result;
  } catch (error: any) {
    console.error("Prescription validation error:", error);
    throw error;
  }
}

/**
 * Infer Schedule (H vs X) from available text fields.
 */
function inferScheduleFromPrescription(prescription: any): "H" | "X" {
  const textParts: string[] = [];

  if (typeof prescription?.doctorName === "string") textParts.push(prescription.doctorName);
  if (typeof prescription?.notes === "string") textParts.push(prescription.notes);
  if (typeof prescription?.ocrRawText === "string") textParts.push(prescription.ocrRawText);

  const haystack = textParts.join(" ").toLowerCase();

  if (
    /schedule\s*x\b/.test(haystack) ||
    /\bsch\s*x\b/.test(haystack) ||
    /\bschx\b/.test(haystack)
  ) {
    return "X";
  }

  return "H";
}

/**
 * Verify doctor license (mock)
 */
async function verifyDoctorLicense(
  licenseNumber: string
): Promise<{ found: boolean; source?: string }> {
  const licensePattern = /^[A-Z]{2}\d{6,8}$/;
  const isValidFormat = licensePattern.test(licenseNumber);

  if (!isValidFormat) return { found: false };

  const stateCode = licenseNumber.substring(0, 2);
  const stateMapping: Record<string, string> = {
    MH: "Maharashtra Medical Council",
    DL: "Delhi Medical Council",
    KA: "Karnataka Medical Council",
    TN: "Tamil Nadu Medical Council",
    AP: "Andhra Pradesh Medical Council",
    GJ: "Gujarat Medical Council",
    WB: "West Bengal Medical Council",
  };

  return { found: true, source: stateMapping[stateCode] || "State Medical Council" };
}

/**
 * Extract a stable, comparable medication "name" from a prescription line,
 * without assuming your Prisma schema field names.
 */
function getLineDrugName(line: any): string {
  const candidates = [
    line?.drugName,
    line?.medicineName,
    line?.medicationName,
    line?.itemName,
    line?.productName,
    line?.name,
    line?.title,
    line?.skuName,
  ];

  const found = candidates.find((v) => typeof v === "string" && v.trim().length > 0);
  return (found ? String(found) : "").trim();
}

/**
 * Check for duplicate prescriptions for same customer (schema-safe).
 */
async function checkDuplicatePrescriptions(
  prescriptionId: number,
  customerId: number | null,
  tenantId: number
): Promise<number[]> {
  if (!customerId) return [];

  const current = await prisma.prescription.findUnique({
    where: { id: prescriptionId },
    include: { lines: true }, // ✅ no select
  });

  if (!current) return [];

  const others = await prisma.prescription.findMany({
    where: {
      tenantId,
      customerId,
      id: { not: prescriptionId },
      date: {
        gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      },
    },
    include: { lines: true }, // ✅ no select
  });

  const currentNames = (current.lines ?? [])
    .map(getLineDrugName)
    .map((s) => s.toLowerCase())
    .filter(Boolean);

  if (currentNames.length === 0) return [];

  const duplicates: number[] = [];

  for (const other of others) {
    const otherNames = (other.lines ?? [])
      .map(getLineDrugName)
      .map((s) => s.toLowerCase())
      .filter(Boolean);

    if (otherNames.length === 0) continue;

    const setOther = new Set(otherNames);
    let matchCount = 0;

    for (const n of currentNames) {
      if (setOther.has(n)) matchCount++;
    }

    // 80%+ overlap counts as duplicate
    if (matchCount >= currentNames.length * 0.8) {
      duplicates.push(other.id);
    }
  }

  return duplicates;
}
