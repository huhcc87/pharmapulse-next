// Telemedicine Consultation Management
// Handles doctor consultations, video calls, and e-prescriptions

import { prisma } from "@/lib/prisma";

export interface BookConsultationInput {
  customerId: number;
  doctorId: number;
  appointmentDate: Date;
  symptoms?: string;
  tenantId?: number;
}

export interface ConsultationResult {
  success: boolean;
  consultationId?: number;
  meetingUrl?: string;
  error?: string;
}

/**
 * Book telemedicine consultation
 */
export async function bookConsultation(
  input: BookConsultationInput
): Promise<ConsultationResult> {
  try {
    const { customerId, doctorId, appointmentDate, symptoms, tenantId = 1 } = input;

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

    // Validate doctor
    const doctor = await prisma.doctor.findUnique({
      where: { id: doctorId },
    });

    if (!doctor) {
      return {
        success: false,
        error: "Doctor not found",
      };
    }

    // Generate meeting URL (Zoom/Google Meet)
    const meetingUrl = generateMeetingUrl(doctorId, customerId);

    // Create consultation
    const consultation = await prisma.consultation.create({
      data: {
        tenantId,
        customerId,
        doctorId,
        appointmentDate,
        status: "SCHEDULED",
        symptoms: symptoms || null,
        meetingUrl,
        consultationFeePaise: doctor.consultationFeePaise || 0,
      },
    });

    return {
      success: true,
      consultationId: consultation.id,
      meetingUrl: consultation.meetingUrl || undefined,
    };
  } catch (error: any) {
    console.error("Consultation booking error:", error);
    return {
      success: false,
      error: error.message || "Consultation booking failed",
    };
  }
}

/**
 * Generate meeting URL for video call
 * Supports Zoom, Google Meet, or custom WebRTC
 */
function generateMeetingUrl(doctorId: number, customerId: number): string {
  const provider = process.env.VIDEO_CALL_PROVIDER || "ZOOM";
  const meetingId = `${doctorId}-${customerId}-${Date.now()}`;

  if (provider === "ZOOM") {
    // Zoom meeting URL format
    return `https://zoom.us/j/${meetingId}`;
  } else if (provider === "GOOGLE_MEET") {
    // Google Meet URL format
    return `https://meet.google.com/${meetingId.substring(0, 12)}`;
  } else {
    // Custom WebRTC or other provider
    return `${process.env.APP_URL || "https://app.pharmapulse.com"}/video-call/${meetingId}`;
  }
}

/**
 * Complete consultation and generate e-prescription
 */
export async function completeConsultation(
  consultationId: number,
  diagnosis: string,
  prescriptionLines: Array<{
    drugLibraryId?: number;
    medicationName: string;
    dosage: string;
    frequency: string;
    duration: string;
    quantity: number;
  }>,
  tenantId: number = 1
): Promise<{ success: boolean; prescriptionId?: number; error?: string }> {
  try {
    const consultation = await prisma.consultation.findUnique({
      where: { id: consultationId },
      include: {
        customer: true,
        doctor: true,
      },
    });

    if (!consultation) {
      return {
        success: false,
        error: "Consultation not found",
      };
    }

    if (consultation.status !== "SCHEDULED" && consultation.status !== "IN_PROGRESS") {
      return {
        success: false,
        error: "Consultation cannot be completed",
      };
    }

    // Update consultation status
    await prisma.consultation.update({
      where: { id: consultationId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        diagnosis: diagnosis || null,
      },
    });

    // Create prescription from consultation
    const prescription = await prisma.prescription.create({
      data: {
        tenantId,
        customerId: consultation.customerId,
        doctorId: consultation.doctorId,
        consultationId: consultation.id,
        status: "VERIFIED",
        prescriptionDate: new Date(),
        lines: {
          create: prescriptionLines.map((line) => ({
            drugLibraryId: line.drugLibraryId || null,
            medicationName: line.medicationName,
            dosage: line.dosage,
            frequency: line.frequency,
            duration: line.duration,
            quantity: line.quantity,
          })),
        },
      },
    });

    return {
      success: true,
      prescriptionId: prescription.id,
    };
  } catch (error: any) {
    console.error("Consultation completion error:", error);
    return {
      success: false,
      error: error.message || "Consultation completion failed",
    };
  }
}

/**
 * Get consultation history for customer
 */
export async function getConsultationHistory(
  customerId: number,
  tenantId: number = 1
): Promise<any[]> {
  const consultations = await prisma.consultation.findMany({
    where: {
      customerId,
      tenantId,
    },
    include: {
      doctor: {
        select: {
          id: true,
          name: true,
          specialization: true,
        },
      },
      prescription: {
        include: {
          lines: true,
        },
      },
    },
    orderBy: {
      appointmentDate: "desc",
    },
  });

  return consultations;
}
