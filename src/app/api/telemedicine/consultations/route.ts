// Telemedicine Consultations API
// GET /api/telemedicine/consultations - List consultations
// POST /api/telemedicine/consultations - Book consultation

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bookConsultation, getConsultationHistory } from "@/lib/telemedicine/consultation-manager";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const searchParams = req.nextUrl.searchParams;
    const customerId = searchParams.get("customerId");
    const doctorId = searchParams.get("doctorId");
    const status = searchParams.get("status");

    if (customerId) {
      // Get consultation history for customer
      const history = await getConsultationHistory(
        parseInt(customerId),
        user.tenantId || 1
      );
      return NextResponse.json({
        success: true,
        consultations: history,
      });
    }

    // List all consultations
    const consultations = await prisma.consultation.findMany({
      where: {
        tenantId: user.tenantId || 1,
        ...(doctorId && { doctorId: parseInt(doctorId) }),
        ...(status && { status }),
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        doctor: {
          select: {
            id: true,
            name: true,
            specialization: true,
          },
        },
      },
      orderBy: {
        appointmentDate: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      consultations,
    });
  } catch (error: any) {
    console.error("List consultations API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { customerId, doctorId, appointmentDate, symptoms } = body;

    if (!customerId) {
      return NextResponse.json(
        { error: "customerId is required" },
        { status: 400 }
      );
    }

    if (!doctorId) {
      return NextResponse.json(
        { error: "doctorId is required" },
        { status: 400 }
      );
    }

    if (!appointmentDate) {
      return NextResponse.json(
        { error: "appointmentDate is required" },
        { status: 400 }
      );
    }

    const result = await bookConsultation({
      customerId: parseInt(customerId),
      doctorId: parseInt(doctorId),
      appointmentDate: new Date(appointmentDate),
      symptoms,
      tenantId: user.tenantId || 1,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Consultation booking failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      consultation: {
        id: result.consultationId,
        meetingUrl: result.meetingUrl,
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
