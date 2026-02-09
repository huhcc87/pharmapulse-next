// Process Referral API
// POST /api/referrals/process - Process referral when new customer uses code

import { NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { processReferral } from "@/lib/referrals/referral-manager";

const DEMO_TENANT_ID = 1;

function toInt(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function resolveTenantId(user: any): number {
  return toInt(user?.tenantId) ?? DEMO_TENANT_ID;
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const referralCode =
      typeof body?.referralCode === "string" ? body.referralCode.trim() : "";
    const customerId = toInt(body?.customerId);

    if (!referralCode) {
      return NextResponse.json(
        { error: "referralCode is required" },
        { status: 400 }
      );
    }

    if (customerId === undefined) {
      return NextResponse.json(
        { error: "customerId is required" },
        { status: 400 }
      );
    }

    const tenantId = resolveTenantId(user);

    const result = await processReferral(referralCode, customerId, tenantId);

    if (!result?.success) {
      return NextResponse.json(
        { error: result?.error || "Referral processing failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Referral processed successfully",
    });
  } catch (error: any) {
    console.error("Process referral API error:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
