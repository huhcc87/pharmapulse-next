// Health Reminders API
// GET /api/health/reminders - Get reminders
// POST /api/health/reminders - Create reminder

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import {
  createHealthReminder,
  scheduleMedicineIntakeReminders,
  schedulePrescriptionRefillReminder,
  getUpcomingReminders,
} from "@/lib/health/health-reminders";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const searchParams = req.nextUrl.searchParams;
    const customerId = searchParams.get("customerId");
    const days = searchParams.get("days") || "7";

    if (!customerId) {
      return NextResponse.json(
        { error: "customerId is required" },
        { status: 400 }
      );
    }

    const reminders = await getUpcomingReminders(
      parseInt(customerId),
      parseInt(days),
      user.tenantId || 1
    );

    return NextResponse.json({
      success: true,
      reminders,
    });
  } catch (error: any) {
    console.error("Get health reminders API error:", error);
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
    const { type, ...data } = body;

    if (!type) {
      return NextResponse.json(
        { error: "Reminder type is required" },
        { status: 400 }
      );
    }

    let result;

    switch (type) {
      case "medicine_intake":
        result = await scheduleMedicineIntakeReminders(
          data.customerId,
          data.prescriptionId,
          data.medicineName,
          data.dosage,
          new Date(data.startDate),
          data.durationDays,
          user.tenantId || 1
        );
        break;

      case "prescription_refill":
        result = await schedulePrescriptionRefillReminder(
          data.customerId,
          data.prescriptionId,
          data.daysBeforeRefill || 7,
          user.tenantId || 1
        );
        break;

      case "custom":
        result = await createHealthReminder({
          ...data,
          scheduledDate: new Date(data.scheduledDate),
          tenantId: user.tenantId || 1,
        });
        break;

      default:
        return NextResponse.json(
          { error: `Unknown reminder type: ${type}` },
          { status: 400 }
        );
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Reminder creation failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      reminderId: result.reminderId,
      ...(result as any).remindersCreated && { remindersCreated: (result as any).remindersCreated },
    });
  } catch (error: any) {
    console.error("Create health reminder API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
