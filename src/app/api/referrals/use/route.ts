// Use Referral Code
// POST /api/referrals/use

import { NextRequest, NextResponse } from "next/server";
import { getSessionUser, requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEMO_TENANT_ID = 1;

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    requireAuth(user);

    const body = await req.json();
    const { code, customerId } = body;

    if (!code || !customerId) {
      return NextResponse.json(
        { error: "code and customerId are required" },
        { status: 400 }
      );
    }

    // Find referral code
    const referralCode = await prisma.referralCode.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        referrer: true,
      },
    });

    if (!referralCode) {
      return NextResponse.json(
        { error: "Invalid referral code" },
        { status: 404 }
      );
    }

    if (!referralCode.isActive) {
      return NextResponse.json(
        { error: "Referral code is not active" },
        { status: 400 }
      );
    }

    // Check validity period
    const now = new Date();
    if (now < referralCode.validFrom) {
      return NextResponse.json(
        { error: "Referral code is not yet valid" },
        { status: 400 }
      );
    }

    if (referralCode.validUntil && now > referralCode.validUntil) {
      return NextResponse.json(
        { error: "Referral code has expired" },
        { status: 400 }
      );
    }

    // Check usage limit
    if (referralCode.maxUses && referralCode.usedCount >= referralCode.maxUses) {
      return NextResponse.json(
        { error: "Referral code usage limit reached" },
        { status: 400 }
      );
    }

    // Check if customer already used this code
    const existingReferral = await prisma.referral.findFirst({
      where: {
        referralCodeId: referralCode.id,
        referredCustomerId: parseInt(customerId),
      },
    });

    if (existingReferral) {
      return NextResponse.json(
        { error: "You have already used this referral code" },
        { status: 400 }
      );
    }

    // Check if customer is trying to use their own code
    if (referralCode.referrerId === parseInt(customerId)) {
      return NextResponse.json(
        { error: "You cannot use your own referral code" },
        { status: 400 }
      );
    }

    // Create referral record
    const referral = await prisma.referral.create({
      data: {
        referralCodeId: referralCode.id,
        referrerId: referralCode.referrerId,
        referredCustomerId: parseInt(customerId),
        status: "PENDING", // Will be rewarded on first purchase
      },
      include: {
        referrer: {
          select: {
            id: true,
            name: true,
          },
        },
        referredCustomer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Update usage count
    await prisma.referralCode.update({
      where: { id: referralCode.id },
      data: {
        usedCount: {
          increment: 1,
        },
      },
    });

    return NextResponse.json({
      success: true,
      referral: {
        id: referral.id,
        code: referralCode.code,
        referrer: referral.referrer,
        referredCustomer: referral.referredCustomer,
        status: referral.status,
        message: "Referral code applied successfully. Rewards will be credited after your first purchase.",
      },
      rewards: {
        referrerReward: {
          type: referralCode.referrerRewardType,
          value: referralCode.referrerRewardValue,
        },
        referredReward: {
          type: referralCode.referredRewardType,
          value: referralCode.referredRewardValue,
        },
      },
    });
  } catch (error: any) {
    console.error("Use referral code API error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
