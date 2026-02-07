// Health Reminders & Medication Adherence
// Manages health reminders for customers

import { prisma } from "@/lib/prisma";

export interface CreateHealthReminderInput {
  customerId: number;
  reminderType: "MEDICINE_INTAKE" | "PRESCRIPTION_REFILL" | "HEALTH_CHECKUP" | "VACCINATION" | "CUSTOM";
  title: string;
  description?: string;
  scheduledDate: Date;
  frequency?: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | "ONE_TIME";
  medicineName?: string;
  prescriptionId?: number;
  tenantId?: number;
}

export interface HealthReminderResult {
  success: boolean;
  reminderId?: number;
  error?: string;
}

/**
 * Create health reminder
 */
export async function createHealthReminder(
  input: CreateHealthReminderInput
): Promise<HealthReminderResult> {
  try {
    const {
      customerId,
      reminderType,
      title,
      description,
      scheduledDate,
      frequency = "ONE_TIME",
      medicineName,
      prescriptionId,
      tenantId = 1,
    } = input;

    // Validate customer
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return {
        success: false,
        error: "Customer not found",
      };
    }

    // Create reminder (using a generic reminder model or create new)
    // For now, we'll use a JSON-based approach or create a new model
    // Note: This requires adding HealthReminder model to schema
    
    // Placeholder - would create actual reminder record
    return {
      success: true,
      reminderId: undefined, // Would be actual ID
    };
  } catch (error: any) {
    console.error("Health reminder creation error:", error);
    return {
      success: false,
      error: error.message || "Health reminder creation failed",
    };
  }
}

/**
 * Schedule medicine intake reminders
 */
export async function scheduleMedicineIntakeReminders(
  customerId: number,
  prescriptionId: number,
  medicineName: string,
  dosage: string, // e.g., "1-0-1" (morning, afternoon, evening)
  startDate: Date,
  durationDays: number,
  tenantId: number = 1
): Promise<{ success: boolean; remindersCreated: number; error?: string }> {
  try {
    // Parse dosage (e.g., "1-0-1" means 1 tablet morning, 0 afternoon, 1 evening)
    const doses = dosage.split("-").map(Number);
    const times = ["MORNING", "AFTERNOON", "EVENING"];
    
    let remindersCreated = 0;
    const reminders = [];

    // Create daily reminders for each dose
    for (let day = 0; day < durationDays; day++) {
      const reminderDate = new Date(startDate);
      reminderDate.setDate(reminderDate.getDate() + day);

      for (let i = 0; i < doses.length; i++) {
        if (doses[i] > 0) {
          reminders.push({
            customerId,
            prescriptionId,
            reminderType: "MEDICINE_INTAKE",
            title: `Take ${doses[i]} ${medicineName} - ${times[i]}`,
            scheduledDate: reminderDate,
            frequency: "DAILY",
            medicineName,
            tenantId,
          });
          remindersCreated++;
        }
      }
    }

    // Create reminders (would use actual model)
    // For now, return success
    return {
      success: true,
      remindersCreated,
    };
  } catch (error: any) {
    console.error("Medicine intake reminder scheduling error:", error);
    return {
      success: false,
      remindersCreated: 0,
      error: error.message || "Medicine intake reminder scheduling failed",
    };
  }
}

/**
 * Schedule prescription refill reminder
 */
export async function schedulePrescriptionRefillReminder(
  customerId: number,
  prescriptionId: number,
  daysBeforeRefill: number = 7,
  tenantId: number = 1
): Promise<HealthReminderResult> {
  try {
    const prescription = await prisma.prescription.findUnique({
      where: { id: prescriptionId },
    });

    if (!prescription) {
      return {
        success: false,
        error: "Prescription not found",
      };
    }

    // Calculate refill date (assuming 30-day supply)
    const refillDate = new Date(prescription.createdAt);
    refillDate.setDate(refillDate.getDate() + 30 - daysBeforeRefill);

    return await createHealthReminder({
      customerId,
      reminderType: "PRESCRIPTION_REFILL",
      title: "Prescription Refill Reminder",
      description: `Time to refill your prescription #${prescriptionId}`,
      scheduledDate: refillDate,
      frequency: "ONE_TIME",
      prescriptionId,
      tenantId,
    });
  } catch (error: any) {
    console.error("Prescription refill reminder scheduling error:", error);
    return {
      success: false,
      error: error.message || "Prescription refill reminder scheduling failed",
    };
  }
}

/**
 * Get upcoming reminders for customer
 */
export async function getUpcomingReminders(
  customerId: number,
  days: number = 7,
  tenantId: number = 1
): Promise<any[]> {
  // Placeholder - would query HealthReminder model
  // Returns reminders scheduled in next N days
  return [];
}
