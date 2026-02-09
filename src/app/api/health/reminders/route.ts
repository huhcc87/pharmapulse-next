// Health Reminders API
// GET /api/health/reminders - Get reminders
// POST /api/health/reminders - Create reminder

import { NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import {
  createHealthReminder,
  scheduleMedicineIntakeReminders,
  schedulePrescriptionRefillReminder,
  getUpcomingReminders,
} from "@/lib/health/health-reminders";

const DEMO_TENANT_ID = 1;

function resolveTenantId(user: any): number {
  const raw = user?.tenantId;

  if (typeof raw === "number" && Number.isFinite(raw)) return raw;

  if (typeof raw === "string") {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }

  return DEMO_TENANT_ID;
}

function toInt(value: unknown, fallback?: number): number | undefined {
  if (value === null || value === undefined) return fallback;
  const n = typeof value === "number" ? value : Number(String(value));
  return Number.isFinite(n) ? n : fallback;
}

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = resolveTenantId(user);

    const { searchParams } = new URL(req.url);
    const customerIdRaw = searchParams.get("customerId");
    const daysRaw = searchParams.get("days") ?? "7";

    const customerId = toInt(customerIdRaw);
    const days = toInt(daysRaw, 7) ?? 7;

    if (!customerId) {
      return NextResponse.json(
        { error: "customerId is required" },
        { status: 400 }
      );
    }

    const reminders = await getUpcomingReminders(customerId, days, tenantId);

    return NextResponse.json({
      success: true,
      reminders,
    });
  } catch (error: any) {
    console.error("Get health reminders API error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = resolveTenantId(user);

    const body = await req.json();
    const { type, ...data } = body ?? {};

    if (!type) {
      return NextResponse.json(
        { error: "Reminder type is required" },
        { status: 400 }
      );
    }

    let result: any;

    switch (type) {
      case "medicine_intake": {
        const customerId = toInt(data.customerId);
        const prescriptionId = toInt(data.prescriptionId);
        const durationDays = toInt(data.durationDays);

        if (!customerId || !prescriptionId || !data.medicineName || !data.startDate || !durationDays) {
          return NextResponse.json(
            { error: "Missing required fields for medicine_intake" },
            { status: 400 }
          );
        }

        result = await scheduleMedicineIntakeReminders(
          customerId,
          prescriptionId,
          data.medicineName,
          data.dosage,
          new Date(data.startDate),
          durationDays,
          tenantId
        );
        break;
      }

      case "prescription_refill": {
        const customerId = toInt(data.customerId);
        const prescriptionId = toInt(data.prescriptionId);
        const daysBeforeRefill = toInt(data.daysBeforeRefill, 7) ?? 7;

        if (!customerId || !prescriptionId) {
          return NextResponse.json(
            { error: "Missing required fields for prescription_refill" },
            { status: 400 }
          );
        }

        result = await schedulePrescriptionRefillReminder(
          customerId,
          prescriptionId,
          daysBeforeRefill,
          tenantId
        );
        break;
      }

      case "custom": {
        if (!data.scheduledDate) {
          return NextResponse.json(
            { error: "scheduledDate is required for custom reminders" },
            { status: 400 }
          );
        }

        result = await createHealthReminder({
          ...data,
          scheduledDate: new Date(data.scheduledDate),
          tenantId,
        });
        break;
      }

      default:
        return NextResponse.json(
          { error: `Unknown reminder type: ${type}` },
          { status: 400 }
        );
    }

    if (!result?.success) {
      return NextResponse.json(
        { error: result?.error || "Reminder creation failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      reminderId: result.reminderId,
      ...(result?.remindersCreated != null && { remindersCreated: result.remindersCreated }),
    });
  } catch (error: any) {
    console.error("Create health reminder API error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
