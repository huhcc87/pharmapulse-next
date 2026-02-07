// Subscription Pause/Resume API
// POST /api/billing/subscription/pause - Pause
// POST /api/billing/subscription/resume - Resume

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { pauseSubscription, resumeSubscription } from "@/lib/billing/subscription-management";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { action, reason } = body;

    if (!action || !["pause", "resume"].includes(action)) {
      return NextResponse.json(
        { error: "action must be 'pause' or 'resume'" },
        { status: 400 }
      );
    }

    const tenantId = user.tenantId || "default";

    if (action === "pause") {
      const result = await pauseSubscription(tenantId, reason);
      return NextResponse.json({
        success: true,
        pausedUntil: result.pausedUntil,
      });
    } else {
      const result = await resumeSubscription(tenantId);
      return NextResponse.json({
        success: true,
      });
    }
  } catch (error: any) {
    console.error("Pause/Resume subscription API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
