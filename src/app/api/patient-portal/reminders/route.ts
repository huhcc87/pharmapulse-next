// GET /api/patient-portal/reminders
// Get patient medication reminders

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEMO_TENANT_ID = 1;

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const customerId = parseInt(req.nextUrl.searchParams.get("customerId") || "1");

    // Get adherence records for patient
    // TODO: adherenceRecord model doesn't exist in schema - implement when model is added
    // For now, return empty array until model is implemented
    const adherenceRecords: any[] = [];

    const reminders = adherenceRecords.map((record) => ({
      id: record.id,
      medicineName: record.medicineName,
      time: record.scheduledTime.toISOString().split("T")[1].substring(0, 5),
      status: record.status as "PENDING" | "TAKEN" | "MISSED",
      date: record.scheduledTime.toISOString().split("T")[0],
    }));

    return NextResponse.json({
      reminders,
    });
  } catch (error: any) {
    console.error("Get reminders error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get reminders" },
      { status: 500 }
    );
  }
}
