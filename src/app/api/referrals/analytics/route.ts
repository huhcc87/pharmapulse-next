// Referral Analytics API
// GET /api/referrals/analytics?customerId=123

import { NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { getReferralAnalytics } from "@/lib/referrals/referral-manager";

const DEMO_TENANT_ID = 1;

function toInt(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function resolveTenantId(user: any): number {
  // user.tenantId might be string | number | undefined
  return toInt(user?.tenantId) ?? DEMO_TENANT_ID;
}

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const url = new URL(req.url);
    const customerId = toInt(url.searchParams.get("customerId"));

    if (customerId === undefined) {
      return NextResponse.json(
        { error: "customerId is required" },
        { status: 400 }
      );
    }

    const tenantId = resolveTenantId(user);

    const analytics = await getReferralAnalytics(customerId, tenantId);

    return NextResponse.json({
      success: true,
      analytics,
    });
  } catch (error: any) {
    console.error("Referral analytics API error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
