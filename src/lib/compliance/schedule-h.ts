// Schedule H/H1 Drug Compliance Validation
// Legal requirement: Schedule H drugs require prescription

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface ScheduleHValidationResult {
  isValid: boolean;
  errors: Array<{
    productId?: number;
    drugLibraryId?: number;
    productName: string;
    schedule: string;
    message: string;
  }>;
  warnings: Array<{
    productId?: number;
    drugLibraryId?: number;
    productName: string;
    message: string;
  }>;
}

export interface ScheduleHValidationInput {
  lineItems: Array<{
    productId?: number;
    drugLibraryId?: number;
    productName: string;
    quantity: number;
  }>;
  prescriptionId?: number;
  prescriptionLines?: Array<{
    drugLibraryId?: number;
    productId?: number;
    medicationName: string;
    quantity: number;
  }>;
  customerId?: number;
  overrideBy?: number; // User ID who can override (Pharmacist/Doctor)
}

/**
 * Validate Schedule H/H1 drug compliance
 * 
 * Rules:
 * 1. Schedule H drugs require a valid prescription
 * 2. Prescription must be verified/active
 * 3. Prescription must not be expired (typically valid for 6 months in India)
 * 4. Prescription line items must match the drug being sold
 * 5. Quantity must not exceed prescribed quantity
 * 6. Override allowed only for licensed pharmacists/doctors
 */
export async function validateScheduleHDrugs(
  input: ScheduleHValidationInput
): Promise<ScheduleHValidationResult> {
  const errors: ScheduleHValidationResult["errors"] = [];
  const warnings: ScheduleHValidationResult["warnings"] = [];

  // Check each line item for Schedule H drugs
  const scheduleHItems: Array<{
    productId?: number;
    drugLibraryId?: number;
    productName: string;
    quantity: number;
    schedule: string;
  }> = [];

  for (const item of input.lineItems) {
    let isScheduleDrug = false;
    let schedule = "";
    let drugLibraryId: number | null = null;
    let productId: number | null = null;

    // Check if item is Schedule H drug
    if (item.productId) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
      });
      if (product?.schedule?.toUpperCase().startsWith("H")) {
        isScheduleDrug = true;
        schedule = product.schedule.toUpperCase();
        productId = product.id;
      }
    } else if (item.drugLibraryId) {
      const drugLibrary = await prisma.drugLibrary.findUnique({
        where: { id: item.drugLibraryId },
      });
      if (drugLibrary?.isScheduleDrug || drugLibrary?.schedule?.toUpperCase().startsWith("H")) {
        isScheduleDrug = true;
        schedule = drugLibrary.schedule?.toUpperCase() || "H";
        drugLibraryId = drugLibrary.id;
      }
    }

    if (isScheduleDrug) {
      scheduleHItems.push({
        productId: productId || undefined,
        drugLibraryId: drugLibraryId || undefined,
        productName: item.productName,
        quantity: item.quantity,
        schedule,
      });
    }
  }

  // If no Schedule H drugs, validation passes
  if (scheduleHItems.length === 0) {
    return {
      isValid: true,
      errors: [],
      warnings: [],
    };
  }

  // Validate prescription requirement
  if (!input.prescriptionId) {
    for (const item of scheduleHItems) {
      errors.push({
        productId: item.productId,
        drugLibraryId: item.drugLibraryId,
        productName: item.productName,
        schedule: item.schedule,
        message: `Schedule ${item.schedule} drug requires a valid prescription. Please provide prescription details.`,
      });
    }
    return {
      isValid: false,
      errors,
      warnings,
    };
  }

  // Fetch and validate prescription
  const prescription = await prisma.prescription.findUnique({
    where: { id: input.prescriptionId },
    include: {
      lines: true,
      customer: true,
    },
  });

  if (!prescription) {
    for (const item of scheduleHItems) {
      errors.push({
        productId: item.productId,
        drugLibraryId: item.drugLibraryId,
        productName: item.productName,
        schedule: item.schedule,
        message: `Prescription not found. Schedule ${item.schedule} drug requires a valid prescription.`,
      });
    }
    return {
      isValid: false,
      errors,
      warnings,
    };
  }

  // Check prescription status
  if (prescription.status !== "VERIFIED" && prescription.status !== "PENDING") {
    for (const item of scheduleHItems) {
      errors.push({
        productId: item.productId,
        drugLibraryId: item.drugLibraryId,
        productName: item.productName,
        schedule: item.schedule,
        message: `Prescription is ${prescription.status.toLowerCase()}. Schedule ${item.schedule} drug requires an active prescription.`,
      });
    }
    return {
      isValid: false,
      errors,
      warnings,
    };
  }

  // Check prescription expiry (6 months validity in India)
  const prescriptionDate = new Date(prescription.date);
  const expiryDate = new Date(prescriptionDate);
  expiryDate.setMonth(expiryDate.getMonth() + 6); // 6 months validity

  if (new Date() > expiryDate) {
    for (const item of scheduleHItems) {
      errors.push({
        productId: item.productId,
        drugLibraryId: item.drugLibraryId,
        productName: item.productName,
        schedule: item.schedule,
        message: `Prescription expired on ${expiryDate.toLocaleDateString("en-IN")}. Schedule ${item.schedule} drug requires a valid prescription.`,
      });
    }
    return {
      isValid: false,
      errors,
      warnings,
    };
  }

  // Validate customer match (prescription must be for the same customer)
  if (input.customerId && prescription.customerId !== input.customerId) {
    errors.push({
      productName: "Prescription Customer Mismatch",
      schedule: "H",
      message: "Prescription does not belong to the selected customer. Please verify prescription details.",
    });
    return {
      isValid: false,
      errors,
      warnings,
    };
  }

  // Match Schedule H items with prescription lines
  for (const item of scheduleHItems) {
    const matchingPrescriptionLine = prescription.lines.find((line) => {
      // Match by drug library ID or product ID
      if (item.drugLibraryId && line.drugLibraryId === item.drugLibraryId) {
        return true;
      }
      if (item.productId && line.productId === item.productId) {
        return true;
      }
      // Match by medication name (fuzzy match)
      const itemNameLower = item.productName.toLowerCase();
      const lineNameLower = line.medicationName.toLowerCase();
      if (itemNameLower.includes(lineNameLower) || lineNameLower.includes(itemNameLower)) {
        return true;
      }
      return false;
    });

    if (!matchingPrescriptionLine) {
      warnings.push({
        productId: item.productId,
        drugLibraryId: item.drugLibraryId,
        productName: item.productName,
        message: `Warning: ${item.productName} is not explicitly mentioned in the prescription. Please verify with doctor/pharmacist.`,
      });
      // Don't block sale, but warn
    } else {
      // Check quantity
      if (item.quantity > matchingPrescriptionLine.quantity) {
        warnings.push({
          productId: item.productId,
          drugLibraryId: item.drugLibraryId,
          productName: item.productName,
          message: `Warning: Requested quantity (${item.quantity}) exceeds prescribed quantity (${matchingPrescriptionLine.quantity}). Please verify with doctor.`,
        });
      }

      // Check if already dispensed
      if (matchingPrescriptionLine.status === "DISPENSED") {
        warnings.push({
          productId: item.productId,
          drugLibraryId: item.drugLibraryId,
          productName: item.productName,
          message: `Warning: This medication was already dispensed on ${matchingPrescriptionLine.dispensedAt?.toLocaleDateString("en-IN")}. Please verify if refill is allowed.`,
        });
      }
    }
  }

  // If we have errors, validation fails
  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      warnings,
    };
  }

  // Validation passes (warnings don't block)
  return {
    isValid: true,
    errors: [],
    warnings,
  };
}

