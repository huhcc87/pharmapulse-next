// Medicine Subscription Management
// GET /api/subscriptions - List subscriptions
// POST /api/subscriptions - Create subscription

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEMO_TENANT_ID = 1;

// GET /api/subscriptions
export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const searchParams = req.nextUrl.searchParams;
    const customerId = searchParams.get("customerId");
    const status = searchParams.get("status");

    const where: any = {
      tenantId: DEMO_TENANT_ID,
    };

    if (customerId) {
      where.customerId = parseInt(customerId);
    }

    if (status) {
      where.status = status;
    }

    const subscriptions = await prisma.medicineSubscription.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
        items: true,
        _count: {
          select: {
            deliveries: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({
      subscriptions: subscriptions.map((sub) => ({
        id: sub.id,
        customer: sub.customer,
        subscriptionType: sub.subscriptionType,
        frequency: sub.frequency,
        startDate: sub.startDate,
        endDate: sub.endDate,
        nextDeliveryDate: sub.nextDeliveryDate,
        status: sub.status,
        items: sub.items,
        deliveryCount: (sub as any)._count?.deliveries || 0, // Use _count if available, otherwise 0
      })),
    });
  } catch (error: any) {
    console.error("List subscriptions API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/subscriptions - Create subscription
export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const {
      customerId,
      prescriptionId,
      subscriptionType,
      frequency,
      startDate,
      items,
      deliveryAddress,
      deliveryPhone,
      autoPaymentEnabled,
    } = body;

    if (!customerId || !subscriptionType || !frequency || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "customerId, subscriptionType, frequency, and items are required" },
        { status: 400 }
      );
    }

    // Calculate next delivery date based on frequency
    const start = new Date(startDate || new Date());
    const nextDelivery = new Date(start);
    
    if (frequency === "MONTHLY") {
      nextDelivery.setMonth(nextDelivery.getMonth() + 1);
    } else if (frequency === "WEEKLY") {
      nextDelivery.setDate(nextDelivery.getDate() + 7);
    } else if (frequency === "DAILY") {
      nextDelivery.setDate(nextDelivery.getDate() + 1);
    }

    // Create subscription
    const subscription = await prisma.medicineSubscription.create({
      data: {
        tenantId: DEMO_TENANT_ID,
        customerId: parseInt(customerId),
        prescriptionId: prescriptionId ? parseInt(prescriptionId) : null,
        subscriptionType,
        frequency,
        startDate: start,
        nextDeliveryDate: nextDelivery,
        status: "ACTIVE",
        deliveryAddress: deliveryAddress || null,
        deliveryPhone: deliveryPhone || null,
        autoPaymentEnabled: autoPaymentEnabled || false,
        items: {
          create: items.map((item: any) => ({
            productId: item.productId || null,
            drugLibraryId: item.drugLibraryId || null,
            productName: item.productName,
            quantity: item.quantity || 1,
            dosage: item.dosage || null,
            frequency: item.frequency || null,
          })),
        },
      },
      include: {
        customer: true,
        items: true,
      },
    });

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        customer: subscription.customer,
        subscriptionType: subscription.subscriptionType,
        frequency: subscription.frequency,
        startDate: subscription.startDate,
        nextDeliveryDate: subscription.nextDeliveryDate,
        status: subscription.status,
        items: subscription.items,
      },
    });
  } catch (error: any) {
    console.error("Create subscription API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
