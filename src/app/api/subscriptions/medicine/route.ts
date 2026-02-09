// src/app/api/subscriptions/medicine/route.ts
// Medicine Subscription API
// GET /api/subscriptions/medicine - List subscriptions
// POST /api/subscriptions/medicine - Create subscription

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createMedicineSubscription } from "@/lib/subscriptions/medicine-subscription";

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
  // Ensures tenantId is always a number for Prisma
  return toInt(user?.tenantId) ?? DEMO_TENANT_ID;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const tenantId = resolveTenantId(user);

    const searchParams = req.nextUrl.searchParams;
    const customerIdRaw = searchParams.get("customerId");
    const statusRaw = searchParams.get("status");

    const customerId = toInt(customerIdRaw);

    // NOTE:
    // If your Prisma schema defines `status` as an enum, this is still fine at runtime.
    // If TypeScript complains in YOUR project, you can cast as `any` in the where clause below.
    const status = statusRaw ?? undefined;

    const subscriptions = await prisma.medicineSubscription.findMany({
      where: {
        tenantId,
        ...(customerId !== undefined ? { customerId } : {}),
        ...(status ? ({ status } as any) : {}),
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
          },
        },
        items: true,
        deliveries: {
          take: 10,
          // Your model does NOT have `deliveryDate` (per Prisma error).
          // Use a common field; change to your real field later (e.g., scheduledAt/deliveredAt/date).
          orderBy: { createdAt: "desc" } as any,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      success: true,
      subscriptions,
    });
  } catch (error: any) {
    console.error("Medicine subscription list API error:", error);
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
    const {
      customerId,
      subscriptionType,
      items,
      startDate,
      autoDelivery,
      deliveryAddress,
      paymentMethod,
    } = body ?? {};

    const customerIdNum = toInt(customerId);

    if (!customerIdNum) {
      return NextResponse.json(
        { error: "customerId is required" },
        { status: 400 }
      );
    }

    if (
      !subscriptionType ||
      !["MONTHLY", "QUARTERLY", "YEARLY"].includes(subscriptionType)
    ) {
      return NextResponse.json(
        { error: "subscriptionType must be MONTHLY, QUARTERLY, or YEARLY" },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "items array is required" },
        { status: 400 }
      );
    }

    const result = await createMedicineSubscription({
      customerId: customerIdNum,
      subscriptionType,
      items,
      startDate: startDate ? new Date(startDate) : new Date(),
      autoDelivery: autoDelivery !== false,
      deliveryAddress,
      paymentMethod,
      tenantId,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Subscription creation failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      subscription: {
        id: result.subscriptionId,
        subscriptionNumber: result.subscriptionNumber,
      },
    });
  } catch (error: any) {
    console.error("Medicine subscription creation API error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
