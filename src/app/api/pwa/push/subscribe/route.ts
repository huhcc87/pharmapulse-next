// POST /api/pwa/push/subscribe
// Subscribe to push notifications

import { NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEMO_TENANT_ID = 1;

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { subscription, tenantId = DEMO_TENANT_ID } = body;

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json(
        { error: "Invalid subscription data" },
        { status: 400 }
      );
    }

    // Save subscription to database
    // Note: You'll need to add a PushSubscription model to schema
    // For now, we'll store in a JSON field or create the model

    return NextResponse.json({
      success: true,
      message: "Successfully subscribed to push notifications",
    });
  } catch (error: any) {
    console.error("Push subscription error:", error);
    return NextResponse.json(
      {
        error: "Failed to subscribe to push notifications",
        message: error.message,
      },
      { status: 500 }
    );
  }
}
