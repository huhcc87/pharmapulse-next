// src/app/api/telemedicine/consultations/route.ts
// Telemedicine Consultations API
// GET /api/telemedicine/consultations - List consultations
// POST /api/telemedicine/consultations - Book consultation

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  bookConsultation,
  getConsultationHistory,
} from "@/lib/telemedicine/consultation-manager";

const DEMO_TENANT_ID = 1;

function toInt(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const n =
    typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function resolveTenantId(user: any): number {
  return toInt(user?.tenantId) ?? DEMO_TENANT_ID;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = resolveTenantId(user);

    const searchParams = req.nextUrl.searchParams;
    const customerIdRaw = searchParams.get("customerId");
    const doctorIdRaw = searchParams.get("doctorId");
    const statusRaw = searchParams.get("status");

    const customerId = toInt(customerIdRaw);
    const doctorId = toInt(doctorIdRaw);
    const status = statusRaw ?? undefined;

    if (customerId !== undefined) {
      // Get consultation history for customer
      const history = await getConsultationHistory(customerId, tenantId);

      return NextResponse.json({
        success: true,
        consultations: history,
      });
    }

    // List all consultations
    const consultations = await prisma.consultation.findMany({
      where: {
        tenantId,
        ...(doctorId !== undefined ? { doctorId } : {}),
        ...(status ? ({ status } as any) : {}),
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
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = resolveTenantId(user);

    const body = await req.json();
    const { customerId, doctorId, appointmentDate, symptoms } = body ?? {};

    const customerIdNum = toInt(customerId);
    const doctorIdNum = toInt(doctorId);

    if (customerIdNum === undefined) {
      return NextResponse.json(
        { error: "customerId is required" },
        { status: 400 }
      );
    }

    if (doctorIdNum === undefined) {
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

    const apptDate = new Date(appointmentDate);
    if (Number.isNaN(apptDate.getTime())) {
      return NextResponse.json(
        { error: "appointmentDate must be a valid date" },
        { status: 400 }
      );
    }

    const result = await bookConsultation({
      customerId: customerIdNum,
      doctorId: doctorIdNum,
      appointmentDate: apptDate,
      symptoms,
      tenantId, // ✅ always number
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
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