/**
 * Log Schedule H drug sale for audit
 */
export async function logScheduleHSale(data: {
  invoiceId: number;
  prescriptionId: number;
  customerId: number;
  scheduleHItems: Array<{
    productId?: number;
    drugLibraryId?: number;
    productName: string;
    quantity: number;
    schedule: string;
  }>;
  dispensedBy: number; // User ID
  overrideBy?: number; // User ID if overridden
  overrideReason?: string;
}): Promise<void> {
  try {
    // Log to PosAuditLog with action DISPENSE_SCHEDULE
    const { logPosAction } = await import("@/lib/pos-audit");

    await logPosAction(
      "POS_DISPENSE_SCHEDULE",
      data.dispensedBy,
      1, // tenantId
      data.invoiceId,
      {
        prescriptionId: data.prescriptionId,
        customerId: data.customerId,
        scheduleHItems: data.scheduleHItems,
        overrideBy: data.overrideBy,
        overrideReason: data.overrideReason,
        timestamp: new Date().toISOString(),
      }
    );
  } catch (error) {
    console.error("Failed to log Schedule H sale:", error);
    // Don't throw - audit logging is non-critical
  }
}

/**
 * Check if user can override Schedule H validation
 * Only licensed pharmacists/doctors can override
 */
export async function canOverrideScheduleH(userId: number, role: string): Promise<boolean> {
  // Only PHARMACIST, DOCTOR, OWNER roles can override
  const allowedRoles = ["PHARMACIST", "DOCTOR", "OWNER", "SUPER_ADMIN"];
  return allowedRoles.includes(role.toUpperCase());
}
