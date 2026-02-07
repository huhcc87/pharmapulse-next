// Medicine Subscription API
// GET /api/subscriptions/medicine - List subscriptions
// POST /api/subscriptions/medicine - Create subscription

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createMedicineSubscription, updateSubscription } from "@/lib/subscriptions/medicine-subscription";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const searchParams = req.nextUrl.searchParams;
    const customerId = searchParams.get("customerId");
    const status = searchParams.get("status");

    const subscriptions = await prisma.medicineSubscription.findMany({
      where: {
        tenantId: user.tenantId || 1,
        ...(customerId && { customerId: parseInt(customerId) }),
        ...(status && { status }),
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
          orderBy: {
            deliveryDate: "desc",
          },
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
    const {
      customerId,
      subscriptionType,
      items,
      startDate,
      autoDelivery,
      deliveryAddress,
      paymentMethod,
    } = body;

    if (!customerId) {
      return NextResponse.json(
        { error: "customerId is required" },
        { status: 400 }
      );
    }

    if (!subscriptionType || !["MONTHLY", "QUARTERLY", "YEARLY"].includes(subscriptionType)) {
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

    // Create subscription
    const result = await createMedicineSubscription({
      customerId: parseInt(customerId),
      subscriptionType,
      items,
      startDate: startDate ? new Date(startDate) : new Date(),
      autoDelivery: autoDelivery !== false, // Default to true
      deliveryAddress,
      paymentMethod,
      tenantId: user.tenantId || 1,
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
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
