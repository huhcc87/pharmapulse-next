// Referral Code API
// GET /api/referrals/code - Get customer's referral code
// POST /api/referrals/code - Generate referral code

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateReferralCode } from "@/lib/referrals/referral-manager";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const searchParams = req.nextUrl.searchParams;
    const customerId = searchParams.get("customerId");

    if (!customerId) {
      return NextResponse.json(
        { error: "customerId is required" },
        { status: 400 }
      );
    }

    const referralCode = await prisma.referralCode.findFirst({
      where: {
        referrerId: parseInt(customerId),
        tenantId: user.tenantId || 1,
        isActive: true,
      },
    });

    if (!referralCode) {
      return NextResponse.json({
        success: false,
        message: "No referral code found. Generate one first.",
      });
    }

    return NextResponse.json({
      success: true,
      referralCode: {
        code: referralCode.code,
        createdAt: referralCode.createdAt,
      },
    });
  } catch (error: any) {
    console.error("Get referral code API error:", error);
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
    const { customerId } = body;

    if (!customerId) {
      return NextResponse.json(
        { error: "customerId is required" },
        { status: 400 }
      );
    }

    const result = await generateReferralCode({
      customerId: parseInt(customerId),
      tenantId: user.tenantId || 1,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Referral code generation failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      referralCode: result.referralCode,
    });
  } catch (error: any) {
    console.error("Generate referral code API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
