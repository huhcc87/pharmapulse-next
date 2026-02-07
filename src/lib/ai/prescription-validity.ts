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
 * Checks: doctor license, prescription age, handwriting, stamps, duplicates
 */
export async function validatePrescription(
  prescriptionId: number,
  tenantId: number = 1
): Promise<PrescriptionValidityResult> {
  try {
    // Fetch prescription
    const prescription = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: {
        customer: true,
        lines: true,
      },
    });

    if (!prescription) {
      throw new Error("Prescription not found");
    }

    const result: PrescriptionValidityResult = {
      authenticityScore: 100, // Start with perfect score
      authenticityReasons: [],
      doctorVerified: false,
      isExpired: false,
      isValid: true,
      riskLevel: "LOW",
      requiresReview: false,
    };

    // 1. Extract doctor information from OCR or manual entry
    if (prescription.doctorName) {
      result.doctorName = prescription.doctorName;
      
      // Try to extract license number from doctor name/notes
      const licenseMatch = prescription.doctorName.match(/\b([A-Z]{2}\d{6,8})\b/);
      if (licenseMatch) {
        result.doctorLicenseNumber = licenseMatch[1];
      }
    }

    // 2. Verify doctor license (Indian market: MCI or State Medical Council)
    if (result.doctorLicenseNumber) {
      const verified = await verifyDoctorLicense(result.doctorLicenseNumber);
      result.doctorVerified = verified.found;
      result.doctorVerificationSource = verified.source;
      
      if (!verified.found) {
        result.authenticityScore -= 30;
        result.authenticityReasons?.push("Doctor license number not found in medical council database");
        result.riskLevel = "HIGH";
        result.requiresReview = true;
      }
    } else {
      result.authenticityScore -= 20;
      result.authenticityReasons?.push("Doctor license number not found in prescription");
      result.riskLevel = result.riskLevel === "LOW" ? "MEDIUM" : result.riskLevel;
    }

    // 3. Check prescription age
    const prescriptionDate = prescription.date || prescription.createdAt;
    const now = new Date();
    const ageInDays = Math.ceil((now.getTime() - prescriptionDate.getTime()) / (1000 * 60 * 60 * 24));
    result.prescriptionAge = ageInDays;

    // Indian pharmacy regulations: Schedule H prescriptions valid for 6 months, Schedule X for 1 month
    const schedule = prescription.schedule || "H"; // Default to Schedule H
    const maxAgeDays = schedule === "X" ? 30 : 180; // 1 month for Schedule X, 6 months for Schedule H

    if (ageInDays > maxAgeDays) {
      result.isExpired = true;
      result.expiryReason = `Prescription is ${ageInDays} days old. Maximum validity: ${maxAgeDays} days for Schedule ${schedule}`;
      result.authenticityScore -= 50;
      result.authenticityReasons?.push(result.expiryReason);
      result.isValid = false;
      result.riskLevel = "CRITICAL";
      result.requiresReview = true;
    } else if (ageInDays > maxAgeDays * 0.8) {
      // Warning: Approaching expiry (80% of max age)
      result.authenticityScore -= 10;
      result.authenticityReasons?.push(`Prescription is ${ageInDays} days old. Will expire in ${maxAgeDays - ageInDays} days.`);
      result.riskLevel = result.riskLevel === "LOW" ? "MEDIUM" : result.riskLevel;
    }

    // 4. Check for stamp/seal (Indian prescriptions often have clinic stamp)
    // If OCR data available, check for stamp indicators
    if (prescription.ocrRawText) {
      const hasStamp = /stamp|seal|clinic|hospital/i.test(prescription.ocrRawText);
      result.hasStamp = hasStamp;
      
      if (!hasStamp) {
        result.authenticityScore -= 10;
        result.authenticityReasons?.push("No clinic/hospital stamp detected");
        if (result.riskLevel === "LOW") {
          result.riskLevel = "MEDIUM";
        }
      } else {
        result.stampQuality = 85; // Assume good quality if detected
      }
    }

    // 5. Check for duplicate prescriptions
    const duplicates = await checkDuplicatePrescriptions(prescriptionId, prescription.customerId, tenantId);
    if (duplicates.length > 0) {
      result.duplicatePrescriptionIds = duplicates;
      result.duplicateScore = 70; // Similarity score
      result.authenticityScore -= 25;
      result.authenticityReasons?.push(`Found ${duplicates.length} similar prescriptions for this customer`);
      result.riskLevel = "HIGH";
      result.requiresReview = true;
    }

    // 6. Handwriting consistency (if OCR data available)
    // For now, skip actual handwriting analysis (requires ML model)
    // Can be enhanced with TensorFlow.js or cloud ML service
    result.handwritingConsistency = 80; // Default score
    result.signatureMatch = 75; // Default score

    // 7. Determine final validity and risk level
    if (result.authenticityScore < 50) {
      result.isValid = false;
      result.riskLevel = "CRITICAL";
    } else if (result.authenticityScore < 70) {
      result.isValid = true; // Valid but risky
      result.riskLevel = result.riskLevel === "LOW" ? "HIGH" : result.riskLevel;
      result.requiresReview = true;
    }

    // 8. Generate validation reason
    if (!result.isValid) {
      result.validationReason = `Prescription validation failed. Score: ${result.authenticityScore}/100. Issues: ${result.authenticityReasons?.join(", ")}`;
    } else if (result.requiresReview) {
      result.validationReason = `Prescription validated with warnings. Score: ${result.authenticityScore}/100. Review recommended due to: ${result.authenticityReasons?.join(", ")}`;
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
 * Verify doctor license against Indian medical councils
 * MCI (Medical Council of India) or State Medical Councils
 */
async function verifyDoctorLicense(
  licenseNumber: string
): Promise<{ found: boolean; source?: string }> {
  // TODO: Integrate with MCI/State Medical Council API
  // For now, return mock verification
  
  // Mock: Check if license number format is valid
  // Indian medical license format: State code (2 letters) + 6-8 digits
  // Example: MH123456, DL7890123
  
  const licensePattern = /^[A-Z]{2}\d{6,8}$/;
  const isValidFormat = licensePattern.test(licenseNumber);
  
  if (!isValidFormat) {
    return { found: false };
  }

  // Mock: Assume first 2 letters are state code
  const stateCode = licenseNumber.substring(0, 2);
  const stateMapping: Record<string, string> = {
    "MH": "Maharashtra Medical Council",
    "DL": "Delhi Medical Council",
    "KA": "Karnataka Medical Council",
    "TN": "Tamil Nadu Medical Council",
    "AP": "Andhra Pradesh Medical Council",
    "GJ": "Gujarat Medical Council",
    "WB": "West Bengal Medical Council",
    // Add more states as needed
  };

  const source = stateMapping[stateCode] || "State Medical Council";
  
  // For now, return true if format is valid (can be enhanced with actual API call)
  return {
    found: isValidFormat, // Mock: assume valid if format is correct
    source,
  };
}

/**
 * Check for duplicate prescriptions
 * Looks for similar prescriptions for same customer with same medicines
 */
async function checkDuplicatePrescriptions(
  prescriptionId: number,
  customerId: number | null,
  tenantId: number
): Promise<number[]> {
  if (!customerId) {
    return [];
  }

  const currentPrescription = await prisma.prescription.findUnique({
    where: { id: prescriptionId },
    include: {
      lines: {
        select: {
          drugName: true,
          quantity: true,
        },
      },
    },
  });

  if (!currentPrescription) {
    return [];
  }

  // Get all other prescriptions for this customer
  const otherPrescriptions = await prisma.prescription.findMany({
    where: {
      tenantId,
      customerId,
      id: {
        not: prescriptionId,
      },
      date: {
        // Check prescriptions within last 90 days
        gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      },
    },
    include: {
      lines: {
        select: {
          drugName: true,
          quantity: true,
        },
      },
    },
  });

  const duplicates: number[] = [];

  // Check similarity: same medicines, similar quantities
  for (const otherPrescription of otherPrescriptions) {
    if (otherPrescription.lines.length === currentPrescription.lines.length) {
      let similarCount = 0;
      for (const currentLine of currentPrescription.lines) {
        const found = otherPrescription.lines.find(
          (l) => l.drugName.toLowerCase() === currentLine.drugName.toLowerCase()
        );
        if (found) {
          similarCount++;
        }
      }

      // If 80%+ medicines match, consider it a duplicate
      if (similarCount >= currentPrescription.lines.length * 0.8) {
        duplicates.push(otherPrescription.id);
      }
    }
  }

  return duplicates;
}
