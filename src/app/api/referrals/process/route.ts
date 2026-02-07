// Process Referral API
// POST /api/referrals/process - Process referral when new customer uses code

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { processReferral } from "@/lib/referrals/referral-manager";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { referralCode, customerId } = body;

    if (!referralCode) {
      return NextResponse.json(
        { error: "referralCode is required" },
        { status: 400 }
      );
    }

    if (!customerId) {
      return NextResponse.json(
        { error: "customerId is required" },
        { status: 400 }
      );
    }

    const result = await processReferral(
      referralCode,
      parseInt(customerId),
      user.tenantId || 1
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Referral processing failed" },
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
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
