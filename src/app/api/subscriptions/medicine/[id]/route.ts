// Medicine Subscription Management API
// GET /api/subscriptions/medicine/[id] - Get subscription details
// PUT /api/subscriptions/medicine/[id] - Update subscription
// DELETE /api/subscriptions/medicine/[id] - Cancel subscription

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateSubscription } from "@/lib/subscriptions/medicine-subscription";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const subscription = await prisma.medicineSubscription.findUnique({
      where: {
        id: parseInt(params.id),
        tenantId: user.tenantId || 1,
      },
      include: {
        customer: true,
        items: true,
        deliveries: {
          orderBy: {
            deliveryDate: "desc",
          },
        },
      },
    });

    if (!subscription) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      subscription,
    });
  } catch (error: any) {
    console.error("Medicine subscription get API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { status, nextDeliveryDate, autoDelivery, items } = body;

    // Update subscription
    const result = await updateSubscription(parseInt(params.id), {
      status,
      nextDeliveryDate: nextDeliveryDate ? new Date(nextDeliveryDate) : undefined,
      autoDelivery,
      items,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Subscription update failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Subscription updated successfully",
    });
  } catch (error: any) {
    console.error("Medicine subscription update API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    // Cancel subscription (set status to CANCELLED)
    await prisma.medicineSubscription.update({
      where: {
        id: parseInt(params.id),
        tenantId: user.tenantId || 1,
      },
      data: {
        status: "CANCELLED",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Subscription cancelled successfully",
    });
  } catch (error: any) {
    console.error("Medicine subscription cancellation API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
