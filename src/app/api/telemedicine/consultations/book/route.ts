// Book Telemedicine Consultation
// POST /api/telemedicine/consultations/book

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEMO_TENANT_ID = 1;

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { doctorId, customerId, appointmentDate, appointmentTime, chiefComplaint } = body;

    if (!doctorId || !customerId || !appointmentDate || !appointmentTime) {
      return NextResponse.json(
        { error: "doctorId, customerId, appointmentDate, and appointmentTime are required" },
        { status: 400 }
      );
    }

    // Validate doctor
    const doctor = await prisma.doctor.findUnique({
      where: { id: parseInt(doctorId) },
    });

    if (!doctor || !doctor.isActive) {
      return NextResponse.json(
        { error: "Doctor not found or inactive" },
        { status: 404 }
      );
    }

    // Validate customer
    const customer = await prisma.customer.findUnique({
      where: { id: parseInt(customerId) },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    // Check if time slot is available (simple check - can be enhanced)
    const existingConsultation = await prisma.consultation.findFirst({
      where: {
        doctorId: parseInt(doctorId),
        appointmentDate: new Date(appointmentDate),
        appointmentTime,
        status: {
          in: ["SCHEDULED", "IN_PROGRESS"],
        },
      },
    });

    if (existingConsultation) {
      return NextResponse.json(
        { error: "Time slot already booked" },
        { status: 400 }
      );
    }

    // Generate video call URL (mock - integrate with Zoom/Google Meet)
    const videoCallUrl = await generateVideoCallUrl(doctorId, customerId);

    // Create consultation
    const consultation = await prisma.consultation.create({
      data: {
        tenantId: DEMO_TENANT_ID,
        doctorId: parseInt(doctorId),
        customerId: parseInt(customerId),
        appointmentDate: new Date(appointmentDate),
        appointmentTime,
        status: "SCHEDULED",
        videoCallProvider: "zoom", // or "google_meet"
        videoCallUrl,
        chiefComplaint: chiefComplaint || null,
        consultationFeePaise: doctor.consultationFeePaise,
        paymentStatus: "UNPAID",
      },
      include: {
        doctor: {
          select: {
            id: true,
            name: true,
            specialization: true,
            qualification: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      consultation: {
        id: consultation.id,
        doctor: consultation.doctor,
        customer: consultation.customer,
        appointmentDate: consultation.appointmentDate,
        appointmentTime: consultation.appointmentTime,
        status: consultation.status,
        videoCallUrl: consultation.videoCallUrl,
        consultationFeePaise: consultation.consultationFeePaise,
      },
    });
  } catch (error: any) {
    console.error("Book consultation API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

async function generateVideoCallUrl(doctorId: number, customerId: number): Promise<string> {
  // TODO: Integrate with Zoom or Google Meet API
  // For now, return mock URL
  const meetingId = `MEET-${Date.now()}-${doctorId}-${customerId}`;
  return `https://zoom.us/j/${meetingId}`;
}
