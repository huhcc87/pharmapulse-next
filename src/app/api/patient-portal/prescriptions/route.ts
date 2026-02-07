// GET /api/patient-portal/prescriptions
// Get patient prescriptions

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEMO_TENANT_ID = 1;

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    // In production, get patient ID from session/auth
    // For now, use a default customer ID
    const customerId = parseInt(req.nextUrl.searchParams.get("customerId") || "1");

    const prescriptions = await prisma.prescription.findMany({
      where: {
        tenantId: DEMO_TENANT_ID,
        customerId,
      },
      include: {
        lines: true,
        customer: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    const formatted = prescriptions.map((pres) => ({
      id: pres.id,
      patientName: pres.customer?.name || "Unknown",
      doctorName: pres.doctorName || "Unknown",
      date: pres.createdAt.toISOString(),
      status: pres.status,
      medicines: pres.lines.map((line) => ({
        name: line.medicationName,
        dosage: line.dosage || "As directed",
        frequency: line.frequency || "Daily",
      })),
    }));

    return NextResponse.json({
      prescriptions: formatted,
    });
  } catch (error: any) {
    console.error("Get prescriptions error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get prescriptions" },
      { status: 500 }
    );
  }
}
